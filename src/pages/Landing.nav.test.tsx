// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Landing } from './Landing';

// The hero readout fetches the live endpoint once on load; keep tests
// offline and deterministic by making every fetch fail.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Landing mobile menu', () => {
  it('opens, closes, and links from the hamburger menu', () => {
    const { container } = render(<Landing />);
    const toggle = screen.getByRole('button', { name: 'Toggle navigation menu' });
    // Closed by default: no dropdown in the DOM, toggle reports collapsed.
    expect(container.querySelector('#landing-mobile-menu')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = container.querySelector('#landing-mobile-menu');
    expect(menu).not.toBeNull();
    const links = menu?.querySelectorAll('a') ?? [];
    expect(links.length).toBe(9);
    expect(links[0]?.getAttribute('href')).toBe('#problem');
    expect(links[0]?.textContent).toBe('The Problem');
    expect(links[4]?.getAttribute('href')).toBe('/fees');
    expect(links[4]?.textContent).toBe('Fees');

    // Clicking a link closes the menu again.
    fireEvent.click(links[0]!);
    expect(container.querySelector('#landing-mobile-menu')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Toggling twice returns to closed.
    fireEvent.click(toggle);
    expect(container.querySelector('#landing-mobile-menu')).not.toBeNull();
    fireEvent.click(toggle);
    expect(container.querySelector('#landing-mobile-menu')).toBeNull();
  });
});
