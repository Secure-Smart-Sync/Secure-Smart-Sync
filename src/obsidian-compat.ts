/**
 * obsidian-compat.ts
 * Obsidian API version checks and compatibility shims.
 */

import { Platform, requireApiVersion } from "obsidian";

// Minimum API versions for various features
const VER_STAT_FOLDER  = "0.13.27";
const VER_REQURL       = "0.13.26"; // desktop
const VER_REQURL_DROID = "0.14.6";  // Android
export const VER_ALWAYS_REQURL = "1.0.0";

/**
 * True when Obsidian's requestUrl() is safe to use for authenticated S3 calls.
 * On Android the version threshold is higher due to a bug in earlier builds.
 */
export const VALID_OBSIDIAN_REQURL =
  (!Platform.isAndroidApp && requireApiVersion(VER_REQURL)) ||
  (Platform.isAndroidApp && requireApiVersion(VER_REQURL_DROID));
