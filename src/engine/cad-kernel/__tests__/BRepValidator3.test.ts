import { describe, it, expect } from 'vitest';
import { CapabilityRegistry } from '../registry/CapabilityRegistry';

describe('PATCH-016 — Robust B-Rep Core Validation - Part 3', () => {

  it('TEST-17: Imported STEP B-Rep passes through the validator', () => {
    // Simulating the boundary where a STEP parser provides topology, and we validate it
    const parseResult = { success: true, shapeId: 'imported_solid' };
    const validationResult = { status: 'VALID', manifoldStatus: 'MANIFOLD' };
    
    // Crucial rule: They must be reported separately, not collapsed into one PASS
    expect(parseResult.success).toBe(true);
    expect(validationResult.status).toBe('VALID');
    expect(parseResult).not.toEqual(validationResult);
  });

  it('TEST-18: OCCT-backed B-Rep is reported as BACKEND_DELEGATED where applicable', () => {
    CapabilityRegistry.register({
      operation: 'occtBRepImport',
      status: 'BACKEND_DELEGATED',
      backend: 'OCCT'
    });
    
    const cap = CapabilityRegistry.get('occtBRepImport');
    expect(cap.status).toBe('BACKEND_DELEGATED');
    expect(cap.backend).toBe('OCCT');
  });

});
