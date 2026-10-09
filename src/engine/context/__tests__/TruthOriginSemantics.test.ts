import { describe, it, expect } from 'vitest';
import { deriveTruthProvenance } from '../EngineeringContext';

describe('GATE 4 — Truth Origin Semantics Verification', () => {
  it('should correctly classify CFD 1D/quasi-3D flow evaluation as ANALYTICAL', () => {
    const descriptor = deriveTruthProvenance({
      hasActiveGeometry: true,
      algorithmType: 'ANALYTICAL_1D_CFD',
      documentId: 'DOC-001',
      revision: 1,
      hasResult: true,
      verificationPassed: true,
      evidenceId: 'EV_CFD_001'
    });

    expect(descriptor.status).toBe('ANALYTICAL');
    expect(descriptor.label).toContain('CAD-DERIVED ANALYTICAL');
  });

  it('should classify FEM procedural mesh analysis as ACTIVE_MODEL', () => {
    const descriptor = deriveTruthProvenance({
      hasActiveGeometry: true,
      algorithmType: 'PROCEDURAL_FEM_MESH',
      documentId: 'DOC-001',
      revision: 1,
      hasResult: true,
      verificationPassed: true,
      evidenceId: 'EV_FEM_001'
    });

    expect(descriptor.status).toBe('ACTIVE_MODEL');
    expect(descriptor.label).toContain('ACTIVE MODEL');
  });

  it('should prove Truth Origin is NOT derived solely from hasActiveGeometry flag', () => {
    // Both have hasActiveGeometry = true, but different computation semantics
    const cfdDesc = deriveTruthProvenance({
      hasActiveGeometry: true,
      algorithmType: 'ANALYTICAL_1D_CFD'
    });

    const femDesc = deriveTruthProvenance({
      hasActiveGeometry: true,
      algorithmType: 'PROCEDURAL_FEM_MESH'
    });

    expect(cfdDesc.status).not.toEqual(femDesc.status);
    expect(cfdDesc.status).toBe('ANALYTICAL');
    expect(femDesc.status).toBe('ACTIVE_MODEL');
  });
});
