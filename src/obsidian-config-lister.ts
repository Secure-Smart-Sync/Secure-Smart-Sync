/**
 * obsidian-config-lister.ts
 * Lists files inside Obsidian's .obsidian config directory for optional sync.
 */

import type { ListedFiles, Vault } from "obsidian";
import { Queue } from "@fyears/tsqueue";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import type { FileEntity } from "./types";
import { isSpecialFolderNameToSkip, statFix } from "./utils";

const PLUGIN_REQUIRED_FILES = new Set([
  "data.json", "main.js", "manifest.json", ".gitignore", "styles.css",
]);

const isPluginDir = (x: string, pluginId: string): boolean =>
  x === pluginId ||
  x === `${pluginId}/` ||
  x.endsWith(`/${pluginId}`) ||
  x.endsWith(`/${pluginId}/`);

const isPluginSubFile = (x: string): boolean => {
  const filename = x.split("/").pop() ?? "";
  return PLUGIN_REQUIRED_FILES.has(filename);
};

/**
 * Walk the Obsidian config directory and return FileEntity objects for each file.
 * Plugin-internal files (other than required manifests) are excluded.
 *
 * @param configDir   e.g. ".obsidian"
 * @param vault       Obsidian vault
 * @param pluginId    This plugin's ID – its own directory is partially excluded
 */
export const listObsidianConfigFiles = async (
  configDir: string,
  vault: Vault,
  pluginId: string
): Promise<FileEntity[]> => {
  const queue = new Queue([configDir]);
  const CHUNK_SIZE = 10;
  const entities: FileEntity[] = [];

  while (queue.length > 0) {
    const batch: string[] = [];
    while (queue.length > 0) batch.push(queue.pop()!);

    const chunks = chunk(batch, CHUNK_SIZE);
    for (const c of chunks) {
      const results = await Promise.all(
        c.map(async (x) => {
          const s = await statFix(vault, x);
          if (!s) throw new Error(`Cannot stat ${x}`);
          const isFolder = s.type === "folder";
          let children: ListedFiles | undefined;
          if (isFolder) children = await vault.adapter.list(x);
          if (!isFolder && (!s.mtime || s.mtime === 0)) {
            throw new Error(`Config file has mtime=0: ${x}`);
          }
          return { path: x, isFolder, stat: s, children };
        })
      );

      for (const item of results) {
        const key = item.isFolder ? `${item.path}/` : item.path;
        entities.push({
          key,
          keyRaw: key,
          mtimeCli: item.stat.mtime,
          mtimeSvr: item.stat.mtime,
          size: item.stat.size,
          sizeRaw: item.stat.size,
        });

        if (item.children) {
          const isInsideSelf = isPluginDir(item.path, pluginId);
          const skip = (p: string) =>
            isSpecialFolderNameToSkip(p, ["workspace", "workspace.json"]) ||
            (isInsideSelf && !isPluginSubFile(p));

          for (const sub of [...item.children.folders, ...item.children.files]) {
            if (!skip(sub)) queue.push(sub);
          }
        }
      }
    }
  }

  return entities;
};
