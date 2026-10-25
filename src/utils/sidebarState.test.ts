// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initialSidebarCollapsed } from './sidebarState';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('initialSidebarCollapsed', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts collapsed on a narrow viewport with no stored preference', () => {
    mockMatchMedia(true);
    expect(initialSidebarCollapsed()).toBe(true);
  });

  it('starts expanded on a wide viewport with no stored preference', () => {
    mockMatchMedia(false);
    expect(initialSidebarCollapsed()).toBe(false);
  });

  it('a stored expanded preference wins over a narrow viewport', () => {
    sessionStorage.setItem('nodescope-sidebar-collapsed', '0');
    mockMatchMedia(true);
    expect(initialSidebarCollapsed()).toBe(false);
  });

  it('a stored collapsed preference wins over a wide viewport', () => {
    sessionStorage.setItem('nodescope-sidebar-collapsed', '1');
    mockMatchMedia(false);
    expect(initialSidebarCollapsed()).toBe(true);
  });

  it('starts expanded when matchMedia is unavailable', () => {
    // jsdom has no matchMedia unless mocked; the app must not crash there.
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });
    expect(initialSidebarCollapsed()).toBe(false);
  });
});
