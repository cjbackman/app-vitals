import Image from "next/image";
import type { AppData, ApiError } from "@/types/app-data";

function formatPrice(price: AppData["price"]): string {
  if (price.type === "free") return "Free";
  return `$${price.amount.toFixed(2)}`;
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
}

const STORE_LABELS = {
  ios: "App Store",
  android: "Google Play",
};

export default function AppCard({ store, data, loading }: AppCardProps) {
  const label = STORE_LABELS[store];

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 p-6 space-y-4 animate-pulse">
        <p className="text-sm font-medium text-gray-400">{label}</p>
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
  if ("code" in data) {
    const messages: Record<ApiError["code"], string> = {
      APP_NOT_FOUND: "App not found. Check the ID and try again.",
      INVALID_APP_ID: "Invalid app ID format.",
      SCRAPER_ERROR: "Could not reach the store. Try again later.",
    };
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-red-700 text-sm">{messages[data.code]}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-6 space-y-4">
      <p className="text-sm font-medium text-gray-400">{label}</p>

      <div className="flex items-center gap-4">
        <Image
          src={data.icon}
          alt={`${data.title} icon`}
          width={64}
          height={64}
          className="rounded-2xl flex-shrink-0"
          unoptimized
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

      <a
        href={data.storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs text-blue-600 hover:underline"
      >
        View in {label} →
      </a>
    </div>
  );
}
