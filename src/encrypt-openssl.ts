/**
 * encrypt-openssl.ts
 * AES-CBC encryption/decryption compatible with OpenSSL's EVP_BytesToKey.
 *
 * File format: "Salted__" (8 bytes) + salt (8 bytes) + ciphertext
 * Key derivation: PBKDF2-SHA256, 20 000 iterations → 256-bit key + 128-bit IV
 */

import { base32, base64url } from "rfc4648";
import { bufferToArrayBuffer, hexStringToTypedArray } from "./utils";

export const MAGIC_PREFIX_BASE32    = "KNQWY5DFMRPV"; // base32('Salted__')
export const MAGIC_PREFIX_BASE64URL = "U2FsdGVkX";    // base64('Salted__')

const DEFAULT_ITERATIONS = 20_000;
const PREFIX = new TextEncoder().encode("Salted__"); // 8 bytes

// ─── Key derivation ───────────────────────────────────────────────────────────

async function deriveKeyAndIV(
  salt: Uint8Array,
  password: string,
  iterations: number
): Promise<{ key: ArrayBuffer; iv: ArrayBuffer }> {
  const rawKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    rawKey,
    256 + 128  // 32 bytes key + 16 bytes IV
  );
  return { key: bits.slice(0, 32), iv: bits.slice(32, 48) };
}

// ─── Content encryption ───────────────────────────────────────────────────────

export const encryptArrayBuffer = async (
  plain: ArrayBuffer,
  password: string,
  iterations = DEFAULT_ITERATIONS,
  saltHex = ""
): Promise<ArrayBuffer> => {
  const salt = saltHex
    ? hexStringToTypedArray(saltHex)
    : crypto.getRandomValues(new Uint8Array(8));

  const { key, iv } = await deriveKeyAndIV(salt, password, iterations);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, plain);

  const result = new Uint8Array(PREFIX.length + 8 + ciphertext.byteLength);
  result.set(PREFIX, 0);
  result.set(salt, PREFIX.length);
  result.set(new Uint8Array(ciphertext), PREFIX.length + 8);
  return bufferToArrayBuffer(result);
};

export const decryptArrayBuffer = async (
  enc: ArrayBuffer,
  password: string,
  iterations = DEFAULT_ITERATIONS
): Promise<ArrayBuffer> => {
  const salt = new Uint8Array(enc.slice(8, 16));
  const { key, iv } = await deriveKeyAndIV(salt, password, iterations);
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, enc.slice(16));
};

// ─── Name encryption (string → base64url) ─────────────────────────────────────

export const encryptStringToBase64url = async (
  text: string,
  password: string,
  iterations = DEFAULT_ITERATIONS,
  saltHex = ""
): Promise<string> => {
  const enc = await encryptArrayBuffer(
    bufferToArrayBuffer(new TextEncoder().encode(text)),
    password,
    iterations,
    saltHex
  );
  return base64url.stringify(new Uint8Array(enc), { pad: false });
};

export const decryptBase64urlToString = async (
  text: string,
  password: string,
  iterations = DEFAULT_ITERATIONS
): Promise<string> => {
  const buf = bufferToArrayBuffer(base64url.parse(text, { loose: true }));
  return new TextDecoder().decode(await decryptArrayBuffer(buf, password, iterations));
};

export const decryptBase32ToString = async (
  text: string,
  password: string,
  iterations = DEFAULT_ITERATIONS
): Promise<string> => {
  const buf = bufferToArrayBuffer(base32.parse(text, { loose: true }));
  return new TextDecoder().decode(await decryptArrayBuffer(buf, password, iterations));
};

// ─── Size estimation ──────────────────────────────────────────────────────────

/**
 * AES-CBC pads to 16-byte blocks.
 * Encrypted size = 8 (prefix) + 8 (salt) + ceil(plainSize/16)*16 + 16 (pad block)
 */
export const getSizeFromOrigToEnc = (plainSize: number): number => {
  if (plainSize < 0 || !Number.isInteger(plainSize)) {
    throw new Error(`getSizeFromOrigToEnc: invalid size ${plainSize}`);
  }
  return (Math.floor(plainSize / 16) + 1) * 16 + 16;
};
