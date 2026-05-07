# Core Philosophy

Secure Smart Sync was not built around feature accumulation.

From the beginning, the project has been guided by a small set of foundational principles that influence every architectural, product, and user experience decision.

These are the three core philosophical pillars of the plugin.

---

## 1. Privacy First

Obsidian often describes vaults as a place for your thoughts.

That framing matters.

Personal notes are often deeply private. They may contain journals, research, unfinished writing, business ideas, personal reflections, or information users never intend to share with anyone.

Nobody should be able to access those thoughts without explicit permission.

Secure Smart Sync treats privacy as a non-negotiable principle.

This is why the plugin was built around client-side encryption.

Your files are encrypted before leaving your device.

No third-party server can inspect your notes.

No centralized service has access to your vault contents.

The purpose of the plugin is to make syncing easier without asking users to compromise ownership of their private data.

Convenience should never come at the cost of privacy.

---

## 2. User Experience Matters

A technically functional product is not automatically a usable product.

A significant amount of development time in Secure Smart Sync has gone into small UX decisions that may seem minor individually, but collectively make the plugin significantly easier to use.

Examples include:

- the mobile-specific sync status indicator built to replace intrusive toast notifications
- an open-source encrypted relay system that removes the frustration of manually copying credentials across devices
- a dedicated website for setup guides, onboarding support, and token usage estimation
- numerous small interface decisions designed to reduce friction

Many of these systems required additional engineering effort that could have been avoided by taking shortcuts.

They were built because user experience matters.

The goal is not just to make syncing work.

The goal is to make syncing feel intuitive, non-intrusive, and accessible.

---

## 3. Long-Term Reliability

The definition of "done" for this plugin is not whether a feature technically works once.

It is whether the system remains reliable across messy real-world Obsidian workflows over long periods of use.

Users switch devices frequently.

They edit files in unpredictable ways.

They create conflicts.

They go offline.

They reopen devices after long periods of inactivity.

Real workflows are messy.

Secure Smart Sync is built with the expectation that these scenarios will happen.

This is why significant effort has gone into:

- conflict handling
n- duplicate protection
- deletion safeguards
- sync state awareness
- recovery systems
- long-term operational stability

Reliability is not treated as a polishing step.

It is part of the product's foundation.

A sync tool that occasionally loses user data is not finished.

It is broken.

---

## Closing Principle

Every future feature should align with at least one of these three principles:

- protect user privacy
- improve user experience
- strengthen long-term reliability

If a feature conflicts with these foundations, it should be reconsidered.
