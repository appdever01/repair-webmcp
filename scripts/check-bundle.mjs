import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";

const assetsDirectory = "dist/assets";
const files = await readdir(assetsDirectory);
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));

function dependencyClosure(key, collected = new Set()) {
  const entry = manifest[key];
  if (!entry || collected.has(entry.file)) return collected;
  collected.add(entry.file);
  for (const dependency of entry.imports ?? []) dependencyClosure(dependency, collected);
  return collected;
}

const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!entryKey) throw new Error("The Vite manifest has no application entry.");
const initialFiles = dependencyClosure(entryKey);
const deferredFiles = dependencyClosure("src/scene/RepairScene.tsx");
for (const file of initialFiles) deferredFiles.delete(file);

async function gzipSize(fileNames) {
  let total = 0;
  for (const file of fileNames) total += gzipSync(await readFile(join("dist", file))).byteLength;
  return total;
}

const initialGzip = await gzipSize(initialFiles);
const sceneGzip = await gzipSize(deferredFiles);
const javascriptFiles = files.filter((file) => extname(file) === ".js");

const publicAssets = files.filter(
  (file) => !javascriptFiles.includes(file) && !file.endsWith(".map") && !file.endsWith(".css"),
);
let assetBytes = 0;
for (const file of publicAssets) assetBytes += (await stat(join(assetsDirectory, file))).size;
for (const file of ["fallback-lamp.webp", "repair-og.jpg", "social-card.png"]) {
  assetBytes += (await stat(join("dist", file))).size;
}

const result = { initialGzip, sceneGzip, assetBytes };
console.log(JSON.stringify(result, null, 2));

if (initialGzip > 150_000 || sceneGzip > 450_000 || assetBytes > 1_500_000) {
  process.exitCode = 1;
}
