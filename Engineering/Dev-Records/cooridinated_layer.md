# Engineering Record: Smart Sync Coordination Layer & Mobile Visibility Refactor

**Author:** sen
**GitHub:** xensenx
**Date:** May 5, 2026
**Component:** Sync Architecture / UI Observer / R2 Coordination

## Overview
This session finalized two major architectural updates to the Obsidian synchronization plugin:
1. A robust, observer-based mobile visibility indicator system.
2. The complete implementation of the "Smart Sync" coordination layer, utilizing Cloudflare R2 object storage with a highly optimized, hybrid polling strategy to maintain cross-device state awareness without exceeding free-tier limits.

---

## 1. Mobile Visibility Indicator System
Resolved issues regarding desktop bleed-through and indicator overlap with native Obsidian UI elements (modals, command palette, and notices).

*   **Desktop Guarding:** Centralized platform checks (`!Platform.isMobile`) at the top of `mountMobileIndicator()`. All call paths, including direct settings toggles, are now structurally safe from desktop bleed-through.
*   **Unified Observer Pattern:** Implemented a unified `MutationObserver` system behind `mobileVisibilityObserver` that monitors:
    *   `document.body` (childList and class attributes for modals/palettes).
    *   `.notice-container` (lazily attached to catch toast overlays).
    *   `.workspace` or `.app-container` (sidebar toggles).
*   **State Preservation:** Hiding logic utilizes a `.sss-mob-hidden` class with `display: none !important`. The update logic stores and restores the hidden state (`wasHidden`) so sync completions behind an open modal do not incorrectly unhide the indicator. 

---

## 2. Coordination Layer: Smart Sync & Sentinel Architecture
The core feature implementation enables seamless, automatic synchronization between devices using a state-aware "sentinel" file.

### The Sentinel Concept
Every successful sync (excluding dry runs and state-aware triggered syncs) writes a lightweight JSON payload to `__sss_state__/sync.json` in the R2 bucket. The payload contains `{ deviceId, syncedAt, vaultId }`. State-aware syncs deliberately do not write a new sentinel to prevent infinite cascading sync loops between devices (A -> B -> A).

### The Polling Dilemma & Resolution
Initial design relied on a strictly event-driven model (polling only after a local sync). Testing revealed a critical flaw: if Device B is active but idle (reading, not writing), it never triggers a local sync, meaning it never polls R2 to discover Device A's changes.

**The Solution: Hybrid Restrained Polling**
We implemented a hybrid polling strategy that balances instantaneous cross-device sync with aggressive resource conservation to stay well within Cloudflare R2's free tier (10M Class B ops/month).

1.  **Background Interval (Idle Catch-up):**
    *   Smart Sync ON: 30-second interval.
    *   Legacy Mode: 60-second interval.
2.  **Post-Sync Poll (Simultaneous Edit Catch):** Fires exactly 2 seconds after a device completes its own sync to check if another device wrote a sentinel simultaneously.
3.  **On-Open Poll (Offline Catch-up):** Fires 3 seconds after the app loads.
4.  **Visibility Restraint (Battery & Network Optimization):** 
    *   Hooks into `document.visibilitychange`.
    *   When the app goes to the background (`document.hidden = true`), the polling interval is completely cleared, and any pending idle sync is immediately flushed.
    *   When the app returns to the foreground, the interval restarts AND an immediate sentinel poll is fired for instant catch-up.

### Resource Utilization Constraints (Cloudflare R2)
*   **Cost Calculation:** A 30-second interval running 24/7 generates ~86,400 Class B operations/month per device (0.86% of the 10M free limit).
*   **Actual Impact:** With the `visibilitychange` restraint, polling only occurs while Obsidian is in focus. A heavy user (8 hours active focus/day) will generate ~28,800 ops/month (0.29% of the free quota). This guarantees the architecture will never push a user into the paid tier.

---

## 3. Configuration & State Management
*   **Settings Overhaul:** Introduced `smartSync` (boolean) and `smartSyncIdleSeconds` (number, default: 7s).
*   **Mutual Exclusion:** When Smart Sync is enabled, traditional interval-based auto-sync, sync-on-save, and legacy idle syncs are bypassed at runtime. Their saved values in `data.json` are preserved so toggling Smart Sync off restores previous manual configurations perfectly.
*   **Dynamic Rebinding:** The `rescheduleIdleHandler()` dynamically destroys and recreates the debounce function based on current settings. Toggling Smart Sync in the UI takes effect immediately without requiring an app reload.

## Code Map
*   **`types.ts`:** Added Smart Sync interfaces and defaults.
*   **`main.ts`:** 
    *   Added visibility flush (`registerVisibilityFlush`).
    *   Refactored `scheduleSentinelPoll` to support the 30s/60s hybrid logic.
    *   Implemented `rescheduleIdleHandler` and `runSmartSyncOnOpen`.
    *   Gated `scheduleAutoSync` and `registerOnSaveHandler` callbacks.
*   **`settings-tab.ts`:** Built dynamic UI displaying either Smart Sync controls or granular manual controls based on the current toggle state.
*   **`styles.css`:** Reused existing `.sss-inline-note` and `.sss-auto-note` classes for the new UI elements.
