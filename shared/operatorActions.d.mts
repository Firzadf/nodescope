export const OPERATOR_ACTIONS_SCHEMA: 'nodescope.operator-actions.v1';

export type OperatorActionKind =
  | 'none'
  | 'run_check'
  | 'restart_node'
  | 'switch_endpoint'
  | 'check_peers'
  | 'wait'
  | 'wait_for_team';

export interface OperatorAction {
  kind: OperatorActionKind;
  title: string;
  nextStep: string;
  short: string;
}

export interface FinalityEpochContext {
  epochSeconds: number;
  placement: 'inside_epoch' | 'past_epoch' | 'unknown';
  note: string;
}

export interface OperatorActionPlan {
  schema: 'nodescope.operator-actions.v1';
  scope: 'self' | 'public_testnet';
  overall: OperatorAction;
  degradation: string | null;
  components: Array<{ id: string; label: string; action: OperatorAction }>;
  parity: { status: string; summary: string } | null;
  finalityEpoch: FinalityEpochContext | null;
}

export function finalityEpochContext(input?: {
  lagBlocks?: number | null;
  finalizedAgeSeconds?: number | null;
}): FinalityEpochContext;

export function planOperatorActions(input?: {
  scope?: 'self' | 'public_testnet';
  score?: {
    score?: number | null;
    components?: Array<{
      id: string;
      label?: string;
      weight: number;
      measured: boolean;
      points: number | null;
      detail?: string;
    }>;
  } | null;
  stall?: {
    state?: string;
    finalityLagBlocks?: number | null;
    finalizedAgeSeconds?: number | null;
  } | null;
  wsProbe?: {
    status?: string;
    peers?: number | null;
    shouldHavePeers?: boolean | null;
    finalityLagBlocks?: number | null;
  } | null;
  parity?: { status?: string; summary?: string } | null;
}): OperatorActionPlan;
