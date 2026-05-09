/**
 * auto-sync.ts
 * Manages all background sync scheduling for SSS:
 *   - Interval-based auto-sync (legacy mode)
 *   - On-save debounce handler
 *   - Smart Sync idle debounce
 *   - Smart Sync on-open init
 *   - Document visibility flush (background/foreground transitions)
 *
 * Extracted from main.ts to isolate scheduling logic from plugin lifecycle.
 */

import debounce from "lodash/debounce";
import { Platform } from "obsidian";
import type { App } from "obsidian";
import type { PluginSettings } from "./types";

// ─── Auto-sync interval (legacy) ─────────────────────────────────────────────

export interface AutoSyncHandle {
  timer: ReturnType<typeof setInterval> | undefined;
}

export function scheduleAutoSync(
  handle: AutoSyncHandle,
  settings: PluginSettings,
  doSync: () => void,
  logger: { debug: (...a: any[]) => void }
): void {
  clearAutoSync(handle);
  if (settings.smartSync) return; // Smart Sync manages its own rhythm
  const ms = settings.autoSyncIntervalMs;
  if (ms > 0) {
    handle.timer = setInterval(doSync, ms);
    logger.debug(`Auto-sync every ${ms}ms`);
  }
}

export function clearAutoSync(handle: AutoSyncHandle): void {
  if (handle.timer !== undefined) {
    clearInterval(handle.timer);
    handle.timer = undefined;
  }
}

// ─── On-save debounce ─────────────────────────────────────────────────────────

/**
 * Register vault modify events to trigger a debounced on-save sync.
 * Smart Sync gates itself at fire-time so toggling it live works without reload.
 *
 * Returns the event registration cleanup function (called by Obsidian automatically
 * if registered via plugin.registerEvent — handled by the caller).
 */
export function buildOnSaveHandler(
  settings: PluginSettings,
  doSync: () => void
): { onModify: () => void; onEditorChange: () => void } | null {
  const debounceMs = settings.syncOnSaveDebounceMs;
  if (debounceMs <= 0) return null;

  const debouncedSync = debounce(doSync, debounceMs);

  return {
    onModify: () => {
      if (settings.smartSync) return;
      debouncedSync();
    },
    onEditorChange: () => {
      if (settings.smartSync) return;
      debouncedSync();
    },
  };
}

// ─── Smart Sync idle debounce ─────────────────────────────────────────────────

export type IdleDebounce = { (): void; cancel(): void; flush(): void };

/**
 * Build (or destroy) the idle-sync debounce function from current settings.
 * Returns a new debounce function or undefined if idle sync is disabled.
 */
export function buildIdleDebounce(
  settings: PluginSettings,
  doSync: () => void
): IdleDebounce | undefined {
  const ms = settings.smartSync
    ? (settings.smartSyncIdleSeconds ?? 4) * 1000
    : settings.syncOnIdleMs;

  if (ms > 0) {
    return debounce(doSync, ms) as unknown as IdleDebounce;
  }
  return undefined;
}

// ─── Smart Sync on-open ───────────────────────────────────────────────────────

/**
 * Poll the sentinel 3 s after load to catch changes made while closed.
 * Also triggers an init sync if more than 2 minutes have passed since the
 * last sync (catches local file changes and remote changes post-mobile-kill).
 */
export function runSmartSyncOnOpen(
  settings: PluginSettings,
  isSyncing: () => boolean,
  pollNow: () => void,
  triggerInit: () => void
): void {
  window.setTimeout(pollNow, 3000);

  const delay = Platform.isMobile ? 5000 : 8000;
  window.setTimeout(() => {
    if (isSyncing()) return;
    const elapsed = Date.now() - (settings.lastSyncedAt ?? 0);
    if (elapsed > 2 * 60 * 1000) {
      triggerInit();
    }
  }, delay);
}

// ─── Visibility flush ─────────────────────────────────────────────────────────

/**
 * Register a document visibilitychange handler.
 *
 * HIDDEN  → flush pending idle debounce; pause sentinel poll.
 * VISIBLE → restart poll; immediately poll once (Smart Sync only).
 *
 * Returns the handler function so the caller can deregister it on unload.
 */
export function registerVisibilityFlush(
  settings: PluginSettings,
  isSyncing: () => boolean,
  flushIdleDebounce: () => void,
  pausePoll: () => void,
  resumePoll: () => void,
  pollNow: () => void,
  setLastForegroundAt: (t: number) => void
): () => void {
  const handler = () => {
    if (document.hidden) {
      if (settings.smartSync && !isSyncing()) {
        flushIdleDebounce();
      }
      pausePoll();
    } else {
      resumePoll();
      if (settings.smartSync) {
        pollNow();
        if (Platform.isMobile) setLastForegroundAt(Date.now());
      }
    }
  };
  document.addEventListener("visibilitychange", handler);
  return handler; // caller stores this to deregister via document.removeEventListener
}
