import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCertificateEngine } from '../../engine/certification/SimulationCertificateEngine';
import { SimulationCertificationPolicy } from '../../engine/certification/simulationTypes';

describe('P6-021 — COMPLIANCE POLICY BINDING', () => {
  const engine = SimulationCertificateEngine.getInstance();
  
  beforeEach(() => {
    engine.resetRegistry();
  });

  const basePolicy: SimulationCertificationPolicy = {
    policyId: 'POL-COMPLIANCE',
    requiredLevel: 5,
    requireConvergence: true,
    requireConservation: false,
    requireIndependentVerification: true,
    requiredClaims: ['ASME_Y14_5_COMPLIANT']
  };

  const buildManifests = (overrides?: any) => {
    const rawInput = {
      simulationId: 'SIM-COMP',
      simulationType: 'FEM' as const,
      projectId: 'PRJ-1',
      engineeringObjectId: 'CAD-PART-1',
      objectRevision: 'REV-A',
      modelHash: 'MOD-1',
      geometryHash: 'GEO-1',
      meshHash: 'MESH-1',
      materialHash: 'MAT-1',
      boundaryConditionHash: 'BC-1',
      initialConditionHash: 'IC-1',
      solverConfigurationHash: 'SOL-1',
      femParameters: {
        material: 'STEEL', youngsModulus: 200e9, poissonRatio: 0.3, density: 7850,
        loads: {}, boundaryConditions: {}, constraints: {}, solverConfiguration: {},
        convergenceCriteria: { forceTolerance: 1e-4 }
      }
    };
    
    const input = engine.buildSimulationInputManifest(rawInput);
    
    const execution = engine.buildSimulationExecutionManifest({
      executionId: 'EXEC-1', simulationId: 'SIM-COMP', solverIdentity: 'SECP-FEM', solverVersion: '1.0', hardwareProfile: 'VIRTUAL', executionTimestamp: '', executionDurationMs: 10, exitCode: 0, resourceConsumption: { memoryMb: 1, computeCores: 1 }
    });

    const result = engine.buildSimulationResultManifest({
      resultId: 'RES-1', executionId: 'EXEC-1', resultHash: 'HASH', scalarResults: {}, tensorResults: {},
      convergenceMetrics: { isConverged: true, iterations: 1, finalResidual: 0 },
      residualHistory: []
    });

    const matrix = {
      verificationId: 'VERIF-1', resultId: 'RES-1',
      claims: overrides?.claims || [{ claimId: 'ASME_Y14_5_COMPLIANT', claimType: 'COMPLIANCE', description: '', passed: true }]
    };
    
    return { input, execution, result, matrix };
  };

  it('P6-021-A — Missing required compliance claim blocks certification', () => {
    const { input, execution, result, matrix } = buildManifests({ claims: [] });
    
    const certOutcome = engine.createSimulationCertificate({ input, execution, result, matrix, policy: basePolicy });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Required policy claim ASME_Y14_5_COMPLIANT not verified in verification matrix.');
  });

  it('P6-021-B — Failed compliance claim blocks certification', () => {
    const { input, execution, result, matrix } = buildManifests({ claims: [{ claimId: 'ASME_Y14_5_COMPLIANT', claimType: 'COMPLIANCE', description: '', passed: false }] });
    
    const certOutcome = engine.createSimulationCertificate({ input, execution, result, matrix, policy: basePolicy });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Required policy claim ASME_Y14_5_COMPLIANT not verified in verification matrix.');
  });
});
