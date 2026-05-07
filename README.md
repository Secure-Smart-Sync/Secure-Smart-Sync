# Secure-Smart-Sync

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="assets/icon_black_transparent.svg">
    <source media="(prefers-color-scheme: dark)" srcset="assets/icon_white_transparent.svg">
    <img src="assets/icon_white_transparent.svg" width="200" alt="icon">
  </picture>
</div>

<p align="center">
  <strong>Privacy-first Obsidian vault sync via Cloudflare R2 with client-side encryption.</strong><br>
  Your files never leave your device unencrypted. No third-party servers. No subscriptions.
</p>
<p align="center">
  <b>NOTE</b>: This is not the official Sync from 
  <a href="https://obsidian.md/sync">Obsidian Sync</a>
</p>

<picture><source media="(prefers-color-scheme: dark)" srcset="./assets/alert_white.svg"><source media="(prefers-color-scheme: light)" srcset="./assets/alert_white.svg"><img alt="Alert" src="./assets/alert_white.svg" width="16" height="16" align="center"></picture> **IMPORTANT:** Read the [Usage Guidelines](./Usage_Guidelines.md) before setup for optimal results.
<br>

---

**Visit our official site:** **[secure-smart-sync](https://secure-smart-sync.pages.dev/)**

---

## Overview

Secure-Smart-Sync (SSS) is a local-first synchronization engine designed to securely mirror your Obsidian vault across multiple devices using your own Cloudflare R2 storage. 

Unlike traditional cloud providers, SSS encrypts every single file directly on your device *before* it is uploaded. The storage provider — and anyone who might access your bucket — sees only opaque ciphertext. Paired with a robust three-way differential sync engine and automated state-awareness, SSS delivers a seamless, native-feeling sync experience without compromising your privacy.

## Core Mechanics

### 1. Client-Side Encryption (Zero-Knowledge)
Security is handled entirely on your local machine. You can choose between two robust encryption standards:
* **OpenSSL AES-CBC (`openssl-base64`):** File contents are encrypted with AES-256-CBC, and file names are obfuscated using base64url encoding. 
* **rclone Salsa20 (`rclone-base64`):** Compatible with rclone's crypt remote, utilizing Salsa20+Poly1305. 

Because passwords never leave your device, your remote data is mathematically inaccessible to anyone without your local decryption key.

### 2. The Three-Way Sync Engine
To prevent data loss and unnecessary network requests, SSS relies on a highly optimized differential engine. It compares your **local state**, the **remote state**, and a **snapshot of the last known sync** to make intelligent decisions. 
* **ETag-Anchored Detection:** It checks S3 content hashes (ETags) before falling back to file sizes and modification times, ensuring unchanged files are never pointlessly re-uploaded.
* **Conflict Resolution:** If a file is edited simultaneously on two devices, SSS gracefully resolves the conflict based on your rules (e.g., "Keep newer") while automatically generating a `.conflict` backup of the overwritten version.

### 3. Smart Sync Automation
Built to be a "set-and-forget" solution, Smart Sync watches your writing activity. When you stop typing for a set number of seconds, it silently pushes your changes to the cloud.
* **Cross-Device Awareness:** When Device A finishes an automated sync, it pushes a tiny state change to the cloud. If Device B is currently open, it immediately detects this change and pulls the updates automatically within seconds, keeping your active screens perfectly matched.

### 4. Frictionless Device Pairing
Typing long API keys, bucket names, and encryption passwords on a mobile phone is frustrating. SSS solves this with a secure, ephemeral relay system. 
* Click "Generate Code" on your desktop to bundle your credentials into an **AES-GCM encrypted payload** and send it to our open-source Cloudflare Worker.
* Enter the short code on your phone to instantly pull and decrypt the configuration. The decryption PIN never leaves your devices, and the payload self-destructs after 10 minutes.

## Getting Started

Because Secure-Smart-Sync utilizes your own private infrastructure, the initial setup requires generating API keys and configuring your Cloudflare bucket. 

We have prepared a comprehensive, step-by-step guide to walk you through the process in under 5 minutes. 

1. **[Read the Setup & Usage Guidelines](./Usage_Guidelines.md)**
2. **[View exact API token usage & limits](./docs/Token_usage_scenarios.md)**

## Security

Security and privacy are the foundational pillars of this plugin. We do not run any analytics, telemetry, or tracking code. Your encryption keys never leave your devices, and the ephemeral device-pairing relay utilizes end-to-end AES-GCM encryption.

For a deep dive into the cryptographic methods, architecture, and threat models, please read our **[Security Documentation](./SECURITY.md)**.

## Contributions & Support

If you find this plugin helpful in keeping your vault secure, there are a few ways you can support the development:

1. **Star the repository** on GitHub to help others find it.
2. **Open an issue** if you spot a bug or have a feature request.
3. **Consider sending a coffee my way** to help fuel late-night coding sessions!

<p>
  <a href="https://ko-fi.com/xensenx">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" />
  </a>
</p>

For more details on how to contribute code, submit pull requests, or help with documentation, please see **[CONTRIBUTING](./CONTRIBUTING.md)**.

## Credits & Acknowledgements

[Remotely Save](https://github.com/remotely-save/remotely-save) played an important role in the early foundation of Secure-Smart-Sync.

During the earliest prototyping phase, its S3-compatible storage implementation and a few reference files helped me better understand how sync systems interact with object storage and accelerated early experimentation.

Over time, Secure-Smart-Sync was heavily rewritten and evolved into its own independent architecture. Most of the original reference code was eventually replaced as the project moved toward a very different design focused on client-side encryption, three-way diff synchronization, encrypted device pairing, and privacy-first infrastructure.

The primary value of Remotely Save was helping me learn faster during the early stages of development. Code from Remotely Save’s `/pro` directory was **NOT** used.

Remotely Save’s open-source components are licensed under the Apache License 2.0. Their original repository and full licensing details can be found in their project repository. This project would have taken significantly longer to prototype without their earlier open-source work, and they deserve proper credit for that contribution.

## License & Branding



This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.



> [!IMPORTANT]
> **Trademark & Branding Notice**
> The **Secure-Smart-Sync** name, logo, and associated branding assets are copyright © **Sen** and are **not** covered by the MIT License. 
> While you are free to use, modify, and distribute the software code under the terms of the MIT License, this does not grant permission to use the project's name, logo, or trademarks in a way that suggests endorsement or original authorship. All rights regarding the visual identity and naming of this project are reserved.
