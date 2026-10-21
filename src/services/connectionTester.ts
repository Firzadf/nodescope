import { sendJsonRpcRequest } from './rpcClient';
import {
  validatePortaldotV3ChainId,
  type ChainIdValidationResult,
} from '../utils/chainIdValidator';
import type { RpcDiagnosticResult } from '../types/rpc';
import type { ConnectionStatus } from '../types/node';

export interface PortaldotV3EvmConnectionResult {
  chainIdResult: RpcDiagnosticResult;
  blockResult: RpcDiagnosticResult;
  validation: ChainIdValidationResult;
  status: ConnectionStatus;
}

export async function testPortaldotV3EvmConnection(
  endpoint: string
): Promise<PortaldotV3EvmConnectionResult> {
  const chainIdResult = await sendJsonRpcRequest(endpoint, 'eth_chainId', [], 5000);
  const validation = validatePortaldotV3ChainId(chainIdResult);
  const blockResult = await sendJsonRpcRequest(endpoint, 'eth_blockNumber', [], 5000);

  let status: ConnectionStatus = 'error';
  if (validation.isPortaldotV3Testnet) {
    status = 'connected';
  } else if (validation.chainId !== null) {
    status = 'connected';
  } else {
    status = 'error';
  }

  return { chainIdResult, blockResult, validation, status };
}

export async function testGenericHttpConnection(
  endpoint: string
): Promise<{ result: RpcDiagnosticResult; status: ConnectionStatus }> {
  const result = await sendJsonRpcRequest(endpoint, 'system_health', [], 5000);
  return { result, status: result.success ? 'connected' : 'error' };
}
