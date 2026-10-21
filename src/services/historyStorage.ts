import type { DiagnosticHistoryItem, RpcDiagnosticResult } from '../types/rpc';

const HISTORY_STORAGE_KEY = 'nodescope_diagnostic_history';
const MAX_HISTORY_ITEMS = 50;

export function getDiagnosticHistory(): DiagnosticHistoryItem[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to read diagnostic history from sessionStorage:', err);
    return [];
  }
}

export function saveDiagnosticHistory(endpoint: string, result: RpcDiagnosticResult): DiagnosticHistoryItem[] {
  try {
    const current = getDiagnosticHistory();
    const newItem: DiagnosticHistoryItem = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      endpoint,
    };

    const updated = [newItem, ...current].slice(0, MAX_HISTORY_ITEMS);
    sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save diagnostic history to sessionStorage:', err);
    return [];
  }
}

export function clearDiagnosticHistory(): void {
  try {
    sessionStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear diagnostic history from sessionStorage:', err);
  }
}
