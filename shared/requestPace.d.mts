export const OFFICIAL_RPS_LIMIT: number;
export const REQUEST_GAP_MS: number;
export function setRequestGapMs(ms: number): void;
export function resetRequestPacer(): void;
export function requestLaneKey(url: string): string;
export function paceRequest(url: string): Promise<void>;
