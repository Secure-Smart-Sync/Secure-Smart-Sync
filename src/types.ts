/**
 * types.ts
 * Central type definitions for Secure-Smart-Sync (SSS).
 * Keeping all types flat and serialization-safe so they can be stored/compared easily.
 */

// ─── Storage Provider ───────────────────────────────────────────────────────

export interface R2Config {
  /** Cloudflare R2 endpoint, e.g. https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  /** R2 region – typically "auto" for Cloudflare */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Optional key prefix inside the bucket, e.g. "my-vault/" */
  remotePrefix?: string;
  /** Force path-style addressing (required for R2) */
  forcePathStyle?: boolean;
  /** Concurrent upload parts */
  partsConcurrency?: number;
  /** Store precise mtime in object metadata (costs extra HEAD requests) */
  useAccurateMTime?: boolean;
  /**
   * When true, upload a real zero-byte object for each folder.
   * R2 is a flat store so folders are normally synthesised from key prefixes.
   * Enabling this makes folders visible in the Cloudflare R2 dashboard.
   */
  generateFolderObject?: boolean;
}

export const DEFAULT_R2_CONFIG: R2Config = {
  endpoint: "",
  region: "auto",
  accessKeyId: "",
  secretAccessKey: "",
  bucketName: "",
  remotePrefix: "",
  forcePathStyle: true,   // R2 requires this
  partsConcurrency: 5,
  useAccurateMTime: false,
  generateFolderObject: false,
};

// ─── Encryption ─────────────────────────────────────────────────────────────

/**
 * openssl-base64: AES-CBC, OpenSSL-compatible, names encoded as base64url.
 * rclone-base64:  rclone-compatible Salsa20+Poly1305 (file names obfuscated).
 * none:           no encryption.
 */
export type EncryptionMethod = "openssl-base64" | "rclone-base64" | "none";

// ─── Sync behaviour ──────────────────────────────────────────────────────────

export type SyncDirection =
  | "bidirectional"
  | "push_only"
  | "pull_only";

export type ConflictResolution =
  | "keep_newer"
  | "keep_larger"
  | "keep_local"
  | "keep_remote";

export type DeleteBehaviour = "trash_local" | "trash_system" | "permanent";

// ─── File entity ─────────────────────────────────────────────────────────────

/**
 * Uniform representation of a file or folder on either side of the sync.
 * Everything is flat/primitive so values can be copied freely.
 */
export interface FileEntity {
  /** Decrypted, human-readable path (may differ from keyRaw when encrypted). */
  key?: string;
  /** Encrypted path as stored on remote (equals key when no encryption). */
  keyEnc?: string;
  /** Raw path as returned by the storage API. */
  keyRaw: string;

  // Client-side timestamps (milliseconds)
  mtimeCli?: number;
  ctimeCli?: number;
  // Server-side timestamps (milliseconds)
  mtimeSvr?: number;

  // Size of plaintext content (undefined until decrypted)
  size?: number;
  // Size of encrypted blob on remote
  sizeEnc?: number;
  // Raw size as returned by storage API
  sizeRaw: number;

  etag?: string;
  /** True when this folder entry is synthesised (S3 has no real folder objects) */
  synthesizedFolder?: boolean;
}

// ─── Sync decision types ─────────────────────────────────────────────────────

export type SyncDecision =
  | "equal"
  | "push_local"          // local → remote
  | "pull_remote"         // remote → local
  | "delete_remote"       // local deleted → delete remote copy
  | "delete_local"        // remote deleted → delete local copy
  | "conflict_keep_local"
  | "conflict_keep_remote"
  | "conflict_keep_newer"
  | "conflict_keep_larger"
  | "skip_too_large"
  | "folder_ensure_local"
  | "folder_ensure_remote"
  | "folder_delete_both"
  | "no_change"
  | "mkdir_remote"
  | "mkdir_local";

export interface MixedEntity {
  key: string;
  local?: FileEntity;
  prevSync?: FileEntity;
  remote?: FileEntity;

  decision?: SyncDecision;
  conflictResolution?: ConflictResolution;
  changed?: boolean;
  /** Debug / diagnostic notes – not used in logic */
  notes?: Record<string, unknown>;
}

// ─── Plugin settings ─────────────────────────────────────────────────────────

export interface PluginSettings {
  r2: R2Config;

  /** Master password for client-side encryption. Empty = no encryption. */
  encryptionPassword: string;
  encryptionMethod: EncryptionMethod;

  syncDirection: SyncDirection;
  conflictResolution: ConflictResolution;
  deleteBehaviour: DeleteBehaviour;

  /** Auto-sync interval in milliseconds. -1 = disabled. */
  autoSyncIntervalMs: number;
  /** Delay before first auto-sync after Obsidian starts, ms. -1 = disabled. */
  initSyncDelayMs: number;
  /** Debounce after file save before triggering sync, ms. -1 = disabled. */
  syncOnSaveDebounceMs: number;

  /** Max file size to sync in bytes. -1 = unlimited. */
  maxFileSizeBytes: number;

  /** Glob patterns to exclude from sync */
  ignorePaths: string[];

  /** Also sync .obsidian config directory */
  syncConfigDir: boolean;

  /** Show sync status in the status bar */
  showStatusBar: boolean;

  /** Log level for the browser console */
  logLevel: "debug" | "info" | "warn" | "error";

  /** Timestamp of last successful sync (ms since epoch). Displayed in settings UI. */
  lastSyncedAt?: number;

  /** Internal: randomly generated vault identifier (used as DB namespace) */
  _vaultId?: string;

  /** Internal: whether user accepted the sync algorithm notice */
  _acceptedSyncNotice?: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  r2: DEFAULT_R2_CONFIG,

  encryptionPassword: "",
  encryptionMethod: "openssl-base64",

  syncDirection: "bidirectional",
  conflictResolution: "keep_newer",
  deleteBehaviour: "trash_system",

  autoSyncIntervalMs: -1,
  initSyncDelayMs: -1,
  syncOnSaveDebounceMs: -1,

  maxFileSizeBytes: -1,
  ignorePaths: [],
  syncConfigDir: false,
  showStatusBar: true,
  logLevel: "info",
};

// ─── Sync trigger ─────────────────────────────────────────────────────────────

export type SyncTrigger = "manual" | "auto" | "on_save" | "init" | "dry_run";

// ─── Status ───────────────────────────────────────────────────────────────────

export type PluginStatus =
  | "idle"
  | "syncing"
  | "error"
  | "checking_password";

export interface SyncStats {
  filesUploaded: number;
  filesDownloaded: number;
  filesDeleted: number;
  filesSkipped: number;
  conflictsResolved: number;
  errors: string[];
  startedAt: number;
  finishedAt?: number;
}
