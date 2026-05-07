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

<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>

<br>

**Zero-Knowledge Encryption**

<sub>Every file is encrypted on your device before it is uploaded. You choose between AES-256-CBC (OpenSSL) or Salsa20+Poly1305 (rclone-compatible). Your password never leaves your device — the storage provider sees only ciphertext.</sub>

</td>
<td width="50%" valign="top" align="center">

<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="18" cy="18" r="3"/>
  <circle cx="6"  cy="6"  r="3"/>
  <circle cx="6"  cy="18" r="3"/>
  <path d="M18 15V9a6 6 0 0 0-6-6H9"/>
  <path d="M9 21h3a6 6 0 0 0 6-6"/>
</svg>

<br>

**Three-Way Diff Engine**

<sub>Compares your local state, the remote state, and the last known sync snapshot. ETags anchor change detection so unchanged files are never re-uploaded. Conflicts are resolved by your rules and backed up automatically.</sub>

</td>
</tr>
<tr>
<td width="50%" valign="top" align="center">

<br>

<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
</svg>

<br>

**Smart Sync**

<sub>A few seconds after you stop typing, your vault syncs silently in the background. When Device A finishes, it signals Device B, which pulls the changes within seconds. No manual triggering. No distracting pop-ups.</sub>

</td>
<td width="50%" valign="top" align="center">

<br>

<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
</svg>

<br>

**Instant Device Pairing**

<sub>Generate a short pairing code on one device. Enter it on another. Your R2 credentials and encryption settings transfer over an AES-GCM encrypted relay and self-destruct after ten minutes. No typing API keys on mobile.</sub>

</td>
</tr>
</table>

<br>



## Get started

**1. Create your R2 bucket**

Log in to Cloudflare, create an R2 bucket, and generate an API token with read and write permissions. The [visual setup guide](https://secure-smart-sync.pages.dev/) walks through every step.

**2. Install the plugin**

Install Secure-Smart-Sync from the Obsidian Community Plugins browser, or download the [latest release](https://github.com/xensenx/Secure-Smart-Sync/releases) and copy it to your vault's `.obsidian/plugins/` folder.

**3. Configure and sync**

Open the SSS settings tab, expand **Configure Connection**, enter your R2 endpoint and credentials, and run a connection test. Enable **Smart Sync** and you are done. Pair additional devices in under thirty seconds using the built-in pairing code.



## Documentation

| | |
|---|---|
| [Usage Guidelines](./Usage_Guidelines.md) | Initial setup, configuration reference, and day-to-day usage |
| [Security](./SECURITY.md) | Cryptographic methods, architecture, and threat model |
| [R2 Usage & Limits](./docs/token_usage_scenarios.md) | Free-tier op analysis across vault sizes and device counts |
| [Contributing](./CONTRIBUTING.md) | Bug reports, pull requests, and documentation |



## Security

SSS ships with no analytics, telemetry, or tracking. Encryption keys are generated and stored locally and are never transmitted. The ephemeral pairing relay is open-source, uses AES-GCM end-to-end encryption, and stores nothing after the payload is consumed.

Full cryptographic detail is in [SECURITY.md](./SECURITY.md).

The relay source is at [xensenx/Secure-Smart-Sync-relay](https://github.com/xensenx/Secure-Smart-Sync-relay). You can self-host it if you prefer not to use the default instance.



## Credits

[Remotely Save](https://github.com/remotely-save/remotely-save) provided an early reference for S3-compatible storage that helped accelerate the initial prototyping phase. SSS has since been independently rewritten into a different architecture. The portions of Remotely Save that informed this project are licensed under Apache 2.0.


## License

Code is released under the **MIT License** — see [LICENSE](./LICENSE).

The **Secure-Smart-Sync** name, logo, and branding are copyright &copy; Sen and are not covered by the MIT License. The code is free to use and modify; the visual identity and project name are not available for redistribution or rebranding.

## Support

<div align="center">
<a href="https://ko-fi.com/xensenx" style="display: inline-block; vertical-align: middle;">
  <picture>
    <!-- If the theme is dark, use the white logo -->
    <source srcset="assets/Ko-fi_white.svg" media="(prefers-color-scheme: dark)">
    <!-- Default/Light theme uses the black logo -->
    <img src="assets/Ko-fi_black.svg" alt="Support me on Ko-fi" width="120">
  </picture>
</a>

<strong>If the plugin has helped you and saved your time, consider supporting the developer</strong>

</div>
