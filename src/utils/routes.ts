// Top-level route resolution (no router dependency: the app switches on
// window.location.pathname, and vercel.json rewrites all paths to this
// bundle). Trailing slashes are normalized, so /app/fee-lab/ and /fees/
// resolve the same as their slash-less forms. Unknown paths fall back to
// the 404 page, as before.
export type RouteId =
  | 'landing'
  | 'app'
  | 'verify'
  | 'mainnet'
  | 'docs'
  | 'judges'
  | 'fees'
  | 'not-found';

export function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

export function resolveRoute(pathname: string): RouteId {
  const path = normalizePath(pathname);
  if (path === '/' || path === '/index.html') return 'landing';
  if (path === '/app' || path.startsWith('/app/')) return 'app';
  if (path === '/verify' || path.startsWith('/verify/')) return 'verify';
  if (path === '/mainnet' || path.startsWith('/mainnet/')) return 'mainnet';
  if (path === '/docs' || path.startsWith('/docs/')) return 'docs';
  if (path === '/judges' || path.startsWith('/judges/')) return 'judges';
  if (path === '/fees') return 'fees';
  return 'not-found';
}

export const ROUTE_TITLES: Record<RouteId, string> = {
  landing: 'NodeScope — Portaldot Node Health Diagnostics',
  app: 'NodeScope App — Portaldot Node Health Diagnostics',
  verify: 'Verify a report — NodeScope',
  mainnet: 'Mainnet Profile — NodeScope',
  docs: 'NodeScope Docs — Checks, schema, verification',
  judges: 'NodeScope for Judges — 60-second verification',
  fees: 'Is 800x cheaper real? — NodeScope Fees',
  'not-found': 'Page not found — NodeScope',
};
