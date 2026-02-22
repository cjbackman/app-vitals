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
  minInstalls: 500000000,
};

describe("SnapshotHistory", () => {
  it("renders nothing when snapshots array is empty", () => {
    const { container } = render(
      <SnapshotHistory snapshots={[]} store="ios" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Rating and Reviews sparklines for iOS", () => {
    render(<SnapshotHistory snapshots={[IOS_SNAPSHOT]} store="ios" />);

    expect(screen.getByLabelText("Rating trend")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviews trend")).toBeInTheDocument();
  });

  it("does not render Installs sparkline for iOS", () => {
    render(<SnapshotHistory snapshots={[IOS_SNAPSHOT]} store="ios" />);

    expect(screen.queryByLabelText("Installs trend")).not.toBeInTheDocument();
  });

  it("renders Rating, Reviews, and Installs sparklines for Android", () => {
    render(
      <SnapshotHistory snapshots={[ANDROID_SNAPSHOT]} store="android" />
    );

    expect(screen.getByLabelText("Rating trend")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviews trend")).toBeInTheDocument();
    expect(screen.getByLabelText("Installs trend")).toBeInTheDocument();
  });

  it("shows snapshot count in header", () => {
    render(
      <SnapshotHistory
        snapshots={[IOS_SNAPSHOT, { ...IOS_SNAPSHOT, id: 3 }]}
        store="ios"
      />
    );
    expect(screen.getByText(/2 snapshots/)).toBeInTheDocument();
  });

  it("shows singular 'snapshot' for count of 1", () => {
    render(<SnapshotHistory snapshots={[IOS_SNAPSHOT]} store="ios" />);
    expect(screen.getByText(/1 snapshot/)).toBeInTheDocument();
    expect(screen.queryByText(/1 snapshots/)).not.toBeInTheDocument();
  });
});
