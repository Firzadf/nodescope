/**
 * Fee Lab share links for custom deploy artifacts.
 *
 * A share link carries the whole custom deploy state in the URL query, so
 * a builder can send a teammate a link that opens Fee Lab with their
 * contract already loaded — no server, no storage, nothing uploaded:
 *   /app/fee-lab?op=deploy&from=0x…&code=0x…&args=0x…
 *
 * Parsing is forgiving on purpose: a bad `from` is dropped (the panel
 * falls back to its default origin) and a link without a usable `code`
 * parses to null (the panel renders its default state) instead of
 * erroring. Only a well-formed 0x code counts as shared state, so a
 * malformed link can never inject an invented estimate.
 */
export type FeeLabShareState = {
  from?: string;
  code?: string;
  args?: string;
};

const HEX = /^0x[0-9a-fA-F]+$/;
const H160 = /^0x[0-9a-fA-F]{40}$/;

export function buildFeeLabShareParams(state: FeeLabShareState): string {
  const params = new URLSearchParams();
  params.set('op', 'deploy');
  if (state.from) params.set('from', state.from);
  if (state.code) params.set('code', state.code);
  if (state.args) params.set('args', state.args);
  return params.toString();
}

export function parseFeeLabShareParams(search: string): FeeLabShareState | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (params.get('op') !== 'deploy') return null;
  const code = params.get('code');
  if (!code || !HEX.test(code)) return null;
  const out: FeeLabShareState = { code };
  const from = params.get('from');
  if (from && H160.test(from)) out.from = from;
  const args = params.get('args');
  if (args && /^0x[0-9a-fA-F]*$/.test(args) && args !== '0x') out.args = args;
  return out;
}
