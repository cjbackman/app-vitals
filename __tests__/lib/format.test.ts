/**
 * @jest-environment node
 */
import { formatCount, formatDelta } from "@/lib/format";

describe("formatCount", () => {
  it("returns plain number for values under 1000", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("formats round thousands with lowercase k and no decimal", () => {
    expect(formatCount(1_000)).toBe("1k");
    expect(formatCount(12_000)).toBe("12k");
  });

  it("formats non-round thousands with 1 decimal so close values are distinct", () => {
    expect(formatCount(1_500)).toBe("1.5k");
    expect(formatCount(724_123)).toBe("724.1k");
    expect(formatCount(724_890)).toBe("724.9k");
  });

  it("formats round millions with M and no decimal", () => {
    expect(formatCount(1_000_000)).toBe("1M");
    expect(formatCount(500_000_000)).toBe("500M");
  });

  it("formats non-round millions with 1 decimal", () => {
    expect(formatCount(2_300_000)).toBe("2.3M");
    expect(formatCount(1_500_000)).toBe("1.5M");
    expect(formatCount(23_400_000)).toBe("23.4M");
  });
});

describe("formatDelta", () => {
  it("prefixes positive delta with +", () => {
    expect(formatDelta(1200, formatCount)).toBe("+1.2k");
    expect(formatDelta(0.1, (n) => n.toFixed(1))).toBe("+0.1");
  });

  it("prefixes negative delta with - and absolute value", () => {
    expect(formatDelta(-300, formatCount)).toBe("-300");
    expect(formatDelta(-0.2, (n) => n.toFixed(1))).toBe("-0.2");
  });

  it("returns 0 for zero delta", () => {
    expect(formatDelta(0, formatCount)).toBe("0");
  });
});
