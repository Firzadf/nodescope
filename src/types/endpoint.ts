import type { RpcDiagnosticResult } from './rpc';
import type { ChainIdValidationResult } from '../utils/chainIdValidator';

export type EndpointProfile = 'portaldot_v3_evm' | 'generic_http';

export interface EvmConnectionDetails {
  chainIdResult: RpcDiagnosticResult;
  blockResult: RpcDiagnosticResult;
  validation: ChainIdValidationResult;
}
