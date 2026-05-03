# Secure-Smart-Sync

<p align="center">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="96" height="96">
    <g fill="#6E56CF">
      <path d="M955 1921.80 c-153.40 -11.80 -301.40 -63.40 -431 -150.40 -78.40 -52.60 -152.20 -121.60 -212.20 -198.40 -93.80 -120.20 -157.60 -273.40 -176.60 -425 -8.20 -64.40 -9.20 -160 -2.40 -221 11.40 -100.60 41 -203 84.80 -292 114.40 -232.20 319 -403.80 563.40 -472.80 108.80 -30.60 220.60 -40.40 335 -29 426.20 42.20 769.60 393.60 802.20 821 3.40 46.80 1.40 148.20 -4 187.80 -18.20 133.20 -54.40 238.40 -120 347 -43.40 72 -99.40 140.80 -158.20 194.60 -152.80 139.80 -341.40 222.80 -541.80 238.40 -30.20 2.20 -108.80 2.20 -139.20 -0.20z m138.40 -326.80 c180.40 -23.80 350.80 -139.60 419.60 -286 23.20 -49 35.20 -104.80 32.20 -148.60 -8.80 -124.60 -94 -237.60 -207.80 -275.40 -51.20 -17 -92.40 -19 -140.20 -6.80 -17.60 4.60 -41.20 13.40 -41.20 15.80 0 0.80 2 3 4.20 5.20 7.60 6.80 39 49.80 49.80 68.20 23.60 39.80 30 53.40 30 64 0 23.60 -5 23.20 -145 -12.80 -60.40 -15.60 -142.80 -36.60 -183 -46.60 -40.20 -10.20 -75.40 -19.60 -78.20 -21.20 -6.60 -3.20 -7.80 -6.40 -7.80 -18.80 0 -12 2.60 -15.40 30.80 -39.60 103.80 -89.80 232.60 -143.80 371.20 -156.40 34 -3 110.40 -2.40 142 1 50.60 5.60 98 15.80 139.60 29.80 11.20 3.80 20.40 6.60 20.40 6 0 -0.40 -4.60 -10 -10.20 -21 -36.40 -72.80 -100.60 -147.40 -168 -195 -91 -64.60 -186.60 -98.80 -297.80 -106.80 -59.20 -4.20 -134.20 5.80 -198 26.40 -136.40 44.20 -249 137.20 -311.80 257.80 -38.40 73.80 -54 156.20 -42.40 224.20 14.80 85.80 59 156.80 128.60 206.60 55.80 40 134 62 195.20 55.20 19.60 -2.20 47.20 -7.40 51 -9.60 0.80 -0.40 -1.60 -4.60 -5.40 -9.20 -14.60 -18 -33.80 -48.80 -47.20 -75.40 -12.60 -25 -14 -29.20 -14 -39.60 0 -6.40 1 -12.60 2.40 -14 6.20 -6.20 25.40 -2.80 137.60 25.60 61 15.40 140.20 35.20 176 44 35.80 8.80 67 17 69.60 18 3.80 1.60 4.40 3.40 4.40 14.60 0 12 -0.40 13 -7.40 19.80 -23 21.80 -73.20 56.20 -111.40 76.60 -76.80 40.60 -159.20 65.40 -242.80 73 -34.80 3.20 -125 1.60 -156.40 -2.80 -36.20 -5.20 -84.20 -16.60 -119 -28.20 -17.60 -6 -32.20 -10.60 -32.40 -10.20 -1.40 1.40 22 39.80 37.20 60.80 94.40 132.20 250.20 219.40 418.20 234.20 26.80 2.40 77.20 1 107.40 -2.80z"/>
    </g>
  </svg>
</p>

<p align="center">
  <strong>Privacy-first Obsidian vault sync via Cloudflare R2 with client-side encryption.</strong><br>
  Your files never leave your device unencrypted. No third-party servers. No subscriptions.
</p>

---

## What it does

Secure-Smart-Sync (SSS) syncs your Obsidian vault to a Cloudflare R2 bucket you own. Every file is encrypted on your device before upload using AES-256, so the storage provider — and anyone who might access your bucket — sees only opaque ciphertext. Sync is bidirectional with a three-way diff engine that handles conflicts, deletions, and renames cleanly.

## Features

- **Client-side AES-256 encryption** — files are encrypted before they leave your device, using OpenSSL-compatible AES-CBC or rclone-compatible Salsa20+Poly1305
- **Cloudflare R2 storage** — S3-compatible, generous free tier, no egress fees
- **Three-way diff sync** — compares local, remote, and last-known state to make correct decisions without unnecessary transfers
- **ETag-anchored change detection** — avoids re-syncing unchanged files on every run
- **Device pairing** — transfer credentials to a new device in seconds using a short one-time code; no retyping long keys
- **Conflict resolution** — keeps a `.conflict` backup of the losing version before overwriting
- **Flexible delete behaviour** — system trash, Obsidian trash, or permanent
- **Automation** — auto-sync on interval, sync on save with debounce, startup delay
- **Ignore patterns** — glob-based path exclusions
- **Status bar** — live sync state indicator

---

## Requirements

- Obsidian 1.0 or later (desktop and mobile)
- A [Cloudflare account](https://dash.cloudflare.com) (free tier is sufficient)
- A Cloudflare R2 bucket with an API token that has read and write access

---

## Setup

### 1. Create an R2 bucket

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**
2. Choose a name (e.g. `my-obsidian-vault`) and a region close to you
3. Note the bucket name — you'll need it in the plugin

### 2. Create an API token

1. In the R2 section, go to **Manage R2 API Tokens** → **Create API token**
2. Set permissions to **Object Read & Write** for your bucket
3. Copy the **Access Key ID**, **Secret Access Key**, and your **account endpoint URL**
   - The endpoint looks like: `https://<account-id>.r2.cloudflarestorage.com`

### 3. Install the plugin

**From Obsidian Community Plugins** *(once listed)*:
Settings → Community plugins → Browse → search "Secure-Smart-Sync" → Install → Enable

**Manual install**:
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/xensenx/Secure-Smart-Sync/releases)
2. Copy them to `<your-vault>/.obsidian/plugins/Secure-Smart-Sync/`
3. Enable the plugin in Settings → Community plugins

