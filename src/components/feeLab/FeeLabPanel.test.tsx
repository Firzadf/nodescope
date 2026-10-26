// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { FeeLabPanel } from './FeeLabPanel';
import { SAMPLE, estimateEvm, getApi } from '../../services/feeLab/estimate';
import { verifyReportText } from '../../utils/reportIntegrity';

// The timeout test below drives Measure with a dead native connection and
// a working EVM leg. Only those two seams are mocked; everything else
// (SAMPLE, compareLegs, validation) stays real.
vi.mock('../../services/feeLab/estimate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/feeLab/estimate')>();
  return { ...actual, estimateEvm: vi.fn(), getApi: vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FeeLabPanel', () => {
  it('renders the deploy default with the sample holder as dry-run origin', () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    expect(scope.getByText('Same operation. Two surfaces. One honest fee.')).toBeTruthy();
    expect(scope.getByRole('tab', { name: 'Contract deploy' })).toBeTruthy();
    expect(scope.getByDisplayValue(SAMPLE.holder)).toBeTruthy();
    expect(scope.getByRole('button', { name: 'Estimate on both surfaces' })).toBeTruthy();
    expect(scope.getByText(/No measurement yet/)).toBeTruthy();
  });

  it('switches op forms without touching the network', () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('tab', { name: 'ERC-20 transfer' }));
    expect(scope.getByDisplayValue(SAMPLE.erc20Token)).toBeTruthy();
    fireEvent.click(scope.getByRole('tab', { name: 'Paste calldata' }));
    expect(scope.getByDisplayValue('0x18160ddd')).toBeTruthy();
  });

  it('rejects a bad From address before any network call', () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.change(scope.getByDisplayValue(SAMPLE.holder), { target: { value: 'not-an-address' } });
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    expect(scope.getByText(/must be a 0x… EVM address/)).toBeTruthy();
    expect(scope.queryByText(/No measurement yet/)).toBeNull();
  });

  it('shows the sample bytecode preview for the deploy op', () => {
    const { container } = render(<FeeLabPanel />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent?.startsWith('0x6080')).toBe(true);
    expect(within(container).getByText(/SampleToken\.sol/)).toBeTruthy();
  });

  it('still renders the EVM leg when the native connection times out', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('timed out'));
    vi.mocked(estimateEvm).mockResolvedValue({
      status: 'ok',
      method: 'eth_estimateGas (create)',
      gas: 100000n,
      gasPrice: 1000n,
      feeWei: 100000000n,
      totalPlanck: 10n ** 14n,
      blockNumber: 1,
    });
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    // The EVM value renders, the native leg reports unavailable with the
    // setup error, and Measure becomes usable again (no hang, no retry).
    await waitFor(() => {
      expect(scope.getByRole('button', { name: 'Estimate on both surfaces' })).toBeEnabled();
    });
    expect(scope.getByText('eth_estimateGas (create)')).toBeTruthy();
    expect(scope.getByText('100000')).toBeTruthy();
    expect(scope.getByText('unavailable')).toBeTruthy();
    expect(scope.getByText(/revive\.instantiateWithCode/)).toBeTruthy();
    // 'timed out' surfaces twice: the native leg's reason and the
    // comparison reason that names the unavailable leg.
    expect(scope.getAllByText(/timed out/).length).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(getApi)).toHaveBeenCalledTimes(1);
  });

  it('exports the measured comparison as a stamped v1 report', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('timed out'));
    vi.mocked(estimateEvm).mockResolvedValue({
      status: 'ok',
      method: 'eth_estimateGas (create)',
      gas: 100000n,
      gasPrice: 1000n,
      feeWei: 100000000n,
      totalPlanck: 10n ** 14n,
      blockNumber: 1,
    });
    let captured: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      captured = obj as Blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    await waitFor(() => {
      expect(scope.getByRole('button', { name: 'Estimate on both surfaces' })).toBeEnabled();
    });
    const exportButton = scope.getByRole('button', { name: 'Export fee report' });
    fireEvent.click(exportButton);
    await waitFor(() => {
      expect(captured).not.toBeNull();
    });
    const text = await (captured as unknown as Blob).text();
    const v = await verifyReportText(text);
    expect(v.status).toBe('verified');
    const parsed = JSON.parse(text) as { feeOperation: string; feeComparison: { recommended: string } };
    expect(parsed.feeOperation).toBe('deploy');
    expect(parsed.feeComparison.recommended).toBe('evm');
  });

  it('moves between op tabs with arrow keys, wrapping at the ends', () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    const tablist = scope.getByRole('tablist');
    const deployTab = scope.getByRole('tab', { name: 'Contract deploy' });
    const calldataTab = scope.getByRole('tab', { name: 'Paste calldata' });
    const transferTab = scope.getByRole('tab', { name: 'Native transfer' });
    expect(deployTab.getAttribute('aria-selected')).toBe('true');
    deployTab.focus();
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(calldataTab);
    expect(calldataTab.getAttribute('aria-selected')).toBe('true');
    expect(scope.getByDisplayValue('0x18160ddd')).toBeTruthy();
    // Wraps from the last tab back to the first.
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(transferTab);
    expect(transferTab.getAttribute('aria-selected')).toBe('true');
    // And backwards from the first tab to the last.
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(calldataTab);
    expect(calldataTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders in Indonesian when the stored language is id', () => {
    window.sessionStorage.setItem('nodescope-lang', 'id');
    const { container, unmount } = render(<FeeLabPanel />);
    const scope = within(container);
    expect(scope.getByText('Operasi yang sama. Dua permukaan. Satu fee yang jujur.')).toBeTruthy();
    expect(scope.getByRole('button', { name: 'Estimasi di kedua permukaan' })).toBeTruthy();
    expect(scope.getByRole('tab', { name: 'Deploy kontrak' })).toBeTruthy();
    unmount();
    window.sessionStorage.clear();
  });

  it('switches the panel language with its header toggle', () => {
    const { container, unmount } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'ID (Bahasa Indonesia)' }));
    expect(scope.getByText('Operasi yang sama. Dua permukaan. Satu fee yang jujur.')).toBeTruthy();
    expect(window.sessionStorage.getItem('nodescope-lang')).toBe('id');
    unmount();
    window.sessionStorage.clear();
  });

  it('fills custom bytecode + constructor args from an uploaded artifact JSON', async () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ evm: { bytecode: { object: '0x608060' } }, constructorArgs: '0x0001' })],
      'artifact.json',
      { type: 'application/json' },
    );
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect((scope.getByPlaceholderText('0x6080…') as HTMLTextAreaElement).value).toBe('0x608060');
    });
    const textInputs = container.querySelectorAll('input[type="text"]');
    expect((textInputs[1] as HTMLInputElement).value).toBe('0x0001');
  });

  it('rejects an artifact with only deployedBytecode, plainly', async () => {
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ deployedBytecode: '0x6080' })],
      'artifact.json',
      { type: 'application/json' },
    );
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => {
      expect(scope.getByText(/only deployedBytecode/)).toBeTruthy();
    });
  });

  it('rejects non-hex custom bytecode before any network call', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('timed out'));
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
    fireEvent.change(scope.getByPlaceholderText('0x6080…'), { target: { value: 'not-hex' } });
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    await waitFor(() => {
      expect(scope.getByText('Custom bytecode must be 0x-prefixed hex.')).toBeTruthy();
    });
    expect(vi.mocked(estimateEvm)).not.toHaveBeenCalled();
  });

  it('measures a custom deploy with constructor args appended to the bytecode', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('timed out'));
    let captured: unknown = null;
    vi.mocked(estimateEvm).mockImplementation(async (tx) => {
      captured = tx;
      return {
        status: 'ok',
        method: 'eth_estimateGas (create)',
        gas: 100000n,
        gasPrice: 1000n,
        feeWei: 100000000n,
        totalPlanck: 10n ** 14n,
        blockNumber: 1,
      };
    });
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
    fireEvent.change(scope.getByPlaceholderText('0x6080…'), { target: { value: '0x608060' } });
    const textInputs = container.querySelectorAll('input[type="text"]');
    fireEvent.change(textInputs[1], { target: { value: '0x0001' } });
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    await waitFor(() => {
      expect(scope.getByRole('button', { name: 'Estimate on both surfaces' })).toBeEnabled();
    });
    expect(captured).toMatchObject({ kind: 'contractDeploy', bytecode: '0x608060', constructorData: '0x0001' });
  });

  it('exports a custom-artifact measurement as a stamped v1 report', async () => {
    vi.mocked(getApi).mockRejectedValue(new Error('timed out'));
    vi.mocked(estimateEvm).mockResolvedValue({
      status: 'ok',
      method: 'eth_estimateGas (create)',
      gas: 100000n,
      gasPrice: 1000n,
      feeWei: 100000000n,
      totalPlanck: 10n ** 14n,
      blockNumber: 1,
    });
    let captured: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      captured = obj as Blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { container } = render(<FeeLabPanel />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
    fireEvent.change(scope.getByPlaceholderText('0x6080…'), { target: { value: '0x608060' } });
    fireEvent.click(scope.getByRole('button', { name: 'Estimate on both surfaces' }));
    await waitFor(() => {
      expect(scope.getByRole('button', { name: 'Estimate on both surfaces' })).toBeEnabled();
    });
    fireEvent.click(scope.getByRole('button', { name: 'Export fee report' }));
    await waitFor(() => {
      expect(captured).not.toBeNull();
    });
    const text = await (captured as unknown as Blob).text();
    const v = await verifyReportText(text);
    expect(v.status).toBe('verified');
    const parsed = JSON.parse(text) as { feeOperation: string; feeComparison: { evm: { method: string } } };
    expect(parsed.feeOperation).toBe('deploy');
    expect(parsed.feeComparison.evm.method).toBe('eth_estimateGas (create)');
  });

  it('preloads a custom contract from a share link query', () => {
    window.history.pushState({}, '', '/app/fee-lab?op=deploy&code=0x608060&args=0x0001');
    try {
      const { container } = render(<FeeLabPanel />);
      const scope = within(container);
      expect((scope.getByPlaceholderText('0x6080…') as HTMLTextAreaElement).value).toBe('0x608060');
      const textInputs = container.querySelectorAll('input[type="text"]');
      expect((textInputs[1] as HTMLInputElement).value).toBe('0x0001');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('copies a share link carrying the custom code and args', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    try {
      const { container } = render(<FeeLabPanel />);
      const scope = within(container);
      fireEvent.click(scope.getByRole('button', { name: 'Custom bytecode' }));
      fireEvent.change(scope.getByPlaceholderText('0x6080…'), { target: { value: '0x608060' } });
      const textInputs = container.querySelectorAll('input[type="text"]');
      fireEvent.change(textInputs[1], { target: { value: '0x0001' } });
      fireEvent.click(scope.getByRole('button', { name: 'Copy share link' }));
      await waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
      });
      const url = writeText.mock.calls[0][0] as string;
      expect(url).toContain('op=deploy');
      expect(url).toContain('code=0x608060');
      expect(url).toContain('args=0x0001');
      expect(scope.getByText('Share link copied.')).toBeTruthy();
    } finally {
      // jsdom has no clipboard by default; remove the test double.
      delete (window.navigator as unknown as Record<string, unknown>).clipboard;
    }
  });
});
