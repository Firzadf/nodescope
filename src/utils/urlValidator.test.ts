import { describe, it, expect } from 'vitest';
import { validateRpcUrl } from './urlValidator';

describe('validateRpcUrl', () => {
  it('accepts valid http url', () => {
    const result = validateRpcUrl('http://localhost:9933');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts valid https url', () => {
    const result = validateRpcUrl('https://rpc.portaldot.io');
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects empty or whitespace url', () => {
    expect(validateRpcUrl('').isValid).toBe(false);
    expect(validateRpcUrl('   ').isValid).toBe(false);
  });

  it('rejects unsupported protocols like ftp or file or javascript', () => {
    expect(validateRpcUrl('ftp://example.com').isValid).toBe(false);
    expect(validateRpcUrl('file:///etc/passwd').isValid).toBe(false);
    expect(validateRpcUrl('javascript:alert(1)').isValid).toBe(false);
  });

  it('rejects malformed url', () => {
    expect(validateRpcUrl('not-a-url').isValid).toBe(false);
  });
});
