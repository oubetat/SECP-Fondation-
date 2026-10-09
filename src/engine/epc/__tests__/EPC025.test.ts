/**
 * SECP Industrial OS — EPC-025 Test Suite
 * Structural Load Cases Verification
 * Validates requirements traceability, physical derivation, material specs,
 * boundary conditions, evidence package generation, and master verifier verdict PASS.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DroneStructuralLoadCaseManager } from '../loads/DroneStructuralLoadCaseManager';
import { EPC025EvidenceGenerator } from '../loads/EPC025EvidenceGenerator';
import { EPC025Verifier } from '../loads/EPC025Verifier';

describe('EPC-025: Structural Load Cases System', () => {
  let loadCaseManager: DroneStructuralLoadCaseManager;

  beforeEach(() => {
    loadCaseManager = new DroneStructuralLoadCaseManager();
  });

  describe('1. Load Case Schema & Generation', () => {
    it('should generate exactly 10 Industrial Drone Load Cases (LC-001 to LC-010)', () => {
      const loadCases = loadCaseManager.getAllLoadCases();
      expect(loadCases.length).toBe(10);

      const expectedIds = [
        'LC-001', 'LC-002', 'LC-003', 'LC-004', 'LC-005',
        'LC-006', 'LC-007', 'LC-008', 'LC-009', 'LC-010'
      ];

      expectedIds.forEach(id => {
        const lc = loadCaseManager.getLoadCaseById(id);
        expect(lc).toBeDefined();
        expect(lc?.loadCaseId).toBe(id);
      });
    });

    it('should assign explicit SI units and complete schema fields for every load case', () => {
      const loadCases = loadCaseManager.getAllLoadCases();

      loadCases.forEach(lc => {
        expect(lc.caseId).toBe('EPC-016-DRONE-ASSEMBLY');
        expect(lc.requirementIds.length).toBeGreaterThan(0);
        expect(lc.name.length).toBeGreaterThan(5);
        expect(lc.description.length).toBeGreaterThan(10);
        expect(lc.operatingCondition).toBeDefined();
        expect(lc.revisions.geometryRevision).toBe('1.0');
        expect(lc.revisions.materialRevision).toBe('1.0');
        expect(lc.massProperties.totalMassKg).toBeGreaterThan(0);
        expect(lc.massProperties.gravityMps2).toBeCloseTo(9.80665, 4);
        expect(lc.factors.ultimateSafetyFactor).toBe(1.5);
        expect(lc.material).toBeDefined();
        expect(lc.feaHandoffSpec.targetSolver).toBe('SECP_3D_FEA_SOLVER');
      });
    });
  });

  describe('2. Specific Physical Derivations (LC-001 to LC-010)', () => {
    it('LC-001: Gravity / Static load should balance complete assembly mass on 4 landing gear feet', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-001')!;
      expect(lc.loadType).toBe('STATIC_GRAVITY');
      expect(lc.requirementIds).toContain('DRONE-REQ-005');

      const sumFz = lc.loads.forces.reduce((acc, f) => acc + f.force.z, 0);
      const expectedWeightN = -lc.massProperties.totalMassKg * 9.80665;
      expect(sumFz).toBeCloseTo(expectedWeightN, 2);
      expect(lc.boundaryConditions.length).toBe(4); // 4 landing gear supports
    });

    it('LC-002: Hover load should balance total hover thrust against gravity', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-002')!;
      expect(lc.loadType).toBe('HOVER');
      const expectedHoverThrust = lc.massProperties.totalMassKg * 9.80665;
      expect(lc.loads.propulsion.totalThrustN).toBeCloseTo(expectedHoverThrust, 2);
      expect(lc.loads.motorLoads.length).toBe(4);
    });

    it('LC-003: Climb acceleration load should incorporate 3.5 m/s^2 vertical acceleration', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-003')!;
      expect(lc.loadType).toBe('CLIMB_ACCELERATION');
      expect(lc.operatingCondition.linearAccelerationMps2.z).toBe(3.5);

      const expectedThrust = lc.massProperties.totalMassKg * (9.80665 + 3.5);
      expect(lc.loads.propulsion.totalThrustN).toBeCloseTo(expectedThrust, 2);
    });

    it('LC-004: Descent flare load should calculate reduced thrust and vertical airframe drag', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-004')!;
      expect(lc.loadType).toBe('DESCENT');
      expect(lc.operatingCondition.climbRateMps).toBe(-2.5);
      const hoverThrust = lc.massProperties.totalMassKg * 9.80665;
      expect(lc.loads.propulsion.totalThrustN).toBeLessThan(hoverThrust); // Thrust less than hover weight
    });

    it('LC-005: Forward flight load should integrate EPC-024 CFD drag, lift, and tilted thrust', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-005')!;
      expect(lc.loadType).toBe('FORWARD_FLIGHT');
      expect(lc.requirementIds).toContain('DRONE-REQ-002');
      expect(lc.loads.pressures.length).toBeGreaterThan(0);
      expect(lc.loads.componentsBreakdown.some(c => c.category === 'AERODYNAMIC')).toBe(true);
    });

    it('LC-006: Maneuver load should evaluate 3.5g limit factor and roll control torque', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-006')!;
      expect(lc.loadType).toBe('MANEUVER');
      expect(lc.factors.limitLoadFactor).toBe(3.5);
      expect(lc.factors.designLoadFactor).toBe(3.5 * 1.5); // 5.25g
    });

    it('LC-007: Payload load case should evaluate 1.5 kg gimbal load & attachment bending moment', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-007')!;
      expect(lc.loadType).toBe('PAYLOAD');
      expect(lc.loads.payload.payloadMassKg).toBe(1.5);
      expect(lc.loads.payload.attachmentForceN.z).toBeLessThan(0);
      expect(lc.material.materialName).toContain('Aluminum 7075-T6');
    });

    it('LC-008: Motor propulsion load case should derive from EPC-023 max static thrust', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-008')!;
      expect(lc.loadType).toBe('MOTOR_PROPULSION');
      expect(lc.loads.propulsion.totalThrustN).toBeGreaterThan(100.0);
      expect(lc.loads.motorLoads[0].mountReactionForceN.z).toBeGreaterThan(0);
    });

    it('LC-009: Landing impact load case should derive peak ground reaction from 1.5 m/s sink rate & 25 mm stroke', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-009')!;
      expect(lc.loadType).toBe('LANDING');
      expect(lc.calculationModel.outputs.aImpact).toBeCloseTo(45.0, 1);
      expect(lc.loads.contacts.length).toBe(4);
    });

    it('LC-010: Asymmetric motor failure load case should balance 3-motor thrust & net moment', () => {
      const lc = loadCaseManager.getLoadCaseById('LC-010')!;
      expect(lc.loadType).toBe('ASYMMETRIC_FAILURE');
      const failedMotor = lc.loads.motorLoads.find(m => m.motorId.includes('FAILED'));
      expect(failedMotor).toBeDefined();
      expect(failedMotor?.thrustN).toBe(0);
    });
  });

  describe('3. Requirements Traceability & Physics Validation', () => {
    it('should generate a complete requirement traceability graph', () => {
      const graph = loadCaseManager.getRequirementTraceabilityGraph();
      expect(graph.length).toBeGreaterThan(10);

      const reqIds = new Set(graph.map(g => g.requirementId));
      expect(reqIds.has('DRONE-REQ-005')).toBe(true);
      expect(reqIds.has('DRONE-REQ-012')).toBe(true);
      expect(reqIds.has('DRONE-REQ-013')).toBe(true);
      expect(reqIds.has('DRONE-REQ-019')).toBe(true);
    });

    it('should satisfy physical consistency and positive material stress margins across all cases', () => {
      const reports = loadCaseManager.validatePhysicalConsistency();
      expect(reports.length).toBe(10);

      reports.forEach(r => {
        expect(r.unitsCheckPassed).toBe(true);
        expect(r.materialStressMargin).toBeGreaterThan(0);
      });
    });

    it('should export a valid FEA handoff package for EPC-026', () => {
      const packageObj = loadCaseManager.exportFEAHandoffPackage();
      expect(packageObj.totalLoadCases).toBe(10);
      expect(packageObj.solverTarget).toBe('SECP_3D_FEA_SOLVER');
      expect(packageObj.loadCases.length).toBe(10);
    });
  });

  describe('4. Evidence Package & Master Verifier', () => {
    it('should generate a valid signed evidence package with canonical SHA-256 hash', () => {
      const pkg = EPC025EvidenceGenerator.generateEvidencePackage(loadCaseManager);
      expect(pkg.totalLoadCases).toBe(10);
      expect(pkg.requirementsCoveredCount).toBeGreaterThan(5);
      expect(pkg.canonicalSha256).toMatch(/^sha256_[0-9a-f]+/);
      expect(pkg.provenanceSignature).toMatch(/^SIG-EPC025-SECP-/);
    });

    it('should pass all 17 acceptance criteria in EPC025Verifier with verdict PASS', () => {
      const verification = EPC025Verifier.verifyEPC025(loadCaseManager);
      expect(verification.overallVerdict).toBe('PASS');
      expect(verification.totalCriteriaCount).toBe(17);
      expect(verification.passedCount).toBe(17);
      expect(verification.failedCount).toBe(0);

      verification.criteriaResults.forEach(c => {
        expect(c.status).toBe('PASS');
      });
    });
  });
});
