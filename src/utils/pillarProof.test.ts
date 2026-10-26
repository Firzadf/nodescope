import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/rpcClient', () => ({
  sendJsonRpcRequest: vi.fn(),
}));

vi.mock('../services/feeLab/estimate', () => ({
  estimateBoth: vi.fn(),
  SAMPLE: { holder: '0x03c502abb79e8eee50135c91933d059d982dd912' },
  SampleTokenBytecode: '0x608060',
}));

import { sendJsonRpcRequest } from '../services/rpcClient';
import { estimateBoth } from '../services/feeLab/estimate';
import { formatRatio, measureFeesProof, measureHealthBlock, measureHealthProof } from './pillarProof';

const rpcMock = vi.mocked(sendJsonRpcRequest);
const estimateMock = vi.mocked(estimateBoth);

describe('pillarProof', () => {
  it('parses the EVM block number from eth_blockNumber', async () => {
    rpcMock.mockResolvedValueOnce({ success: true, response: { result: '0x32075' } } as never);
    await expect(measureHealthBlock()).resolves.toBe(204917);
    expect(rpcMock).toHaveBeenCalledWith(expect.any(String), 'eth_blockNumber', [], 10000);
  });

  it('formats the health proof as a grouped block label', async () => {
    rpcMock.mockResolvedValueOnce({ success: true, response: { result: '0x32075' } } as never);
    await expect(measureHealthProof()).resolves.toBe('Block #204,917');
  });

  it('throws when the RPC call fails, so the card shows unavailable', async () => {
    rpcMock.mockResolvedValueOnce({ success: false, error: 'Failed to fetch' } as never);
    await expect(measureHealthBlock()).rejects.toThrow();
  });

  it('formats ratios: full for large, 3 decimals for near-1', () => {
    expect(formatRatio(804)).toBe('804×');
    expect(formatRatio(1.016)).toBe('1.016×');
    expect(formatRatio(12.34)).toBe('12.3×');
    expect(formatRatio(null)).toBe('—');
  });

  it('formats the fees proof from a deploy comparison', async () => {
    estimateMock.mockResolvedValueOnce({
      evm: { status: 'ok', totalPlanck: 1n },
      native: { status: 'ok', totalPlanck: 1n },
      ratioAllIn: 1.016,
      ratioVsNativeFeeOnly: 803.7,
    } as never);
    await expect(measureFeesProof()).resolves.toBe('1.016× all-in');
    expect(estimateMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'contractDeploy', bytecode: '0x608060' }),
    );
  });

  it('throws when either fee surface is unavailable', async () => {
    estimateMock.mockResolvedValueOnce({
      evm: { status: 'ok', totalPlanck: 1n },
      native: { status: 'unavailable', reason: 'timed out' },
      ratioAllIn: null,
      ratioVsNativeFeeOnly: null,
    } as never);
    await expect(measureFeesProof()).rejects.toThrow();
  });
});
