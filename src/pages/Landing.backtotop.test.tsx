// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Landing back-to-top', () => {
  it('appears only after scrolling past 600px and scrolls to top on click', () => {
    render(<Landing />);
    expect(screen.queryByLabelText('Back to top')).not.toBeInTheDocument();
    Object.defineProperty(window, 'scrollY', { value: 800, configurable: true });
    fireEvent.scroll(window);
    const button = screen.getByLabelText('Back to top');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
