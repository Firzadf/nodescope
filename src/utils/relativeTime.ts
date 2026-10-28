/**
 * Relative "time ago" label, the way Uptime Kuma, Grafana and GitHub show
 * when something last happened. The absolute time stays available as a
 * tooltip; this only answers "how fresh is this?" at a glance.
 */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export function formatTimeAgo(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

export function isStale(timestamp: number, now: number): boolean {
  return now - timestamp >= STALE_AFTER_MS;
}
