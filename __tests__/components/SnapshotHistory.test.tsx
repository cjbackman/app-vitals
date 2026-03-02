import { render, screen } from "@testing-library/react";
import SnapshotHistory from "@/components/SnapshotHistory";
import type { Snapshot } from "@/types/app-data";

const IOS_SNAPSHOT: Snapshot = {
  id: 1,
  store: "ios",
  appId: "com.spotify.client",
  savedAt: "2026-01-01T00:00:00.000Z",
  score: 4.5,
  reviewCount: 12000,
};

const ANDROID_SNAPSHOT: Snapshot = {
  id: 2,
  store: "android",
  appId: "com.spotify.music",
  savedAt: "2026-01-01T00:00:00.000Z",
  score: 4.3,
  reviewCount: 23456789,
};

describe("SnapshotHistory", () => {
  it("renders nothing when snapshots array is empty", () => {
    const { container } = render(
      <SnapshotHistory snapshots={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Rating and Reviews sparklines for iOS", () => {
    render(<SnapshotHistory snapshots={[IOS_SNAPSHOT]} />);

    expect(screen.getByLabelText("Rating trend")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviews trend")).toBeInTheDocument();
  });

  it("does not render Installs sparkline for Android either", () => {
    render(<SnapshotHistory snapshots={[ANDROID_SNAPSHOT]} />);

    expect(screen.queryByLabelText("Installs trend")).not.toBeInTheDocument();
  });

  it("shows snapshot count in header", () => {
    render(
      <SnapshotHistory
        snapshots={[IOS_SNAPSHOT, { ...IOS_SNAPSHOT, id: 3 }]}
      />
    );
    expect(screen.getByText(/2 snapshots/)).toBeInTheDocument();
  });

  it("shows singular 'snapshot' for count of 1", () => {
    render(<SnapshotHistory snapshots={[IOS_SNAPSHOT]} />);
    expect(screen.getByText(/1 snapshot/)).toBeInTheDocument();
    expect(screen.queryByText(/1 snapshots/)).not.toBeInTheDocument();
  });

  it("uses the provided color prop for sparkline strokes", () => {
    const { container } = render(
      <SnapshotHistory
        snapshots={[IOS_SNAPSHOT, { ...IOS_SNAPSHOT, id: 2, score: 4.8 }]}
        color="#FF6700"
      />
    );
    const polylines = container.querySelectorAll("polyline");
    expect(polylines.length).toBeGreaterThan(0);
    polylines.forEach((pl) => {
      expect(pl.getAttribute("stroke")).toBe("#FF6700");
    });
  });

  it("shows two distinct rating labels when variation exceeds 2 decimal places", () => {
    const { container } = render(
      <SnapshotHistory
        snapshots={[
          { ...IOS_SNAPSHOT, score: 4.68 },
          { ...IOS_SNAPSHOT, id: 2, score: 4.73 },
        ]}
      />
    );
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent
    );
    expect(texts).toContain("4.68");
    expect(texts).toContain("4.73");
  });

  it("suppresses y-axis labels for a single snapshot", () => {
    const { container } = render(
      <SnapshotHistory snapshots={[IOS_SNAPSHOT]} />
    );
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("shows one centered label per sparkline when all values are identical (flat line)", () => {
    const { container } = render(
      <SnapshotHistory
        snapshots={[IOS_SNAPSHOT, { ...IOS_SNAPSHOT, id: 2 }]}
      />
    );
    // Two sparklines (Rating, Reviews), each with one centered label = 2 text nodes
    expect(container.querySelectorAll("text")).toHaveLength(2);
  });

  it("flattens the chart line when values cannot be distinguished by the formatter", () => {
    // Scores differ only by floating-point noise — both format to the same label
    const tinyDiff = Number.EPSILON * 4.7;
    const { container } = render(
      <SnapshotHistory
        snapshots={[
          { ...IOS_SNAPSHOT, score: 4.7 },
          { ...IOS_SNAPSHOT, id: 2, score: 4.7 + tinyDiff },
          { ...IOS_SNAPSHOT, id: 3, score: 4.7 },
        ]}
      />
    );
    // Rating sparkline should show one centered label (flat), not two identical labels
    const texts = container.querySelectorAll("text");
    const ratingTexts = Array.from(texts)
      .map((t) => t.textContent)
      .filter((t) => t?.match(/^4\./));
    expect(ratingTexts).toHaveLength(1);
  });

  it("shows two distinct axis labels per sparkline when values clearly differ", () => {
    const { container } = render(
      <SnapshotHistory
        snapshots={[
          { ...IOS_SNAPSHOT, score: 4.0, reviewCount: 700_000 },
          { ...IOS_SNAPSHOT, id: 2, score: 4.8, reviewCount: 750_000 },
        ]}
      />
    );
    // Two sparklines × 2 labels each = 4 text nodes
    expect(container.querySelectorAll("text")).toHaveLength(4);
  });
});
