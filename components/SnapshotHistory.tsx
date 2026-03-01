import type { ReactNode } from "react";
import type { Snapshot } from "@/types/app-data";
import { buildAxisFormat, formatCount } from "@/lib/format";

const WIDTH = 260;
const HEIGHT = 80;
const PAD_LEFT = 30;
const PAD_Y = 6;
const STROKE = "#6366f1";
const STROKE_WIDTH = 1.5;
const chartW = WIDTH - PAD_LEFT;
const chartH = HEIGHT - PAD_Y * 2;


function Sparkline({
  data,
  label,
  color,
  format,
}: {
  data: number[];
  label: string;
  color?: string;
  format: (n: number) => string;
}) {
  const stroke = color ?? STROKE;
  let content: ReactNode;

  if (data.length === 1) {
    content = (
      <circle cx={PAD_LEFT + chartW / 2} cy={PAD_Y + chartH / 2} r={2} fill={stroke} />
    );
  } else {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const axisFmt = buildAxisFormat(min, max, format);

    // If the formatter still can't produce distinct labels (e.g. floating-point noise),
    // treat the chart as flat: flatten the line and show one centered label.
    const labelsDistinct = range > 0 && axisFmt(min) !== axisFmt(max);
    const effectiveRange = labelsDistinct ? range : 0;

    const points = data
      .map((v, i) => {
        const x = PAD_LEFT + (i / (data.length - 1)) * chartW;
        const y =
          effectiveRange === 0
            ? PAD_Y + chartH / 2
            : PAD_Y + chartH - ((v - min) / effectiveRange) * chartH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const axisLabels =
      !labelsDistinct || effectiveRange === 0 ? (
        // Flat (or indistinguishable range): one centered label
        <text
          x={PAD_LEFT - 2}
          y={PAD_Y + chartH / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={9}
          fill="#9ca3af"
        >
          {axisFmt(min)}
        </text>
      ) : (
        // Distinct range: max at top, min at bottom
        <>
          <text
            x={PAD_LEFT - 2}
            y={PAD_Y}
            textAnchor="end"
            dominantBaseline="hanging"
            fontSize={9}
            fill="#9ca3af"
          >
            {axisFmt(max)}
          </text>
          <text
            x={PAD_LEFT - 2}
            y={HEIGHT - PAD_Y}
            textAnchor="end"
            dominantBaseline="auto"
            fontSize={9}
            fill="#9ca3af"
          >
            {axisFmt(min)}
          </text>
        </>
      );

    content = (
      <>
        {axisLabels}
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-gray-400">{label}</p>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-label={`${label} trend`}
      >
        {content}
      </svg>
    </div>
  );
}

interface SnapshotHistoryProps {
  snapshots: Snapshot[];
  store: "ios" | "android";
  color?: string;
}

export default function SnapshotHistory({
  snapshots,
  store,
  color,
}: SnapshotHistoryProps) {
  if (snapshots.length === 0) return null;

  const ratings = snapshots.map((s) => s.score);
  const reviews = snapshots.map((s) => s.reviewCount);
  // TypeScript cannot narrow optional properties through .filter(); cast is safe here.
  const installs = snapshots
    .filter((s) => s.minInstalls !== undefined)
    .map((s) => s.minInstalls as number);

  return (
    <div className="pt-4 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-400 mb-3">
        History · {snapshots.length} snapshot{snapshots.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-6">
        {/* toFixed(2) as base: shows "4.70"/"4.73" for normal variation without needing adaptive path */}
        <Sparkline data={ratings} label="Rating" format={(n) => n.toFixed(2)} color={color} />
        <Sparkline data={reviews} label="Reviews" format={formatCount} color={color} />
        {store === "android" && installs.length > 0 && (
          <Sparkline data={installs} label="Installs" format={formatCount} color={color} />
        )}
      </div>
    </div>
  );
}
