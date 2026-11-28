/** Absolute base URL of the site (production: https://subastasdelsur.io). */
export function siteUrl(): URL {
  return new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
}
