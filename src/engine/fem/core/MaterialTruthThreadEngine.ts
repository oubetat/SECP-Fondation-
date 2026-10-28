import { FEMModel } from "./FEMTypes";
import { FEMEvidenceEngine } from "./FEMEvidenceEngine";

export type ProvenanceCategory =
  | "INTENDED"
  | "PREDICTED"
  | "MANUFACTURED"
  | "MEASURED"
  | "AS_BUILT"
  | "DEVIATION_ANALYSIS"
  | "CONFORMANCE_DECISION";

export type NodeType =
  | "GEOMETRY"
  | "MATERIAL_DEFINITION"
  | "SPATIAL_FIELD"
  | "MANUFACTURING_PROFILE"
  | "MEASUREMENT_DATASET"
  | "AS_BUILT_STATE"
  | "DEVIATION_RESULT"
  | "CONFORMANCE_DECISION"
  | "EVIDENCE_PACKAGE";

export type EdgeType =
  | "DERIVED_FROM"
  | "USES_REVISION"
  | "MATERIALIZED_AS"
  | "MEASURED_FROM"
  | "REGISTERED_TO"
  | "RECONSTRUCTED_FROM"
  | "COMPARED_AGAINST"
  | "VERIFIED_BY"
  | "SUPPORTED_BY_EVIDENCE"
  | "INVALIDATED_BY_CHANGE";

export interface TruthThreadNode {
  nodeId: string;
  nodeType: NodeType;
  provenanceCategory: ProvenanceCategory;
  label: string;
  revision: string;
  contentHash: string;
  isValid: boolean;
  invalidationReason?: string;
  invalidatedByNodeId?: string;
  payload: any;
}

export interface TruthThreadEdge {
  edgeId: string;
  edgeType: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  createdTimestamp: string;
}

export interface MaterialTruthThread {
  threadId: string;
  modelId: string;
  geometryRevision: string;
  nodes: Map<string, TruthThreadNode>;
  edges: TruthThreadEdge[];
  threadHash: string;
  createdTimestamp: string;
  lastUpdatedTimestamp: string;
  graphValidationStatus:
    | "VALID"
    | "INVALIDATED"
    | "CORRUPTED_HASH"
    | "DANGLING_EDGES"
    | "CYCLE_DETECTED";
}

export interface GraphValidationResult {
  isValid: boolean;
  status:
    | "VALID"
    | "INVALIDATED"
    | "CORRUPTED_HASH"
    | "DANGLING_EDGES"
    | "CYCLE_DETECTED";
  errors: string[];
  danglingEdges: TruthThreadEdge[];
  corruptedNodes: string[];
  detectedCycles: string[][];
}

