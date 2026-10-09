import * as crypto from 'crypto';
import { 
  GraphSnapshot, 
  ChangeImpactAnalysis, 
  ImpactNode, 
  ImpactEdge, 
  DependencyCycle, 
  ImpactAction 
} from './types';

export class ImpactCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => ImpactCanonicalizer.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const keyValues = keys.map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return `${JSON.stringify(key)}:${ImpactCanonicalizer.canonicalize(val)}`;
    }).filter(kv => kv !== null);

    return '{' + keyValues.join(',') + '}';
  }

  public static computeGraphSnapshotHash(snapshot: Partial<GraphSnapshot>): string {
    const sortedNodes = [...(snapshot.nodes || [])].sort((a, b) => 
      `${a.entityId}:${a.revisionId}`.localeCompare(`${b.entityId}:${b.revisionId}`)
    );
    const sortedEdges = [...(snapshot.edges || [])].sort((a, b) => 
      `${a.from}->${a.to}:${a.type}`.localeCompare(`${b.from}->${b.to}:${b.type}`)
    );

    const payload = {
      snapshotId: snapshot.snapshotId || '',
      snapshotVersion: snapshot.snapshotVersion || '1.0',
      nodes: sortedNodes.map(n => ({
        entityId: n.entityId,
        revisionId: n.revisionId,
        entityType: n.entityType,
        effectivity: n.effectivity || {}
      })),
      edges: sortedEdges.map(e => ({
        edgeId: e.edgeId,
        from: e.from,
        to: e.to,
        type: e.type,
        effectivity: e.effectivity || {}
      }))
    };

    return ImpactCanonicalizer.sha256(ImpactCanonicalizer.canonicalize(payload));
  }

  public static computeCycleHash(cycleNodes: string[], cycleEdges: string[]): string {
    const payload = {
      nodes: [...cycleNodes].sort(),
      edges: [...cycleEdges].sort()
    };
    return ImpactCanonicalizer.sha256(ImpactCanonicalizer.canonicalize(payload));
  }

  public static computeAnalysisHash(analysis: Partial<ChangeImpactAnalysis>): string {
    const sortedNodes = [...(analysis.nodes || [])].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
    const sortedEdges = [...(analysis.edges || [])].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    const sortedPaths = [...(analysis.paths || [])].sort((a, b) => a.pathId.localeCompare(b.pathId));
    const sortedCycles = [...(analysis.cycles || [])].sort((a, b) => a.cycleId.localeCompare(b.cycleId));
    const sortedActions = [...(analysis.actions || [])].sort((a, b) => a.actionId.localeCompare(b.actionId));

    const payload = {
      ecoId: analysis.ecoId || '',
      analysisVersion: analysis.analysisVersion || '1.0',
      algorithmVersion: analysis.algorithmVersion || 'v1.0',
      policyVersion: analysis.policyVersion || 'v1.0',
      graphSnapshotHash: analysis.graphSnapshotHash || '',
      rootChangeIds: [...(analysis.rootChangeIds || [])].sort(),
      rootEntityIds: [...(analysis.rootEntityIds || [])].sort(),
      rootRevisionIds: [...(analysis.rootRevisionIds || [])].sort(),
      verdict: analysis.verdict || 'INVALID',
      isTruncated: !!analysis.isTruncated,
      nodes: sortedNodes.map(n => ({
        nodeId: n.nodeId,
        entityId: n.entityId,
        revisionId: n.revisionId,
        impactClass: n.impactClass,
        severity: n.severity,
        distance: n.distance,
        pathCount: n.pathCount
      })),
      edges: sortedEdges.map(e => ({
        edgeId: e.edgeId,
        fromNode: e.fromNode,
        toNode: e.toNode,
        relationshipType: e.relationshipType
      })),
      paths: sortedPaths.map(p => ({
        pathId: p.pathId,
        nodes: p.nodes,
        edges: p.edges
      })),
      cycles: sortedCycles.map(c => ({
        cycleId: c.cycleId,
        cycleHash: c.cycleHash
      })),
      actions: sortedActions.map(a => ({
        actionId: a.actionId,
        actionType: a.actionType,
        targetEntityId: a.targetEntityId,
        targetRevisionId: a.targetRevisionId,
        sequence: a.sequence
      })),
      summary: analysis.summary || {}
    };

    return ImpactCanonicalizer.sha256(ImpactCanonicalizer.canonicalize(payload));
  }
}
