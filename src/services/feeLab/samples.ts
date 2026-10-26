/**
 * Public, read-only sample inputs used for estimates. Nothing here is a secret.
 * Discovered on Portaldot V3 testnet on 2026-10-26 via eth_getLogs(Transfer):
 *  - token  0xe0114a…dbc2  symbol "pUSDT", 6 decimals (deployed by another builder)
 *  - holder 0x03c502…d912  holds the token and has native tPOT (Ethereum-derived account)
 *  - existing recipient 0x521d8a…5b93 (a PortalSwap pair contract that already holds the token -> no new storage slot)
 *  - existing EOA 0x11d9f0…52b7 (funded, no code) used for plain value transfers; sending value to the
 *    pair contract reverts because it has no receive()/fallback.
 * Estimates never sign or send anything; the "from" is only used as the dry-run origin.
 */
export const SAMPLE = {
  erc20Token: '0xe0114adc0a2072b602c645f5a07eefa1eadbdbc2',
  erc20Symbol: 'pUSDT',
  erc20Decimals: 6,
  holder: '0x03c502abb79e8eee50135c91933d059d982dd912',
  existingRecipient: '0x521d8aafeee92e2fa31829faa009fe3698245b93',
  existingEoa: '0x11d9f0ca1da31bb54752bf0f43b7ba51110752b7',
  freshRecipient: '0x2222222222222222222222222222222222222222',
  /** pallet-assets asset 7777 = "Portaldot USD (test)" pUSD, 6 decimals. */
  nativeAssetId: 7777,
} as const;