export class MaterialTruthThreadEngine {
  /**
   * Builds a deterministic Material Truth Thread DAG from canonical SECP FEMModel objects.
   * Enforces V9-ARCH-01 (Non-duplication) and V9-ARCH-02 (Strict Provenance Classification).
   */
  public static buildTruthThread(
    model: FEMModel,
    options?: { threadId?: string; modelId?: string }
  ): MaterialTruthThread {
    const threadId = options?.threadId || `MTT-${Date.now()}`;
    const modelId = options?.modelId || "MODEL-CANONICAL-001";
    const timestamp = new Date().toISOString();

    const nodes = new Map<string, TruthThreadNode>();
    const edges: TruthThreadEdge[] = [];

    // 1. Geometry Node
    const geomId = model.geometryMetadata?.geometryId || "GEOM-CANONICAL-001";
    const geomRev = model.geometryMetadata?.geometryRevision || "REV-1.0";
    const geomPayload = {
      geometryId: geomId,
      geometryRevision: geomRev,
      coordinateFrame: model.geometryMetadata?.coordinateFrame || {
        frameId: "GLOBAL_WORLD",
        type: "CARTESIAN",
        origin: [0, 0, 0],
      },
      nodeCount: model.nodes.size,
      elementCount: model.elements.size,
    };
    const geomHash = FEMEvidenceEngine.hashData(geomPayload);
    nodes.set(geomId, {
      nodeId: geomId,
      nodeType: "GEOMETRY",
      provenanceCategory: "INTENDED",
      label: `Canonical Geometry (${geomId})`,
      revision: geomRev,
      contentHash: geomHash,
      isValid: true,
      payload: geomPayload,
    });

    // 2. Material Definitions Node
    const matId = "MAT-DEF-CANONICAL";
    const matPayload = Array.from(model.materials.entries()).map(([k, v]) => ({
      key: k,
      materialId: v.materialId,
      E: v.E,
      nu: v.nu,
      density: v.density,
    }));
    const matHash = FEMEvidenceEngine.hashData(matPayload);
    nodes.set(matId, {
      nodeId: matId,
      nodeType: "MATERIAL_DEFINITION",
      provenanceCategory: "INTENDED",
      label: "Canonical Material Definitions",
      revision: geomRev,
      contentHash: matHash,
      isValid: true,
      payload: matPayload,
    });

    // Edge: Material Definition uses Geometry revision
    edges.push({
      edgeId: `EDGE-MAT-GEOM-${Date.now()}-1`,
      edgeType: "USES_REVISION",
      sourceNodeId: matId,
      targetNodeId: geomId,
      createdTimestamp: timestamp,
    });

    // 3. Spatial Material Fields
    if (model.spatialMaterialFields && model.spatialMaterialFields.size > 0) {
      for (const [fieldKey, field] of model.spatialMaterialFields.entries()) {
        const fieldNodeId = `FIELD-${field.fieldId || fieldKey}`;
        const fieldPayload = {
          fieldId: field.fieldId,
          propertyName: field.propertyName,
          baseValue: field.baseValue,
          evaluationMode: field.evaluationMode,
          revision: field.revision,
          fieldHash: typeof field.computeHash === "function" ? field.computeHash() : FEMEvidenceEngine.hashData(field),
        };
        const fieldHashVal = FEMEvidenceEngine.hashData(fieldPayload);
        nodes.set(fieldNodeId, {
          nodeId: fieldNodeId,
          nodeType: "SPATIAL_FIELD",
          provenanceCategory: "PREDICTED",
          label: `Spatial Material Field (${field.propertyName})`,
          revision: field.revision || geomRev,
          contentHash: fieldHashVal,
          isValid: true,
          payload: fieldPayload,
        });

        edges.push({
          edgeId: `EDGE-FIELD-MAT-${fieldNodeId}`,
          edgeType: "DERIVED_FROM",
          sourceNodeId: fieldNodeId,
          targetNodeId: matId,
          createdTimestamp: timestamp,
        });

        edges.push({
          edgeId: `EDGE-FIELD-GEOM-${fieldNodeId}`,
          edgeType: "USES_REVISION",
          sourceNodeId: fieldNodeId,
          targetNodeId: geomId,
          createdTimestamp: timestamp,
        });
      }
    }

    // 4. Manufacturing Constraint Profile Node
    if (model.manufacturingProfile) {
      const mfgId = `MFG-PROFILE-${model.manufacturingProfile.profileId || "001"}`;
      const mfgPayload = model.manufacturingProfile;
      const mfgHash = FEMEvidenceEngine.hashData(mfgPayload);
      nodes.set(mfgId, {
        nodeId: mfgId,
        nodeType: "MANUFACTURING_PROFILE",
        provenanceCategory: "MANUFACTURED",
        label: `Manufacturing Profile (${model.manufacturingProfile.processType})`,
        revision: geomRev,
        contentHash: mfgHash,
        isValid: true,
        payload: mfgPayload,
      });

      edges.push({
        edgeId: `EDGE-MFG-GEOM-${mfgId}`,
        edgeType: "USES_REVISION",
        sourceNodeId: mfgId,
        targetNodeId: geomId,
        createdTimestamp: timestamp,
      });
    }

    // 5. As-Built Material State Node
    if (model.asBuiltState) {
      const asBuiltId = model.asBuiltState.asBuiltStateId || "ASBUILT-STATE-001";
      const asBuiltPayload = model.asBuiltState;
      const asBuiltHash = FEMEvidenceEngine.hashData(asBuiltPayload);
      nodes.set(asBuiltId, {
        nodeId: asBuiltId,
        nodeType: "AS_BUILT_STATE",
        provenanceCategory: "AS_BUILT",
        label: `As-Built State (${model.asBuiltState.partInstanceId})`,
        revision: model.asBuiltState.geometryRevisionId || geomRev,
        contentHash: asBuiltHash,
        isValid: true,
        payload: asBuiltPayload,
      });

      edges.push({
        edgeId: `EDGE-ASBUILT-GEOM-${asBuiltId}`,
        edgeType: "REGISTERED_TO",
        sourceNodeId: asBuiltId,
        targetNodeId: geomId,
        createdTimestamp: timestamp,
      });

      // Measurement Dataset node if measurement dataset reference exists
      if (model.asBuiltState.measurementDatasetId) {
        const dsId = model.asBuiltState.measurementDatasetId;
        const dsPayload = {
          datasetId: dsId,
          measurementMethod: model.asBuiltState.measurementMethodId,
          pointCount: model.asBuiltState.reconstructedFields?.length || 0,
        };
        const dsHash = FEMEvidenceEngine.hashData(dsPayload);
        nodes.set(dsId, {
          nodeId: dsId,
          nodeType: "MEASUREMENT_DATASET",
          provenanceCategory: "MEASURED",
          label: `Measurement Dataset (${dsId})`,
          revision: geomRev,
          contentHash: dsHash,
          isValid: true,
          payload: dsPayload,
        });

        edges.push({
          edgeId: `EDGE-ASBUILT-DS-${asBuiltId}`,
          edgeType: "RECONSTRUCTED_FROM",
          sourceNodeId: asBuiltId,
          targetNodeId: dsId,
          createdTimestamp: timestamp,
        });
      }
    }

    // 6. Spatial Material Deviation Result Node
    if (model.deviationResult) {
      const devId = model.deviationResult.deviationId || "DEV-RESULT-001";
      const devPayload = model.deviationResult;
      const devHash = FEMEvidenceEngine.hashData(devPayload);
      nodes.set(devId, {
        nodeId: devId,
        nodeType: "DEVIATION_RESULT",
        provenanceCategory: "DEVIATION_ANALYSIS",
        label: `Spatial Deviation Analysis (${devId})`,
        revision: geomRev,
        contentHash: devHash,
        isValid: true,
        payload: devPayload,
      });

      // Edge to Intended field or Material Definition
      edges.push({
        edgeId: `EDGE-DEV-MAT-${devId}`,
        edgeType: "COMPARED_AGAINST",
        sourceNodeId: devId,
        targetNodeId: matId,
        createdTimestamp: timestamp,
      });

      // Edge to As-Built state if exists
      if (model.asBuiltState) {
        const asBuiltId = model.asBuiltState.asBuiltStateId || "ASBUILT-STATE-001";
        edges.push({
          edgeId: `EDGE-DEV-ASBUILT-${devId}`,
          edgeType: "COMPARED_AGAINST",
          sourceNodeId: devId,
          targetNodeId: asBuiltId,
          createdTimestamp: timestamp,
        });
      }

      // 7. Conformance Decision Node
      if (model.deviationResult.conformanceDecision) {
        const decId = `DECISION-${devId}`;
        const decPayload = model.deviationResult.conformanceDecision;
        const decHash = FEMEvidenceEngine.hashData(decPayload);
        nodes.set(decId, {
          nodeId: decId,
          nodeType: "CONFORMANCE_DECISION",
          provenanceCategory: "CONFORMANCE_DECISION",
          label: `Conformance Decision (${decPayload.verdict})`,
          revision: geomRev,
          contentHash: decHash,
          isValid: true,
          payload: decPayload,
        });

        edges.push({
          edgeId: `EDGE-DEC-DEV-${decId}`,
          edgeType: "VERIFIED_BY",
          sourceNodeId: decId,
          targetNodeId: devId,
          createdTimestamp: timestamp,
        });
      }
    }

    const thread: MaterialTruthThread = {
      threadId,
      modelId,
      geometryRevision: geomRev,
      nodes,
      edges,
      threadHash: "",
      createdTimestamp: timestamp,
      lastUpdatedTimestamp: timestamp,
      graphValidationStatus: "VALID",
    };

    thread.threadHash = this.computeThreadHash(thread);
    return thread;
  }

