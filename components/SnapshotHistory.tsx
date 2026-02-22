import type { Snapshot } from "@/types/app-data";

const WIDTH = 120;
const HEIGHT = 32;
const STROKE = "#6366f1";
const STROKE_WIDTH = 1.5;

function Sparkline({ data, label }: { data: number[]; label: string }) {
  let content: React.ReactNode;

  if (data.length === 1) {
    content = (
      <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={2} fill={STROKE} />
    );
  } else {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * WIDTH;
        const y =
          range === 0
            ? HEIGHT / 2
            : HEIGHT - ((v - min) / range) * HEIGHT;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    content = (
      <polyline
        points={points}
        fill="none"
        stroke={STROKE}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
}

export default function SnapshotHistory({
  snapshots,
  store,
}: SnapshotHistoryProps) {
  if (snapshots.length === 0) return null;

  const ratings = snapshots.map((s) => s.score);
  const reviews = snapshots.map((s) => s.reviewCount);
  const installs = snapshots
    .filter((s) => s.minInstalls !== undefined)
    .map((s) => s.minInstalls as number);

  return (
    <div className="pt-4 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-400 mb-3">
        History · {snapshots.length} snapshot{snapshots.length > 1 ? "s" : ""}
      </p>
      <div className="flex flex-wrap gap-6">
        <Sparkline data={ratings} label="Rating" />
        <Sparkline data={reviews} label="Reviews" />
        {store === "android" && installs.length > 0 && (
          <div data-testid="sparkline-installs">
            <Sparkline data={installs} label="Installs" />
          </div>
        )}
      </div>
    </div>
  );
}
