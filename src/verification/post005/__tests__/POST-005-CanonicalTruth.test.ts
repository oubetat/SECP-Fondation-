import { describe, it, expect } from 'vitest';
import { EngineeringObjectOS } from '../../../engine/industrial-os/EngineeringObjectOS';
import { EvidenceBus } from '../../../engine/industrial-os/evidence-bus/EvidenceBus';
import { FEAValidationEngine } from '../../../engine/structural-physics/FEAValidationEngine';
import { StructuralAnalysisResults, FEAMesh, BoundaryCondition, LoadDefinition } from '../../../engine/structural-physics/StructuralPhysicsTypes';
import { MissionSimulationEngine } from '../../../engine/epc/mission/MissionSimulationEngine';
import { DroneMassPropertiesManager } from '../../../engine/epc/mass/DroneMassPropertiesManager';
import { DronePropulsionManager } from '../../../engine/epc/propulsion/DronePropulsionManager';
import { DroneAerodynamicModelManager } from '../../../engine/epc/aerodynamics/DroneAerodynamicModelManager';
import { MissionSimulationDefinition } from '../../../engine/epc/mission/MissionSimulationTypes';

describe('POST-005 Track A: Canonical Engineering Truth Verification', () => {
  it('GAP-004: Enforces real EvidenceEnvelope lifecycle & rejects adversarial unverified tokens', () => {
    const os = new EngineeringObjectOS();
    const bus = EvidenceBus.getInstance();

    const obj = os.register({
      metadata: { partNumber: 'HUB-9901', name: 'Turbine Hub Assembly' },
      author: 'lead-engineer'
    });

    expect(obj.evidenceRefs).toEqual([]);

    // 1. Adversarial Injection Test: fake token format
    expect(() => {
      os.attachEvidence(obj.id, 'ev-manual-sandbox', 'attacker');
    }).toThrow(/ADVERSARIAL_INJECTION_REJECTED/);

    // 2. Adversarial Injection Test: correctly formatted but unregistered ID
    expect(() => {
      os.attachEvidence(obj.id, 'ev-deadbeefcafe123456', 'attacker');
    }).toThrow(/ADVERSARIAL_INJECTION_REJECTED.*not found in EvidenceBus/);

    // 3. Legitimate Verified Path: Publish envelope through EvidenceBus
    const envelope = bus.publishSync({
      evidenceId: 'ev-abcdefabcdef',
      id: 'ev-abcdefabcdef',
      evidenceType: 'STATE_EVIDENCE',
      sourceCapability: 'capability:industrial_os.object_os',
      sourceOperation: 'fea-structural-validation',
      engineeringObjectId: obj.id,
      subjectIdentityId: obj.identity.identityId,
      author: 'lead-engineer',
      payload: { vonMisesMaxPa: 2.4e8, residualNorm: 1.2e-4 }
    } as any);

    const updated = os.attachEvidence(obj.id, envelope, 'lead-engineer');
    expect(updated.evidenceRefs).toContain((envelope as any).id || envelope.evidenceId);

    // 4. Transition State with verification evidence check
    os.transitionState(obj.id, 'VALIDATED', 'lead-engineer', {
      reason: 'FEA Simulation Gate Passed',
      verificationEvidenceExists: true
    });
    const transitioned = os.get(obj.id);
    expect(transitioned?.status).toBe('VALIDATED');
  });

  it('GAP-009: FEAValidationEngine performs real residual, BC, equilibrium, and numerical verification', () => {
    const validResults: any = {
      partId: 'PART-101',
      converged: true,
      residualNorm: 1.5e-4, // within default 1e-3 tol
      maxDisplacement: 0.0025, // 2.5 mm
      maxStress: 1.8e8, // 180 MPa
      yieldExceeded: false,
      nodes: [
        { nodeId: 1, displacement: { x: 0, y: 0, z: 0 }, strain: { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, stress: { xx: 0, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, vonMises: 0, safetyFactor: 2.0 },
        { nodeId: 2, displacement: { x: 0.0025, y: 0, z: -0.0004 }, strain: { xx: 0.0009, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, stress: { xx: 1.8e8, yy: 0, zz: 0, xy: 0, yz: 0, xz: 0 }, vonMises: 1.8e8, safetyFactor: 2.0 }
      ]
    };

    const bcs: BoundaryCondition[] = [
      { id: 'BC-1', nodeId: 1, type: 'FIXED', constrainedDOFs: [true, true, true], prescribedDisplacements: [0, 0, 0] }
    ];

    const loads: LoadDefinition[] = [
      { id: 'LOAD-1', nodeId: 2, type: 'FORCE', forceVector: { x: 5000, y: 0, z: 0 } }
    ];

    // 1. Valid analysis accepts
    const reportValid = FEAValidationEngine.validateResults(validResults, null, bcs, loads);
    expect(reportValid.isValid).toBe(true);
    expect(reportValid.verdict).toBe('ACCEPT');
    expect(reportValid.residualValid).toBe(true);
    expect(reportValid.numericalValid).toBe(true);
    expect(reportValid.boundaryConditionsValid).toBe(true);

    // 2. High residual rejects
    const highResidualResults = { ...validResults, residualNorm: 0.05 };
    const reportHighRes = FEAValidationEngine.validateResults(highResidualResults, null, bcs, loads);
    expect(reportHighRes.isValid).toBe(false);
    expect(reportHighRes.verdict).toBe('REJECT');
    expect(reportHighRes.residualValid).toBe(false);

    // 3. BC violation rejects
    const violatingResults = {
      ...validResults,
      nodes: [
        { ...validResults.nodes[0], displacement: { x: 0.01, y: 0, z: 0 } }, // Constrained node moved 10mm!
        validResults.nodes[1]
      ]
    };
    const reportBCViolation = FEAValidationEngine.validateResults(violatingResults, null, bcs, loads);
    expect(reportBCViolation.isValid).toBe(false);
    expect(reportBCViolation.boundaryConditionsValid).toBe(false);

    // 4. Non-finite displacement rejects
    const nanResults = {
      ...validResults,
      nodes: [
        validResults.nodes[0],
        { ...validResults.nodes[1], displacement: { x: NaN, y: 0, z: 0 } }
      ]
    };
    const reportNan = FEAValidationEngine.validateResults(nanResults, null, bcs, loads);
    expect(reportNan.isValid).toBe(false);
    expect(reportNan.numericalValid).toBe(false);
  });

  it('GAP-010: MissionSimulationEngine computes deterministic SHA-256 evidence hash with reproducibility & sensitivity proof', async () => {
    const massMgr1 = new DroneMassPropertiesManager();
    const propMgr1 = new DronePropulsionManager();
    const aeroMgr1 = new DroneAerodynamicModelManager();

    const definition1: any = {
      missionId: 'MISSION-TEST-42',
      environment: {
        airDensityKgM3: 1.225,
        temperatureK: 288.15,
        pressurePa: 101325,
        gravityMS2: 9.80665,
        windVectorMS: { x: 0, y: 0, z: 0 }
      },
      initialState: {
        position: { x: 0, y: 0, z: 0 },
        velocityBody: { x: 0, y: 0, z: 0 },
        angularVelocityBody: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0 },
        initialEnergyJ: 100000
      },
      segments: [
        {
          segmentId: 'CLIMB-1',
          type: 'CLIMB',
          targetAltitudeM: 10,
          terminationCondition: 'DURATION_EXPIRED',
          durationS: 2,
          acceptanceCriteria: {}
        }
      ],
      timeStepS: 0.5,
      requirements: ['REQ-ENDURANCE-001']
    };

    // Run 1
    const engine1 = new MissionSimulationEngine(definition1 as any, massMgr1, propMgr1, aeroMgr1);
    const result1: any = await engine1.execute();

    expect(result1.evidenceHash).toBeDefined();
    expect(result1.evidenceHash).not.toBe('TODO-HASH');
    expect(result1.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result1.trajectory.length).toBeGreaterThan(0);

    // Run 2: Identical inputs -> Identical hash proof (Reproducibility)
    const massMgr2 = new DroneMassPropertiesManager();
    const propMgr2 = new DronePropulsionManager();
    const aeroMgr2 = new DroneAerodynamicModelManager();
    const engine2 = new MissionSimulationEngine(definition1 as any, massMgr2, propMgr2, aeroMgr2);
    const result2: any = await engine2.execute();

    expect(result2.evidenceHash).toBe(result1.evidenceHash);
    expect(result2.trajectory[result2.trajectory.length - 1].energyJ).toBe(result1.trajectory[result1.trajectory.length - 1].energyJ);

    // Run 3: Mutated input (different initial energy) -> Changed hash proof (Sensitivity)
    const definitionMutated: any = {
      ...definition1,
      initialState: {
        ...definition1.initialState,
        initialEnergyJ: 50000 // changed from 100000
      }
    };
    const massMgr3 = new DroneMassPropertiesManager();
    const propMgr3 = new DronePropulsionManager();
    const aeroMgr3 = new DroneAerodynamicModelManager();
    const engine3 = new MissionSimulationEngine(definitionMutated as any, massMgr3, propMgr3, aeroMgr3);
    const resultMutated: any = await engine3.execute();

    expect(resultMutated.evidenceHash).not.toBe(result1.evidenceHash);
    expect(resultMutated.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  }, 60000);
});
