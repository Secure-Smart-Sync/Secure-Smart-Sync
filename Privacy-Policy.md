# Privacy Policy for Secure-Smart-Sync (SSS)

**Effective Date:** May 6, 2026

Secure-Smart-Sync ("SSS", "the Plugin") is an open-source plugin for Obsidian designed to synchronize your local vault to Cloudflare R2 object storage. 

This Privacy Policy outlines how the Plugin handles your data. The core philosophy of SSS is **local-first and zero-knowledge**. We do not collect, monetize, or have access to your personal information, vault contents, or credentials.

## 1. Data Collection and Storage

**Local Storage**
All configuration settings—including your Cloudflare R2 endpoint, bucket name, access keys, and encryption passwords—are stored entirely locally on your device within your Obsidian `.obsidian` directory. SSS also maintains a local IndexedDB database to track sync history and file states (ETags, modification times) to optimize differential syncing. None of this local data is ever transmitted to the Plugin developer.

**Cloud Storage (Cloudflare R2)**
SSS synchronizes your files directly between your device and your personal Cloudflare R2 bucket. The Plugin acts solely as a client interface communicating with the Cloudflare API. We do not intermediate this connection, nor do we have access to your bucket or its contents.

## 2. Encryption and Security

**Client-Side Encryption**
If you choose to enable encryption in the Plugin settings, your files are encrypted locally on your device *before* being uploaded to Cloudflare R2. 
* Depending on your configuration, SSS uses either OpenSSL-compatible AES-CBC or rclone-compatible Salsa20+Poly1305 encryption. 
* Passwords never leave your device, meaning your remote data is completely inaccessible to anyone (including Cloudflare and the Plugin developer) without the local decryption key.

## 3. Device Pairing Relay (`sss-relay`)

To facilitate easy setup across multiple devices, SSS includes a "Pair Devices" feature. By default, this uses a developer-hosted Cloudflare Worker relay.

* **End-to-End Encryption:** The credential bundle generated during pairing is encrypted locally using AES-GCM with a key derived from a randomly generated 6-character PIN. 
* **Zero-Knowledge Transport:** The relay server only receives a heavily encrypted, base64-encoded blob. The PIN required to decrypt it is never sent to the server.
* **Ephemeral Storage:** Encrypted payloads stored on the relay automatically expire and are permanently deleted after 10 minutes. 
* **Self-Hosting:** Users have the option to bypass the default relay entirely and route this encrypted handshake through their own custom relay URL.

## 4. Analytics and Telemetry

SSS contains absolutely **no analytics, tracking, or telemetry code**. We do not track how you use the Plugin, how many files you sync, your IP address, or any crash reports. 

## 5. Third-Party Services

The Plugin interacts with the following third-party services based on your configuration:
* **Cloudflare R2:** For your remote object storage. Data handling here is governed by Cloudflare's Privacy Policy.
* **sss-relay:** For the ephemeral device pairing handshake (unless self-hosted).

## 6. Changes to this Policy

As SSS is an open-source project, any changes to data handling practices will be visible in the public commit history. If significant architectural changes are made that affect privacy, this policy will be updated accordingly.

## 7. Contact

If you have any questions or concerns regarding this Privacy Policy or the security architecture of Secure-Smart-Sync, please open an issue on the project's GitHub repository.