  /**
   * Validates graph invariants:
   * 1. No dangling references (DANGLING_EDGES)
   * 2. Content hash integrity (CORRUPTED_HASH)
   * 3. Acyclicity / DAG condition (CYCLE_DETECTED)
   * 4. Upstream invalidation status (INVALIDATED)
   */
  public static validateGraphIntegrity(thread: MaterialTruthThread): GraphValidationResult {
    const errors: string[] = [];
    const danglingEdges: TruthThreadEdge[] = [];
    const corruptedNodes: string[] = [];
    const detectedCycles: string[][] = [];

    // 1. Check Dangling References
    for (const edge of thread.edges) {
      const sourceExists = thread.nodes.has(edge.sourceNodeId);
      const targetExists = thread.nodes.has(edge.targetNodeId);
      if (!sourceExists || !targetExists) {
        danglingEdges.push(edge);
        if (!sourceExists) {
          errors.push(`Dangling edge source reference: ${edge.sourceNodeId} (edge ${edge.edgeId})`);
        }
        if (!targetExists) {
          errors.push(`Dangling edge target reference: ${edge.targetNodeId} (edge ${edge.edgeId})`);
        }
      }
    }

    // 2. Check Content Hashes
    for (const [nodeId, node] of thread.nodes.entries()) {
      const recomputedHash = FEMEvidenceEngine.hashData(node.payload);
      if (recomputedHash !== node.contentHash) {
        corruptedNodes.push(nodeId);
        errors.push(
          `Content hash corruption on node ${nodeId}: expected ${node.contentHash}, computed ${recomputedHash}`
        );
      }
    }

    // 3. Cycle Detection (DFS)
    const adj = new Map<string, string[]>();
    for (const nodeId of thread.nodes.keys()) {
      adj.set(nodeId, []);
    }
    for (const edge of thread.edges) {
      if (thread.nodes.has(edge.sourceNodeId) && thread.nodes.has(edge.targetNodeId)) {
        adj.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const currentPath: string[] = [];

    const dfsCycle = (curr: string) => {
      visited.add(curr);
      recStack.add(curr);
      currentPath.push(curr);

      const neighbors = adj.get(curr) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfsCycle(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleStartIndex = currentPath.indexOf(neighbor);
          const cyclePath = currentPath.slice(cycleStartIndex);
          cyclePath.push(neighbor);
          detectedCycles.push(cyclePath);
          errors.push(`Cycle detected in graph: ${cyclePath.join(" -> ")}`);
        }
      }

      currentPath.pop();
      recStack.delete(curr);
    };

    for (const nodeId of thread.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfsCycle(nodeId);
      }
    }

    // Determine status
    let status: GraphValidationResult["status"] = "VALID";
    if (danglingEdges.length > 0) {
      status = "DANGLING_EDGES";
    } else if (corruptedNodes.length > 0) {
      status = "CORRUPTED_HASH";
    } else if (detectedCycles.length > 0) {
      status = "CYCLE_DETECTED";
    } else {
      let hasInvalidNode = false;
      for (const node of thread.nodes.values()) {
        if (!node.isValid) {
          hasInvalidNode = true;
          break;
        }
      }
      if (hasInvalidNode) {
        status = "INVALIDATED";
      }
    }

    return {
      isValid: errors.length === 0 && status === "VALID",
      status,
      errors,
      danglingEdges,
      corruptedNodes,
      detectedCycles,
    };
  }

