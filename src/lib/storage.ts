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

export type SaveImageError = "type" | "size";

// Work out the real image type from the file's own first bytes ("magic
// numbers") instead of trusting the browser-declared type, which anyone can
// fake. Returns the extension to save under, or null if the bytes are not a
// JPEG, PNG or WebP. This is what stops a disguised file (e.g. a script named
// photo.jpg) from being accepted.
function sniffImageExt(bytes: Buffer): "jpg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "png";
  }
  // WebP: "RIFF" (bytes 0-3) .... "WEBP" (bytes 8-11)
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function savePropertyImage(
  propertyId: string,
  file: File,
): Promise<{ path: string } | { error: SaveImageError }> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "size" };

  // Read the bytes once, then verify the file really is the image type it
  // claims before writing anything to disk.
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = sniffImageExt(buffer);
  if (!ext) return { error: "type" };

  const rel = path.posix.join(
    "properties",
    propertyId,
    `${crypto.randomUUID()}.${ext}`,
  );
  const abs = path.join(DATA_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
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
