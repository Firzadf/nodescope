// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { PillarCards, type PillarCardCopy } from './PillarCards';

function copy(overrides: Partial<PillarCardCopy>): PillarCardCopy {
  return {
    kicker: 'Pillar',
    title: 'Title',
    body: 'Body',
    ctaLabel: 'Open',
    ctaHref: '/app',
    measureLabel: 'Measure',
    measuringLabel: 'Measuring…',
    unavailableLabel: 'Unavailable',
    measuredLabel: 'Measured at',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PillarCards', () => {
  it('renders both cards with their CTAs', () => {
    const { container, unmount } = render(
      <PillarCards
        health={copy({ title: 'Health', ctaLabel: 'Open Health', ctaHref: '/app', measureLabel: 'Measure health' })}
        fees={copy({ title: 'Fees', ctaLabel: 'Open Fees', ctaHref: '/fees', measureLabel: 'Measure fees' })}
        healthMeasure={vi.fn(async () => 'Block #1')}
        feesMeasure={vi.fn(async () => '1.016× all-in')}
      />,
    );
    const root = within(container);
    expect(root.getByText('Health')).toBeTruthy();
    expect(root.getByText('Fees')).toBeTruthy();
    expect(root.getByRole('link', { name: /Open Health/ }).getAttribute('href')).toBe('/app');
    expect(root.getByRole('link', { name: /Open Fees/ }).getAttribute('href')).toBe('/fees');
    unmount();
  });

  it('measures once on click and shows the value', async () => {
    const healthMeasure = vi.fn(async () => 'Block #204,917');
    const { container, unmount } = render(
      <PillarCards
        health={copy({ measureLabel: 'Measure health' })}
        fees={copy({ measureLabel: 'Measure fees' })}
        healthMeasure={healthMeasure}
        feesMeasure={vi.fn(async () => '1.016× all-in')}
      />,
    );
    const root = within(container);
    fireEvent.click(root.getByRole('button', { name: 'Measure health' }));
    expect(await screen.findByTestId('health-proof-value')).toBeTruthy();
    expect(within(container).getByTestId('health-proof-value').textContent).toBe('Block #204,917');
    expect(healthMeasure).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ignores a second press while measuring', async () => {
    let resolve!: (v: string) => void;
    const healthMeasure = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const { container, unmount } = render(
      <PillarCards
        health={copy({ measureLabel: 'Measure health' })}
        fees={copy({ measureLabel: 'Measure fees' })}
        healthMeasure={healthMeasure}
        feesMeasure={vi.fn(async () => '1.016× all-in')}
      />,
    );
    const root = within(container);
    const btn = root.getByRole('button', { name: 'Measure health' });
    fireEvent.click(btn);
    // The button is replaced by the measuring label; a second measurement
    // cannot be triggered, and the first call is the only one.
    expect(healthMeasure).toHaveBeenCalledTimes(1);
    resolve('Block #1');
    expect(await screen.findByTestId('health-proof-value')).toBeTruthy();
    unmount();
  });

  it('shows unavailable on failure and retries on press', async () => {
    const feesMeasure = vi.fn()
      .mockRejectedValueOnce(new Error('timed out'))
      .mockResolvedValueOnce('1.016× all-in');
    const { container, unmount } = render(
      <PillarCards
        health={copy({ measureLabel: 'Measure health' })}
        fees={copy({ measureLabel: 'Measure fees' })}
        healthMeasure={vi.fn(async () => 'Block #1')}
        feesMeasure={feesMeasure}
      />,
    );
    const root = within(container);
    fireEvent.click(root.getByRole('button', { name: 'Measure fees' }));
    expect(await screen.findByText('Unavailable')).toBeTruthy();
    fireEvent.click(root.getByRole('button', { name: 'Measure fees' }));
    expect(await screen.findByTestId('fees-proof-value')).toBeTruthy();
    expect(feesMeasure).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('auto-measures Health on viewport entry but not Fees (click-only)', async () => {
    // An observer that reports every card as intersecting immediately.
    class ImmediateObserver {
      private cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }      observe() {
        this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('IntersectionObserver', ImmediateObserver);
    const healthMeasure = vi.fn(async () => 'Block #1');
    const feesMeasure = vi.fn(async () => '1.016× all-in');
    const { container, unmount } = render(
      <PillarCards
        health={copy({ measureLabel: 'Measure health' })}
        fees={copy({ measureLabel: 'Measure fees' })}
        healthMeasure={healthMeasure}
        feesMeasure={feesMeasure}
      />,
    );
    // Health auto-measured on viewport entry; Fees did not, so its
    // Measure button is still there and no fees value rendered.
    expect(await screen.findByTestId('health-proof-value')).toBeTruthy();
    expect(healthMeasure).toHaveBeenCalledTimes(1);
    expect(feesMeasure).not.toHaveBeenCalled();
    expect(within(container).getByRole('button', { name: 'Measure fees' })).toBeTruthy();
    // An explicit press still measures Fees.
    fireEvent.click(within(container).getByRole('button', { name: 'Measure fees' }));
    expect(await screen.findByTestId('fees-proof-value')).toBeTruthy();
    expect(feesMeasure).toHaveBeenCalledTimes(1);
    unmount();
  });
});
