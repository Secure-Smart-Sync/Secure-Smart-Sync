/**
 * global.d.ts
 * Ambient type declarations for the R2 Sync plugin.
 */

// The rclone worker is imported as a class constructor via the inline-worker
// esbuild plugin. This declaration tells TypeScript what to expect.
declare module "*.worker.ts" {
  class WebpackWorker extends Worker {
    constructor();
  }
  export default WebpackWorker;
}

// Obsidian exposes moment.js on the window global
declare interface Window {
  moment: typeof import("moment");
}
