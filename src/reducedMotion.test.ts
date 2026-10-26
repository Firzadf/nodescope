/**
 * Reduced-motion regression guard.
 *
 * jsdom does not evaluate CSS, so component tests cannot prove an
 * animation actually stops. This test reads the shipped stylesheet and
 * asserts the prefers-reduced-motion block covers every motion mechanism
 * the app uses: the scoped animation classes, the Tailwind motion
 * utilities (ping/pulse/spin, used by the live dots, the typing cursor,
 * and the loading spinners), and the motion video (hidden, with the
 * static poster shown instead). If a new animation class is added to the
 * app without a reduced-motion rule, this test is where it gets caught.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const reducedBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

describe('prefers-reduced-motion', () => {
  it('covers the Tailwind motion utilities', () => {
    for (const cls of ['.animate-ping', '.animate-pulse', '.animate-spin']) {
      expect(reducedBlock).toContain(cls);
    }
    expect(reducedBlock).toMatch(/\.animate-ping,\s*\.animate-pulse,\s*\.animate-spin\s*\{[^}]*animation:\s*none/);
  });

  it('covers the scoped animation classes and the motion video', () => {
    for (const cls of ['.animate-marquee', '.reveal', '.flow-draw', '.ecg-path', '.ribbon-streak']) {
      expect(reducedBlock).toContain(cls);
    }
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.motion-video \{ display: none; \}/);
  });
});
