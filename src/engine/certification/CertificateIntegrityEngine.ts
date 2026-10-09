/**
 * SECP Industrial OS v3 — Certificate Integrity & Revocation Engine
 * Monitors certificates for tampering, artifact changes, or evidence corruption.
 */

import { EngineeringCertificate, CertificateStatus, RevocationNotice } from './CertificationTypes';

export class CertificateIntegrityEngine {
  
  /**
   * Evaluates if a certificate is still valid given the current state of the artifact.
   */
  public static verifyIntegrity(
    cert: EngineeringCertificate, 
    currentArtifactHash: string
  ): { isValid: boolean; reason?: string } {
    
    // 1. Check Artifact Hash (Revocation Rule #1: Artifact Change)
    if (cert.artifactHash !== currentArtifactHash) {
      return { 
        isValid: false, 
        reason: `Artifact Hash Mismatch. Expected: ${cert.artifactHash.substring(0, 8)}, Got: ${currentArtifactHash.substring(0, 8)}` 
      };
    }

    // 2. Check Expiration
    if (cert.expiresAt && new Date(cert.expiresAt) < new Date()) {
      return { isValid: false, reason: 'Certificate has expired.' };
    }

    // 3. Check Manual Revocation (Mocked for now)
    if (cert.status === 'REVOKED') {
      return { isValid: false, reason: 'Certificate was manually revoked.' };
    }

    return { isValid: true };
  }

  /**
   * Generates a revocation notice for an invalidated certificate.
   */
  public static revoke(cert: EngineeringCertificate, reason: string): RevocationNotice {
    return {
      certificateId: cert.certificateId,
      revokedAt: new Date().toISOString(),
      reason,
      automated: true
    };
  }

  /**
   * Propagates invalidation through the dependency chain.
   * If Geometry is invalidated, Mesh and Results must also be invalidated.
   */
  public static propagateInvalidation(
    baseDomain: string, 
    allCertificates: EngineeringCertificate[]
  ): EngineeringCertificate[] {
    const invalidationChain: Record<string, string[]> = {
      'GEOMETRY': ['MESH', 'PHYSICS', 'SOLVER', 'RESULT', 'REPRODUCIBILITY', 'EXTERNAL_VALIDATION', 'ENGINEERING_FULL'],
      'MESH': ['SOLVER', 'RESULT', 'REPRODUCIBILITY', 'EXTERNAL_VALIDATION', 'ENGINEERING_FULL'],
      'PHYSICS': ['SOLVER', 'RESULT', 'REPRODUCIBILITY', 'EXTERNAL_VALIDATION', 'ENGINEERING_FULL'],
      'SOLVER': ['RESULT', 'REPRODUCIBILITY', 'EXTERNAL_VALIDATION', 'ENGINEERING_FULL'],
      'RESULT': ['REPRODUCIBILITY', 'EXTERNAL_VALIDATION', 'ENGINEERING_FULL']
    };

    const domainsToInvalidate = invalidationChain[baseDomain] || [];
    
    return allCertificates.map(cert => {
      if (domainsToInvalidate.includes(cert.domain)) {
        return { ...cert, status: 'INVALIDATED' as CertificateStatus };
      }
      return cert;
    });
  }
}
