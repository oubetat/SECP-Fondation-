/**
 * SECP Industrial OS — EPC-002: Engineering Requirement Schema Test Suite
 * Comprehensive Validation & Verification Tests for EPC-002.
 */

import { describe, it, expect } from 'vitest';
import {
  EngineeringRequirement,
  EngineeringRequirementValidationError
} from '../EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';
import { EngineeringRequirementSerializer } from '../EngineeringRequirementSerializer';
import { EPC002Verifier } from '../EPC002Verifier';
import { ProofCaseProject } from '../ProofCaseTypes';
import { ProofCaseValidator } from '../ProofCaseValidator';

describe('EPC-002: Engineering Requirement Schema', () => {
  const sampleRequirement: EngineeringRequirement = {
    requirementId: 'REQ-STRUCT-001',
    description: 'Maximum allowable structural stress under peak aerodynamic load',
    parameter: 'stress',
    unit: 'MPa',
    tolerance: { type: 'BOUNDS', lowerBound: 0, upperBound: 250 },
    priority: 'CRITICAL',
    verificationMethod: 'SIMULATION',
    validationMethod: 'PHYSICAL_TEST'
  };

  // 1. Valid minimal EngineeringRequirement
  it('1. accepts valid minimal EngineeringRequirement', () => {
    const minReq: EngineeringRequirement = {
      requirementId: 'REQ-MIN-001',
      description: 'Minimum required yield stress',
      parameter: 'stress',
      unit: 'Pa',
      tolerance: { absoluteTolerance: 100 },
      priority: 'LOW',
      verificationMethod: 'ANALYSIS',
      validationMethod: 'EXPERIMENT'
    };
    const validated = EngineeringRequirementValidator.validate(minReq);
    expect(validated.requirementId).toBe('REQ-MIN-001');
    expect(validated.priority).toBe('LOW');
  });

  // 2. Valid complete EngineeringRequirement
  it('2. accepts valid complete EngineeringRequirement with extensions and metadata', () => {
    const fullReq: EngineeringRequirement = {
      ...sampleRequirement,
      category: 'STRUCTURAL_SAFETY',
      revision: 'v2.1.0',
      extensions: { customStandard: 'ISO-9001' },
      metadata: { author: 'Lead Engineer', reviewDate: '2026-08-31' }
    };
    const validated = EngineeringRequirementValidator.validate(fullReq);
    expect(validated.category).toBe('STRUCTURAL_SAFETY');
    expect(validated.revision).toBe('v2.1.0');
    expect(validated.metadata?.author).toBe('Lead Engineer');
  });

  // 3. Valid CRITICAL priority
  it('3. accepts valid CRITICAL priority', () => {
    const req = { ...sampleRequirement, priority: 'CRITICAL' as const };
    expect(EngineeringRequirementValidator.validate(req).priority).toBe('CRITICAL');
  });

  // 4. Valid HIGH priority
  it('4. accepts valid HIGH priority', () => {
    const req = { ...sampleRequirement, priority: 'HIGH' as const };
    expect(EngineeringRequirementValidator.validate(req).priority).toBe('HIGH');
  });

  // 5. Valid MEDIUM priority
  it('5. accepts valid MEDIUM priority', () => {
    const req = { ...sampleRequirement, priority: 'MEDIUM' as const };
    expect(EngineeringRequirementValidator.validate(req).priority).toBe('MEDIUM');
  });

  // 6. Valid LOW priority
  it('6. accepts valid LOW priority', () => {
    const req = { ...sampleRequirement, priority: 'LOW' as const };
    expect(EngineeringRequirementValidator.validate(req).priority).toBe('LOW');
  });

  // 7. Missing requirementId rejected
  it('7. rejects missing requirementId', () => {
    const req: any = { ...sampleRequirement };
    delete req.requirementId;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_REQUIREMENT_ID');
    }
  });

  // 8. Empty requirementId rejected
  it('8. rejects empty requirementId', () => {
    const req = { ...sampleRequirement, requirementId: '' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_REQUIREMENT_ID');
    }
  });

  // 9. Missing description rejected
  it('9. rejects missing description', () => {
    const req: any = { ...sampleRequirement };
    delete req.description;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_DESCRIPTION');
    }
  });

  // 10. Empty description rejected
  it('10. rejects empty or whitespace-only description', () => {
    const req = { ...sampleRequirement, description: '   ' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_DESCRIPTION');
    }
  });

  // 11. Missing parameter rejected
  it('11. rejects missing parameter', () => {
    const req: any = { ...sampleRequirement };
    delete req.parameter;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_PARAMETER');
    }
  });

  // 12. Missing unit rejected
  it('12. rejects missing unit', () => {
    const req: any = { ...sampleRequirement };
    delete req.unit;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_UNIT');
    }
  });

  // 13. Invalid unit rejected when supported by existing unit infrastructure
  it('13. rejects invalid unit symbol', () => {
    const req = { ...sampleRequirement, unit: 'INVALID_SYMBOL_123' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_UNIT');
    }
  });

  // 14. Valid tolerance accepted
  it('14. accepts valid tolerance structure', () => {
    const req = {
      ...sampleRequirement,
      tolerance: { type: 'RELATIVE' as const, relativeTolerance: 0.05, nominalValue: 100 }
    };
    const validated = EngineeringRequirementValidator.validate(req);
    expect(validated.tolerance.relativeTolerance).toBe(0.05);
  });

  // 15. Invalid tolerance rejected
  it('15. rejects invalid tolerance structure (null or non-object)', () => {
    const req: any = { ...sampleRequirement, tolerance: '5%' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
  });

  // 16. lowerBound > upperBound rejected
  it('16. rejects tolerance with lowerBound > upperBound', () => {
    const req = {
      ...sampleRequirement,
      tolerance: { type: 'BOUNDS' as const, lowerBound: 300, upperBound: 100 }
    };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_TOLERANCE_BOUNDS');
    }
  });

  // 17. Invalid priority rejected
  it('17. rejects invalid priority string', () => {
    const req: any = { ...sampleRequirement, priority: 'ULTRA_HIGH' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_PRIORITY');
    }
  });

  // 18. Missing verificationMethod rejected
  it('18. rejects missing verificationMethod', () => {
    const req: any = { ...sampleRequirement };
    delete req.verificationMethod;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_VERIFICATION_METHOD');
    }
  });

  // 19. Invalid verificationMethod rejected
  it('19. rejects invalid verificationMethod string', () => {
    const req: any = { ...sampleRequirement, verificationMethod: 'GUESS' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_VERIFICATION_METHOD');
    }
  });

  // 20. Missing validationMethod rejected
  it('20. rejects missing validationMethod', () => {
    const req: any = { ...sampleRequirement };
    delete req.validationMethod;
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_VALIDATION_METHOD');
    }
  });

  // 21. Invalid validationMethod rejected
  it('21. rejects invalid validationMethod string', () => {
    const req: any = { ...sampleRequirement, validationMethod: 'MAGIC' };
    expect(() => EngineeringRequirementValidator.validate(req)).toThrowError(
      EngineeringRequirementValidationError
    );
    try {
      EngineeringRequirementValidator.validate(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_VALIDATION_METHOD');
    }
  });

  // 22. VerificationMethod and ValidationMethod remain distinct
  it('22. preserves strict semantic distinction between verificationMethod and validationMethod', () => {
    const req = EngineeringRequirementValidator.validate(sampleRequirement);
    expect(req.verificationMethod).toBe('SIMULATION');
    expect(req.validationMethod).toBe('PHYSICAL_TEST');
    expect(req.verificationMethod).not.toBe(req.validationMethod);
  });

  // 23. Serialization/deserialization round trip
  it('23. verifies serialization/deserialization round-trip fidelity', () => {
    const isRoundTrip = EngineeringRequirementSerializer.verifyRoundTrip(sampleRequirement);
    expect(isRoundTrip).toBe(true);
  });

  // 24. Deterministic serialization where applicable
  it('24. produces identical canonical JSON and hash regardless of key insertion order', () => {
    const reqA = sampleRequirement;
    const reqB: any = {
      validationMethod: 'PHYSICAL_TEST',
      verificationMethod: 'SIMULATION',
      priority: 'CRITICAL',
      tolerance: { upperBound: 250, lowerBound: 0, type: 'BOUNDS' },
      unit: 'MPa',
      parameter: 'stress',
      description: 'Maximum allowable structural stress under peak aerodynamic load',
      requirementId: 'REQ-STRUCT-001'
    };

    const sA = EngineeringRequirementSerializer.serialize(reqA);
    const sB = EngineeringRequirementSerializer.serialize(reqB);

    expect(sA.canonicalString).toBe(sB.canonicalString);
    expect(sA.requirementHash).toBe(sB.requirementHash);
  });

  // 25. Malformed requirement cannot silently become valid
  it('25. ensures malformed requirement throws error during validation and serialization', () => {
    const malformed = { ...sampleRequirement, unit: '' };
    expect(() => EngineeringRequirementValidator.validate(malformed)).toThrow();
    expect(() => EngineeringRequirementSerializer.serialize(malformed as any)).toThrow();
  });

  // 26. No random identifier substitution during validation
  it('26. maintains exact requirementId without random auto-generation', () => {
    const id = 'REQ-EXACT-ID-999';
    const req = { ...sampleRequirement, requirementId: id };
    const validated = EngineeringRequirementValidator.validate(req);
    expect(validated.requirementId).toBe(id);
  });

  // 27. No UI framework dependency from the core schema
  it('27. operates purely in Node/TS environment with zero DOM/React dependencies', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof EngineeringRequirementValidator.validate).toBe('function');
  });

  // 28. No product-specific logic
  it('28. remains domain-agnostic across pump, vehicle, structural, and drone requirements', () => {
    const pumpReq: EngineeringRequirement = {
      requirementId: 'REQ-PUMP-001',
      description: 'Minimum net positive suction head required',
      parameter: 'pressure',
      unit: 'bar',
      tolerance: { type: 'BOUNDS', lowerBound: 1.5 },
      priority: 'HIGH',
      verificationMethod: 'ANALYSIS',
      validationMethod: 'EXPERIMENT'
    };
    const vehicleReq: EngineeringRequirement = {
      requirementId: 'REQ-VEH-001',
      description: 'Maximum total vehicle curb mass',
      parameter: 'mass',
      unit: 'kg',
      tolerance: { type: 'BOUNDS', upperBound: 1800 },
      priority: 'CRITICAL',
      verificationMethod: 'MEASUREMENT',
      validationMethod: 'PHYSICAL_TEST'
    };

    expect(EngineeringRequirementValidator.validate(pumpReq).parameter).toBe('pressure');
    expect(EngineeringRequirementValidator.validate(vehicleReq).parameter).toBe('mass');
  });

  // 29. EPC-001 requirements integration works
  it('29. integrates seamlessly with EPC-001 ProofCaseProject schema', () => {
    const reqRef = EngineeringRequirementValidator.toProofCaseRequirementReference(sampleRequirement);
    const project: ProofCaseProject = {
      caseId: 'CASE-INTEG-001',
      caseType: 'PRODUCT',
      domain: 'AUTOMOTIVE',
      revision: 'v1.0.0',
      status: 'DEFINED',
      owner: 'CHIEF-ENGINEER',
      requirements: [reqRef],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };
    const validatedProject = ProofCaseValidator.validate(project);
    expect(validatedProject.requirements.length).toBe(1);
    expect(validatedProject.requirements[0].requirementId).toBe('REQ-STRUCT-001');
  });

  // 30. Existing SECP requirement infrastructure remains compatible
  it('30. passes automated EPC002Verifier with PASS verdict and evidence hash', () => {
    const report = EPC002Verifier.runVerification();
    expect(report.verdict).toBe('PASS');
    expect(report.evidenceHash).toBeDefined();
    expect(report.evidenceHash.length).toBe(64);
  });

  // Adversarial tests
  describe('Adversarial & Boundary Tests', () => {
    it('rejects null candidate', () => {
      expect(() => EngineeringRequirementValidator.validate(null)).toThrow();
    });

    it('rejects undefined candidate', () => {
      expect(() => EngineeringRequirementValidator.validate(undefined)).toThrow();
    });

    it('rejects primitive candidate', () => {
      expect(() => EngineeringRequirementValidator.validate('not an object')).toThrow();
    });

    it('rejects array candidate', () => {
      expect(() => EngineeringRequirementValidator.validate([])).toThrow();
    });

    it('rejects NaN tolerance absoluteTolerance', () => {
      const req = {
        ...sampleRequirement,
        tolerance: { absoluteTolerance: NaN }
      };
      expect(() => EngineeringRequirementValidator.validate(req)).toThrow();
    });

    it('rejects Infinity tolerance relativeTolerance', () => {
      const req = {
        ...sampleRequirement,
        tolerance: { relativeTolerance: Infinity }
      };
      expect(() => EngineeringRequirementValidator.validate(req)).toThrow();
    });

    it('rejects negative absoluteTolerance', () => {
      const req = {
        ...sampleRequirement,
        tolerance: { absoluteTolerance: -10 }
      };
      expect(() => EngineeringRequirementValidator.validate(req)).toThrow();
    });

    it('rejects contradictory bounds where lowerBound > upperBound', () => {
      const req = {
        ...sampleRequirement,
        tolerance: { lowerBound: 500, upperBound: 200 }
      };
      expect(() => EngineeringRequirementValidator.validate(req)).toThrow();
    });

    it('rejects dimensional mismatch between parameter and unit (e.g., mass with Pa)', () => {
      const req = {
        ...sampleRequirement,
        parameter: 'mass',
        unit: 'Pa'
      };
      expect(() => EngineeringRequirementValidator.validate(req)).toThrow();
    });
  });
});
