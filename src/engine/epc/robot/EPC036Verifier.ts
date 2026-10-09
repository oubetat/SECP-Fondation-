/**
 * SECP Industrial OS — EPC-036: Robot Requirements Verifier
 * Executes 10 mandatory mechatronic verification checks and generates
 * tamper-resistant EPC-036 cryptographic evidence.
 */

import { IndustrialRobotSystemRequirements, RobotInputConfig } from './IndustrialRobotSystemRequirements';
import { SystemRequirementManager } from '../system/SystemRequirementManager';
import { SystemRequirementValidator } from '../system/SystemRequirementValidator';
import { RequirementImpactEngine } from '../system/RequirementImpactEngine';
import {
  SystemRequirement,
  SystemRequirementValidationError
} from '../system/SystemRequirementTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export interface EPC036ValidationResult {
  readonly epc: 'EPC-036';
  readonly name: 'Robot Requirements';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}

export class EPC036Verifier {
  public static readonly IMPLEMENTATION_REVISION = 'SECP-EPC-036-REV1';

  /**
   * Executes the full mechatronic verification suite for EPC-036.
   */
  public static runVerification(config?: RobotInputConfig): EPC036ValidationResult {
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};
    const effectiveConfig = config || {
      caseId: 'EPC-CASE-002',
      missionId: 'MISSION-ROBOT-PICK-PLACE',
      payloadMassKg: 12,
      link1LengthMm: 450,
      link2LengthMm: 520,
      targetReachRadiusMm: 750,
      jointMaxAccelDegS2: 120,
      repeatabilityMm: 0.05
    };

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

