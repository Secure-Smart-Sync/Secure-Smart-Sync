/**
 * encrypt-rclone.ts
 * rclone-compatible encryption using Salsa20+Poly1305.
 * Delegates actual crypto to a Web Worker to avoid blocking the main thread.
 *
 * Re-exports the original CipherRclone class with minor naming updates.
 * The worker file (encrypt-rclone.worker.ts) is unchanged.
 */

import { Cipher as CipherRCloneCryptPack, encryptedSize } from "@fyears/rclone-crypt";
// @ts-ignore – worker-loader produces a constructor, not a module
import EncryptWorker from "./encrypt-rclone.worker";

export const getSizeFromOrigToEnc = encryptedSize;

interface WorkerMessage {
  status: "ok" | "error";
  outputName?: string;
  outputContent?: ArrayBuffer;
  error?: unknown;
}

export class CipherRclone {
  private readonly password: string;
  private readonly cipher: CipherRCloneCryptPack;
  private readonly workers: Worker[];
  private initialised = false;
  private workerIdx = 0;

  constructor(password: string, workerCount = 5) {
    this.password = password;
    this.cipher = new CipherRCloneCryptPack("base64");
    this.workers = Array.from({ length: workerCount }, () => new (EncryptWorker as any)() as Worker);
  }

  closeResources(): void {
    this.workers.forEach((w) => w.terminate());
  }

  private async ensureInitialised(): Promise<void> {
    if (this.initialised) return;
    await this.cipher.key(this.password, "");
    await Promise.all(
      this.workers.map(
        (worker) =>
          new Promise<void>((resolve, reject) => {
            const channel = new MessageChannel();
            channel.port2.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
              data.status === "ok" ? resolve() : reject(new Error("Worker init failed"));
            };
            channel.port2.onmessageerror = reject;
            worker.postMessage(
              {
                action: "prepare",
                dataKeyBuf: this.cipher.dataKey.buffer,
                nameKeyBuf: this.cipher.nameKey.buffer,
                nameTweakBuf: this.cipher.nameTweak.buffer,
              },
              [channel.port1]
            );
          })
      )
    );
    this.initialised = true;
  }

  private nextWorker(): Worker {
    return this.workers[++this.workerIdx % this.workers.length];
  }

  private sendToWorker<T>(
    msg: object,
    extract: (data: WorkerMessage) => T | undefined
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port2.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (data.status === "error") {
          reject(new Error("Worker encryption error"));
          return;
        }
        const result = extract(data);
        result !== undefined ? resolve(result) : reject(new Error("Worker returned undefined"));
      };
      channel.port2.onmessageerror = reject;
      this.nextWorker().postMessage(msg, [channel.port1]);
    });
  }

  async encryptNameByCallingWorker(name: string): Promise<string> {
    await this.ensureInitialised();
    return this.sendToWorker(
      { action: "encryptName", inputName: name },
      (d) => d.outputName
    );
  }

  async decryptNameByCallingWorker(name: string): Promise<string> {
    await this.ensureInitialised();
    return this.sendToWorker(
      { action: "decryptName", inputName: name },
      (d) => d.outputName
    );
  }

  async encryptContentByCallingWorker(content: ArrayBuffer): Promise<ArrayBuffer> {
    await this.ensureInitialised();
    return this.sendToWorker(
      { action: "encryptContent", inputContent: content },
      (d) => d.outputContent
    );
  }

  async decryptContentByCallingWorker(content: ArrayBuffer): Promise<ArrayBuffer> {
    await this.ensureInitialised();
    return this.sendToWorker(
      { action: "decryptContent", inputContent: content },
      (d) => d.outputContent
    );
  }
}
