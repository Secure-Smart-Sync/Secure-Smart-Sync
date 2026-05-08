# Why Relay Pairing Uses Cloudflare Workers + KV

## Initial Approach: QR Based Pairing

The original plan was to make device pairing even simpler through QR codes.

The intended flow was:

1. Existing device generates encrypted pairing payload
2. Payload gets converted into a QR code
3. New device scans the QR code
4. Pairing completes instantly

On paper, this looked like the cleanest solution.

However, after extensive experimentation, this approach repeatedly failed due to platform limitations.

Obsidian does not expose reliable camera permissions to plugins.

Attempts were made to:

- directly access native camera functionality
- route scanning through browser-based camera access
- build encrypted QR transfer flows

None of these approaches worked reliably across platforms.

Some methods failed entirely due to permission restrictions.
Others introduced inconsistent behavior.
Some created unnecessary security concerns by relying on browser redirects and external scanning flows.

The final fallback option was:

- show QR code inside Obsidian
- ask users to scan it externally
- manually copy the generated pairing code
- paste it back into plugin settings

While technically functional, this still introduced too many steps.

For onboarding, even one unnecessary extra step creates friction.

That approach was ultimately rejected.

---

## Context

One of the biggest UX problems in encrypted sync systems is onboarding a new device.

A user may already have Secure Smart Sync configured on one device with:

- encryption keys
- bucket credentials
- sync configuration
- storage preferences

When they install the plugin on a second device, asking them to manually re-enter all of that information creates unnecessary friction.

This becomes even worse on mobile devices where typing long credentials manually is frustrating.

---

## The Problem

Without a relay mechanism, users would need to:

- manually copy access keys
- manually transfer encryption keys
- reconfigure storage settings
- repeat setup steps on every new device

That creates a poor onboarding experience and increases the likelihood of user mistakes.

For a sync product, device pairing should feel fast and simple.

---

## Solution: Temporary Relay Pairing

Secure Smart Sync uses **Cloudflare Workers + Cloudflare KV** as a temporary relay layer during device pairing.

The flow works like this:

1. Existing device encrypts pairing credentials
2. Encrypted payload is sent to the relay service
3. Payload is temporarily stored in Cloudflare KV
4. New device retrieves the encrypted payload
5. Credentials are decrypted locally on the receiving device
6. Pairing completes without manual credential entry

The relay does not function as permanent storage.

Its only job is to temporarily transfer encrypted configuration data between devices.

---

## Why Cloudflare Workers + KV?

### Fast global distribution

Cloudflare's network reduces latency for users across different regions.

### Extremely lightweight

Pairing payloads are small and temporary.

Workers + KV are sufficient without introducing unnecessary infrastructure complexity.

### Cost efficiency

This architecture keeps operational costs low while handling onboarding requests.

### Simple maintenance

The relay service remains intentionally minimal and isolated from the main sync architecture.

---

## Open Source Relay

The relay service is fully separate from the main plugin.

It is open source in a separate repository:

`Secure-Smart-Sync-relay`

Users can inspect the implementation themselves if they want full transparency into how pairing works.

---

## Custom Relay Support

Users are not required to use the default relay.

If someone prefers complete control over the pairing layer, they can host their own relay instance.

Inside plugin settings:

1. Enable the **Custom Relay Pairing** toggle
2. Enter their own relay URL
3. Use their personal relay instance for device pairing

This allows privacy-conscious users to fully control their pairing infrastructure.

---

## Final Decision

This was primarily a **UX decision**.

The QR approach failed because platform constraints made it unreliable.

The relay system became the cleanest solution that preserved both simplicity and security.

Users who want simplicity can use the default relay.
Users who want full infrastructure control can run their own.

Both paths are supported.