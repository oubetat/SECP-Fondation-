/**
 * PATCH-SECP-064: Release Package Engine
 * Compiles a self-contained, auditable documentation package containing certificates,
 * registered evidence nodes, and formal deviation approval listings for delivery or archive.
 */

import { ReleasePackage, ManufacturingReleaseCertificate, ReleaseEvidenceRecord, DeviationApproval } from './ManufacturingReleaseTypes';

export class ReleasePackageEngine {
  /**
   * Generates a fully compiled, sealed Release Package
   */
  public static compilePackage(
    certificate: ManufacturingReleaseCertificate,
    evidenceItems: ReleaseEvidenceRecord[],
    deviationApprovals: DeviationApproval[]
  ): ReleasePackage {
    const packageId = `pkg-release-${certificate.releaseId}`;
    const timestamp = new Date().toISOString();

    // Map evidence and deviation paths to form the primary trace hashes array
    const digitalThreadTraceHashes = [
      certificate.certificateHash,
      certificate.evidenceRootHash,
      ...evidenceItems.map(item => item.contentHash),
      ...deviationApprovals.map(dev => dev.signatureHash)
    ];

    return {
      packageId,
      timestamp,
      certificate,
      evidenceItems: [...evidenceItems],
      deviationApprovals: [...deviationApprovals],
      digitalThreadTraceHashes
    };
  }
}
