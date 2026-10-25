// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Landing Kiky mascot', () => {
  it('renders the mascot image with its caption in English by default', () => {
    render(<Landing />);
    const img = screen.getByAltText('Kiky, the Portaldot mascot');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/kiky.png');
    expect(screen.getByText('Kiky · Portaldot mascot · fan tribute · decorative only')).toBeInTheDocument();
  });

  it('renders the Indonesian caption when sessionStorage says so', () => {
    sessionStorage.setItem('nodescope-lang', 'id');
    render(<Landing />);
    expect(screen.getByAltText('Kiky, maskot Portaldot')).toBeInTheDocument();
    expect(screen.getByText('Kiky · maskot Portaldot · tribut penggemar · dekorasi saja')).toBeInTheDocument();
  });
});
