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

// SSS logo — derived from icon_black_transparent.svg, scaled to 100×100 viewBox.
// The original path is 2048×2048; we wrap it in a transform scale(100/2048).
const SSS_LOGO_SVG = `<g transform="scale(0.04882)">
  <path fill="currentColor" d="M955 1921.80 c-153.40 -11.80 -301.40 -63.40 -431 -150.40 -78.40 -52.60 -152.20 -121.60 -212.20 -198.40 -93.80 -120.20 -157.60 -273.40 -176.60 -425 -8.20 -64.40 -9.20 -160 -2.40 -221 11.40 -100.60 41 -203 84.80 -292 114.40 -232.20 319 -403.80 563.40 -472.80 108.80 -30.60 220.60 -40.40 335 -29 426.20 42.20 769.60 393.60 802.20 821 3.40 46.80 1.40 148.20 -4 187.80 -18.20 133.20 -54.40 238.40 -120 347 -43.40 72 -99.40 140.80 -158.20 194.60 -152.80 139.80 -341.40 222.80 -541.80 238.40 -30.20 2.20 -108.80 2.20 -139.20 -0.20z m138.40 -326.80 c180.40 -23.80 350.80 -139.60 419.60 -286 23.20 -49 35.20 -104.80 32.20 -148.60 -8.80 -124.60 -94 -237.60 -207.80 -275.40 -51.20 -17 -92.40 -19 -140.20 -6.80 -17.60 4.60 -41.20 13.40 -41.20 15.80 0 0.80 2 3 4.20 5.20 7.60 6.80 39 49.80 49.80 68.20 23.60 39.80 30 53.40 30 64 0 23.60 -5 23.20 -145 -12.80 -60.40 -15.60 -142.80 -36.60 -183 -46.60 -40.20 -10.20 -75.40 -19.60 -78.20 -21.20 -6.60 -3.20 -7.80 -6.40 -7.80 -18.80 0 -12 2.60 -15.40 30.80 -39.60 103.80 -89.80 232.60 -143.80 371.20 -156.40 34 -3 110.40 -2.40 142 1 50.60 5.60 98 15.80 139.60 29.80 11.20 3.80 20.40 6.60 20.40 6 0 -0.40 -4.60 -10 -10.20 -21 -36.40 -72.80 -100.60 -147.40 -168 -195 -91 -64.60 -186.60 -98.80 -297.80 -106.80 -59.20 -4.20 -134.20 5.80 -198 26.40 -136.40 44.20 -249 137.20 -311.80 257.80 -38.40 73.80 -54 156.20 -42.40 224.20 14.80 85.80 59 156.80 128.60 206.60 55.80 40 134 62 195.20 55.20 19.60 -2.20 47.20 -7.40 51 -9.60 0.80 -0.40 -1.60 -4.60 -5.40 -9.20 -14.60 -18 -33.80 -48.80 -47.20 -75.40 -12.60 -25 -14 -29.20 -14 -39.60 0 -6.40 1 -12.60 2.40 -14 6.20 -6.20 25.40 -2.80 137.60 25.60 61 15.40 140.20 35.20 176 44 35.80 8.80 67 17 69.60 18 3.80 1.60 4.40 3.40 4.40 14.60 0 12 -0.40 13 -7.40 19.80 -23 21.80 -73.20 56.20 -111.40 76.60 -76.80 40.60 -159.20 65.40 -242.80 73 -34.80 3.20 -125 1.60 -156.40 -2.80 -36.20 -5.20 -84.20 -16.60 -119 -28.20 -17.60 -6 -32.20 -10.60 -32.40 -10.20 -1.40 1.40 22 39.80 37.20 60.80 94.40 132.20 250.20 219.40 418.20 234.20 26.80 2.40 77.20 1 107.40 -2.80z"/>
</g>`;

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

    addIcon(SYNC_ICON_ID, SSS_LOGO_SVG);

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
