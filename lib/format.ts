/**
 * Format a large count (reviews, installs) with a compact k/M suffix.
 * One decimal place is shown when non-zero, so close values produce distinct labels.
 * Examples: 12000 → "12k", 724123 → "724.1k", 2300000 → "2.3M", 500000000 → "500M"
 */
export function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

/**
 * Format a delta using the same formatter as the series.
 * Examples: +1200 with formatCount → "+1.2k", -300 with formatCount → "-300"
 */
export function formatDelta(delta: number, format: (n: number) => string): string {
  if (delta === 0) return "0";
  return (delta > 0 ? "+" : "-") + format(Math.abs(delta));
}

/**
 * Returns a format function that guarantees min and max produce distinct labels.
 * When the base formatter collapses both to the same string, increases precision
 * until they differ (or falls back to raw toLocaleString).
 */
export function buildAxisFormat(
  min: number,
  max: number,
  base: (n: number) => string
): (n: number) => string {
  if (min === max) return base;
  if (base(min) !== base(max)) return base;

  if (max < 100) {
    // toFixed(2) is the maximum useful precision for ratings.
    // Values indistinguishable at 2dp are noise — labelsDistinct will flatten them.
    const fmt = (n: number) => n.toFixed(2);
    if (fmt(min) !== fmt(max)) return fmt;
  } else {
    // Large count: increase decimal places in k/M notation
    const divisor = max >= 1_000_000 ? 1_000_000 : 1_000;
    const suffix = max >= 1_000_000 ? "M" : "k";
    for (let d = 2; d <= 4; d++) {
      const fmt = (n: number) =>
        `${(n / divisor).toFixed(d).replace(/\.?0+$/, "")}${suffix}`;
      if (fmt(min) !== fmt(max)) return fmt;
    }
    return (n: number) => n.toLocaleString();
  }
  return base;
}
