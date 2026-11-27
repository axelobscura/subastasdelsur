/**
 * Photo storage on the VPS disk ("Image storage" in docs/PLAN.md).
 *
 * - Root: UPLOAD_DIR (production /srv/nextjs/shared/uploads, outside the release folders).
 * - Every upload is re-encoded by sharp to WebP (max 2400px, auto-rotated, metadata such as
 *   EXIF/GPS dropped) and saved under a fresh random key, so keys are never reused and can be
 *   cached forever.
 * - Writes go to a temp file and are renamed into place, so a half-written file is never served.
 *
 * No `server-only` guard: scripts (media sweep) and tests use it. Never import it client-side.
 */
import { mkdir, readdir, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OutputInfo } from "sharp";

const KEY_RE = /^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;
const MAX_DIMENSION = 2400;

export class UnsupportedImageError extends Error {
  constructor(message = "Formato no compatible. Sube fotos JPG, PNG, WebP o AVIF.") {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

export function uploadRoot(): string {
  // The ignore comment keeps Turbopack from tracing the whole project into the server bundle.
  return path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./.uploads");
}

/** Absolute path for a key, or null if the key isn't one of ours (blocks path traversal). */
export function resolveKey(key: string): string | null {
  if (!KEY_RE.test(key)) return null;
  const root = uploadRoot();
  const full = path.resolve(root, key);
  return full.startsWith(root + path.sep) ? full : null;
}

/** Public URL path for a stored key. */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

export type ImageKind = "jpeg" | "png" | "webp" | "avif" | "heic";

/** The real type, from the file's first bytes (never trust the file name or browser type). */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return "avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export type StoredImage = { key: string; width: number; height: number; bytes: number };

/** Re-encode and store one photo for a product. Throws UnsupportedImageError for non-images. */
export async function saveProductImage(productId: string, input: Uint8Array): Promise<StoredImage> {
  const kind = sniffImageType(input);
  if (kind === "heic") throw new UnsupportedImageError("Las fotos HEIC (iPhone) no son compatibles. Expórtalas como JPG e inténtalo de nuevo.");
  if (!kind) throw new UnsupportedImageError();

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(input, { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate() // apply EXIF orientation before the metadata is dropped
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UnsupportedImageError("No pudimos leer esta imagen. Puede estar dañada.");
  }

  const key = `products/${productId}/${crypto.randomUUID()}.webp`;
  const full = resolveKey(key);
  if (!full) throw new Error(`Invalid storage key for product ${productId}`);
  await mkdir(path.dirname(full), { recursive: true });
  const temp = `${full}.${process.pid}.tmp`;
  await writeFile(temp, output.data);
  await rename(temp, full);
  return { key, width: output.info.width, height: output.info.height, bytes: output.data.length };
}

/** Best-effort delete (missing files are fine). Removes the product folder once it's empty. */
export async function deleteKeys(keys: string[]): Promise<void> {
  const dirs = new Set<string>();
  await Promise.all(
    keys.map(async (key) => {
      const full = resolveKey(key);
      if (!full) return;
      dirs.add(path.dirname(full));
      await unlink(full).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") console.error(`[storage] could not delete ${key}: ${error.message}`);
      });
    }),
  );
  for (const dir of dirs) {
    if ((await readdir(dir).catch(() => ["?"])).length === 0) await rmdir(dir).catch(() => {});
  }
}

/** Every stored key (for the orphan sweep). */
export async function listStoredKeys(): Promise<string[]> {
  const root = path.join(uploadRoot(), "products");
  const keys: string[] = [];
  for (const productDir of await readdir(root).catch(() => [] as string[])) {
    for (const file of await readdir(path.join(root, productDir)).catch(() => [] as string[])) {
      const key = `products/${productDir}/${file}`;
      if (KEY_RE.test(key)) keys.push(key);
    }
  }
  return keys;
}
