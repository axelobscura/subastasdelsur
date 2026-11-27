/**
 * Database schema (MariaDB 11.8 via Drizzle's mysql dialect). See "Data model" in docs/PLAN.md.
 *
 * Conventions:
 * - Instants are `DATETIME(3)` holding UTC (`utcDatetime`). Drizzle maps them to/from JS
 *   `Date` as UTC, whatever the process timezone. Never use `TIMESTAMP`.
 * - Money is integer cents in BIGINT (`*_cents`).
 * - IDs are `varchar(36)` UUIDs, matching the string IDs Better Auth uses (FK types must match).
 *
 * Better Auth tables follow the field names its Drizzle adapter expects (`user`, `session`,
 * `account`, `verification`), but with our UTC DATETIME(3) instead of TIMESTAMP. Extra
 * `user` fields are declared as `user.additionalFields` in lib/auth.ts, and the two must match.
 *
 * `product` and `bid` reference each other (`product.leading_bid_id` → `bid.id`), hence the
 * `AnyMySqlColumn` thunks.
 */
import { sql } from "drizzle-orm";
import {
  type AnyMySqlColumn,
  bigint,
  boolean,
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

// ---------------------------------------------------------------------------
// Auth (Better Auth)
// ---------------------------------------------------------------------------

export const userRole = ["admin", "bidder"] as const;
export type UserRole = (typeof userRole)[number];

export const approvalStatus = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof approvalStatus)[number];

export const user = mysqlTable(
  "user",
  {
    id: id(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique("user_email_unique"),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...timestamps,
    role: mysqlEnum("role", userRole).notNull().default("bidder"),
    /** Bidders can't bid until the admin approves them (PLAN "Bidder registration and approval"). */
    approvalStatus: mysqlEnum("approval_status", approvalStatus).notNull().default("pending"),
    phone: varchar("phone", { length: 32 }).notNull(),
    termsAcceptedAt: utcDatetime("terms_accepted_at"),
    reviewedAt: utcDatetime("reviewed_at"),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references((): AnyMySqlColumn => user.id, {
      onDelete: "set null",
    }),
    reviewNote: varchar("review_note", { length: 1000 }),
  },
  (t) => [index("user_role_approval_idx").on(t.role, t.approvalStatus, t.createdAt)],
);

export const session = mysqlTable(
  "session",
  {
    id: id(),
    expiresAt: utcDatetime("expires_at").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique("session_token_unique"),
    ...timestamps,
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = mysqlTable(
  "account",
  {
    id: id(),
    accountId: varchar("account_id", { length: 255 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: utcDatetime("access_token_expires_at"),
    refreshTokenExpiresAt: utcDatetime("refresh_token_expires_at"),
    scope: text("scope"),
    /** Password hash (credential provider). */
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = mysqlTable(
  "verification",
  {
    id: id(),
    identifier: varchar("identifier", { length: 255 }).notNull(),
    value: text("value").notNull(),
    expiresAt: utcDatetime("expires_at").notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

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
    /** Shown on the home page and /subastas. Unlisted auctions are reachable only by their link. */
    listed: boolean("listed").notNull().default(true),
    /**
     * When the auction was settled after its end (results computed, winners and admin emailed).
     * Claimed with UPDATE … WHERE settled_at IS NULL, so it happens exactly once.
     */
    settledAt: utcDatetime("settled_at"),
    /** The admin who created it. Null for rows created before phase 1. */
    createdBy: varchar("created_by", { length: 36 }).references(() => user.id, { onDelete: "set null" }),
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
    leadingBidId: varchar("leading_bid_id", { length: 36 }).references((): AnyMySqlColumn => bid.id, { onDelete: "set null" }),
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

// ---------------------------------------------------------------------------
// Bids
// ---------------------------------------------------------------------------

export const bid = mysqlTable(
  "bid",
  {
    id: id(),
    productId: varchar("product_id", { length: 36 })
      .notNull()
      .references((): AnyMySqlColumn => product.id, { onDelete: "cascade" }),
    /** Bids are history: a user who has bid can't be deleted (restrict). */
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amountCents: cents("amount_cents").notNull(),
    /** The database clock at the moment the bid was accepted (UTC_TIMESTAMP(3)), never the client's. */
    createdAt: utcDatetime("created_at").notNull(),
  },
  (t) => [
    unique("bid_product_amount_unique").on(t.productId, t.amountCents),
    index("bid_product_created_idx").on(t.productId, t.createdAt),
    index("bid_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export type Bid = typeof bid.$inferSelect;

// ---------------------------------------------------------------------------
// Notifications (log, for idempotency and throttling of emails)
// ---------------------------------------------------------------------------

export const notificationKind = ["outbid", "auction_result", "admin_summary"] as const;
export type NotificationKind = (typeof notificationKind)[number];

export const notification = mysqlTable(
  "notification",
  {
    id: id(),
    userId: varchar("user_id", { length: 36 }).references(() => user.id, { onDelete: "cascade" }),
    /** For admin summaries sent to ADMIN_NOTIFICATION_EMAIL (no user row). */
    email: varchar("email", { length: 255 }),
    kind: mysqlEnum("kind", notificationKind).notNull(),
    auctionId: varchar("auction_id", { length: 36 }).references(() => auction.id, { onDelete: "cascade" }),
    productId: varchar("product_id", { length: 36 }).references(() => product.id, { onDelete: "cascade" }),
    createdAt: utcDatetime("created_at").notNull(),
  },
  (t) => [index("notification_user_product_kind_idx").on(t.userId, t.productId, t.kind, t.createdAt), index("notification_auction_idx").on(t.auctionId, t.kind)],
);
export type User = typeof user.$inferSelect;
export type Auction = typeof auction.$inferSelect;
export type NewAuction = typeof auction.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;
