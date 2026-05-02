/**
 * credentials-transfer.ts
 * Serialise / deserialise the credential bundle used for QR-code device setup.
 *
 * The bundle covers only the fields needed to connect to R2 and decrypt files.
 * Sync behaviour settings (auto-sync interval, conflict resolution, etc.) are
 * per-device preferences and are intentionally excluded.
 *
 * Format: JSON → base64, embedded in a QR code or pasted as plain text.
 *
 * Note: the `qrcode` npm package must be installed for QR generation to work:
 *   npm install qrcode @types/qrcode
 */

import type { PluginSettings } from "./types";

const BUNDLE_VERSION = 1;

interface CredentialBundle {
  v:          number;
  endpoint:   string;
  region:     string;
  bucket:     string;
  key:        string;  // accessKeyId
  secret:     string;  // secretAccessKey
  prefix:     string;  // remotePrefix
  encPass:    string;  // encryptionPassword
  encMethod:  string;  // encryptionMethod
}

/**
 * Serialise the connection-critical fields of settings into a compact base64
 * string suitable for embedding in a QR code or pasting as text.
 */
export function exportCredentialBundle(settings: PluginSettings): string {
  const bundle: CredentialBundle = {
    v:         BUNDLE_VERSION,
    endpoint:  settings.r2.endpoint,
    region:    settings.r2.region,
    bucket:    settings.r2.bucketName,
    key:       settings.r2.accessKeyId,
    secret:    settings.r2.secretAccessKey,
    prefix:    settings.r2.remotePrefix ?? "",
    encPass:   settings.encryptionPassword,
    encMethod: settings.encryptionMethod,
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(bundle))));
}

/**
 * Deserialise a base64 credential bundle (from QR scan or paste).
 * Returns the fields that should be merged into the current plugin settings.
 * Throws a descriptive Error if the bundle is malformed or from an incompatible version.
 */
export function importCredentialBundle(
  raw: string
): Pick<PluginSettings, "r2" | "encryptionPassword" | "encryptionMethod"> {
  let bundle: CredentialBundle;
  try {
    bundle = JSON.parse(decodeURIComponent(escape(atob(raw.trim())))) as CredentialBundle;
  } catch {
    throw new Error(
      "Not a valid credential bundle. Make sure you copied the complete text without any extra characters."
    );
  }

  if (typeof bundle !== "object" || bundle === null) {
    throw new Error("Bundle is not a valid JSON object.");
  }

  if (bundle.v !== BUNDLE_VERSION) {
    throw new Error(
      `Unsupported bundle version (${bundle.v}). Update the SSS plugin on both devices to the same version.`
    );
  }

  if (!bundle.endpoint || !bundle.bucket || !bundle.key || !bundle.secret) {
    throw new Error(
      "Bundle is missing required fields (endpoint, bucket, key, secret). It may be truncated or corrupted."
    );
  }

  return {
    r2: {
      endpoint:             bundle.endpoint,
      region:               bundle.region  ?? "auto",
      bucketName:           bundle.bucket,
      accessKeyId:          bundle.key,
      secretAccessKey:      bundle.secret,
      remotePrefix:         bundle.prefix  ?? "",
      forcePathStyle:       true,
      partsConcurrency:     5,
      useAccurateMTime:     false,
      generateFolderObject: false,
    },
    encryptionPassword: bundle.encPass   ?? "",
    encryptionMethod:  (bundle.encMethod ?? "openssl-base64") as PluginSettings["encryptionMethod"],
  };
}
