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

  it('opens and closes the mobile menu from the hamburger', () => {
    const { container, unmount } = render(<FeesPage />);
    const header = within(container.querySelector('header') as HTMLElement);
    const toggle = header.getByRole('button', { name: 'Toggle navigation menu' });
    expect(container.querySelector('#fees-mobile-menu')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = container.querySelector('#fees-mobile-menu');
    expect(menu).not.toBeNull();
    const links = menu?.querySelectorAll('a') ?? [];
    expect(links.length).toBe(5);
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[2]?.getAttribute('href')).toBe('/app/fee-lab');
    // Clicking a link closes the menu again.
    fireEvent.click(links[0]!);
    expect(container.querySelector('#fees-mobile-menu')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    unmount();
  });
});
