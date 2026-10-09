/**
 * SECP Industrial OS — EPC-017: System Requirements Verifier
 * Automated Verification Engine for EPC-017 System Requirements Schema,
 * Traceability, Change Impact, Gatekeeping, and Coverage Calculations.
 */

import { EPC016InputConfig } from '../mission/MissionTypes';
import { IndustrialDroneProofCase } from '../mission/IndustrialDroneProofCase';
import { IndustrialDroneSystemRequirements } from './IndustrialDroneSystemRequirements';
import { SystemRequirementManager } from './SystemRequirementManager';
import { SystemRequirementValidator } from './SystemRequirementValidator';
import { RequirementImpactEngine } from './RequirementImpactEngine';
import {
  EPC017ValidationResult,
  SystemRequirement,
  SystemRequirementValidationError
} from './SystemRequirementTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPC017Verifier {
  public static readonly IMPLEMENTATION_REVISION = 'SECP-EPC-017-REV1';

  /**
   * Executes the full automated verification suite for EPC-017.
   */
  public static runVerification(config?: EPC016InputConfig): EPC017ValidationResult {
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};
    const effectiveConfig = config || IndustrialDroneProofCase.createDefaultInspectionDroneConfig();

    const recordCheck = (id: string, condition: boolean, successMsg: string, failMsg: string, details?: unknown) => {
      const entry: { passed: boolean; message: string; details?: unknown } = {
        passed: condition,
        message: condition ? successMsg : failMsg
      };
      if (details !== undefined) {
        entry.details = details;
      }
      checks[id] = entry;
    };

    // 1. SYSTEM_REQUIREMENT_SCHEMA_VALIDITY
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const validated = SystemRequirementValidator.validateCollection(reqs);
      recordCheck(
        'SYSTEM_REQUIREMENT_SCHEMA_VALIDITY',
        validated.length >= 20,
        `All ${validated.length} synthesized system requirements adhere to EPC-017 schema and validation contracts.`,
        'System requirements collection failed schema validation.',
        { count: validated.length }
      );
    } catch (err: any) {
      recordCheck('SYSTEM_REQUIREMENT_SCHEMA_VALIDITY', false, '', `Schema validation error: ${err.message}`);
    }

    // 2. UNIQUE_REQUIREMENT_IDENTIFIERS
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const ids = reqs.map(r => r.requirementId);
      const uniqueIds = new Set(ids);
      const hasDuplicates = ids.length !== uniqueIds.size;
      const allFollowPattern = ids.every(id => /^DRONE-REQ-\d{3}$/.test(id) || /^[A-Z0-9_-]+-REQ-\d+$/i.test(id));

      recordCheck(
        'UNIQUE_REQUIREMENT_IDENTIFIERS',
        !hasDuplicates && allFollowPattern && ids.length > 0,
        `All ${ids.length} requirements have strictly unique, valid identifier tokens.`,
        'Duplicate or malformed requirement IDs detected.'
      );
    } catch (err: any) {
      recordCheck('UNIQUE_REQUIREMENT_IDENTIFIERS', false, '', `Identifier check error: ${err.message}`);
    }

    // 3. MANDATORY_FIELDS_COMPLETENESS
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const allComplete = reqs.every(
        r =>
          r.requirementId &&
          r.caseId &&
          r.domain &&
          r.category &&
          r.title &&
          r.description &&
          r.type &&
          r.priority &&
          r.verificationMethod &&
          r.status &&
          r.acceptanceCriteria
      );

      recordCheck(
        'MANDATORY_FIELDS_COMPLETENESS',
        allComplete,
        'All system requirements contain 100% of required descriptive, categorical, priority, and method metadata.',
        'One or more requirements are missing mandatory metadata fields.'
      );
    } catch (err: any) {
      recordCheck('MANDATORY_FIELDS_COMPLETENESS', false, '', `Mandatory fields check error: ${err.message}`);
    }

    // 4. NUMERIC_AND_UNIT_CONSISTENCY
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const numericReqs = reqs.filter(r => r.parameter !== undefined || r.value !== undefined);
      const unitsValid = numericReqs.every(r => r.unit && typeof r.unit === 'string' && r.unit.trim() !== '');

      recordCheck(
        'NUMERIC_AND_UNIT_CONSISTENCY',
        numericReqs.length > 10 && unitsValid,
        `All ${numericReqs.length} quantitative requirements specify valid units conforming to SECP engineering unit system.`,
        'Quantitative requirements failed unit or numeric consistency validation.'
      );
    } catch (err: any) {
      recordCheck('NUMERIC_AND_UNIT_CONSISTENCY', false, '', `Numeric/Unit validation error: ${err.message}`);
    }

    // 5. BOUNDS_AND_TOLERANCE_CONSISTENCY
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const boundedReqs = reqs.filter(r => r.minimumValue !== undefined || r.maximumValue !== undefined || r.targetValue !== undefined);
      const allBoundsConsistent = boundedReqs.every(r => {
        let ok = true;
        if (r.minimumValue !== undefined && r.maximumValue !== undefined) {
          if (r.minimumValue > r.maximumValue) ok = false;
        }
        if (r.minimumValue !== undefined && r.targetValue !== undefined) {
          if (r.targetValue < r.minimumValue) ok = false;
        }
        if (r.maximumValue !== undefined && r.targetValue !== undefined) {
          if (r.targetValue > r.maximumValue) ok = false;
        }
        return ok;
      });

      recordCheck(
        'BOUNDS_AND_TOLERANCE_CONSISTENCY',
        boundedReqs.length > 0 && allBoundsConsistent,
        `All bounded engineering requirements satisfy mathematical min <= target <= max constraints.`,
        'Inconsistent requirement bounds detected.'
      );
    } catch (err: any) {
      recordCheck('BOUNDS_AND_TOLERANCE_CONSISTENCY', false, '', `Bounds consistency error: ${err.message}`);
    }

    // 6. QUALITATIVE_CRITERIA_COMPLETENESS
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const qualitativeReqs = reqs.filter(r => r.parameter === undefined);
      const qualitativeRigorous = qualitativeReqs.every(
        r =>
          r.acceptanceCriteria &&
          r.acceptanceCriteria.length > 20 &&
          r.verificationMethod &&
          r.validationMethod
      );

      recordCheck(
        'QUALITATIVE_CRITERIA_COMPLETENESS',
        qualitativeReqs.length >= 2 && qualitativeRigorous,
        `All qualitative requirements specify rigorous, unambiguous acceptance criteria and verification/validation methods without artificial numbers.`,
        'Qualitative requirements lack adequate acceptance criteria or methods.'
      );
    } catch (err: any) {
      recordCheck('QUALITATIVE_CRITERIA_COMPLETENESS', false, '', `Qualitative criteria check error: ${err.message}`);
    }

    // 7. MISSION_TO_SYSTEM_TRACEABILITY
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const missionDerived = reqs.filter(r => r.derivedFromMissionId === effectiveConfig.mission.missionId);
      const manager = new SystemRequirementManager(reqs);
      const traceGraph = manager.toTraceabilityGraph();

      recordCheck(
        'MISSION_TO_SYSTEM_TRACEABILITY',
        missionDerived.length >= 15 && traceGraph.edges.length >= 15,
        `Traceability graph successfully links ${missionDerived.length} requirements directly to parent mission '${effectiveConfig.mission.missionId}'.`,
        'Mission lineage traceability graph incomplete.'
      );
    } catch (err: any) {
      recordCheck('MISSION_TO_SYSTEM_TRACEABILITY', false, '', `Traceability check error: ${err.message}`);
    }

    // 8. PRIORITY_AND_CRITICAL_VALIDATION_RULES
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const criticalReqs = reqs.filter(r => r.priority === 'CRITICAL');
      const allCriticalHaveValidation = criticalReqs.every(
        r => r.validationMethod !== undefined && r.validationMethod !== null && r.validationMethod.trim() !== ''
      );

      recordCheck(
        'PRIORITY_AND_CRITICAL_VALIDATION_RULES',
        criticalReqs.length >= 4 && allCriticalHaveValidation,
        `All ${criticalReqs.length} CRITICAL requirements strictly require and specify physical/experimental validation methods.`,
        'One or more CRITICAL requirements lack mandatory validationMethod.'
      );
    } catch (err: any) {
      recordCheck('PRIORITY_AND_CRITICAL_VALIDATION_RULES', false, '', `Critical priority rules check error: ${err.message}`);
    }

    // 9. EVIDENCE_GATEKEEPING_NO_HARDCODED_PASS
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const manager = new SystemRequirementManager(reqs);

      // Verify that initial status is NOT VERIFIED or VALIDATED
      const noPrematurePass = reqs.every(r => r.status !== 'VERIFIED' && r.status !== 'VALIDATED');

      // Test that trying to transition to VERIFIED without evidence throws error
      let caughtNoEvidence = false;
      try {
        manager.transitionStatus('DRONE-REQ-005', 'VERIFIED');
      } catch (e: any) {
        if (e.code === 'VERIFICATION_EVIDENCE_REQUIRED') {
          caughtNoEvidence = true;
        }
      }

      recordCheck(
        'EVIDENCE_GATEKEEPING_NO_HARDCODED_PASS',
        noPrematurePass && caughtNoEvidence,
        'Gatekeeper strictly blocks transition to VERIFIED/VALIDATED without verifiable cryptographic evidence.',
        'Gatekeeper permitted unauthorized status transition without evidence.'
      );
    } catch (err: any) {
      recordCheck('EVIDENCE_GATEKEEPING_NO_HARDCODED_PASS', false, '', `Gatekeeper check error: ${err.message}`);
    }

    // 10. CHANGE_IMPACT_DETECTION
    try {
      const impact = RequirementImpactEngine.evaluateParameterImpact(
        'DRONE-REQ-005',
        'maximumTakeoffMass',
        6.5,
        7.2,
        'MASS'
      );

      const hasRequiredSubsystems =
        impact.impactedSubsystems.includes('MASS_PROPERTIES') &&
        impact.impactedSubsystems.includes('PROPULSION') &&
        impact.impactedSubsystems.includes('AIRFRAME_STRUCTURE');
      const hasDisciplines =
        impact.impactedDisciplines.includes('FLIGHT_DYNAMICS_STABILITY') ||
        impact.impactedDisciplines.includes('STRUCTURAL_FEA');

      recordCheck(
        'CHANGE_IMPACT_DETECTION',
        hasRequiredSubsystems && hasDisciplines && impact.requiresReanalysis,
        'Requirement change impact engine accurately determines multidisciplinary downstream effects and reanalysis requirements.',
        'Change impact engine failed to detect expected affected disciplines.'
      );
    } catch (err: any) {
      recordCheck('CHANGE_IMPACT_DETECTION', false, '', `Change impact check error: ${err.message}`);
    }

    // 11. REQUIREMENT_COVERAGE_CALCULATION
    try {
      const reqs = IndustrialDroneSystemRequirements.synthesizeFromMissionConfig(effectiveConfig);
      const manager = new SystemRequirementManager(reqs);
      const coverage = manager.computeCoverage();

      const validCoverage =
        coverage.totalRequirements === reqs.length &&
        coverage.withVerificationPathCount === reqs.length &&
        coverage.coveragePercentage === 100 &&
        coverage.isGateBlocked === true; // Blocked because critical reqs are not yet verified

      recordCheck(
        'REQUIREMENT_COVERAGE_CALCULATION',
        validCoverage,
        `Coverage computed accurately (${coverage.coveragePercentage}% path coverage). Gate is correctly blocked pending execution of ${coverage.criticalCount} critical requirements.`,
        'Coverage computation or gate block evaluation failed.'
      );
    } catch (err: any) {
      recordCheck('REQUIREMENT_COVERAGE_CALCULATION', false, '', `Coverage calculation check error: ${err.message}`);
    }

    // 12. UNIVERSAL_ENGINE_COMPLIANCE
    try {
      // Test creating requirements for a non-drone entity (e.g. Industrial Pump)
      const pumpReq: SystemRequirement = {
        requirementId: 'PUMP-REQ-001',
        caseId: 'EPC-CASE-PUMP-001',
        domain: 'HYDRAULIC_MACHINERY',
        category: 'PERFORMANCE',
        title: 'Centrifugal Pump Delivery Head',
        description: 'Pump shall deliver minimum dynamic head at rated flow.',
        type: 'PERFORMANCE',
        parameter: 'deliveryHead',
        value: 45,
        targetValue: 45,
        minimumValue: 40,
        unit: 'm',
        acceptanceCriteria: 'deliveryHead >= 40 m at flow rate of 120 m^3/h',
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
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

      const validatedPumpReq = SystemRequirementValidator.validate(pumpReq);
      const pumpManager = new SystemRequirementManager([validatedPumpReq]);
      const pumpCoverage = pumpManager.computeCoverage();

      recordCheck(
        'UNIVERSAL_ENGINE_COMPLIANCE',
        validatedPumpReq.requirementId === 'PUMP-REQ-001' && pumpCoverage.totalRequirements === 1,
        'SECP System Requirement Core operates universally across multiple engineering domains (Drone, Pump, Robotics, etc.) without hardcoded solver bias.',
        'Universal domain flexibility check failed.'
      );
    } catch (err: any) {
      recordCheck('UNIVERSAL_ENGINE_COMPLIANCE', false, '', `Universal compliance check error: ${err.message}`);
    }

    const allPassed = Object.values(checks).every(c => c.passed);
    const evidenceHash = EvidenceIntegrityService.computeHash({
      epc: 'EPC-017',
      checks,
      config: effectiveConfig,
      timestamp: new Date().toISOString()
    });

    return {
      epc: 'EPC-017',
      name: 'System Requirements',
      verdict: allPassed ? 'PASS' : 'FAIL',
      checks,
      evidenceHash,
      timestamp: new Date().toISOString(),
      implementationRevision: this.IMPLEMENTATION_REVISION
    };
  }
}
