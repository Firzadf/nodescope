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
});