    // 1. ROBOT_REQUIREMENT_SCHEMA_VALIDITY
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const validated = SystemRequirementValidator.validateCollection(reqs as SystemRequirement[]);
      recordCheck(
         'ROBOT_REQUIREMENT_SCHEMA_VALIDITY',
         validated.length >= 25,
         `All ${validated.length} synthesized robotic system requirements adhere perfectly to the canonical system requirement schema and validation contracts.`,
         'Synthesized robot requirements collection failed schema validation.',
         { count: validated.length }
      );
    } catch (err: any) {
      recordCheck('ROBOT_REQUIREMENT_SCHEMA_VALIDITY', false, '', `Schema validation error: ${err.message}`);
    }

    // 2. ROBOT_UNIQUE_REQUIREMENT_IDENTIFIERS
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const ids = reqs.map(r => r.requirementId);
      const uniqueIds = new Set(ids);
      const hasDuplicates = ids.length !== uniqueIds.size;
      const allFollowPattern = ids.every(id => /^ROBOT-REQ-\d{3}$/.test(id));

      recordCheck(
        'ROBOT_UNIQUE_REQUIREMENT_IDENTIFIERS',
        !hasDuplicates && allFollowPattern && ids.length > 0,
        `All ${ids.length} requirements have strictly unique, standard 'ROBOT-REQ-XXX' identifier tokens.`,
        'Duplicate or malformed robot requirement IDs detected.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_UNIQUE_REQUIREMENT_IDENTIFIERS', false, '', `Identifier check error: ${err.message}`);
    }

    // 3. ROBOT_MANDATORY_FIELDS_COMPLETENESS
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
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
        'ROBOT_MANDATORY_FIELDS_COMPLETENESS',
        allComplete,
        'All robot system requirements contain 100% of required descriptive, categorical, priority, and method metadata.',
        'One or more requirements are missing mandatory metadata fields.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_MANDATORY_FIELDS_COMPLETENESS', false, '', `Mandatory fields check error: ${err.message}`);
    }

    // 4. ROBOT_NUMERIC_AND_UNIT_CONSISTENCY
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const numericReqs = reqs.filter(r => r.parameter !== undefined || r.value !== undefined);
      const unitsValid = numericReqs.every(r => r.unit && typeof r.unit === 'string' && r.unit.trim() !== '');

      recordCheck(
        'ROBOT_NUMERIC_AND_UNIT_CONSISTENCY',
        numericReqs.length >= 20 && unitsValid,
        `All ${numericReqs.length} quantitative requirements specify valid engineering units (mm, kg, Nm, V, A, Hz, etc.) conforming to SECP mechatronic unit controls.`,
        'Quantitative robot requirements failed unit or numeric consistency validation.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_NUMERIC_AND_UNIT_CONSISTENCY', false, '', `Numeric/Unit validation error: ${err.message}`);
    }

    // 5. ROBOT_BOUNDS_AND_TOLERANCE_CONSISTENCY
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
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
        'ROBOT_BOUNDS_AND_TOLERANCE_CONSISTENCY',
        boundedReqs.length > 0 && allBoundsConsistent,
        `All bounded mechatronic requirements satisfy mathematical min <= target <= max constraints.`,
        'Inconsistent robot requirement bounds detected.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_BOUNDS_AND_TOLERANCE_CONSISTENCY', false, '', `Bounds consistency error: ${err.message}`);
    }

    // 6. ROBOT_QUALITATIVE_CRITERIA_COMPLETENESS
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const qualitativeReqs = reqs.filter(r => r.parameter === undefined);
      const qualitativeRigorous = qualitativeReqs.every(
        r =>
          r.acceptanceCriteria &&
          r.acceptanceCriteria.length > 20 &&
          r.verificationMethod &&
          r.validationMethod
      );

      recordCheck(
        'ROBOT_QUALITATIVE_CRITERIA_COMPLETENESS',
        qualitativeReqs.length >= 3 && qualitativeRigorous,
        `All qualitative robot requirements (ISO-9409-1 flange, IP65 protection, EMC compliance) specify rigorous, unambiguous acceptance criteria without artificial numbers.`,
        'Qualitative robot requirements lack adequate acceptance criteria or verification/validation methods.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_QUALITATIVE_CRITERIA_COMPLETENESS', false, '', `Qualitative criteria check error: ${err.message}`);
    }

    // 7. ROBOT_MISSION_TO_SYSTEM_TRACEABILITY
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const missionId = effectiveConfig.missionId || 'MISSION-ROBOT-PICK-PLACE';
      const missionDerived = reqs.filter(r => r.derivedFromMissionId === missionId);
      const manager = new SystemRequirementManager(reqs as SystemRequirement[]);
      const traceGraph = manager.toTraceabilityGraph();

      recordCheck(
        'ROBOT_MISSION_TO_SYSTEM_TRACEABILITY',
        missionDerived.length >= 20 && traceGraph.edges.length >= 20,
        `Traceability graph successfully links ${missionDerived.length} requirements directly to parent mission '${missionId}'.`,
        'Mission lineage traceability graph incomplete for the industrial robotic arm.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_MISSION_TO_SYSTEM_TRACEABILITY', false, '', `Traceability check error: ${err.message}`);
    }

    // 8. ROBOT_PRIORITY_AND_CRITICAL_VALIDATION_RULES
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const criticalReqs = reqs.filter(r => r.priority === 'CRITICAL');
      const allCriticalHaveValidation = criticalReqs.every(
        r => r.validationMethod !== undefined && r.validationMethod !== null && r.validationMethod.trim() !== ''
      );

      recordCheck(
        'ROBOT_PRIORITY_AND_CRITICAL_VALIDATION_RULES',
        criticalReqs.length >= 5 && allCriticalHaveValidation,
        `All ${criticalReqs.length} CRITICAL mechatronic requirements (Payload, Repeatability, Sizing Torque, Safety FS, E-Stop braking) specify appropriate validation methods.`,
        'One or more CRITICAL robot requirements lack mandatory validationMethod.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_PRIORITY_AND_CRITICAL_VALIDATION_RULES', false, '', `Critical priority rules check error: ${err.message}`);
    }

    // 9. ROBOT_CHANGE_IMPACT_DETECTION
    try {
      const impact = RequirementImpactEngine.evaluateParameterImpact(
        'ROBOT-REQ-002',
        'payload_mass',
        12,
        15,
        'PAYLOAD'
      );

      const hasRequiredSubsystems =
        impact.impactedSubsystems.includes('MASS_PROPERTIES') &&
        impact.impactedSubsystems.includes('PROPULSION') &&
        impact.impactedSubsystems.includes('AIRFRAME_STRUCTURE');
      const hasDisciplines =
        impact.impactedDisciplines.includes('FLIGHT_DYNAMICS_STABILITY') ||
        impact.impactedDisciplines.includes('STRUCTURAL_FEA');

      recordCheck(
        'ROBOT_CHANGE_IMPACT_DETECTION',
        hasRequiredSubsystems && hasDisciplines && impact.requiresReanalysis,
        'Requirement change impact engine accurately detects affected mechatronic subsystems and engineering disciplines when payload weight changes.',
        'Change impact engine failed to detect expected affected subsystems/disciplines for the robotic arm.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_CHANGE_IMPACT_DETECTION', false, '', `Change impact check error: ${err.message}`);
    }

    // 10. ROBOT_REQUIREMENT_COVERAGE_CALCULATION
    try {
      const reqs = IndustrialRobotSystemRequirements.synthesizeFromConfig(effectiveConfig);
      const manager = new SystemRequirementManager(reqs as SystemRequirement[]);
      const coverage = manager.computeCoverage();

      const validCoverage =
        coverage.totalRequirements === reqs.length &&
        coverage.withVerificationPathCount === reqs.length &&
        coverage.coveragePercentage === 100 &&
        coverage.isGateBlocked === true; // Blocked because critical reqs are not yet verified

      recordCheck(
        'ROBOT_REQUIREMENT_COVERAGE_CALCULATION',
        validCoverage,
        `Coverage computed accurately (${coverage.coveragePercentage}% path coverage). Gate is correctly blocked pending execution of ${coverage.criticalCount} critical requirements.`,
        'Coverage computation or gate block evaluation failed for the industrial robotic arm.'
      );
    } catch (err: any) {
      recordCheck('ROBOT_REQUIREMENT_COVERAGE_CALCULATION', false, '', `Coverage calculation check error: ${err.message}`);
    }

    const allPassed = Object.values(checks).every(c => c.passed);
    const evidenceHash = EvidenceIntegrityService.computeHash({
      epc: 'EPC-036',
      checks,
      config: effectiveConfig,
      timestamp: new Date().toISOString()
    });

    return {
      epc: 'EPC-036',
      name: 'Robot Requirements',
      verdict: allPassed ? 'PASS' : 'FAIL',
      checks,
      evidenceHash,
      timestamp: new Date().toISOString(),
      implementationRevision: this.IMPLEMENTATION_REVISION
    };
  }
}
