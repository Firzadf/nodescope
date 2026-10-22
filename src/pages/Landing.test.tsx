// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

afterEach(() => cleanup());

describe('Landing', () => {
  it('renders the hero claim and Launch App CTAs pointing at /app', () => {
    render(<Landing />);
    expect(screen.getByText(/Consoles interact\./i)).toBeInTheDocument();
    const ctas = screen.getAllByRole('link', { name: /Launch App/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/app'));
  });

  it('shows the numbered sections and honestly-labeled roadmap', () => {
    render(<Landing />);
    expect(screen.getByText(/A green checkmark is/i)).toBeInTheDocument();
    expect(screen.getByText('Connect & check')).toBeInTheDocument();
    expect(screen.getByText('Health Check Snapshots')).toBeInTheDocument();
    expect(screen.getByText('143,776')).toBeInTheDocument();
    expect(screen.getAllByText(/Planned — not shipped/i).length).toBe(3);
  });

  it('shows the observed block evidence', () => {
    render(<Landing />);
    expect(screen.getByText(/Demo Snapshot B/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-in submitted/i)).toBeInTheDocument();
  });
});
