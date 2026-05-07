# Troubleshooting

This document covers the most common issues encountered with Secure-Smart-Sync, their causes, and how to resolve them. If your issue is not listed here, open an issue on [GitHub](https://github.com/xensenx/Secure-Smart-Sync/issues) with the relevant log output.

---

## Contents

- [Connection failures](#connection-failures)
- [Sync does not run](#sync-does-not-run)
- [Sync runs but transfers nothing](#sync-runs-but-transfers-nothing)
- [Wrong or missing files after sync](#wrong-or-missing-files-after-sync)
- [Encryption issues](#encryption-issues)
- [Conflict files appearing](#conflict-files-appearing)
- [Smart Sync and automation](#smart-sync-and-automation)
- [Mobile-specific issues](#mobile-specific-issues)
- [Device pairing](#device-pairing)
- [Performance](#performance)
- [Reading the logs](#reading-the-logs)
- [Recovery procedures](#recovery-procedures)
- [Error reference](#error-reference)

---

## Connection failures

### "Cannot connect to R2. Check your credentials and endpoint."

This error fires before the sync engine starts. Work through the checklist in order.

**1. Endpoint format**

The endpoint must be a full HTTPS URL in this exact form:

```
https://<account-id>.r2.cloudflarestorage.com
```

Common mistakes:
- Including the bucket name in the endpoint URL (`https://<id>.r2.cloudflarestorage.com/my-bucket` — the bucket name belongs in the **Bucket** field only)
- Missing the `https://` prefix (the plugin adds it automatically, but verify the field is not blank)
- Using an S3-regional endpoint instead of the R2-specific endpoint

**2. API token permissions**

The token must have at minimum:
- `Object Read` — for downloads, remote walk, connection test
- `Object Write` — for uploads and sentinel writes
- `Object Delete` — for remote deletions (optional if you never delete)

Tokens with only "Read" permission will pass the connection test but fail on the first upload.

**3. Bucket name**

The bucket name is case-sensitive and must match exactly what appears in the Cloudflare dashboard. Verify there are no leading or trailing spaces.

**4. Secret Access Key**

The secret is only shown once when the token is created in Cloudflare. If you did not copy it at creation time, generate a new token — there is no way to retrieve the original.

**5. Network / firewall**

On corporate networks or VPNs, outbound HTTPS to `*.r2.cloudflarestorage.com` may be blocked. Test from a different network to confirm.

---

### Connection test passes but sync still fails

The connection test uses a lightweight `ListObjects` call. It can succeed while other operations fail if:

- The token has `Read` but not `Write` permission
- The bucket has a CORS policy blocking `PUT` or `DELETE` (rare for R2, but check if you added custom CORS rules)
- The remote prefix you configured does not match the prefix under which files were originally written

---

### "R2 endpoint, bucket name, and access key are required"

At least one of those three fields is empty. Open Settings → Devices → Configure Connection and fill in all three fields before running a sync.

---

## Sync does not run

### Manual sync button does nothing

If pressing the ribbon icon (desktop) or the floating indicator (mobile) produces no visible response:

1. Check the Obsidian developer console (`Ctrl+Shift+I` on desktop, or enable Debug log level in SSS settings and check the console) for errors
2. Confirm the plugin is enabled in Settings → Community plugins
3. Confirm R2 credentials are configured — SSS silently skips syncs when the endpoint or bucket name is blank

### "Already syncing, please wait"

A sync is in progress. SSS prevents concurrent syncs to avoid data races. Wait for the current operation to finish. If this message persists for several minutes, a previous sync may have stalled. Restart Obsidian to clear the lock.

### Smart Sync idle trigger never fires

Smart Sync fires N seconds after you stop typing. Verify:

1. **Smart Sync is enabled** — Settings → Automation → Smart Sync toggle must be on
2. **Idle seconds** — default is 4. If you changed it, ensure the value is between 1 and 300
3. **R2 is configured** — Smart Sync skips silently if credentials are missing
4. The Obsidian window must be in focus. Smart Sync pauses when the document is hidden (app backgrounded or tab switched away) and resumes when you return

### Auto-sync interval never triggers (legacy mode)

Legacy auto-sync requires Smart Sync to be **off**. If Smart Sync is on, it overrides all manual automation settings. Turn Smart Sync off first, then set an interval in the Auto-Sync Interval field (in minutes).

---

## Sync runs but transfers nothing

### "Up to date" on every sync even though files changed

This is almost always a prevSync record issue. The three-way diff engine uses a local database of the last known sync state. If that record is stale or was written before an ETag fix, the engine concludes nothing changed.

**Fix:** Open Settings → Danger Zone → Reset Sync History. The next sync compares local vs. remote directly and rebuilds the database from scratch. This is safe — no files are deleted.

### Files changed on Device A are not appearing on Device B

With Smart Sync enabled, Device B detects Device A's changes via the sentinel file. Possible reasons it is not working:

1. **Device B is idle (Obsidian closed or backgrounded)** — Device B only polls while Obsidian is running and visible. When you reopen Obsidian on Device B, Smart Sync fires an on-open sync automatically if it has been more than 2 minutes since the last sync.

2. **Device A's sync was pull-only** — If Device A opened and pulled changes without pushing anything, it intentionally does not write the sentinel (to avoid waking Device B for nothing). This is correct behaviour.

3. **Poll interval** — In idle mode the poll interval is 30 seconds. If Device B's Obsidian is open but idle, wait up to 30 seconds after Device A's sync for Device B to react.

4. **Mismatched remote prefix** — Both devices must use the same Remote Prefix. If one has `vault/` and the other has it blank, they are reading from different locations in the bucket.

### Sync says files were uploaded but they are not on the remote

If the connection test passes but uploads fail silently:

- Confirm the API token has Write permission
- Check whether a remote prefix is configured — if the prefix does not exist as a "folder" in the bucket, R2 still creates the object under that prefix, but verify the path is what you expect by checking the Cloudflare R2 dashboard
- Run a sync with Log Level set to Debug and check the console for specific PUT errors

---

## Wrong or missing files after sync

### A file was deleted locally but sync keeps restoring it

This happens when the prevSync database has no record of the file. Without a prevSync entry, the engine cannot distinguish "file that never existed here" from "file deleted by the user here". The engine defaults to pulling the remote copy.

**Fix:** If you want the local deletion to propagate to remote, trigger the sync from the device that deleted the file immediately after deletion, before another device syncs. The engine will see local=missing, prevSync=present → `delete_remote` decision.

If the file keeps coming back across restarts, reset sync history and do a manual sync from the device where the file should be absent. The engine will then see local=missing, remote=present, prevSync=missing → treat as new remote file and pull it. Delete it again immediately, then sync again — this time prevSync=present, local=missing → delete_remote.

### Files are duplicated with `.conflict-` in the name

See [Conflict files appearing](#conflict-files-appearing) below. Conflict backups are intentional.

### Sync deleted files it should not have

This can happen when:

1. A device syncs immediately after another device deletes files, before the deletion has been recorded in prevSync on the second device
2. The sync direction is set to `push_only` on one device and it pushed a state where a file does not exist, overwriting the remote copy that another device had

Check your sync direction setting. For most users it should be `bidirectional`.

### Large files are not syncing

If Max File Size is set to anything other than 0 (unlimited), files above that threshold are skipped. Check Settings → Sync Behaviour → Skip Files Larger Than. Set to `0` to remove the limit.

---

## Encryption issues

### "Encryption password check failed: wrong_password_or_not_encrypted"

The password in settings does not match the password used to encrypt the existing remote files. Possible causes:

- You changed the encryption password after files were already uploaded with the old password
- You imported credentials via pairing and the password transferred incorrectly
- The encryption method was changed after files were uploaded (e.g., from `openssl-base64` to `rclone-base64`)

**Important:** Changing the encryption password or method does not re-encrypt existing remote files. The remote files remain encrypted with the old password. You would need to remove all remote files and do a fresh push with the new password to recover from this state.

**Fix for wrong password:** Enter the correct original password. If you have lost it, the remote files are inaccessible — there is no recovery mechanism, by design.

### "Encryption password check failed: method_mismatch"

The remote files were encrypted with a different method than the one currently selected. Switch the Encryption Method setting back to match what was originally used.

### "Encryption password check failed: remote_encrypted_no_local_password"

The remote bucket contains encrypted files but the local password field is empty. Enter the correct password in Settings → Encryption → Password.

### Remote files appear garbled or have strange names in the R2 dashboard

This is expected. When encryption is enabled, both file contents and (for `rclone-base64`) file names are encrypted. The R2 dashboard will show ciphertext. This is correct behaviour.

### After changing encryption settings, some files show as changed on every sync

This occurs when the prevSync records were written under different encryption settings. The ETag comparison fails because the encrypted blob changed. Reset sync history to clear stale records.

---

## Conflict files appearing

### What are `.conflict-` files?

When both Device A and Device B modify the same file between syncs, SSS cannot safely merge the changes. It applies your configured conflict resolution rule (default: keep newer) and saves the losing version as a backup named:

```
filename.conflict-YYYY-MM-DD_HH-MM-SS.md
```

This backup is pushed to remote on the next sync and will appear on all devices. It is a deliberate safety mechanism — no data is discarded silently.

### Conflicts are appearing too frequently

The most common cause is a clock skew between devices. "Keep newer" compares modification timestamps with a 1-second tolerance. If Device A's clock is significantly ahead of Device B's clock, Device A's version will always win regardless of which was actually edited last.

**Fix:** Ensure both devices have accurate system time. On mobile this is usually handled automatically. On desktop, verify your system clock is synced to NTP.

### How to clean up conflict files

Review each `.conflict-` file, keep the version you want, and delete the others. Sync will then propagate the deletion to all devices.

### Preventing conflicts

The best way to avoid conflicts is to let Smart Sync complete before switching devices. Because Smart Sync fires a few seconds after you stop typing, waiting a moment after finishing a session on one device before picking up on another is usually enough.

---

## Smart Sync and automation

### Smart Sync fires but the other device does not react

Smart Sync uses a sentinel file to signal other devices. The other device must be running Obsidian and polling. Check:

1. **Obsidian is open on Device B** — the plugin does not run when Obsidian is closed
2. **Poll interval** — the active poll interval (default 2 seconds) applies only while Device B has been active in the last 2 minutes. Otherwise the idle interval (default 30 seconds) applies. The maximum wait after Device A syncs is one poll tick
3. **Device B backgrounded on mobile** — mobile OSes suspend background apps. When Device B returns to the foreground, Smart Sync fires an on-open sync. See [Mobile-specific issues](#mobile-specific-issues)

### Smart Sync on-open is not catching changes made while Obsidian was closed

The on-open init sync fires 5 seconds after load on mobile and 8 seconds on desktop, but only if more than 2 minutes have passed since the last sync. If you just restarted Obsidian within 2 minutes of the previous sync, the on-open sync is intentionally skipped.

### Both devices keep syncing back and forth

This was a known issue. As of the current version:

- Startup syncs that only pull from remote do not write the sentinel, so the other device is not woken up
- Syncs that find nothing to push do not write the sentinel

If you are still seeing loops, check that both devices are on the same plugin version and reset sync history on both.

### The idle timer fires immediately after Obsidian opens

On first load, `_lastEditAt` is 0, which makes the adaptive interval return the idle value (30 seconds) rather than the active value (2 seconds). This is correct — the active interval is reserved for when the user is actually editing. Smart Sync on-open handles the startup case separately.

---

## Mobile-specific issues

### Sync does not run when returning to Obsidian on mobile

Mobile OSes suspend apps when they are backgrounded. When Obsidian returns to the foreground:

1. The sentinel poll loop restarts immediately
2. An immediate poll fires
3. If more than 2 minutes have passed since the last sync, an on-open init sync fires after 5 seconds

If none of these are happening, check that Smart Sync is enabled and R2 is configured.

### The floating sync indicator is not visible

The indicator hides itself when any of the following are visible: a modal, the command palette, toast notifications, or the left sidebar. It reappears when those are dismissed. If it is permanently hidden, ensure you are not in a state where one of those overlays is open but not obviously visible.

### The floating indicator is not hiding when the sidebar opens

The indicator detects sidebar state using Obsidian's workspace model and a DOM bounding-rect fallback. If it is not hiding on your device and Obsidian version, open a GitHub issue with your Obsidian version number — different builds signal sidebar state differently.

### Syncing is slow on first open on mobile

The first sync after a cold start (process was killed by the OS) has to walk both local and remote storage from scratch. This takes longer than an incremental sync. On subsequent opens where the process was merely backgrounded, sync is faster because the OS preserved the plugin's state.

### "Already syncing" on mobile after returning to the app

If Obsidian was backgrounded mid-sync, the `isSyncing` flag can persist until the operation times out or errors. Restart Obsidian if this state persists for more than a few minutes.

---

## Device pairing

### Pairing code is rejected ("invalid code" or "not found")

- Pairing codes expire after **10 minutes**. Generate a new one if the original has expired
- The code is case-sensitive. On mobile, auto-correct may have changed a character — disable auto-correct before entering the code or paste it directly
- Each code can only be used once. If you entered it on one device already, generate a new code for the next device

### Pairing imports credentials but connection test fails

The pairing bundle contains endpoint, bucket, access key, secret key, encryption password, and encryption method. After importing, expand **Configure Connection** in the settings tab and verify the endpoint and bucket name look correct. Run the connection test to confirm.

### Cannot reach the pairing relay

If the default relay is unreachable (rare — it runs on Cloudflare Workers):

1. Check [Cloudflare's status page](https://www.cloudflarestatus.com/) for outages
2. Transfer credentials manually by copying them from one device's settings to the other
3. Alternatively, deploy your own relay instance from [xensenx/Secure-Smart-Sync-relay](https://github.com/xensenx/Secure-Smart-Sync-relay) and enable "Use custom pairing relay" in Settings → Advanced

### I want to use my own relay

Enable Settings → Advanced → Use custom pairing relay and enter your relay URL. Run the relay health test to confirm the URL is reachable before generating a pairing code.

---

## Performance

### Sync is slow on a large vault

For vaults over 5,000 files, the remote walk (listing all objects in R2) is the main bottleneck. Each sync always walks the full remote — this is necessary for the three-way diff to be accurate. Options to reduce sync time:

- **Use Ignore Paths** to exclude large folders that do not need to be synced (e.g., attachment folders with many large images, export directories, `node_modules`)
- **Disable Sync Config Dir** if you do not need `.obsidian` settings to sync
- **Set a Max File Size** to skip large media files

### Every file uploads on every sync

This is a symptom of the ETag fix not being applied to existing prevSync records. Each file sync also stores the remote ETag so the engine can short-circuit on the next run. If records were written before the ETag was being stored, every file appears changed. Reset sync history once — subsequent syncs will be incremental.

### High R2 usage

R2 Class A (write/list) operations are the constrained resource. One remote walk per sync generates `ceil(files / 1000)` LIST operations. For typical vaults and usage patterns this is well within the free tier. See the [R2 Usage & Limits](./docs/Token_usage_scenarios.md) document for a detailed analysis by vault size and device count.

If you are approaching the free tier limit, reduce sync frequency using a longer idle debounce, increase the idle poll interval, or add ignore patterns to reduce the file count walking the remote.

---

## Reading the logs

Enable Debug logging in Settings → Advanced → Log Level. Open the developer console (`Ctrl+Shift+I` on desktop; on mobile use a desktop browser to access the mobile console via USB debugging).

Key log prefixes and what they mean:

| Prefix | Meaning |
|---|---|
| `[SSS] Walking local, prevSync, remote…` | Sync started, three walks in progress |
| `[SSS] Entities: local=N, prev=N, remote=N` | Walk complete — file counts for the diff |
| `[SSS] Tasks: N total, N actionable` | Diff complete — how many operations will run |
| `[SSS] push some/file.md (push_local)` | File being uploaded |
| `[SSS] pull some/file.md (pull_remote)` | File being downloaded |
| `[SSS] State change from device <id>` | Sentinel detected from another device |
| `[SSS] Sentinel has invalid JSON` | Sentinel file is corrupted — will auto-recover |
| `[SSS] Sentinel poll error: <msg>` | R2 unreachable during poll — non-fatal |
| `[SSS] rm: "<key>" already absent, skipping` | File deleted externally before sync reached it — treated as success |
| `[SSS] Retrying <kind> <key> (attempt N)` | Transient failure, retrying with backoff |
| `[SSS] Failed to update prevSync for <key>` | Post-sync record write failed — non-fatal, next sync may re-transfer the file |

---

## Recovery procedures

### Reset sync history

**Use when:** Every file re-uploads on every sync, or the engine is making incorrect decisions about what has changed.

Settings → Danger Zone → Reset Sync History

This clears the local prevSync database. The next sync does a full comparison of local vs. remote and rebuilds the records. No files are deleted from either side.

### Force a full re-download

If local files are corrupt or missing and remote is the source of truth:

1. Reset sync history (above)
2. Delete or move the affected local files out of the vault
3. Trigger a manual sync — the engine will see local=missing, remote=present → pull

### Force a full re-upload

If remote files are corrupt or you want to replace everything on remote with local:

1. Manually delete the contents of your R2 bucket (or the prefix if you use one) via the Cloudflare dashboard
2. Reset sync history
3. Trigger a manual sync — the engine will see local=present, remote=missing → push all files

### Plugin keeps loading old settings after an update

Obsidian caches plugin data. If settings appear stuck after updating SSS, try:

1. Disabling the plugin
2. Closing and reopening Obsidian
3. Re-enabling the plugin

If the issue persists, the settings file may be corrupted. As a last resort, delete `data.json` inside `.obsidian/plugins/Secure-Smart-Sync/` — this resets all settings to defaults and you will need to re-enter your R2 credentials.

---

## Error reference

| Error message | Cause | Fix |
|---|---|---|
| `R2 endpoint or bucket name is not configured` | Credentials not entered | Settings → Devices → Configure Connection |
| `Cannot connect to R2. Check your credentials and endpoint` | Network error, wrong credentials, or wrong endpoint | Work through [Connection failures](#connection-failures) |
| `R2 endpoint, bucket name, and access key are required` | One or more fields blank | Fill all three fields in Configure Connection |
| `Encryption password check failed: wrong_password_or_not_encrypted` | Password does not match what was used to encrypt remote files | Enter the original password, or see [Encryption issues](#encryption-issues) |
| `Encryption password check failed: method_mismatch` | Encryption method changed after files were uploaded | Restore the original method setting |
| `Encryption password check failed: remote_encrypted_no_local_password` | Remote is encrypted but local password is empty | Enter the correct password |
| `walk() must be called before performing operations` | Internal — operation attempted before remote was indexed | Should not occur in normal use; file an issue if you see it |
| `No cached encrypted key for "<key>"` | Encrypted key not found in walk cache | Should not occur in normal use; file an issue with the key path |
| `Already syncing, please wait` | Concurrent sync request while one is in progress | Wait for the current sync to complete |
| `Sync history cleared` | Confirmation after manual reset | Expected — next sync will do a full comparison |

---

If none of the above resolves your issue, collect the following before opening a GitHub issue:

1. Obsidian version and platform (desktop / iOS / Android)
2. SSS plugin version (visible at the top of the Settings tab)
3. The full error message from the console (Log Level: Debug)
4. A description of your vault size and sync configuration (encryption on/off, Smart Sync on/off, number of devices)
