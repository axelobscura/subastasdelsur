/**
 * Auction rules (pure functions, unit-tested). Implements "Admin rules" and the
 * timezone rules in docs/PLAN.md. "now" is always passed in, and on the server it
 * must be the database clock (`dbNow()`).
 */
import { z } from "zod";
import type { AuctionStatus } from "../db/schema";
import { InvalidTimeZoneError, InvalidWallClockError, NonexistentLocalTimeError, auctionPhase, wallClockToInstant, type AuctionPhase } from "../time";
import { isAllowedAuctionTimeZone } from "../timezones";

export const MIN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

// ---------------------------------------------------------------------------
// Form parsing
// ---------------------------------------------------------------------------

const textFields = z.object({
  title: z.string().trim().min(3, { error: "Escribe un título (mínimo 3 caracteres)." }).max(200, { error: "El título es demasiado largo (máx. 200)." }),
  description: z.string().trim().max(5000, { error: "La descripción es demasiado larga (máx. 5000)." }),
});

const windowFields = z.object({
  timezone: z.string().refine(isAllowedAuctionTimeZone, { error: "Elige una zona horaria de la lista." }),
  startsAt: z.string().min(1, { error: "Elige la fecha y hora de inicio." }),
  endsAt: z.string().min(1, { error: "Elige la fecha y hora de cierre." }),
});

export type AuctionText = z.infer<typeof textFields>;
export type AuctionWindow = { timezone: string; startsAt: Date; endsAt: Date };
export type FieldErrors = Record<string, string[] | undefined>;
type Parsed<T> = { ok: true; data: T } | { ok: false; fieldErrors: FieldErrors };

export function parseAuctionText(input: Record<string, unknown>): Parsed<AuctionText> {
  const parsed = textFields.safeParse(input);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
}

function toInstant(value: string, timeZone: string): Date | string {
  try {
    return wallClockToInstant(value, timeZone);
  } catch (error) {
    if (error instanceof NonexistentLocalTimeError) return "Esa hora no existe en la zona elegida (cambio de horario). Elige otra.";
    if (error instanceof InvalidWallClockError) return "Fecha y hora inválidas.";
    if (error instanceof InvalidTimeZoneError) return "Zona horaria inválida.";
    throw error;
  }
}

/**
 * Turn the form's zone-less `datetime-local` values into absolute instants, read in the
 * auction's timezone (never the admin's browser or the server's zone), and validate the window.
 * `now` is the database clock; pass `requireFutureStart: false` when the start isn't changing.
 */
export function parseAuctionWindow(
  input: Record<string, unknown>,
  { now, requireFutureStart = true }: { now: Date; requireFutureStart?: boolean },
): Parsed<AuctionWindow> {
  const parsed = windowFields.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { timezone } = parsed.data;

  const startsAt = toInstant(parsed.data.startsAt, timezone);
  const endsAt = toInstant(parsed.data.endsAt, timezone);
  const fieldErrors: FieldErrors = {};
  if (typeof startsAt === "string") fieldErrors.startsAt = [startsAt];
  if (typeof endsAt === "string") fieldErrors.endsAt = [endsAt];
  if (typeof startsAt === "string" || typeof endsAt === "string") return { ok: false, fieldErrors };

  if (requireFutureStart && startsAt.getTime() <= now.getTime()) {
    fieldErrors.startsAt = ["El inicio debe ser en el futuro."];
  }
  const duration = endsAt.getTime() - startsAt.getTime();
  if (duration < MIN_DURATION_MS) fieldErrors.endsAt = ["El cierre debe ser al menos 5 minutos después del inicio."];
  else if (duration > MAX_DURATION_MS) fieldErrors.endsAt = ["Una subasta puede durar como máximo 60 días."];
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  return { ok: true, data: { timezone, startsAt, endsAt } };
}

/**
 * Editing an existing auction: the start must be in the future only if it changes, so a
 * draft can keep a past date while its text is edited (publishing still requires a future
 * start). Returns every problem at once.
 */
export function parseAuctionWindowForEdit(
  input: Record<string, unknown>,
  { now, currentStartsAt }: { now: Date; currentStartsAt: Date },
): Parsed<AuctionWindow> {
  let startChanged = true;
  if (typeof input.startsAt === "string" && typeof input.timezone === "string" && isAllowedAuctionTimeZone(input.timezone)) {
    const start = toInstant(input.startsAt, input.timezone);
    startChanged = typeof start === "string" || start.getTime() !== currentStartsAt.getTime();
  }
  return parseAuctionWindow(input, { now, requireFutureStart: startChanged });
}

// ---------------------------------------------------------------------------
// State and permissions
// ---------------------------------------------------------------------------

export type AuctionState = { status: AuctionStatus; startsAt: Date; endsAt: Date };

/** What visitors and the admin see: draft, cancelled, or (when published) the time phase. */
export type DisplayState = "draft" | "cancelled" | AuctionPhase;

export function displayState(auction: AuctionState, now: Date): DisplayState {
  if (auction.status === "draft") return "draft";
  if (auction.status === "cancelled") return "cancelled";
  return auctionPhase(auction.startsAt, auction.endsAt, now);
}

export const DISPLAY_STATE_LABELS: Record<DisplayState, string> = {
  draft: "Borrador",
  upcoming: "Programada",
  live: "En vivo",
  ended: "Finalizada",
  cancelled: "Cancelada",
};

export type Permissions = {
  editText: boolean;
  /** Times and timezone. */
  editWindow: boolean;
  /** Add/remove products and change lot numbers and prices. Locked from the start, like the window. */
  editProducts: boolean;
  /** Product text and photos (also after the start, until cancelled). */
  editProductContent: boolean;
  publish: boolean;
  unpublish: boolean;
  cancel: boolean;
  deleteDraft: boolean;
};

/**
 * Drafts and published-but-not-started auctions are fully editable. Once live or ended,
 * the window is locked and only the text can change. Cancelled auctions are read-only.
 */
export function permissions(auction: AuctionState, now: Date): Permissions {
  const state = displayState(auction, now);
  return {
    editText: state !== "cancelled",
    editWindow: state === "draft" || state === "upcoming",
    editProducts: state === "draft" || state === "upcoming",
    editProductContent: state !== "cancelled",
    publish: state === "draft",
    unpublish: state === "upcoming",
    cancel: state === "draft" || state === "upcoming" || state === "live",
    deleteDraft: state === "draft",
  };
}

export type PublishFacts = AuctionState & { productCount: number; productsWithoutImages: number };

/** Problems that block publishing (empty when it can be published). */
export function publishProblems(facts: PublishFacts, now: Date): string[] {
  const problems: string[] = [];
  if (facts.status !== "draft") problems.push("Solo se puede publicar un borrador.");
  if (facts.startsAt.getTime() <= now.getTime()) problems.push("La hora de inicio ya pasó. Cambia la fecha antes de publicar.");
  if (facts.productCount === 0) problems.push("Agrega al menos un producto.");
  else if (facts.productsWithoutImages > 0) {
    problems.push(facts.productsWithoutImages === 1 ? "Un producto no tiene fotos." : `${facts.productsWithoutImages} productos no tienen fotos.`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** URL slug from a Spanish title: "Subasta de Año Nuevo!" -> "subasta-de-ano-nuevo". */
export function slugify(title: string, maxLength = 80): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "subasta";
}

/** First free slug: base, base-2, base-3, … given the slugs already taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
