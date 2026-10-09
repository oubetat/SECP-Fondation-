/**
 * SECP Engineering OS — Revision State Resolver
 * Phase 2 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Compares source document revision against domain solved/generated revisions.
 * - Computes truthful domain statuses (UP_TO_DATE, STALE, NOT_SOLVED) without manual strings.
 */

export interface DomainRevisionComparison {
  domain: 'FEM' | 'CFD' | 'CAM' | 'DRAWING' | 'BOM';
  status: 'UP_TO_DATE' | 'STALE' | 'NOT_SOLVED';
  sourceRevision: number;
  solvedRevision: number;
  isStale: boolean;
  deltaRevisions: number;
}

export class RevisionStateResolver {
  public static resolveDomainStatus(
    domain: 'FEM' | 'CFD' | 'CAM' | 'DRAWING' | 'BOM',
    sourceRevision: number,
    solvedRevision: number
  ): DomainRevisionComparison {
    const isUpToDate = solvedRevision === sourceRevision;
    const isNotSolved = solvedRevision === 0 || solvedRevision === undefined || solvedRevision === null;
    const isStale = !isUpToDate && !isNotSolved;

    let status: 'UP_TO_DATE' | 'STALE' | 'NOT_SOLVED' = 'UP_TO_DATE';
    if (isNotSolved) status = 'NOT_SOLVED';
    else if (isStale) status = 'STALE';

    return {
      domain,
      status,
      sourceRevision,
      solvedRevision: solvedRevision || 0,
      isStale,
      deltaRevisions: Math.abs(sourceRevision - (solvedRevision || 0))
    };
  }
}
