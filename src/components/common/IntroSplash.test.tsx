// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { IntroSplash } from './IntroSplash';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  stubMatchMedia(false);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('IntroSplash', () => {
  it('shows the brand intro once, then dismisses itself on timers', () => {
    const { container } = render(<IntroSplash scope="landing" />);
    expect(screen.getByText(/CALIBRATING/)).toBeInTheDocument();
    expect(container.querySelector('.z-\\[200\\]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container).toBeEmptyDOMElement();
    expect(sessionStorage.getItem('nodescope-intro-landing')).toBe('1');
  });

  it('skips instantly on click and remembers it for the session', () => {
    render(<IntroSplash scope="app" />);
    expect(screen.getByText(/CALIBRATING/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/CALIBRATING/).closest('div')!);
    expect(sessionStorage.getItem('nodescope-intro-app')).toBe('1');
  });

  it('renders nothing when this route was already shown this session', () => {
    sessionStorage.setItem('nodescope-intro-landing', '1');
    const { container } = render(<IntroSplash scope="landing" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the static loader under reduced motion, then dismisses on timers', () => {
    stubMatchMedia(true);
    const { container } = render(<IntroSplash scope="landing" />);
    expect(screen.getByText(/CALIBRATING/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(container).toBeEmptyDOMElement();
    expect(sessionStorage.getItem('nodescope-intro-landing')).toBe('1');
  });
});
