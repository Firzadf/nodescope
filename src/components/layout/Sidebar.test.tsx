// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sidebar } from './Sidebar';

afterEach(() => cleanup());

describe('Sidebar collapse', () => {
  it('shows labels expanded and hides them collapsed, keeping icons reachable', () => {
    const props = { activeSection: 'overview', onSectionChange: vi.fn(), onOpenPalette: vi.fn() };
    const { rerender } = render(<Sidebar {...props} />);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Fee Lab')).toBeTruthy();
    rerender(<Sidebar {...props} collapsed />);
    expect(screen.queryByText('Overview')).toBeNull();
    expect(screen.getByTitle('Overview')).toBeTruthy();
  });

  it('calls the toggle handler', () => {
    const onToggle = vi.fn();
    render(<Sidebar activeSection="overview" onSectionChange={vi.fn()} onOpenPalette={vi.fn()} onToggleCollapse={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('groups nav into Health and Fees, with Fee Lab under Fees', () => {
    const props = { activeSection: 'fee-lab', onSectionChange: vi.fn(), onOpenPalette: vi.fn() };
    const { container, rerender } = render(<Sidebar {...props} />);
    expect(screen.getByText('Health')).toBeTruthy();
    // Two "Fees" texts when expanded: the group label and the public link.
    expect(screen.getAllByText('Fees').length).toBe(2);
    // Fee Lab keeps its 04 slot across the group boundary.
    const feeLab = screen.getByTitle('Fee Lab');
    expect(feeLab.textContent).toContain('04');
    // Group labels hide when collapsed, like the Public pages header.
    rerender(<Sidebar {...props} collapsed />);
    expect(screen.queryByText('Health')).toBeNull();
    expect(screen.queryByText('Fees')).toBeNull();
    expect(screen.getByTitle('Fee Lab')).toBeTruthy();
    expect(container.querySelector('a[href="/fees"]')).not.toBeNull();
  });
});
