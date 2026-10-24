// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Landing motion video', () => {
  it('embeds the animated screenshot flow with an honest caption', () => {
    const { container } = render(<Landing />);
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('/motion/nodescope-flow.mp4');
    expect(video?.hasAttribute('autoPlay')).toBe(true);
    expect((video as HTMLVideoElement | null)?.muted).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(true);
    expect(screen.getByText(/Watch the flow/i)).toBeInTheDocument();
    expect(screen.getByText(/not a live recording/i)).toBeInTheDocument();
  });
});
