// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import { FeeLabPanel } from './FeeLabPanel';
import { SAMPLE } from '../../services/feeLab/estimate';

afterEach(() => cleanup());

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
});
