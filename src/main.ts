/**
 * main.ts
 * Obsidian plugin entry point for Secure-Smart-Sync (SSS).
 */

import throttle from "lodash/throttle";
import { Notice, Plugin, type TAbstractFile, addIcon } from "obsidian";

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

export default class SSSPlugin extends Plugin {
  settings!: PluginSettings;

  private db!: InternalDB;
  private vaultId!: string;
  private logger!: PluginLogger;

  private statusBarEl?: HTMLElement;
  private autoSyncTimer?: ReturnType<typeof setInterval>;
  private isSyncing = false;

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

    addIcon(
      SYNC_ICON_ID,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="currentColor" d="M50 10 A40 40 0 0 1 90 50 H75 A25 25 0 0 0 50 25 Z"/>
        <path fill="currentColor" d="M50 90 A40 40 0 0 1 10 50 H25 A25 25 0 0 0 50 75 Z"/>
        <polygon fill="currentColor" points="85,35 95,50 75,50"/>
        <polygon fill="currentColor" points="15,65 5,50 25,50"/>
      </svg>`
    );

    if (this.settings.showStatusBar) {
      this.statusBarEl = this.addStatusBarItem();
      this.setStatus("idle");
    }

    this.addCommand({ id: "sss-sync-now", name: "Sync now", callback: () => this.triggerSync("manual") });
    this.addCommand({ id: "sss-sync-dry-run", name: "Dry run (show what would change)", callback: () => this.triggerSync("dry_run") });
    this.addCommand({ id: "sss-reset-sync-history", name: "Reset sync history (forces full re-sync)", callback: () => this.resetSyncHistory() });

    this.addRibbonIcon(SYNC_ICON_ID, "Secure-Smart-Sync", () => this.triggerSync("manual"));
    this.addSettingTab(new SSSSettingTab(this.app, this));
    this.scheduleAutoSync();
    this.registerOnSaveHandler();

    if (this.settings.initSyncDelayMs > 0) {
      window.setTimeout(() => this.triggerSync("init"), this.settings.initSyncDelayMs);
    }

    this.logger.info(`Plugin loaded. Vault ID: ${vaultId}`);
  }

  async onunload(): Promise<void> {
    this.clearAutoSync();
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
      new Notice("Secure-Smart-Sync: already syncing, please wait…");
      return;
    }

    const isDry = trigger === "dry_run";
    this.isSyncing = true;
    this.setStatus("syncing");
    new Notice(`Secure-Smart-Sync: ${isDry ? "dry run" : "syncing"}…`);

    try {
      const stats = await this.runSync(isDry);
      const summary = this.buildSummary(stats);
      new Notice(`Secure-Smart-Sync: ${summary}`);
      this.setStatus("idle");

      if (!isDry) {
        const now = Date.now();
        await setLastSuccessSync(this.db, this.vaultId, now);
        this.settings.lastSyncedAt = now;
        await this.saveSettings();
        await insertSyncHistoryEntry(this.db, this.vaultId, JSON.stringify(stats));
      }
    } catch (err) {
      const msg = toText(err);
      this.logger.error("Sync failed:", msg);
      new Notice(`Secure-Smart-Sync: failed – ${(err as Error).message}`);
      this.setStatus("error");
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
        this.setStatusText(`Syncing ${_done}/${_total}…`);
      },
    });

    // ── Update prevSync records ────────────────────────────────────────────────
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
    for (const task of tasks) {
      // Folders don't need prevSync records
      if (task.key.endsWith("/")) continue;

      const errored = stats.errors.some((e) => e.includes(task.key));

      // ── Deleted files ───────────────────────────────────────────────────────
      if (task.kind === "delete_local" || task.kind === "delete_remote") {
        if (!errored) await deletePrevSyncRecord(this.db, this.vaultId, task.key);
        continue;
      }

      // ── Skipped (too large, no_change, equal) ───────────────────────────────
      if (task.kind === "skip") {
        if (errored) continue;

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
        continue;
      }

      // ── Pushed / pulled files ───────────────────────────────────────────────
      if (errored) continue;

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
    }

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
    if (stats.filesDeleted)      parts.push(`✗${stats.filesDeleted}`);
    if (stats.conflictsResolved) parts.push(`⚡${stats.conflictsResolved} conflicts`);
    if (stats.errors.length)     parts.push(`⚠️ ${stats.errors.length} errors`);
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

    const doSync = throttle(() => this.triggerSync("on_save"), debounceMs, {
      leading: false,
      trailing: true,
    });

    this.registerEvent(
      this.app.vault.on("modify", (_file: TAbstractFile) => doSync())
    );
  }

  private setStatus(state: "idle" | "syncing" | "error"): void {
    if (!this.statusBarEl) return;
    const icons: Record<string, string> = { idle: "☁️", syncing: "🔄", error: "⚠️" };
    this.statusBarEl.setText(`${icons[state]} SSS`);
  }

  private setStatusText(text: string): void {
    this.statusBarEl?.setText(text);
  }
}
