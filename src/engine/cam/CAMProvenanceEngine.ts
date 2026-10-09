import { generateDeterministicHash, generateDeterministicHashSync } from '../../lib/hash';
import {
  CanonicalDerivedArtifactBinding,
  DerivedArtifactBindingResult,
  DerivedArtifactVerificationResult
} from '../topology/CanonicalDerivedArtifactBinding';

export class CAMProvenanceEngine {
  public static async generateStructuralFingerprint(opConfig: any, verified: any, stockModel: any): Promise<any> {
    const hash = await generateDeterministicHash({ opConfig, verified, stockModel });
    return { fingerprint: hash };
  }

  public static async generateNCProvenanceChain(
    config: any,
    points: any[],
    machine: any,
    subsystems: any,
    cadRevisionHash?: string,
    canonicalGeometryHash?: string
  ): Promise<{
    provenanceId: string;
    trajectoryHash: string;
    machineHash: string;
    subsystemVerifications: any;
    timestamp: string;
    cadRevisionHash?: string;
    canonicalGeometryHash?: string;
    derivedArtifactBinding?: DerivedArtifactBindingResult;
  }> {
    const trajectoryHash = await generateDeterministicHash({
      op: config.operationId,
      pointCount: points.length,
      firstPoint: points[0],
      lastPoint: points[points.length - 1]
    });
    const machineHash = await generateDeterministicHash(machine);

    const revHash = cadRevisionHash || config?.cadRevisionHash || `REV_HASH_CAM_${config?.operationId || 'OP'}`;
    const geomHash = canonicalGeometryHash || config?.canonicalGeometryHash || trajectoryHash;

    const derivedArtifactBinding = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: revHash,
      canonicalGeometryHash: geomHash,
      artifactKind: 'CAM_TOOLPATH',
      derivationIdentity: 'generateNCProvenanceChain',
      artifactContentHash: trajectoryHash,
      operationId: config?.operationId || 'OP_01',
      trajectoryHash
    });

    return {
      provenanceId: `NC-PROV-${trajectoryHash.substring(0, 12)}`,
      trajectoryHash,
      machineHash,
      subsystemVerifications: subsystems,
      timestamp: new Date().toISOString(),
      cadRevisionHash: revHash,
      canonicalGeometryHash: geomHash,
      derivedArtifactBinding
    };
  }

  /**
   * Authority boundary verifier for NC provenance chains against target CAD revision.
   */
  public static verifyProvenanceChain(
    chain: { derivedArtifactBinding?: DerivedArtifactBindingResult; [key: string]: any },
    targetCadRevisionHash: string,
    targetGeometryHash?: string
  ): DerivedArtifactVerificationResult {
    if (!chain?.derivedArtifactBinding) {
      return {
        isValid: false,
        failureReason: 'UNBOUND',
        mismatchDetails: 'NCProvenanceChain lacks required derivedArtifactBinding'
      };
    }
    return CanonicalDerivedArtifactBinding.verifyBinding(
      chain.derivedArtifactBinding,
      targetCadRevisionHash,
      targetGeometryHash
    );
  }

  public static async issueTruthCertificate(
    provenance: any,
    operationId: string,
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): Promise<{ certificateId: string; operationId: string; signature: string; issuedAt: string }> {
    if (targetCadRevisionHash) {
      const verifyRes = this.verifyProvenanceChain(provenance, targetCadRevisionHash, targetGeometryHash);
      if (!verifyRes.isValid) {
        throw new Error(`[SECP CAM] Cannot issue Truth Certificate: Provenance derived binding rejected: ${verifyRes.failureReason}`);
      }
    }

    const signature = await generateDeterministicHash({ provenance, operationId });
    return {
      certificateId: `CERT-CAM-${signature.substring(0, 12)}`,
      operationId,
      signature,
      issuedAt: new Date().toISOString()
    };
  }
}
