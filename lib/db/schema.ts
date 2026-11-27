/**
 * Database schema (MariaDB 11.8 via Drizzle's mysql dialect). See "Data model" in docs/PLAN.md.
 *
 * Conventions:
 * - Instants are `DATETIME(3)` holding UTC (`utcDatetime`). Drizzle maps them to/from JS
 *   `Date` as UTC, whatever the process timezone. Never use `TIMESTAMP`.
 * - Money is integer cents in BIGINT (`*_cents`).
 * - IDs are `varchar(36)` UUIDs, matching the string IDs Better Auth uses (FK types must match).
 *
 * Not yet here: Better Auth tables + `auction.created_by` (phase 1), `bid` and the FK from
 * `product.leading_bid_id` (phase 5).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

const id = () =>
  varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const utcDatetime = (name: string) => datetime(name, { mode: "date", fsp: 3 });

const cents = (name: string) => bigint(name, { mode: "number", unsigned: true });

const timestamps = {
  createdAt: utcDatetime("created_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: utcDatetime("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

export const auctionStatus = ["draft", "published", "cancelled"] as const;
export type AuctionStatus = (typeof auctionStatus)[number];

export const auction = mysqlTable(
  "auction",
  {
    id: id(),
    slug: varchar("slug", { length: 160 }).notNull().unique("auction_slug_unique"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    status: mysqlEnum("status", auctionStatus).notNull().default("draft"),
    /** UTC instant. The window is [startsAt, endsAt). */
    startsAt: utcDatetime("starts_at").notNull(),
    /** UTC instant. */
    endsAt: utcDatetime("ends_at").notNull(),
    /** IANA zone used to show times and read admin input, e.g. America/Mexico_City. */
    timezone: varchar("timezone", { length: 64 }).notNull(),
    ...timestamps,
  },
  (t) => [
    check("auction_window_chk", sql`\`ends_at\` > \`starts_at\``),
    index("auction_status_starts_idx").on(t.status, t.startsAt),
  ],
);

export const product = mysqlTable(
  "product",
  {
    id: id(),
    auctionId: varchar("auction_id", { length: 36 })
      .notNull()
      .references(() => auction.id, { onDelete: "cascade" }),
    lotNumber: int("lot_number", { unsigned: true }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull(),
    startingPriceCents: cents("starting_price_cents").notNull(),
    minIncrementCents: cents("min_increment_cents").notNull(),
    reservePriceCents: cents("reserve_price_cents"),
    /** Denormalized from the leading bid; only written inside the bid transaction. */
    currentPriceCents: cents("current_price_cents"),
    leadingBidId: varchar("leading_bid_id", { length: 36 }),
    bidCount: int("bid_count", { unsigned: true }).notNull().default(0),
    position: int("position", { unsigned: true }).notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("product_auction_lot_unique").on(t.auctionId, t.lotNumber),
    index("product_auction_position_idx").on(t.auctionId, t.position),
    check("product_increment_chk", sql`\`min_increment_cents\` > 0`),
  ],
);

export const productImage = mysqlTable(
  "product_image",
  {
    id: id(),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    width: int("width", { unsigned: true }).notNull(),
    height: int("height", { unsigned: true }).notNull(),
    alt: varchar("alt", { length: 300 }).notNull().default(""),
    /** 0 = cover image. */
    position: int("position", { unsigned: true }).notNull().default(0),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("product_image_product_position_idx").on(t.productId, t.position)],
);

export type Auction = typeof auction.$inferSelect;
export type NewAuction = typeof auction.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;
