// Global polyfill injected by esbuild into every module.
// Provides Buffer and process so that Node-style code works in the browser.
import { Buffer } from "buffer";
import process from "process/browser";

globalThis.Buffer = Buffer;
globalThis.process = process;
