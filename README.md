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

<div align="center">
  <h1>Secure Smart Sync</h1>
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

<table width="100%">
<tr>
<td width="50%" valign="top" align="left" style="padding: 20px;">

<h3>Zero-Knowledge Encryption</h3>

Every file is encrypted on your device before it is uploaded.

Choose between:
- AES-256-CBC (OpenSSL)
- Salsa20 + Poly1305 (rclone-compatible)

Your password never leaves your device — storage providers only see ciphertext.

</td>

<td width="50%" valign="top" align="left" style="padding: 20px;">

<h3>Three-Way Diff Engine</h3>

Compares:

- Local state  
- Remote state  
- Last sync snapshot  

ETags prevent unnecessary uploads.  
Conflicts follow your rules and are backed up automatically.

</td>
</tr>

<tr>
<td width="50%" valign="top" align="left" style="padding: 20px;">

<h3>Smart Sync</h3>

A few seconds after you stop typing:

- Device A syncs silently  
- Signals Device B  
- Device B pulls changes automatically  

No manual triggering.  
No intrusive popups.

</td>

<td width="50%" valign="top" align="left" style="padding: 20px;">

<h3>Instant Device Pairing</h3>

Generate a short pairing code on one device.

Enter it on another device to securely transfer:

- R2 credentials  
- Encryption configuration  

Transferred through AES-GCM encrypted relay.  
Self-destructs after 10 minutes.

</td>
</tr>
</table>

<br>



## Get started


<coming soon>



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
