// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { JudgesPage } from './JudgesPage';
import {
  ANCHORED_REPORTS,
  REGISTRY_CONTRACT,
  SUPPLEMENT_ANCHOR_TX,
  SUPPLEMENT_REPORT_HASH,
} from '../utils/siteConstants';

afterEach(() => cleanup());

describe('JudgesPage anchors', () => {
  it('shows all three anchors with their own verify links and report files', () => {
    const { container } = render(<JudgesPage />);
    const scope = within(container);
    for (const anchor of ANCHORED_REPORTS) {
      expect(scope.getByText(anchor.label)).toBeTruthy();
      expect(scope.getByText(anchor.hash)).toBeTruthy();
      expect(scope.getByText(anchor.tx)).toBeTruthy();
    }
    const verifyLinks = scope.getAllByRole('link', { name: 'Check this anchor on /verify' });
    expect(verifyLinks).toHaveLength(ANCHORED_REPORTS.length);
    ANCHORED_REPORTS.forEach((anchor, i) => {
      const href = verifyLinks[i].getAttribute('href') || '';
      expect(href).toContain(`hash=${anchor.hash}`);
      expect(href).toContain(`contract=${REGISTRY_CONTRACT}`);
      expect(href).toContain(`tx=${anchor.tx}`);
    });
    const reportLinks = scope.getAllByRole('link', { name: 'Download the anchored report' });
    expect(reportLinks).toHaveLength(ANCHORED_REPORTS.length);
    ANCHORED_REPORTS.forEach((anchor, i) => {
      expect(reportLinks[i].getAttribute('href')).toBe(anchor.reportFile);
    });
  });

  it('states the updated limitations, not the old single-anchor line', () => {
    const { container } = render(<JudgesPage />);
    const scope = within(container);
    expect(
      scope.getAllByText(/Three reports are anchored on the current registry/),
    ).toHaveLength(2);
    expect(scope.queryByText('Exactly one report is anchored so far.')).toBeNull();
    expect(
      scope.getByText(/deploy transaction is not listed because it was not recorded/),
    ).toBeTruthy();
  });

  it('keeps the supplement anchor and the unanchored sample', () => {
    const { container } = render(<JudgesPage />);
    const scope = within(container);
    expect(scope.getByText(SUPPLEMENT_REPORT_HASH)).toBeTruthy();
    expect(scope.getByText(SUPPLEMENT_ANCHOR_TX)).toBeTruthy();
    expect(scope.getByText(/The sample report above is not anchored/)).toBeTruthy();
  });
});
