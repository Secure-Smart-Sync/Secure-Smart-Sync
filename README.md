<div align="center">

<picture>
  <source
    media="(prefers-color-scheme: light)"
    srcset="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/icon_black_transparent.svg">

  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/icon_white_transparent.svg">

  <img
    src="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/icon_white_transparent.svg"
    width="150"
    alt="Secure Smart Sync">
</picture>

</div>

**Not affiliated with [Obsidian Sync](https://obsidian.md/sync).** SSS runs entirely on your own Cloudflare R2 bucket. You own the storage, the keys, and the data.

Read the **[Usage Guidelines](./Usage_Guidelines.md)** before setup. The **[official site](https://secure-smart-sync.pages.dev/)** has a visual walkthrough that takes under five minutes.

## Overview

<p align="center">
  <img
    src="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Banners/sss_banner_adjusted_Color.png"
    alt="Secure Smart Sync Banner"
    width="100%">
</p>

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

The **Secure-Smart-Sync** name, logos, icons, embedded SVG branding elements, and overall visual identity remain the intellectual property of &copy; Sen and are not covered under the MIT License.

These branding elements are included in the source code solely for functional product use. Public forks, redistributions, or derivative projects must remove or replace original branding unless explicit permission is granted.

see — [LICENSE_BRANDING](./LICENSE_BRANDING.md) 

## Support

<div align="center">

<a href="https://ko-fi.com/xensenx" target="_blank">

<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/Ko-fi_white.svg">

  <source
    media="(prefers-color-scheme: light)"
    srcset="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/Ko-fi_black.svg">

  <img
    src="https://cdn.jsdelivr.net/gh/Secure-Smart-Sync/Secure-Smart-Sync-assets/Icons/SVG/Ko-fi_white.svg"
    width="120"
    alt="Support on Ko-fi">
</picture>

</a>

<strong>If the plugin has helped you and saved your time, consider supporting the developer</strong>

</div>
