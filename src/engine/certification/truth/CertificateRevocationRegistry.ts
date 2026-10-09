/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-170: Certificate Revocation Registry
 */

import { EngineeringTruthCertificate } from './types';

export class CertificateRevocationRegistry {
  private static revokedCertificates = new Map<string, { reason: string; revokedAt: string }>();

  /**
   * Revokes a certificate
   */
  public static revoke(certificateId: string, reason: string): void {
    this.revokedCertificates.set(certificateId, {
      reason,
      revokedAt: new Date().toISOString()
    });
  }

  /**
   * Checks if a certificate is revoked
   */
  public static isRevoked(certificateId: string): boolean {
    return this.revokedCertificates.has(certificateId);
  }

  /**
   * Gets revocation details
   */
  public static getRevocationInfo(certificateId: string) {
    return this.revokedCertificates.get(certificateId);
  }

  /**
   * Applies revocation status to a certificate object
   */
  public static applyRevocation(cert: EngineeringTruthCertificate): EngineeringTruthCertificate {
    const info = this.getRevocationInfo(cert.certificateId);
    if (info) {
      return {
        ...cert,
        status: 'REVOKED',
        revocationReason: info.reason,
        revokedAt: info.revokedAt
      };
    }
    return cert;
  }
}
