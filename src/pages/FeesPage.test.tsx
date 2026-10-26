// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FeesPage } from './FeesPage';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('FeesPage', () => {
  it('renders the hero, findings table, and Fee Lab CTA in English', () => {
    const { container, unmount } = render(<FeesPage />);
    const root = within(container);
    expect(root.getByRole('heading', { name: 'Is 800x cheaper real?' })).toBeTruthy();
    expect(root.getByText('Deploy SampleToken (1,414 B)')).toBeTruthy();
    expect(root.getByRole('link', { name: /Open Fee Lab/ }).getAttribute('href')).toBe('/app/fee-lab');
    const header = within(container.querySelector('header') as HTMLElement);
    expect(header.getByRole('link', { name: 'Fee Lab' }).getAttribute('href')).toBe('/app/fee-lab');
    unmount();
  });

  it('renders in Indonesian when the stored language is id', () => {
    window.sessionStorage.setItem('nodescope-lang', 'id');
    const { container, unmount } = render(<FeesPage />);
    const root = within(container);
    expect(root.getByRole('heading', { name: 'Apakah 800x lebih murah itu nyata?' })).toBeTruthy();
    expect(root.getByText('Deploy SampleToken (1.414 B)')).toBeTruthy();
    unmount();
  });

  it('switches language with the header toggle', async () => {
    const { container, unmount } = render(<FeesPage />);
    const root = within(container);
    fireEvent.click(root.getByRole('button', { name: 'Bahasa Indonesia' }));
    expect(root.getByRole('heading', { name: 'Apakah 800x lebih murah itu nyata?' })).toBeTruthy();
    expect(window.sessionStorage.getItem('nodescope-lang')).toBe('id');
    unmount();
  });
});
