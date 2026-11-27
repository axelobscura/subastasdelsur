// Runs under TZ=UTC, Asia/Tokyo and America/Los_Angeles (npm test). All expectations are
// absolute instants, so passing everywhere shows the server's zone never leaks in.
import { describe, expect, it } from "vitest";
import { displayState, groupByPhase, parseAuctionText, parseAuctionWindow, parseAuctionWindowForEdit, permissions, publishProblems, slugify, uniqueSlug } from "./rules";

const now = new Date("2026-12-01T18:00:00.000Z"); // 1 Dec 2026, 12:00 in Mexico City
const form = { timezone: "America/Mexico_City", startsAt: "2026-12-05T19:00", endsAt: "2026-12-05T21:30" };

describe("parseAuctionWindow", () => {
  it("reads the admin's input in the auction's timezone", () => {
    const result = parseAuctionWindow(form, { now });
    expect(result.ok && result.data.startsAt.toISOString()).toBe("2026-12-06T01:00:00.000Z");
    expect(result.ok && result.data.endsAt.toISOString()).toBe("2026-12-06T03:30:00.000Z");
  });

  it("gives a different instant when the auction uses another zone", () => {
    const result = parseAuctionWindow({ ...form, timezone: "Europe/Madrid" }, { now });
    expect(result.ok && result.data.startsAt.toISOString()).toBe("2026-12-05T18:00:00.000Z");
  });

  it("requires the start to be in the future (by the given clock)", () => {
    const result = parseAuctionWindow({ ...form, startsAt: "2026-12-01T11:59", endsAt: "2026-12-01T13:00" }, { now });
    expect(!result.ok && result.fieldErrors.startsAt).toEqual(["El inicio debe ser en el futuro."]);
    // …unless the start isn't being changed (editing a published auction's end, for example)
    expect(parseAuctionWindow({ ...form, startsAt: "2026-12-01T11:59", endsAt: "2026-12-01T13:00" }, { now, requireFutureStart: false }).ok).toBe(true);
  });

  it("requires the end at least 5 minutes after the start, and at most 60 days", () => {
    expect(!parseAuctionWindow({ ...form, endsAt: "2026-12-05T19:04" }, { now }).ok).toBe(true);
    expect(parseAuctionWindow({ ...form, endsAt: "2026-12-05T19:05" }, { now }).ok).toBe(true);
    const tooLong = parseAuctionWindow({ ...form, endsAt: "2027-02-04T19:01" }, { now });
    expect(!tooLong.ok && tooLong.fieldErrors.endsAt).toEqual(["Una subasta puede durar como máximo 60 días."]);
  });

  it("rejects a time skipped by DST in the chosen zone", () => {
    const result = parseAuctionWindow({ timezone: "America/New_York", startsAt: "2027-03-14T02:30", endsAt: "2027-03-14T05:00" }, { now });
    expect(!result.ok && result.fieldErrors.startsAt?.[0]).toMatch(/no existe/);
  });

  it("rejects zones outside the list and empty values", () => {
    expect(!parseAuctionWindow({ ...form, timezone: "Asia/Tokyo" }, { now }).ok).toBe(true);
    const empty = parseAuctionWindow({ timezone: "America/Mexico_City", startsAt: "", endsAt: "" }, { now });
    expect(!empty.ok && Object.keys(empty.fieldErrors).sort()).toEqual(["endsAt", "startsAt"]);
  });
});

describe("parseAuctionWindowForEdit", () => {
  const currentStartsAt = new Date("2026-11-20T18:00:00.000Z"); // a draft whose start already passed

  it("lets a draft keep its past start while other fields change", () => {
    const result = parseAuctionWindowForEdit({ timezone: "America/Mexico_City", startsAt: "2026-11-20T12:00", endsAt: "2026-11-20T15:00" }, { now, currentStartsAt });
    expect(result.ok).toBe(true);
  });

  it("requires a future start when the start changes, reporting every problem at once", () => {
    const result = parseAuctionWindowForEdit({ timezone: "America/Mexico_City", startsAt: "2020-01-01T10:00", endsAt: "2030-12-20T21:30" }, { now, currentStartsAt });
    expect(!result.ok && result.fieldErrors).toEqual({
      startsAt: ["El inicio debe ser en el futuro."],
      endsAt: ["Una subasta puede durar como máximo 60 días."],
    });
  });

  it("treats a change of timezone as a change of start", () => {
    const result = parseAuctionWindowForEdit({ timezone: "Europe/Madrid", startsAt: "2026-11-20T12:00", endsAt: "2026-11-20T15:00" }, { now, currentStartsAt });
    expect(!result.ok && result.fieldErrors.startsAt).toEqual(["El inicio debe ser en el futuro."]);
  });
});

