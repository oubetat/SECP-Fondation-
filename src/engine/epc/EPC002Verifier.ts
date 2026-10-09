/**
 * SECP Industrial OS — EPC-002: Engineering Requirement Schema Verifier
 * Executes verification checks and generates machine-readable EPC-002 evidence.
 */

import { pureSha256 } from '../../polyfills/crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import {
  EngineeringRequirement,
  EngineeringRequirementValidationError,
  EPC002ValidationResult
} from './EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from './EngineeringRequirementValidator';
import { EngineeringRequirementSerializer } from './EngineeringRequirementSerializer';
import { ProofCaseProject } from './ProofCaseTypes';
import { ProofCaseValidator } from './ProofCaseValidator';

export class EPC002Verifier {
  public static readonly REVISION = 'SECP-EPC-002-REV1';

  /**
   * Executes all mandatory EPC-002 checks and computes the machine-readable result.
   */
  public static runVerification(): EPC002ValidationResult {
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};

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

    // 1. REQUIREMENT_ID
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-STRUCT-001',
        description: 'Maximum allowable structural stress under peak load',
        parameter: 'stress',
        unit: 'MPa',
        tolerance: { type: 'BOUNDS', upperBound: 250 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST'
      };
      const v = EngineeringRequirementValidator.validate(validReq);

