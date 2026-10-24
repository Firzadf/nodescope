import { ReportVerifier } from '../components/diagnostics/ReportVerifier';

/**
 * Public report verification page, at /verify.
 * No account, no wallet, no upload: the file is read and hashed locally
 * in the visitor's browser, exactly like the Verify panel inside the app.
 * This page exists so a reviewer can be sent one link and check a report
 * without opening the full toolkit first.
 */
export function VerifyPage() {
  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <header className="border-b border-line px-4 py-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-white">NodeScope</span>
          </a>
          <nav className="flex items-center gap-5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <a href="/" className="transition-colors hover:text-white">Landing</a>
            <a href="/app" className="transition-colors hover:text-white">Launch App</a>
            <a href="/mainnet" className="transition-colors hover:text-white">Mainnet Profile</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Verify</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Check a report, without an account.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Drop a NodeScope diagnostic report JSON file below. Its SHA-256 integrity stamp is
          recomputed locally in your browser and compared with the stamp it was exported with.
          Nothing is uploaded, nothing is signed, and no wallet is needed. Verification proves
          the file matches its stamp, it does not prove the node data inside it was true.
        </p>
        <div className="mt-8">
          <ReportVerifier />
        </div>
      </main>
    </div>
  );
}
