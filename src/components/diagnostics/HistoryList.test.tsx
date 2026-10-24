// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import type { DiagnosticHistoryItem } from '../../types/rpc';

const item: DiagnosticHistoryItem = {
  id: '1',
  endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
  timestamp: 1761264000000,
  request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  response: { jsonrpc: '2.0', result: '0x2bc0f', id: 1 },
  latency: 120,
  error: null,
  success: true,
};

afterEach(() => cleanup());

describe('HistoryList receipt popup', () => {
  it('opens a popup with the full record and keeps the original navigation available', () => {
    const onSelect = vi.fn();
    render(<HistoryList history={[item]} onSelect={onSelect} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /eth_blockNumber/i }));
    expect(screen.getByRole('dialog', { name: /receipt for eth_blockNumber/i })).toBeTruthy();
    expect(screen.getByText(/0x2bc0f/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /open in rpc diagnostics/i }));
    expect(onSelect).toHaveBeenCalledWith(item);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
