import SearchPage from "@/components/SearchPage";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">App Vitals</h1>
          <p className="text-gray-500 text-sm mt-1">
            Look up App Store and Google Play metadata side by side.
          </p>
        </div>
        <SearchPage />
      </div>
    </main>
  );
}
