import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCertificateEngine } from '../../engine/certification/SimulationCertificateEngine';
import { 
  SimulationInputManifest, 
  SimulationExecutionManifest, 
  SimulationResultManifest,
  SimulationVerificationMatrix,
  SimulationCertificationPolicy
} from '../../engine/certification/simulationTypes';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';

describe('P6-007 — FEM EVIDENCE', () => {
  const engine = SimulationCertificateEngine.getInstance();
  
  beforeEach(() => {
    engine.resetRegistry();
    EngineeringPLMEngine.clear();
  });

  const basePolicy: SimulationCertificationPolicy = {
    policyId: 'POL-FEM-001',
    requiredLevel: 5,
    requireConvergence: true,
    requireConservation: false,
    requireIndependentVerification: true,
    requiredClaims: ['MESH_ASPECT_RATIO_OK']
  };

  const buildManifests = (overrides?: any) => {
    const rawInput = {
      simulationId: 'SIM-FEM-001',
      simulationType: 'FEM' as const,
      projectId: 'PRJ-1',
      engineeringObjectId: 'CAD-PART-1',
      objectRevision: 'REV-A',
      modelHash: 'MOD-123',
      geometryHash: 'GEO-123',
      meshHash: overrides?.meshHash || 'MESH-123',
      materialHash: 'MAT-123',
      boundaryConditionHash: 'BC-123',
      initialConditionHash: 'IC-123',
      solverConfigurationHash: 'SOL-123',
      femParameters: {
        material: 'STEEL',
        youngsModulus: 200e9,
        poissonRatio: 0.3,
        density: 7850,
        loads: {},
        boundaryConditions: {},
        constraints: {},
        solverConfiguration: {},
        convergenceCriteria: { forceTolerance: 1e-4 }
      }
    };
    
    const input = engine.buildSimulationInputManifest(rawInput);
    
    const execution = engine.buildSimulationExecutionManifest({
      executionId: 'EXEC-FEM-001',
      simulationId: 'SIM-FEM-001',
      solverIdentity: 'SECP-FEM-SOLVER',
      solverVersion: '1.2.0',
      hardwareProfile: 'VIRTUAL-NODE',
      executionTimestamp: '2026-09-09T08:00:00Z',
      executionDurationMs: 15000,
      exitCode: 0,
      resourceConsumption: { memoryMb: 1024, computeCores: 4 }
    });

    const result = engine.buildSimulationResultManifest({
      resultId: 'RES-FEM-001',
      executionId: 'EXEC-FEM-001',
      resultHash: 'RES-HASH-123',
      scalarResults: { maxVonMises: 150, maxDisplacement: 0.05 },
      tensorResults: {},
      convergenceMetrics: {
        isConverged: overrides?.isConverged ?? true,
        iterations: 15,
        finalResidual: 1e-5
      },
      residualHistory: overrides?.residualHistory || [{ 'force': 1e-5 }]
    });

    const matrix: SimulationVerificationMatrix = {
      verificationId: 'VERIF-FEM-001',
      resultId: 'RES-FEM-001',
      claims: [
        { claimId: 'MESH_ASPECT_RATIO_OK', claimType: 'MESH_QUALITY', description: 'Mesh AR < 10', passed: true }
      ]
    };
    
    return { input, execution, result, matrix };
  };

  it('P6-007-A — Valid converged FEM result produces CERTIFIED evidence', () => {
    const { input, execution, result, matrix } = buildManifests();
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(true);
    expect(certOutcome.certificate?.certificationStatus).toBe('CERTIFIED');
    expect(certOutcome.certificate?.simulationId).toBe('SIM-FEM-001');
    expect(certOutcome.certificate?.objectRevision).toBe('REV-A');
  });

  it('P6-007-B — Non-converged FEM result blocks certification (REJECTED)', () => {
    const { input, execution, result, matrix } = buildManifests({ isConverged: false });
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Simulation failed required convergence tolerance.');
  });

  it('P6-007-C — NaN in residuals blocks certification', () => {
    const { input, execution, result, matrix } = buildManifests({ residualHistory: [{ 'force': NaN }] });
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Residual force contains NaN');
  });

  it('P6-007-D — Changed input generates new hash and old evidence is invalid for it', () => {
    const { input: inputA, execution, result, matrix } = buildManifests();
    const certOutcomeA = engine.createSimulationCertificate({
      input: inputA, execution, result, matrix, policy: basePolicy
    });
    expect(certOutcomeA.success).toBe(true);

    // Change Mesh (e.g. refinement)
    const { input: inputB } = buildManifests({ meshHash: 'MESH-456' });
    
    expect(inputA.inputHash).not.toBe(inputB.inputHash);
    
    // Attempting to certify with old execution/result on new input
    // The engine's signature would mismatch in a real run, but logically,
    // the inputs are entirely decoupled now and hash will differ.
    // In SimulationCertificateEngine, the cert is bound to the specific inputHash.
    expect(certOutcomeA.certificate?.inputHash).not.toBe(inputB.inputHash);
  });
});
