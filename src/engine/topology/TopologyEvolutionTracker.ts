import {
  PersistentTopologyIdentity,
  TopologyReference,
  TopologyEvolutionStatus,
  TopologyEvolutionRecord,
  GeometricSignature
} from './PersistentTopologyTypes';

export interface HealingResult {
  status: TopologyEvolutionStatus;
  resolvedPersistentId?: string;
  resolvedIdentity?: PersistentTopologyIdentity;
  message: string;
  healingRecord?: TopologyEvolutionRecord;
}

export class TopologyEvolutionTracker {
  private evolutionHistory: TopologyEvolutionRecord[] = [];

  /**
   * Resolve and heal a topological reference against new model topology.
   */
  public resolveAndHealReference(
    reference: TopologyReference,
    currentTopology: PersistentTopologyIdentity[]
  ): HealingResult {
    const targetId = reference.persistentId;

    // 1. Exact Persistent ID Match
    const exactMatch = currentTopology.find(t => t.persistentId === targetId);
    if (exactMatch) {
      const isGeomIdentical = this.isSignatureIdentical(reference.expectedSignature, exactMatch.geometricSignature);
      const status: TopologyEvolutionStatus = isGeomIdentical ? 'UNCHANGED' : 'REFERENCE_CHANGED';

      const res: HealingResult = {
        status,
        resolvedPersistentId: exactMatch.persistentId,
        resolvedIdentity: exactMatch,
        message: status === 'UNCHANGED'
          ? `Topological reference '${targetId}' perfectly resolved (UNCHANGED).`
          : `Topological reference '${targetId}' resolved with geometric shift (REFERENCE_CHANGED).`
      };
      reference.currentStatus = status;
      reference.resolvedEntityId = exactMatch.persistentId;
      return res;
    }

    // 2. Parent-Child Lineage Match (REFERENCE_REPLACED or REFERENCE_SPLIT)
    const childMatches = currentTopology.filter(t => t.parentPersistentIds.includes(targetId));

    if (childMatches.length === 1) {
      const child = childMatches[0];
      const record: TopologyEvolutionRecord = {
        oldPersistentId: targetId,
        newPersistentIds: [child.persistentId],
        evolutionType: 'REFERENCE_REPLACED',
        reason: `Reference '${targetId}' replaced by child entity '${child.persistentId}'.`,
        timestamp: new Date().toISOString()
      };
      this.evolutionHistory.push(record);

      reference.currentStatus = 'REFERENCE_REPLACED';
      reference.resolvedEntityId = child.persistentId;

      return {
        status: 'REFERENCE_REPLACED',
        resolvedPersistentId: child.persistentId,
        resolvedIdentity: child,
        message: record.reason,
        healingRecord: record
      };
    } else if (childMatches.length > 1) {
      const newIds = childMatches.map(c => c.persistentId);
      const record: TopologyEvolutionRecord = {
        oldPersistentId: targetId,
        newPersistentIds: newIds,
        evolutionType: 'REFERENCE_SPLIT',
        reason: `Reference '${targetId}' split into ${childMatches.length} entities: [${newIds.join(', ')}].`,
        timestamp: new Date().toISOString()
      };
      this.evolutionHistory.push(record);

      reference.currentStatus = 'REFERENCE_SPLIT';
      reference.resolvedEntityId = childMatches[0].persistentId; // Primary split candidate

      return {
        status: 'REFERENCE_SPLIT',
        resolvedPersistentId: childMatches[0].persistentId,
        resolvedIdentity: childMatches[0],
        message: record.reason,
        healingRecord: record
      };
    }

    // 3. Semantic Tag & Entity Type Fallback Match (REFERENCE_MERGED or REFERENCE_CHANGED)
    const semanticMatch = currentTopology.find(t =>
      t.entityType === reference.entityType &&
      t.semanticTag === this.extractSemanticTag(targetId)
    );

    if (semanticMatch) {
      const record: TopologyEvolutionRecord = {
        oldPersistentId: targetId,
        newPersistentIds: [semanticMatch.persistentId],
        evolutionType: 'REFERENCE_CHANGED',
        reason: `Reference '${targetId}' healed via semantic tag match to '${semanticMatch.persistentId}'.`,
        timestamp: new Date().toISOString()
      };
      this.evolutionHistory.push(record);

      reference.currentStatus = 'REFERENCE_CHANGED';
      reference.resolvedEntityId = semanticMatch.persistentId;

      return {
        status: 'REFERENCE_CHANGED',
        resolvedPersistentId: semanticMatch.persistentId,
        resolvedIdentity: semanticMatch,
        message: record.reason,
        healingRecord: record
      };
    }

    // 4. Deleted or Unresolved Reference
    const record: TopologyEvolutionRecord = {
      oldPersistentId: targetId,
      newPersistentIds: [],
      evolutionType: 'REFERENCE_DELETED',
      reason: `Topological reference '${targetId}' no longer exists in current topology.`,
      timestamp: new Date().toISOString()
    };
    this.evolutionHistory.push(record);

    reference.currentStatus = 'REFERENCE_DELETED';

    return {
      status: 'REFERENCE_DELETED',
      message: record.reason,
      healingRecord: record
    };
  }

  /**
   * Track evolution across full old vs new topology maps.
   */
  public trackTopologyEvolution(
    oldTopology: PersistentTopologyIdentity[],
    newTopology: PersistentTopologyIdentity[]
  ): TopologyEvolutionRecord[] {
    const records: TopologyEvolutionRecord[] = [];

    const newMap = new Map(newTopology.map(t => [t.persistentId, t]));

    for (const oldEnt of oldTopology) {
      if (!newMap.has(oldEnt.persistentId)) {
        // Find if child exists
        const children = newTopology.filter(t => t.parentPersistentIds.includes(oldEnt.persistentId));
        if (children.length > 0) {
          records.push({
            oldPersistentId: oldEnt.persistentId,
            newPersistentIds: children.map(c => c.persistentId),
            evolutionType: children.length === 1 ? 'REFERENCE_REPLACED' : 'REFERENCE_SPLIT',
            reason: `Evolved into ${children.length} entities`,
            timestamp: new Date().toISOString()
          });
        } else {
          records.push({
            oldPersistentId: oldEnt.persistentId,
            newPersistentIds: [],
            evolutionType: 'REFERENCE_DELETED',
            reason: 'Deleted in new topology',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    return records;
  }

  public getEvolutionHistory(): TopologyEvolutionRecord[] {
    return this.evolutionHistory;
  }

  private isSignatureIdentical(a: GeometricSignature, b: GeometricSignature): boolean {
    const dist = Math.hypot(
      a.centroid.x - b.centroid.x,
      a.centroid.y - b.centroid.y,
      a.centroid.z - b.centroid.z
    );
    const measureDiff = Math.abs(a.measure - b.measure);
    return dist < 1e-4 && measureDiff < 1e-4;
  }

  private extractSemanticTag(persistentId: string): string {
    const parts = persistentId.split('/');
    return parts[parts.length - 1] || persistentId;
  }
}
