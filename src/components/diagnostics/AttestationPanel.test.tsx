// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttestationPanel } from './AttestationPanel';

describe('AttestationPanel', () => {
  it('states plainly that nothing is verified until a contract is deployed', () => {
    render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    expect(screen.getByText(/ON-CHAIN ATTESTATION/i)).toBeInTheDocument();
    expect(screen.getByText(/NodeScope signs nothing/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing to verify/i)).toBeInTheDocument();
  });

  it('has no input field for a private key', () => {
    const { container } = render(<AttestationPanel endpoint="https://test-evm-rpc-v3.portaldot.dev" />);
    const inputs = [...container.querySelectorAll('input, textarea')];
    expect(inputs.some((el) => /private/i.test(el.getAttribute('placeholder') || ''))).toBe(false);
  });
});
