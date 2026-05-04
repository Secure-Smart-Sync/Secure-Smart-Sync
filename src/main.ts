/**
 * main.ts
 * Obsidian plugin entry point for Secure-Smart-Sync (SSS).
 */

import debounce from "lodash/debounce";
import PQueue from "p-queue";
import { Notice, Platform, Plugin, type TAbstractFile, addIcon } from "obsidian";

import {
  type InternalDB,
  getAllPrevSyncRecords,
  getLastFailedSync,
  getLastSuccessSync,
  prepareDB,
  setLastFailedSync,
  setLastSuccessSync,
  setPluginVersion,
  upsertPrevSyncRecord,
  deletePrevSyncRecord,
  clearAllPrevSyncRecords,
  insertSyncHistoryEntry,
} from "./database";
import { PluginLogger } from "./logger";
import { StorageBase } from "./storage-base";
import { StorageEncrypt } from "./storage-encrypt";
import { StorageLocal } from "./storage-local";
import { StorageR2 } from "./storage-r2";
import { buildMixedEntities, buildTasks, executeTasks } from "./sync-engine";
import { decodeSettings, encodeSettings } from "./settings-persist";
import { SSSSettingTab } from "./settings-tab";
import {
  DEFAULT_SETTINGS,
  type FileEntity,
  type PluginSettings,
  type SyncStats,
  type SyncTrigger,
} from "./types";
import { toText } from "./utils";

const PLUGIN_ID = "Secure-Smart-Sync";
const SYNC_ICON_ID = "sss-sync-icon";

// SSS logo — path pre-normalised to the 0–100 coordinate space that
// Obsidian's addIcon() expects (it wraps the content in viewBox="0 0 100 100").
// Original SVG was 2048×2048; every coordinate multiplied by 100/2048.
// No transform wrapper = no clipping risk on mobile WebViews.
const SSS_LOGO_SVG = `<path fill="currentColor" d="
M46.63 93.84 c-7.49 -0.58 -14.72 -3.10 -21.04 -7.34 c-3.83 -2.57 -7.43 -5.94 -10.36 -9.69
c-4.58 -5.87 -7.70 -13.35 -8.63 -20.75 c-0.40 -3.15 -0.45 -7.81 -0.12 -10.79
c0.56 -4.91 2.00 -9.91 4.14 -14.26 c5.59 -11.34 15.58 -19.72 27.51 -23.10
c5.31 -1.49 10.77 -1.97 16.36 -1.42 c20.81 2.06 37.58 19.22 39.17 40.09
c0.17 2.29 0.07 7.24 -0.20 9.17 c-0.89 6.50 -2.66 11.64 -5.86 16.94
c-2.12 3.52 -4.85 6.88 -7.73 9.50 c-7.46 6.83 -16.67 10.88 -26.46 11.64
c-1.48 0.11 -5.31 0.11 -6.80 -0.01z
m6.76 -15.96 c8.81 -1.16 17.13 -6.82 20.49 -13.97 c1.13 -2.39 1.72 -5.12 1.57 -7.26
c-0.43 -6.08 -4.59 -11.60 -10.15 -13.45 c-2.50 -0.83 -4.51 -0.93 -6.85 -0.33
c-0.86 0.22 -2.01 0.65 -2.01 0.77 c0 0.04 0.10 0.15 0.21 0.25
c0.37 0.33 1.90 2.43 2.43 3.33 c1.15 1.95 1.46 2.61 1.46 3.13
c0 1.15 -0.24 1.13 -7.08 -0.63 c-2.95 -0.76 -6.97 -1.79 -8.94 -2.28
c-1.96 -0.50 -3.68 -0.96 -3.82 -1.04 c-0.32 -0.16 -0.38 -0.31 -0.38 -0.92
c0 -0.59 0.13 -0.75 1.50 -1.93 c5.07 -4.39 11.36 -7.02 18.13 -7.64
c1.66 -0.15 5.39 -0.12 6.94 0.05 c2.47 0.27 4.79 0.77 6.82 1.46
c0.55 0.19 1.00 0.32 1.00 0.29 c0 -0.02 -0.22 -0.49 -0.50 -1.02
c-1.78 -3.56 -4.91 -7.20 -8.20 -9.52 c-4.44 -3.15 -9.11 -4.82 -14.54 -5.21
c-2.89 -0.21 -6.55 0.28 -9.67 1.29 c-6.66 2.16 -12.16 6.70 -15.23 12.59
c-1.88 3.60 -2.64 7.63 -2.07 10.95 c0.72 4.19 2.88 7.66 6.28 10.09
c2.73 1.95 6.54 3.03 9.53 2.70 c0.96 -0.11 2.31 -0.36 2.49 -0.47
c0.04 -0.02 -0.08 -0.22 -0.26 -0.45 c-0.71 -0.88 -1.65 -2.38 -2.31 -3.68
c-0.62 -1.22 -0.68 -1.43 -0.68 -1.93 c0 -0.31 0.05 -0.62 0.12 -0.68
c0.30 -0.30 1.24 -0.14 6.72 1.25 c2.98 0.75 6.85 1.72 8.59 2.15
c1.75 0.43 3.27 0.83 3.40 0.88 c0.19 0.08 0.21 0.17 0.21 0.71
c0 0.59 -0.02 0.63 -0.36 0.97 c-1.12 1.06 -3.58 2.74 -5.44 3.74
c-3.75 1.98 -7.77 3.20 -11.86 3.57 c-1.70 0.16 -6.10 0.08 -7.64 -0.14
c-1.77 -0.25 -4.11 -0.81 -5.81 -1.38 c-0.86 -0.29 -1.57 -0.52 -1.58 -0.50
c-0.07 0.07 1.07 1.94 1.82 2.97 c4.61 6.46 12.22 10.72 20.42 11.44
c1.31 0.12 3.77 0.05 5.25 -0.14z
"/>`;

