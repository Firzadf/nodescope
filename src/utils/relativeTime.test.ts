import { describe, expect, it } from 'vitest';
import { formatTimeAgo, isStale } from './relativeTime';

const now = 1_800_000_000_000;
describe('formatTimeAgo', () => {
  it('buckets like common monitoring tools', () => {
    expect(formatTimeAgo(now - 3_000, now)).toBe('just now');
    expect(formatTimeAgo(now - 45_000, now)).toBe('45s ago');
    expect(formatTimeAgo(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(formatTimeAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(formatTimeAgo(now - 2 * 86_400_000, now)).toBe('2 d ago');
  });
  it('never goes negative for clock skew', () => {
    expect(formatTimeAgo(now + 5_000, now)).toBe('just now');
  });
  it('marks results an hour old as stale', () => {
    expect(isStale(now - 59 * 60_000, now)).toBe(false);
    expect(isStale(now - 60 * 60_000, now)).toBe(true);
  });
});
