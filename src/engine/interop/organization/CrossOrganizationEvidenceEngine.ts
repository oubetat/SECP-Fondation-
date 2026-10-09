/**
 * SECP Industrial OS v2 — Cross-Organization Interoperability
 * PATCH-169: Cross-Organization Evidence Engine
 */

import { 
  CrossOrganizationEvidencePackage, 
  CrossOrganizationVerificationReport, 
  EvidenceTransfer,
  OrganizationIdentity,
  OrganizationType
} from './types';
import { EvidencePackage, VerificationStatus, VerificationFinding } from '../../verification/portal/types';
import { IndependentVerificationEngine } from '../../verification/portal/IndependentVerificationEngine';
import { EvidenceHasher } from '../../evidence/ledger/EvidenceHasher';
import { AttestationCanonicalizer } from '../../attestation/AttestationCanonicalizer';
import * as crypto from 'crypto';

export class CrossOrganizationEvidenceEngine {
  private static readonly SCHEMA_VERSION = "1.0.0";

  /**
   * Prepares a cross-organization evidence package
   */
  public static preparePackage(
    basePackage: EvidencePackage,
    sourceOrg: OrganizationIdentity,
    destOrgId: string,
    transferId: string,
    policyId: string,
    reason: string
  ): CrossOrganizationEvidencePackage {
    
    // 1. Calculate package hash (canonical representation of base package + metadata)
    const packagePayload = {
      packageId: basePackage.packageId,
      sourceOrganization: sourceOrg.organizationId,
      destinationOrganization: destOrgId,
      transferId,
      policyId,
      reason,
      manifest: basePackage.manifest,
      artifactIdentities: basePackage.artifactIdentities
    };
    
    const packageHash = EvidenceHasher.hashObject(packagePayload);

    // 2. Mock signature (in a real system, this would use a private key)
    const packageSignature = `SIG_ORG_${sourceOrg.organizationId}_${packageHash}`;

    return {
      ...basePackage,
      schemaVersion: this.SCHEMA_VERSION,
      sourceOrganization: sourceOrg.organizationId,
      destinationOrganization: destOrgId,
      packageHash,
      packageSignature,
      senderIdentityAssertion: sourceOrg,
      transferMetadata: {
        transferId,
        policyId,
        reason
      }
    };
  }

  /**
   * Verifies an incoming cross-organization evidence package
   */
  public static async verifyIncomingPackage(
    pkg: CrossOrganizationEvidencePackage
  ): Promise<CrossOrganizationVerificationReport> {
    const findings: VerificationFinding[] = [];
    const timestamp = new Date().toISOString();
    
    // 1. Schema Validation
    if (pkg.schemaVersion !== this.SCHEMA_VERSION) {
      findings.push({
        code: 'SCHEMA_INVALID',
        message: `Unsupported schema version: ${pkg.schemaVersion}`,
        severity: 'CRITICAL'
      });
    }

    // 2. Package Hash Verification
    const packagePayload = {
      packageId: pkg.packageId,
      sourceOrganization: pkg.sourceOrganization,
      destinationOrganization: pkg.destinationOrganization,
      transferId: pkg.transferMetadata.transferId,
      policyId: pkg.transferMetadata.policyId,
      reason: pkg.transferMetadata.reason,
      manifest: pkg.manifest,
      artifactIdentities: pkg.artifactIdentities
    };
    const recomputedPackageHash = EvidenceHasher.hashObject(packagePayload);
    const packageIntegrityVerified = recomputedPackageHash === pkg.packageHash;
    
    if (!packageIntegrityVerified) {
      findings.push({
        code: 'TRANSFER_INTEGRITY_FAILURE',
        message: 'Cross-organization package hash mismatch',
        severity: 'CRITICAL'
      });
    }

    // 3. Sender Identity Verification (Assertion vs Cryptographic Authentication)
    // For now, we only verify that the identity is present and active
    const organizationIdentityVerified = pkg.senderIdentityAssertion.status === 'ACTIVE';
    if (!organizationIdentityVerified) {
       findings.push({
        code: 'IDENTITY_UNPROVEN',
        message: `Sender organization ${pkg.sourceOrganization} is not in ACTIVE status`,
        severity: 'CRITICAL'
      });
    }

    // 4. Signature Verification
    // Mock signature check: SIG_ORG_{orgId}_{hash}
    const expectedSignature = `SIG_ORG_${pkg.sourceOrganization}_${pkg.packageHash}`;
    const senderSignatureVerified = pkg.packageSignature === expectedSignature;
    
    if (!senderSignatureVerified) {
      findings.push({
        code: 'SIGNATURE_INVALID',
        message: 'Sender cryptographic signature verification failed',
        severity: 'CRITICAL'
      });
    }

    // 5. Independent Verification (The core logic from PATCH-168)
    const independentResult = IndependentVerificationEngine.verifyEvidencePackage(pkg);
    
    // Merge findings from independent verification
    findings.push(...independentResult.findings);

    // 6. Artifact Hash Preservation
    const artifactIntegrityVerified = independentResult.overallStatus === VerificationStatus.VERIFIED;
    if (!artifactIntegrityVerified) {
      findings.push({
        code: 'ARTIFACT_INTEGRITY_FAILURE',
        message: 'Artifact hash mismatch detected during independent verification',
        severity: 'CRITICAL'
      });
    }

    // Determine Overall Status
    let overallStatus = VerificationStatus.VERIFIED;
    if (findings.some(f => f.severity === 'CRITICAL')) {
      if (findings.some(f => f.code === 'TRANSFER_INTEGRITY_FAILURE')) overallStatus = VerificationStatus.INTEGRITY_FAILURE;
      else if (findings.some(f => f.code === 'SIGNATURE_INVALID')) overallStatus = VerificationStatus.SIGNATURE_INVALID;
      else if (findings.some(f => f.code === 'IDENTITY_UNPROVEN')) overallStatus = VerificationStatus.INVALID;
      else overallStatus = independentResult.overallStatus;
    }

    return {
      reportId: `XORG_REPORT_${crypto.randomBytes(4).toString('hex')}`,
      transferId: pkg.transferMetadata.transferId,
      overallStatus,
      findings,
      organizationIdentityVerified,
      packageIntegrityVerified,
      senderSignatureVerified,
      artifactIntegrityVerified,
      independentVerificationStatus: independentResult.overallStatus,
      timestamp,
      verifierVersion: "1.0.0"
    };
  }

  /**
   * Helper to create a mock organization identity
   */
  public static createOrganization(
    id: string, 
    name: string, 
    type: OrganizationType
  ): OrganizationIdentity {
    return {
      organizationId: id,
      organizationName: name,
      organizationType: type,
      identityVersion: "1.0.0",
      publicKeyReferences: [`PUB_KEY_${id}`],
      attestationReferences: [],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
  }
}
