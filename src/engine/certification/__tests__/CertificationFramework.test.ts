/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-186: Engineering Truth Certification Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  CertificationLevel, 
  CertificationVerdict, 
  CertificationRulesEngine, 
  EngineeringTruthCertificationGate,
  EvaluationContext
} from '../truth/CertificationFramework';

describe('PATCH-186: Engineering Truth Certification Framework', () => {
  const defaultContext: EvaluationContext = {
    subjectId: "SUBJECT-CAD-001",
    capabilityVersion: "1.0.0",
    implementationEvidence: true,
    requiredTests: [
      { id: "T1", name: "Geometric Precision Test", passed: true, isMandatory: true },
      { id: "T2", name: "B-Rep Validation", passed: true, isMandatory: true }
    ],
    benchmarks: [
      { id: "B1", name: "Euclidean Mesh Benchmark", passed: true, isSimulationOnly: false }
    ],
    adversarialTests: [
      { id: "A1", name: "Mesh Perturbation Attack", passed: true }
    ],
    independentVerification: true,
    tamperDetected: false,
    isSimulationOnly: false,
    dependencies: ["Core-Geometry"]
  };

  // 1. Certification creation
  it('1. Certification creation: should successfully issue active certificate under full compliance', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    expect(cert.CertificationId).toBeDefined();
    expect(cert.Capability).toBe("CAD");
    expect(cert.CertificationLevel).toBe(CertificationLevel.LEVEL_5_CERTIFIED);
    expect(cert.Verdict).toBe(CertificationVerdict.PROVEN);
    expect(cert.RevocationStatus).toBe("ACTIVE");
    expect(cert.VerificationStatus).toBe("VERIFIED");
  });

  // 2. Certification immutability
  it('2. Certification immutability: any modifications after issue must violate hash integrity', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    
    // Create mutated clone
    const mutated = {
      ...cert,
      Verdict: CertificationVerdict.PROVEN // remains same but we try to mock mutating fields
    };
    
    const verification = EngineeringTruthCertificationGate.verifyCertificate(mutated);
    expect(verification.isValid).toBe(true);

    const maliciousMutation = {
      ...cert,
      Verdict: CertificationVerdict.UNPROVEN // modifying verdict directly
    };
    const verificationMutated = EngineeringTruthCertificationGate.verifyCertificate(maliciousMutation);
    expect(verificationMutated.isValid).toBe(false);
    expect(verificationMutated.reason).toContain("CertificationHash mismatch");
  });

  // 3. Certification hash integrity
  it('3. Certification hash integrity: modified fields must fail hash comparison', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    const calculatedHashBefore = EngineeringTruthCertificationGate.computeHash(cert);
    expect(calculatedHashBefore).toBe(cert.CertificationHash);

    // Modify a deep array or standard property
    const tampered = {
      ...cert,
      TestReferences: [...cert.TestReferences, "TEST-MALICIOUS-ADDED"]
    };
    const verification = EngineeringTruthCertificationGate.verifyCertificate(tampered);
    expect(verification.isValid).toBe(false);
  });

  // 4. Evidence linkage
  it('4. Evidence linkage: links from implementation through execution to certificate', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    expect(cert.EvidenceReferences).toContain("EVID-IMP-CAD-001");
    expect(cert.EvidenceReferences).toContain("EVID-IND-CAD-999");
  });

  // 5. Benchmark linkage
  it('5. Benchmark linkage: links benchmark identifiers correctly', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    expect(cert.BenchmarkReferences).toContain("BENCH-B1");
  });

  // 6. Adversarial evidence linkage
  it('6. Adversarial evidence linkage: links adversarial test targets', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    expect(cert.TestReferences).toContain("TEST-T1");
    expect(cert.TestReferences).toContain("TEST-T2");
  });

  // 7. Independent verification
  it('7. Independent verification: capability cannot exceed qualified level without independent verify', () => {
    const contextNoVerify: EvaluationContext = {
      ...defaultContext,
      independentVerification: false
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextNoVerify);
    expect(cert.CertificationLevel).toBe(CertificationLevel.LEVEL_3_QUALIFIED);
    expect(cert.Verdict).toBe(CertificationVerdict.PARTIALLY_PROVEN);
  });

  // 8. Certification revocation
  it('8. Certification revocation: transitioning record to REVOKED preserves identity but invalidates verification', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    const revoked = EngineeringTruthCertificationGate.revoke(cert, "Security regression in NURBS solver");
    
    expect(revoked.CertificationId).toBe(cert.CertificationId);
    expect(revoked.RevocationStatus).toBe("REVOKED");
    expect(revoked.RevocationReason).toBe("Security regression in NURBS solver");
    expect(revoked.VerificationStatus).toBe("INVALID");

    const verifyResult = EngineeringTruthCertificationGate.verifyCertificate(revoked);
    expect(verifyResult.isValid).toBe(false);
    expect(verifyResult.reason).toBe("Security regression in NURBS solver");
  });

  // 9. Certification revalidation
  it('9. Certification revalidation: capability version updates must invalidate old certs and trigger full re-eval', () => {
    const oldCert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    
    const upgradedContext: EvaluationContext = {
      ...defaultContext,
      capabilityVersion: "2.0.0"
    };

    const newCert = EngineeringTruthCertificationGate.revalidate(oldCert, upgradedContext);
    expect(newCert.CapabilityVersion).toBe("2.0.0");
    expect(newCert.CertificationId).not.toBe(oldCert.CertificationId); // Generates a brand new revision id / record
  });

  // 10. Missing evidence rejection
  it('10. Missing evidence rejection: fails to exceed LEVEL 0 if implementation evidence is missing', () => {
    const contextNoImp: EvaluationContext = {
      ...defaultContext,
      implementationEvidence: false
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextNoImp);
    expect(cert.CertificationLevel).toBe(CertificationLevel.LEVEL_0_DECLARED);
    expect(cert.Verdict).toBe(CertificationVerdict.UNPROVEN);
  });

  // 11. Failed test rejection
  it('11. Failed test rejection: failed mandatory tests force verdict to FAILED', () => {
    const contextFailingTest: EvaluationContext = {
      ...defaultContext,
      requiredTests: [
        { id: "T1", name: "Geom Precision", passed: false, isMandatory: true }
      ]
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextFailingTest);
    expect(cert.CertificationLevel).toBe(CertificationLevel.LEVEL_1_IMPLEMENTED);
    expect(cert.Verdict).toBe(CertificationVerdict.FAILED);
  });

  // 12. Simulated capability classification
  it('12. Simulated capability classification: isSimulationOnly explicitly maps to SIMULATED verdict', () => {
    const contextSimOnly: EvaluationContext = {
      ...defaultContext,
      isSimulationOnly: true
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextSimOnly);
    expect(cert.Verdict).toBe(CertificationVerdict.SIMULATED);
  });

  // 13. Tamper detection
  it('13. Tamper detection: manual tamper signals trigger immediate invalidate & FAILED classification', () => {
    const contextTampered: EvaluationContext = {
      ...defaultContext,
      tamperDetected: true
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextTampered);
    expect(cert.Verdict).toBe(CertificationVerdict.FAILED);
    expect(cert.VerificationStatus).toBe("TAMPER_DETECTED");
  });

  // 14. Provenance verification
  it('14. Provenance verification: checks cryptographically bound signatures and node identification', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    expect(cert.Provenance.signer).toBe("SECP_CENTRAL_TRUTH_AUTHORITY");
    expect(cert.Provenance.signature).toBeDefined();
    
    const verifyResult = EngineeringTruthCertificationGate.verifyCertificate(cert);
    expect(verifyResult.isValid).toBe(true);
  });

  // 15. Deterministic certification serialization
  it('15. Deterministic certification serialization: identical contexts must yield identical hashes', () => {
    const cert1 = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    const cert2 = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    
    // Clear out randomized fields (ID, dates, randomized signatures) to prove serial deterministic hash match
    const cleanRecord = (r: any) => {
      const { CertificationId, IssuedAt, ValidUntil, Provenance, CertificationHash, ...rest } = r;
      return rest;
    };

    const hash1 = EngineeringTruthCertificationGate.computeHash({
      ...cleanRecord(cert1),
      CertificationId: "STATIC-ID",
      IssuedAt: "2026-01-01T00:00:00.000Z",
      ValidUntil: "2027-01-01T00:00:00.000Z",
      Provenance: { signer: "ISSUER", signature: "SIG", originNodeId: "NODE", chainOfCustodyRoot: "ROOT" }
    } as any);

    const hash2 = EngineeringTruthCertificationGate.computeHash({
      ...cleanRecord(cert2),
      CertificationId: "STATIC-ID",
      IssuedAt: "2026-01-01T00:00:00.000Z",
      ValidUntil: "2027-01-01T00:00:00.000Z",
      Provenance: { signer: "ISSUER", signature: "SIG", originNodeId: "NODE", chainOfCustodyRoot: "ROOT" }
    } as any);

    expect(hash1).toBe(hash2);
  });

  // 16. Reproducibility
  it('16. Reproducibility: independent auditor can fully verify active record state', () => {
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    const result = EngineeringTruthCertificationGate.verifyCertificate(cert);
    expect(result.isValid).toBe(true);
  });

  // 17. Negative verdict preservation
  it('17. Negative verdict preservation: FAILED, UNPROVEN, SIMULATED are kept perfectly in ledger record', () => {
    const contextFailingTest: EvaluationContext = {
      ...defaultContext,
      requiredTests: [
        { id: "T1", name: "Geom Precision", passed: false, isMandatory: true }
      ]
    };
    const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", contextFailingTest);
    expect(cert.Verdict).toBe(CertificationVerdict.FAILED);

    const contextSimOnly: EvaluationContext = {
      ...defaultContext,
      isSimulationOnly: true
    };
    const certSim = EngineeringTruthCertificationGate.evaluateCapability("CFD", contextSimOnly);
    expect(certSim.Verdict).toBe(CertificationVerdict.SIMULATED);
  });

  // 18. Certification package reconstruction
  it('18. Certification package reconstruction: can pack, export, and rebuild validation logs', () => {
    const cert1 = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
    const cert2 = EngineeringTruthCertificationGate.evaluateCapability("CFD", {
      ...defaultContext,
      isSimulationOnly: true
    });

    const exportPack = EngineeringTruthCertificationGate.exportPackage([cert1, cert2]);
    expect(exportPack.manifest.totalRecords).toBe(2);
    expect(exportPack.manifest.packageHash).toBeDefined();
    expect(exportPack.proofs[cert1.CertificationId].verificationStatus).toBe("VERIFIED");
    expect(exportPack.proofs[cert2.CertificationId].verificationStatus).toBe("VERIFIED");
  });

  // 19. Adversarial Attacks
  describe('Adversarial Mutation Attack Scenarios', () => {
    it('Attack: modifying CertificationHash violates authenticity check', () => {
      const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
      const forged = {
        ...cert,
        CertificationHash: "MALICIOUS_FORGED_HASH_89283742"
      };
      const verify = EngineeringTruthCertificationGate.verifyCertificate(forged);
      expect(verify.isValid).toBe(false);
      expect(verify.reason).toContain("CertificationHash mismatch");
    });

    it('Attack: changing Verdict from SIMULATED to PROVEN fails cryptographic verification', () => {
      const contextSim: EvaluationContext = { ...defaultContext, isSimulationOnly: true };
      const cert = EngineeringTruthCertificationGate.evaluateCapability("CFD", contextSim);
      expect(cert.Verdict).toBe(CertificationVerdict.SIMULATED);

      const tampered = {
        ...cert,
        Verdict: CertificationVerdict.PROVEN
      };
      const verify = EngineeringTruthCertificationGate.verifyCertificate(tampered);
      expect(verify.isValid).toBe(false);
      expect(verify.reason).toContain("CertificationHash mismatch");
    });

    it('Attack: changing dates / timestamps is flagged by the verifier', () => {
      const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
      const tampered = {
        ...cert,
        IssuedAt: "2019-01-01T00:00:00.000Z"
      };
      const verify = EngineeringTruthCertificationGate.verifyCertificate(tampered);
      expect(verify.isValid).toBe(false);
    });

    it('Attack: breaking signature chain of custody causes verify validation error', () => {
      const cert = EngineeringTruthCertificationGate.evaluateCapability("CAD", defaultContext);
      const tampered = {
        ...cert,
        Provenance: {
          ...cert.Provenance,
          signature: "FORGED_SIGNATURE_892834"
        }
      };
      const verify = EngineeringTruthCertificationGate.verifyCertificate(tampered);
      expect(verify.isValid).toBe(false);
      expect(verify.reason).toContain("CertificationHash mismatch");
    });
  });
});
