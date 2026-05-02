/**
 * sync-engine.ts
 * Core sync decision engine for Secure-Smart-Sync (SSS).
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

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ─── Sync task ────────────────────────────────────────────────────────────────

export type TaskKind =
  | "push"
  | "pull"
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

export function matchesIgnorePath(key: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  for (const raw of patterns) {
    const p = raw.trim();
    if (!p || p.startsWith("#")) continue;
    if (p === key) return true;
    if (p.endsWith("/") && key.startsWith(p)) return true;
    const regexStr = p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\u0000/g, ".*");
    if (new RegExp(`^${regexStr}$`).test(key)) return true;
  }
  return false;
}

// ─── Decision engine ──────────────────────────────────────────────────────────

export function buildMixedEntities(
  localEntities: FileEntity[],
  prevSyncEntities: FileEntity[],
  remoteEntities: FileEntity[],
  ignorePaths: string[] = []
): MixedEntity[] {
  const map = new Map<string, MixedEntity>();

  const add = (side: "local" | "prevSync" | "remote", entity: FileEntity) => {
    const key = entity.key ?? entity.keyRaw;
    if (matchesIgnorePath(key, ignorePaths)) return;
    if (!map.has(key)) map.set(key, { key });
    map.get(key)![side] = entity;
  };

  for (const e of localEntities)    add("local",    e);
  for (const e of prevSyncEntities) add("prevSync", e);
  for (const e of remoteEntities)   add("remote",   e);

  return Array.from(map.values());
}

export function decideAction(
  entity: MixedEntity,
  direction: SyncDirection,
  conflict: ConflictResolution,
  maxFileSizeBytes: number
): SyncDecision {
  const { local, prevSync, remote } = entity;
  const key = entity.key;
  const isFolder = key.endsWith("/");

  if (isFolder) {
    if (local && remote) return "no_change";
    if (local && !remote) return direction === "pull_only" ? "no_change" : "mkdir_remote";
    if (!local && remote) return direction === "push_only" ? "no_change" : "mkdir_local";
    return "no_change";
  }

  const tooLarge = (e: FileEntity | undefined) =>
    maxFileSizeBytes > 0 && e?.size !== undefined && e.size > maxFileSizeBytes;
  if (tooLarge(local) || tooLarge(remote)) return "skip_too_large";

  if (!local && !remote) return "no_change";

  if (!prevSync) {
    if (local && !remote) return direction === "pull_only" ? "no_change" : "push_local";
    if (!local && remote) return direction === "push_only" ? "no_change" : "pull_remote";
    return resolveConflict(local!, remote!, conflict, direction);
  }

  const localDeleted  = !local  && !!prevSync;
  const remoteDeleted = !remote && !!prevSync;

  if (localDeleted && remoteDeleted) return "no_change";

  if (localDeleted && !remoteDeleted) {
    return isChanged(remote!, prevSync)
      ? (direction !== "push_only" ? "pull_remote" : "no_change")
      : (direction !== "pull_only" ? "delete_remote" : "no_change");
  }

  if (remoteDeleted && !localDeleted) {
    return isChanged(local!, prevSync)
      ? (direction !== "pull_only" ? "push_local" : "no_change")
      : (direction !== "push_only" ? "delete_local" : "no_change");
  }

  const localChanged  = isChanged(local!,  prevSync);
  const remoteChanged = isChanged(remote!, prevSync);

  if (!localChanged && !remoteChanged) return "no_change";
  if ( localChanged && !remoteChanged) return direction !== "pull_only" ? "push_local"  : "no_change";
  if (!localChanged &&  remoteChanged) return direction !== "push_only" ? "pull_remote" : "no_change";

  return resolveConflict(local!, remote!, conflict, direction);
}

/**
 * Determine whether a file has changed since the last sync.
 *
 * Priority of comparisons (most reliable first):
 *
 * 1. ETag  — S3 always returns one. If both sides have an ETag, it is
 *            definitive: match → unchanged, differ → changed.
 *            This is the key fix for encrypted remotes and repeated syncs:
 *            - Encrypted remote entities have size=undefined (plaintext
 *              unknown) and mtimeCli=upload-time (not original mtime), so
 *            both size and mtime comparisons would give wrong results.
 *            - With ETag, we bypass both those unreliable fields entirely.
 *
 * 2. Plaintext size — only compared when both entities have a defined `size`
 *            (not sizeRaw which may be the encrypted-blob size).
 *
 * 3. Mtime  — last resort, 1-second tolerance for FAT32 / S3 rounding.
 */
