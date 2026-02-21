"use client";

import Image from "next/image";
import { PRESET_APPS, type PresetApp } from "@/components/preset-apps";

interface AppPickerProps {
  selectedPreset: PresetApp | null;
  onSelect: (preset: PresetApp) => void;
}

export default function AppPicker({ selectedPreset, onSelect }: AppPickerProps) {
  return (
    <div role="group" aria-label="Quick-pick app" className="flex gap-3 overflow-x-auto pb-1">
      {PRESET_APPS.map((preset) => {
        const isActive = preset === selectedPreset;
        return (
          <button
            key={preset.iosId}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(preset)}
            className={[
              "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-shrink-0",
              isActive
                ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white",
            ].join(" ")}
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gray-100">
              <Image
                src={preset.iconUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="text-xs text-gray-700 whitespace-nowrap">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
