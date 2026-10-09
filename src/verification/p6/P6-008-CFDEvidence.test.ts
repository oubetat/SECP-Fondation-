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

describe('P6-008 — CFD EVIDENCE', () => {
  const engine = SimulationCertificateEngine.getInstance();
  
  beforeEach(() => {
    engine.resetRegistry();
    EngineeringPLMEngine.clear();
  });

  const basePolicy: SimulationCertificationPolicy = {
    policyId: 'POL-CFD-001',
    requiredLevel: 5,
    requireConvergence: true,
    requireConservation: true, // Physical conservation is critical in CFD
    requireIndependentVerification: true,
    requiredClaims: ['YPLUS_OK']
  };

  const buildManifests = (overrides?: any) => {
    const rawInput = {
      simulationId: 'SIM-CFD-001',
      simulationType: 'CFD' as const,
      projectId: 'PRJ-1',
      engineeringObjectId: 'CAD-DUCT-1',
      objectRevision: 'REV-A',
      modelHash: 'MOD-3D-CFD',
      geometryHash: 'GEO-3D-CFD',
      meshHash: overrides?.meshHash || 'MESH-CFD',
      materialHash: 'MAT-AIR',
      boundaryConditionHash: 'BC-CFD',
      initialConditionHash: 'IC-CFD',
      solverConfigurationHash: 'SOL-CFD',
      cfdParameters: {
        fluid: 'AIR',
        density: 1.225,
        viscosity: 1.81e-5,
        boundaryConditions: { INLET: 'VELOCITY', OUTLET: 'PRESSURE' },
        initialConditions: {},
        solverSettings: {},
        timeStep: 0.01,
        convergenceCriteria: { velocityResidual: 1e-4 },
        turbulenceModel: 'K_EPSILON',
        numericalSchemes: {}
      }
    };
    
    const input = engine.buildSimulationInputManifest(rawInput);
    
    const execution = engine.buildSimulationExecutionManifest({
      executionId: 'EXEC-CFD-001',
      simulationId: 'SIM-CFD-001',
      solverIdentity: 'SECP-CFD-SOLVER',
      solverVersion: '2.0.0',
      hardwareProfile: 'VIRTUAL-NODE',
      executionTimestamp: '2026-09-09T08:00:00Z',
      executionDurationMs: 45000,
      exitCode: 0,
      resourceConsumption: { memoryMb: 4096, computeCores: 8 }
    });

    const result = engine.buildSimulationResultManifest({
      resultId: 'RES-CFD-001',
      executionId: 'EXEC-CFD-001',
      resultHash: 'RES-HASH-CFD',
      scalarResults: { maxVelocity: 15.5, pressureDrop: 120 },
      tensorResults: {},
      convergenceMetrics: {
        isConverged: overrides?.isConverged ?? true,
        iterations: 300,
        finalResidual: 1e-5
      },
      conservationMetrics: {
        isConserved: overrides?.isConserved ?? true,
        massBalance: 1e-7,
        energyBalance: 1e-6
      },
      residualHistory: overrides?.residualHistory || [{ 'velocity': 1e-5 }]
    });

    const matrix: SimulationVerificationMatrix = {
      verificationId: 'VERIF-CFD-001',
      resultId: 'RES-CFD-001',
      claims: [
        { claimId: 'YPLUS_OK', claimType: 'MESH_QUALITY', description: 'y+ < 5', passed: true }
      ]
    };
    
    return { input, execution, result, matrix };
  };

  it('P6-008-A — Valid converged CFD result produces CERTIFIED evidence', () => {
    const { input, execution, result, matrix } = buildManifests();
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(true);
    expect(certOutcome.certificate?.certificationStatus).toBe('CERTIFIED');
    expect(certOutcome.certificate?.simulationType).toBe('CFD');
  });

  it('P6-008-B — Non-converged CFD result blocks certification (REJECTED)', () => {
    const { input, execution, result, matrix } = buildManifests({ isConverged: false });
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Simulation failed required convergence tolerance.');
  });

  it('P6-008-C — CFD conservation failure blocks certification', () => {
    const { input, execution, result, matrix } = buildManifests({ isConserved: false });
    
    const certOutcome = engine.createSimulationCertificate({
      input, execution, result, matrix, policy: basePolicy
    });
    
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.errors).toContain('Physical conservation equations were violated.');
  });

  it('P6-008-D — CFD Numerical Reproducibility tolerance check', () => {
    // Note: Due to floating point math in massive matrix solves, CFD is generally only
    // reproducible within an engineering tolerance, rather than bit-for-bit identical across architectures.
    const { input, execution, result, matrix } = buildManifests();
    
    const resultB = engine.buildSimulationResultManifest({
      ...result,
      resultHash: 'HASH-B', // explicitly distinct hash to simulate bitwise difference
      scalarResults: { maxVelocity: 15.50001, pressureDrop: 120.00005 }
    });

    const compareOutcome = engine.compareRuns(
      { input, execution, result },
      { input, execution, result: resultB },
      'NUMERICALLY_EQUIVALENT_WITHIN_TOLERANCE',
      1e-3 // engineering tolerance
    );

    expect(compareOutcome.isReproducible).toBe(true);
    expect(compareOutcome.reason).toContain('Numerical equivalence within tolerance confirmed');
    
    // Explicitly proving bitwise would fail
    const compareBitwise = engine.compareRuns(
      { input, execution, result },
      { input, execution, result: resultB },
      'BITWISE_IDENTICAL'
    );
    expect(compareBitwise.isReproducible).toBe(false);
  });
});
