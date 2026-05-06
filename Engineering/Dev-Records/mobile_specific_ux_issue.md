# Engineering Update: Mobile Sync Optimization and UX Lifecycle Refinements

**Author:** sen
**GitHub:** @xensenx
**Date:** May 6, 2026
**Component:** Secure-Smart-Sync (SSS) Obsidian Plugin

## Intent and Context
Recent debugging of the mobile application lifecycle revealed latency in peer-to-peer change detection, specifically when launching the application or returning it to the foreground. The adaptive polling engine was falling back to a 30-second idle interval during these high-priority states, causing delayed synchronization across devices. 

Simultaneously, the mobile floating UI indicator required refinement. It exhibited an approximate 1-second delay when hiding behind the mobile sidebar drawer and featured an overly aggressive syncing animation that undermined its purpose as a minimally invasive background process indicator.

This update tightens the mobile polling lifecycle for near-instant reactivity and refactors the CSS/DOM-monitoring layer of the mobile indicator for a cleaner, zero-latency user experience.

## Architectural Changes & Implementation Details

### 1. Adaptive Sync Timing & Polling Reactivity
The core issue was that the sentinel polling interval defaulted to 30 seconds upon app launch or when returning to the foreground, causing up to a 15-20 second delay in detecting remote changes from other clients (e.g., PC).

*   **Initial Load Polling Fix:** We now stamp `_lastForegroundAt = Date.now()` directly inside `onload()` prior to invoking `scheduleSentinelPoll()`. This forces the initial sentinel loop to begin at the active 4-second interval rather than the 30-second idle interval.
*   **Foreground Reactivity (`registerVisibilityFlush`):** When the application returns to the foreground, we now accurately stamp `_lastForegroundAt`. The adaptive polling interval calculation (`_adaptivePollIntervalMs`) was updated to evaluate `Math.max(_lastEditAt, _lastForegroundAt)`. Returning to the app now counts as "recent activity," immediately shifting the polling rate to 4 seconds for a 2-minute window before naturally decaying back to 30 seconds.
*   **Startup Sync Trigger (`runSmartSyncOnOpen`):** Implemented a guaranteed `triggerSync("init")` on mobile startup with a 5-second delay to ensure local state pushes correctly even if the sentinel hasn't changed. 

### 2. Zero-Latency Sidebar Detection
The mobile sidebar in Obsidian uses CSS transforms rather than straightforward class toggles, rendering previous `MutationObserver` approaches unreliable and causing the sync indicator to overlap the sidebar for ~1 second.

*   **Workspace Model Polling:** The system now hooks into Obsidian's native `workspace.on("layout-change")` event. Instead of waiting for CSS animations to complete, we directly read the workspace model (`leftSplit.collapsed`). This triggers an immediate hide action the millisecond the sidebar toggle is engaged.
*   **Animation Fallback Pipeline:** 
    *   Added a 50ms delayed re-check within the `layout-change` handler to support alternative Obsidian builds where the model property updates asynchronously.
    *   Updated the `MutationObserver` attached to the drawer to watch both `class` and `style` attribute changes to catch inline animation states.
    *   Implemented a physical bounding-rect fallback (`getBoundingClientRect().right > 10`) in `refreshMobileIndicatorVisibility` as a definitive truth-check for drawer visibility.

### 3. Visual UX Overhaul
The mobile syncing indicator was visually competing for user attention, defeating its design goal.

*   **Stripped Container Styling:** Removed all background colors, box-shadows, and expanding ring pulse animations (`sss-mob-pulse`) from the parent container (`sss-mob-indicator`). The container remains permanently neutral and static.
*   **Targeted SVG Animation:** State color changes are now strictly isolated to the SVG logo itself via `fill="currentColor"`. 
*   **Subtle Breathing Effect:** Replaced the aggressive CSS pulse with a gentle 2.4-second opacity breath (`sss-mob-logo-breathe`) looping between 100% and 35% opacity exclusively during the `.sss-mob-syncing` state.

## System Impact
*   **Time-to-Sync (Cross-device):** Reduced from ~15-30 seconds to ~4 seconds upon mobile client load or foreground focus.
*   **UI Performance:** Sidebar toggle overlap reduced from ~1000ms to 0ms.
