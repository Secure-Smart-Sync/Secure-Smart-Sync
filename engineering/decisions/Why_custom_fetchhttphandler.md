# Why Custom FetchHttpHandler Exists

## Problem

When integrating AWS S3 SDKs inside an Obsidian plugin, the default networking layer introduces a major issue: **CORS restrictions**.

AWS SDKs typically rely on the browser's native `fetch` implementation when running in environments that resemble the web. Since Obsidian plugins operate inside an Electron-based environment with browser-like constraints, direct requests to S3 endpoints can trigger CORS errors unless the user manually configures bucket policies and CORS rules.

That creates multiple problems:

- Users are forced to modify their S3 bucket configuration.
- Incorrect CORS setup can completely break sync.
- Many users are unfamiliar with AWS networking configuration.
- It increases onboarding friction for something that should feel seamless.

For a sync product, asking users to manually debug CORS policies is unacceptable.

---

## Solution

A custom `FetchHttpHandler` was created to bypass this issue.

Instead of allowing the AWS SDK to use the browser's default networking layer, this custom handler intercepts outgoing requests and routes them through Obsidian's native `requestUrl()` API.

This means:

- Network requests are handled through Obsidian's internal networking layer.
- Requests are no longer blocked by browser-enforced CORS restrictions.
- Users do not need to manually configure CORS rules for their buckets.
- The plugin behaves more like a native desktop/mobile application rather than a browser app.

The custom handler essentially acts as an adapter layer between:

`AWS SDK request format -> Obsidian requestUrl -> AWS response handling`

---

## Why this approach was chosen

### Better user experience

Most users should never need to understand AWS infrastructure details just to enable sync.

The plugin should work after credentials and bucket information are provided — not require users to search forums for CORS fixes.

### Reduced configuration errors

Manual CORS configuration introduces unnecessary failure points.

A single incorrect rule can lead to:

- Failed uploads
- Failed downloads
- Broken sync sessions
- Confusing error logs

Removing that requirement reduces support burden.

### Platform consistency

Obsidian already provides a stable network abstraction.

Using `requestUrl()` ensures behavior remains more predictable across desktop and mobile environments where networking behavior may differ.

---

## Tradeoffs

This abstraction adds maintenance overhead.

Whenever AWS SDK request behavior changes, the custom handler may need updates to maintain compatibility.

It also introduces another layer between the SDK and the network stack, which can make debugging slightly harder.

However, the tradeoff is worth it because reliability and user simplicity matter far more for a sync system.

---

## Final Decision

The custom `FetchHttpHandler` exists because users should not have to configure infrastructure-level networking rules just to sync their notes.

By routing requests through Obsidian's native networking layer, Secure Smart Sync avoids CORS issues and keeps setup significantly simpler.

The goal is straightforward:

**Sync should feel invisible. Infrastructure complexity should stay hidden.**
