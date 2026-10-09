/**
 * SECP Industrial OS — EPC-001: Proof Case Project Schema Test Suite
 * Comprehensive Vitest verification for EPC-001 domain-agnostic schema.
 */

import { describe, it, expect } from 'vitest';
import { ProofCaseProject, ProofCaseValidationError } from '../ProofCaseTypes';
import { ProofCaseValidator } from '../ProofCaseValidator';
import { ProofCaseSerializer } from '../ProofCaseSerializer';
import { EPC001Verifier } from '../EPC001Verifier';

describe('EPC-001: Proof Case Project Schema Verification', () => {
  it('1. Valid minimal ProofCaseProject creation', () => {
    const minimal: ProofCaseProject = {
      caseId: 'MIN-001',
      caseType: 'PRODUCT',
      domain: 'GENERAL_ENGINEERING',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-01',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    const validated = ProofCaseValidator.validate(minimal);
    expect(validated.caseId).toBe('MIN-001');
    expect(validated.status).toBe('DRAFT');
  });

  it('2. Complete ProofCaseProject creation', () => {
    const complete: ProofCaseProject = {
      caseId: 'COMP-100',
      caseType: 'SYSTEM',
      domain: 'AEROSPACE',
      revision: {
        revisionId: 'v2.0.0',
        branchName: 'main',
        author: 'Lead Architect'
      },
      status: 'ACTIVE',
      owner: {
        ownerId: 'OWNER-ENG-1',
        name: 'Lead Engineer',
        organizationId: 'ORG-SECP'
      },
      requirements: [
        { requirementId: 'REQ-1', title: 'Pressure Rating 100 bar' }
      ],
      models: [
        { modelId: 'M-CAD', modelType: 'CAD', name: 'Manifold CAD' },
        { modelId: 'M-FEA', modelType: 'FEA', name: 'Stress Mesh' }
      ],
      simulations: [
        { simulationId: 'S-CFD', name: 'Fluid Flow CFD' }
      ],
      manufacturing: [
        { definitionId: 'MFG-01', name: '5-Axis Toolpath Routing' }
      ],
      tests: [
        { testId: 'T-BURST', name: 'Pressure Burst Test' }
      ],
      evidence: [
        { evidenceId: 'EVI-LEDGER-99', evidenceType: 'VERIFICATION', resultHash: 'abc123hash' }
      ],
      extensions: {
        vendorCode: 'VEND-777'
      }
    };

    const validated = ProofCaseValidator.validate(complete);
    expect(validated.models.length).toBe(2);
    expect(validated.requirements[0].requirementId).toBe('REQ-1');
  });

  it('3. Missing mandatory caseId rejection', () => {
    const invalid = {
      caseType: 'PRODUCT',
      domain: 'AEROSPACE',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
    try {
      ProofCaseValidator.validate(invalid as any);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_CASE_ID');
    }
  });

  it('4. Missing caseType rejection', () => {
    const invalid = {
      caseId: 'CASE-01',
      domain: 'AEROSPACE',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
    try {
      ProofCaseValidator.validate(invalid as any);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_CASE_TYPE');
    }
  });

  it('5. Missing domain rejection', () => {
    const invalid = {
      caseId: 'CASE-01',
      caseType: 'PRODUCT',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
    try {
      ProofCaseValidator.validate(invalid as any);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_DOMAIN');
    }
  });

  it('6. Missing revision rejection', () => {
    const invalid = {
      caseId: 'CASE-01',
      caseType: 'PRODUCT',
      domain: 'ROBOTICS',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
    try {
      ProofCaseValidator.validate(invalid as any);
    } catch (e: any) {
      expect(e.code).toBe('MISSING_REVISION');
    }
  });

  it('7. Invalid status rejection', () => {
    const invalid = {
      caseId: 'CASE-01',
      caseType: 'PRODUCT',
      domain: 'AUTOMOTIVE',
      revision: 'v1.0.0',
      status: 'UNKNOWN_STATUS_ABC',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
    try {
      ProofCaseValidator.validate(invalid as any);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_STATUS');
    }
  });

  it('8. Invalid structure rejection', () => {
    const invalid = {
      caseId: 'CASE-01',
      caseType: 'PRODUCT',
      domain: 'AUTOMOTIVE',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: 'INVALID_NOT_AN_ARRAY',
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(invalid as any)).toThrow(ProofCaseValidationError);
  });

  it('9. Serialization/deserialization round trip', () => {
    const p1: ProofCaseProject = {
      caseId: 'ROUNDTRIP-01',
      caseType: 'SYSTEM',
      domain: 'FLUID_SYSTEMS',
      revision: 'v1.0.0',
      status: 'DEFINED',
      owner: 'ENG-LEAD',
      requirements: [{ requirementId: 'R-1', title: 'Flow Check' }],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    const isFid = ProofCaseSerializer.verifyRoundTrip(p1);
    expect(isFid).toBe(true);
  });

  it('10. Deterministic serialization', () => {
    const caseA: ProofCaseProject = {
      caseId: 'DET-001',
      caseType: 'PRODUCT',
      domain: 'THERMAL',
      revision: 'v1.0.0',
      status: 'ACTIVE',
      owner: 'OWNER-A',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    const caseB: any = {
      evidence: [],
      tests: [],
      manufacturing: [],
      simulations: [],
      models: [],
      requirements: [],
      owner: 'OWNER-A',
      status: 'ACTIVE',
      revision: 'v1.0.0',
      domain: 'THERMAL',
      caseType: 'PRODUCT',
      caseId: 'DET-001'
    };

    const sA = ProofCaseSerializer.serialize(caseA);
    const sB = ProofCaseSerializer.serialize(caseB);

    expect(sA.canonicalString).toBe(sB.canonicalString);
    expect(sA.proofHash).toBe(sB.proofHash);
  });

  it('11. Extension fields do not corrupt canonical structure', () => {
    const caseExt: ProofCaseProject = {
      caseId: 'EXT-01',
      caseType: 'PROCESS',
      domain: 'MANUFACTURING',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: [],
      extensions: {
        customParam: 42,
        metaInfo: 'Valid extension'
      }
    };

    const serialized = ProofCaseSerializer.serialize(caseExt);
    const deserialized = ProofCaseSerializer.deserialize(serialized.canonicalString);
    expect((deserialized.extensions as any).customParam).toBe(42);
    expect(deserialized.caseId).toBe('EXT-01');
  });

  it('12. Existing SECP provenance/evidence references remain compatible', () => {
    const provCase: ProofCaseProject = {
      caseId: 'PROV-COMPAT-01',
      caseType: 'CROSS_DOMAIN',
      domain: 'GENERAL_ENGINEERING',
      revision: {
        revisionId: 'v3.1.0',
        branchName: 'feature/epc-001',
        parentRevisionId: 'v3.0.0'
      },
      status: 'VALIDATED',
      owner: 'OWNER-SECP',
      requirements: [],
      models: [],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: [
        {
          evidenceId: 'EVI-LEDGER-2026-001',
          evidenceType: 'CAD',
          payloadHash: 'hash123',
          resultHash: 'hash456'
        }
      ]
    };

    const validated = ProofCaseValidator.validate(provCase);
    expect(validated.evidence[0].evidenceId).toBe('EVI-LEDGER-2026-001');
  });

  it('13. No UI framework dependency in engineering core', () => {
    const typesStr = require('fs').readFileSync(require.resolve('../ProofCaseTypes.ts'), 'utf8');
    const validatorStr = require('fs').readFileSync(require.resolve('../ProofCaseValidator.ts'), 'utf8');
    const serializerStr = require('fs').readFileSync(require.resolve('../ProofCaseSerializer.ts'), 'utf8');

    expect(typesStr).not.toContain('react');
    expect(validatorStr).not.toContain('react');
    expect(serializerStr).not.toContain('react');
  });

  it('14. No product-specific logic in core implementation', () => {
    const validatorStr = require('fs').readFileSync(require.resolve('../ProofCaseValidator.ts'), 'utf8');
    expect(validatorStr.toLowerCase()).not.toContain('drone');
    expect(validatorStr.toLowerCase()).not.toContain('quadcopter');
    expect(validatorStr.toLowerCase()).not.toContain('propeller_engine');
  });

  it('15. Adversarial checks: malformed inner elements & invalid state transitions', () => {
    // Rejection of invalid status transition (e.g. CLOSED to VERIFICATION directly)
    const transitionCheck = ProofCaseValidator.validateStatusTransition('CLOSED', 'VERIFICATION');
    expect(transitionCheck.valid).toBe(false);

    // Rejection of malformed model element
    const malformedModelCase = {
      caseId: 'ADV-01',
      caseType: 'PRODUCT',
      domain: 'ROBOTICS',
      revision: 'v1.0.0',
      status: 'DRAFT',
      owner: 'OWNER-1',
      requirements: [],
      models: [{ incompleteKey: 'no_id_or_type' }],
      simulations: [],
      manufacturing: [],
      tests: [],
      evidence: []
    };

    expect(() => ProofCaseValidator.validate(malformedModelCase as any)).toThrow(ProofCaseValidationError);
  });

  it('16. Automated EPC001Verifier execution produces PASS verdict and valid evidence hash', () => {
    const report = EPC001Verifier.runVerification();
    expect(report.epc).toBe('EPC-001');
    expect(report.verdict).toBe('PASS');
    expect(report.evidenceHash).toBeDefined();
    expect(report.evidenceHash.length).toBe(64);
    expect(Object.keys(report.checks).length).toBeGreaterThanOrEqual(15);
  });
});
