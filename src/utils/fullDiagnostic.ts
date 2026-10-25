/**
 * Full-diagnostic orchestration (judge demo flow).
 *
 * Runs caller-supplied steps strictly in order and collects one result per
 * step. A failing step never stops the later steps: a degraded endpoint is
 * itself a result worth showing, so the run reports per-step outcomes and
 * lets the UI decide what "done" means. Pure sequencing logic, no network
 * calls of its own, so it is unit-testable with mock steps.
 */

export type FullDiagnosticStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface FullDiagnosticStepDef {
  id: string;
  label: string;
  /** Resolves to a one-line detail for the step, e.g. "4/4 checks passed". */
  run: () => Promise<string>;
}

export interface FullDiagnosticStepResult {
  id: string;
  status: 'done' | 'failed';
  detail: string;
}

export async function runFullDiagnosticSteps(
  steps: FullDiagnosticStepDef[],
  onStep?: (id: string, status: FullDiagnosticStepStatus, detail?: string) => void,
): Promise<FullDiagnosticStepResult[]> {
  const results: FullDiagnosticStepResult[] = [];
  for (const step of steps) {
    onStep?.(step.id, 'running');
    try {
      const detail = await step.run();
      results.push({ id: step.id, status: 'done', detail });
      onStep?.(step.id, 'done', detail);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Step failed';
      results.push({ id: step.id, status: 'failed', detail });
      onStep?.(step.id, 'failed', detail);
    }
  }
  return results;
}
