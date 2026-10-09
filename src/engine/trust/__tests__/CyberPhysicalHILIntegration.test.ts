import { describe, it, expect, beforeEach } from 'vitest';
import { CyberPhysicalHILTestHarness, HILPathologyType } from '../CyberPhysicalHILTestHarness';
import { GoldenTurbineTestArticle } from '../GoldenTurbineTestArticle';

describe('SECP Cyber-Physical HIL Test Harness & Boundary Qualification', () => {
  beforeEach(() => {
    CyberPhysicalHILTestHarness.resetReplayAuditLog();
  });

  it('should generate and verify a valid GTTA-101 emulated package under TEST_EMULATED scope', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    expect(pkg.measurementEnvelope.provenance).toBe('TEST_EMULATED');
    expect(pkg.measurementEnvelope.testOnlyFlag).toBe(true);

    const proof = CyberPhysicalHILTestHarness.verifyCyberPhysicalChain(pkg, GoldenTurbineTestArticle.CANONICAL_REVISION_A, false);
    expect(proof.cyberPhysicalVerdict).toBe('PASS');
    expect(proof.verificationStatus).toBe('PROVEN');
    expect(proof.provenance).toBe('TEST_EMULATED');
    expect(proof.testOnlyFlag).toBe(true);
  });

  it('should enforce FAIL-CLOSED rule and refuse production release for TEST_EMULATED evidence', () => {
    const pkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
    
    // Attempt to request production release requiring physical production evidence
    const proof = CyberPhysicalHILTestHarness.verifyCyberPhysicalChain(pkg, GoldenTurbineTestArticle.CANONICAL_REVISION_A, true);
    expect(proof.cyberPhysicalVerdict).toBe('NOT_PROVISIONED');
    expect(proof.verificationStatus).toBe('NOT_PROVISIONED');
    expect(proof.failReason).toContain('FAIL_CLOSED');
  });

  const pathologies: { type: HILPathologyType; expectedReasonSubstring: string }[] = [
    { type: 'REPLAY_ATTACK', expectedReasonSubstring: 'REPLAY_ATTACK' },
    { type: 'SIGNATURE_FORGERY', expectedReasonSubstring: 'SIGNATURE_FORGERY' },
    { type: 'SERIAL_SUBSTITUTION', expectedReasonSubstring: 'SERIAL_SUBSTITUTION' },
    { type: 'REVISION_SUBSTITUTION', expectedReasonSubstring: 'REVISION_SUBSTITUTION' },
    { type: 'CALIBRATION_EXPIRY', expectedReasonSubstring: 'CALIBRATION_EXPIRY' },
    { type: 'MACHINE_IDENTITY_SUBSTITUTION', expectedReasonSubstring: 'MACHINE_IDENTITY_SUBSTITUTION' },
    { type: 'CERTIFICATE_SUBSTITUTION', expectedReasonSubstring: 'CERTIFICATE_SUBSTITUTION' },
    { type: 'MEASUREMENT_MUTATION', expectedReasonSubstring: 'MEASUREMENT_MUTATION' }
  ];

  pathologies.forEach(({ type, expectedReasonSubstring }) => {
    it(`should detect and block 100% of injected pathology: ${type}`, () => {
      const basePkg = CyberPhysicalHILTestHarness.createValidEmulatedPackage();
      
      if (type === 'REPLAY_ATTACK') {
        // First run succeeds
        CyberPhysicalHILTestHarness.verifyCyberPhysicalChain(basePkg);
      }

      const pathologyPkg = CyberPhysicalHILTestHarness.createPathologyEmulatedPackage(type, basePkg);
      const proof = CyberPhysicalHILTestHarness.verifyCyberPhysicalChain(pathologyPkg);

      expect(proof.cyberPhysicalVerdict).toBe('REJECTED');
      expect(proof.failReason).toBeDefined();
      expect(proof.failReason).toContain(expectedReasonSubstring);
    });
  });
});