export default class SSSPlugin extends Plugin {
  // ── Status bar SVG icons (Lucide-style, themed via currentColor) ─────────
  private static readonly STATUS_ICONS: Record<"idle" | "syncing" | "error", string> = {
    idle: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
    syncing: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="sss-spin"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    error: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  settings!: PluginSettings;

  private db!: InternalDB;
  private vaultId!: string;
  private logger!: PluginLogger;

  private statusBarEl?: HTMLElement;
  private autoSyncTimer?: ReturnType<typeof setInterval>;
  private isSyncing = false;

  // ── Ribbon indicator state ───────────────────────────────────────────
  private ribbonEl?: HTMLElement;
  private statusPillEl?: HTMLElement;
  private ribbonSuccessTimer?: ReturnType<typeof setTimeout>;
  private statusPillTimer?: ReturnType<typeof setTimeout>;
  private lastStatusText = "";
  private syncProgress = { done: 0, total: 0 };

  // ── Mobile floating indicator state ─────────────────────────────────
  // On mobile the ribbon is hidden in a drawer, so we inject our own
  // persistent circular indicator into document.body instead.
  private mobileIndicatorEl?: HTMLElement;
  private mobilePillEl?: HTMLElement;
  private mobilePillTimer?: ReturnType<typeof setTimeout>;
  private mobileSuccessTimer?: ReturnType<typeof setTimeout>;
  private mobilePillExpanded = false;

  async onload(): Promise<void> {
    this.logger = new PluginLogger("[SSS]");

    await this.loadSettings();
    this.logger.setLevel(this.settings.logLevel);

    const { db, vaultId } = await prepareDB(
      this.app.vault.adapter.getBasePath?.() ?? this.app.vault.getName(),
      this.settings._vaultId
    );
    this.db = db;
    this.vaultId = vaultId;

    await setPluginVersion(db, vaultId, this.manifest.version);

    addIcon(SYNC_ICON_ID, SSS_LOGO_SVG);

    if (this.settings.showStatusBar) {
      this.statusBarEl = this.addStatusBarItem();
      this.setStatus("idle");
    }

    this.addCommand({ id: "sss-sync-now", name: "Sync now", callback: () => this.triggerSync("manual") });
    this.addCommand({ id: "sss-sync-dry-run", name: "Dry run (show what would change)", callback: () => this.triggerSync("dry_run") });
    this.addCommand({ id: "sss-reset-sync-history", name: "Reset sync history (forces full re-sync)", callback: () => this.resetSyncHistory() });

    // Ribbon icon doubles as the live sync indicator.
    // State is conveyed via CSS classes only — no DOM children injected,
    // no inline styles, so Obsidian’s icon rendering is never disturbed.
    this.ribbonEl = this.addRibbonIcon(SYNC_ICON_ID, "Secure-Smart-Sync", () => this.handleRibbonClick());

    // On mobile, mount our own persistent floating indicator since the
    // ribbon is hidden inside a drawer and invisible during auto-sync.
    if (Platform.isMobile && !this.settings.useToastForAutoSync) {
      this.mountMobileIndicator();
    }

    this.addSettingTab(new SSSSettingTab(this.app, this));
    this.scheduleAutoSync();
    this.registerOnSaveHandler();
    this.registerOnIdleHandler();

    if (this.settings.initSyncDelayMs > 0) {
      window.setTimeout(() => this.triggerSync("init"), this.settings.initSyncDelayMs);
    }

    this.logger.info(`Plugin loaded. Vault ID: ${vaultId}`);
  }

  async onunload(): Promise<void> {
    this.clearAutoSync();
    this.dismissStatusPill();
    this.teardownMobileIndicator();
    if (this.ribbonSuccessTimer !== undefined) window.clearTimeout(this.ribbonSuccessTimer);
    this.logger.info("Plugin unloaded.");
  }

  async loadSettings(): Promise<void> {
    const raw = await this.loadData();
    const decoded = decodeSettings(raw);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, decoded ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(encodeSettings(this.settings));
    this.logger.setLevel(this.settings.logLevel);
    this.scheduleAutoSync();
  }

  async triggerSync(trigger: SyncTrigger): Promise<void> {
    if (this.isSyncing) {
      // Only interrupt manual taps — auto/idle/on_save silently drop.
      if (trigger === "manual") {
        new Notice("Secure-Smart-Sync: already syncing, please wait…");
      }
      return;
    }

    const isDry      = trigger === "dry_run";
    const isManual   = trigger === "manual" || trigger === "dry_run";
    // Non-manual triggers are silent unless the user opted into toasts.
    const useToasts  = isManual || this.settings.useToastForAutoSync;

    this.isSyncing = true;
    this.syncProgress = { done: 0, total: 0 };
    this.setRibbonStatus("syncing");
    this.updateMobileIndicator("syncing");
    this.setStatus("syncing");

    if (useToasts) {
      new Notice(`Secure-Smart-Sync: ${isDry ? "dry run" : "syncing"}…`);
    }

    try {
      const stats   = await this.runSync(isDry);
      const summary = this.buildSummary(stats);
      const hasErr  = stats.errors.length > 0;
      const hasCon  = stats.conflictsResolved > 0;

      this.lastStatusText = summary;
      this.setStatus("idle");

      if (hasErr) {
        this.setRibbonStatus("error");
        this.updateMobileIndicator("error");
        // Errors always surface regardless of trigger.
        new Notice(`Secure-Smart-Sync: ${summary}`, 8000);
      } else if (hasCon) {
        this.setRibbonStatus("conflict");
        this.updateMobileIndicator("conflict");
        if (useToasts) new Notice(`Secure-Smart-Sync: ${summary}`);
      } else {
        this.setRibbonStatus("success");
        this.updateMobileIndicator("success");
        if (useToasts) new Notice(`Secure-Smart-Sync: ${summary}`);
      }

      if (!isDry) {
        const now = Date.now();
        await setLastSuccessSync(this.db, this.vaultId, now);
        this.settings.lastSyncedAt = now;
        await this.saveSettings();
        await insertSyncHistoryEntry(this.db, this.vaultId, JSON.stringify(stats));
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error("Sync failed:", toText(err));
      this.lastStatusText = msg;
      this.setRibbonStatus("error");
      this.updateMobileIndicator("error");
      this.setStatus("error");
      // Errors always surface.
      new Notice(`Secure-Smart-Sync: failed – ${msg}`);
      await setLastFailedSync(this.db, this.vaultId, Date.now());
    } finally {
      this.isSyncing = false;
    }
  }

  private async runSync(dryRun: boolean): Promise<SyncStats> {
    const { settings } = this;

    if (!settings.r2.endpoint || !settings.r2.bucketName) {
      throw new Error("R2 endpoint or bucket name is not configured.");
    }

    const local: StorageBase = new StorageLocal({
      vault: this.app.vault,
      pluginId: PLUGIN_ID,
      configDir: this.app.vault.configDir,
      syncConfigDir: settings.syncConfigDir,
      deleteToWhere: settings.deleteBehaviour === "permanent"
        ? "permanent"
        : settings.deleteBehaviour === "trash_local" ? "obsidian" : "system",
      logger: this.logger,
    });

    const rawRemote = new StorageR2(settings.r2);
    const remote: StorageBase = settings.encryptionPassword
      ? new StorageEncrypt(rawRemote, settings.encryptionPassword, settings.encryptionMethod)
      : rawRemote;

    const connected = await rawRemote.checkConnection((err) => {
      this.logger.error("R2 connection failed:", toText(err));
    });
    if (!connected) throw new Error("Cannot connect to R2. Check your credentials and endpoint.");

    if (settings.encryptionPassword && remote instanceof StorageEncrypt) {
      const check = await remote.validatePassword();
      if (!check.ok) {
        throw new Error(
          `Encryption password check failed: ${check.reason}. ` +
          "Your password may be wrong, or the remote uses a different encryption method."
        );
      }
    }

    this.logger.info("Walking local, prevSync, remote…");
    const [localEntities, prevSyncEntities, remoteEntities] = await Promise.all([
      local.walk(),
      getAllPrevSyncRecords(this.db, this.vaultId),
      remote.walk(),
    ]);

    this.logger.info(
      `Entities: local=${localEntities.length}, prev=${prevSyncEntities.length}, remote=${remoteEntities.length}`
    );

    const mixed = buildMixedEntities(localEntities, prevSyncEntities, remoteEntities, settings.ignorePaths);
    const tasks = buildTasks(mixed, settings);

    const actionable = tasks.filter((t) => t.kind !== "skip");
    this.logger.info(`Tasks: ${tasks.length} total, ${actionable.length} actionable`);

    if (dryRun) {
      const report = actionable.map((t) => `${t.kind}: ${t.key}`).join("\n");
      this.logger.info("Dry run plan:\n" + report);
      return {
        filesUploaded: 0, filesDownloaded: 0, filesDeleted: 0,
        filesSkipped: tasks.length, conflictsResolved: 0,
        errors: [], startedAt: Date.now(), finishedAt: Date.now(),
      };
    }

    const stats = await executeTasks({
      local, remote, tasks,
      concurrency: settings.r2.partsConcurrency ?? 5,
      logger: this.logger,
      onProgress: (_done, _total, _key) => {
        this.syncProgress = { done: _done, total: _total };
        this.setStatusText(`Syncing ${_done}/${_total}…`);
        // Keep pill text live if it’s open.
        if (this.statusPillEl) {
          this.statusPillEl.textContent = `Syncing ${_done} / ${_total}`;
        }
      },
    });

    // ── Update prevSync records (parallel) ──────────────────────────────────
    //
    // The prevSync record for a file must contain:
    //   mtimeCli  — from the LOCAL file (reliable, used for local-change detection)
    //   etag      — from the REMOTE file (reliable, used for remote-change detection)
    //
    // Why ETag matters: encrypted remote files have size=undefined and
    // mtimeCli=S3-upload-timestamp (not the original file mtime). Without ETag,
    // isChanged() falls back to mtime which always differs → every file
    // re-syncs every time.
    //
    // We also handle "no_change" tasks here for two cases:
    //   A) File was already in sync but has NO prevSync record (newly added
    //      to one side while plugin was not running).
    //   B) File has a prevSync record from before the ETag fix (no etag stored)
    //      → upgrade it silently so the next sync uses ETag comparison.
    //
    // ▶ PARALLELISM: pushed files each need a remote HEAD request for their new
    //   ETag. Running these sequentially added ~200 ms × n_pushed to total sync
    //   time. We now run up to 8 concurrent stat/DB operations.
    //

    // Pre-build a Set of errored keys so lookup is O(1) instead of O(n²).
    // Error format: "[kind] some/path.md: message"
    const erroredKeys = new Set<string>(
      stats.errors
        .map((e) => { const m = e.match(/^\[\w+\] (.+?): /); return m?.[1] ?? ""; })
        .filter(Boolean)
    );

    const prevSyncQueue = new PQueue({ concurrency: 8 });

    for (const task of tasks) {
      // Folders don't need prevSync records
      if (task.key.endsWith("/")) continue;

      prevSyncQueue.add(async () => {
        const errored = erroredKeys.has(task.key);

        // ── Deleted files ─────────────────────────────────────────────────────
        if (task.kind === "delete_local" || task.kind === "delete_remote") {
          if (!errored) await deletePrevSyncRecord(this.db, this.vaultId, task.key);
          return;
        }

        // ── Skipped (too large, no_change, equal) ─────────────────────────────
        if (task.kind === "skip") {
          if (errored) return;

          // Only act on files that are genuinely in sync on both sides
          if (
            (task.decision === "no_change" || task.decision === "equal") &&
            task.entity.local &&
            task.entity.remote
          ) {
            const prevRecord  = task.entity.prevSync;
            const remoteEtag  = task.entity.remote.etag;

            // Write/upgrade prevSync only if:
            //   (a) no record exists yet, OR
            //   (b) record exists but lacks the ETag (old record pre-fix)
            const needsWrite = !prevRecord || (!prevRecord.etag && !!remoteEtag);
            if (needsWrite) {
              await upsertPrevSyncRecord(this.db, this.vaultId, {
                key:      task.key,
                keyRaw:   task.key,
                mtimeCli: task.entity.local.mtimeCli,
                size:     task.entity.local.size ?? task.entity.local.sizeRaw,
                sizeRaw:  task.entity.local.sizeRaw ?? 0,
                etag:     remoteEtag,
                mtimeSvr: task.entity.remote.mtimeSvr,
              } as FileEntity);
            }
          }
          return;
        }

        // ── Pushed / pulled files ─────────────────────────────────────────────
        if (errored) return;

        try {
          // Re-stat local to get the definitive post-write mtime
          const freshLocal = await local.stat(task.key);

          // Get remote ETag to anchor future remote comparisons.
          // For push: the file was just uploaded — do a HEAD to get its new ETag.
          //   (StorageEncrypt.stat is safe here: the encrypted key is in
          //    cacheEncKeys from the writeFile call that just happened.)
          // For pull: the remote entity we already have carries the correct ETag.
          let remoteEtag: string | undefined = task.entity.remote?.etag;

          if (task.kind === "push") {
            try {
              const freshRemote = await remote.stat(task.key);
              remoteEtag = freshRemote.etag;
            } catch (e) {
              // Non-fatal: we'll fall back to using the pre-push remote ETag
              // (which may be stale for a conflict-push but is still better than nothing)
              this.logger.warn(
                `[SSS] Could not stat remote after push for ${task.key} — ETag may not be stored:`,
                (e as Error).message
              );
            }
          }

          await upsertPrevSyncRecord(this.db, this.vaultId, {
            ...freshLocal,
            key:    task.key,
            keyRaw: task.key,
            // Attach the remote ETag so isChanged(remote, prevSync) short-circuits
            // on the next sync instead of falling back to unreliable mtime.
            ...(remoteEtag !== undefined ? { etag: remoteEtag } : {}),
          });
        } catch (err) {
          this.logger.warn(`[SSS] Failed to update prevSync for ${task.key}:`, (err as Error).message);
          // Fallback: use the pre-operation snapshot (less accurate but avoids data loss)
          const entity = task.kind === "push"
            ? (task.entity.local ?? task.entity.remote)
            : (task.entity.remote ?? task.entity.local);
          if (entity) {
            await upsertPrevSyncRecord(this.db, this.vaultId, {
              ...entity,
              key: task.key,
              keyRaw: task.key,
            });
          }
        }
      });
    }

    await prevSyncQueue.onIdle();

    if (remote instanceof StorageEncrypt) await remote.closeResources();

    return stats;
  }

  async resetSyncHistory(): Promise<void> {
    await clearAllPrevSyncRecords(this.db, this.vaultId);
    new Notice("Secure-Smart-Sync: sync history cleared. Next sync will do a full comparison.");
  }

  private buildSummary(stats: SyncStats): string {
    const parts: string[] = [];
    if (stats.filesUploaded)     parts.push(`↑${stats.filesUploaded}`);
    if (stats.filesDownloaded)   parts.push(`↓${stats.filesDownloaded}`);
    if (stats.filesDeleted)      parts.push(`×${stats.filesDeleted}`);
    if (stats.conflictsResolved) parts.push(`${stats.conflictsResolved} conflict${stats.conflictsResolved !== 1 ? "s" : ""}`);
    if (stats.errors.length)     parts.push(`${stats.errors.length} error${stats.errors.length !== 1 ? "s" : ""}`);
    return parts.length ? parts.join(", ") : "up to date";
  }

  private scheduleAutoSync(): void {
    this.clearAutoSync();
    const ms = this.settings.autoSyncIntervalMs;
    if (ms > 0) {
      this.autoSyncTimer = setInterval(() => this.triggerSync("auto"), ms);
      this.logger.debug(`Auto-sync every ${ms}ms`);
    }
  }

  private clearAutoSync(): void {
    if (this.autoSyncTimer !== undefined) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
    }
  }

  private registerOnSaveHandler(): void {
    const debounceMs = this.settings.syncOnSaveDebounceMs;
    if (debounceMs <= 0) return;

    // A proper debounce resets the timer on every call, firing only once the
    // user has actually stopped for the full window. The old throttle fired
    // on the leading edge and caused rapid repeated syncs on desktop.
    const doSync = debounce(() => this.triggerSync("on_save"), debounceMs);

    // vault.modify is reliable on desktop.
    this.registerEvent(
      this.app.vault.on("modify", () => doSync())
    );

    // On mobile, vault.modify fires inconsistently. editor-change is more
    // reliable there. Both feed the same debounced function so they cooperate
    // — whichever fires resets the shared timer.
    if (Platform.isMobile) {
      this.registerEvent(
        (this.app.workspace as any).on("editor-change", () => doSync())
      );
    }
  }

  // ── On-idle handler ───────────────────────────────────────────────────────────
  // Triggers sync after N ms of editor inactivity on both platforms.
  // Complements on-save (which fires after file-level events) by also
  // catching rapid-keystroke sessions where the user stops and walks away.

  private registerOnIdleHandler(): void {
    const idleMs = this.settings.syncOnIdleMs;
    if (idleMs <= 0) return;

    // Debounce from editor activity: fires idleMs after the LAST keystroke.
    const doSync = debounce(() => this.triggerSync("on_idle"), idleMs);

    // editor-change is reliable on both desktop and mobile.
    this.registerEvent(
      (this.app.workspace as any).on("editor-change", () => doSync())
    );
  }

  private setStatus(state: "idle" | "syncing" | "error"): void {
    if (!this.statusBarEl) return;
    this.statusBarEl.innerHTML =
      `<span class="sss-status-icon">${SSSPlugin.STATUS_ICONS[state]}</span>SSS`;
  }

  private setStatusText(text: string): void {
    this.statusBarEl?.setText(text);
  }

  // ── Ribbon indicator ───────────────────────────────────────────────────────────

  /**
   * Click handler for the ribbon icon.
   * Idle  → trigger manual sync.
   * Active (syncing / error / conflict) → show the status pill instead.
   */
  private handleRibbonClick(): void {
    if (this.isSyncing) {
      this.showStatusPill();
      return;
    }
    // If last sync left an error or conflict indicator, first tap shows status.
    const cls = this.ribbonEl?.className ?? "";
    if (cls.includes("sss-ribbon-error") || cls.includes("sss-ribbon-conflict")) {
      this.showStatusPill();
      return;
    }
    this.triggerSync("manual");
  }

  /**
   * Update the ribbon icon state via CSS class only.
   * The badge dot is rendered entirely in CSS via ::after —
   * no children are injected into the ribbon element.
   * ‘success’ automatically fades back to ‘idle’ after 3 seconds.
   */
  private setRibbonStatus(status: "idle" | "syncing" | "success" | "conflict" | "error"): void {
    if (!this.ribbonEl) return;

    if (this.ribbonSuccessTimer !== undefined) {
      window.clearTimeout(this.ribbonSuccessTimer);
      this.ribbonSuccessTimer = undefined;
    }

    // Remove all state classes then apply the new one.
    this.ribbonEl.removeClass(
      "sss-ribbon-syncing", "sss-ribbon-success",
      "sss-ribbon-conflict", "sss-ribbon-error"
    );
    if (status !== "idle") {
      this.ribbonEl.addClass(`sss-ribbon-${status}`);
    }

    if (status === "success") {
      this.ribbonSuccessTimer = window.setTimeout(() => {
        this.setRibbonStatus("idle");
      }, 3000);
    }
  }

  /**
   * Show a floating pill to the right of the ribbon icon with the current
   * sync status. Auto-dismisses after 4 seconds.
   */
  private showStatusPill(): void {
    if (!this.ribbonEl) return;
    this.dismissStatusPill();

    const rect  = this.ribbonEl.getBoundingClientRect();
    const pill  = document.body.createDiv({ cls: "sss-status-pill" });

    if (this.isSyncing) {
      const { done, total } = this.syncProgress;
      pill.textContent = total > 0 ? `Syncing ${done} / ${total}` : "Syncing…";
    } else {
      pill.textContent = this.lastStatusText || "Up to date";
    }

    pill.style.top  = `${rect.top + rect.height / 2}px`;
    pill.style.left = `${rect.right + 10}px`;

    this.statusPillEl = pill;
    this.statusPillTimer = window.setTimeout(() => this.dismissStatusPill(), 4000);
  }

  /** Remove the floating status pill from the DOM. */
  private dismissStatusPill(): void {
    if (this.statusPillTimer !== undefined) {
      window.clearTimeout(this.statusPillTimer);
      this.statusPillTimer = undefined;
    }
    if (this.statusPillEl) {
      this.statusPillEl.remove();
      this.statusPillEl = undefined;
    }
  }

  // ── Mobile floating indicator ─────────────────────────────────────────────────────────

  /**
   * Inject the persistent circular indicator into the DOM.
   * Positioned just to the right of the sidebar toggle button in the
   * top-left corner of the mobile UI.
   *
   * Idle  → shows SSS logo, tap = manual sync.
   * Active → coloured dot + tap expands pill rightward.
   */
  private mountMobileIndicator(): void {
    if (this.mobileIndicatorEl) return; // already mounted

    const el = document.body.createDiv({ cls: "sss-mob-indicator sss-mob-idle" });

    // Inner SVG logo
    el.innerHTML = `<svg class="sss-mob-logo" viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="currentColor" d="
M46.63 93.84 c-7.49 -0.58 -14.72 -3.10 -21.04 -7.34 c-3.83 -2.57 -7.43 -5.94 -10.36 -9.69
c-4.58 -5.87 -7.70 -13.35 -8.63 -20.75 c-0.40 -3.15 -0.45 -7.81 -0.12 -10.79
c0.56 -4.91 2.00 -9.91 4.14 -14.26 c5.59 -11.34 15.58 -19.72 27.51 -23.10
c5.31 -1.49 10.77 -1.97 16.36 -1.42 c20.81 2.06 37.58 19.22 39.17 40.09
c0.17 2.29 0.07 7.24 -0.20 9.17 c-0.89 6.50 -2.66 11.64 -5.86 16.94
c-2.12 3.52 -4.85 6.88 -7.73 9.50 c-7.46 6.83 -16.67 10.88 -26.46 11.64
c-1.48 0.11 -5.31 0.11 -6.80 -0.01z
m6.76 -15.96 c8.81 -1.16 17.13 -6.82 20.49 -13.97 c1.13 -2.39 1.72 -5.12 1.57 -7.26
c-0.43 -6.08 -4.59 -11.60 -10.15 -13.45 c-2.50 -0.83 -4.51 -0.93 -6.85 -0.33
c-0.86 0.22 -2.01 0.65 -2.01 0.77 c0 0.04 0.10 0.15 0.21 0.25
c0.37 0.33 1.90 2.43 2.43 3.33 c1.15 1.95 1.46 2.61 1.46 3.13
c0 1.15 -0.24 1.13 -7.08 -0.63 c-2.95 -0.76 -6.97 -1.79 -8.94 -2.28
c-1.96 -0.50 -3.68 -0.96 -3.82 -1.04 c-0.32 -0.16 -0.38 -0.31 -0.38 -0.92
c0 -0.59 0.13 -0.75 1.50 -1.93 c5.07 -4.39 11.36 -7.02 18.13 -7.64
c1.66 -0.15 5.39 -0.12 6.94 0.05 c2.47 0.27 4.79 0.77 6.82 1.46
c0.55 0.19 1.00 0.32 1.00 0.29 c0 -0.02 -0.22 -0.49 -0.50 -1.02
c-1.78 -3.56 -4.91 -7.20 -8.20 -9.52 c-4.44 -3.15 -9.11 -4.82 -14.54 -5.21
c-2.89 -0.21 -6.55 0.28 -9.67 1.29 c-6.66 2.16 -12.16 6.70 -15.23 12.59
c-1.88 3.60 -2.64 7.63 -2.07 10.95 c0.72 4.19 2.88 7.66 6.28 10.09
c2.73 1.95 6.54 3.03 9.53 2.70 c0.96 -0.11 2.31 -0.36 2.49 -0.47
c0.04 -0.02 -0.08 -0.22 -0.26 -0.45 c-0.71 -0.88 -1.65 -2.38 -2.31 -3.68
c-0.62 -1.22 -0.68 -1.43 -0.68 -1.93 c0 -0.31 0.05 -0.62 0.12 -0.68
c0.30 -0.30 1.24 -0.14 6.72 1.25 c2.98 0.75 6.85 1.72 8.59 2.15
c1.75 0.43 3.27 0.83 3.40 0.88 c0.19 0.08 0.21 0.17 0.21 0.71
c0 0.59 -0.02 0.63 -0.36 0.97 c-1.12 1.06 -3.58 2.74 -5.44 3.74
c-3.75 1.98 -7.77 3.20 -11.86 3.57 c-1.70 0.16 -6.10 0.08 -7.64 -0.14
c-1.77 -0.25 -4.11 -0.81 -5.81 -1.38 c-0.86 -0.29 -1.57 -0.52 -1.58 -0.50
c-0.07 0.07 1.07 1.94 1.82 2.97 c4.61 6.46 12.22 10.72 20.42 11.44
c1.31 0.12 3.77 0.05 5.25 -0.14z
"/>
    </svg>`;

    el.addEventListener("click", () => this.handleMobileIndicatorClick());
    this.mobileIndicatorEl = el;
  }

  /**
   * Update the mobile indicator colour state.
   * Does nothing if the indicator isn’t mounted (desktop or toast mode).
   */
  private updateMobileIndicator(
    status: "idle" | "syncing" | "success" | "conflict" | "error"
  ): void {
    const el = this.mobileIndicatorEl;
    if (!el) return;

    if (this.mobileSuccessTimer !== undefined) {
      window.clearTimeout(this.mobileSuccessTimer);
      this.mobileSuccessTimer = undefined;
    }

    el.className = `sss-mob-indicator sss-mob-${status}`;

    if (status === "success") {
      this.mobileSuccessTimer = window.setTimeout(() => {
        this.updateMobileIndicator("idle");
      }, 3000);
    }
  }

  /**
   * Tap handler for the mobile indicator.
   * Idle  → trigger manual sync.
   * Active (syncing/error/conflict) → toggle the rightward pill.
   */
  private handleMobileIndicatorClick(): void {
    const cls = this.mobileIndicatorEl?.className ?? "";
    const isIdle = cls.includes("sss-mob-idle");

    if (isIdle) {
      this.triggerSync("manual");
      return;
    }

    // Toggle pill
    if (this.mobilePillExpanded) {
      this.collapseMobilePill();
    } else {
      this.expandMobilePill();
    }
  }

  private expandMobilePill(): void {
    if (!this.mobileIndicatorEl) return;
    this.collapseMobilePill(); // clear any existing

    const pill = document.body.createDiv({ cls: "sss-mob-pill" });

    if (this.isSyncing) {
      const { done, total } = this.syncProgress;
      pill.textContent = total > 0 ? `Syncing ${done} / ${total}` : "Syncing…";
    } else {
      pill.textContent = this.lastStatusText || "Up to date";
    }

    // Position pill to the right of the indicator
    const rect = this.mobileIndicatorEl.getBoundingClientRect();
    pill.style.top  = `${rect.top + rect.height / 2}px`;
    pill.style.left = `${rect.right + 6}px`;

    this.mobilePillEl      = pill;
    this.mobilePillExpanded = true;

    // Auto-collapse after 4 seconds if syncing is done
    if (!this.isSyncing) {
      this.mobilePillTimer = window.setTimeout(() => this.collapseMobilePill(), 4000);
    }
  }

  private collapseMobilePill(): void {
    if (this.mobilePillTimer !== undefined) {
      window.clearTimeout(this.mobilePillTimer);
      this.mobilePillTimer = undefined;
    }
    if (this.mobilePillEl) {
      this.mobilePillEl.addClass("sss-mob-pill-out");
      window.setTimeout(() => {
        this.mobilePillEl?.remove();
        this.mobilePillEl = undefined;
      }, 200);
    }
    this.mobilePillExpanded = false;
  }

  /** Remove the mobile indicator and pill entirely from the DOM. */
  private teardownMobileIndicator(): void {
    this.collapseMobilePill();
    if (this.mobileSuccessTimer !== undefined) {
      window.clearTimeout(this.mobileSuccessTimer);
      this.mobileSuccessTimer = undefined;
    }
    if (this.mobileIndicatorEl) {
      this.mobileIndicatorEl.remove();
      this.mobileIndicatorEl = undefined;
    }
  }
}
