/**
 * sync-engine.ts
 * Core sync decision engine for Secure-Smart-Sync (SSS).
 *
 * Algorithm:
 *  For each unique file key across local / prevSync / remote:
 *    - Determine what changed since last sync
 *    - Choose a SyncDecision
 *    - Return an ordered list of SyncTasks to execute
 *
 * Design goals:
 *  - Works on first sync with zero prevSync cache — falls back to "both exist,
 *    no history" logic and resolves via the configured ConflictResolution.
 *  - Deterministic and idempotent — running it twice produces the same plan.
 *  - Conflict copy preservation — the losing side of a conflict is backed up
 *    as `<name>.conflict-YYYY-MM-DD.<ext>` before being overwritten.
 *  - Retry logic — each task is retried up to MAX_RETRIES times with
 *    exponential back-off before being recorded as an error.
 *  - ignorePaths — glob patterns from settings are applied before planning.
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
import { delay } from "./utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

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

// ─── ignorePaths matching ─────────────────────────────────────────────────────

/**
 * Returns true if the key matches any of the ignore glob patterns.
 *
 * Supports:
 *   - Exact match:      "daily/2024-01-01.md"
 *   - Prefix wildcard:  "*.tmp"   (matches "foo.tmp", "bar.tmp")
 *   - Directory prefix: "archive/" (matches anything under archive/)
 *   - Double-star glob: "**\/node_modules\/**"
 *
 * We deliberately keep this light (no heavy glob library) to avoid adding
 * a dependency.  Patterns are matched case-sensitively.
 */
export function matchesIgnorePath(key: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  for (const raw of patterns) {
    const p = raw.trim();
    if (!p || p.startsWith("#")) continue;

    // Simple exact match
    if (p === key) return true;

    // Directory prefix: "archive/" → matches "archive/foo.md" etc.
    if (p.endsWith("/") && key.startsWith(p)) return true;

    // Convert glob pattern to regex
    const regexStr = p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex special chars
      .replace(/\*\*/g, "\u0000")            // placeholder for **
      .replace(/\*/g, "[^/]*")              // * → match within segment
      .replace(/\u0000/g, ".*");            // ** → match across segments

    if (new RegExp(`^${regexStr}$`).test(key)) return true;
  }
  return false;
}

// ─── Decision engine ──────────────────────────────────────────────────────────

/**
 * Build the complete list of mixed entities from three snapshots.
 */
export function buildMixedEntities(
  localEntities: FileEntity[],
  prevSyncEntities: FileEntity[],
  remoteEntities: FileEntity[],
  ignorePaths: string[] = []
): MixedEntity[] {
  const map = new Map<string, MixedEntity>();

  const add = (side: "local" | "prevSync" | "remote", entity: FileEntity) => {
    const key = entity.key ?? entity.keyRaw;
    // Apply ignore patterns at entity-building time so ignored files never
    // appear in the task list at all.
    if (matchesIgnorePath(key, ignorePaths)) return;
    if (!map.has(key)) map.set(key, { key });
    map.get(key)![side] = entity;
  };

  for (const e of localEntities)   add("local",    e);
  for (const e of prevSyncEntities) add("prevSync", e);
  for (const e of remoteEntities)   add("remote",   e);

  return Array.from(map.values());
}

