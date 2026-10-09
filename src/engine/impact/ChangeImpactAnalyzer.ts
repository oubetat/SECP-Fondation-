import { 
  ChangeImpactAnalysis, 
  GraphSnapshot, 
  GraphSnapshotNode, 
  GraphSnapshotEdge, 
  ImpactNode, 
  ImpactEdge, 
  ImpactPath, 
  DependencyCycle, 
  ImpactAction, 
  UnknownDependency, 
  BrokenEdge, 
  EffectivityContext, 
  RelationshipType,
  ImpactClass,
  ImpactSeverity
} from './types';
import { ImpactCanonicalizer } from './ImpactCanonicalizer';
import { ImpactClassificationEngine } from './ImpactClassificationEngine';
import { ImpactSeverityEngine } from './ImpactSeverityEngine';

export interface AnalysisOptions {
  algorithmVersion?: string;
  policyVersion?: string;
  maxDepth?: number;
  isSafetyCritical?: boolean;
  targetConfiguration?: string;
  targetSerial?: string;
}

export class ChangeImpactAnalyzer {
  private snapshot: GraphSnapshot;
  private nodeMap: Map<string, GraphSnapshotNode> = new Map();
  private adjacency: Map<string, GraphSnapshotEdge[]> = new Map();
  private reverseAdjacency: Map<string, GraphSnapshotEdge[]> = new Map();

  constructor(snapshot: GraphSnapshot) {
    this.snapshot = snapshot;
    this.buildGraphIndex();
  }

  private buildGraphIndex() {
    this.nodeMap.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();

    for (const node of this.snapshot.nodes) {
      const key = `${node.entityId}:${node.revisionId}`;
      this.nodeMap.set(key, node);
      if (!this.nodeMap.has(node.entityId)) {
        // Fallback key by entityId for loose matching
        this.nodeMap.set(node.entityId, node);
      }
    }

    for (const edge of this.snapshot.edges) {
      if (!this.adjacency.has(edge.from)) {
        this.adjacency.set(edge.from, []);
      }
      this.adjacency.get(edge.from)!.push(edge);

      if (!this.reverseAdjacency.has(edge.to)) {
        this.reverseAdjacency.set(edge.to, []);
      }
      this.reverseAdjacency.get(edge.to)!.push(edge);
    }
  }

