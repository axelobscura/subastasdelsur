/**
 * Social preview images for auctions and lots: the cover photo as a 1200×630 JPEG (many crawlers
 * don't read WebP). Drafts and unknown pages get a 404, so nothing about a draft leaks.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { resolveKey } from "./storage";

export const OG_SIZE = { width: 1200, height: 630 };

export async function coverAsOgJpeg(storageKey: string | undefined | null): Promise<Response> {
  const file = storageKey ? resolveKey(storageKey) : null;
  const bytes = file ? await readFile(file).catch(() => null) : null;
  if (!bytes) return Response.redirect(new URL("/opengraph-image", process.env.BETTER_AUTH_URL ?? "http://localhost:3000"), 307);
  const jpeg = await sharp(bytes).resize({ ...OG_SIZE, fit: "cover" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}

export function ogNotFound(): Response {
  return new Response("Not found", { status: 404 });
}