  /**
   * Propagates revision mutation downstream:
   * Any node that depends directly or transitively on mutatedNodeId is marked invalid.
   */
  public static propagateRevisionInvalidation(
    thread: MaterialTruthThread,
    mutatedNodeId: string,
    reason?: string
  ): MaterialTruthThread {
    const targetNode = thread.nodes.get(mutatedNodeId);
    if (!targetNode) {
      throw new Error(`Cannot invalidate non-existent node ID: ${mutatedNodeId}`);
    }

    const invalidationReason =
      reason || `Node ${mutatedNodeId} was explicitly mutated or invalidated.`;

    targetNode.isValid = false;
    targetNode.invalidationReason = invalidationReason;

    // Find all nodes that depend directly or transitively on mutatedNodeId.
    // Edge sourceNodeId -> targetNodeId means source depends on target.
    // So if target is mutated, source (and anything depending on source) must be invalidated.
    const reverseAdj = new Map<string, string[]>();
    for (const nodeId of thread.nodes.keys()) {
      reverseAdj.set(nodeId, []);
    }
    for (const edge of thread.edges) {
      // sourceNodeId depends on targetNodeId
      // So edge targetNodeId -> sourceNodeId in dependency propagation
      if (thread.nodes.has(edge.sourceNodeId) && thread.nodes.has(edge.targetNodeId)) {
        reverseAdj.get(edge.targetNodeId)?.push(edge.sourceNodeId);
      }
    }

    const queue: string[] = [mutatedNodeId];
    const visited = new Set<string>([mutatedNodeId]);

    const timestamp = new Date().toISOString();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = reverseAdj.get(current) || [];

      for (const depId of dependents) {
        if (!visited.has(depId)) {
          visited.add(depId);
          queue.push(depId);

          const depNode = thread.nodes.get(depId);
          if (depNode) {
            depNode.isValid = false;
            depNode.invalidatedByNodeId = mutatedNodeId;
            depNode.invalidationReason = `Cascading invalidation from mutated dependency node ${mutatedNodeId}`;

            // Add invalidation edge
            thread.edges.push({
              edgeId: `EDGE-INVALIDATED-${depId}-${mutatedNodeId}-${Date.now()}`,
              edgeType: "INVALIDATED_BY_CHANGE",
              sourceNodeId: depId,
              targetNodeId: mutatedNodeId,
              createdTimestamp: timestamp,
            });
          }
        }
      }
    }

    thread.lastUpdatedTimestamp = timestamp;
    thread.graphValidationStatus = "INVALIDATED";
    thread.threadHash = this.computeThreadHash(thread);

    return thread;
  }

  /**
   * Calculates Merkle thread hash over all canonical nodes and edges.
   */
  public static computeThreadHash(thread: MaterialTruthThread): string {
    const sortedNodeHashes = Array.from(thread.nodes.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => ({
        id,
        contentHash: n.contentHash,
        isValid: n.isValid,
        nodeType: n.nodeType,
        provenanceCategory: n.provenanceCategory,
      }));

    const sortedEdges = [...thread.edges].sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId)
    );

    return FEMEvidenceEngine.hashData({
      threadId: thread.threadId,
      modelId: thread.modelId,
      geometryRevision: thread.geometryRevision,
      nodes: sortedNodeHashes,
      edges: sortedEdges,
    });
  }
}
