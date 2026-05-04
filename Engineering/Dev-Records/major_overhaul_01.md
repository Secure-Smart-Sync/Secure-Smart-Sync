### Engineering Note: Sync Trigger Overhaul and Mobile-First UI Implementation
**Author:** sen  
**GitHub Username:** xensenx  

---

## 1. Abstract
This update addresses critical performance and behavioral inconsistencies between the Desktop and Mobile versions of the Secure-Smart-Sync (SSS) plugin. Primary focus was placed on fixing the "On-Save" trigger logic, introducing a "Sync-on-Idle" automation layer, and implementing a non-intrusive mobile status indicator to replace disruptive toast notifications during active writing sessions.

---

## 2. Trigger Logic Fixes & Enhancements

### 2.1 On-Save Debounce (Desktop & Mobile)
*   **The Issue:** Desktop sync was triggering too rapidly during bursts of file modification events, while Mobile sync failed to trigger at all due to inconsistent `vault.on("modify")` event firing.
*   **The Fix:** 
    *   Replaced the `lodash/throttle` implementation with a proper `debounce`. This ensures that multiple save/modify events reset a single timer, firing only once after the user stops activity.
    *   For **Mobile**, introduced a secondary listener for `workspace.on("editor-change")` to supplement unreliable file system events. This ensures sync triggers correctly even when the platform's internal auto-save behavior varies.

### 2.2 New Automation: Sync-on-Idle
*   Introduced a 3rd automation layer: **Sync after n seconds of idleness**. 
    *   This tracks inactivity in the editor rather than explicit file saves.
    *   Includes a guard clause to prevent multiple triggers (Interval, On-Save, On-Idle) from piling up; if one sync is active, subsequent automated triggers are silently dropped until the queue is clear.

---

## 3. UI/UX: The Floating Status Indicator

### 3.1 Mobile Hardware Limitations
Since the Obsidian mobile interface lacks a persistent status bar and hides the ribbon menu behind a drawer (the `≡` button), sync status was previously invisible unless using "toast" notices. To maintain an immersive writing environment, toasts are now suppressed for all automated triggers.

### 3.2 Floating Indicator Architecture
*   **Placement:** Injected a custom circular DOM element into the `document.body` at `top: 30px; left: 62px`, aligning it horizontally with the sidebar toggle icon.
*   **Visual States (The LED Metaphor):**
    *   **Idle:** Displays the SSS logo. Tapping triggers a manual sync.
    *   **Syncing (Blue Pulse):** Indicates an active sync. Tapping expands the element into a rightward-growing "pill" showing progress (e.g., "Syncing 12/34").
    *   **Success (Green):** Fades back to the logo after 3 seconds.
    *   **Conflict (Amber):** Tapping shows conflict details.
    *   **Error (Red):** Tapping displays the specific error message.
*   **Animation:** Expansion uses a `cubic-bezier` spring animation for a native mobile feel.

### 3.3 User Preference Toggle
Added a setting in the **Automation** section allowing users to revert to standard "toast" notifications for auto-syncs if they prefer traditional feedback over the custom floating indicator.

---

## 4. Reliability Fixes

### 4.1 Empty File/Folder Handling
*   Fixed a bug in `storage-local.ts` where files with a modification time (`mtime`) of `0` (often empty files or folders) were being skipped by the walker.
*   Implemented a fallback using `Date.now()` to ensure empty filenames and structural folders are correctly synced to Cloudflare R2's flat namespace.

### 4.2 SVG Normalization
*   Redefined the `SSS_LOGO_SVG` path to live natively in a 0–100 coordinate space. 
*   This prevents "clipping" issues on mobile WebViews where transforms were previously applied after the browser had already clipped content outside the initial viewbox.

---

## 5. Deployment Instructions
1. Copy updated files from `src/` to the build environment.
2. Ensure `styles.css` includes the new `.sss-mobile-indicator` and keyframe animation classes.
3. Run `npm run build` to generate the production `main.js`.
