/**
 * SECP Industrial OS v2 — Cross-Organization Interoperability
 * PATCH-169: Cross-Organization Evidence Hard Acceptance Gate
 */

import { CrossOrganizationEvidenceEngine } from './CrossOrganizationEvidenceEngine';
import { OrganizationType, CrossOrganizationEvidencePackage } from './types';
import { VerificationStatus } from '../../verification/portal/types';
import { HardAcceptanceGate168 } from '../../verification/portal/HardAcceptanceGate168';

export interface Gate169Check {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly verdict: string;
}

export interface Gate169Report {
  readonly patchId: string;
  readonly timestamp: string;
  readonly verdict: 'PASS' | 'FAIL';
  readonly checks: readonly Gate169Check[];
}

export class HardAcceptanceGate169 {
  public static async evaluate(): Promise<Gate169Report> {
    const checks: Gate169Check[] = [];

    // 1. Setup Organizations
    const orgA = CrossOrganizationEvidenceEngine.createOrganization("ORG-A", "Engineering Corp", OrganizationType.ENGINEERING_COMPANY);
    const orgBId = "ORG-B";

    // 2. Base Evidence Package (from Gate 168)
    const basePkg = (HardAcceptanceGate168 as any).createMockPackage();

    // --- Scenario 1: Valid Transfer ---
    const validPkg = CrossOrganizationEvidenceEngine.preparePackage(
      basePkg, orgA, orgBId, "TX-001", "POL-001", "Design Review"
    );
    const result1 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(validPkg);
    checks.push({
      id: 'CHECK-01-VALID-XORG-TRANSFER',
      description: 'Scenario 1: Valid Cross-Organization Transfer',
      passed: result1.overallStatus === VerificationStatus.VERIFIED,
      verdict: result1.overallStatus
    });

    // --- Scenario 2: Package Tampering ---
    const tamperedPkg = JSON.parse(JSON.stringify(validPkg));
    tamperedPkg.manifest.rootArtifactId = "TAMPERED-ROOT";
    const result2 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(tamperedPkg);
    checks.push({
      id: 'CHECK-02-ADVERSARIAL-TAMPERED-PACKAGE',
      description: 'Scenario 2: Package Tampering (Manifest change)',
      passed: result2.overallStatus === VerificationStatus.INTEGRITY_FAILURE,
      verdict: result2.overallStatus
    });

    // --- Scenario 3: Signature Mismatch ---
    const invalidSigPkg = JSON.parse(JSON.stringify(validPkg));
    invalidSigPkg.packageSignature = "INVALID_SIGNATURE";
    const result3 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(invalidSigPkg);
    checks.push({
      id: 'CHECK-03-ADVERSARIAL-INVALID-SIGNATURE',
      description: 'Scenario 3: Invalid Sender Signature',
      passed: result3.overallStatus === VerificationStatus.SIGNATURE_INVALID,
      verdict: result3.overallStatus
    });

    // --- Scenario 4: Suspended Identity ---
    const suspendedOrg = { ...orgA, status: 'SUSPENDED' as const };
    const suspendedPkg = CrossOrganizationEvidenceEngine.preparePackage(
      basePkg, suspendedOrg, orgBId, "TX-004", "POL-001", "Audit"
    );
    const result4 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(suspendedPkg);
    checks.push({
      id: 'CHECK-04-ADVERSARIAL-SUSPENDED-IDENTITY',
      description: 'Scenario 4: Transfer from Suspended Organization',
      passed: result4.overallStatus === VerificationStatus.INVALID,
      verdict: result4.overallStatus
    });

    // --- Scenario 5: Internal Evidence Tampering ---
    // Modify a record inside the package without changing the package metadata
    const tamperedEvidencePkg = JSON.parse(JSON.stringify(validPkg));
    (tamperedEvidencePkg.evidenceRecords[0] as any).payload.temperature = 9999;
    const result5 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(tamperedEvidencePkg);
    checks.push({
      id: 'CHECK-05-ADVERSARIAL-TAMPERED-EVIDENCE',
      description: 'Scenario 5: Internal Evidence Tampering',
      passed: result5.overallStatus === VerificationStatus.TAMPERED,
      verdict: result5.overallStatus
    });

    // --- Scenario 6: Broken Provenance in Package ---
    const brokenProvPkg = JSON.parse(JSON.stringify(validPkg));
    (brokenProvPkg as any).provenanceNodes = []; // Remove nodes
    const result6 = await CrossOrganizationEvidenceEngine.verifyIncomingPackage(brokenProvPkg);
    checks.push({
      id: 'CHECK-06-ADVERSARIAL-BROKEN-PROVENANCE',
      description: 'Scenario 6: Broken Provenance in X-Org Package',
      passed: result6.overallStatus === VerificationStatus.PROVENANCE_BROKEN,
      verdict: result6.overallStatus
    });

    // Final Verdict
    const verdict = checks.every(c => c.passed) ? 'PASS' : 'FAIL';

    return {
      patchId: "PATCH-169",
      timestamp: new Date().toISOString(),
      verdict,
      checks
    };
  }
}
