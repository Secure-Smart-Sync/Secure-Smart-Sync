# Core Architecture

Secure Smart Sync was designed as a layered system rather than a simple file uploader.

Each layer exists to solve a specific problem in secure, long-term, cross-device synchronization.

---

## 1. Virtual File System Layer (VFS Abstraction)

The plugin operates on Obsidian's Virtual File System (VFS) abstraction layer.

This is an important architectural decision because it allows the sync engine to remain completely unaware of where data physically lives.

The sync engine only interacts with abstract providers.

### Local Provider

Handles interactions with the local Obsidian vault.

Responsibilities include:

- reading files
- writing files
- detecting local changes
- interacting with vault metadata

### Remote Provider

Handles interactions with cloud storage.

Secure Smart Sync uses a custom implementation built on top of the AWS S3 SDK, specifically tailored for Cloudflare R2.

This layer also uses a custom `FetchHttpHandler` that wraps Obsidian's `requestUrl()`.

This completely bypasses traditional browser CORS limitations while maintaining compatibility inside Obsidian.

This abstraction makes the system portable and ensures the sync engine does not need to be rewritten if storage providers change in the future.

---

## 2. Three-Way Sync Engine

This is the core brain of the plugin.

The sync engine does not make blind assumptions.

Every sync decision is made by comparing three independent states:

- Local state
- Remote state
- Previous sync state

The remote layer also stores:

- ETags
- metadata

These additional validation layers help prevent accidental overwrites and incorrect sync behavior.

Every sync operation is based on deterministic comparisons.

This significantly reduces the chances of accidental:

- overwrites
- missed changes
- deletion mistakes
- conflict-related data loss

The architecture intentionally avoids "oops" sync behavior.

---

## 3. Cryptographic Pipeline

Encryption is handled through a dedicated cryptographic pipeline.

Heavy cryptographic operations are offloaded to Web Workers.

This ensures Obsidian does not freeze when processing large files.

### File Encryption

Uses AES-256-CBC encryption.

### Filename Encryption

Uses Rclone's Salsa20 + Poly1305 implementation.

This ensures that both:

- file contents
- file names

remain encrypted.

The remote storage provider remains completely blind to user data.

Even metadata exposure is minimized.

---

## 4. Device Coordination Layer (Smart Sync)

Cloudflare R2 is intentionally treated as dumb object storage.

It does not provide native device coordination.

This layer exists to solve that limitation.

A lightweight state file stored on R2 acts as a sentinel.

This enables devices to detect when another device has performed meaningful sync activity.

The plugin uses a dynamic polling mechanism that allows fine-grained control over behavior.

Examples include:

- active polling intervals
- idle polling intervals
- standby polling intervals
- post-sync polling behavior

Most timing controls are intentionally exposed to users.

This increases configuration complexity slightly, but gives power users more control over behavior.

Despite the name "Smart Sync," the system remains event-driven.

Nothing is truly automatic.

Everything happens as a response to meaningful user activity or state transitions.

This keeps behavior predictable.

---

## 5. Encrypted Relay System

One major UX problem in early versions was credential onboarding across devices.

Manually copying long API credentials to mobile devices created unnecessary friction.

To solve this, Secure Smart Sync introduced an encrypted relay system.

This system uses Cloudflare Workers KV to temporarily transmit credentials securely between devices.

Key properties:

- encrypted transmission
- temporary storage
- automatic expiration

Relay credentials automatically self-destruct after approximately 10 minutes.

This significantly improves onboarding while maintaining privacy.

---

## Architectural Philosophy

These systems work together to solve five major problems:

- storage abstraction
- sync reliability
- encryption performance
- multi-device coordination
- onboarding friction

The architecture intentionally prioritizes long-term reliability over shortcut-based convenience.

Each layer exists because a simpler implementation created real limitations during development.