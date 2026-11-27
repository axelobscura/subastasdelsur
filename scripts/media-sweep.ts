/**
 * Find photo files in UPLOAD_DIR that no product_image row points to (left by a crash between
 * saving the file and committing the row). Dry run by default; pass --delete to remove them.
 * Only files older than an hour are considered, so uploads in progress are never touched.
 *
 * On the VPS:  cd /srv/nextjs/current && sudo -u nextjs npx tsx scripts/media-sweep.ts [--delete]
 */
import { stat } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { createDb, createPool } = await import("../lib/db/client");
  const { productImage } = await import("../lib/db/schema");
  const { deleteKeys, listStoredKeys, resolveKey, uploadRoot } = await import("../lib/storage");
  const remove = process.argv.includes("--delete");

  const pool = createPool();
  try {
    const rows = await createDb(pool).select({ key: productImage.storageKey }).from(productImage);
    const referenced = new Set(rows.map((r) => r.key));
    const cutoff = Date.now() - 60 * 60 * 1000;
    const orphans: string[] = [];
    for (const key of await listStoredKeys()) {
      if (referenced.has(key)) continue;
      const info = await stat(resolveKey(key)!).catch(() => null);
      if (info && info.mtimeMs < cutoff) orphans.push(key);
    }
    console.log(`${uploadRoot()}: ${referenced.size} referenced photos, ${orphans.length} orphan files older than 1h`);
    for (const key of orphans) console.log(`  ${remove ? "deleting" : "orphan"} ${key}`);
    if (remove && orphans.length) await deleteKeys(orphans);
    if (!remove && orphans.length) console.log("Dry run. Pass --delete to remove them.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
