import { Revision } from './types';

export interface IntegrityError {
  field: string;
  message: string;
}

export interface IntegrityReport {
  isValid: boolean;
  errors: IntegrityError[];
}

export class RevisionIntegrityChecker {
  public static verifyRevision(revision: Revision, allRevisions: Revision[]): IntegrityReport {
    const errors: IntegrityError[] = [];

    // 1. Lineage Linkage check: if there is a parent revision, it must exist in database
    if (revision.parentRevisionId) {
      const parentExists = allRevisions.some(r => r.revisionId === revision.parentRevisionId);
      if (!parentExists) {
        errors.push({
          field: 'parentRevisionId',
          message: `Parent revision '${revision.parentRevisionId}' does not exist.`
        });
      }
    }

    // 2. Check for dependency cycle
    if (this.hasDependencyCycle(revision, allRevisions)) {
      errors.push({
        field: 'dependencies',
        message: 'A dependency cycle has been detected.'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static hasDependencyCycle(
    revision: Revision,
    allRevisions: Revision[],
    visited: Set<string> = new Set()
  ): boolean {
    if (visited.has(revision.revisionId)) {
      return true;
    }
    visited.add(revision.revisionId);

    for (const dep of revision.dependencies) {
      const depRev = allRevisions.find(r => r.revisionId === dep.revisionId);
      if (depRev) {
        if (this.hasDependencyCycle(depRev, allRevisions, new Set(visited))) {
          return true;
        }
      }
    }

    return false;
  }
}
