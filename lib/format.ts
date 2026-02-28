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

