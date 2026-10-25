// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AttestationPanel } from './AttestationPanel';

describe('AttestationPanel', () => {
  it('prefills the deployed registry and reports it plainly', () => {
    render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    expect(screen.getByText(/ON-CHAIN ATTESTATION/i)).toBeInTheDocument();
    expect(screen.getByText(/NodeScope signs nothing/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce')).toBeInTheDocument();
  });

  it('prefills initial values from a share link', () => {
    render(
      <AttestationPanel
        endpoint="https://test-evm-rpc-v3.portaldot.dev"
        initialHash="0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286"
        initialTx="0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448"
      />,
    );
    expect(screen.getByDisplayValue(/0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286/)).toBeInTheDocument();
    expect(screen.getByText(/Copy shareable verification link/i)).toBeInTheDocument();
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