describe("parseAuctionText", () => {
  it("trims and validates title and description", () => {
    const result = parseAuctionText({ title: "  Subasta de invierno ", description: " Piezas únicas " });
    expect(result.ok && result.data).toEqual({ title: "Subasta de invierno", description: "Piezas únicas" });
    expect(parseAuctionText({ title: "ab", description: "" }).ok).toBe(false);
  });
});

describe("displayState and permissions", () => {
  const window = { startsAt: new Date("2026-12-06T01:00:00.000Z"), endsAt: new Date("2026-12-06T03:30:00.000Z") };
  const before = new Date("2026-12-06T00:59:59.999Z");
  const during = new Date("2026-12-06T01:00:00.000Z");
  const after = new Date("2026-12-06T03:30:00.000Z");

  it("derives the state from status and the clock", () => {
    expect(displayState({ status: "draft", ...window }, during)).toBe("draft");
    expect(displayState({ status: "cancelled", ...window }, during)).toBe("cancelled");
    expect(displayState({ status: "published", ...window }, before)).toBe("upcoming");
    expect(displayState({ status: "published", ...window }, during)).toBe("live");
    expect(displayState({ status: "published", ...window }, after)).toBe("ended");
  });

  it("locks the window once a published auction starts", () => {
    expect(permissions({ status: "published", ...window }, before)).toMatchObject({ editWindow: true, unpublish: true, cancel: true, publish: false });
    expect(permissions({ status: "published", ...window }, during)).toMatchObject({ editWindow: false, editProducts: false, editProductContent: true, editText: true, unpublish: false, cancel: true });
    expect(permissions({ status: "published", ...window }, after)).toMatchObject({ editWindow: false, editText: true, cancel: false });
  });

  it("keeps drafts editable even after their dates pass, and cancelled auctions read-only", () => {
    expect(permissions({ status: "draft", ...window }, after)).toMatchObject({ editWindow: true, publish: true, deleteDraft: true });
    expect(permissions({ status: "cancelled", ...window }, before)).toEqual({
      editText: false,
      editWindow: false,
      editProducts: false,
      editProductContent: false,
      publish: false,
      unpublish: false,
      cancel: false,
      deleteDraft: false,
    });
  });
});

describe("publishProblems", () => {
  const draft = { status: "draft" as const, startsAt: new Date("2026-12-06T01:00:00.000Z"), endsAt: new Date("2026-12-06T03:30:00.000Z") };

  it("requires products with photos and a future start", () => {
    expect(publishProblems({ ...draft, productCount: 0, productsWithoutImages: 0 }, now)).toEqual(["Agrega al menos un producto."]);
    expect(publishProblems({ ...draft, productCount: 3, productsWithoutImages: 2 }, now)).toEqual(["2 productos no tienen fotos."]);
    expect(publishProblems({ ...draft, productCount: 3, productsWithoutImages: 0 }, now)).toEqual([]);
    expect(publishProblems({ ...draft, productCount: 3, productsWithoutImages: 0 }, new Date("2026-12-06T01:00:00.000Z"))).toEqual([
      "La hora de inicio ya pasó. Cambia la fecha antes de publicar.",
    ]);
  });
});

describe("groupByPhase", () => {
  const at = (s: string, e: string, id: string) => ({ id, startsAt: new Date(s), endsAt: new Date(e) });
  it("splits by phase and sorts each group", () => {
    const list = [
      at("2026-12-10T00:00Z", "2026-12-11T00:00Z", "later"),
      at("2026-11-01T00:00Z", "2026-11-02T00:00Z", "old"),
      at("2026-12-02T00:00Z", "2026-12-03T00:00Z", "soon"),
      at("2026-11-30T00:00Z", "2026-12-05T00:00Z", "live-long"),
      at("2026-11-30T00:00Z", "2026-12-01T20:00Z", "live-short"),
      at("2026-11-20T00:00Z", "2026-11-25T00:00Z", "recent"),
    ];
    const g = groupByPhase(list, now);
    expect(g.live.map((a) => a.id)).toEqual(["live-short", "live-long"]);
    expect(g.upcoming.map((a) => a.id)).toEqual(["soon", "later"]);
    expect(g.ended.map((a) => a.id)).toEqual(["recent", "old"]);
  });
});

describe("slugs", () => {
  it("makes readable ASCII slugs from Spanish titles", () => {
    expect(slugify("Subasta de Año Nuevo: ¡Arte & Diseño!")).toBe("subasta-de-ano-nuevo-arte-diseno");
    expect(slugify("¡¡¡")).toBe("subasta");
    expect(slugify("a".repeat(100)).length).toBe(80);
  });

  it("finds the first free slug", () => {
    expect(uniqueSlug("arte", [])).toBe("arte");
    expect(uniqueSlug("arte", ["arte", "arte-2"])).toBe("arte-3");
  });
});
