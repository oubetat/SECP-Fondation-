import { Revision, RevisionEntityType } from './types';

export interface ImpactedItem {
  entityId: string;
  entityType: RevisionEntityType;
  revisionCode: string;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'STALE' | 'AFFECTED' | 'VALID';
}

export class RevisionImpactAnalyzer {
  
  /**
   * Evaluates the impact of a revision change across the entire registry of revisions.
   * If a PART/CAD model revision changes, we find all DRAWINGS, FEM_STUDIES, CFD_STUDIES, CAM_JOBS, and ASSEMBLIES
   * that depend on the old revision or target entity.
   */
  public static analyzeImpact(
    changedRev: Revision,
    allRevisions: Revision[]
  ): ImpactedItem[] {
    const impacted = new Map<string, ImpactedItem>();
    const processingQueue: Revision[] = [changedRev];
    const queued = new Set<string>();

    queued.add(`${changedRev.entityId}@${changedRev.revisionId}`);

    while (processingQueue.length > 0) {
      const current = processingQueue.shift()!;

      // Find all revisions that depend on this entity
      for (const rev of allRevisions) {
        if (rev.revisionId === current.revisionId) continue;
        const revKey = `${rev.entityId}@${rev.revisionId}`;

        const dependentLink = rev.dependencies.find(
          dep => dep.entityId === current.entityId &&
                 (dep.revisionId === current.revisionId || (current.parentRevisionId && dep.revisionId === current.parentRevisionId) || dep.revisionId === 'LATEST' || dep.isFloating)
        );

        if (dependentLink) {
          if (!impacted.has(revKey)) {
            let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
            let reason = '';
            let status: 'STALE' | 'AFFECTED' | 'VALID' = 'AFFECTED';

            // Assign severity and reasons based on engineering domain relationships
            if (rev.entityType === RevisionEntityType.DRAWING) {
              severity = 'HIGH';
              reason = `ASME drawing views and dimensions derive directly from ${current.entityId} geometries.`;
              status = 'STALE';
            } else if (rev.entityType === RevisionEntityType.FEM_STUDY) {
              severity = 'CRITICAL';
              reason = `FEA stress meshes, boundary conditions, and safety factor bounds simulate ${current.entityId}.`;
              status = 'STALE';
            } else if (rev.entityType === RevisionEntityType.CFD_STUDY) {
              severity = 'CRITICAL';
              reason = `CFD flow volumes and mesh partitions depend on the boundaries of ${current.entityId}.`;
              status = 'STALE';
            } else if (rev.entityType === RevisionEntityType.CAM_JOB) {
              severity = 'CRITICAL';
              reason = `CNC toolpath G-code and continuous cycles manufacture ${current.entityId}.`;
              status = 'STALE';
            } else if (rev.entityType === RevisionEntityType.ASSEMBLY) {
              severity = 'MEDIUM';
              reason = `Assembly structure contains component ${current.entityId}.`;
              status = 'AFFECTED';
            } else if (rev.entityType === RevisionEntityType.EVIDENCE) {
              severity = 'HIGH';
              reason = `Evidence package was generated for an older state of ${current.entityId}.`;
              status = 'STALE';
            } else {
              reason = `Downstream dependency on ${current.entityId}`;
              status = 'AFFECTED';
            }

            impacted.set(revKey, {
              entityId: rev.entityId,
              entityType: rev.entityType,
              revisionCode: rev.revisionCode,
              reason,
              severity,
              status
            });
          }

          // Propagate impact downstream if not already in processing queue
          if (!queued.has(revKey)) {
            queued.add(revKey);
            processingQueue.push(rev);
          }
        }
      }
    }

    return Array.from(impacted.values());
  }
}
