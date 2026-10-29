import { describe, it, expect } from 'vitest';
import { sectionFromPath, pathForSection } from './appSections';

describe('sectionFromPath', () => {
  it('maps known /app paths to sections', () => {
    expect(sectionFromPath('/app')).toBe('overview');
    expect(sectionFromPath('/app/diagnostics')).toBe('diagnostics');
    expect(sectionFromPath('/app/history')).toBe('history');
    expect(sectionFromPath('/app/fee-lab')).toBe('fee-lab');
    expect(sectionFromPath('/app/nodes')).toBe('nodes');
  });

  it('normalizes trailing slashes, so /app/fee-lab/ opens Fee Lab', () => {
    expect(sectionFromPath('/app/')).toBe('overview');
    expect(sectionFromPath('/app/fee-lab/')).toBe('fee-lab');
    expect(sectionFromPath('/app/diagnostics/')).toBe('diagnostics');
  });

  it('falls back to overview for unknown paths', () => {
    expect(sectionFromPath('/')).toBe('overview');
    expect(sectionFromPath('/app/unknown')).toBe('overview');
    expect(sectionFromPath('/verify')).toBe('overview');
  });
});

describe('pathForSection', () => {
  it('maps sections back to paths, defaulting to /app', () => {
    expect(pathForSection('fee-lab')).toBe('/app/fee-lab');
    expect(pathForSection('overview')).toBe('/app');
    expect(pathForSection('nope')).toBe('/app');
  });
});
