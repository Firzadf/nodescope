// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AttestationPanel } from './AttestationPanel';
import { sendJsonRpcRequest } from '../../services/rpcClient';

vi.mock('../../services/rpcClient', () => ({
  sendJsonRpcRequest: vi.fn(),
}));

describe('AttestationPanel', () => {
  it('prefills the deployed registry and reports it plainly', () => {
    render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    expect(screen.getByText(/ON-CHAIN ATTESTATION/i)).toBeInTheDocument();
    expect(screen.getByText(/NodeScope signs nothing/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('0xd48da7eff3264bdd51a86b873da9ff6997aae99c')).toBeInTheDocument();
  });

  it('verifies the reference anchor from the deployment file', async () => {
    vi.mocked(sendJsonRpcRequest).mockResolvedValue({
      success: true,
      response: {
        result: {
          status: '0x1',
          to: '0xd48da7eff3264bdd51a86b873da9ff6997aae99c',
          blockNumber: '0x34d1a',
          logs: [
            {
              address: '0xd48da7eff3264bdd51a86b873da9ff6997aae99c',
              topics: [
                '0x0000000000000000000000000000000000000000000000000000000000000000',
                '0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b',
              ],
            },
          ],
        },
      },
    } as never);
    const { container } = render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    const scope = within(container);
    fireEvent.click(scope.getByRole('button', { name: /Verify the reference anchor/i }));
    expect(await scope.findByText(/^Anchored$/)).toBeInTheDocument();
    expect(
      scope.getByDisplayValue('0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b'),
    ).toBeInTheDocument();
    expect(
      scope.getByDisplayValue('0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913'),
    ).toBeInTheDocument();
  });

  it('prefills initial values from a share link', () => {
    const { container } = render(
      <AttestationPanel
        endpoint="https://test-evm-rpc-v3.portaldot.dev"
        initialHash="0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286"
        initialTx="0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448"
      />,
    );
    const scope = within(container);
    expect(scope.getByDisplayValue(/0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286/)).toBeInTheDocument();
    expect(scope.getByText(/Copy shareable verification link/i)).toBeInTheDocument();
  });

  it('explains why the verify button stays disabled for an invalid hash', () => {
    const { container } = render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    const scope = within(container);
    const hashInput = scope.getByPlaceholderText('0x… (64 hex characters)');
    fireEvent.change(hashInput, { target: { value: 'abc' } });
    expect(scope.getByText(/Report hash must be 0x followed by 64 hexadecimal characters/i)).toBeInTheDocument();
    expect(scope.getByRole('button', { name: /Verify anchor on chain/i })).toBeDisabled();
  });

  it('has no input field for a private key', () => {
    const { container } = render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    const inputs = [...container.querySelectorAll('input, textarea')];
    expect(inputs.some((el) => /private/i.test(el.getAttribute('placeholder') || ''))).toBe(false);
  });
});
