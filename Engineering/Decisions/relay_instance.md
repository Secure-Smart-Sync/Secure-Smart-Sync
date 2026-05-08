# Why Relay Pairing Uses Cloudflare Workers + KV

## Context

One of the biggest UX problems in encrypted sync systems is onboarding a new device.

A user may already have Secure Smart Sync configured on one device with:

- encryption keys
n- bucket credentials
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

The goal was to make onboarding a second device feel effortless while keeping credentials encrypted during transit.

Users who want simplicity can use the default relay.
Users who want full infrastructure control can run their own.

Both paths are supported.