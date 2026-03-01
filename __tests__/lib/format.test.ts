/**
 * @jest-environment node
 */
import { buildAxisFormat, formatCount, formatDelta } from "@/lib/format";

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

describe("buildAxisFormat", () => {
  it("returns base when min equals max", () => {
    const base = (n: number) => `${n}`;
    const fmt = buildAxisFormat(5, 5, base);
    expect(fmt).toBe(base);
  });

  it("returns base when base already produces distinct labels", () => {
    const base = formatCount;
    const fmt = buildAxisFormat(1_000, 2_000, base);
    expect(fmt).toBe(base);
    expect(fmt(1_000)).toBe("1k");
    expect(fmt(2_000)).toBe("2k");
  });

  it("increases precision for ratings that collapse under base formatter", () => {
    // 4.71 and 4.72 both round to "4.7" at 1dp; toFixed(2) makes them distinct
    const base = (n: number) => n.toFixed(1);
    const fmt = buildAxisFormat(4.71, 4.72, base);
    expect(fmt(4.71)).not.toBe(fmt(4.72));
    expect(fmt(4.71)).toBe("4.71");
    expect(fmt(4.72)).toBe("4.72");
  });

  it("falls back to toLocaleString for large counts with indistinguishable k notation", () => {
    // Two values differing by only 1 share the same k representation up to 4dp
    // Use values that force the loop to exhaust and fall back
    const base = formatCount;
    // 1000001 and 1000002 — both collapse to "1M" at any reasonable decimal count
    // buildAxisFormat should fall back to toLocaleString
    const fmt = buildAxisFormat(1_000_001, 1_000_002, base);
    // Both should produce distinct strings via toLocaleString
    expect(fmt(1_000_001)).not.toBe(fmt(1_000_002));
  });

  it("increases k decimal places until labels are distinct", () => {
    // 1234500 and 1234600 — formatCount produces "1.2M" for both at 1dp
    // buildAxisFormat should find 2dp gives "1.23M" vs "1.23M" → maybe 3dp or 4dp
    const fmt = buildAxisFormat(1_234_500, 1_234_600, formatCount);
    expect(fmt(1_234_500)).not.toBe(fmt(1_234_600));
  });
});
