import { ReleaseEvidenceRecord } from './ManufacturingReleaseTypes';

export class ReleaseEvidenceEngine {
  public static registerEvidence(params: {
    sourceBaselineId: string;
    evidenceType: string;
    contentHash: string;
    verifiedBy: string;
  }): ReleaseEvidenceRecord {
    if (params.contentHash.length < 32) {
      throw new Error('Evidence Error: Hash length validation failed. Minimum 32 characters required.');
    }

    if (params.verifiedBy.length < 3) {
      throw new Error('Evidence Error: Signer validation failed. Minimum 3 characters required.');
    }

    const evidenceId = `evid-secp-060-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    return {
      evidenceId,
      sourceBaselineId: params.sourceBaselineId,
      evidenceType: params.evidenceType,
      contentHash: params.contentHash,
      verifiedBy: params.verifiedBy,
      timestamp
    };
  }
}
