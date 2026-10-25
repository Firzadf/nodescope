import { describe, it, expect } from 'vitest';
import { runFullDiagnosticSteps } from './fullDiagnostic';

describe('runFullDiagnosticSteps', () => {
  it('runs steps in order and reports each result', async () => {
    const order: string[] = [];
    const results = await runFullDiagnosticSteps([
      { id: 'a', label: 'A', run: async () => { order.push('a'); return 'a ok'; } },
      { id: 'b', label: 'B', run: async () => { order.push('b'); return 'b ok'; } },
    ]);
    expect(order).toEqual(['a', 'b']);
    expect(results).toEqual([
      { id: 'a', status: 'done', detail: 'a ok' },
      { id: 'b', status: 'done', detail: 'b ok' },
    ]);
  });

  it('keeps going after a failing step and captures the error', async () => {
    const results = await runFullDiagnosticSteps([
      { id: 'a', label: 'A', run: async () => { throw new Error('boom'); } },
      { id: 'b', label: 'B', run: async () => 'b ok' },
    ]);
    expect(results).toEqual([
      { id: 'a', status: 'failed', detail: 'boom' },
      { id: 'b', status: 'done', detail: 'b ok' },
    ]);
  });

  it('reports running/done/failed transitions through the callback', async () => {
    const seen: Array<[string, string]> = [];
    await runFullDiagnosticSteps(
      [
        { id: 'a', label: 'A', run: async () => 'a ok' },
        { id: 'b', label: 'B', run: async () => { throw new Error('nope'); } },
      ],
      (id, status) => { seen.push([id, status]); },
    );
    expect(seen).toEqual([
      ['a', 'running'], ['a', 'done'],
      ['b', 'running'], ['b', 'failed'],
    ]);
  });
});
