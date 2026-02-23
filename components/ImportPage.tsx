"use client";

import { useState } from "react";

const EXPECTED_HEADERS = "store,app_id,saved_at,score,review_count,min_installs";
const MAX_ROWS = 1000;

type ParsedRow = {
  store: string;
  appId: string;
  savedAt: string;
  score: number;
  reviewCount: number;
  minInstalls?: number;
};

type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; error: string };

function parseCsv(text: string): ParseResult {
  // Strip UTF-8 BOM that Excel and some exporters prepend.
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.trim().split("\n");
  if (lines.length === 0) return { ok: false, error: "File is empty." };

  const header = lines[0].trim().replace(/\r$/, "");
  if (header !== EXPECTED_HEADERS) {
    return {
      ok: false,
      error: `Invalid headers. Expected:\n${EXPECTED_HEADERS}`,
    };
  }

  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
  if (dataLines.length === 0) return { ok: false, error: "File has no data rows." };
  if (dataLines.length > MAX_ROWS) {
    return { ok: false, error: `File exceeds ${MAX_ROWS} row limit (found ${dataLines.length}).` };
  }

  const rows: ParsedRow[] = dataLines.map((line) => {
    const [store, app_id, saved_at, score, review_count, min_installs] =
      line.replace(/\r$/, "").split(",");
    return {
      store: store?.trim() ?? "",
      appId: app_id?.trim() ?? "",
      savedAt: saved_at?.trim() ?? "",
      score: parseFloat(score ?? ""),
      reviewCount: parseInt(review_count ?? "", 10),
      ...(min_installs?.trim() ? { minInstalls: parseInt(min_installs, 10) } : {}),
    };
  });

  return { ok: true, rows };
}

export default function ImportPage() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setSubmitError(null);
    if (!file) {
      setParseResult(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== "string") return;
      setParseResult(parseCsv(text));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parseResult?.ok || submitting) return;

    setSubmitting(true);
    setResult(null);
    setSubmitError(null);

    try {
      const res = await fetch("/api/snapshots/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parseResult.rows }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? "Import failed.");
        return;
      }

      const data = await res.json() as { inserted: number; skipped: number };
      setResult(data);
    } catch {
      setSubmitError("Could not reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canImport = parseResult?.ok === true && !submitting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Import history</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV of historical ratings and reviews to populate trend charts.{" "}
          <a
            href="https://github.com/cjbackman/app-vitals"
            className="text-indigo-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            See format
          </a>
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Expected columns</p>
          <code className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            {EXPECTED_HEADERS}
          </code>
        </div>

        <div>
          <label htmlFor="csv-file" className="text-sm font-medium text-gray-700">
            CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        {parseResult && !parseResult.ok && (
          <p className="text-sm text-red-600">{parseResult.error}</p>
        )}

        {parseResult?.ok && (
          <p className="text-sm text-gray-600">
            {parseResult.rows.length} row{parseResult.rows.length !== 1 ? "s" : ""} ready to import.
            <span className="ml-1 text-xs text-gray-400">
              (Duplicate detection matches exact timestamp.)
            </span>
          </p>
        )}

        <button
          onClick={handleImport}
          disabled={!canImport}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Importing…" : "Import"}
        </button>

        {result && (
          <p className="text-sm font-medium text-green-700" role="status">
            Inserted {result.inserted} · Skipped {result.skipped} duplicate
            {result.skipped !== 1 ? "s" : ""}
          </p>
        )}

        {submitError && (
          <p className="text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}
      </div>
    </div>
  );
}
