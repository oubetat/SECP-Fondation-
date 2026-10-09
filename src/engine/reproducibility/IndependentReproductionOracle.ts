/**
 * SECP Industrial OS v3 — PATCH-183: Independent Reproduction Oracle
 * Independent certifying authority that audits original vs reproduced execution results,
 * verifies evidence integrity signatures, issues certificates, and handles revocation.
 */

import {
  ReproducibleEngineeringPackage,
  ReproducibilityCertificate,
  CertificationLevel,
  CertificationStatus,
  ComparisonMode,
  RevocationReason
} from './ReproducibilityTypes';
import { IndependentRunOutput } from './IndependentReproductionEngine';
import { ReproductionCompareEngine } from './ReproductionCompareEngine';
import { generateDeterministicHashSync } from '../../lib/hash';

export class IndependentReproductionOracle {
  private static revocationRegistry: Map<string, { reason: RevocationReason; timestamp: string }> = new Map();

  /**
   * Evaluates an independent reproduction execution and issues a formal Reproducibility Certificate.
   */
  public static certifyReproduction(
    originalPkg: ReproducibleEngineeringPackage,
    independentRun: IndependentRunOutput,
    desiredMode: ComparisonMode = 'STRICT'
  ): {
    certificate?: ReproducibilityCertificate;
    isCertified: boolean;
    certificationLevel: CertificationLevel;
    auditLogs: string[];
  } {
    const auditLogs: string[] = [];
    auditLogs.push(`[ORACLE AUDIT] Auditing Case ${originalPkg.manifest.caseId} (Package ${originalPkg.manifest.packageId})`);

    // 1. Check Package Integrity
    if (!independentRun.integrityCheckPassed) {
      auditLogs.push('[ORACLE REJECT] Package Integrity Check Failed');
      return {
        isCertified: false,
        certificationLevel: 'LEVEL_0_PACKAGE_INTEGRITY',
        auditLogs
      };
    }
    auditLogs.push('[ORACLE PASS] Level 0: Package Integrity Verified');

    // 2. Check Evidence Integrity
    let evidenceIntegrityPassed = true;
    for (const item of originalPkg.evidence.evidenceItems) {
      const expectedSig = `0x${generateDeterministicHashSync({ caseId: originalPkg.manifest.caseId, t: item.evidenceId })}`;
      if (item.cryptographicSignature !== expectedSig) {
        evidenceIntegrityPassed = false;
        auditLogs.push(`[ORACLE FAIL] Evidence Cryptographic Signature Mismatch for ${item.evidenceId}`);
        break;
      }
    }

    if (!evidenceIntegrityPassed) {
      return {
        isCertified: false,
        certificationLevel: 'LEVEL_0_PACKAGE_INTEGRITY',
        auditLogs
      };
    }
    auditLogs.push('[ORACLE PASS] Evidence Cryptographic Signatures Verified');

    // 3. Execute Comparison
    const compareReport = ReproductionCompareEngine.compare(originalPkg, independentRun, desiredMode);

    let level: CertificationLevel = 'LEVEL_0_PACKAGE_INTEGRITY';
    let isCertified = false;

    if (compareReport.overallMatch) {
      if (desiredMode === 'STRICT') {
        level = 'LEVEL_4_INDEPENDENT_CERTIFICATION';
        isCertified = true;
        auditLogs.push('[ORACLE CERTIFIED] Level 4: Full Bitwise Independent Certification Granted!');
      } else if (desiredMode === 'NUMERIC') {
        level = 'LEVEL_2_NUMERICAL_REPRODUCIBILITY';
        isCertified = true;
        auditLogs.push('[ORACLE CERTIFIED] Level 2: Numerical Reproducibility Certified!');
      } else if (desiredMode === 'ENGINEERING') {
        level = 'LEVEL_3_ENGINEERING_REPRODUCIBILITY';
        isCertified = true;
        auditLogs.push('[ORACLE CERTIFIED] Level 3: Engineering Threshold Reproducibility Certified!');
      }
    } else {
      auditLogs.push(`[ORACLE REJECT] Divergence detected in stage ${compareReport.divergence.divergenceStage ?? 'UNKNOWN'}`);
      if (compareReport.divergence.nodeOrElementId) {
        auditLogs.push(`[DIVERGENCE DETAILS] Node ${compareReport.divergence.nodeOrElementId}: Exp=${compareReport.divergence.expectedValue}, Act=${compareReport.divergence.actualValue}`);
      }
    }

    if (!isCertified) {
      return {
        isCertified: false,
        certificationLevel: level,
        auditLogs
      };
    }

    // 4. Issue Certificate
    const certId = `CERT-SECP183-${generateDeterministicHashSync({
      pkg: originalPkg.hashes.packageHash,
      res: independentRun.reproducedResult.resultHash,
      lvl: level,
      t: Date.now()
    }).substring(0, 12)}`;

    const merkleProofRoot = `0xMRK${generateDeterministicHashSync({
      p: originalPkg.hashes.packageHash,
      c: certId,
      l: level
    })}`;

    const signature = `0xSIG_ORACLE_${generateDeterministicHashSync({ certId, merkleProofRoot })}`;

    const certificate: ReproducibilityCertificate = {
      certificateId: certId,
      caseId: originalPkg.manifest.caseId,
      packageHash: originalPkg.hashes.packageHash,
      originalResultHash: originalPkg.result.resultHash,
      reproducedResultHash: independentRun.reproducedResult.resultHash,
      comparisonMode: desiredMode,
      certificationLevel: level,
      runtime: independentRun.reproducedRuntime.runtimeVersion,
      oracleVersion: 'IndependentReproductionOracle-v3.183',
      certificationTimestamp: new Date().toISOString(),
      certificationStatus: 'CERTIFIED',
      merkleProofRoot,
      signature
    };

    return {
      certificate,
      isCertified: true,
      certificationLevel: level,
      auditLogs
    };
  }

  /**
   * Revokes an existing certificate due to audit failures or discovered corruption.
   */
  public static revokeCertificate(
    certId: string,
    reason: RevocationReason
  ): { success: boolean; certId: string; status: CertificationStatus; timestamp: string } {
    const timestamp = new Date().toISOString();
    this.revocationRegistry.set(certId, { reason, timestamp });

    return {
      success: true,
      certId,
      status: 'REVOKED',
      timestamp
    };
  }

  /**
   * Queries if a certificate has been revoked.
   */
  public static isCertificateRevoked(certId: string): { isRevoked: boolean; reason?: RevocationReason } {
    const record = this.revocationRegistry.get(certId);
    if (record) {
      return { isRevoked: true, reason: record.reason };
    }
    return { isRevoked: false };
  }
}
