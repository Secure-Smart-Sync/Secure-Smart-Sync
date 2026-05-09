# Engineering Note: Refactoring Sync Engine and Workspace Configuration

**Author:** sen  
**GitHub Username:** xensenx  
**Date:** May 9, 2026

## Overview
This note documents the planned refactor of the Secure Smart Sync (SSS) core engine to improve conflict resolution, enforce encryption integrity, and streamline multi-device onboarding. Additionally, it addresses an environmental configuration issue regarding TypeScript module resolution in the current development workspace.

---

## 1. Feature Implementations & Refactoring

### Merge Conflict Handling
The system is transitioning from a purely deterministic rule-set to a more flexible, user-centric model.
*   **Keep Both (New Default):** Automated syncs will now default to "Keep Both." This routine preserves both local and remote versions by implementing a smart naming convention for duplicates to prevent data loss.
*   **Always On Toggle:** A persistent setting to bypass manual intervention.
*   **Always Ask Mode:** Implementation of a non-intrusive Obsidian UI modal. This will pause the sync queue for specific conflicting files, requiring manual user selection (Keep Local, Keep Remote, or Keep Both).

### Encryption Method Locking
To prevent permanent vault lockouts caused by post-setup configuration changes:
*   **Settings Lock:** The encryption method selection will be programmatically locked once the initial sync is completed.
*   **UI Safeguards:** Implementation of warning banners and disabled toggles in the settings tab to prevent accidental modification of active encryption schemas.
*   **Future Migration:** State management is being structured to support a dedicated "Migration Workflow" in future iterations.

### Device Relay Expansion
To eliminate remote folder fragmentation, the device pairing payload is being expanded beyond basic Cloudflare R2 credentials.
*   **Extended Payload:** The pairing logic now serializes and transfers encryption passwords, plugin preferences, sync settings, and configuration metadata.
*   **State Parity:** Ensures 1:1 parity between the primary and secondary devices upon unpacking the relay state.

---

## 2. Technical Debt & Error Recovery
*   **Sync Lifecycle Audit:** Conducted a review for potential silent failures.
*   **Hardening:** Implemented safer fallback defaults and granular error logging to replace generic failure states, ensuring sync state integrity during edge-case interruptions.

---

## 3. Environment & Workspace Troubleshooting

### Issue: Module Resolution Errors (p-queue, obsidian, etc.)
**Symptoms:** VS Code's TypeScript language server flags `Cannot find module 'p-queue'` and other dependencies within the `sss workspace` folder.

**Root Cause:**
The `sss workspace` directory is a source-only folder lacking `node_modules`, `package.json`, and `tsconfig.json`. While the project builds successfully within the `sss env` directory (where dependencies reside), the language server in the workspace directory cannot resolve types relative to the source files.

**Resolution:**
*   **Status:** These are workspace-display-only errors and do not affect the production build in the `sss env`.
*   **Fix:** A `tsconfig.json` will be placed in the `sss workspace` to point the language server to the `sss env/node_modules` path.
*   **Code Correction:** Resolved a double-escaped quote syntax error in `sync-engine.ts` which was exacerbating downstream resolution noise.

---

## Next Steps
1. Finalize the architectural plan for storing conflict preferences.
2. Update the relay payload serialization logic.
3. Apply the `tsconfig.json` fix to the local workspace to clear IntelliSense errors.
