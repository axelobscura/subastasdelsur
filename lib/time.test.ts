// `npm test` runs this suite under TZ=UTC, TZ=Asia/Tokyo and TZ=America/Los_Angeles.
// Every expectation is an absolute value, so the same assertions passing under all
// three proves the results don't depend on the process timezone.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUCTION_TIMEZONE,
  InvalidTimeZoneError,
  InvalidWallClockError,
  NonexistentLocalTimeError,
  auctionPhase,
  formatAuctionTime,
  instantToWallClock,
  isValidTimeZone,
  wallClockToInstant,
} from "./time";

const MX = DEFAULT_AUCTION_TIMEZONE;

describe("test environment", () => {
  it.runIf(process.env.TZ)("really runs in the requested process timezone", () => {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const expected = process.env.TZ === "UTC" ? ["UTC", "Etc/UTC"] : [process.env.TZ];
    expect(expected).toContain(resolved);
  });
});

describe("wallClockToInstant", () => {
  it("interprets the admin's input in the auction's timezone (Mexico City is UTC-6)", () => {
    expect(wallClockToInstant("2026-12-05T19:00", MX).toISOString()).toBe("2026-12-06T01:00:00.000Z");
  });

  it("gives a different instant for the same input in another zone", () => {
    expect(wallClockToInstant("2026-12-05T19:00", "Europe/Madrid").toISOString()).toBe("2026-12-05T18:00:00.000Z");
    expect(wallClockToInstant("2026-12-05T19:00", "Asia/Tokyo").toISOString()).toBe("2026-12-05T10:00:00.000Z");
  });

  it("accepts seconds", () => {
    expect(wallClockToInstant("2026-12-05T19:00:30", MX).toISOString()).toBe("2026-12-06T01:00:30.000Z");
  });

  it("treats Mexico City as UTC-6 all year (no DST since 2022)", () => {
    expect(wallClockToInstant("2026-07-15T12:00", MX).toISOString()).toBe("2026-07-15T18:00:00.000Z");
    // First Sunday of April, when Mexico used to spring forward: 02:30 exists now.
    expect(wallClockToInstant("2026-04-05T02:30", MX).toISOString()).toBe("2026-04-05T08:30:00.000Z");
  });

  it("rejects a time skipped by DST (New York, 8 Mar 2026, 02:00 → 03:00)", () => {
    expect(() => wallClockToInstant("2026-03-08T02:30", "America/New_York")).toThrow(NonexistentLocalTimeError);
    expect(wallClockToInstant("2026-03-08T03:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("resolves a repeated time (New York, 1 Nov 2026, 01:30 twice) to the earlier instant", () => {
    expect(wallClockToInstant("2026-11-01T01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it.each(["", "2026-12-05", "2026-12-05 19:00", "2026-12-05T19", "2026-02-30T10:00", "2026-12-05T24:00", "2026-12-05T19:60", "1999-12-05T19:00", "05/12/2026 19:00"])(
    "rejects malformed or impossible input %j",
    (value) => {
      expect(() => wallClockToInstant(value, MX)).toThrow(InvalidWallClockError);
    },
  );

  it("rejects an unknown timezone", () => {
    expect(() => wallClockToInstant("2026-12-05T19:00", "Mars/Olympus_Mons")).toThrow(InvalidTimeZoneError);
  });
});

describe("instantToWallClock", () => {
  it("shows an instant as the auction zone's wall-clock time", () => {
    expect(instantToWallClock(new Date("2026-12-06T01:00:00.000Z"), MX)).toBe("2026-12-05T19:00");
  });

  it("round-trips with wallClockToInstant", () => {
    for (const value of ["2026-01-01T00:00", "2026-06-30T23:59", "2027-02-28T08:15"]) {
      expect(instantToWallClock(wallClockToInstant(value, MX), MX)).toBe(value);
    }
  });
});

describe("formatAuctionTime", () => {
  it("formats in the auction zone and names it, whatever the process zone", () => {
    const text = formatAuctionTime(new Date("2026-12-06T01:00:00.000Z"), MX);
    expect(text).toMatch(/5 de diciembre de 2026/);
    expect(text).toMatch(/19:00/);
    expect(text).toMatch(/GMT-6/);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects others", () => {
    expect(isValidTimeZone(MX)).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mexico City")).toBe(false);
  });
});

describe("auctionPhase", () => {
  const start = new Date("2026-12-06T01:00:00.000Z");
  const end = new Date("2026-12-06T03:00:00.000Z");
  const at = (iso: string) => auctionPhase(start, end, new Date(iso));

  it("is upcoming until the start instant", () => {
    expect(at("2026-12-06T00:59:59.999Z")).toBe("upcoming");
  });

  it("is live from the start instant (inclusive) until the end instant (exclusive)", () => {
    expect(at("2026-12-06T01:00:00.000Z")).toBe("live");
    expect(at("2026-12-06T02:59:59.999Z")).toBe("live");
  });

  it("is ended from the end instant", () => {
    expect(at("2026-12-06T03:00:00.000Z")).toBe("ended");
  });
});
