/**
 * storage-base.ts
 * Abstract base class for all storage backends.
 * Concrete implementations: StorageR2 (S3-compatible), StorageLocal.
 */

import type { FileEntity } from "./types";

export abstract class StorageBase {
  /** Human-readable identifier, e.g. "r2", "local" */
  abstract readonly kind: string;

  // ── Listing ─────────────────────────────────────────────────────────────────

  /**
   * Return all files and folders under the root.
   * Folders must end with "/" and have size 0.
   */
  abstract walk(): Promise<FileEntity[]>;

  /**
   * Quick partial listing (used for password validation probes).
   * May return a small subset of files.
   */
  abstract walkPartial(): Promise<FileEntity[]>;

  // ── Single-item ops ──────────────────────────────────────────────────────────

  abstract stat(key: string): Promise<FileEntity>;

  /**
   * Ensure a folder path exists.
   * key must end with "/".
   */
  abstract mkdir(key: string, mtime?: number, ctime?: number): Promise<FileEntity>;

  abstract writeFile(
    key: string,
    content: ArrayBuffer,
    mtime: number,
    ctime: number
  ): Promise<FileEntity>;

  abstract readFile(key: string): Promise<ArrayBuffer>;

  /**
   * Rename/move.  Not all backends support this; throw if unsupported.
   */
  abstract rename(srcKey: string, dstKey: string): Promise<void>;

  /**
   * Delete a file or empty folder.
   */
  abstract rm(key: string): Promise<void>;

  // ── Connectivity ─────────────────────────────────────────────────────────────

  /**
   * Verify the backend is reachable and credentials are valid.
   * @param onError Optional callback receiving the error for UI display.
   */
  abstract checkConnection(onError?: (err: unknown) => void): Promise<boolean>;

  /** Common post-connection checks (e.g. read/write probe). Subclasses may call this. */
  protected async checkConnectionCommon(
    onError?: (err: unknown) => void
  ): Promise<boolean> {
    try {
      const probe = "__sss_probe__/";
      await this.mkdir(probe);
      await this.rm(probe);
      return true;
    } catch (err) {
      if (onError) onError(err);
      return false;
    }
  }

  // ── Metadata ─────────────────────────────────────────────────────────────────

  /**
   * Returns a user-visible display name (e.g. bucket + prefix).
   * Return empty string if not applicable.
   */
  abstract getUserDisplayName(): Promise<string>;

  /** Some backends (local) always allow zero-byte files; others need 1 byte. */
  allowEmptyFile(): boolean {
    return true;
  }

  /** Release any long-lived resources (workers, open handles, etc.) */
  async closeResources(): Promise<void> {
    // default: nothing
  }
}
