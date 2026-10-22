// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CommandPalette, type PaletteCommand } from './CommandPalette';

afterEach(() => cleanup());

function renderPalette() {
  const calls: string[] = [];
  const onClose = vi.fn();
  const commands: PaletteCommand[] = [
    { id: 'a', label: 'Go to Overview', group: 'Navigate', run: () => calls.push('a') },
    { id: 'b', label: 'Run Health Check', group: 'Actions', run: () => calls.push('b') },
    { id: 'c', label: 'Run eth_blockNumber', group: 'Run diagnostic', keywords: 'block height', run: () => calls.push('c') },
  ];
  render(<CommandPalette open={true} commands={commands} onClose={onClose} />);
  return { calls, onClose };
}

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<CommandPalette open={false} commands={[]} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists commands under their group headers', () => {
    renderPalette();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Run diagnostic')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Run Health Check/i })).toBeInTheDocument();
  });

  it('filters by label text and by keywords', () => {
    renderPalette();
    const input = screen.getByLabelText('Command search');
    fireEvent.change(input, { target: { value: 'health' } });
    expect(screen.queryByText('Go to Overview')).not.toBeInTheDocument();
    expect(screen.getByText('Run Health Check')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'height' } });
    expect(screen.getByText('Run eth_blockNumber')).toBeInTheDocument();
    expect(screen.queryByText('Run Health Check')).not.toBeInTheDocument();
  });

  it('runs the active command on Enter and closes', () => {
    const { calls, onClose } = renderPalette();
    const input = screen.getByLabelText('Command search');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(calls).toEqual(['a']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves the active row with ArrowDown before running', () => {
    const { calls } = renderPalette();
    const input = screen.getByLabelText('Command search');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Run Health Check/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(calls).toEqual(['b']);
  });

  it('closes on Escape without running anything', () => {
    const { calls, onClose } = renderPalette();
    const input = screen.getByLabelText('Command search');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });

  it('runs a command on click', () => {
    const { calls, onClose } = renderPalette();
    fireEvent.click(screen.getByText('Run eth_blockNumber'));
    expect(calls).toEqual(['c']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
