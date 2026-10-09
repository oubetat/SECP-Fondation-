/**
 * SECP Industrial OS — EPC-010 & EPC-011: Evidence Integrity & Provenance Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { EngineeringEvidencePackageManager } from '../evidence/EngineeringEvidencePackageManager';
import { EngineeringEvidencePackageValidator } from '../evidence/EngineeringEvidencePackageValidator';
import { EvidenceVerdictStatus, EvidencePackageError } from '../evidence/EngineeringEvidencePackageTypes';
import { IntegrityStatus } from '../evidence/EvidenceIntegrityTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

describe('EPC-010 & EPC-011: Evidence Integrity & Provenance', () => {
  let manager: EngineeringEvidencePackageManager;

  beforeEach(() => {
    manager = new EngineeringEvidencePackageManager();
  });

  test('TEST 1: Hash Evidence is stable', () => {
    const payload = { value: 10, unit: 'mm' };
    const hash1 = EvidenceIntegrityService.computeHash(payload);
    const hash2 = EvidenceIntegrityService.computeHash(payload);
    expect(hash1).toBe(hash2);
  });

  test('TEST 2: Deterministic hashing (Same Evidence -> Same Hash)', () => {
    const payload = { b: 2, a: 1 };
    const payloadReordered = { a: 1, b: 2 };
    const hash1 = EvidenceIntegrityService.computeHash(payload);
    const hash2 = EvidenceIntegrityService.computeHash(payloadReordered);
    expect(hash1).toBe(hash2);
  });

  test('TEST 3: Tamper Detection (Value change)', () => {
    const pkg = manager.createPackage('CASE-010', 'A. Oubetat');
    manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const updated = manager.getPackage(pkg.packageId, 'R1')!;
    // Simulate Tamper
    updated.results[0].value = 200;

    const validation = EngineeringEvidencePackageValidator.validate(updated);
    expect(validation.errors).toContain(EvidencePackageError.INTEGRITY_FAILURE);
    expect(validation.status).toBe('INVALID');
  });

  test('TEST 4: Tamper Detection (Unit change)', () => {
    const pkg = manager.createPackage('CASE-010', 'A. Oubetat');
    manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const updated = manager.getPackage(pkg.packageId, 'R1')!;
    // Simulate Tamper
    updated.results[0].unit = 'GPa';

    const validation = EngineeringEvidencePackageValidator.validate(updated);
    expect(validation.errors).toContain(EvidencePackageError.INTEGRITY_FAILURE);
  });

  test('TEST 5: Missing Provenance Check', () => {
    const pkg = manager.createPackage('CASE-011', 'A. Oubetat');
    manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const updated = manager.getPackage(pkg.packageId, 'R1')!;
    // Delete Provenance
    delete updated.provenanceRecords['RES-001'];

    const validation = EngineeringEvidencePackageValidator.validate(updated);
    expect(validation.errors).toContain(EvidencePackageError.PROVENANCE_MISSING);
  });

  test('TEST 6: Revision Binding', () => {
    const pkg1 = manager.createPackage('CASE-012', 'A. Oubetat');
    manager.addResult(pkg1.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const hashR1 = pkg1.integrityRecords['RES-001'].contentHash;

    const pkg2 = manager.createRevision(pkg1.packageId, 'R1', 'R2');
    // Modify in R2
    manager.addResult(pkg2.packageId, 'R2', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 150, // Changed
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V2'
    });

    const hashR2 = pkg2.integrityRecords['RES-001'].contentHash;
    expect(hashR1).not.toBe(hashR2);
  });

  test('TEST 7: Sealed Package Modification Restriction', () => {
    const pkg = manager.createPackage('CASE-013', 'A. Oubetat');
    // Add requirement so it's not incomplete
    manager.addRequirement(pkg.packageId, 'R1', { requirementId: 'R1', revision: '1', status: 'A', verificationStatus: 'P', priority: 'L' });
    manager.sealPackage(pkg.packageId, 'R1');
    
    expect(() => manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-X',
      analysisId: 'AN-X',
      metric: 'X',
      value: 1,
      unit: 'X',
      status: EvidenceVerdictStatus.PASS,
      source: 'X',
      revision: 'X'
    })).toThrow();
  });

  test('TEST 8: Provenance Chain Retrieval', () => {
    const pkg = manager.createPackage('CASE-014', 'A. Oubetat');
    manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'AN-001',
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const updated = manager.getPackage(pkg.packageId, 'R1')!;
    const prov = updated.provenanceRecords['RES-001'];
    expect(prov).toBeDefined();
    expect(prov.actor).toBe('A. Oubetat');
    expect(prov.action).toBe('FEA_EXECUTION');
  });

  test('TEST 9: Critical Evidence Integrity Failure -> Verdict FAIL', () => {
    const pkg = manager.createPackage('CASE-015', 'A. Oubetat');
    manager.addRequirement(pkg.packageId, 'R1', {
      requirementId: 'REQ-CRIT',
      revision: 'V1',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
      priority: 'CRITICAL'
    });

    manager.addResult(pkg.packageId, 'R1', {
      resultId: 'RES-001',
      analysisId: 'REQ-CRIT', // Linking to critical
      metric: 'Stress',
      value: 100,
      unit: 'MPa',
      status: EvidenceVerdictStatus.PASS,
      source: 'ANALYSIS',
      revision: 'V1'
    });

    const updated = manager.getPackage(pkg.packageId, 'R1')!;
    // Tamper
    updated.results[0].value = 999;

    const validation = EngineeringEvidencePackageValidator.validate(updated);
    expect(validation.verdict).toBe(EvidenceVerdictStatus.FAIL);
  });
});