/**
 * Given a MixedEntity, choose what to do.
 *
 * The key insight for cache-less (first-time) sync:
 *   When prevSync is absent for a file that exists on both sides, we treat
 *   it as a conflict and let ConflictResolution decide.  When it only exists
 *   on one side, we push/pull it unconditionally (safe: no data loss possible).
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
      return direction === "pull_only" ? "no_change" : "mkdir_remote";
    }
    if (!local && remote) {
      return direction === "push_only" ? "no_change" : "mkdir_local";
    }
    return "no_change";
  }

  // ── Size guard ───────────────────────────────────────────────────────────────
  const tooLarge = (e: FileEntity | undefined) =>
    maxFileSizeBytes > 0 && e?.size !== undefined && e.size > maxFileSizeBytes;

  if (tooLarge(local) || tooLarge(remote)) return "skip_too_large";

  // ── Both absent ──────────────────────────────────────────────────────────────
  if (!local && !remote) return "no_change";

  // ── No prevSync cache (first sync or after history reset) ────────────────────
  if (!prevSync) {
    // Only one side has it → safe to transfer without conflict
    if (local && !remote) {
      return direction === "pull_only" ? "no_change" : "push_local";
    }
    if (!local && remote) {
      return direction === "push_only" ? "no_change" : "pull_remote";
    }
    // Both sides have it with no history → resolve as conflict
    return resolveConflict(local!, remote!, conflict, direction);
  }

  // ── Deletion on one or both sides ─────────────────────────────────────────────
  const localDeleted  = !local  && !!prevSync;
  const remoteDeleted = !remote && !!prevSync;

  if (localDeleted && remoteDeleted) return "no_change";

  if (localDeleted && !remoteDeleted) {
    const remoteChanged = isChanged(remote!, prevSync);
    if (remoteChanged) {
      // Remote was edited after we deleted locally → pull it back
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
  const localChanged  = isChanged(local!,  prevSync);
  const remoteChanged = isChanged(remote!, prevSync);

  if (!localChanged && !remoteChanged) return "no_change";
  if ( localChanged && !remoteChanged) return direction !== "pull_only"  ? "push_local"  : "no_change";
  if (!localChanged &&  remoteChanged) return direction !== "push_only"  ? "pull_remote" : "no_change";

  // Both changed → conflict
  return resolveConflict(local!, remote!, conflict, direction);
}

function isChanged(current: FileEntity, prev: FileEntity): boolean {
  // Size comparison: treat both-undefined as equal, but if only one side
  // has a value, consider it changed.
  const curSize = current.size ?? current.sizeRaw;
  const prevSize = prev.size ?? prev.sizeRaw;
  if (curSize !== undefined && prevSize !== undefined && curSize !== prevSize) return true;

  // ETag comparison (only if both sides have one)
  if (current.etag && prev.etag && current.etag !== prev.etag) return true;

  // Mtime comparison with 1-second tolerance (FAT32, S3 etc.)
  const curTime = current.mtimeCli ?? 0;
  const prevTime = prev.mtimeCli ?? 0;
  // If both are 0 (unknown), skip mtime comparison
  if (curTime === 0 && prevTime === 0) return false;
  const timeDiff = Math.abs(curTime - prevTime);
  return timeDiff > 1000;
}

function resolveConflict(
  local: FileEntity,
  remote: FileEntity,
  resolution: ConflictResolution,
  direction: SyncDirection
): SyncDecision {
  if (direction === "push_only") return "conflict_keep_local";
  if (direction === "pull_only") return "conflict_keep_remote";

  switch (resolution) {
    case "keep_local":  return "conflict_keep_local";
    case "keep_remote": return "conflict_keep_remote";
    case "keep_newer": {
      const localT  = local.mtimeCli ?? 0;
      const remoteT = remote.mtimeCli ?? remote.mtimeSvr ?? 0;
      return localT >= remoteT ? "conflict_keep_local" : "conflict_keep_remote";
    }
    case "keep_larger": {
      const localS  = local.size ?? 0;
      const remoteS = remote.size ?? 0;
      return localS >= remoteS ? "conflict_keep_local" : "conflict_keep_remote";
    }
  }
}

// ─── Task builder ─────────────────────────────────────────────────────────────

export function buildTasks(
  mixed: MixedEntity[],
  settings: Pick<PluginSettings, "syncDirection" | "conflictResolution" | "maxFileSizeBytes" | "ignorePaths">
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

  // Folders first (parents before children), then files; alphabetical within each group
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
    case "conflict_keep_local":  return "push";
    case "pull_remote":
    case "conflict_keep_remote": return "pull";
    case "delete_remote":        return "delete_remote";
    case "delete_local":         return "delete_local";
    case "mkdir_local":          return "mkdir_local";
    case "mkdir_remote":         return "mkdir_remote";
    default:                     return "skip";
  }
}

// ─── Conflict copy helpers ────────────────────────────────────────────────────

/**
 * Derive a backup path for the losing side of a conflict.
 * "notes/foo.md" → "notes/foo.conflict-2024-05-01.md"
 * "image.png"    → "image.conflict-2024-05-01.png"
 * "noext"        → "noext.conflict-2024-05-01"
 */
export function conflictBackupKey(key: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const lastDot = key.lastIndexOf(".");
  const lastSlash = key.lastIndexOf("/");
  if (lastDot > lastSlash && lastDot !== -1) {
    // Has extension
    return `${key.slice(0, lastDot)}.conflict-${date}${key.slice(lastDot)}`;
  }
  return `${key}.conflict-${date}`;
}

/**
 * Save the losing side of a conflict as a backup file before overwriting.
 * If saving the backup fails, we log a warning but don't abort the sync.
 */
async function saveConflictBackup(
  task: SyncTask,
  local: StorageBase,
  remote: StorageBase,
  logger?: PluginLogger
): Promise<void> {
  const { key, decision } = task;
  // Only save backup for true conflict decisions (not plain push/pull)
  if (decision !== "conflict_keep_local" && decision !== "conflict_keep_remote") return;

  const backupKey = conflictBackupKey(key);

  try {
    if (decision === "conflict_keep_local") {
      // Remote loses → back up remote copy locally
      const content = await remote.readFile(key);
      const remoteStat = task.entity.remote;
      const mtime = remoteStat?.mtimeCli ?? remoteStat?.mtimeSvr ?? Date.now();
      await local.writeFile(backupKey, content, mtime, mtime);
      logger?.info(`[sss] Conflict backup saved locally: ${backupKey}`);
    } else {
      // Local loses → back up local copy to remote
      const content = await local.readFile(key);
      const localStat = task.entity.local;
      const mtime = localStat?.mtimeCli ?? Date.now();
      await remote.writeFile(backupKey, content, mtime, mtime);
      logger?.info(`[sss] Conflict backup saved remotely: ${backupKey}`);
    }
  } catch (err) {
    // Non-fatal: backup failure should not abort the sync
    logger?.warn(`[sss] Could not save conflict backup for ${key}:`, (err as Error).message);
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
        let lastErr: Error | undefined;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
              logger?.warn(`[sss] Retrying ${task.kind} ${task.key} (attempt ${attempt + 1})…`);
              await delay(wait);
            }
            await executeTask(task, local, remote, stats, logger);
            lastErr = undefined;
            break;
          } catch (err) {
            lastErr = err as Error;
          }
        }
        if (lastErr) {
          const msg = `[${task.kind}] ${task.key}: ${lastErr.message}`;
          stats.errors.push(msg);
          logger?.error(msg);
        }
        done++;
        onProgress?.(done, actionable.length, task.key);
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
  logger?.debug(`[sss] ${kind} ${key} (${decision})`);

  switch (kind) {
    case "push":
      if (decision.startsWith("conflict")) {
        await saveConflictBackup(task, local, remote, logger);
        stats.conflictsResolved++;
      } else {
        stats.filesUploaded++;
      }
      await copyFileOrFolder(key, local, remote);
      break;

    case "pull":
      if (decision.startsWith("conflict")) {
        await saveConflictBackup(task, local, remote, logger);
        stats.conflictsResolved++;
      } else {
        stats.filesDownloaded++;
      }
      await copyFileOrFolder(key, remote, local);
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
