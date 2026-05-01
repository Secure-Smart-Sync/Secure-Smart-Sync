/**
 * sync-copy.ts
 * Low-level helpers for copying files/folders between two StorageBase instances.
 */

import type { StorageBase } from "./storage-base";

export async function copyFolder(
  key: string,
  src: StorageBase,
  dst: StorageBase
): Promise<void> {
  if (!key.endsWith("/")) throw new Error(`copyFolder called with non-folder key: ${key}`);
  const stat = await src.stat(key);
  await dst.mkdir(key, stat.mtimeCli, stat.ctimeCli);
}

export async function copyFile(
  key: string,
  src: StorageBase,
  dst: StorageBase
): Promise<void> {
  if (key.endsWith("/")) throw new Error(`copyFile called with folder key: ${key}`);

  const stat = await src.stat(key);
  const content = await src.readFile(key);

  // Size mismatch guard.
  // For encrypted sources, stat.size is undefined (plaintext size unknown
  // until after decryption), so we skip validation in that case.
  // We only check when both the stat size and the read content size are
  // known, non-zero, and disagree.
  if (
    stat.size !== undefined &&
    stat.size > 0 &&
    content.byteLength > 0 &&
    stat.size !== content.byteLength
  ) {
    throw new Error(
      `Size mismatch copying ${src.kind}→${dst.kind} [${key}]: stat=${stat.size} actual=${content.byteLength}`
    );
  }

  if (stat.mtimeCli === undefined) {
    throw new Error(`No mtimeCli for ${src.kind} [${key}]`);
  }

  await dst.writeFile(
    key,
    content,
    stat.mtimeCli,
    stat.ctimeCli ?? stat.mtimeCli
  );
}

export async function copyFileOrFolder(
  key: string,
  src: StorageBase,
  dst: StorageBase
): Promise<void> {
  if (key.endsWith("/")) {
    return copyFolder(key, src, dst);
  }
  return copyFile(key, src, dst);
}
