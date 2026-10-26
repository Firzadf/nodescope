/**
 * Portaldot V3 testnet constants.
 * Verified live on 2026-10-26 from the sandbox:
 *  - eth_chainId            -> 0x190f1ca9 (420420777)
 *  - system_properties      -> tokenDecimals [14], tokenSymbol [tPOT], ss58Format 42
 *  - revive.nativeToEthRatio -> 10000 (10^(18-14))
 *  - runtime spec           -> portaldot-v3 / 3002
 */
export const PORTALDOT_V3 = {
  name: 'Portaldot V3 Testnet',
  evmRpc: 'https://test-evm-rpc-v3.portaldot.dev',
  substrateWss: 'wss://test-node-v3.portaldot.dev',
  /** Official explorer is Substrate-side. Do not derive EVM explorer links from it. */
  explorer: 'https://node-console.portaldot.dev/',
  chainId: 420420777,
  chainIdHex: '0x190f1ca9',
  symbol: 'tPOT',
  /** Native (Substrate) balance decimals, from runtime chain properties. */
  nativeDecimals: 14,
  /** EVM surface exposes balances/fees scaled to 18 decimals (wei). */
  evmDecimals: 18,
  ss58Format: 42,
} as const;

export type NetworkConfig = {
  evmRpc: string;
  substrateWss: string;
  nativeDecimals: number;
  evmDecimals: number;
};

export const DEFAULT_NETWORK: NetworkConfig = {
  evmRpc: PORTALDOT_V3.evmRpc,
  substrateWss: PORTALDOT_V3.substrateWss,
  nativeDecimals: PORTALDOT_V3.nativeDecimals,
  evmDecimals: PORTALDOT_V3.evmDecimals,
};

/** Storage deposit limit passed to dry-runs. Must be > 0 (a 0/None limit makes revive dry-runs fail). */
export const DRY_RUN_DEPOSIT_LIMIT = 10n ** 22n;
