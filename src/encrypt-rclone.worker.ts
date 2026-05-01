/**
 * encrypt-rclone.worker.ts
 * Web Worker that performs rclone-compatible Salsa20+Poly1305 encryption
 * off the main thread. Communication via MessageChannel ports.
 *
 * This file is intentionally kept close to the original – it is correct,
 * well-tested, and the worker protocol is stable.
 */

import { Cipher as CipherRCloneCryptPack } from "@fyears/rclone-crypt";
import { nanoid } from "nanoid";

const ctx: WorkerGlobalScope = self as any;
const workerId = nanoid(6);
const cipher = new CipherRCloneCryptPack("base64");

async function encryptName(input: string): Promise<string> {
  return cipher.encryptFileName(input);
}

async function decryptName(input: string): Promise<string> {
  return cipher.decryptFileName(input);
}

async function encryptContent(input: ArrayBuffer): Promise<ArrayBuffer> {
  return (await cipher.encryptData(new Uint8Array(input), undefined)).buffer;
}

async function decryptContent(input: ArrayBuffer): Promise<ArrayBuffer> {
  return (await cipher.decryptData(new Uint8Array(input))).buffer;
}

ctx.addEventListener("message", async (event: any) => {
  const port: MessagePort = event.ports[0];
  const { action, dataKeyBuf, nameKeyBuf, nameTweakBuf, inputName, inputContent } =
    event.data as {
      action: "prepare" | "encryptName" | "decryptName" | "encryptContent" | "decryptContent";
      dataKeyBuf?: ArrayBuffer;
      nameKeyBuf?: ArrayBuffer;
      nameTweakBuf?: ArrayBuffer;
      inputName?: string;
      inputContent?: ArrayBuffer;
    };

  try {
    switch (action) {
      case "prepare": {
        if (!dataKeyBuf || !nameKeyBuf || !nameTweakBuf) {
          throw new Error(`[worker ${workerId}] prepare: missing key buffers`);
        }
        cipher.updateInternalKey(
          new Uint8Array(dataKeyBuf),
          new Uint8Array(nameKeyBuf),
          new Uint8Array(nameTweakBuf)
        );
        port.postMessage({ status: "ok" });
        break;
      }

      case "encryptName": {
        if (inputName === undefined) throw new Error("encryptName: no inputName");
        port.postMessage({ status: "ok", outputName: await encryptName(inputName) });
        break;
      }

      case "decryptName": {
        if (inputName === undefined) throw new Error("decryptName: no inputName");
        port.postMessage({ status: "ok", outputName: await decryptName(inputName) });
        break;
      }

      case "encryptContent": {
        if (inputContent === undefined) throw new Error("encryptContent: no inputContent");
        const out = await encryptContent(inputContent);
        port.postMessage({ status: "ok", outputContent: out }, [out]);
        break;
      }

      case "decryptContent": {
        if (inputContent === undefined) throw new Error("decryptContent: no inputContent");
        const out = await decryptContent(inputContent);
        port.postMessage({ status: "ok", outputContent: out }, [out]);
        break;
      }

      default:
        throw new Error(`[worker ${workerId}] unknown action: ${action}`);
    }
  } catch (err) {
    console.error(`[worker ${workerId}] error in action=${action}:`, err);
    port.postMessage({ status: "error", error: String(err) });
  }
});
