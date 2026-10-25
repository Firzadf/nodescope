// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Landing } from '../pages/Landing';
import { JudgesPage } from '../pages/JudgesPage';
import { DocsPage } from '../pages/DocsPage';
import { REPORT_SCHEMA_VERSION } from './reportBuilder';
import {
  ANCHOR_BLOCK,
  ANCHOR_TX,
  ANCHORED_REPORT_HASH,
  PORTALDOT_CHAIN_ID,
  REGISTRY_CONTRACT,
  SITE_TEST_FILES,
  SITE_TESTS,
} from './siteConstants';
import readmeRaw from '../../README.md?raw';
import sampleReport from '../../public/sample-report.json';

// One source of truth, checked everywhere it is shown. If any of these
// fail, a public fact drifted between pages and the constants file —
// fix the constant (or the page), never the test.
// getAllByText is used throughout because a fact can legitimately appear
// in both a card and its parent paragraph; the count check is what matters.
function appears(text: string | RegExp): number {
  return screen.getAllByText(text).length;
}

const CHAIN_ID_TEXT = String(PORTALDOT_CHAIN_ID);
const ANCHOR_BLOCK_TEXT = String(ANCHOR_BLOCK);

beforeEach(() => {
  // The landing hero readout fetches the live endpoint once on load;
  // keep tests offline and deterministic.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('site consistency: public facts match the single source of truth', () => {
  it('landing shows the registry, anchor, hash, chain, schema, and test count', () => {
    render(<Landing />);
    expect(appears(REGISTRY_CONTRACT)).toBeGreaterThan(0);
    expect(appears(ANCHOR_TX)).toBeGreaterThan(0);
    expect(appears(ANCHORED_REPORT_HASH)).toBeGreaterThan(0);
    expect(appears(new RegExp(REPORT_SCHEMA_VERSION))).toBeGreaterThan(0);
    expect(appears(new RegExp(CHAIN_ID_TEXT))).toBeGreaterThan(0);
    expect(appears(SITE_TESTS)).toBeGreaterThan(0);
    expect(appears(new RegExp(`${SITE_TEST_FILES} files`))).toBeGreaterThan(0);
  });

  it('judges page shows the same facts plus the sample report hash', () => {
    render(<JudgesPage />);
    expect(appears(REGISTRY_CONTRACT)).toBeGreaterThan(0);
    expect(appears(ANCHOR_TX)).toBeGreaterThan(0);
    expect(appears(ANCHORED_REPORT_HASH)).toBeGreaterThan(0);
    expect(appears(sampleReport.integrity.hash)).toBeGreaterThan(0);
    expect(appears(new RegExp(`${SITE_TESTS} tests passing`))).toBeGreaterThan(0);
    expect(appears(new RegExp(`${SITE_TEST_FILES} files`))).toBeGreaterThan(0);
    expect(appears(new RegExp(CHAIN_ID_TEXT))).toBeGreaterThan(0);
    expect(appears(new RegExp(ANCHOR_BLOCK_TEXT))).toBeGreaterThan(0);
  });

  it('docs page shows the same registry, anchor, and hash', () => {
    render(<DocsPage />);
    expect(appears(REGISTRY_CONTRACT)).toBeGreaterThan(0);
    expect(appears(ANCHOR_TX)).toBeGreaterThan(0);
    expect(appears(ANCHORED_REPORT_HASH)).toBeGreaterThan(0);
    expect(appears(new RegExp(REPORT_SCHEMA_VERSION))).toBeGreaterThan(0);
  });

  it('README shows the same registry, anchor, and hash', () => {
    expect(readmeRaw).toContain(REGISTRY_CONTRACT);
    expect(readmeRaw).toContain(ANCHOR_TX);
    expect(readmeRaw).toContain(ANCHORED_REPORT_HASH);
    expect(readmeRaw).toContain(CHAIN_ID_TEXT);
  });
});
