import type { RpcDiagnosticResult } from '../types/rpc';

export const PORTALDOT_V3_TESTNET_CHAIN_ID = 420420777;
export const PORTALDOT_V3_TESTNET_CHAIN_ID_HEX = '0x190f1ca9';

export interface ChainIdValidationResult {
  isPortaldotV3Testnet: boolean;
  chainId: number | null;
  chainIdHex: string | null;
  error: string | null;
}

export function validatePortaldotV3ChainId(res: RpcDiagnosticResult | null): ChainIdValidationResult {
  if (!res) {
    return {
      isPortaldotV3Testnet: false,
      chainId: null,
      chainIdHex: null,
      error: 'No RPC result provided',
    };
  }

  if (!res.success || !res.response || res.response.error) {
    const rpcError = res.response?.error;
    return {
      isPortaldotV3Testnet: false,
      chainId: null,
      chainIdHex: null,
      error: res.error || (rpcError ? `JSON-RPC Error [${rpcError.code}]: ${rpcError.message}` : 'RPC request failed'),
    };
  }

  if (res.request.method !== 'eth_chainId') {
    return {
      isPortaldotV3Testnet: false,
      chainId: null,
      chainIdHex: null,
      error: 'Chain ID verification requires an eth_chainId response',
    };
  }

  const result = res.response.result;

  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    return {
      isPortaldotV3Testnet: false,
      chainId: null,
      chainIdHex: null,
      error: 'Chain ID response is not a valid hex string',
    };
  }

  const chainIdDecimal = parseInt(result, 16);

  if (Number.isNaN(chainIdDecimal)) {
    return {
      isPortaldotV3Testnet: false,
      chainId: null,
      chainIdHex: result,
      error: 'Failed to parse chain ID hex string',
    };
  }

  const isMatch = chainIdDecimal === PORTALDOT_V3_TESTNET_CHAIN_ID;

  return {
    isPortaldotV3Testnet: isMatch,
    chainId: chainIdDecimal,
    chainIdHex: result,
    error: isMatch ? null : `Chain ID mismatch: expected ${PORTALDOT_V3_TESTNET_CHAIN_ID}, got ${chainIdDecimal}`,
  };
}
