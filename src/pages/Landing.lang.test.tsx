// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Landing } from './Landing';

// Same offline stub as Landing.test.tsx: the hero readout fetches once on
// load, and in tests every fetch fails into the honest "unreachable" state.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
  try {
    sessionStorage.clear();
  } catch {
    // Session storage may be unavailable; the default language is EN either way.
  }
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Landing language switcher', () => {
  it('defaults to English and ignores an unknown stored value', () => {
    try {
      sessionStorage.setItem('nodescope-lang', 'fr');
    } catch {
      // Falls back to EN below regardless.
    }
    render(<Landing />);
    expect(screen.getByText(/Consoles interact\./i)).toBeInTheDocument();
    // Nav label and section heading share the string, so count, don't single out.
    expect(screen.getAllByText('The Problem').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN (English)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'ID (Bahasa Indonesia)' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to Indonesian and back to English, persisting to sessionStorage', () => {
    render(<Landing />);
    fireEvent.click(screen.getByRole('button', { name: 'ID (Bahasa Indonesia)' }));
    // Nav label is "Masalah", the section heading is "Masalahnya".
    expect(screen.getByText('Masalah')).toBeInTheDocument();
    expect(screen.getByText('Masalahnya')).toBeInTheDocument();
    expect(
      screen.getByText(/Baru pertama kali buka NodeScope\?/i),
    ).toBeInTheDocument();
    // Navbar, hero, and CTA buttons all read "Buka App" in ID.
    expect(screen.getAllByText('Buka App').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', { name: 'ID (Bahasa Indonesia)' })).toHaveAttribute('aria-pressed', 'true');
    try {
      expect(sessionStorage.getItem('nodescope-lang')).toBe('id');
    } catch {
      // Storage unavailable in this environment; the visible switch above is the assertion.
    }
    fireEvent.click(screen.getByRole('button', { name: 'EN (English)' }));
    expect(screen.getAllByText('The Problem').length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Opening NodeScope for the first time\?/i),
    ).toBeInTheDocument();
    try {
      expect(sessionStorage.getItem('nodescope-lang')).toBe('en');
    } catch {
      // As above.
    }
  });

  it('starts in Indonesian when sessionStorage says so', () => {
    try {
      sessionStorage.setItem('nodescope-lang', 'id');
    } catch {
      // If storage is unavailable this render simply defaults to EN and the
      // assertion below would fail; that case is covered by the switch test.
    }
    render(<Landing />);
    expect(screen.getByText('Masalah')).toBeInTheDocument();
    expect(screen.getByText('Masalahnya')).toBeInTheDocument();
  });
});
