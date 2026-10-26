// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeployCostCalculator } from './DeployCostCalculator';
import { SampleTokenBytecode } from '../../services/feeLab/artifacts';
import { SAMPLE } from '../../services/feeLab/samples';
import type { Comparison } from '../../services/feeLab/compare';

const { estimateBoth } = vi.hoisted(() => ({ estimateBoth: vi.fn() }));
vi.mock('../../services/feeLab/estimate', () => ({ estimateBoth }));

// 14 dp planck: EVM 124.098219 tPOT, native fee 0.154411 + deposit 122.037
// = all-in 122.191411 tPOT, all-in ratio 1.016x, fee-only ratio 803.7x.
const canned: Comparison = {
  evm: {
    status: 'ok',
    method: 'eth_estimateGas (create)',
    gas: 2588299n,
    gasPrice: 30000n,
    feeWei: 77648970000n,
    totalPlanck: 12409821900000000n,
    blockNumber: 206300,
  },
  native: {
    status: 'ok',
    method: 'revive.instantiateWithCode',
    partialFee: 15441100000000n,
    storageDeposit: 12203700000000000n,
    totalPlanck: 12219141100000000n,
    weight: { refTime: 1000000n, proofSize: 5000n },
    blockNumber: 206301,
  },
  ratioAllIn: 1.0156,
  ratioVsNativeFeeOnly: 803.7,
  recommended: 'either',
  savingsPlanck: 190680800000000n,
  reason: 'All-in costs are within 2% — pick by wallet/UX.',
  measuredAt: '2026-10-27T00:00:00.000Z',
};

beforeEach(() => {
  vi.mocked(estimateBoth).mockResolvedValue(canned);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('DeployCostCalculator', () => {
  it('estimates the sample deploy on both surfaces with a fee-only vs all-in breakdown', async () => {
    const { container } = render(<DeployCostCalculator lang="en" />);
    const root = within(container);
    expect(root.getByText('Contract source')).toBeTruthy();
    fireEvent.click(root.getByRole('button', { name: 'Estimate this deploy' }));
    expect(await root.findByText('124.098219')).toBeTruthy();
    expect(vi.mocked(estimateBoth)).toHaveBeenCalledWith({
      kind: 'contractDeploy',
      from: SAMPLE.holder,
      bytecode: SampleTokenBytecode,
      constructorData: undefined,
    });
    expect(root.getByText('122.191411')).toBeTruthy();
    expect(root.getByText('1.016×')).toBeTruthy();
    expect(root.getByText('804×')).toBeTruthy();
    expect(root.getByText('Either (tie)')).toBeTruthy();
    expect(root.getByText('What the storage deposit is')).toBeTruthy();
    expect(root.getByText(/refunded to the origin/)).toBeTruthy();
    expect(root.getByRole('button', { name: 'Export fee report' })).toBeTruthy();
  });

  it('rejects non-hex paste input without estimating', async () => {
    const { container } = render(<DeployCostCalculator lang="en" />);
    const root = within(container);
    fireEvent.click(root.getByRole('button', { name: 'Paste or upload my own' }));
    fireEvent.change(root.getByLabelText(/Creation bytecode/), { target: { value: 'hello' } });
    fireEvent.click(root.getByRole('button', { name: 'Estimate this deploy' }));
    expect(await root.findByRole('alert')).toHaveTextContent('Not valid JSON and not raw 0x bytecode');
    expect(vi.mocked(estimateBoth)).not.toHaveBeenCalled();
  });

  it('rejects a runtime-only artifact without estimating', async () => {
    const { container } = render(<DeployCostCalculator lang="en" />);
    const root = within(container);
    fireEvent.click(root.getByRole('button', { name: 'Paste or upload my own' }));
    fireEvent.change(root.getByLabelText(/Creation bytecode/), {
      target: { value: '{"deployedBytecode":"0x6080"}' },
    });
    fireEvent.click(root.getByRole('button', { name: 'Estimate this deploy' }));
    expect(await root.findByRole('alert')).toHaveTextContent('only deployedBytecode');
    expect(vi.mocked(estimateBoth)).not.toHaveBeenCalled();
  });

  it('renders the calculator and deposit explainer in Indonesian', async () => {
    const { container } = render(<DeployCostCalculator lang="id" />);
    const root = within(container);
    expect(root.getByText('Sumber kontrak')).toBeTruthy();
    fireEvent.click(root.getByRole('button', { name: 'Estimasi deploy ini' }));
    expect(await root.findByText('Apa itu storage deposit')).toBeTruthy();
    expect(root.getByText(/dikembalikan ke origin/)).toBeTruthy();
  });

  it('exports the calculator result as a stamped v1 fee report', async () => {
    const { container } = render(<DeployCostCalculator lang="en" />);
    const root = within(container);
    let captured: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      captured = obj as Blob;
      return 'blob:mock';
    });
    fireEvent.click(root.getByRole('button', { name: 'Estimate this deploy' }));
    const exportButton = await root.findByRole('button', { name: 'Export fee report' });
    fireEvent.click(exportButton);
    await waitFor(() => expect(captured).not.toBeNull());
    const text = await (captured as unknown as Blob).text();
    const report = JSON.parse(text) as { schemaVersion: string; feeOperation: string; integrity: { hash: string } };
    expect(report.schemaVersion).toBe('nodescope.diagnostic-report.v1');
    expect(report.feeOperation).toBe('deploy');
    expect(report.integrity.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
