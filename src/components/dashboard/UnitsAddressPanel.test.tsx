// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnitsAddressPanel } from './UnitsAddressPanel';
import { StatusBadgePanel } from './StatusBadgePanel';

afterEach(() => cleanup());

describe('units and badge panels', () => {
  it('maps an H160 with the 0xEE suffix rule without calling the network', async () => {
    render(<UnitsAddressPanel />);
    fireEvent.change(screen.getByLabelText(/H160, AccountId32, or SS58/i), { target: { value: '0x' + '11'.repeat(20) } });
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(await screen.findByText('0x' + '11'.repeat(20) + 'ee'.repeat(12))).toBeInTheDocument();
    expect(screen.getByText(/fallback-suffix/)).toBeInTheDocument();
    expect(screen.getByText(/twelve 0xEE bytes/)).toBeInTheDocument();
  });

  it('shows a session badge and a markdown embed for the published target', () => {
    render(<StatusBadgePanel verdict="stalled" score={72} detail="chain paused but RPC answers" />);
    expect(screen.getByRole('img', { name: /stalled/i })).toBeInTheDocument();
    expect(screen.getByText(/api\/badge\?target=portaldot-v3-testnet/)).toBeInTheDocument();
  });
});
