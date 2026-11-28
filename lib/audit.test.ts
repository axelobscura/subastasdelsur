import { describe, expect, it } from "vitest";
import { diffFields } from "./audit";

describe("diffFields", () => {
  const before = { title: "Invierno", listed: true, startsAt: new Date("2026-12-06T01:00:00.000Z"), price: 1500 };

  it("lists only the fields that changed, dates as ISO strings", () => {
    expect(diffFields(before, { title: "Invierno 2026", listed: true, startsAt: new Date("2026-12-06T00:00:00.000Z") }, ["title", "listed", "startsAt"])).toEqual({
      title: ["Invierno", "Invierno 2026"],
      startsAt: ["2026-12-06T01:00:00.000Z", "2026-12-06T00:00:00.000Z"],
    });
  });

  it("ignores keys that weren't submitted and unchanged dates", () => {
    expect(diffFields(before, { startsAt: new Date("2026-12-06T01:00:00.000Z") }, ["title", "startsAt", "price"])).toEqual({});
  });
});