function isChanged(current: FileEntity, prev: FileEntity): boolean {
  // ── ETag (definitive) ─────────────────────────────────────────────────────
  if (current.etag && prev.etag) {
    return current.etag !== prev.etag;
  }

  // ── Plaintext size ────────────────────────────────────────────────────────
  // Use `.size`, not `.sizeRaw`, to avoid comparing encrypted vs plaintext.
  if (current.size !== undefined && prev.size !== undefined && current.size !== prev.size) {
    return true;
  }

  // ── Mtime (1-second tolerance) ────────────────────────────────────────────
  const curTime  = current.mtimeCli ?? 0;
  const prevTime = prev.mtimeCli    ?? 0;
  if (curTime === 0 && prevTime === 0) return false;
  return Math.abs(curTime - prevTime) > 1000;
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
      const lt = local.mtimeCli ?? 0;
      const rt = remote.mtimeCli ?? remote.mtimeSvr ?? 0;
      return lt >= rt ? "conflict_keep_local" : "conflict_keep_remote";
    }
    case "keep_larger": {
      const ls = local.size ?? 0;
      const rs = remote.size ?? 0;
      return ls >= rs ? "conflict_keep_local" : "conflict_keep_remote";
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
    const decision = decideAction(entity, syncDirection, conflictResolution, maxFileSizeBytes);
    entity.decision = decision;
    entity.changed = decision !== "no_change" && decision !== "skip_too_large" && decision !== "equal";
    tasks.push({ key: entity.key, kind: decisionToTaskKind(decision), decision, entity });
  }

  tasks.sort((a, b) => {
    const af = a.key.endsWith("/") ? 0 : 1;
    const bf = b.key.endsWith("/") ? 0 : 1;
    if (af !== bf) return af - bf;
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

export function conflictBackupKey(key: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const lastDot   = key.lastIndexOf(".");
  const lastSlash = key.lastIndexOf("/");
  if (lastDot > lastSlash && lastDot !== -1) {
    return `${key.slice(0, lastDot)}.conflict-${date}${key.slice(lastDot)}`;
  }
  return `${key}.conflict-${date}`;
}

async function saveConflictBackup(
  task: SyncTask,
  local: StorageBase,
  remote: StorageBase,
  logger?: PluginLogger
): Promise<void> {
  const { key, decision } = task;
  if (decision !== "conflict_keep_local" && decision !== "conflict_keep_remote") return;

  const backupKey = conflictBackupKey(key);
  try {
    if (decision === "conflict_keep_local") {
      const content = await remote.readFile(key);
      const mtime = task.entity.remote?.mtimeCli ?? task.entity.remote?.mtimeSvr ?? Date.now();
      await local.writeFile(backupKey, content, mtime, mtime);
      logger?.info(`[SSS] Conflict backup saved locally: ${backupKey}`);
    } else {
      const content = await local.readFile(key);
      const mtime = task.entity.local?.mtimeCli ?? Date.now();
      await remote.writeFile(backupKey, content, mtime, mtime);
      logger?.info(`[SSS] Conflict backup saved remotely: ${backupKey}`);
    }
  } catch (err) {
    logger?.warn(`[SSS] Could not save conflict backup for ${key}:`, (err as Error).message);
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
    filesUploaded: 0, filesDownloaded: 0, filesDeleted: 0,
    filesSkipped: 0, conflictsResolved: 0, errors: [], startedAt: Date.now(),
  };

  const actionable = tasks.filter((t) => t.kind !== "skip");
  let done = 0;

  for (let i = 0; i < actionable.length; i += concurrency) {
    const batch = actionable.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (task) => {
        let lastErr: Error | undefined;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              logger?.warn(`[SSS] Retrying ${task.kind} ${task.key} (attempt ${attempt + 1})…`);
              await delay(RETRY_BASE_MS * Math.pow(2, attempt - 1));
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
  logger?.debug(`[SSS] ${kind} ${key} (${decision})`);

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
