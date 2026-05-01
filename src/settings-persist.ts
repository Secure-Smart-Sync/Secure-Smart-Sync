/**
 * settings-persist.ts
 * Obfuscate/deobfuscate plugin settings when writing to data.json.
 *
 * We lightly obfuscate (base64url + reverse) to prevent casual secrets
 * exposure in screenshots, not for security (encryption is done client-side
 * on the actual vault files).
 */

import { base64url } from "rfc4648";
import { reverseString } from "./utils";
import type { PluginSettings } from "./types";

const README_NOTE =
  "This file contains API credentials. Do NOT share, screenshot, or commit it. " +
  "It is auto-generated – do not edit manually.";

interface PersistedConfig {
  readme: string;
  d: string;
}

type StoredConfig = PersistedConfig | PluginSettings | null | undefined;

export const decodeSettings = (raw: StoredConfig): PluginSettings | null | undefined => {
  if (raw === null || raw === undefined) return raw as any;
  if ("readme" in (raw as object) && "d" in (raw as object)) {
    const typed = raw as PersistedConfig;
    const json = (
      base64url.parse(reverseString(typed.d), {
        out: Buffer.allocUnsafe as any,
        loose: true,
      }) as Buffer
    ).toString("utf-8");
    return JSON.parse(json) as PluginSettings;
  }
  return raw as PluginSettings;
};

export const encodeSettings = (
  settings: PluginSettings | null | undefined
): PersistedConfig | null | undefined => {
  if (settings === null || settings === undefined) return settings as any;
  return {
    readme: README_NOTE,
    d: reverseString(
      base64url.stringify(Buffer.from(JSON.stringify(settings), "utf-8"), {
        pad: false,
      })
    ),
  };
};
