export type OpKind = 'nativeTransfer' | 'erc20Transfer' | 'contractDeploy' | 'calldata' | 'assetsTransfer';

export type DualTx =
  | { kind: 'nativeTransfer'; from: string; to: string; amountPlanck: bigint }
  | { kind: 'erc20Transfer'; from: string; token: string; to: string; amount: bigint }
  | { kind: 'contractDeploy'; from: string; bytecode: string; constructorData?: string }
  | { kind: 'calldata'; from: string; to?: string; data: string; valuePlanck?: bigint }
  /** Native-only op: pallet-assets transfer. EVM side is reported unavailable (no verified ERC-20 precompile address). */
  | { kind: 'assetsTransfer'; from: string; assetId: number; to: string; amount: bigint };

