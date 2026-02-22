"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { isApiError } from "@/types/app-data";
import type { AppData, ApiError, Snapshot } from "@/types/app-data";
import SnapshotHistory from "@/components/SnapshotHistory";

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden>
      <path fill="#4285F4" d="M.435.875L12.5 11.046l3.902-3.902L3.175.144C2.458-.277 1.232-.046.435.875z" />
      <path fill="#EA4335" d="M.435 23.11L12.5 11.954l-3.902-3.902L.435 21.982a1.946 1.946 0 0 0 0 1.128z" />
      <path fill="#FBBC04" d="M22.5 10.583l-2.914-1.66-3.066 2.077 3.066 2.077 2.914-1.66c.83-.472.83-2.362 0-2.834z" />
      <path fill="#34A853" d="M.435 23.11c.797.92 2.023 1.152 2.74.731l13.227-7.534-3.902-3.353z" />
    </svg>
  );
}

const STORE_ICONS = {
  ios: <AppleIcon />,
  android: <GooglePlayIcon />,
};

function formatPrice(price: AppData["price"]): string {
  if (price.type === "free") return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
  }).format(price.amount);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatReviewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

interface AppCardProps {
  store: "ios" | "android";
  data: AppData | ApiError | null;
  loading?: boolean;
  appId?: string;
}

const STORE_LABELS = {
  ios: "App Store",
  android: "Google Play",
};

export default function AppCard({ store, data, loading, appId }: AppCardProps) {
  const label = STORE_LABELS[store];

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the "Saved!" timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Fetch snapshot history whenever the loaded app changes.
  useEffect(() => {
    if (!appId || !data || isApiError(data)) {
      setSnapshots([]);
      return;
    }

    const controller = new AbortController();
    fetch(
      `/api/snapshots?store=${store}&appId=${encodeURIComponent(appId)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => setSnapshots(d))
      .catch(() => {}); // Snapshot history is best-effort

    return () => controller.abort();
  }, [store, appId, data]);

  async function handleSave() {
    if (!data || isApiError(data) || !appId || saving) return;

    setSaving(true);
    try {
      await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          appId,
          score: data.score,
          reviewCount: data.reviewCount,
          ...(store === "android" && data.minInstalls !== undefined
            ? { minInstalls: data.minInstalls }
            : {}),
        }),
      });

      // Re-fetch history after save.
      const res = await fetch(
        `/api/snapshots?store=${store}&appId=${encodeURIComponent(appId)}`
      );
      const updated = await res.json();
      setSnapshots(updated);

      setSaved(true);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently fail — save error shouldn't crash the card.
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-1.5 text-gray-400">
          {STORE_ICONS[store]}
          <p className="text-sm font-medium">{label}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-200" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    );
  }

  if (!data) return null;

  // Error state
  if (isApiError(data)) {
    const messages: Record<ApiError["code"], string> = {
      APP_NOT_FOUND: "App not found. Check the ID and try again.",
      INVALID_APP_ID: "Invalid app ID format.",
      SCRAPER_ERROR: "Could not reach the store. Try again later.",
    };
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-2">
        <div className="flex items-center gap-1.5 text-gray-500">
          {STORE_ICONS[store]}
          <p className="text-sm font-medium">{label}</p>
        </div>
        <p className="text-red-700 text-sm">{messages[data.code]}</p>
      </div>
    );
  }

  const saveLabel = saving ? "Saving…" : saved ? "Saved!" : "Save snapshot";

  return (
    <div className="rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-400">
          {STORE_ICONS[store]}
          <p className="text-sm font-medium">{label}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !appId}
          className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {saveLabel}
        </button>
      </div>

      <div className="flex items-center gap-4">
        <Image
          src={data.icon}
          alt={`${data.title} icon`}
          width={64}
          height={64}
          className="rounded-2xl flex-shrink-0"
        />
        <div>
          <h2 className="font-semibold text-gray-900 text-lg leading-tight">
            {data.title}
          </h2>
          <p className="text-sm text-gray-500">{data.developer}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-400">Rating</p>
          <p className="font-medium text-gray-900">
            {data.score.toFixed(1)} / 5
          </p>
        </div>
        <div>
          <p className="text-gray-400">Reviews</p>
          <p className="font-medium text-gray-900">
            {formatReviewCount(data.reviewCount)}
          </p>
        </div>
        <div>
          <p className="text-gray-400">Version</p>
          <p className="font-medium text-gray-900">{data.version}</p>
        </div>
        <div>
          <p className="text-gray-400">Price</p>
          <p className="font-medium text-gray-900">{formatPrice(data.price)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-gray-400">Updated</p>
          <p className="font-medium text-gray-900">{formatDate(data.updatedAt)}</p>
        </div>
      </div>

      {data.storeUrl && (
        <a
          href={data.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-600 hover:underline"
        >
          View in {label} →
        </a>
      )}

      <SnapshotHistory snapshots={snapshots} store={store} />
    </div>
  );
}
