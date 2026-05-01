/**
 * sync-engine.ts
 * Core three-way sync decision engine.
 *
 * Algorithm:
 *  For each unique file key across local / prevSync / remote:
 *    - Determine what changed since last sync
 *    - Choose a SyncDecision
 *    - Return an ordered list of SyncTasks to execute
 *
 * Design goals:
 *  - "Set it and forget it" reliability: deterministic, idempotent decisions.
 *  - Handles all real-life edge cases: conflicts, deletions on both sides,
 *    renames (treated as delete + create), size explosions, empty files.
 *  - No implicit state – every decision is derived from the three snapshots.
 */

import type {
  ConflictResolution,
  FileEntity,
  MixedEntity,
  PluginSettings,
  SyncDecision,
  SyncDirection,
  SyncStats,
} from "./types";
import type { StorageBase } from "./storage-base";
import { copyFileOrFolder } from "./sync-copy";
import type { PluginLogger } from "./logger";

// ─── Sync task ────────────────────────────────────────────────────────────────

export type TaskKind =
  | "push"          // local → remote
  | "pull"          // remote → local
  | "delete_remote"
  | "delete_local"
  | "mkdir_local"
  | "mkdir_remote"
  | "skip";

export interface SyncTask {
  key: string;
  kind: TaskKind;
  decision: SyncDecision;
  entity: MixedEntity;
}

// ─── Decision engine ──────────────────────────────────────────────────────────

/**
 * Build the complete list of mixed entities from three snapshots.
 */
export function buildMixedEntities(
  localEntities: FileEntity[],
  prevSyncEntities: FileEntity[],
  remoteEntities: FileEntity[]
): MixedEntity[] {
  const map = new Map<string, MixedEntity>();

  const add = (side: "local" | "prevSync" | "remote", entity: FileEntity) => {
    const key = entity.key ?? entity.keyRaw;
    if (!map.has(key)) map.set(key, { key });
    map.get(key)![side] = entity;
  };

  for (const e of localEntities) add("local", e);
  for (const e of prevSyncEntities) add("prevSync", e);
  for (const e of remoteEntities) add("remote", e);

  return Array.from(map.values());
}

/**
 * Given a MixedEntity, choose what to do.
 */
export function decideAction(
  entity: MixedEntity,
  direction: SyncDirection,
  conflict: ConflictResolution,
  maxFileSizeBytes: number
): SyncDecision {
  const { local, prevSync, remote } = entity;
  const key = entity.key;
  const isFolder = key.endsWith("/");

  // ── Folder handling ──────────────────────────────────────────────────────────
  if (isFolder) {
    if (local && remote) return "no_change";
    if (local && !remote) {
      return direction === "pull_only" ? "no_change" : "mkdir_remote" as SyncDecision;
    }
    if (!local && remote) {
      return direction === "push_only" ? "no_change" : "mkdir_local" as SyncDecision;
    }
    // Both deleted → nothing to do
    return "no_change";
  }

  // ── Size guard ───────────────────────────────────────────────────────────────
  const tooLarge = (e: FileEntity | undefined) =>
    maxFileSizeBytes > 0 && e?.size !== undefined && e.size > maxFileSizeBytes;

  if (tooLarge(local) || tooLarge(remote)) return "skip_too_large";

  // ── Both absent (shouldn't happen but guard anyway) ───────────────────────────
  if (!local && !remote) return "no_change";

  // ── New file on one side ─────────────────────────────────────────────────────
  if (!prevSync) {
    if (local && !remote) {
      return direction === "pull_only" ? "no_change" : "push_local";
    }
    if (!local && remote) {
      return direction === "push_only" ? "no_change" : "pull_remote";
    }
    // Both sides have it with no sync history → conflict
    return resolveConflict(local!, remote!, conflict, direction);
  }

  // ── Deletion on one or both sides ─────────────────────────────────────────────
  const localDeleted = !local && prevSync;
  const remoteDeleted = !remote && prevSync;

  if (localDeleted && remoteDeleted) return "no_change";

  if (localDeleted && !remoteDeleted) {
    const remoteChanged = isChanged(remote!, prevSync);
    if (remoteChanged) {
      // Remote was edited after we deleted locally → pull wins
      return direction !== "push_only" ? "pull_remote" : "no_change";
    }
    return direction !== "pull_only" ? "delete_remote" : "no_change";
  }

  if (remoteDeleted && !localDeleted) {
    const localChanged = isChanged(local!, prevSync);
    if (localChanged) {
      // Local was edited after remote deletion → push wins
      return direction !== "pull_only" ? "push_local" : "no_change";
    }
    return direction !== "push_only" ? "delete_local" : "no_change";
  }

  // ── Both sides still exist ────────────────────────────────────────────────────
  const localChanged = isChanged(local!, prevSync);
  const remoteChanged = isChanged(remote!, prevSync);

  if (!localChanged && !remoteChanged) return "no_change";

  if (localChanged && !remoteChanged) {
    return direction !== "pull_only" ? "push_local" : "no_change";
  }

  if (!localChanged && remoteChanged) {
    return direction !== "push_only" ? "pull_remote" : "no_change";
  }

  // Both changed → conflict
  return resolveConflict(local!, remote!, conflict, direction);
}

