import type { RpcDiagnosticResult } from './rpc';
import type { ChainIdValidationResult } from '../utils/chainIdValidator';

export type EndpointProfile = 'portaldot_v3_evm' | 'generic_http';

export const DEFAULT_PORTALDOT_V3_EVM_RPC = 'https://test-evm-rpc-v3.portaldot.dev';

export interface EvmConnectionDetails {
  chainIdResult: RpcDiagnosticResult;
  blockResult: RpcDiagnosticResult;
  validation: ChainIdValidationResult;
}
