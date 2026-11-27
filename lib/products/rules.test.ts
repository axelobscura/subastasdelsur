import { describe, expect, it } from "vitest";
import { centsToInput, formatMoney, parseMoneyToCents } from "../money";
import { nextLotNumber, productPricingSchema, reorderImages } from "./rules";

describe("money", () => {
  it.each([
    ["1500", 150000],
    ["1,500.50", 150050],
    ["$ 1 500", 150000],
    ["0.5", 50],
    ["12,345,678.9", 1234567890],
    ["0", 0],
  ])("parses %j as %d cents", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "1.234", "-5", "1,50", "1.5.0", "1,5000", "999999999999"])("rejects %j", (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });

  it("formats and round-trips amounts", () => {
    expect(formatMoney(150050, "MXN")).toBe("$1,500.50");
    expect(centsToInput(150050)).toBe("1500.50");
    expect(centsToInput(150000)).toBe("1500");
    expect(centsToInput(null)).toBe("");
  });
});

describe("productPricingSchema", () => {
  const valid = { lotNumber: "3", startingPrice: "1,500", minIncrement: "100", reservePrice: "" };

  it("parses prices into cents, with an optional reserve", () => {
    expect(productPricingSchema.parse(valid)).toEqual({ lotNumber: 3, startingPrice: 150000, minIncrement: 10000, reservePrice: null });
    expect(productPricingSchema.parse({ ...valid, reservePrice: "2000" }).reservePrice).toBe(200000);
  });

  it("requires a positive increment and a reserve at or above the starting price", () => {
    expect(productPricingSchema.safeParse({ ...valid, minIncrement: "0" }).error?.issues[0].path).toEqual(["minIncrement"]);
    expect(productPricingSchema.safeParse({ ...valid, reservePrice: "1000" }).error?.issues[0].path).toEqual(["reservePrice"]);
  });

  it("validates the lot number", () => {
    expect(productPricingSchema.safeParse({ ...valid, lotNumber: "0" }).success).toBe(false);
    expect(productPricingSchema.safeParse({ ...valid, lotNumber: "1.5" }).success).toBe(false);
  });
});

describe("nextLotNumber", () => {
  it("continues after the highest lot", () => {
    expect(nextLotNumber([])).toBe(1);
    expect(nextLotNumber([1, 2, 5])).toBe(6);
  });
});

describe("reorderImages", () => {
  const ids = ["a", "b", "c"];
  it("moves images and sets the cover", () => {
    expect(reorderImages(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(reorderImages(ids, "b", "down")).toEqual(["a", "c", "b"]);
    expect(reorderImages(ids, "c", "cover")).toEqual(["c", "a", "b"]);
  });
  it("ignores impossible moves", () => {
    expect(reorderImages(ids, "a", "up")).toEqual(ids);
    expect(reorderImages(ids, "c", "down")).toEqual(ids);
    expect(reorderImages(ids, "z", "cover")).toEqual(ids);
  });
});
