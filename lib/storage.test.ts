import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UnsupportedImageError, deleteKeys, listStoredKeys, resolveKey, saveProductImage, sniffImageType } from "./storage";

const productId = "11111111-2222-4333-8444-555555555555";
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "subastas-uploads-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** A JPEG with EXIF (incl. GPS-like data) and an orientation tag. */
async function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#c0ffee" } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestCam", Copyright: "secret" }, IFD3: { GPSLatitudeRef: "N" } })
    .toBuffer();
}

describe("sniffImageType", () => {
  it("detects formats by their bytes, not their name", async () => {
    expect(sniffImageType(await photo(10, 10))).toBe("jpeg");
    expect(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer())).toBe("png");
    expect(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).webp().toBuffer())).toBe("webp");
    expect(sniffImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });
});

describe("resolveKey", () => {
  it("only accepts our own key format inside UPLOAD_DIR", () => {
    expect(resolveKey(`products/${productId}/${productId}.webp`)).toBe(path.join(dir, "products", productId, `${productId}.webp`));
    for (const bad of ["../etc/passwd", `products/${productId}/../../x.webp`, `products/${productId}/a.jpg`, "/etc/passwd", ""]) {
      expect(resolveKey(bad)).toBeNull();
    }
  });
});

describe("saveProductImage", () => {
  it("re-encodes to WebP, shrinks to 2400px, and drops EXIF metadata", async () => {
    const stored = await saveProductImage(productId, await photo(3000, 1500));
    expect(stored.key).toMatch(new RegExp(`^products/${productId}/[0-9a-f-]{36}\\.webp$`));
    expect([stored.width, stored.height]).toEqual([2400, 1200]);
    const file = await readFile(resolveKey(stored.key)!);
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect((await stat(resolveKey(stored.key)!)).size).toBe(stored.bytes);
  });

  it("keeps small photos at their size", async () => {
    const stored = await saveProductImage(productId, await photo(800, 600));
    expect([stored.width, stored.height]).toEqual([800, 600]);
  });

  it("refuses non-images and HEIC with a clear message", async () => {
    await expect(saveProductImage(productId, new TextEncoder().encode("not an image at all"))).rejects.toBeInstanceOf(UnsupportedImageError);
    const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]);
    await expect(saveProductImage(productId, heic)).rejects.toThrow(/HEIC/);
  });

  it("lists and deletes stored files, removing the empty folder", async () => {
    const keys = await listStoredKeys();
    expect(keys.length).toBe(2);
    await deleteKeys([...keys, "../../nope"]);
    expect(await listStoredKeys()).toEqual([]);
    await expect(stat(path.join(dir, "products", productId))).rejects.toThrow();
  });
});
