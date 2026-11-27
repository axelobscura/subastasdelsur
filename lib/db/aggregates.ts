/**
 * Correlated subqueries for counts and covers, written with explicit table aliases.
 *
 * Don't use `${table.column}` for the outer row inside a subquery: in single-table queries
 * Drizzle renders columns without their table name, so `product_id = ${product.id}` becomes
 * `product_id = id`, and `id` then binds to the *inner* table. Tested in roundtrip.test.ts.
 */
import { sql } from "drizzle-orm";

/** Products of the outer `auction` row. */
export const auctionProductCount = sql<number>`(SELECT COUNT(*) FROM product p WHERE p.auction_id = \`auction\`.\`id\`)`.mapWith(Number);

/** Products of the outer `auction` row that have no photo. */
export const auctionProductsWithoutImages = sql<number>`(
  SELECT COUNT(*) FROM product p
  WHERE p.auction_id = \`auction\`.\`id\`
    AND NOT EXISTS (SELECT 1 FROM product_image pi WHERE pi.product_id = p.id)
)`.mapWith(Number);

/** Photos of the outer `product` row. */
export const productImageCount = sql<number>`(SELECT COUNT(*) FROM product_image pi WHERE pi.product_id = \`product\`.\`id\`)`.mapWith(Number);

/** A column of the outer `product` row's cover photo (lowest position). */
export function productCover(column: "storage_key" | "width" | "height") {
  return sql.raw(`(SELECT pi.${column} FROM product_image pi WHERE pi.product_id = \`product\`.\`id\` ORDER BY pi.position, pi.created_at LIMIT 1)`);
}
