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

  it('defers the video and its poster until scrolled into view', () => {
    // An observer that never fires: the figure is below the fold, so
    // only a same-aspect placeholder renders, and neither the 3.2 MB
    // file nor its 74 KB poster is fetched on first paint.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const { container } = render(<Landing />);
    expect(container.querySelector('[data-testid="motion-placeholder"]')).not.toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img.motion-poster')).toBeNull();
  });
});
