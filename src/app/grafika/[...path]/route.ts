import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { assetsDir } from "@/lib/assets";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

/** Grafiki wgrywane po wdrożeniu (np. przez menedżer plików Pterodactyla) – serwowane z ASSETS_DIR. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await connection();
  const parts = (await params).path;
  const root = path.resolve(assetsDir());
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        ...(type === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
