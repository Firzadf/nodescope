/**
 * Custom contract artifact input for the Fee Lab deploy op.
 *
 * Same parsing rules as the CLI (cli/lib.mjs parseArtifact), so the app
 * and the CLI agree on what counts as a valid artifact. Failures carry a
 * machine-readable `code` instead of a prose string, so the panel can
 * render the message in the session language (EN/ID) instead of leaking
 * an English-only error into the Indonesian UI.
 *
 * Accepted: a solc JSON artifact (bytecode, bytecode.object, or
 * evm.bytecode.object), or raw 0x creation bytecode. Optional constructor
 * args come from a `constructorArgs` / `constructorData` hex field and are
 * appended to the creation bytecode by the estimator. An artifact with
 * only deployedBytecode is rejected: runtime code cannot price a deploy,
 * and silently pricing it would invent a number.
 */
export type ArtifactInputCode =
  | 'invalid-json'
  | 'no-bytecode'
  | 'deployed-only'
  | 'bad-hex'
  | 'bad-args';

export class ArtifactInputError extends Error {
  code: ArtifactInputCode;
  constructor(code: ArtifactInputCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type ParsedArtifact = {
  bytecode: string;
  constructorData: string;
};

const HEX = /^0x[0-9a-fA-F]+$/;

function pickBytecode(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { object?: unknown }).object === 'string') {
    return (v as { object: string }).object;
  }
  return null;
}

export function parseArtifactInput(text: string): ParsedArtifact {
  const trimmed = text.trim();
  if (HEX.test(trimmed)) {
    return { bytecode: trimmed, constructorData: '' };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw new ArtifactInputError('invalid-json', 'Artifact is not valid JSON and not raw 0x bytecode.');
  }
  if (typeof obj === 'string' && HEX.test(obj.trim())) {
    return { bytecode: obj.trim(), constructorData: '' };
  }
  if (!obj || typeof obj !== 'object') {
    throw new ArtifactInputError('invalid-json', 'Artifact JSON must be an object with a creation bytecode field.');
  }
  const record = obj as Record<string, unknown>;
  const evm = record.evm as Record<string, unknown> | undefined;
  const bytecode = pickBytecode(record.bytecode) ?? (evm ? pickBytecode(evm.bytecode) : null) ?? null;
  if (!bytecode) {
    const deployed = pickBytecode(record.deployedBytecode) ?? (evm ? pickBytecode(evm.deployedBytecode) : null);
    if (deployed) {
      throw new ArtifactInputError(
        'deployed-only',
        'Artifact contains only deployedBytecode (runtime code). NodeScope needs creation bytecode (evm.bytecode.object) to price a deploy.',
      );
    }
    throw new ArtifactInputError(
      'no-bytecode',
      'No creation bytecode found in artifact. Expected one of: bytecode, bytecode.object, or evm.bytecode.object.',
    );
  }
  if (!HEX.test(bytecode)) {
    throw new ArtifactInputError('bad-hex', 'Bytecode must be 0x-prefixed hex.');
  }
  const rawArgs = record.constructorArgs ?? record.constructorData ?? '';
  if (typeof rawArgs !== 'string' || (rawArgs !== '' && !/^0x[0-9a-fA-F]*$/.test(rawArgs))) {
    throw new ArtifactInputError('bad-args', 'constructorArgs must be 0x-prefixed hex (ABI-encoded constructor arguments).');
  }
  return { bytecode, constructorData: rawArgs === '0x' ? '' : rawArgs };
}
