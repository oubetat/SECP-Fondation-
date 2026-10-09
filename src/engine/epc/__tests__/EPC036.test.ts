/**
 * SECP Industrial OS — EPC-036 Test Suite
 * Comprehensive Verification of Industrial Robotic Arm System Requirements,
 * Traceability, Change Impact, Coverage Calculations, and Verifier Execution.
 */

import { describe, it, expect } from 'vitest';
import { EPC036Verifier } from '../robot/EPC036Verifier';
import { IndustrialRobotSystemRequirements } from '../robot/IndustrialRobotSystemRequirements';
import { SystemRequirementValidator } from '../system/SystemRequirementValidator';
import { SystemRequirementManager } from '../system/SystemRequirementManager';
import { RequirementImpactEngine } from '../system/RequirementImpactEngine';
import {
  SystemRequirement,
  SystemRequirementValidationError
} from '../system/SystemRequirementTypes';

describe('SECP EPC-036 — Industrial Robotic Arm Requirements Test Suite', () => {
  // Test 1: Full Verifier Run
  it('should run EPC036Verifier and achieve PASS verdict for Industrial Robotic Arm', () => {
    const result = EPC036Verifier.runVerification();

    expect(result.epc).toBe('EPC-036');
    expect(result.verdict).toBe('PASS');
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash.length).toBe(64); // SHA-256 hex string

    // Verify all 10 core checks passed
    const checks = result.checks;
    expect(checks['ROBOT_REQUIREMENT_SCHEMA_VALIDITY'].passed).toBe(true);
    expect(checks['ROBOT_UNIQUE_REQUIREMENT_IDENTIFIERS'].passed).toBe(true);
    expect(checks['ROBOT_MANDATORY_FIELDS_COMPLETENESS'].passed).toBe(true);
    expect(checks['ROBOT_NUMERIC_AND_UNIT_CONSISTENCY'].passed).toBe(true);
    expect(checks['ROBOT_BOUNDS_AND_TOLERANCE_CONSISTENCY'].passed).toBe(true);
    expect(checks['ROBOT_QUALITATIVE_CRITERIA_COMPLETENESS'].passed).toBe(true);
    expect(checks['ROBOT_MISSION_TO_SYSTEM_TRACEABILITY'].passed).toBe(true);
    expect(checks['ROBOT_PRIORITY_AND_CRITICAL_VALIDATION_RULES'].passed).toBe(true);
    expect(checks['ROBOT_CHANGE_IMPACT_DETECTION'].passed).toBe(true);
    expect(checks['ROBOT_REQUIREMENT_COVERAGE_CALCULATION'].passed).toBe(true);
  });

  // Test 2: Requirement Synthesis completeness
  it('should synthesize exactly 25 comprehensive system requirements from robotic mission baseline', () => {
    const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig();
    expect(reqs.length).toBe(25);

    const categories = new Set(reqs.map(r => r.category));
    expect(categories.has('PERFORMANCE')).toBe(true);
    expect(categories.has('PAYLOAD')).toBe(true);
    expect(categories.has('CONTROL')).toBe(true);
    expect(categories.has('STRUCTURAL')).toBe(true);
    expect(categories.has('ENVIRONMENT')).toBe(true);
    expect(categories.has('POWER')).toBe(true);
    expect(categories.has('SAFETY')).toBe(true);
    expect(categories.has('INTEROPERABILITY')).toBe(true);
    expect(categories.has('MAINTAINABILITY')).toBe(true);
    expect(categories.has('THERMAL')).toBe(true);
    expect(categories.has('MASS')).toBe(true);
  });

  // Test 3: Standard Schema Validation
  it('should validate robot requirements successfully with the main validator', () => {
    const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig();
    const validated = SystemRequirementValidator.validateCollection(reqs as SystemRequirement[]);
    expect(validated.length).toBe(25);
  });

  // Test 4: Critical Robot Requirements Validation Method enforcement
  it('should enforce that CRITICAL robot requirements must specify valid validationMethod', () => {
    const criticalReqs = IndustrialRobotSystemRequirements.synthesizeFromConfig().filter(r => r.priority === 'CRITICAL');
    expect(criticalReqs.length).toBeGreaterThanOrEqual(5);

    for (const req of criticalReqs) {
      expect(req.validationMethod).toBeDefined();
      expect(req.validationMethod?.length).toBeGreaterThan(0);
    }
  });

  // Test 5: Rejection of Custom Vague Requirements
  it('should reject a custom robotic requirement with vague acceptance criteria', () => {
    const vagueReq: any = {
      requirementId: 'ROBOT-REQ-FAIL',
      caseId: 'EPC-CASE-002',
      domain: 'INDUSTRIAL_ROBOTICS',
      category: 'PERFORMANCE',
      title: 'Vague Robotic Req',
      description: 'Manipulator should perform well.',
      type: 'PERFORMANCE',
      priority: 'HIGH',
      verificationMethod: 'SIMULATION',
      status: 'DEFINED',
      acceptanceCriteria: 'looks good', // vague
      parameter: 'machiningTolerance',
      value: 0.1,
      unit: 'mm'
    };

    expect(() => SystemRequirementValidator.validate(vagueReq)).toThrowError(
      /Invalid acceptanceCriteria 'looks good'/
    );
  });

  // Test 6: Inconsistent bounds check
  it('should reject a robotic requirement with mathematically inconsistent bounds', () => {
    const baseReq = IndustrialRobotSystemRequirements.synthesizeFromConfig()[0];
    const inconsistentReq = {
      ...baseReq,
      minimumValue: 1000,
      maximumValue: 500
    };

    expect(() => SystemRequirementValidator.validate(inconsistentReq as SystemRequirement)).toThrowError(
      /Inconsistent bounds/
    );
  });

  // Test 7: Duplicate detection
  it('should catch duplicate requirement IDs in a robotic arm collection', () => {
    const valid = IndustrialRobotSystemRequirements.synthesizeFromConfig();
    const withDuplicate = [...valid, { ...valid[0] }];

    expect(() => SystemRequirementValidator.validateCollection(withDuplicate as SystemRequirement[])).toThrowError(
      /Duplicate requirementId detected/
    );
  });

  // Test 8: Coverage and Gate Blocking Evaluation
  it('should correctly block the final acceptance gate while critical robot requirements are unverified', () => {
    const manager = IndustrialRobotSystemRequirements.createManager();
    const coverage = manager.computeCoverage();

    expect(coverage.isGateBlocked).toBe(true);
    expect(coverage.criticalUnverifiedIds.length).toBeGreaterThan(0);

    // Verify all critical ones
    const criticalReqs = manager.getCriticalRequirements();
    for (const crit of criticalReqs) {
      manager.transitionStatus(crit.requirementId, 'VERIFIED', `EVID-ROBOT-TEST-${crit.requirementId}`);
    }

    const updatedCoverage = manager.computeCoverage();
    expect(updatedCoverage.isGateBlocked).toBe(false);
    expect(updatedCoverage.criticalUnverifiedIds.length).toBe(0);
  });
});
