import type { HealthCheckSnapshot } from '../types/healthCheck';

/**
 * Portaldot V3 go-live marker.
 *
 * Source: official @PortaldotL0 / @Portaldot_Dev posts, 23 Oct 2026:
 * rollout scheduled 23 Oct 2026, 23:00 UTC, which is 24 Oct 2026, 06:00 WIB.
 * The marker is derived, never stored: existing snapshot schemas are untouched,
 * so old exports and the report verifier keep working unchanged.
 *
 * Why it exists: a snapshot taken before go-live and one taken after it are
 * not the same network era, even when the endpoint URL is identical. Tagging
 * the era makes that visible instead of letting a reader silently compare
 * across an upgrade boundary. It never changes a verdict on its own.
 */

/** 23 Oct 2026, 23:00 UTC, as a millisecond timestamp. */
export const PORTALDOT_V3_GO_LIVE_MS = Date.UTC(2026, 9, 23, 23, 0, 0);

export const PORTALDOT_V3_GO_LIVE_LABEL =
  '24 Oct 2026, 06:00 WIB (23 Oct 2026, 23:00 UTC)';

export type V3Era = 'pre_v3' | 'post_v3';

export function getV3Era(timestamp: number): V3Era {
  return timestamp < PORTALDOT_V3_GO_LIVE_MS ? 'pre_v3' : 'post_v3';
}

export function v3EraLabel(era: V3Era): string {
  return era === 'pre_v3' ? 'Pre-V3' : 'Post-V3';
}

export interface V3Crossing {
  preSnapshotId: string;
  postSnapshotId: string;
  preCount: number;
  postCount: number;
}

/**
 * Find a V3 boundary crossing inside a snapshot list, if the list contains
 * snapshots from both eras. Returns null when every snapshot is in one era,
 * which is the normal case for a session started after go-live.
 */
export function detectV3Crossing(snapshots: HealthCheckSnapshot[]): V3Crossing | null {
  const ordered = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const pre = ordered.filter((s) => getV3Era(s.timestamp) === 'pre_v3');
  const post = ordered.filter((s) => getV3Era(s.timestamp) === 'post_v3');
  if (pre.length === 0 || post.length === 0) return null;
  return {
    preSnapshotId: pre[pre.length - 1].id,
    postSnapshotId: post[0].id,
    preCount: pre.length,
    postCount: post.length,
  };
}

/** One-line, human-readable summary of the eras present in a snapshot list. */
export function describeV3Eras(snapshots: HealthCheckSnapshot[]): string {
  const crossing = detectV3Crossing(snapshots);
  if (crossing) {
    return (
      `This session crosses the Portaldot V3 go-live (${PORTALDOT_V3_GO_LIVE_LABEL}): ` +
      `${crossing.preCount} Pre-V3 check(s), ${crossing.postCount} Post-V3 check(s). ` +
      `Trends are still computed over the whole session, but a change across this boundary may reflect the upgrade, not a node fault.`
    );
  }
  if (snapshots.length === 0) return '';
  const era = getV3Era([...snapshots].sort((a, b) => a.timestamp - b.timestamp)[0].timestamp);
  if (era === 'post_v3') {
    return `All checks in this session are Post-V3 (go-live ${PORTALDOT_V3_GO_LIVE_LABEL}).`;
  }
  return `All checks in this session are Pre-V3 (before go-live ${PORTALDOT_V3_GO_LIVE_LABEL}).`;
}
