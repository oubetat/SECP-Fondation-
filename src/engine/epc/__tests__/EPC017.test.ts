/**
 * SECP Industrial OS — EPC-017 Test Suite
 * Comprehensive Verification of System Requirements Schema, Traceability,
 * Multidisciplinary Change Impact, Gatekeeping, and Coverage Calculations.
 */

import { describe, it, expect } from 'vitest';
import { EPC017Verifier } from '../EPC017Verifier';
import { IndustrialDroneSystemRequirements } from '../system/IndustrialDroneSystemRequirements';
import { SystemRequirementValidator } from '../system/SystemRequirementValidator';
import { SystemRequirementManager } from '../system/SystemRequirementManager';
import { RequirementImpactEngine } from '../system/RequirementImpactEngine';
import {
  SystemRequirement,
  SystemRequirementValidationError
} from '../system/SystemRequirementTypes';
import { IndustrialDroneProofCase } from '../mission/IndustrialDroneProofCase';

describe('SECP EPC-017 — System Requirements Test Suite', () => {
  // Test 1: Full Verifier Run
  it('should run EPC017Verifier and achieve PASS verdict for Industrial Drone', () => {
    const result = EPC017Verifier.runVerification();

    expect(result.epc).toBe('EPC-017');
    expect(result.verdict).toBe('PASS');
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64); // SHA-256 hex string

    // Verify all 12 core checks passed
    const checks = result.checks;
    expect(checks['SYSTEM_REQUIREMENT_SCHEMA_VALIDITY'].passed).toBe(true);
    expect(checks['UNIQUE_REQUIREMENT_IDENTIFIERS'].passed).toBe(true);
    expect(checks['MANDATORY_FIELDS_COMPLETENESS'].passed).toBe(true);
    expect(checks['NUMERIC_AND_UNIT_CONSISTENCY'].passed).toBe(true);
    expect(checks['BOUNDS_AND_TOLERANCE_CONSISTENCY'].passed).toBe(true);
    expect(checks['QUALITATIVE_CRITERIA_COMPLETENESS'].passed).toBe(true);
    expect(checks['MISSION_TO_SYSTEM_TRACEABILITY'].passed).toBe(true);
    expect(checks['PRIORITY_AND_CRITICAL_VALIDATION_RULES'].passed).toBe(true);
    expect(checks['EVIDENCE_GATEKEEPING_NO_HARDCODED_PASS'].passed).toBe(true);
    expect(checks['CHANGE_IMPACT_DETECTION'].passed).toBe(true);
    expect(checks['REQUIREMENT_COVERAGE_CALCULATION'].passed).toBe(true);
    expect(checks['UNIVERSAL_ENGINE_COMPLIANCE'].passed).toBe(true);
  });

  // Test 2: Industrial Drone Requirement Synthesis
  it('should synthesize 25 comprehensive system requirements from EPC-016 baseline', () => {
    const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig();
    expect(reqs.length).toBeGreaterThanOrEqual(25);

    const categories = new Set(reqs.map(r => r.category));
    expect(categories.has('MISSION')).toBe(true);
    expect(categories.has('PERFORMANCE')).toBe(true);
    expect(categories.has('MASS')).toBe(true);
    expect(categories.has('PAYLOAD')).toBe(true);
    expect(categories.has('POWER')).toBe(true);
    expect(categories.has('BATTERY')).toBe(true);
    expect(categories.has('PROPULSION')).toBe(true);
    expect(categories.has('STRUCTURAL')).toBe(true);
    expect(categories.has('AERODYNAMICS')).toBe(true);
    expect(categories.has('ENVIRONMENT')).toBe(true);
    expect(categories.has('CONTROL')).toBe(true);
    expect(categories.has('SAFETY')).toBe(true);
    expect(categories.has('MAINTAINABILITY')).toBe(true);
    expect(categories.has('FLIGHT_DYNAMICS')).toBe(true);
    expect(categories.has('THERMAL')).toBe(true);
    expect(categories.has('MANUFACTURING')).toBe(true);
    expect(categories.has('INTEROPERABILITY')).toBe(true);
  });

  // Test 3: Mandatory Fields Schema Validation
  it('should throw validation error when mandatory fields are missing', () => {
    const invalidReq: any = {
      requirementId: 'REQ-FAIL-001',
      // missing caseId, domain, category, title, description, type, priority, etc.
    };

    expect(() => SystemRequirementValidator.validate(invalidReq)).toThrowError(
      SystemRequirementValidationError
    );
  });

  // Test 4: Critical Requirement Mandatory Validation Method
  it('should enforce that CRITICAL priority requirements must have validationMethod', () => {
    const reqWithoutVal: any = {
      requirementId: 'REQ-CRIT-001',
      caseId: 'CASE-001',
      domain: 'AEROSPACE',
      category: 'MASS',
      title: 'Critical Mass',
      description: 'Airframe mass target',
      type: 'PHYSICAL',
      priority: 'CRITICAL',
      verificationMethod: 'ANALYSIS',
      // validationMethod missing!
      status: 'DEFINED',
      acceptanceCriteria: 'mass <= 5.0 kg',
      parameter: 'mass',
      value: 5.0,
      unit: 'kg'
    };

    expect(() => SystemRequirementValidator.validate(reqWithoutVal)).toThrowError(
      /Critical requirement 'REQ-CRIT-001' must specify a valid validationMethod/
    );
  });

  // Test 5: Rejection of Vague Acceptance Criteria
  it('should reject vague or placeholder acceptance criteria', () => {
    const vagueReq: any = {
      requirementId: 'REQ-VAGUE-001',
      caseId: 'CASE-001',
      domain: 'AEROSPACE',
      category: 'PERFORMANCE',
      title: 'Vague Req',
      description: 'Some description',
      type: 'PERFORMANCE',
      priority: 'HIGH',
      verificationMethod: 'SIMULATION',
      status: 'DEFINED',
      acceptanceCriteria: 'looks good',
      parameter: 'speed',
      value: 15,
      unit: 'm/s'
    };

    expect(() => SystemRequirementValidator.validate(vagueReq)).toThrowError(
      /Invalid acceptanceCriteria 'looks good'/
    );
  });

  // Test 6: Unit Validation and Dimensional Compatibility
  it('should enforce unit validity and dimensional compatibility', () => {
    // 1. Invalid unit
    const invalidUnitReq: any = {
      requirementId: 'REQ-UNIT-001',
      caseId: 'CASE-001',
      domain: 'AEROSPACE',
      category: 'PERFORMANCE',
      title: 'Invalid Unit',
      description: 'Invalid unit string',
      type: 'PERFORMANCE',
      priority: 'LOW',
      verificationMethod: 'CALCULATION',
      status: 'DEFINED',
      acceptanceCriteria: 'speed >= 10',
      parameter: 'speed',
      value: 10,
      unit: 'xyz_unknown_unit_123'
    };

    expect(() => SystemRequirementValidator.validate(invalidUnitReq)).toThrowError(
      /Invalid or unsupported engineering unit/
    );

    // 2. Incompatible dimension (e.g. mass unit 'kg' for 'speed' parameter)
    const incompatibleReq: any = {
      ...invalidUnitReq,
      unit: 'kg'
    };

    expect(() => SystemRequirementValidator.validate(incompatibleReq)).toThrowError(
      /Dimensionally incompatible parameter 'speed' and unit 'kg'/
    );
  });

  // Test 7: Min / Target / Max Bounds Consistency
  it('should enforce mathematical consistency on bounds (min <= target <= max)', () => {
    const baseReq: any = {
      requirementId: 'REQ-BOUNDS-001',
      caseId: 'CASE-001',
      domain: 'AEROSPACE',
      category: 'PERFORMANCE',
      title: 'Bounds Test',
      description: 'Testing bounds',
      type: 'PERFORMANCE',
      priority: 'MEDIUM',
      verificationMethod: 'CALCULATION',
      status: 'DEFINED',
      acceptanceCriteria: 'speed within range',
      parameter: 'speed',
      unit: 'm/s'
    };

    // min > max
    expect(() =>
      SystemRequirementValidator.validate({
        ...baseReq,
        minimumValue: 20,
        maximumValue: 10
      })
    ).toThrowError(/Inconsistent bounds/);

    // target < min
    expect(() =>
      SystemRequirementValidator.validate({
        ...baseReq,
        minimumValue: 10,
        maximumValue: 30,
        targetValue: 5
      })
    ).toThrowError(/targetValue \(5\) is below minimumValue \(10\)/);

    // target > max
    expect(() =>
      SystemRequirementValidator.validate({
        ...baseReq,
        minimumValue: 10,
        maximumValue: 30,
        targetValue: 35
      })
    ).toThrowError(/targetValue \(35\) exceeds maximumValue \(30\)/);
  });

  // Test 8: Duplicate Requirement ID Detection
  it('should detect duplicate requirement IDs in collection', () => {
    const valid = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig();
    const withDuplicate = [...valid, { ...valid[0] }];

    expect(() => SystemRequirementValidator.validateCollection(withDuplicate)).toThrowError(
      /Duplicate requirementId detected/
    );
  });

  // Test 9: Qualitative Requirements Handling
  it('should validate qualitative requirements with formal criteria without numeric fields', () => {
    const qualitativeReq: SystemRequirement = {
      requirementId: 'REQ-QUAL-001',
      caseId: 'CASE-001',
      domain: 'MECHANICAL',
      category: 'PAYLOAD',
      title: 'Payload Quick Latch Mechanism',
      description: 'Quick-release latch allows toolless mounting of optical payload.',
      type: 'INTERFACE',
      acceptanceCriteria: 'Latch engages within 5 seconds and withstands 15g operational shock without unlatching.',
      priority: 'HIGH',
      verificationMethod: 'INSPECTION',
      validationMethod: 'PHYSICAL_TEST',
      source: 'CUSTOMER_REQUIREMENT',
      status: 'DEFINED',
      verificationStatus: 'NOT_RUN',
      validationStatus: 'NOT_RUN',
      readinessStatus: 'READY_FOR_VERIFICATION',
      revision: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const validated = SystemRequirementValidator.validate(qualitativeReq);
    expect(validated.parameter).toBeUndefined();
    expect(validated.value).toBeUndefined();
    expect(validated.unit).toBeUndefined();
    expect(validated.acceptanceCriteria).toBeDefined();
  });

  // Test 10: Multidisciplinary Change Impact Detection
  it('should detect affected subsystems and disciplines when requirements change', () => {
    // Mass change
    const massImpact = RequirementImpactEngine.evaluateParameterImpact(
      'DRONE-REQ-005',
      'maximumTakeoffMass',
      6.5,
      7.0,
      'MASS'
    );
    expect(massImpact.impactedSubsystems).toContain('MASS_PROPERTIES');
    expect(massImpact.impactedSubsystems).toContain('PROPULSION');
    expect(massImpact.impactedDisciplines).toContain('STRUCTURAL_FEA');
    expect(massImpact.requiresReanalysis).toBe(true);

    // Speed change
    const speedImpact = RequirementImpactEngine.evaluateParameterImpact(
      'DRONE-REQ-002',
      'cruiseSpeed',
      12.0,
      15.0,
      'PERFORMANCE'
    );
    expect(speedImpact.impactedSubsystems).toContain('AERODYNAMICS_ROTOR');
    expect(speedImpact.impactedDisciplines).toContain('CFD_AERODYNAMICS');

    // Battery / Power change
    const powerImpact = RequirementImpactEngine.evaluateParameterImpact(
      'DRONE-REQ-011',
      'batteryCapacity',
      450,
      500,
      'BATTERY'
    );
    expect(powerImpact.impactedSubsystems).toContain('ENERGY_STORAGE');
    expect(powerImpact.impactedDisciplines).toContain('MISSION_ENDURANCE_SIMULATION');
  });

  // Test 11: Revision Management and Immutability
  it('should create immutable revision history when updating a requirement', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();
    const initialReq = manager.getRequirement('DRONE-REQ-005')!;
    expect(initialReq.revision).toBe('1.0');
    const initialMass = initialReq.value!;

    const updateResult = manager.updateRequirement(
      'DRONE-REQ-005',
      { value: initialMass + 0.3, targetValue: initialMass + 0.3, maximumValue: initialMass + 0.3 },
      'Payload weight growth adjustment',
      'Lead Aerospace Engineer'
    );

    expect(updateResult.updatedRequirement.revision).toBe('2.0');
    expect(updateResult.updatedRequirement.value).toBe(initialMass + 0.3);
    expect(updateResult.updatedRequirement.changeHistory?.length).toBe(1);
    expect(updateResult.updatedRequirement.changeHistory?.[0].reason).toBe('Payload weight growth adjustment');

    const history = manager.getRevisionHistory('DRONE-REQ-005');
    expect(history.length).toBe(2);
    expect(history[0].value).toBe(initialMass); // previous revision preserved!
    expect(history[1].value).toBe(initialMass + 0.3);
  });

  // Test 12: Status Transition Gatekeeper - Verification Evidence Required
  it('should block transition to VERIFIED without verification evidence', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();

    expect(() => {
      manager.transitionStatus('DRONE-REQ-005', 'VERIFIED');
    }).toThrowError(/Verification Evidence is required/);

    // Providing valid evidence transitions successfully
    const verified = manager.transitionStatus(
      'DRONE-REQ-005',
      'VERIFIED',
      'EVID-STRUCT-MASS-CALIB-001'
    );
    expect(verified.status).toBe('VERIFIED');
    expect(verified.verificationStatus).toBe('PASSED');
    expect(verified.verificationEvidenceId).toBe('EVID-STRUCT-MASS-CALIB-001');
  });

  // Test 13: Status Transition Gatekeeper - Validation Evidence Required
  it('should block transition to VALIDATED without validation evidence and prior verification', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();

    // 1. Trying to transition to VALIDATED before VERIFIED
    expect(() => {
      manager.transitionStatus('DRONE-REQ-010', 'VALIDATED', 'EVID-FLIGHT-TEST-001', true);
    }).toThrowError(/before verification has passed/);

    // 2. First verify
    manager.transitionStatus('DRONE-REQ-010', 'VERIFIED', 'EVID-SIM-ENDURANCE-001');

    // 3. Now validate
    const validated = manager.transitionStatus(
      'DRONE-REQ-010',
      'VALIDATED',
      'EVID-FLIGHT-TEST-001',
      true
    );
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validationStatus).toBe('PASSED');
    expect(validated.validationEvidenceId).toBe('EVID-FLIGHT-TEST-001');
  });

  // Test 14: Execution Readiness Evaluation
  it('should accurately evaluate requirement execution readiness based on input availability', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();

    // Without FEA inputs, structural requirement is NOT ready
    const readinessNotReady = manager.evaluateReadiness('DRONE-REQ-013', []);
    expect(readinessNotReady.isReady).toBe(false);
    expect(readinessNotReady.missingInputs).toContain('CAD_GEOMETRY');
    expect(readinessNotReady.missingInputs).toContain('MATERIAL_PROPERTIES');
    expect(readinessNotReady.missingInputs).toContain('LOAD_CASES');

    // With provided FEA inputs, structural requirement becomes READY_FOR_VERIFICATION
    const readinessReady = manager.evaluateReadiness('DRONE-REQ-013', [
      'CAD_GEOMETRY',
      'MATERIAL_PROPERTIES',
      'LOAD_CASES',
      'BOUNDARY_CONDITIONS'
    ]);
    expect(readinessReady.isReady).toBe(true);
    expect(readinessReady.readinessStatus).toBe('READY_FOR_VERIFICATION');
    expect(readinessReady.missingInputs.length).toBe(0);
  });

  // Test 15: Requirement Coverage Report and Gate Blocking
  it('should compute coverage and block gate when critical requirements are unverified', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();
    const initialCoverage = manager.computeCoverage();

    expect(initialCoverage.totalRequirements).toBeGreaterThanOrEqual(25);
    expect(initialCoverage.withVerificationPathCount).toBe(initialCoverage.totalRequirements);
    expect(initialCoverage.coveragePercentage).toBe(100);
    expect(initialCoverage.criticalCount).toBeGreaterThanOrEqual(4);
    expect(initialCoverage.isGateBlocked).toBe(true); // blocked because unverified
    expect(initialCoverage.gateBlockReason).toContain('Gate blocked');

    // Verify all critical requirements
    const criticalReqs = manager.getCriticalRequirements();
    for (const crit of criticalReqs) {
      manager.transitionStatus(crit.requirementId, 'VERIFIED', `EVID-TEST-${crit.requirementId}`);
    }

    const updatedCoverage = manager.computeCoverage();
    expect(updatedCoverage.criticalVerifiedCount).toBe(criticalReqs.length);
    expect(updatedCoverage.criticalUnverifiedIds.length).toBe(0);
    expect(updatedCoverage.isGateBlocked).toBe(false); // gate unblocked!
  });

  // Test 16: Traceability Graph Generation
  it('should generate EPC-003 Traceability graph and EPC-002 Engineering Requirements', () => {
    const manager = IndustrialDroneSystemRequirements.createManager();
    const trace = manager.toTraceabilityGraph();

    expect(trace.artifacts.length).toBeGreaterThanOrEqual(25);
    expect(trace.edges.length).toBeGreaterThanOrEqual(20);

    const epc002Reqs = manager.toEPC002Requirements();
    expect(epc002Reqs.length).toBe(trace.artifacts.length);
    expect(epc002Reqs[0].tolerance).toBeDefined();
    expect(epc002Reqs[0].verificationMethod).toBeDefined();
  });

  // Test 17: Universal Engine Compliance across multiple engineering domains
  it('should work seamlessly for non-drone domains (Robotic Arm, Hydraulic Actuator)', () => {
    const robotReq: SystemRequirement = {
      requirementId: 'ROBOT-REQ-001',
      caseId: 'EPC-CASE-ROBOT-001',
      domain: 'INDUSTRIAL_ROBOTICS',
      category: 'PERFORMANCE',
      title: 'End-Effector Positional Repeatability',
      description: 'Manipulator wrist shall achieve sub-millimeter positioning repeatability under 10 kg payload.',
      type: 'PERFORMANCE',
      parameter: 'machiningTolerance',
      value: 0.05,
      targetValue: 0.05,
      maximumValue: 0.1,
      unit: 'mm',
      acceptanceCriteria: 'repeatabilityRadius <= 0.1 mm over 10,000 ISO 9283 standard test cycles',
      priority: 'CRITICAL',
      verificationMethod: 'MEASUREMENT',
      validationMethod: 'PHYSICAL_TEST',
      source: 'STANDARDS',
      status: 'DEFINED',
      verificationStatus: 'NOT_RUN',
      validationStatus: 'NOT_RUN',
      readinessStatus: 'READY_FOR_VERIFICATION',
      revision: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const validated = SystemRequirementValidator.validate(robotReq);
    expect(validated.domain).toBe('INDUSTRIAL_ROBOTICS');

    const manager = new SystemRequirementManager([validated]);
    expect(manager.getAllRequirements().length).toBe(1);
    expect(manager.getCriticalRequirements().length).toBe(1);

    const impact = RequirementImpactEngine.evaluateParameterImpact(
      'ROBOT-REQ-001',
      'machiningTolerance',
      0.05,
      0.02,
      'MANUFACTURING'
    );
    expect(impact.requiresReanalysis).toBe(true);
  });
});
