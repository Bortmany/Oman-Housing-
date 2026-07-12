import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Uploaded files live under DATA_DIR (Railway: a Volume mounted at /data —
// WITHOUT the volume every redeploy wipes the photos). Local dev: ./.data
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? "./.data");

export function dataDir(): string {
  return DATA_DIR;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type SaveImageError = "type" | "size";

export async function savePropertyImage(
  propertyId: string,
  file: File,
): Promise<{ path: string } | { error: SaveImageError }> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "type" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "size" };

  const rel = path.posix.join(
    "properties",
    propertyId,
    `${crypto.randomUUID()}.${ext}`,
  );
  const abs = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { path: rel };
}

export async function deleteStoredFile(relPath: string): Promise<void> {
  try {
    await unlink(path.join(DATA_DIR, relPath));
  } catch {
    // already gone — fine
  }
}

/** Absolute path for a stored file, or null if it escapes DATA_DIR. */
export function resolveStoredPath(relPath: string): string | null {
  const abs = path.resolve(DATA_DIR, relPath);
  if (!abs.startsWith(DATA_DIR + path.sep)) return null;
  return abs;
}
