/**
 * SECP Industrial OS v2 — CAD Fidelity Certification Gate
 * PATCH-041: formal CAD Fidelity Certification
 */

import { CADFidelityCertification, CertificationVerificationResult } from './CertificationTypes';
import * as crypto from 'crypto';

export class CertificationGate {

  /**
   * Independently verifies the integrity and claims of a CAD Fidelity Certification.
   */
  public static validate(cert: CADFidelityCertification): CertificationVerificationResult {
    // 1. Schema & Structure Validation
    if (!cert || !cert.certificationId || !cert.overallVerdict || !cert.capabilities) {
      return this.invalid('Invalid certification structure: missing mandatory fields');
    }

    // 2. Cryptographic Integrity Check
    const { signature, canonicalHash, evidenceHash, ...rest } = cert;
    const sortedKeys = Object.keys(rest).sort();
    const recalculatedCanonical = crypto.createHash('sha256').update(JSON.stringify(rest, sortedKeys)).digest('hex');
    
    // For this implementation, we trust the canonicalHash field if it matches the content,
    // but the gate's job is to ensure it wasn't tampered with.
    if (cert.canonicalHash !== recalculatedCanonical) {
       return this.invalid(`Certification integrity violation: canonical hash mismatch. Expected ${recalculatedCanonical}`);
    }

    // 3. Signature Verification
    const expectedSignatureValue = crypto.createHash('sha256').update(cert.canonicalHash + cert.signature.signedAt).digest('hex');
    if (cert.signature.signatureValue !== expectedSignatureValue) {
      return this.invalid('Certification signature verification FAILED');
    }

    // 4. Expiration Check
    if (new Date(cert.validUntil) < new Date()) {
      return this.invalid('Certification has EXPIRED');
    }

    // 5. Capability Consistency Rules
    const failedCaps = cert.capabilities.filter(c => c.status === 'FAILED');
    const unprovenCaps = cert.capabilities.filter(c => c.status === 'UNPROVEN');
    const partialCaps = cert.capabilities.filter(c => c.status === 'PARTIAL');

    // Rule: Cannot be CERTIFIED if any mandatory capability failed or is unproven
    if (cert.overallVerdict === 'CERTIFIED' && (failedCaps.length > 0 || unprovenCaps.length > 0 || partialCaps.length > 0)) {
       return this.invalid('Verdict inconsistency: overall CERTIFIED cannot hide FAILED, PARTIAL, or UNPROVEN capabilities');
    }

    // Rule: LEVEL 5+ requires genuine external kernel evidence
    if (cert.overallLevel >= 5) {
      const hasGenuineExternal = cert.externalKernelMatrix.some(k => k.status === 'AVAILABLE' && !k.identity.isTestHarness);
      if (!hasGenuineExternal) {
        return this.invalid(`LEVEL ${cert.overallLevel} certification requires genuine external CAD kernel evidence`);
      }
    }

    // Rule: LEVEL 6 requires adversarial and tamper evidence
    if (cert.overallLevel === 6) {
      if (cert.adversarialResults.length === 0 || cert.tamperResults.length === 0) {
        return this.invalid('LEVEL 6 Forensic certification requires adversarial and tamper verification evidence');
      }
    }

    return {
      isValid: true,
      verdict: cert.overallVerdict,
      level: cert.overallLevel,
      reason: 'CAD Fidelity Certification verified and validated.',
      integrityVerified: true,
      claimsVerified: true,
      missingEvidence: [],
      mismatchedHashes: [],
      failedCapabilities: failedCaps.map(c => c.capability)
    };
  }

  /**
   * Generates a human-readable certification report.
   */
  public static generateReport(cert: CADFidelityCertification): string {
    const lines: string[] = [];
    lines.push('================================================================');
    lines.push('              SECP CAD FIDELITY CERTIFICATION                  ');
    lines.push('================================================================');
    lines.push(`Certification ID: ${cert.certificationId}`);
    lines.push(`Version:          ${cert.certificationVersion}`);
    lines.push(`Issued At:        ${cert.issuedAt}`);
    lines.push(`Valid Until:      ${cert.validUntil}`);
    lines.push('----------------------------------------------------------------');
    lines.push(`SECP Version:     ${cert.secpVersion}`);
    lines.push(`Kernel Version:   ${cert.kernelVersion}`);
    lines.push('----------------------------------------------------------------');
    lines.push('OVERALL VERDICT:  ' + cert.overallVerdict);
    lines.push('FIDELITY LEVEL:   ' + cert.overallLevel);
    lines.push('================================================================');
    lines.push('');
    lines.push('CAPABILITY RESULTS');
    lines.push('----------------------------------------------------------------');
    lines.push(sprintf('%-25s | %-12s | %-s', 'Capability', 'Status', 'Evidence'));
    lines.push('--------------------------|--------------|----------------------');
    
    cert.capabilities.forEach(c => {
      lines.push(sprintf('%-25s | %-12s | %-s', c.capability, c.status, c.evidenceReference));
    });

    lines.push('');
    lines.push('EXTERNAL KERNEL MATRIX');
    lines.push('----------------------------------------------------------------');
    cert.externalKernelMatrix.forEach(k => {
      lines.push(`Kernel: ${k.identity.vendor} ${k.identity.kernelName} v${k.identity.version} (${k.status})`);
    });

    lines.push('');
    lines.push('LIMITATIONS & DISCLOSURES');
    lines.push('----------------------------------------------------------------');
    const limitations = cert.capabilities.filter(c => c.status !== 'PROVEN');
    if (limitations.length === 0) {
      lines.push('No known limitations within certified scope.');
    } else {
      limitations.forEach(l => {
        lines.push(`- ${l.capability}: ${l.status}`);
        l.limitations.forEach(detail => lines.push(`  * ${detail}`));
      });
    }

    lines.push('');
    lines.push('================================================================');
    lines.push(`CANONICAL HASH: ${cert.canonicalHash}`);
    lines.push(`SIGNATURE:      ${cert.signature.signatureValue.substring(0, 32)}...`);
    lines.push('================================================================');

    return lines.join('\n');
  }

  private static invalid(reason: string): CertificationVerificationResult {
    return {
      isValid: false,
      verdict: 'INVALID',
      level: 0,
      reason,
      integrityVerified: false,
      claimsVerified: false,
      missingEvidence: [],
      mismatchedHashes: [],
      failedCapabilities: []
    };
  }
}

function sprintf(format: string, ...args: any[]): string {
  let i = 0;
  return format.replace(/%-?(\d+)?s/g, (match, width) => {
    let s = String(args[i++]);
    if (width) {
      const w = parseInt(width);
      if (match.startsWith('%-')) {
        return s.padEnd(w);
      } else {
        return s.padStart(w);
      }
    }
    return s;
  });
}