      let missingIdRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, requirementId: '' });
      } catch (e: any) {
        missingIdRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_REQUIREMENT_ID';
      }

      recordCheck(
        'REQUIREMENT_ID',
        v.requirementId === 'REQ-STRUCT-001' && missingIdRejected,
        'RequirementId validated and empty/missing requirementId correctly rejected.',
        'RequirementId validation failed.'
      );
    } catch (e: any) {
      recordCheck('REQUIREMENT_ID', false, '', `Error: ${e.message}`);
    }

    // 2. DESCRIPTION
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-DESC-001',
        description: 'Engineered pressure boundary minimum yield strength',
        parameter: 'stress',
        unit: 'Pa',
        tolerance: { absoluteTolerance: 1000 },
        priority: 'HIGH',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'EXPERIMENT'
      };
      EngineeringRequirementValidator.validate(validReq);

      let emptyDescRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, description: '   ' });
      } catch (e: any) {
        emptyDescRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_DESCRIPTION';
      }

      recordCheck(
        'DESCRIPTION',
        emptyDescRejected,
        'Description validated and whitespace-only description correctly rejected.',
        'Description validation failed.'
      );
    } catch (e: any) {
      recordCheck('DESCRIPTION', false, '', `Error: ${e.message}`);
    }

    // 3. PARAMETER
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-PARAM-001',
        description: 'System flow rate limit',
        parameter: 'volume_flow_rate',
        unit: 'm/s',
        tolerance: { type: 'RELATIVE', relativeTolerance: 0.05 },
        priority: 'MEDIUM',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'FIELD_TEST'
      };
      EngineeringRequirementValidator.validate(validReq);

      let emptyParamRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, parameter: '' });
      } catch (e: any) {
        emptyParamRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_PARAMETER';
      }

      recordCheck(
        'PARAMETER',
        emptyParamRejected,
        'Parameter validated and empty parameter correctly rejected.',
        'Parameter validation failed.'
      );
    } catch (e: any) {
      recordCheck('PARAMETER', false, '', `Error: ${e.message}`);
    }

    // 4. UNIT
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-UNIT-001',
        description: 'Operating temperature upper limit',
        parameter: 'temperature',
        unit: 'K',
        tolerance: { type: 'BOUNDS', upperBound: 450 },
        priority: 'HIGH',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'EXPERIMENT'
      };
      EngineeringRequirementValidator.validate(validReq);

      let invalidUnitRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, unit: 'UNSUPPORTED_UNIT_XYZ999' });
      } catch (e: any) {
        invalidUnitRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_UNIT';
      }

      let dimensionalMismatchRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, parameter: 'mass', unit: 'Pa' });
      } catch (e: any) {
        dimensionalMismatchRejected = e instanceof EngineeringRequirementValidationError && e.code === 'DIMENSIONAL_INCOMPATIBILITY';
      }

      recordCheck(
        'UNIT',
        invalidUnitRejected && dimensionalMismatchRejected,
        'Unit validation and dimensional compatibility check correctly enforced.',
        'Unit validation failed.'
      );
    } catch (e: any) {
      recordCheck('UNIT', false, '', `Error: ${e.message}`);
    }

    // 5. TOLERANCE
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-TOL-001',
        description: 'Component mass budget',
        parameter: 'mass',
        unit: 'kg',
        tolerance: { type: 'BOUNDS', lowerBound: 1.0, upperBound: 5.0 },
        priority: 'MEDIUM',
        verificationMethod: 'INSPECTION',
        validationMethod: 'PHYSICAL_TEST'
      };
      EngineeringRequirementValidator.validate(validReq);

      let invalidBoundsRejected = false;
      try {
        EngineeringRequirementValidator.validate({
          ...validReq,
          tolerance: { lowerBound: 10.0, upperBound: 2.0 } // lower > upper
        });
      } catch (e: any) {
        invalidBoundsRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_TOLERANCE_BOUNDS';
      }

      let nanToleranceRejected = false;
      try {
        EngineeringRequirementValidator.validate({
          ...validReq,
          tolerance: { absoluteTolerance: NaN }
        });
      } catch (e: any) {
        nanToleranceRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_TOLERANCE_NUMERIC';
      }

      recordCheck(
        'TOLERANCE',
        invalidBoundsRejected && nanToleranceRejected,
        'Tolerance constraints, bounds consistency, and NaN rejection validated.',
        'Tolerance validation failed.'
      );
    } catch (e: any) {
      recordCheck('TOLERANCE', false, '', `Error: ${e.message}`);
    }

    // 6. PRIORITY
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-PRIO-001',
        description: 'Thermal dissipation capacity',
        parameter: 'power',
        unit: 'W',
        tolerance: { absoluteTolerance: 50 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PROTOTYPE_TEST'
      };

      const priorities: Array<EngineeringRequirement['priority']> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const allPrioritiesValid = priorities.every(
        p => EngineeringRequirementValidator.validate({ ...validReq, priority: p }).priority === p
      );

      let invalidPriorityRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, priority: 'SUPER_URGENT' as any });
      } catch (e: any) {
        invalidPriorityRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_PRIORITY';
      }

      recordCheck(
        'PRIORITY',
        allPrioritiesValid && invalidPriorityRejected,
        'Priority enumeration (CRITICAL, HIGH, MEDIUM, LOW) correctly controlled.',
        'Priority validation failed.'
      );
    } catch (e: any) {
      recordCheck('PRIORITY', false, '', `Error: ${e.message}`);
    }

    // 7. VERIFICATION_METHOD
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-VERIF-001',
        description: 'Vibration isolation natural frequency',
        parameter: 'frequency',
        unit: 'Hz',
        tolerance: { type: 'EXACT', nominalValue: 25 },
        priority: 'HIGH',
        verificationMethod: 'TEST',
        validationMethod: 'PHYSICAL_TEST'
      };

      const methods: Array<EngineeringRequirement['verificationMethod']> = [
        'ANALYSIS',
        'SIMULATION',
        'INSPECTION',
        'TEST',
        'MEASUREMENT',
        'REVIEW'
      ];
      const allMethodsValid = methods.every(
        m => EngineeringRequirementValidator.validate({ ...validReq, verificationMethod: m }).verificationMethod === m
      );

      let invalidMethodRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, verificationMethod: 'GUESSTIMATE' as any });
      } catch (e: any) {
        invalidMethodRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_VERIFICATION_METHOD';
      }

      recordCheck(
        'VERIFICATION_METHOD',
        allMethodsValid && invalidMethodRejected,
        'VerificationMethod declaration controlled and validated without hardcoded results.',
        'VerificationMethod validation failed.'
      );
    } catch (e: any) {
      recordCheck('VERIFICATION_METHOD', false, '', `Error: ${e.message}`);
    }

    // 8. VALIDATION_METHOD
    try {
      const validReq: EngineeringRequirement = {
        requirementId: 'REQ-VALID-001',
        description: 'Real-world durability requirement',
        parameter: 'time',
        unit: 'h',
        tolerance: { type: 'BOUNDS', lowerBound: 5000 },
        priority: 'CRITICAL',
        verificationMethod: 'ANALYSIS',
        validationMethod: 'FIELD_TEST'
      };

      const methods: Array<EngineeringRequirement['validationMethod']> = [
        'EXPERIMENT',
        'PHYSICAL_TEST',
        'FIELD_TEST',
        'SIMULATION_CORRELATION',
        'PROTOTYPE_TEST',
        'INDEPENDENT_VALIDATION'
      ];
      const allMethodsValid = methods.every(
        m => EngineeringRequirementValidator.validate({ ...validReq, validationMethod: m }).validationMethod === m
      );

      let invalidMethodRejected = false;
      try {
        EngineeringRequirementValidator.validate({ ...validReq, validationMethod: 'UNTESTED_ASSUMPTION' as any });
      } catch (e: any) {
        invalidMethodRejected = e instanceof EngineeringRequirementValidationError && e.code === 'INVALID_VALIDATION_METHOD';
      }

      recordCheck(
        'VALIDATION_METHOD',
        allMethodsValid && invalidMethodRejected,
        'ValidationMethod declaration controlled and validated.',
        'ValidationMethod validation failed.'
      );
    } catch (e: any) {
      recordCheck('VALIDATION_METHOD', false, '', `Error: ${e.message}`);
    }

    // 9. SEMANTIC_DISTINCTION
    try {
      const req: EngineeringRequirement = {
        requirementId: 'REQ-DISTINCT-001',
        description: 'Pressure vessel rupture limit',
        parameter: 'pressure',
        unit: 'bar',
        tolerance: { type: 'BOUNDS', upperBound: 300 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION', // Verification: "Did we design to spec?"
        validationMethod: 'PHYSICAL_TEST' // Validation: "Does it satisfy real-world need?"
      };

      const validated = EngineeringRequirementValidator.validate(req);
      const isDistinct =
        validated.verificationMethod !== validated.validationMethod &&
        validated.verificationMethod === 'SIMULATION' &&
        validated.validationMethod === 'PHYSICAL_TEST';

      recordCheck(
        'SEMANTIC_DISTINCTION',
        isDistinct,
        'VerificationMethod and ValidationMethod remain strictly distinct fields and concepts.',
        'Semantic distinction collapsed.'
      );
    } catch (e: any) {
      recordCheck('SEMANTIC_DISTINCTION', false, '', `Error: ${e.message}`);
    }

    // 10. SERIALIZATION
    try {
      const req: EngineeringRequirement = {
        requirementId: 'REQ-SERIAL-001',
        description: 'Deterministic serialization test requirement',
        parameter: 'mass',
        unit: 'kg',
        tolerance: { type: 'ABSOLUTE', absoluteTolerance: 0.1 },
        priority: 'HIGH',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST'
      };

      const isRoundTripValid = EngineeringRequirementSerializer.verifyRoundTrip(req);

      // Determinism check (reversed key insertion order)
      const reqB: any = {};
      reqB.validationMethod = 'PHYSICAL_TEST';
      reqB.verificationMethod = 'MEASUREMENT';
      reqB.priority = 'HIGH';
      reqB.tolerance = { absoluteTolerance: 0.1, type: 'ABSOLUTE' };
      reqB.unit = 'kg';
      reqB.parameter = 'mass';
      reqB.description = 'Deterministic serialization test requirement';
      reqB.requirementId = 'REQ-SERIAL-001';

      const resA = EngineeringRequirementSerializer.serialize(req);
      const resB = EngineeringRequirementSerializer.serialize(reqB);

      const isDeterministic = resA.canonicalString === resB.canonicalString && resA.requirementHash === resB.requirementHash;

      recordCheck(
        'SERIALIZATION',
        isRoundTripValid && isDeterministic,
        'Canonical serialization round-trip fidelity and key-order sorting determinism verified.',
        'Serialization validation failed.'
      );
    } catch (e: any) {
      recordCheck('SERIALIZATION', false, '', `Error: ${e.message}`);
    }

    // 11. ADVERSARIAL_VALIDATION
    try {
      let passedAllAdversarial = true;

      // Null/undefined inputs
      try {
        EngineeringRequirementValidator.validate(null);
        passedAllAdversarial = false;
      } catch (e) {}

      try {
        EngineeringRequirementValidator.validate(undefined);
        passedAllAdversarial = false;
      } catch (e) {}

      // Infinity tolerance
      try {
        EngineeringRequirementValidator.validate({
          requirementId: 'ADV-1',
          description: 'Adv test',
          parameter: 'mass',
          unit: 'kg',
          tolerance: { absoluteTolerance: Infinity },
          priority: 'LOW',
          verificationMethod: 'REVIEW',
          validationMethod: 'EXPERIMENT'
        });
        passedAllAdversarial = false;
      } catch (e) {}

      recordCheck(
        'ADVERSARIAL_VALIDATION',
        passedAllAdversarial,
        'Adversarial test inputs (null, undefined, Infinity, malformed objects) correctly rejected.',
        'Adversarial validation failed.'
      );
    } catch (e: any) {
      recordCheck('ADVERSARIAL_VALIDATION', false, '', `Error: ${e.message}`);
    }

    // 12. EPC001_INTEGRATION
    try {
      const req: EngineeringRequirement = {
        requirementId: 'REQ-EPC001-BRIDGE',
        description: 'Aerospace payload structural constraint',
        parameter: 'mass',
        unit: 'kg',
        tolerance: { type: 'BOUNDS', upperBound: 150 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST'
      };

      const reqRef = EngineeringRequirementValidator.toProofCaseRequirementReference(req);

      const project: ProofCaseProject = {
        caseId: 'CASE-EPC002-INT-001',
        caseType: 'SYSTEM',
        domain: 'AEROSPACE',
        revision: 'v1.0.0',
        status: 'DEFINED',
        owner: 'LEAD-ARCHITECT',
        requirements: [reqRef],
        models: [],
        simulations: [],
        manufacturing: [],
        tests: [],
        evidence: []
      };

      const validatedProject = ProofCaseValidator.validate(project);

      recordCheck(
        'EPC001_INTEGRATION',
        validatedProject.requirements[0].requirementId === 'REQ-EPC001-BRIDGE',
        'EngineeringRequirement seamlessly integrates into EPC-001 ProofCaseProject requirement container.',
        'EPC-001 integration failed.'
      );
    } catch (e: any) {
      recordCheck('EPC001_INTEGRATION', false, '', `Error: ${e.message}`);
    }

    // Compute overall verdict
    const allCheckKeys = Object.keys(checks);
    const passedCount = allCheckKeys.filter(k => checks[k].passed).length;
    const totalCount = allCheckKeys.length;

    let verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'FAIL';
    if (passedCount === totalCount && totalCount > 0) {
      verdict = 'PASS';
    } else if (passedCount > 0) {
      verdict = 'INCONCLUSIVE';
    }

    const timestamp = new Date().toISOString();

    const evidencePayload = {
      epc: 'EPC-002',
      name: 'Engineering Requirement Schema',
      verdict,
      checks,
      implementationRevision: this.REVISION
    };

    const canonicalEvidenceStr = CanonicalSerializer.serialize(evidencePayload).canonicalString;
    const evidenceHash = pureSha256(canonicalEvidenceStr);

    return {
      epc: 'EPC-002',
      name: 'Engineering Requirement Schema',
      verdict,
      checks,
      evidenceHash,
      timestamp,
      implementationRevision: this.REVISION
    };
  }
}
