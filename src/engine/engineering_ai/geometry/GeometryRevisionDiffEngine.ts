import {
  GeometryEntityDescriptor,
  GeometryContext,
  GeometryChangeEvidence,
  GeometryChangeRecord,
  ChangeType
} from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export class GeometryRevisionDiffEngine {
  public static compareRevisions(
    revAContext: GeometryContext,
    revAEntities: GeometryEntityDescriptor[],
    revBContext: GeometryContext,
    revBEntities: GeometryEntityDescriptor[]
  ): GeometryChangeEvidence {
    const changes: GeometryChangeRecord[] = [];

    const mapA = new Map(revAEntities.map((e) => [e.entityId, e]));
    const mapB = new Map(revBEntities.map((e) => [e.entityId, e]));

    // Check for added entities in Revision B
    for (const [idB, entB] of Array.from(mapB.entries())) {
      if (!mapA.has(idB)) {
        changes.push({
          entityId: idB,
          changeType: 'ADDED_FEATURE',
          newValue: entB.parameters,
          details: `Entity ${idB} (${entB.geometryType}) added in revision ${revBContext.geometryRevision}`
        });
      }
    }

    // Check for removed or modified entities from Revision A
    for (const [idA, entA] of Array.from(mapA.entries())) {
      if (!mapB.has(idA)) {
        changes.push({
          entityId: idA,
          changeType: 'REMOVED_FEATURE',
          oldValue: entA.parameters,
          details: `Entity ${idA} removed in revision ${revBContext.geometryRevision}`
        });
      } else {
        const entB = mapB.get(idA)!;
        if (entA.hash !== entB.hash) {
          // Check if parameters changed or geometry type changed
          const paramsChanged = JSON.stringify(entA.parameters) !== JSON.stringify(entB.parameters);
          const typeChanged = entA.geometryType !== entB.geometryType;

          let changeType: ChangeType = 'PARAMETRIC';
          if (typeChanged) changeType = 'TOPOLOGICAL';
          else if (paramsChanged) changeType = 'PARAMETRIC';

          changes.push({
            entityId: idA,
            changeType,
            oldValue: entA.parameters,
            newValue: entB.parameters,
            details: `Entity ${idA} modified: ${changeType} difference detected`
          });
        }
      }
    }

    let overallChangeType: ChangeType = 'GEOMETRIC';
    if (changes.some((c) => c.changeType === 'ADDED_FEATURE' || c.changeType === 'REMOVED_FEATURE')) {
      overallChangeType = 'TOPOLOGICAL';
    } else if (changes.some((c) => c.changeType === 'PARAMETRIC')) {
      overallChangeType = 'PARAMETRIC';
    }

    const kernelComp = revAContext.geometryHash === revBContext.geometryHash ? 'MATCH' : 'MODIFIED';

    const rawEvidence: Omit<GeometryChangeEvidence, 'evidenceHash'> = {
      changeEvidenceId: `CHG-EVID-${Date.now()}`,
      oldGeometryHash: revAContext.geometryHash,
      newGeometryHash: revBContext.geometryHash,
      changedEntities: changes,
      changeType: overallChangeType,
      kernelComparison: kernelComp
    };

    const evidenceHash = CanonicalGeometrySerializer.computeChangeEvidenceHash(rawEvidence);

    return {
      ...rawEvidence,
      evidenceHash
    };
  }
}