function isChanged(current: FileEntity, prev: FileEntity): boolean {
  if (current.size !== prev.size) return true;
  if (current.etag && prev.etag && current.etag !== prev.etag) return true;
  const timeDiff = Math.abs((current.mtimeCli ?? 0) - (prev.mtimeCli ?? 0));
  return timeDiff > 1000; // ignore sub-second differences (FAT32, etc.)
}

function resolveConflict(
  local: FileEntity,
  remote: FileEntity,
  resolution: ConflictResolution,
  direction: SyncDirection
): SyncDecision {
  if (direction === "push_only") return "push_local";
  if (direction === "pull_only") return "pull_remote";

  switch (resolution) {
    case "keep_local":  return "conflict_keep_local";
    case "keep_remote": return "conflict_keep_remote";
    case "keep_newer": {
      const localT = local.mtimeCli ?? 0;
      const remoteT = remote.mtimeCli ?? remote.mtimeSvr ?? 0;
      return localT >= remoteT ? "conflict_keep_local" : "conflict_keep_remote";
    }
    case "keep_larger": {
      const localS = local.size ?? 0;
      const remoteS = remote.size ?? 0;
      return localS >= remoteS ? "conflict_keep_local" : "conflict_keep_remote";
    }
  }
}

// ─── Task builder ─────────────────────────────────────────────────────────────

export function buildTasks(
  mixed: MixedEntity[],
  settings: Pick<PluginSettings, "syncDirection" | "conflictResolution" | "maxFileSizeBytes">
): SyncTask[] {
  const tasks: SyncTask[] = [];
  const { syncDirection, conflictResolution, maxFileSizeBytes } = settings;

  for (const entity of mixed) {
    const decision = decideAction(
      entity,
      syncDirection,
      conflictResolution,
      maxFileSizeBytes
    );
    entity.decision = decision;
    entity.changed = decision !== "no_change" && decision !== "skip_too_large" && decision !== "equal";

    const kind = decisionToTaskKind(decision);
    tasks.push({ key: entity.key, kind, decision, entity });
  }

  // Sort: folders first (ensure parents exist before children), then files
  tasks.sort((a, b) => {
    const aFolder = a.key.endsWith("/") ? 0 : 1;
    const bFolder = b.key.endsWith("/") ? 0 : 1;
    if (aFolder !== bFolder) return aFolder - bFolder;
    return a.key.localeCompare(b.key);
  });

  return tasks;
}

function decisionToTaskKind(d: SyncDecision): TaskKind {
  switch (d) {
    case "push_local":
    case "conflict_keep_local": return "push";
    case "pull_remote":
    case "conflict_keep_remote": return "pull";
    case "delete_remote": return "delete_remote";
    case "delete_local": return "delete_local";
    case "mkdir_local": return "mkdir_local";
    case "mkdir_remote": return "mkdir_remote";
    default: return "skip";
  }
}

// ─── Task executor ────────────────────────────────────────────────────────────

export interface ExecuteOptions {
  local: StorageBase;
  remote: StorageBase;
  tasks: SyncTask[];
  concurrency?: number;
  logger?: PluginLogger;
  onProgress?: (done: number, total: number, key: string) => void;
}

export async function executeTasks(opts: ExecuteOptions): Promise<SyncStats> {
  const { local, remote, tasks, concurrency = 5, logger, onProgress } = opts;
  const stats: SyncStats = {
    filesUploaded: 0,
    filesDownloaded: 0,
    filesDeleted: 0,
    filesSkipped: 0,
    conflictsResolved: 0,
    errors: [],
    startedAt: Date.now(),
  };

  const actionable = tasks.filter((t) => t.kind !== "skip");
  let done = 0;

  // Process in batches of `concurrency`
  for (let i = 0; i < actionable.length; i += concurrency) {
    const batch = actionable.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (task) => {
        try {
          await executeTask(task, local, remote, stats, logger);
        } catch (err) {
          const msg = `[${task.kind}] ${task.key}: ${(err as Error).message}`;
          stats.errors.push(msg);
          logger?.error(msg);
        } finally {
          done++;
          onProgress?.(done, actionable.length, task.key);
        }
      })
    );
  }

  stats.filesSkipped = tasks.length - actionable.length;
  stats.finishedAt = Date.now();
  return stats;
}

async function executeTask(
  task: SyncTask,
  local: StorageBase,
  remote: StorageBase,
  stats: SyncStats,
  logger?: PluginLogger
): Promise<void> {
  const { key, kind, decision } = task;
  logger?.debug(`[sync] ${kind} ${key} (${decision})`);

  switch (kind) {
    case "push":
      await copyFileOrFolder(key, local, remote);
      if (decision.startsWith("conflict")) stats.conflictsResolved++;
      else stats.filesUploaded++;
      break;

    case "pull":
      await copyFileOrFolder(key, remote, local);
      if (decision.startsWith("conflict")) stats.conflictsResolved++;
      else stats.filesDownloaded++;
      break;

    case "delete_remote":
      await remote.rm(key);
      stats.filesDeleted++;
      break;

    case "delete_local":
      await local.rm(key);
      stats.filesDeleted++;
      break;

    case "mkdir_remote":
      await remote.mkdir(key);
      break;

    case "mkdir_local":
      await local.mkdir(key);
      break;
  }
}
