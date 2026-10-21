// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EndpointConfig } from './EndpointConfig';
import { DEFAULT_PORTALDOT_V3_EVM_RPC, type EndpointProfile } from '../../types/endpoint';
import type { ConnectionStatus } from '../../types/node';

interface RenderOptions {
  endpoint?: string;
  connectionStatus?: ConnectionStatus;
  isLoading?: boolean;
  endpointProfile?: EndpointProfile;
}

function renderEndpointConfig(opts: RenderOptions = {}) {
  const onEndpointChange = vi.fn();
  const onConnect = vi.fn();
  const onDisconnect = vi.fn();
  const onProfileChange = vi.fn();

  const utils = render(
    <EndpointConfig
      endpoint={opts.endpoint !== undefined ? opts.endpoint : DEFAULT_PORTALDOT_V3_EVM_RPC}
      onEndpointChange={onEndpointChange}
      connectionStatus={opts.connectionStatus ?? 'disconnected'}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      isLoading={opts.isLoading ?? false}
      endpointProfile={opts.endpointProfile ?? 'portaldot_v3_evm'}
      onProfileChange={onProfileChange}
      evmConnectionDetails={null}
    />
  );

  return {
    ...utils,
    onEndpointChange,
    onConnect,
    onDisconnect,
    onProfileChange,
    getButton: () => screen.getByRole('button', { name: /connect & test/i }),
    getInput: () => screen.getByRole('textbox') as HTMLInputElement,
  };
}

describe('EndpointConfig — Connect & Test button mount & state agreement', () => {
  afterEach(() => {
    cleanup();
  });

  it('enables Connect & Test button on first mount with default endpoint WITHOUT typing', () => {
    const { getButton, getInput } = renderEndpointConfig();

    const input = getInput();
    expect(input.value).toBe(DEFAULT_PORTALDOT_V3_EVM_RPC);

    const button = getButton();
    expect(button).toBeEnabled();
    expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
  });

  it('keeps button disabled on mount when initial endpoint is empty string', () => {
    const { getButton, getInput } = renderEndpointConfig({ endpoint: '' });

    expect(getInput().value).toBe('');
    expect(getButton()).toBeDisabled();
  });

  it('keeps button disabled and displays error on mount when initial endpoint is invalid', () => {
    const { getButton, getInput } = renderEndpointConfig({ endpoint: 'not-a-valid-url' });

    expect(getInput().value).toBe('not-a-valid-url');
    expect(getButton()).toBeDisabled();
    expect(screen.getByText(/invalid url format/i)).toBeInTheDocument();
  });

  it('keeps button disabled on mount when protocol is unsupported (e.g. ws://)', () => {
    const { getButton, getInput } = renderEndpointConfig({ endpoint: 'ws://node.example.com' });

    expect(getInput().value).toBe('ws://node.example.com');
    expect(getButton()).toBeDisabled();
    expect(screen.getByText(/only http and https protocols are allowed/i)).toBeInTheDocument();
  });

  it('enables button when user types a valid URL from an initially empty field', () => {
    const { getButton, getInput, onEndpointChange } = renderEndpointConfig({ endpoint: '' });

    expect(getButton()).toBeDisabled();

    fireEvent.change(getInput(), { target: { value: 'https://custom-node.example.com:8545' } });

    expect(onEndpointChange).toHaveBeenCalledWith('https://custom-node.example.com:8545');
    expect(getButton()).toBeEnabled();
    expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument();
  });

  it('disables button when user clears an initially valid URL', () => {
    const { getButton, getInput } = renderEndpointConfig();

    expect(getButton()).toBeEnabled();

    fireEvent.change(getInput(), { target: { value: '' } });

    expect(getButton()).toBeDisabled();
  });

  it('disables button when user types an invalid URL over an initially valid URL', () => {
    const { getButton, getInput } = renderEndpointConfig();

    expect(getButton()).toBeEnabled();

    fireEvent.change(getInput(), { target: { value: 'ftp://bad-protocol.com' } });

    expect(getButton()).toBeDisabled();
    expect(screen.getByText(/only http and https protocols are allowed/i)).toBeInTheDocument();
  });

  it('fires onConnect when enabled Connect & Test button is clicked', () => {
    const { getButton, onConnect } = renderEndpointConfig();

    const button = getButton();
    expect(button).toBeEnabled();

    fireEvent.click(button);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
