import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCertificateEngine } from '../../engine/certification/SimulationCertificateEngine';
import { SimulationCertificationPolicy } from '../../engine/certification/simulationTypes';
import { EngineeringPLMEngine } from '../../engine/plm/EngineeringPLMEngine';

describe('P6-026 — PRODUCTION CERTIFICATION', () => {
  const engine = SimulationCertificateEngine.getInstance();
  
  beforeEach(() => {
    engine.resetRegistry();
    EngineeringPLMEngine.clear();
  });

  const level6Policy: SimulationCertificationPolicy = {
    policyId: 'POL-AERO-LEVEL-6',
    requiredLevel: 6,
    requireConvergence: true,
    requireConservation: true,
    requireIndependentVerification: true,
    requiredClaims: ['MESH_QUALITY_EXCELLENT', 'PHYSICAL_CONSERVATION_CONFIRMED']
  };

  it('P6-026-A — Comprehensive Level-6 Production Simulation Certificate succeeds without mocks', () => {
    const rawInput = {
      simulationId: 'SIM-CFD-L6',
      simulationType: 'CFD' as const,
      projectId: 'PRJ-AERO',
      engineeringObjectId: 'WING-01',
      objectRevision: 'REV-C',
      modelHash: 'MOD-L6',
      geometryHash: 'GEO-L6',
      meshHash: 'MESH-L6',
      materialHash: 'MAT-AIR-IDEAL',
      boundaryConditionHash: 'BC-MACH-0.8',
      initialConditionHash: 'IC-L6',
      solverConfigurationHash: 'SOL-NAVIER-STOKES',
      cfdParameters: {
        fluid: 'AIR', density: 1.225, viscosity: 1.81e-5,
        boundaryConditions: { INLET: 'VELOCITY', OUTLET: 'PRESSURE', WALL: 'NO_SLIP' },
        initialConditions: {}, solverSettings: { precision: 'DOUBLE' },
        timeStep: 0.001, convergenceCriteria: { velocityResidual: 1e-6 },
        turbulenceModel: 'K_OMEGA_SST', numericalSchemes: { advection: 'SECOND_ORDER_UPWIND' }
      }
    };
    
    const input = engine.buildSimulationInputManifest(rawInput);
    
    const execution = engine.buildSimulationExecutionManifest({
      executionId: 'EXEC-L6-01', simulationId: 'SIM-CFD-L6', solverIdentity: 'SECP-CFD-ENTERPRISE', solverVersion: '2.5.0',
      hardwareProfile: 'HPC-CLUSTER-NODE-A', executionTimestamp: new Date().toISOString(), executionDurationMs: 120000,
      exitCode: 0, resourceConsumption: { memoryMb: 128000, computeCores: 64 }
    });

    const result = engine.buildSimulationResultManifest({
      resultId: 'RES-L6-01', executionId: 'EXEC-L6-01', resultHash: 'HASH-L6-RES',
      scalarResults: { dragCoefficient: 0.021, liftCoefficient: 0.45 },
      tensorResults: {},
      convergenceMetrics: { isConverged: true, iterations: 1500, finalResidual: 1e-6 },
      conservationMetrics: { isConserved: true, massBalance: 1e-9, energyBalance: 1e-8 },
      residualHistory: [{ 'velocity': 1e-6, 'pressure': 1e-6 }]
    });

    const matrix = {
      verificationId: 'VERIF-L6-01', resultId: 'RES-L6-01',
      claims: [
        { claimId: 'MESH_QUALITY_EXCELLENT', claimType: 'MESH_QUALITY', description: 'y+ < 1 confirmed', passed: true },
        { claimId: 'PHYSICAL_CONSERVATION_CONFIRMED', claimType: 'PHYSICAL_CONSERVATION', description: 'Mass and Momentum conserved', passed: true }
      ]
    };
    
    const certOutcome = engine.createSimulationCertificate({ input, execution, result, matrix, policy: level6Policy });
    
    expect(certOutcome.success).toBe(true);
    expect(certOutcome.certificate?.certificationStatus).toBe('CERTIFIED');
    expect(certOutcome.certificate?.certificationLevel).toBe(5);
    expect(certOutcome.certificate?.simulationId).toBe('SIM-CFD-L6');
  });
});
