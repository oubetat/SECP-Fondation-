import { describe, it, expect } from 'vitest';
import { StructuralStressQualificationBridge } from '../StructuralStressQualificationBridge';
import { QualificationRequirement } from '../QualificationRequirement';

describe('StructuralStressQualificationBridge', () => {
  const sampleRequirement: QualificationRequirement = {
    requirementId: 'REQ-ECU-PCB-MECH-004',
    sourceStandard: 'IPC-6012-CLASS-3',
    criticality: 'SAFETY_CRITICAL',
    title: 'PCB Substrate Structural Stability Under Shock & Bending',
    description: 'The ECU PCB shall maintain structural integrity without excessive deflection under static load.',
    verificationMethod: 'SIMULATION',
    authoritativeEngine: 'PcbStructuralDeflectionEngine.evaluateStructuralIntegrity',
    targetReference: {
      domain: 'MCAD',
      elementId: 'PCB_SUBSTRATE_01',
      elementType: 'COMPONENT',
      canonicalModelPath: 'pcb.substrate'
    },
    acceptanceCriteria: {
      operator: '==',
      expectedValue: true,
      unit: 'boolean'
    },
    state: 'IMPLEMENTED',
    solverValidityLimits: 'Valid for linear elastic isotropic/orthotropic thin Kirchhoff plates'
  };

  it('evaluates structural requirement and produces verified cryptographic evidence when compliant', () => {
    const boardParams = {
      lengthMm: 160,
      widthMm: 100,
      thicknessMm: 1.6,
      youngModulusGpa: 24, // FR4
      poissonRatio: 0.14,
      densityKgM3: 1850,
      totalMassKg: 0.15,
      mountingType: 'FOUR_CORNERS_SUPPORTED' as const
    };

    const result = StructuralStressQualificationBridge.evaluateStructuralRequirement(
      sampleRequirement,
      boardParams,
      500.0 // 500 Pa
    );

    expect(result.isSatisfied).toBe(true);
    expect(result.feaResult.isMechanicallyStable).toBe(true);
    expect(result.feaResult.maxDeflectionMm).toBeGreaterThan(0);
    expect(result.feaResult.maxDeflectionMm).toBeLessThan(1.0);
    expect(result.evidence.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence.requirementId).toBe('REQ-ECU-PCB-MECH-004');
    expect(result.evidence.isCompliant).toBe(true);
  });

  it('detects structural non-compliance when board thickness is severely reduced', () => {
    const stressRequirement: QualificationRequirement = {
      ...sampleRequirement,
      acceptanceCriteria: {
        operator: '<=',
        expectedValue: 50.0, // max 50 MPa
        unit: 'MPa'
      }
    };

    // Extremely thin foil-like substrate with huge span
    const fragileBoardParams = {
      lengthMm: 500,
      widthMm: 500,
      thicknessMm: 0.1, // very thin
      youngModulusGpa: 10,
      poissonRatio: 0.14,
      densityKgM3: 1850,
      totalMassKg: 0.5,
      mountingType: 'FOUR_CORNERS_SUPPORTED' as const
    };

    const result = StructuralStressQualificationBridge.evaluateStructuralRequirement(
      stressRequirement,
      fragileBoardParams,
      2000.0 // high load
    );

    expect(result.isSatisfied).toBe(false);
    expect(result.evidence.isCompliant).toBe(false);
    expect(result.evidence.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('guarantees cryptographic hash invalidation when dimensions mutate', () => {
    const baseParams = {
      lengthMm: 160,
      widthMm: 100,
      thicknessMm: 1.6,
      youngModulusGpa: 24,
      poissonRatio: 0.14,
      densityKgM3: 1850,
      totalMassKg: 0.15,
      mountingType: 'FOUR_CORNERS_SUPPORTED' as const
    };

    const result1 = StructuralStressQualificationBridge.evaluateStructuralRequirement(
      sampleRequirement,
      baseParams
    );

    const result2 = StructuralStressQualificationBridge.evaluateStructuralRequirement(
      sampleRequirement,
      { ...baseParams, thicknessMm: 2.0 } // modified thickness
    );

    expect(result1.evidence.evidenceDigest).not.toBe(result2.evidence.evidenceDigest);
    expect(result2.feaResult.maxDeflectionMm).toBeLessThan(result1.feaResult.maxDeflectionMm);
  });
});
