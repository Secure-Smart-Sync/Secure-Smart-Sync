<div align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="assets/icon_black_transparent.svg">
    <source media="(prefers-color-scheme: dark)"  srcset="assets/icon_white_transparent.svg">
    <img src="assets/icon_white_transparent.svg" width="150" alt="Secure-Smart-Sync">
  </picture>

  <h2>Secure-Smart-Sync</h2>

  <p>Privacy-first Obsidian vault sync via Cloudflare R2 with client-side encryption.<br>
  Your files never leave your device unencrypted. No third-party servers. No subscriptions.</p>

  <p>
    <a href="https://secure-smart-sync.pages.dev/">Website</a>
    &nbsp;&middot;&nbsp;
    <a href="./Usage_Guidelines.md">Setup guide</a>
    &nbsp;&middot;&nbsp;
    <a href="./SECURITY.md">Security</a>
    &nbsp;&middot;&nbsp;
    <a href="https://ko-fi.com/xensenx">Support the project</a>
  </p>

</div>

**Not affiliated with [Obsidian Sync](https://obsidian.md/sync).** SSS runs entirely on your own Cloudflare R2 bucket. You own the storage, the keys, and the data.

Read the **[Usage Guidelines](./Usage_Guidelines.md)** before setup. The **[official site](https://secure-smart-sync.pages.dev/)** has a visual walkthrough that takes under five minutes.


## How it works

<br>

<table>
<tr>
<td width="50%" valign="top" align="center">

**Zero-Knowledge Encryption**

<sub>Every file is encrypted on your device before it is uploaded. You choose between AES-256-CBC (OpenSSL) or Salsa20+Poly1305 (rclone-compatible). Your password never leaves your device — the storage provider sees only ciphertext.</sub>

</td>

<td width="50%" valign="top" align="center">

**Three-Way Diff Engine**

<sub>Compares your local state, the remote state, and the last known sync snapshot. ETags anchor change detection so unchanged files are never re-uploaded. Conflicts are resolved by your rules and backed up automatically.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top" align="center">

**Smart Sync**

<sub>A few seconds after you stop typing, your vault syncs silently in the background. When Device A finishes, it signals Device B, which pulls the changes within seconds. No manual triggering. No distracting pop-ups.</sub>

</td>
<td width="50%" valign="top" align="center">

**Instant Device Pairing**

<sub>Generate a short pairing code on one device. Enter it on another. Your R2 credentials and encryption settings transfer over an AES-GCM encrypted relay and self-destruct after ten minutes. No typing API keys on mobile.</sub>

</td>
</tr>
</table>

<br>

## Get started

**1. Create your R2 bucket**

Log in to Cloudflare, create an R2 bucket, and generate an API token with read and write permissions. The visual setup guide walks through every step.

**2. Install the plugin**

Install Secure-Smart-Sync from the Obsidian Community Plugins browser, or download the latest release.

**3. Configure and sync**

Open the SSS settings tab, configure connection, test it, and enable Smart Sync.

## Documentation

| | |
|---|---|
| [Usage Guidelines](./Usage_Guidelines.md) | Initial setup, configuration reference, and day-to-day usage |
| [Security](./SECURITY.md) | Cryptographic methods, architecture, and threat model |
| [R2 Usage & Limits](./docs/token_usage_scenarios.md) | Free-tier op analysis across vault sizes and device counts |
| [Contributing](./CONTRIBUTING.md) | Bug reports, pull requests, and documentation |

## Security

SSS ships with no analytics, telemetry, or tracking. Encryption keys are generated and stored locally and are never transmitted.

## Credits

Remotely Save provided an early reference for S3-compatible storage that helped accelerate initial prototyping.

## License

Code is released under the MIT License.

The Secure-Smart-Sync name, logo, and branding are not covered by the MIT License.

## Support

If the plugin has been useful to you, consider supporting further development.
