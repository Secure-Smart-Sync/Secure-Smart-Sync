/**
 * sync-runner.ts
 * Orchestrates a single sync run: builds storage backends, walks local/remote,
 * executes tasks, updates prevSync records in the DB, and handles conflict ask.
 *
 * Extracted from main.ts to keep each module focused and testable.
 */

import PQueue from "p-queue";
import { Notice } from "obsidian";
import type { App } from "obsidian";

import {
  type InternalDB,
  getAllPrevSyncRecords,
  upsertPrevSyncRecord,
  deletePrevSyncRecord,
  clearAllPrevSyncRecords,
} from "./database";
import { PluginLogger } from "./logger";
import { StorageBase } from "./storage-base";
import { StorageEncrypt } from "./storage-encrypt";
import { StorageLocal } from "./storage-local";
import { StorageR2 } from "./storage-r2";
import { buildMixedEntities, buildTasks, executeTasks } from "./sync-engine";
import type { SyncTask } from "./sync-engine";
import { ConflictResolutionModal } from "./settings-tab";
import type { FileEntity, PluginSettings, SyncStats } from "./types";
import { toText } from "./utils";

const PLUGIN_ID = "Secure-Smart-Sync";

// ─── Public interface the plugin class depends on ────────────────────────────

export interface SyncRunnerDeps {
  app: App;
  db: InternalDB;
  vaultId: string;
  settings: PluginSettings;
  logger: PluginLogger;
  /** Callback to update the live progress display while tasks run. */
  onProgress: (done: number, total: number) => void;
}

// ─── runSync ─────────────────────────────────────────────────────────────────

/**
 * Execute a full sync cycle (or dry-run preview).
 *
 * @returns SyncStats — caller is responsible for recording history and
 *   triggering UI updates based on the result.
 */
