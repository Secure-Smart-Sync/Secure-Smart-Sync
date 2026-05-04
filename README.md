# Secure-Smart-Sync

<div align="center">
  <picture>
    <!-- Displayed when GitHub is in Light (White) Mode -->
    <source media="(prefers-color-scheme: light)" srcset="assets/icon_black_transparent.svg">
    <!-- Displayed when GitHub is in Dark Mode -->
    <source media="(prefers-color-scheme: dark)" srcset="assets/icon_white_transparent.svg">
    <!-- Fallback image -->
    <img src="assets/icon_white_transparent.svg" width="200" alt="icon">
  </picture>
</div>

<p align="center">
  <strong>Privacy-first Obsidian vault sync via Cloudflare R2 with client-side encryption.</strong><br>
  Your files never leave your device unencrypted. No third-party servers. No subscriptions.
</p>
<div align="center">
**NOTE**: This is not the official Sync from [Obsidian Sync](https://obsidian.md/sync)
</div>

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


## Requirements

- Obsidian 1.0 or later (desktop and mobile)
- A [Cloudflare account](https://dash.cloudflare.com) (free tier is sufficient)
- A Cloudflare R2 bucket with an API token that has read and write access


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


## Encryption

SSS offers two encryption methods, both applied fully client-side before any data is uploaded:

**OpenSSL AES-CBC** (`openssl-base64`, default)
File contents are encrypted with AES-256-CBC. File names are also encrypted and encoded as base64url with an `U2FsdGVkX` prefix. Folder names are stored as plaintext key prefixes on R2 (S3 has no real folders — this is by design and does not leak note contents).

**rclone Salsa20** (`rclone-base64`)
Uses Salsa20+Poly1305, compatible with rclone's crypt remote. Both file contents and file names are encrypted and obfuscated. Runs in a web worker to avoid blocking the UI.

**Important:** if you change or lose your encryption password, your remote files become permanently unreadable. Store your password somewhere safe.


## Pairing a New Device

Instead of retyping all your credentials on a second device:

1. On the configured device: Settings → **Pair Devices** → **Generate Code**
2. A short code appears (valid for 10 minutes)
3. On the new device: Settings → **Pair Devices** → enter the code → **Import Code**

All credentials are imported automatically. This uses an end-to-end encrypted relay — the pairing server only ever sees an AES-GCM encrypted blob and never your plaintext credentials. The relay code is open source at [github.com/xensenx/sss-relay](https://github.com/xensenx/sss-relay). If you prefer to self-host the relay, see Advanced settings.


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


## Commands

| Command | Description |
|---|---|
| `SSS: Sync now` | Run a full sync immediately |
| `SSS: Dry run` | Show what would change without making any changes |
| `SSS: Reset sync history` | Clears prevSync records — next sync does a full comparison |


## Privacy

- All encryption happens on your device. No plaintext ever reaches R2 or any server.
- The pairing relay receives only an AES-GCM encrypted blob. The decryption PIN never leaves your devices.
- Pairing blobs are deleted immediately on first retrieval and auto-expire after 10 minutes regardless.
- No analytics, no telemetry, no account required.


## Credits & Acknowledgements

[Remotely Save](https://github.com/remotely-save/remotely-save) played an important role in the early foundation of Secure-Smart-Sync.

During the earliest prototyping phase, its S3-compatible storage implementation and a few reference files helped me better understand how sync systems interact with object storage and accelerated early experimentation.

Over time, Secure-Smart-Sync was heavily rewritten and evolved into its own independent architecture. Most of the original reference code was eventually replaced as the project moved toward a very different design focused on:

- client-side encryption  
- three-way diff synchronization  
- encrypted device pairing relay  
- conflict handling  
- privacy-first infrastructure design  

The primary value of Remotely Save was helping me learn faster during the early stages of development and better understand the problem space.

code from Remotely Save’s `/pro` directory was **NOT** used.

Remotely Save’s open-source components are licensed under the Apache License 2.0. Their original repository and full licensing details can be found in their project repository.

This project would have taken significantly longer to prototype without their earlier open-source work, and they deserve proper credit for that contribution.


## License & Branding

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

> [!IMPORTANT]
> **Trademark & Branding Notice**
>
> The **Secure-Smart-Sync** name, logo, and associated branding assets are copyright © **Sen** and are **not** covered by the MIT License. 
>
> While you are free to use, modify, and distribute the software code under the terms of the MIT License, this does not grant permission to use the project's name, logo, or trademarks in a way that suggests endorsement or original authorship. All rights regarding the visual identity and naming of this project are reserved.

