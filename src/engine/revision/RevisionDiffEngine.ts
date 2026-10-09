import { Revision, RevisionDiff } from './types';

export class RevisionDiffEngine {
  public static compare(revA: Revision, revB: Revision): RevisionDiff {
    const identityMatch = revA.entityId === revB.entityId;
    const contentMatch = revA.contentHash === revB.contentHash;
    const dependencyMatch = revA.dependencyHash === revB.dependencyHash;

    const differences: string[] = [];
    const semanticDetails: string[] = [];

    if (!identityMatch) {
      differences.push('IDENTITY_CHANGED');
      semanticDetails.push(`Entity ID mismatch: ${revA.entityId} vs ${revB.entityId}`);
    }

    if (!contentMatch) {
      differences.push('CONTENT_CHANGED');
      semanticDetails.push(`Content hash mismatch: ${revA.contentHash} vs ${revB.contentHash}`);
    }

    if (!dependencyMatch) {
      differences.push('DEPENDENCIES_CHANGED');
      semanticDetails.push(`Dependency hash mismatch: ${revA.dependencyHash} vs ${revB.dependencyHash}`);
    }

    return {
      identityMatch,
      contentMatch,
      dependencyMatch,
      differences,
      semanticDetails
    };
  }
}
