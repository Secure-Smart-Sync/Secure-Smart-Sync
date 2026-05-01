import esbuild from "esbuild";
import { readFileSync } from "fs";

const prod = process.argv[2] === "production";

const banner = `/*
  R2 Sync – Obsidian plugin
  Built: ${new Date().toISOString()}
*/`;

// ── Inline Worker plugin ──────────────────────────────────────────────────────
// The rclone encryption worker (encrypt-rclone.worker.ts) must be bundled as a
// self-contained blob URL so Obsidian can instantiate it without a separate file.
//
// Strategy: bundle the worker entry separately → base64 → inject as a tiny
// loader module that the main bundle imports as a default export (a constructor
// returning `new Worker(blobUrl)`).

const inlineWorkerPlugin = {
  name: "inline-worker",
  setup(build) {
    build.onLoad({ filter: /encrypt-rclone\.worker\.ts$/ }, async (args) => {
      // 1. Bundle the worker in isolation
      const workerResult = await esbuild.build({
        entryPoints: [args.path],
        bundle: true,
        write: false,
        format: "iife",
        target: "es2022", // Updated target for BigInt support
        platform: "browser",
        minify: prod,
      });

      const workerCode = workerResult.outputFiles[0].text;
      const b64 = Buffer.from(workerCode).toString("base64");

      // 2. Return a tiny ES module that exports a Worker constructor
      const contents = `
const src = atob(${JSON.stringify(b64)});
const blob = new Blob([src], { type: "application/javascript" });
const url = URL.createObjectURL(blob);
export default class InlineWorker extends Worker {
  constructor() { super(url); }
}
`;
      return { contents, loader: "js" };
    });
  },
};

// ── Main build ────────────────────────────────────────────────────────────────

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  format: "cjs",
  target: "es2022", // Updated target for BigInt support
  platform: "browser",
  outfile: "main.js",
  banner: { js: banner },
  sourcemap: prod ? false : "inline",
  minify: prod,
  treeShaking: true,

  // Node built-ins that must be polyfilled in the browser
  plugins: [inlineWorkerPlugin],

  define: {
    "process.env.NODE_ENV": prod ? '"production"' : '"development"',
    "process.env.NODE_DEBUG": "undefined",
    "process.env.DEBUG": "undefined",
    // Silence Azure SDK's environment sniffer (pulled in by @aws-sdk)
    "globalThis.process.versions": "undefined",
  },

  // Alias Node built-ins to browser polyfills
  alias: {
    path:   "path-browserify",
    stream: "stream-browserify",
    crypto: "crypto-browserify",
    buffer: "buffer",
    url:    "url",
    'node:url': 'url', // Added alias to resolve the 'node:url' import
    // These have no browser equivalent – stub them out
    fs:     "./src/_stub-empty.js",
    vm:     "./src/_stub-empty.js",
    net:    "./src/_stub-empty.js",
    tls:    "./src/_stub-empty.js",
    http:   "./src/_stub-empty.js",
    https:  "./src/_stub-empty.js",
  },

  // Let esbuild inject Buffer + process globals automatically
  inject: ["./src/_inject-globals.js"],
});

if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("Build complete (production).");
} else {
  await ctx.watch();
  console.log("Watching for changes…");
}