# Engineering Note: Sync Engine Optimization, Automation Overhaul, and UI Refactor

**Author:** sen (@xensenx)
**Date:** May 4, 2026
**Component:** SSS Plugin (Obsidian Sync Integration)

## 1. Context and Intent
The primary goal of this refactor was to mature the plugin's architecture by addressing several distinct areas: sync performance bottlenecks, platform-specific event handling (Desktop vs. Mobile), and the intrusiveness of the user interface during active writing sessions. The changes chunk the system's logic into more efficient concurrent operations, standardize the visual language by replacing legacy text-based icons with SVGs, and introduce a highly contextual, non-blocking notification system.

## 2. Performance & Efficiency Upgrades
**Intent:** Maximize network efficiency and reduce post-sync latency without compromising data reliability.
*   **Continuous Task Execution (`sync-engine.ts`):** Replaced the static batch loop execution (which suffered from head-of-line blocking when waiting for slower files) with a `PQueue` pool. The system now maintains a constant concurrency stream, immediately filling open slots as individual tasks finish.
*   **Parallelized Post-Sync Loop (`main.ts`):** The `prevSync` update loop previously triggered sequential HEAD requests to R2 for every pushed file, causing severe O(n) latency scaling. This was refactored to utilize a `PQueue` pool with a concurrency of 8, dropping the wall-clock cost to O(ceil(n/8)).
*   **Error Lookup Optimization:** Upgraded the error checking mechanism from an O(tasks * errors) array search to a pre-built `Set<string>`, achieving O(1) lookups.

## 3. UI Standardization & Notification Redesign
**Intent:** Create a distraction-free, aesthetic writing environment by silencing background operations and standardizing visual assets.
*   **Iconography Overhaul:** Stripped all hardcoded emojis across `main.ts`, `settings-tab.ts`, and `styles.css`. Replaced them with Lucide-style SVGs, plain text formatting, and specific CSS classes for state colors. Added keyframe animations (`.sss-spin`) for active states.
*   **Contextual Notification Logic:** Suppressed standard Obsidian toasts for all automated triggers (`auto`, `on_save`, `on_idle`) upon successful completion. Toasts are now strictly reserved for manual syncs and error states.
*   **Ribbon Indicator Architecture:** Re-engineered the native ribbon icon to act as a passive status indicator to solve the lack of a status bar on mobile. 
    *   **Idle:** Standard SVG logo. Clicking initiates a manual sync.
    *   **Active/Syncing:** Displays a blue pulsing badge.
    *   **Complete:** Displays a green badge that cleanly fades out after 3 seconds.
    *   **Conflict / Error:** Displays an amber (conflict) or red (error) badge.
    *   **Interactive Pill:** Tapping the ribbon during any non-idle state expands a rightward floating pill to display specific progress details (e.g., "Syncing 12/34") or error/conflict logs.

## 4. Automation Triggers & Platform Event Handling
**Intent:** Resolve misfiring automation logic and account for the architectural differences in event lifecycles between Obsidian Desktop and Mobile.
*   **Desktop On-Save Fix:** Swapped `lodash/throttle` for `lodash/debounce` in `main.ts`. The throttle implementation was firing on the leading edge and causing rapid, repeated syncs. The debounce timer now correctly resets on every keystroke, ensuring the sync only triggers once the user stops typing.
*   **Mobile On-Save Fix:** Addressed the unreliability of `vault.on("modify")` on Obsidian Mobile. Implemented a secondary `workspace.on("editor-change")` listener exclusively for mobile. Both platform listeners feed into the same debounce timer to prevent double-firing.
*   **New "On-Idle" Trigger (`types.ts`, `main.ts`, `settings-tab.ts`):** Introduced a third, user-configurable automation layer (`syncOnIdleMs`). This registers an event listener that fires exactly N seconds after zero keystroke activity, regardless of file save state. It respects the global `isSyncing` guard to prevent collision with other automation triggers.

## 5. Storage & Reliability Fixes
**Intent:** Ensure total file coverage, particularly for edge-case file states.
*   **Empty File Sync (`storage-local.ts`):** Fixed an issue where new or empty files with `mtime = 0` were silently skipped during the vault walk. The condition now falls back to `Date.now()`, guaranteeing that empty files are tracked and uploaded.
