/** Money is integer cents everywhere (PLAN "Data model"). One currency per site: CURRENCY. */

export const CURRENCY = process.env.CURRENCY || "MXN";

/** Largest amount accepted from a form: 100 million (in cents fits easily in JS integers). */
export const MAX_CENTS = 100_000_000 * 100;

/**
 * Parse an amount typed by the admin ("1500", "1,500.50", "$ 1 500") into cents.
 * Uses "." for decimals and "," only as a thousands separator, as in Mexico.
 * Returns null if it isn't a valid non-negative amount with at most 2 decimals.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$\s*/, "").replace(/\s+/g, "");
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.replaceAll(",", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/** "$1,500.00" (es-MX, MXN). */
export function formatMoney(cents: number, currency = CURRENCY, locale = "es-MX"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Value for a form input: 150050 → "1500.50" (no symbol or separators). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}
