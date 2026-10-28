import { substrateRpc } from './substrateRpc';
import { READ_ONLY_STATE_CALLS } from '../utils/rpcSecurity';

export interface RuntimeAddress {
  accountId: string | null;
  h160: string | null;
  error: string | null;
}

function asHex(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) ? value.toLowerCase() : null;
}

/**
 * Read-only ReviveApi state_call. Confirms the local AccountId32Mapper
 * against the runtime, which also sees OriginalAccount storage.
 * The only methods passed are ReviveApi_account_id and ReviveApi_address.
 */
export async function confirmAddressOnRuntime(
  wssUrl: string,
  h160: string,
  accountId: string,
  wsFactory?: (url: string) => import('./substrateWsProbe').WebSocketLike,
): Promise<RuntimeAddress> {
  const accountCall = READ_ONLY_STATE_CALLS[0];
  const addressCall = READ_ONLY_STATE_CALLS[1];
  const res = await substrateRpc(
    wssUrl,
    [
      { method: 'state_call', params: [accountCall, h160] },
      { method: 'state_call', params: [addressCall, accountId] },
    ],
    wsFactory ? { wsFactory } : {},
  );
  if (!res.ok) return { accountId: null, h160: null, error: res.error };
  return { accountId: asHex(res.results[0]), h160: asHex(res.results[1]), error: null };
}
