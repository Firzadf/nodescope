import { describe, it, expect } from 'vitest';
import {
  buildAnchorCommand,
  isAddress,
  isReportHash,
  parseReportHashFromJson,
  verifyAttestationReceipt,
} from './attestation';

const CONTRACT = '0x1111111111111111111111111111111111111111';
const HASH = `0x${'ab'.repeat(32)}`;
const OTHER_HASH = `0x${'cd'.repeat(32)}`;

describe('attestation', () => {
  it('validates hashes and addresses strictly', () => {
    expect(isReportHash(HASH)).toBe(true);
    expect(isReportHash('0x1234')).toBe(false);
    expect(isReportHash(HASH.toUpperCase())).toBe(true);
    expect(isAddress(CONTRACT)).toBe(true);
    expect(isAddress('not-an-address')).toBe(false);
  });

  it('builds a cast command with no private key in it', () => {
    const cmd = buildAnchorCommand(CONTRACT, HASH, 'https://test-evm-rpc-v3.portaldot.dev', 420420777, 178285);
    expect(cmd).toContain('anchor(bytes32,string,uint256,uint256)');
    expect(cmd).toContain(HASH);
    expect(cmd).toContain('420420777');
    expect(cmd).not.toMatch(/private-key|private_key|PRIVATE_KEY/);
  });

  it('accepts a receipt whose log carries the report hash as topic[1]', () => {
    const v = verifyAttestationReceipt(
      {
        status: '0x1',
        to: CONTRACT,
        blockNumber: '0x2b80d',
        logs: [{ address: CONTRACT, topics: ['0x' + '00'.repeat(32), HASH] }],
      },
      CONTRACT,
      HASH,
    );
    expect(v.status).toBe('anchored');
    expect(v.blockNumber).toBe(178189);
  });

  it('rejects a failed transaction, a wrong contract, and a non-matching log', () => {
    expect(
      verifyAttestationReceipt({ status: '0x0', to: CONTRACT, logs: [] }, CONTRACT, HASH).status,
    ).toBe('failed');
    expect(
      verifyAttestationReceipt(
        { status: '0x1', to: '0x2222222222222222222222222222222222222222', logs: [] },
        CONTRACT,
        HASH,
      ).status,
    ).toBe('wrong_contract');
    expect(
      verifyAttestationReceipt(
        {
          status: '0x1',
          to: CONTRACT,
          logs: [{ address: CONTRACT, topics: ['0x' + '00'.repeat(32), OTHER_HASH] }],
        },
        CONTRACT,
        HASH,
      ).status,
    ).toBe('no_matching_log');
    expect(verifyAttestationReceipt(null, CONTRACT, HASH).status).toBe('not_found');
    expect(verifyAttestationReceipt(null, 'bad', HASH).status).toBe('invalid_input');
  });

  it('extracts an integrity hash from report JSON and nothing else', () => {
    expect(parseReportHashFromJson(JSON.stringify({ integrity: { hash: HASH } }))).toBe(HASH);
    expect(parseReportHashFromJson(JSON.stringify({ integrity: { hash: 'nope' } }))).toBeNull();
    expect(parseReportHashFromJson('not json')).toBeNull();
  });
});
