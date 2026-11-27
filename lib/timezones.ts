/** Timezones the admin can pick for an auction. The default comes first. */
export const AUCTION_TIMEZONES = [
  { id: "America/Mexico_City", label: "Ciudad de México (tiempo del centro)" },
  { id: "America/Cancun", label: "Cancún (Quintana Roo)" },
  { id: "America/Mazatlan", label: "Pacífico mexicano (Sinaloa, Nayarit, BCS)" },
  { id: "America/Hermosillo", label: "Sonora" },
  { id: "America/Tijuana", label: "Tijuana (Baja California)" },
  { id: "America/Bogota", label: "Bogotá" },
  { id: "America/Lima", label: "Lima" },
  { id: "America/Santiago", label: "Santiago de Chile" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { id: "America/New_York", label: "Nueva York" },
  { id: "America/Los_Angeles", label: "Los Ángeles" },
  { id: "Europe/Madrid", label: "Madrid" },
  { id: "UTC", label: "UTC" },
] as const;

export function timeZoneLabel(id: string): string {
  return AUCTION_TIMEZONES.find((tz) => tz.id === id)?.label ?? id;
}

export function isAllowedAuctionTimeZone(id: string): boolean {
  return AUCTION_TIMEZONES.some((tz) => tz.id === id);
}
