import { describe, it, expect, beforeEach } from 'vitest';
import { CoreExecutionAuthority } from '../CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../GenericExecutionRegistry';
import { CoreExecutionRequest } from '../CoreExecutionTypes';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { IndexedDbEngine } from '../../storage/IndexedDbEngine';

describe('SECP POST-PLUGIN-MATURITY-007-BENCHMARK-005: Physical Constraint Enforcement Battery', () => {
  let revisionEngine: RevisionEngine;
  const objectId = 'BENCH-CONSTRAINT-OBJ-001';
  let revHash: string;
  let geomHash: string;

  beforeEach(() => {
    IndexedDbEngine.clearMockStore();
    GenericExecutionRegistry.clear();
    CoreExecutionAuthority.clear();

    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    const rev = revisionEngine.createRevision({
      revisionId: 'REV-CONST-001',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_METROLOGIST',
      content: { geometry: 'PHYSICAL_CONSTRAINTS_TEST_BREP' },
      snapshot: {
        geometryState: {
          parameters: {
            payloadMassKg: 10,
            link1LengthMm: 500,
            link2LengthMm: 500
          },
          features: [],
          topologyHash: 'TOPO-CONST-001',
          geometryHash: 'GEOM-CONST-001'
        }
      }
    } as any);

    revisionEngine.addApproval(rev.revisionId, {
      approvalId: 'APP-CONST-001',
      revisionId: rev.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_METROLOGIST',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for Physical Constraints Qualification'
    });

    revisionEngine.setValidationState(rev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Review');
    revisionEngine.transitionState(rev.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approve');
    const released = revisionEngine.releaseRevision(rev.revisionId, 'ADMIN', 'Release');

    revHash = released.revisionHash;
    geomHash = released.snapshot?.geometryState?.geometryHash!;
  });

  const getRequest = (pluginId: string, executionKind: string, params: Record<string, any>): CoreExecutionRequest => ({
    requestId: `REQ-CONST-${pluginId.toUpperCase()}-${Math.random().toString(36).substring(7)}`,
    engineeringObjectId: objectId,
    revisionId: 'REV-CONST-001',
    targetRevisionHash: revHash,
    targetGeometryHash: geomHash,
    pluginId,
    pluginVersion: '1.0.0',
    executionKind,
    parameters: params
  });

  describe('1. Robotics Constraint Enforcement (M7-ROB-05 / Craig 2005)', () => {
    it('ROB-C01: Rejects negative link1 length', async () => {
      const req = getRequest('secp-plugin-robotics', 'joint-torque', {
        payloadMassKg: 12,
        link1LengthMm: -450,
        link2LengthMm: 520,
        jointMaxAccelDegS2: 120
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Negative arm link length/);
    });

    it('ROB-C02: Rejects negative link2 length', async () => {
      const req = getRequest('secp-plugin-robotics', 'joint-torque', {
        payloadMassKg: 12,
        link1LengthMm: 450,
        link2LengthMm: -520,
        jointMaxAccelDegS2: 120
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Negative arm link length/);
    });

    it('ROB-C03: Accepts valid boundary zero payload mass', async () => {
      const req = getRequest('secp-plugin-robotics', 'joint-torque', {
        payloadMassKg: 0,
        link1LengthMm: 450,
        link2LengthMm: 520,
        jointMaxAccelDegS2: 120
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.rawResults.gravityTorqueNm).toBe(0);
      expect(env.solverResult.rawResults.totalShoulderTorqueNm).toBe(0);
    });

    it('ROB-C04: Rejects negative payload mass', async () => {
      const req = getRequest('secp-plugin-robotics', 'joint-torque', {
        payloadMassKg: -5,
        link1LengthMm: 450,
        link2LengthMm: 520,
        jointMaxAccelDegS2: 120
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Negative payload mass/);
    });

    it('ROB-C05: Executes normal positive link lengths and payload', async () => {
      const req = getRequest('secp-plugin-robotics', 'joint-torque', {
        payloadMassKg: 10,
        link1LengthMm: 500,
        link2LengthMm: 500,
        jointMaxAccelDegS2: 90
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.gravityTorqueNm).toBe(98.1);
    });
  });

  describe('2. Aerospace Atmospheric Constraint Enforcement (M7-AER-05 / ISO 2533)', () => {
    it('AER-C01: Rejects sub-surface negative altitude', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', {
        altitudeM: -1000,
        velocityMs: 250
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Sub-surface negative altitude/);
    });

    it('AER-C02: Rejects altitude exceeding standard atmosphere model ceiling (80,000m)', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', {
        altitudeM: 85000,
        velocityMs: 1500
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Altitude exceeds standard atmospheric model domain ceiling/);
    });

    it('AER-C03: Accepts valid boundary sea-level altitude (h = 0)', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', {
        altitudeM: 0,
        velocityMs: 340.294
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.machNumber).toBeCloseTo(1.0, 2);
    });

    it('AER-C04: Accepts normal cruising altitude (h = 11,000m)', async () => {
      const req = getRequest('secp-plugin-aerospace', 'mach-flow', {
        altitudeM: 11000,
        velocityMs: 295.1
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.machNumber).toBeCloseTo(1.0, 2);
    });
  });

  describe('3. Automotive Aerodynamic Drag Constraint Enforcement (M7-AUT-05 / SAE J2263)', () => {
    it('AUT-C01: Rejects negative drag coefficient (2nd law violation)', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', {
        speedKmH: 100,
        dragCoefficientCd: -0.1,
        frontalAreaM2: 2.0,
        airDensityKgM3: 1.2
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Negative drag coefficient/);
    });

    it('AUT-C02: Accepts valid boundary zero speed (static vehicle)', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', {
        speedKmH: 0,
        dragCoefficientCd: 0.28,
        frontalAreaM2: 2.2,
        airDensityKgM3: 1.225
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.dragForceN).toBe(0);
      expect(env.solverResult.rawResults.powerRequiredKw).toBe(0);
    });

    it('AUT-C03: Rejects non-positive frontal area', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', {
        speedKmH: 100,
        dragCoefficientCd: 0.3,
        frontalAreaM2: 0,
        airDensityKgM3: 1.2
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Non-positive frontal area/);
    });

    it('AUT-C04: Executes standard highway cruise road load', async () => {
      const req = getRequest('secp-plugin-automotive', 'aero-drag', {
        speedKmH: 120,
        dragCoefficientCd: 0.28,
        frontalAreaM2: 2.2,
        airDensityKgM3: 1.225
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.dragForceN).toBe(419.2);
    });
  });

  describe('4. Energy Wind Turbine Betz Limit Enforcement (M7-ENE-05 / IEC 61400-1)', () => {
    it('ENE-C01: Rejects power coefficient exceeding Betz limit (Cp = 0.7 > 16/27)', async () => {
      const req = getRequest('secp-plugin-energy', 'wind-power', {
        windSpeedMS: 10,
        rotorRadiusM: 40,
        powerCoefficientCp: 0.7,
        airDensityKgM3: 1.2,
        generatorEfficiencyPct: 90
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*exceeds thermodynamic Betz limit/);
    });

    it('ENE-C02: Accepts exact theoretical Betz limit boundary (Cp = 16/27)', async () => {
      const req = getRequest('secp-plugin-energy', 'wind-power', {
        windSpeedMS: 10,
        rotorRadiusM: 40,
        powerCoefficientCp: 16 / 27,
        airDensityKgM3: 1.2,
        generatorEfficiencyPct: 90
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.aeroPowerKW).toBeGreaterThan(0);
    });

    it('ENE-C03: Accepts valid boundary zero wind speed', async () => {
      const req = getRequest('secp-plugin-energy', 'wind-power', {
        windSpeedMS: 0,
        rotorRadiusM: 42,
        powerCoefficientCp: 0.44,
        airDensityKgM3: 1.225,
        generatorEfficiencyPct: 92
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.aeroPowerKW).toBe(0);
      expect(env.solverResult.rawResults.electricalPowerMW).toBe(0);
    });

    it('ENE-C04: Rejects generator efficiency exceeding 100%', async () => {
      const req = getRequest('secp-plugin-energy', 'wind-power', {
        windSpeedMS: 10,
        rotorRadiusM: 40,
        powerCoefficientCp: 0.4,
        airDensityKgM3: 1.2,
        generatorEfficiencyPct: 105
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Generator efficiency/);
    });
  });

  describe('5. Marine Hydrostatics Constraint Enforcement (M7-MAR-05 / ITTC 1957)', () => {
    it('MAR-C01: Rejects negative waterline length (L = -40m)', async () => {
      const req = getRequest('secp-plugin-marine', 'hydrostatics', {
        waterlineLengthM: -40,
        vesselSpeedKnots: 15,
        displacementTons: 500
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Non-positive waterline length/);
    });

    it('MAR-C02: Rejects zero waterline length', async () => {
      const req = getRequest('secp-plugin-marine', 'hydrostatics', {
        waterlineLengthM: 0,
        vesselSpeedKnots: 15,
        displacementTons: 500
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Non-positive waterline length/);
    });
  });

  describe('6. Oil & Gas Barlow Stress Constraint Enforcement (M7-OIL-05 / ASME B31.8)', () => {
    it('OIL-C01: Rejects zero wall thickness singularity (t = 0)', async () => {
      const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', {
        internalPressureMPa: 10,
        outerDiameterMm: 500,
        wallThicknessMm: 0,
        materialYieldStrengthMPa: 400,
        safetyFactorASME: 1.5
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Non-positive pipe wall thickness/);
    });

    it('OIL-C02: Rejects negative internal pressure (P < 0)', async () => {
      const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', {
        internalPressureMPa: -5,
        outerDiameterMm: 500,
        wallThicknessMm: 10,
        materialYieldStrengthMPa: 400,
        safetyFactorASME: 1.5
      });
      await expect(CoreExecutionAuthority.execute(req)).rejects.toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*Negative internal pressure/);
    });

    it('OIL-C03: Accepts valid boundary zero pressure (P = 0)', async () => {
      const req = getRequest('secp-plugin-oil-gas', 'barlow-stress', {
        internalPressureMPa: 0,
        outerDiameterMm: 508,
        wallThicknessMm: 15.8,
        materialYieldStrengthMPa: 450,
        safetyFactorASME: 1.39
      });
      const env = await CoreExecutionAuthority.execute(req);
      expect(env.solverResult.status).toBe('SUCCESS');
      expect(env.solverResult.rawResults.hoopStressMPa).toBe(0);
      expect(env.solverResult.rawResults.actualSafetyFactor).toBe(0);
    });
  });
});
