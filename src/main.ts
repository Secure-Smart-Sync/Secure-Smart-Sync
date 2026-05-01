/**
 * main.ts
 * Obsidian plugin entry point for Secure-Smart-Sync (SSS).
 *
 * Responsibilities:
 *  - Register plugin lifecycle (onload / onunload)
 *  - Load & save settings
 *  - Build storage stack (local → encrypt → R2)
 *  - Trigger sync (manual, auto-interval, on-save debounce)
 *  - Update status bar
 *  - Register settings tab
 */

import throttle from "lodash/throttle";
import { Notice, Plugin, type TAbstractFile, addIcon } from "obsidian";

import {
  type InternalDB,
  destroyDB,
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
  type PluginSettings,
  type SyncStats,
  type SyncTrigger,
} from "./types";
import { toText } from "./utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLUGIN_ID = "Secure-Smart-Sync";
const SYNC_ICON_ID = "sss-sync-icon";

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class SSSPlugin extends Plugin {
  settings!: PluginSettings;

  private db!: InternalDB;
  private vaultId!: string;
  private logger!: PluginLogger;

  private statusBarEl?: HTMLElement;
  private autoSyncTimer?: ReturnType<typeof setInterval>;
  private isSyncing = false;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async onload(): Promise<void> {
    this.logger = new PluginLogger("[SSS]");

    // Load settings
    await this.loadSettings();
    this.logger.setLevel(this.settings.logLevel);

    // Prepare DB
    const { db, vaultId } = await prepareDB(
      this.app.vault.adapter.getBasePath?.() ?? this.app.vault.getName(),
      this.settings._vaultId
    );
    this.db = db;
    this.vaultId = vaultId;

    // Store version for migration tracking
    await setPluginVersion(db, vaultId, this.manifest.version);

    // Register sync icon
    addIcon(
      SYNC_ICON_ID,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path fill="currentColor" d="M50 10 A40 40 0 0 1 90 50 H75 A25 25 0 0 0 50 25 Z"/>
        <path fill="currentColor" d="M50 90 A40 40 0 0 1 10 50 H25 A25 25 0 0 0 50 75 Z"/>
        <polygon fill="currentColor" points="85,35 95,50 75,50"/>
        <polygon fill="currentColor" points="15,65 5,50 25,50"/>
      </svg>`
    );

    // Status bar
    if (this.settings.showStatusBar) {
      this.statusBarEl = this.addStatusBarItem();
      this.setStatus("idle");
    }

    // Commands
    this.addCommand({
      id: "sss-sync-now",
      name: "Sync now",
      callback: () => this.triggerSync("manual"),
    });

    this.addCommand({
      id: "sss-sync-dry-run",
      name: "Dry run (show what would change)",
      callback: () => this.triggerSync("dry_run"),
    });

    this.addCommand({
      id: "sss-reset-sync-history",
      name: "Reset sync history (forces full re-sync)",
      callback: () => this.resetSyncHistory(),
    });

    // Ribbon icon
    this.addRibbonIcon(SYNC_ICON_ID, "Secure-Smart-Sync", () => this.triggerSync("manual"));

    // Settings tab
    this.addSettingTab(new SSSSettingTab(this.app, this));

    // Auto-sync interval
    this.scheduleAutoSync();

    // Sync-on-save
    this.registerOnSaveHandler();

    // Initial sync after startup delay
    if (this.settings.initSyncDelayMs > 0) {
      window.setTimeout(
        () => this.triggerSync("init"),
        this.settings.initSyncDelayMs
      );
    }

    this.logger.info(`Plugin loaded. Vault ID: ${vaultId}`);
  }

  async onunload(): Promise<void> {
    this.clearAutoSync();
    this.logger.info("Plugin unloaded.");
  }

  // ── Settings ────────────────────────────────────────────────────────────────

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

  // ── Sync ────────────────────────────────────────────────────────────────────

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

    // Validate config
    if (!settings.r2.endpoint || !settings.r2.bucketName) {
      throw new Error("R2 endpoint or bucket name is not configured.");
    }

    // Build storage stack
    //
    // IMPORTANT: Only the remote side is wrapped with encryption.
    // Local files are always plaintext on disk — wrapping local with
    // StorageEncrypt would cause plaintext file names to be fed into
    // the decryptor, which is the root cause of the
    // "Not an openssl-encrypted name" error.
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

    // Connectivity check — use the unwrapped remote so we don't
    // need encryption to be valid just to test the connection.
    const rawForCheck = remote instanceof StorageEncrypt ? rawRemote : remote;
    const connected = await rawForCheck.checkConnection((err) => {
      this.logger.error("R2 connection failed:", toText(err));
    });
    if (!connected) throw new Error("Cannot connect to R2. Check your credentials and endpoint.");

    // Password validation (quick probe)
    if (settings.encryptionPassword && remote instanceof StorageEncrypt) {
      const check = await remote.validatePassword();
      if (!check.ok) {
        throw new Error(
          `Encryption password check failed: ${check.reason}. ` +
          "Your password may be wrong, or the remote uses a different encryption method."
        );
      }
    }

    // Walk all three sources
    this.logger.info("Walking local, prevSync, remote…");
    const [localEntities, prevSyncEntities, remoteEntities] = await Promise.all([
      local.walk(),
      getAllPrevSyncRecords(this.db, this.vaultId),
      remote.walk(),
    ]);

    this.logger.info(
      `Entities: local=${localEntities.length}, prev=${prevSyncEntities.length}, remote=${remoteEntities.length}`
    );

    // Build sync plan — ignorePaths is applied inside buildMixedEntities
    const mixed = buildMixedEntities(
      localEntities,
      prevSyncEntities,
      remoteEntities,
      settings.ignorePaths
    );
    const tasks = buildTasks(mixed, settings);

    const actionable = tasks.filter((t) => t.kind !== "skip");
    this.logger.info(`Tasks: ${tasks.length} total, ${actionable.length} actionable`);

    if (dryRun) {
      const report = actionable.map((t) => `${t.kind}: ${t.key}`).join("\n");
      this.logger.info("Dry run plan:\n" + report);
      return {
        filesUploaded: 0,
        filesDownloaded: 0,
        filesDeleted: 0,
        filesSkipped: tasks.length,
        conflictsResolved: 0,
        errors: [],
        startedAt: Date.now(),
        finishedAt: Date.now(),
      };
    }

    // Execute
    const stats = await executeTasks({
      local,
      remote,
      tasks,
      concurrency: settings.r2.partsConcurrency ?? 5,
      logger: this.logger,
      onProgress: (_done, _total, _key) => {
        this.setStatusText(`Syncing ${_done}/${_total}…`);
      },
    });

    // Update prevSync records.
    // We re-stat the destination after the operation to capture the ACTUAL
    // post-write metadata (mtime, size, etag) — storing the pre-operation
    // snapshot would cause every file to appear "changed" on the next sync.
    for (const task of tasks) {
      if (task.kind === "skip") continue;

      // Skip tasks that errored — don't update prevSync for them
      if (stats.errors.some((e) => e.includes(task.key))) continue;

      if (task.kind === "delete_local" || task.kind === "delete_remote") {
        await deletePrevSyncRecord(this.db, this.vaultId, task.key);
        continue;
      }

      // For push/pull/conflict tasks, capture the state AFTER the operation.
      // The "source of truth" is the local file — since local is always
      // plaintext, we can stat it reliably without encryption concerns.
      try {
        const freshLocal = await local.stat(task.key);
        await upsertPrevSyncRecord(this.db, this.vaultId, {
          ...freshLocal,
          key: task.key,
          keyRaw: task.key,
        });
      } catch {
        // Fallback: if stat fails (e.g. file was a delete + re-pull race),
        // use the original entity
        const entity = task.entity.local ?? task.entity.remote;
        if (entity) {
          await upsertPrevSyncRecord(this.db, this.vaultId, {
            ...entity,
            key: task.key,
          });
        }
      }
    }

    // Cleanup rclone workers
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

  // ── Auto-sync ────────────────────────────────────────────────────────────────

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

  // ── On-save ──────────────────────────────────────────────────────────────────

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

  // ── Status bar ───────────────────────────────────────────────────────────────

  private setStatus(state: "idle" | "syncing" | "error"): void {
    if (!this.statusBarEl) return;
    const icons: Record<string, string> = {
      idle:    "☁️",
      syncing: "🔄",
      error:   "⚠️",
    };
    this.statusBarEl.setText(`${icons[state]} SSS`);
  }

  private setStatusText(text: string): void {
    this.statusBarEl?.setText(text);
  }
}
