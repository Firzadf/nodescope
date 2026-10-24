// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TerminalFeed } from './TerminalFeed';
import type { DiagnosticHistoryItem } from '../../types/rpc';

const item = (id: string, method: string): DiagnosticHistoryItem => ({
  id,
  endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
  timestamp: 1761264000000,
  request: { jsonrpc: '2.0', method, params: [], id: 1 },
  response: { jsonrpc: '2.0', result: '0x1', id: 1 },
  latency: 120,
  error: null,
  success: true,
});

afterEach(() => cleanup());

describe('TerminalFeed', () => {
  it('shows an explicit empty state instead of a fake live stream', () => {
    render(<TerminalFeed history={[]} />);
    expect(screen.getByText(/no checks run yet/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /terminal/i }));
    expect(screen.getByText(/waiting for your first check/i)).toBeTruthy();
  });

  it('lists only real records, newest first, when expanded', () => {
    render(<TerminalFeed history={[item('2', 'eth_blockNumber'), item('1', 'eth_chainId')]} />);
    fireEvent.click(screen.getByRole('button', { name: /terminal/i }));
    const firstRow = document.querySelector('ol li');
    expect(firstRow?.textContent).toContain('eth_blockNumber');
    expect(screen.getByText(/nothing polls/i)).toBeTruthy();
  });
});
