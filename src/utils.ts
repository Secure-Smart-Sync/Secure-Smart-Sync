/**
 * utils.ts
 * Pure utility functions with no Obsidian or plugin-specific dependencies.
 */

import * as path from "path";
import { base32, base64url } from "rfc4648";
import emojiRegex from "emoji-regex";
import XRegExp from "xregexp";
import type { Vault } from "obsidian";

// ─── Buffer / ArrayBuffer helpers ─────────────────────────────────────────────

export const bufferToArrayBuffer = (
  b: Buffer | Uint8Array | ArrayBufferView
): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

export const arrayBufferToBuffer = (b: ArrayBuffer): Buffer =>
  Buffer.from(b);

export const arrayBufferToBase64 = (b: ArrayBuffer): string =>
  arrayBufferToBuffer(b).toString("base64");

export const arrayBufferToHex = (b: ArrayBuffer): string =>
  arrayBufferToBuffer(b).toString("hex");

export const base64ToArrayBuffer = (s: string): ArrayBuffer =>
  bufferToArrayBuffer(Buffer.from(s, "base64"));

export const copyArrayBuffer = (src: ArrayBuffer): ArrayBuffer => {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
};

export const hexStringToTypedArray = (hex: string): Uint8Array => {
  const pairs = hex.match(/[\da-f]{2}/gi);
  if (!pairs) throw new Error(`Not a hex string: ${hex}`);
  return new Uint8Array(pairs.map((h) => parseInt(h, 16)));
};

export const base64ToBase64url = (a: string, pad = false): string => {
  let b = a.replace(/\+/g, "-").replace(/\//g, "_");
  if (!pad) b = b.replace(/=/g, "");
  return b;
};

// ─── String helpers ───────────────────────────────────────────────────────────

export const reverseString = (s: string): string => [...s].reverse().join("");

/**
 * Test whether a decrypted string contains only valid printable characters.
 * iOS Safari can "successfully" decrypt with a wrong key and produce gibberish.
 */
export const isValidText = (s: string): boolean => {
  if (s === undefined || s === null) return false;
  return !XRegExp("\\p{Cc}|\\p{Cf}|\\p{Co}|\\p{Cn}|\\p{Zl}|\\p{Zp}", "A").test(s);
};

export const hasEmoji = (s: string): boolean => emojiRegex().test(s);

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns all ancestor folder paths for a given file/folder path.
 * "a/b/c/d.txt" → ["a/", "a/b/", "a/b/c/"]
 * "a/b/c/"      → ["a/", "a/b/"]
 */
export const getFolderLevels = (x: string, addSlash = false): string[] => {
  if (!x || x === "/") return [];
  const parts = x.split("/");
  const result: string[] = [];
  for (let i = 0; i + 1 < parts.length; i++) {
    const segment = parts.slice(0, i + 1).join("/");
    if (!segment || segment === "/") continue;
    result.push(addSlash ? `${segment}/` : segment);
  }
  return result;
};

export const getParentFolder = (x: string): string => {
  const dir = path.posix.dirname(x);
  if (dir === "." || dir === "/") return "/";
  return dir.endsWith("/") ? dir : `${dir}/`;
};

export const isHiddenPath = (item: string, dot = true, underscore = true): boolean => {
  const segments = path.posix.normalize(item).split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") continue;
    if (dot && seg[0] === ".") return true;
    if (underscore && seg[0] === "_") return true;
  }
  return false;
};

// ─── Vault helpers ────────────────────────────────────────────────────────────

export const mkdirpInVault = async (thePath: string, vault: Vault): Promise<void> => {
  for (const folder of getFolderLevels(thePath)) {
    if (!(await vault.adapter.exists(folder))) {
      await vault.adapter.mkdir(folder);
    }
  }
};

export const statFix = async (vault: Vault, filePath: string) => {
  const s = await vault.adapter.stat(filePath);
  if (!s) throw new Error(`Path not found: ${filePath}`);
  if (!s.ctime || isNaN(s.ctime)) (s as any).ctime = undefined;
  if (!s.mtime || isNaN(s.mtime)) (s as any).mtime = undefined;
  if ((!s.size || isNaN(s.size)) && s.type === "folder") s.size = 0;
  return s;
};

// ─── Time helpers ─────────────────────────────────────────────────────────────

declare global {
  interface Window {
    moment: (...args: any[]) => any;
  }
}

export const unixTimeToStr = (ms: number | undefined | null): string | undefined => {
  if (ms === undefined || ms === null || isNaN(ms)) return undefined;
  return window.moment(ms).format() as string;
};

// ─── Skip-list ────────────────────────────────────────────────────────────────

const ALWAYS_SKIP = new Set([
  ".git", ".github", ".gitlab", ".svn",
  "node_modules", ".DS_Store", "__MACOSX",
  "Icon\r", "desktop.ini", "Desktop.ini",
  "thumbs.db", "Thumbs.db",
]);

/** Microsoft Office lock files, e.g. ~$document.docx */
const MS_LOCK_SUFFIX = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"];

export const isSpecialFolderNameToSkip = (
  x: string,
  extra: string[] = []
): boolean => {
  for (const special of [...ALWAYS_SKIP, ...extra]) {
    if (x === special || x === `${special}/` ||
        x.endsWith(`/${special}`) || x.endsWith(`/${special}/`)) {
      return true;
    }
  }
  const filename = x.split("/").pop() ?? "";
  if (filename.startsWith("~$")) {
    for (const ext of MS_LOCK_SUFFIX) {
      if (filename.endsWith(`.${ext}`)) return true;
    }
  }
  return false;
};

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export const compareVersions = (
  a: string | null | undefined,
  b: string | null | undefined
): -1 | 0 | 1 => {
  if (!a) return -1;
  if (!b) return 1;
  if (a === b) return 0;
  const parse = (v: string) => v.split(".").map(Number);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 > b1 ? 1 : -1;
  if (a2 !== b2) return a2 > b2 ? 1 : -1;
  if (a3 !== b3) return a3 > b3 ? 1 : -1;
  return 0;
};

export const toText = (x: unknown): string => {
  if (x === undefined || x === null) return `${x}`;
  if (typeof x === "string") return x;
  if (x instanceof Error) return `${x.message}\n${x.stack ?? ""}`;
  try {
    return JSON.stringify(x, null, 2) ?? `${x}`;
  } catch {
    return `${x}`;
  }
};

export const roughObjectSize = (obj: unknown): number => {
  const seen: unknown[] = [];
  const stack = [obj];
  let bytes = 0;
  while (stack.length) {
    const val = stack.pop();
    switch (typeof val) {
      case "boolean": bytes += 4; break;
      case "string":  bytes += val.length * 2; break;
      case "number":  bytes += 8; break;
      case "object":
        if (val && !seen.includes(val)) {
          seen.push(val);
          Object.values(val as object).forEach((v) => stack.push(v));
        }
        break;
    }
  }
  return bytes;
};