export async function runSync(
  dryRun: boolean,
  deps: SyncRunnerDeps
): Promise<SyncStats> {
  const { app, db, vaultId, settings, logger, onProgress } = deps;

  if (!settings.r2.endpoint || !settings.r2.bucketName) {
    throw new Error("R2 endpoint or bucket name is not configured.");
  }

  const local: StorageBase = new StorageLocal({
    vault: app.vault,
    pluginId: PLUGIN_ID,
    configDir: app.vault.configDir,
    syncConfigDir: settings.syncConfigDir,
    deleteToWhere: settings.deleteBehaviour === "permanent"
      ? "permanent"
      : settings.deleteBehaviour === "trash_local" ? "obsidian" : "system",
    logger,
  });

  const rawRemote = new StorageR2(settings.r2);
  const remote: StorageBase = settings.encryptionPassword
    ? new StorageEncrypt(rawRemote, settings.encryptionPassword, settings.encryptionMethod)
    : rawRemote;

  // ── Fire all independent IO simultaneously to cut startup latency ───────────
  const connectionP = rawRemote.checkConnection((err) => {
    logger.error("R2 connection failed:", toText(err));
  });
  const localWalkP  = local.walk();
  const prevSyncP   = getAllPrevSyncRecords(db, vaultId);
  const remoteWalkP = remote.walk();

  const connected = await connectionP;
  if (!connected) {
    localWalkP.catch(() => {});
    remoteWalkP.catch(() => {});
    throw new Error("Cannot connect to R2. Check your credentials and endpoint.");
  }

  // Kick off password validation while walks are still in flight.
  let passwordCheckP: Promise<{ ok: boolean; reason?: string }> | undefined;
  if (settings.encryptionPassword && remote instanceof StorageEncrypt) {
    passwordCheckP = remote.validatePassword();
  }

  logger.info("Walking local, prevSync, remote…");
  const [localEntities, prevSyncEntities, remoteEntities] = await Promise.all([
    localWalkP, prevSyncP, remoteWalkP,
  ]);

  if (passwordCheckP) {
    const check = await passwordCheckP;
    if (!check.ok) {
      throw new Error(
        `Encryption password check failed: ${check.reason}. ` +
        "Your password may be wrong, or the remote uses a different encryption method."
      );
    }
  }

  logger.info(
    `Entities: local=${localEntities.length}, prev=${prevSyncEntities.length}, remote=${remoteEntities.length}`
  );

  const mixed = buildMixedEntities(localEntities, prevSyncEntities, remoteEntities, settings.ignorePaths);
  const tasks = buildTasks(mixed, settings);

  const actionable = tasks.filter((t) => t.kind !== "skip");
  logger.info(`Tasks: ${tasks.length} total, ${actionable.length} actionable`);

  if (dryRun) {
    const report = actionable.map((t) => `${t.kind}: ${t.key}`).join("\n");
    logger.info("Dry run plan:\n" + report);
    return {
      filesUploaded: 0, filesDownloaded: 0, filesDeleted: 0,
      filesSkipped: tasks.length, conflictsResolved: 0,
      errors: [], startedAt: Date.now(), finishedAt: Date.now(),
    };
  }

  const stats = await executeTasks({
    local,
    remote,
    tasks,
    concurrency: settings.r2.partsConcurrency ?? 8,
    logger,
    fallbackConflictResolution:
      settings.conflictResolution === "ask" || settings.conflictResolution === "keep_both"
        ? "keep_both"
        : settings.conflictResolution,
    onConflictAsk:
      settings.conflictAlwaysAsk || settings.conflictResolution === "ask"
        ? makeConflictAskHandler(app)
        : undefined,
    onProgress: (done, total, _key) => {
      onProgress(done, total);
    },
  });

  // ── Update prevSync records (parallel) ──────────────────────────────────────
  const erroredKeys = new Set<string>(
    stats.errors
      .map((e) => { const m = e.match(/^\[\w+\] (.+?): /); return m?.[1] ?? ""; })
      .filter(Boolean)
  );

  const prevSyncQueue = new PQueue({ concurrency: 12 });

  for (const task of tasks) {
    if (task.key.endsWith("/")) continue; // folders don't need prevSync records

    prevSyncQueue.add(async () => {
      const errored = erroredKeys.has(task.key);

      // Deleted files
      if (task.kind === "delete_local" || task.kind === "delete_remote") {
        if (!errored) await deletePrevSyncRecord(db, vaultId, task.key);
        return;
      }

      // Skipped (too large, no_change, equal)
      if (task.kind === "skip") {
        if (errored) return;
        if (
          (task.decision === "no_change" || task.decision === "equal") &&
          task.entity.local &&
          task.entity.remote
        ) {
          const prevRecord = task.entity.prevSync;
          const remoteEtag = task.entity.remote.etag;
          const needsWrite = !prevRecord || (!prevRecord.etag && !!remoteEtag);
          if (needsWrite) {
            await upsertPrevSyncRecord(db, vaultId, {
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

      // Pushed / pulled / keep_both files
      if (errored) return;

      try {
        const freshLocal = await local.stat(task.key);
        let remoteEtag: string | undefined = task.entity.remote?.etag;

        // For push/keep_both: the file was just uploaded — do a HEAD to get
        // its new ETag. For pull: the remote entity already carries the correct ETag.
        if (task.kind === "push" || task.kind === "keep_both") {
          try {
            const freshRemote = await remote.stat(task.key);
            remoteEtag = freshRemote.etag;
          } catch (e) {
            logger.warn(
              `[SSS] Could not stat remote after push for ${task.key} — ETag may not be stored:`,
              (e as Error).message
            );
          }
        }

        await upsertPrevSyncRecord(db, vaultId, {
          ...freshLocal,
          key:    task.key,
          keyRaw: task.key,
          ...(remoteEtag !== undefined ? { etag: remoteEtag } : {}),
        });
      } catch (err) {
        logger.warn(`[SSS] Failed to update prevSync for ${task.key}:`, (err as Error).message);
        const entity = (task.kind === "push" || task.kind === "keep_both")
          ? (task.entity.local ?? task.entity.remote)
          : (task.entity.remote ?? task.entity.local);
        if (entity) {
          await upsertPrevSyncRecord(db, vaultId, {
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

// ─── buildSummary ─────────────────────────────────────────────────────────────

export function buildSummary(stats: SyncStats): string {
  const parts: string[] = [];
  if (stats.filesUploaded)     parts.push(`↑${stats.filesUploaded}`);
  if (stats.filesDownloaded)   parts.push(`↓${stats.filesDownloaded}`);
  if (stats.filesDeleted)      parts.push(`×${stats.filesDeleted}`);
  if (stats.conflictsResolved) parts.push(`${stats.conflictsResolved} conflict${stats.conflictsResolved !== 1 ? "s" : ""}`);
  if (stats.errors.length)     parts.push(`${stats.errors.length} error${stats.errors.length !== 1 ? "s" : ""}`);
  return parts.length ? parts.join(", ") : "up to date";
}

// ─── resetSyncHistory ─────────────────────────────────────────────────────────

export async function resetSyncHistory(db: InternalDB, vaultId: string): Promise<void> {
  await clearAllPrevSyncRecords(db, vaultId);
  new Notice("Secure-Smart-Sync: sync history cleared. Next sync will do a full comparison.");
}

// ─── Conflict ask handler factory ─────────────────────────────────────────────

/**
 * Returns a stateful callback suitable for `executeTasks.onConflictAsk`.
 * Each call opens a ConflictResolutionModal and awaits the user's choice.
 * Counter starts at 0 for each sync run.
 */
function makeConflictAskHandler(
  app: App
): (task: SyncTask) => Promise<import("./types").ConflictResolution | "skip"> {
  let index = 0;
  return async (task: SyncTask) => {
    const modal = new ConflictResolutionModal(app, task, index, 0);
    index++;
    modal.open();
    return modal.result;
  };
}
