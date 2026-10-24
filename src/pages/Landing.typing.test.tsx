// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Landing typewriter', () => {
  it('types the report sample once, then offers a replay', () => {
    render(<Landing />);
    expect(screen.queryByText(/Replay typing/i)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const replay = screen.getByText(/Replay typing/i);
    expect(replay).toBeInTheDocument();
    fireEvent.click(replay);
    expect(screen.queryByText(/Replay typing/i)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText(/Replay typing/i)).toBeInTheDocument();
  });
});
