import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";

export type AssetManifest = { factions: string[]; heroes: string[] };

let cached: { at: number; value: AssetManifest } | null = null;
const TTL = 60_000;

/** Katalog grafik (frakcje, bohaterowie, baner). Domyślnie public/assets; w kontenerze – trwały wolumen. */
export function assetsDir(): string {
  return process.env.ASSETS_DIR || path.join(process.cwd(), "public", "assets");
}

async function list(dir: string): Promise<string[]> {
  try {
    const files = await readdir(path.join(assetsDir(), dir));
    return files.filter((f) => /\.(png|webp|gif|jpg)$/i.test(f));
  } catch {
    return [];
  }
}

/** Lista wgranych grafik frakcji/bohaterów (nazwy plików), by nie odpytywać brakujących plików. */
export async function getAssetManifest(): Promise<AssetManifest> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const value = { factions: await list("factions"), heroes: await list("heroes") };
  cached = { at: Date.now(), value };
  return value;
}
