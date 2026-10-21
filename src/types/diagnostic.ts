export type FindingSeverity = 'info' | 'warning' | 'error';

export interface Finding {
  ruleId: string;
  severity: FindingSeverity;
  title: string;
  evidence: string;
  explanation: string;
  recommendation: string;
}