  public analyzeChange(
    ecoId: string,
    rootEntityIds: string[],
    rootRevisionIds: string[],
    options: AnalysisOptions = {}
  ): ChangeImpactAnalysis {
    const algorithmVersion = options.algorithmVersion || 'v1.0';
    const policyVersion = options.policyVersion || 'Policy v1.0';
    const maxDepth = options.maxDepth !== undefined ? options.maxDepth : 100;

    const analysisId = `IMPACT-${ecoId}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const graphHash = this.snapshot.graphSnapshotHash || ImpactCanonicalizer.computeGraphSnapshotHash(this.snapshot);

    const impactNodesMap = new Map<string, ImpactNode>();
    const impactEdgesList: ImpactEdge[] = [];
    const impactPathsList: ImpactPath[] = [];
    const cyclesList: DependencyCycle[] = [];
    const unknownDependencies: UnknownDependency[] = [];
    const brokenEdges: BrokenEdge[] = [];

    let isTruncated = false;

    // Process roots
    const queue: Array<{
      currentKey: string;
      distance: number;
      pathNodes: string[];
      pathEdges: string[];
    }> = [];

    const rootKeys: string[] = [];

    for (let i = 0; i < rootEntityIds.length; i++) {
      const entityId = rootEntityIds[i];
      const revId = rootRevisionIds[i] || 'R1';
      const rootKey = revId ? `${entityId}:${revId}` : entityId;

      rootKeys.push(rootKey);

      const existingNode = this.nodeMap.get(rootKey);
      if (!existingNode) {
        brokenEdges.push({
          edgeId: `ROOT-EDGE-${i}`,
          missingEntityId: rootKey
        });
        continue;
      }

      const rootImpactNode: ImpactNode = {
        nodeId: `NODE-${rootKey}`,
        entityId: existingNode.entityId,
        entityType: existingNode.entityType as any || 'PART',
        revisionId: existingNode.revisionId,
        sourceRevisionId: revId,
        impactClass: 'DIRECT',
        severity: options.isSafetyCritical ? 'CRITICAL' : 'HIGH',
        distance: 0,
        pathCount: 1,
        status: 'OPEN',
        isSafetyCritical: !!options.isSafetyCritical
      };

      impactNodesMap.set(rootKey, rootImpactNode);

      queue.push({
        currentKey: rootKey,
        distance: 0,
        pathNodes: [rootKey],
        pathEdges: []
      });
    }

    // Traversal (BFS) with Cycle Detection & Multi-Path Tracking
    const visitedInCurrentPath = new Set<string>();

    while (queue.length > 0) {
      const { currentKey, distance, pathNodes, pathEdges } = queue.shift()!;

      if (distance >= maxDepth) {
        isTruncated = true;
        continue;
      }

      // Find dependent incoming edges (reverse adjacency - who uses this node?)
      // or outgoing edges (who does this node affect?)
      const outgoingEdges = this.adjacency.get(currentKey) || [];
      const incomingEdges = this.reverseAdjacency.get(currentKey) || [];

      const allNeighborEdges = [...outgoingEdges, ...incomingEdges];

      for (const edge of allNeighborEdges) {
        const neighborKey = edge.from === currentKey ? edge.to : edge.from;

        // Broken edge check
        if (!this.nodeMap.has(neighborKey)) {
          brokenEdges.push({
            edgeId: edge.edgeId,
            missingEntityId: neighborKey
          });
          continue;
        }

        // Effectivity & Configuration filtering check
        if (options.targetConfiguration && edge.effectivity?.configuration) {
          if (edge.effectivity.configuration !== options.targetConfiguration) {
            // Configuration mismatch - skip propagation to unaffected variant
            continue;
          }
        }

        if (options.targetSerial && edge.effectivity?.startSerial && edge.effectivity?.endSerial) {
          const s = parseInt(options.targetSerial, 10);
          const start = parseInt(edge.effectivity.startSerial, 10);
          const end = parseInt(edge.effectivity.endSerial, 10);
          if (!isNaN(s) && !isNaN(start) && !isNaN(end)) {
            if (s < start || s > end) {
              // Serial out of range - skip
              continue;
            }
          }
        }

        // Cycle Detection
        if (pathNodes.includes(neighborKey)) {
          // Cycle found!
          const cycleStartIndex = pathNodes.indexOf(neighborKey);
          const cycleNodes = pathNodes.slice(cycleStartIndex);
          cycleNodes.push(neighborKey);
          const cycleEdges = pathEdges.slice(cycleStartIndex);
          cycleEdges.push(edge.edgeId);

          const cyclePathStr = cycleNodes.join(' -> ');
          const cycleHash = ImpactCanonicalizer.computeCycleHash(cycleNodes, cycleEdges);

          if (!cyclesList.some(c => c.cycleHash === cycleHash)) {
            cyclesList.push({
              cycleId: `CYCLE-${cyclesList.length + 1}`,
              cycleNodes,
              cycleEdges,
              cyclePath: cyclePathStr,
              cycleHash
            });
          }
          // Stop expanding this loop path
          continue;
        }

        // Record edge
        const impactEdge: ImpactEdge = {
          edgeId: edge.edgeId,
          fromNode: `NODE-${edge.from}`,
          toNode: `NODE-${edge.to}`,
          relationshipType: edge.type,
          relationshipId: edge.relationshipId || edge.edgeId,
          confidence: 1.0,
          evidenceId: `EVID-${edge.edgeId}`
        };

        if (!impactEdgesList.some(e => e.edgeId === edge.edgeId)) {
          impactEdgesList.push(impactEdge);
        }

        // Path tracking
        const newPathNodes = [...pathNodes, neighborKey];
        const newPathEdges = [...pathEdges, edge.edgeId];
        const pathId = `PATH-${newPathNodes.join('-')}`;

        impactPathsList.push({
          pathId,
          nodes: newPathNodes,
          edges: newPathEdges,
          description: `${pathNodes[0]} affected ${neighborKey} via ${edge.type}`
        });

        // Update or create target ImpactNode
        const nextDistance = distance + 1;
        const neighborSnapshotNode = this.nodeMap.get(neighborKey)!;

        let impactNode = impactNodesMap.get(neighborKey);
        if (impactNode) {
          // Multi-path hit! Increase path count, keep min distance
          impactNode.pathCount += 1;
          if (nextDistance < impactNode.distance) {
            impactNode.distance = nextDistance;
            impactNode.impactClass = ImpactClassificationEngine.classifyNode(
              nextDistance,
              edge.type,
              neighborSnapshotNode.entityType
            );
          }
        } else {
          const nodeImpactClass = ImpactClassificationEngine.classifyNode(
            nextDistance,
            edge.type,
            neighborSnapshotNode.entityType
          );

          const nodeSeverity = ImpactSeverityEngine.calculateSeverity(
            {
              distance: nextDistance,
              entityType: neighborSnapshotNode.entityType as any,
              isSafetyCritical: options.isSafetyCritical
            },
            edge.type,
            {
              policyVersion,
              isRootSafetyCritical: !!options.isSafetyCritical,
              configurationCount: options.targetConfiguration ? 1 : 2
            }
          );

          impactNode = {
            nodeId: `NODE-${neighborKey}`,
            entityId: neighborSnapshotNode.entityId,
            entityType: neighborSnapshotNode.entityType as any || 'PART',
            revisionId: neighborSnapshotNode.revisionId,
            impactClass: nodeImpactClass,
            severity: nodeSeverity,
            distance: nextDistance,
            pathCount: 1,
            status: 'OPEN',
            isSafetyCritical: !!options.isSafetyCritical
          };

          impactNodesMap.set(neighborKey, impactNode);

          // Enqueue for further traversal
          queue.push({
            currentKey: neighborKey,
            distance: nextDistance,
            pathNodes: newPathNodes,
            pathEdges: newPathEdges
          });
        }
      }
    }

    const affectedNodesList = Array.from(impactNodesMap.values());

    // Generate Required Actions
    const actions: ImpactAction[] = this.generateRequiredActions(affectedNodesList, impactEdgesList);

    // Compute Summary
    const summary = {
      directCount: affectedNodesList.filter(n => n.impactClass === 'DIRECT').length,
      indirectCount: affectedNodesList.filter(n => n.impactClass === 'INDIRECT').length,
      transitiveCount: affectedNodesList.filter(n => n.impactClass === 'TRANSITIVE').length,
      criticalCount: affectedNodesList.filter(n => n.severity === 'CRITICAL').length,
      reviewRequiredCount: affectedNodesList.filter(n => n.impactClass === 'REVIEW_REQUIRED').length,
      reverificationCount: affectedNodesList.filter(n => n.impactClass === 'REVERIFICATION_REQUIRED').length,
      invalidatedCount: affectedNodesList.filter(n => n.impactClass === 'INVALIDATED').length,
      unknownCount: unknownDependencies.length
    };

    // Determine Verdict dynamically
    let status: ChangeImpactAnalysis['status'] = 'COMPLETE';
    let verdict: ChangeImpactAnalysis['verdict'] = 'VALID';

    if (brokenEdges.length > 0 || cyclesList.some(c => c.cycleNodes.length === 0)) {
      status = 'FAILED';
      verdict = 'INVALID';
    } else if (unknownDependencies.length > 0 || isTruncated) {
      status = 'INCOMPLETE';
      verdict = 'INCOMPLETE';
    } else {
      status = 'COMPLETE';
      verdict = 'VALID';
    }

    const analysisObj: ChangeImpactAnalysis = {
      impactAnalysisId: analysisId,
      ecoId,
      analysisVersion: '1.0',
      rootChangeIds: rootEntityIds.map(id => `CHG-${id}`),
      rootEntityIds,
      rootRevisionIds,
      status,
      createdAt,
      createdBy: 'ENGINEERING-IMPACT-ENGINE',
      completedAt: new Date().toISOString(),
      algorithmVersion,
      policyVersion,
      graphSnapshotHash: graphHash,
      analysisHash: '',
      verdict,
      nodes: affectedNodesList,
      edges: impactEdgesList,
      paths: impactPathsList,
      cycles: cyclesList,
      actions,
      unknownDependencies,
      brokenEdges,
      isTruncated,
      summary
    };

    analysisObj.analysisHash = ImpactCanonicalizer.computeAnalysisHash(analysisObj);

    return analysisObj;
  }

  private generateRequiredActions(nodes: ImpactNode[], edges: ImpactEdge[]): ImpactAction[] {
    const actions: ImpactAction[] = [];
    let seq = 1;

    for (const node of nodes) {
      if (node.impactClass === 'DIRECT') {
        actions.push({
          actionId: `ACT-${seq}`,
          actionType: 'CREATE_REVISION',
          targetEntityId: node.entityId,
          targetRevisionId: node.revisionId,
          description: `Create new revision for root change on ${node.entityId}`,
          sequence: seq++,
          dependsOnActionIds: [],
          status: 'PENDING'
        });
      } else if (node.entityType === 'BOM') {
        actions.push({
          actionId: `ACT-${seq}`,
          actionType: 'UPDATE_BOM',
          targetEntityId: node.entityId,
          targetRevisionId: node.revisionId,
          description: `Update dependent BOM structure for ${node.entityId}`,
          sequence: seq++,
          dependsOnActionIds: ['ACT-1'],
          status: 'PENDING'
        });
      } else if (node.entityType === 'SIMULATION') {
        actions.push({
          actionId: `ACT-${seq}`,
          actionType: 'REVERIFY_CFD',
          targetEntityId: node.entityId,
          targetRevisionId: node.revisionId,
          description: `Re-run simulation verification for ${node.entityId}`,
          sequence: seq++,
          dependsOnActionIds: ['ACT-1'],
          status: 'PENDING'
        });
      } else if (node.entityType === 'TOOLPATH' || node.entityType === 'GCODE') {
        actions.push({
          actionId: `ACT-${seq}`,
          actionType: 'UPDATE_TOOLPATH',
          targetEntityId: node.entityId,
          targetRevisionId: node.revisionId,
          description: `Regenerate CAM toolpath and G-code for ${node.entityId}`,
          sequence: seq++,
          dependsOnActionIds: ['ACT-1'],
          status: 'PENDING'
        });
      }
    }

    return actions;
  }
}
