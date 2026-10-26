import { describe, it, expect } from 'vitest';
import { parseArtifactInput, ArtifactInputError } from './artifactInput';

describe('parseArtifactInput', () => {
  it('reads a solc artifact plus constructorArgs', () => {
    expect(
      parseArtifactInput(JSON.stringify({ evm: { bytecode: { object: '0x608060' } }, constructorArgs: '0x0001' })),
    ).toEqual({ bytecode: '0x608060', constructorData: '0x0001' });
  });

  it('reads flat and nested bytecode forms and raw hex text', () => {
    expect(parseArtifactInput(JSON.stringify({ bytecode: '0x6080' }))).toEqual({ bytecode: '0x6080', constructorData: '' });
    expect(parseArtifactInput(JSON.stringify({ bytecode: { object: '0x6080' } }))).toEqual({ bytecode: '0x6080', constructorData: '' });
    expect(parseArtifactInput('0x608060')).toEqual({ bytecode: '0x608060', constructorData: '' });
  });

  it('codes every failure so the panel can translate it', () => {
    const codeOf = (text: string) => {
      try {
        parseArtifactInput(text);
        return 'no-throw';
      } catch (e) {
        expect(e).toBeInstanceOf(ArtifactInputError);
        return (e as ArtifactInputError).code;
      }
    };
    expect(codeOf('not json, not hex')).toBe('invalid-json');
    expect(codeOf(JSON.stringify({ abi: [] }))).toBe('no-bytecode');
    expect(codeOf(JSON.stringify({ deployedBytecode: '0x6080' }))).toBe('deployed-only');
    expect(codeOf(JSON.stringify({ bytecode: 'zz' }))).toBe('bad-hex');
    expect(codeOf(JSON.stringify({ bytecode: '0x6080', constructorArgs: 'nope' }))).toBe('bad-args');
  });
});