### 4. Configure the plugin

Open **Settings → Secure-Smart-Sync** and fill in:

| Field | Value |
|---|---|
| Endpoint | `https://<account-id>.r2.cloudflarestorage.com` |
| Bucket | Your bucket name |
| Access Key ID | From your R2 API token |
| Secret Access Key | From your R2 API token |
| Remote Prefix | Optional — e.g. `my-vault/` if you share the bucket across vaults |
| Encryption Password | Choose a strong password — **do not lose this** |

Hit **Test Connection** to confirm everything works, then click the sync icon in the ribbon or run **Sync now** from the command palette.

---

## Encryption

SSS offers two encryption methods, both applied fully client-side before any data is uploaded:

**OpenSSL AES-CBC** (`openssl-base64`, default)
File contents are encrypted with AES-256-CBC. File names are also encrypted and encoded as base64url with an `U2FsdGVkX` prefix. Folder names are stored as plaintext key prefixes on R2 (S3 has no real folders — this is by design and does not leak note contents).

**rclone Salsa20** (`rclone-base64`)
Uses Salsa20+Poly1305, compatible with rclone's crypt remote. Both file contents and file names are encrypted and obfuscated. Runs in a web worker to avoid blocking the UI.

**Important:** if you change or lose your encryption password, your remote files become permanently unreadable. Store your password somewhere safe.

---

## Pairing a New Device

Instead of retyping all your credentials on a second device:

1. On the configured device: Settings → **Pair Devices** → **Generate Code**
2. A short code appears (valid for 10 minutes)
3. On the new device: Settings → **Pair Devices** → enter the code → **Import Code**

All credentials are imported automatically. This uses an end-to-end encrypted relay — the pairing server only ever sees an AES-GCM encrypted blob and never your plaintext credentials. The relay code is open source at [github.com/xensenx/sss-relay](https://github.com/xensenx/sss-relay). If you prefer to self-host the relay, see Advanced settings.

---

## Sync Behaviour

SSS uses a **three-way diff**: it compares the current local state, the current remote state, and a stored snapshot of the last-known state (prevSync) to decide what to do with each file.

| Situation | Decision |
|---|---|
| File only on local, no prevSync | Upload to remote |
| File only on remote, no prevSync | Download to local |
| File changed locally since last sync | Upload |
| File changed remotely since last sync | Download |
| File changed on both sides | Conflict resolution applies |
| File deleted locally, existed in prevSync | Delete from remote |
| File deleted remotely, existed in prevSync | Delete from local |

**Conflict resolution** saves a `.conflict-YYYY-MM-DD` backup of the losing version before overwriting, so nothing is silently lost.

Change detection uses **ETags first** (S3 content hashes, definitive), falling back to plaintext size and then modification time with a 1-second tolerance.

---

## Settings Reference

### Cloudflare R2
| Setting | Description |
|---|---|
| Endpoint | Your R2 account endpoint URL |
| Bucket | R2 bucket name |
| Access Key ID | R2 API token key |
| Secret Access Key | R2 API token secret |
| Remote Prefix | Optional sub-folder path inside the bucket |

### Encryption
| Setting | Description |
|---|---|
| Password | Master encryption password. Empty = no encryption |
| Method | `OpenSSL AES-CBC` or `rclone Salsa20` |

### Sync
| Setting | Description |
|---|---|
| Direction | Bidirectional / Push only / Pull only |
| Conflict Resolution | Keep newer / larger / local / remote |
| Delete Behaviour | System trash / Obsidian trash / Permanent |
| Skip Files Larger Than | File size limit in MB. 0 = no limit |
| Ignore Paths | Glob patterns to exclude (one per line) |

### Automation
| Setting | Description |
|---|---|
| Auto-Sync Interval | Sync every N minutes. 0 = disabled |
| Sync on Save Debounce | Sync N seconds after file save. 0 = disabled |

### Advanced
| Setting | Description |
|---|---|
| Use custom pairing relay | Enable to use your own self-hosted sss-relay |
| Custom Relay URL | URL of your self-hosted relay Worker |
| Log Level | Error / Warn / Info / Debug |
| Sync .obsidian Config Directory | Include Obsidian config files in sync |
| Show Status Bar | Toggle the sync status indicator |

---

## Commands

| Command | Description |
|---|---|
| `SSS: Sync now` | Run a full sync immediately |
| `SSS: Dry run` | Show what would change without making any changes |
| `SSS: Reset sync history` | Clears prevSync records — next sync does a full comparison |

---

## Privacy

- All encryption happens on your device. No plaintext ever reaches R2 or any server.
- The pairing relay receives only an AES-GCM encrypted blob. The decryption PIN never leaves your devices.
- Pairing blobs are deleted immediately on first retrieval and auto-expire after 10 minutes regardless.
- No analytics, no telemetry, no account required.

---

## Building from Source

```bash
git clone https://github.com/xensenx/Secure-Smart-Sync
cd Secure-Smart-Sync
npm install
npm run build   # production build → main.js
npm run dev     # watch mode
```

Requires Node.js 18+. Uses esbuild (not webpack). Output is a single `main.js`.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Author

Made by [Sen](https://github.com/xensenx).
