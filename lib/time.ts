/**
 * Auction time handling. Implements "Timezone rules" in docs/PLAN.md.
 *
 * Every function here is pure and independent of the process timezone (`TZ`)
 * and of the viewer's browser zone. An auction instant is an absolute moment
 * (a `Date`, stored as UTC). A wall-clock time ("2026-12-05T19:00") only means
 * something together with an IANA timezone, and is only converted here.
 */

/** Business timezone, used as the default for new auctions. */
export const DEFAULT_AUCTION_TIMEZONE = "America/Mexico_City";

export class InvalidTimeZoneError extends Error {
  constructor(timeZone: string) {
    super(`Zona horaria inválida: ${timeZone}`);
    this.name = "InvalidTimeZoneError";
  }
}

/** Not a well-formed `YYYY-MM-DDTHH:mm[:ss]` value, or not a real calendar date/time. */
export class InvalidWallClockError extends Error {
  constructor(value: string) {
    super(`Fecha y hora inválidas: ${value}`);
    this.name = "InvalidWallClockError";
  }
}

/** The wall-clock time is skipped in that timezone (DST gap), so no instant has it. */
export class NonexistentLocalTimeError extends Error {
  constructor(value: string, timeZone: string) {
    super(`La hora ${value} no existe en ${timeZone} (cambio de horario)`);
    this.name = "NonexistentLocalTimeError";
  }
}

type WallClock = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
};

const WALL_CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_YEAR = 2000;
const MAX_YEAR = 2999;

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      throw new InvalidTimeZoneError(timeZone);
    }
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

function wallClockAt(epochMs: number, timeZone: string): WallClock {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of partsFormatter(timeZone).formatToParts(new Date(epochMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

function wallClockAsUtcMs(wc: WallClock): number {
  return Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
}

/** The zone's UTC offset at an instant, in ms (Mexico City: -6h). */
function offsetMs(epochMs: number, timeZone: string): number {
  const wholeSecond = Math.floor(epochMs / 1000) * 1000;
  return wallClockAsUtcMs(wallClockAt(wholeSecond, timeZone)) - wholeSecond;
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function parseWallClock(value: string): WallClock {
  const match = WALL_CLOCK_RE.exec(value);
  if (!match) throw new InvalidWallClockError(value);
  const [year, month, day, hour, minute, second = 0] = match.slice(1).map((n) => (n === undefined ? 0 : Number(n)));
  const wc = { year, month, day, hour, minute, second };
  if (year < MIN_YEAR || year > MAX_YEAR) throw new InvalidWallClockError(value);
  // Reject impossible dates/times (Feb 30, 24:00, :60) by checking the UTC round trip.
  const roundTrip = new Date(wallClockAsUtcMs(wc));
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() + 1 !== month ||
    roundTrip.getUTCDate() !== day ||
    roundTrip.getUTCHours() !== hour ||
    roundTrip.getUTCMinutes() !== minute ||
    roundTrip.getUTCSeconds() !== second
  ) {
    throw new InvalidWallClockError(value);
  }
  return wc;
}

/**
 * Convert a zone-less wall-clock value, as posted by `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`), into the absolute instant it
 * means in `timeZone`.
 *
 * The result depends only on `value` and `timeZone`, never on the server's or
 * the admin's own zone. A time skipped by a DST change throws
 * `NonexistentLocalTimeError`. A time that happens twice (DST fall-back)
 * resolves to the earlier instant.
 */
export function wallClockToInstant(value: string, timeZone: string): Date {
  const wc = parseWallClock(value);
  partsFormatter(timeZone); // validate the zone before doing any work
  const naive = wallClockAsUtcMs(wc);
  // A zone has at most one offset change around a given day. The offsets one
  // day either side give every instant that could show this wall-clock time.
  const candidates = new Set([naive - offsetMs(naive - DAY_MS, timeZone), naive - offsetMs(naive + DAY_MS, timeZone)]);
  const matches = [...candidates].filter((epochMs) => sameWallClock(wallClockAt(epochMs, timeZone), wc));
  if (matches.length === 0) throw new NonexistentLocalTimeError(value, timeZone);
  return new Date(Math.min(...matches));
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * The wall-clock time of `instant` in `timeZone`, as `YYYY-MM-DDTHH:mm`, the
 * format `<input type="datetime-local">` expects. Seconds are dropped.
 */
export function instantToWallClock(instant: Date, timeZone: string): string {
  const wc = wallClockAt(instant.getTime(), timeZone);
  return `${pad(wc.year, 4)}-${pad(wc.month)}-${pad(wc.day)}T${pad(wc.hour)}:${pad(wc.minute)}`;
}

/**
 * Human-readable date and time in the auction's zone, with the zone named,
 * e.g. "sábado, 5 de diciembre de 2026, 19:00 GMT-6". The zone is always
 * passed explicitly, never the host's default (see PLAN timezone rule 5).
 */
export function formatAuctionTime(instant: Date, timeZone: string, locale = "es-MX"): string {
  partsFormatter(timeZone);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
    hourCycle: "h23",
  })
    .format(instant)
    .concat(" ", zoneLabel(instant, timeZone, locale));
}

function zoneLabel(instant: Date, timeZone: string, locale: string): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export type AuctionPhase = "upcoming" | "live" | "ended";

/**
 * Where `now` falls in the window [startsAt, endsAt): live from the start
 * instant inclusive, ended at the end instant. On the server, `now` must come
 * from the database clock (PLAN timezone rule 4).
 */
export function auctionPhase(startsAt: Date, endsAt: Date, now: Date): AuctionPhase {
  const t = now.getTime();
  if (t < startsAt.getTime()) return "upcoming";
  if (t < endsAt.getTime()) return "live";
  return "ended";
}
