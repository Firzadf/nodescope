/**
 * 404 page for unknown routes. main.tsx renders this when the path matches
 * no known route (/, /app*, /verify*, /mainnet*, /docs*, /judges*).
 * Nothing here fetches, measures, or signs — it only points the visitor
 * back to a real page.
 */
export function NotFoundPage() {
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-white">404</h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          This page does not exist. NodeScope lives on the routes below — everything else is not a page.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="/" className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
            Back to landing
          </a>
          <a href="/app" className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium">
            Open the app
          </a>
          <a href="/judges" className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium">
            60-second judges path
          </a>
        </div>
      </div>
    </div>
  );
}
