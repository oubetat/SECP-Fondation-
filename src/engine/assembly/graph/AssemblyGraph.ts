/**
 * PATCH-113: Assembly Graph Model
 * Primary deterministic engineering data structure for CAD Assemblies
 */

import {
  AssemblyNode,
  AssemblyOccurrence,
  AssemblyEdge,
  AssemblyConstraint,
  AssemblyInterface,
  AssemblyConfiguration,
  AssemblyKinematicJoint,
  PartDefinition,
  UnitSystemConfig,
  AssemblyLifecycleState,
  OccurrenceConfigurationState,
  AssemblyNodeType,
  AssemblyEdgeType,
  AssemblyProvenance,
  AssemblySnapshot,
  TransformDefinition
} from "./types";
import { TransformMatrix } from "./TransformMatrix";
import { AssemblyGraphCanonicalizer } from "./AssemblyGraphCanonicalizer";

export class AssemblyGraph {
  public assemblyId: string;
  public assemblyRevision: string;
  public name: string;
  public description?: string;
  public unitSystem: UnitSystemConfig;
  public lifecycleState: AssemblyLifecycleState;
  public rootOccurrenceId: string;
  public version: number = 1; // Optimistic locking counter
  public provenance: AssemblyProvenance;

  public nodes: Map<string, AssemblyNode> = new Map();
  public occurrences: Map<string, AssemblyOccurrence> = new Map();
  public partDefinitions: Map<string, PartDefinition> = new Map(); // Key: `${partId}:${partRevision}`
  public edges: Map<string, AssemblyEdge> = new Map();
  public constraints: Map<string, AssemblyConstraint> = new Map();
  public interfaces: Map<string, AssemblyInterface> = new Map();
  public joints: Map<string, AssemblyKinematicJoint> = new Map();
  public configurations: Map<string, AssemblyConfiguration> = new Map();
  public activeConfigurationId: string = "DEFAULT";

  constructor(params: {
    assemblyId: string;
    assemblyRevision?: string;
    name: string;
    description?: string;
    unitSystem?: UnitSystemConfig;
    lifecycleState?: AssemblyLifecycleState;
    provenance?: Partial<AssemblyProvenance>;
  }) {
    this.assemblyId = params.assemblyId;
    this.assemblyRevision = params.assemblyRevision || "R1.0";
    this.name = params.name;
    this.description = params.description;
    this.unitSystem = params.unitSystem || {
      unitSystem: "SI",
      lengthUnit: "mm",
      angleUnit: "deg",
      massUnit: "kg"
    };
    this.lifecycleState = params.lifecycleState || AssemblyLifecycleState.DRAFT;

    this.provenance = {
      createdBy: params.provenance?.createdBy || "SYSTEM_ENGINEER",
      createdAt: params.provenance?.createdAt || Date.now(),
      source: params.provenance?.source || "SECP_CAD_KERNEL",
      sourceRevision: params.provenance?.sourceRevision || "v2.0",
      parentRevision: params.provenance?.parentRevision,
      changeSetDescription: params.provenance?.changeSetDescription || "Initial assembly graph creation"
    };

    // Initialize Root Occurrence
    this.rootOccurrenceId = `OCC_${this.assemblyId}_ROOT`;
    const identityT = TransformMatrix.create(0, 0, 0, 0, 0, 0);

    const rootOcc: AssemblyOccurrence = {
      occurrenceId: this.rootOccurrenceId,
      name: `${this.name} Root`,
      nodeType: AssemblyNodeType.ROOT_ASSEMBLY,
      partId: this.assemblyId,
      partRevision: this.assemblyRevision,
      assemblyId: this.assemblyId,
      assemblyRevision: this.assemblyRevision,
      parentOccurrenceId: null,
      instancePath: this.assemblyId,
      localTransform: identityT,
      worldTransform: identityT,
      configurationState: OccurrenceConfigurationState.ACTIVE,
      lifecycleState: this.lifecycleState,
      geometryReference: {
        geometryId: `GEOM_${this.assemblyId}_ROOT`,
        geometryRevision: "1.0",
        geometryHash: "HASH_ROOT_000",
        topologyType: "SOLID"
      },
      isFixed: true
    };

    this.occurrences.set(this.rootOccurrenceId, rootOcc);

    const rootNode: AssemblyNode = {
      nodeId: `NODE_${this.rootOccurrenceId}`,
      nodeType: AssemblyNodeType.ROOT_ASSEMBLY,
      name: rootOcc.name,
      partId: this.assemblyId,
      partRevision: this.assemblyRevision,
      assemblyId: this.assemblyId,
      assemblyRevision: this.assemblyRevision,
      occurrenceId: this.rootOccurrenceId,
      parentOccurrenceId: null,
      configurationState: OccurrenceConfigurationState.ACTIVE,
      lifecycleState: this.lifecycleState,
      isLeaf: false
    };

    this.nodes.set(rootNode.nodeId, rootNode);

    // Initialize Default Configuration
    const defaultConfig: AssemblyConfiguration = {
      configurationId: "DEFAULT",
      name: "Default Configuration",
      description: "Baseline master configuration",
      isDefault: true,
      occurrenceStates: { [this.rootOccurrenceId]: OccurrenceConfigurationState.ACTIVE },
      parameterOverrides: {},
      suppressedConstraints: [],
      suppressedInterfaces: []
    };
    this.configurations.set("DEFAULT", defaultConfig);
  }

  /**
   * Register or Update Part Definition
   */
  public registerPartDefinition(part: PartDefinition): void {
    const key = `${part.partId}:${part.partRevision}`;
    this.partDefinitions.set(key, { ...part });
  }

  /**
   * Add a new Occurrence to the assembly graph
   */
  public addOccurrence(params: {
    occurrenceId: string;
    name: string;
    nodeType: AssemblyNodeType;
    partId: string;
    partRevision: string;
    parentOccurrenceId?: string;
    localTransform?: TransformDefinition;
    configurationState?: OccurrenceConfigurationState;
    geometryReference?: Partial<AssemblyOccurrence["geometryReference"]>;
    customParameters?: Record<string, any>;
    isFixed?: boolean;
  }): AssemblyOccurrence {
    const parentId = params.parentOccurrenceId || this.rootOccurrenceId;
    const parentOcc = this.occurrences.get(parentId);
    if (!parentOcc) {
      throw new Error(`Parent occurrence ${parentId} does not exist in assembly ${this.assemblyId}`);
    }

    const localT = params.localTransform || TransformMatrix.create(0, 0, 0, 0, 0, 0);
    const worldMatrix = TransformMatrix.multiply(parentOcc.worldTransform.matrix, localT.matrix);
    const worldT: TransformDefinition = {
      translation: TransformMatrix.extractTranslation(worldMatrix),
      matrix: worldMatrix
    };

    const instancePath = `${parentOcc.instancePath}/${params.occurrenceId}`;

    const occurrence: AssemblyOccurrence = {
      occurrenceId: params.occurrenceId,
      name: params.name,
      nodeType: params.nodeType,
      partId: params.partId,
      partRevision: params.partRevision,
      assemblyId: this.assemblyId,
      assemblyRevision: this.assemblyRevision,
      parentOccurrenceId: parentId,
      instancePath,
      localTransform: localT,
      worldTransform: worldT,
      configurationState: params.configurationState || OccurrenceConfigurationState.ACTIVE,
      lifecycleState: this.lifecycleState,
      geometryReference: {
        geometryId: params.geometryReference?.geometryId || `GEOM_${params.partId}`,
        geometryRevision: params.geometryReference?.geometryRevision || params.partRevision,
        geometryHash: params.geometryReference?.geometryHash || AssemblyGraphCanonicalizer.sha256(`GEOM:${params.partId}:${params.partRevision}`),
        topologyType: params.geometryReference?.topologyType || "SOLID",
        bRepModelRef: params.geometryReference?.bRepModelRef,
        nurbsRef: params.geometryReference?.nurbsRef
      },
      customParameters: params.customParameters,
      isFixed: params.isFixed ?? false
    };

    this.occurrences.set(occurrence.occurrenceId, occurrence);

    // Create Graph Node
    const nodeId = `NODE_${occurrence.occurrenceId}`;
    const node: AssemblyNode = {
      nodeId,
      nodeType: occurrence.nodeType,
      name: occurrence.name,
      partId: occurrence.partId,
      partRevision: occurrence.partRevision,
      assemblyId: this.assemblyId,
      assemblyRevision: this.assemblyRevision,
      occurrenceId: occurrence.occurrenceId,
      parentOccurrenceId: occurrence.parentOccurrenceId,
      geometryReference: occurrence.geometryReference,
      transformReference: occurrence.worldTransform,
      configurationState: occurrence.configurationState,
      lifecycleState: occurrence.lifecycleState,
      isLeaf: occurrence.nodeType === AssemblyNodeType.PART || occurrence.nodeType === AssemblyNodeType.FASTENER
    };
    this.nodes.set(nodeId, node);

    // Create Containment Edge: Parent -> Child
    const parentNodeId = `NODE_${parentId}`;
    const edgeId = `EDGE_CONTAINS_${parentOcc.occurrenceId}_TO_${occurrence.occurrenceId}`;
    const containsEdge: AssemblyEdge = {
      edgeId,
      sourceNodeId: parentNodeId,
      targetNodeId: nodeId,
      edgeType: AssemblyEdgeType.CONTAINS,
      edgeRevision: this.assemblyRevision,
      sourceOccurrenceId: parentId,
      targetOccurrenceId: occurrence.occurrenceId
    };
    this.edges.set(edgeId, containsEdge);

    // Create Instance-Of Edge: Occurrence -> PartDefinition (if known)
    const instanceOfEdgeId = `EDGE_INSTANCE_OF_${occurrence.occurrenceId}_TO_${params.partId}_${params.partRevision}`;
    const instanceOfEdge: AssemblyEdge = {
      edgeId: instanceOfEdgeId,
      sourceNodeId: nodeId,
      targetNodeId: `PART_DEF_${params.partId}_${params.partRevision}`,
      edgeType: AssemblyEdgeType.INSTANCE_OF,
      edgeRevision: this.assemblyRevision,
      sourceOccurrenceId: occurrence.occurrenceId,
      metadata: { partId: params.partId, partRevision: params.partRevision }
    };
    this.edges.set(instanceOfEdgeId, instanceOfEdge);

    // Update Default Configuration
    const defaultConfig = this.configurations.get("DEFAULT");
    if (defaultConfig) {
      defaultConfig.occurrenceStates[occurrence.occurrenceId] = occurrence.configurationState;
    }

    this.version++;
    return occurrence;
  }

  /**
   * Update occurrence transform or properties & recursively recompute world transforms
   */
  public updateOccurrence(
    occurrenceId: string,
    updates: Partial<Pick<AssemblyOccurrence, "name" | "localTransform" | "configurationState" | "lifecycleState" | "customParameters" | "isFixed">>
  ): AssemblyOccurrence {
    const occ = this.occurrences.get(occurrenceId);
    if (!occ) {
      throw new Error(`Occurrence ${occurrenceId} not found in assembly ${this.assemblyId}`);
    }

    if (updates.name !== undefined) occ.name = updates.name;
    if (updates.localTransform !== undefined) occ.localTransform = updates.localTransform;
    if (updates.configurationState !== undefined) occ.configurationState = updates.configurationState;
    if (updates.lifecycleState !== undefined) occ.lifecycleState = updates.lifecycleState;
    if (updates.customParameters !== undefined) occ.customParameters = updates.customParameters;
    if (updates.isFixed !== undefined) occ.isFixed = updates.isFixed;

    // Recalculate transforms throughout the tree
    this.recomputeWorldTransforms();
    this.version++;
    return occ;
  }

  /**
   * Delete an occurrence and its subtree
   */
  public deleteOccurrence(occurrenceId: string): string[] {
    if (occurrenceId === this.rootOccurrenceId) {
      throw new Error(`Cannot delete root occurrence ${occurrenceId}`);
    }

    const toDelete = new Set<string>();
    const gatherDescendants = (currId: string) => {
      toDelete.add(currId);
      for (const [id, o] of this.occurrences) {
        if (o.parentOccurrenceId === currId) {
          gatherDescendants(id);
        }
      }
    };

    gatherDescendants(occurrenceId);

    for (const delId of toDelete) {
      this.occurrences.delete(delId);
      this.nodes.delete(`NODE_${delId}`);

      // Delete associated edges
      for (const [edgeId, edge] of this.edges) {
        if (edge.sourceOccurrenceId === delId || edge.targetOccurrenceId === delId) {
          this.edges.delete(edgeId);
        }
      }

      // Delete associated constraints
      for (const [cId, c] of this.constraints) {
        if (c.sourceOccurrenceId === delId || c.targetOccurrenceId === delId) {
          this.constraints.delete(cId);
        }
      }

      // Delete associated interfaces
      for (const [iId, iface] of this.interfaces) {
        if (iface.sourceOccurrenceId === delId || iface.targetOccurrenceId === delId) {
          this.interfaces.delete(iId);
        }
      }
    }

    this.version++;
    return Array.from(toDelete);
  }

  /**
   * Recursively recomputes world transformations from root downwards
   */
  public recomputeWorldTransforms(): void {
    const rootOcc = this.occurrences.get(this.rootOccurrenceId);
    if (!rootOcc) return;

    const propagate = (parentOcc: AssemblyOccurrence) => {
      const children = Array.from(this.occurrences.values()).filter(o => o.parentOccurrenceId === parentOcc.occurrenceId);
      for (const child of children) {
        const worldMatrix = TransformMatrix.multiply(parentOcc.worldTransform.matrix, child.localTransform.matrix);
        child.worldTransform = {
          translation: TransformMatrix.extractTranslation(worldMatrix),
          matrix: worldMatrix
        };
        child.instancePath = `${parentOcc.instancePath}/${child.occurrenceId}`;

        const node = this.nodes.get(`NODE_${child.occurrenceId}`);
        if (node) {
          node.transformReference = child.worldTransform;
        }

        propagate(child);
      }
    };

    propagate(rootOcc);
  }

  /**
   * Add a geometric/engineering constraint
   */
  public addConstraint(constraint: AssemblyConstraint): void {
    this.constraints.set(constraint.constraintId, constraint);

    const edgeId = `EDGE_CONSTRAIN_${constraint.constraintId}`;
    const edge: AssemblyEdge = {
      edgeId,
      sourceNodeId: `NODE_${constraint.sourceOccurrenceId}`,
      targetNodeId: `NODE_${constraint.targetOccurrenceId}`,
      edgeType: AssemblyEdgeType.CONSTRAINS,
      edgeRevision: this.assemblyRevision,
      sourceOccurrenceId: constraint.sourceOccurrenceId,
      targetOccurrenceId: constraint.targetOccurrenceId,
      metadata: { constraintType: constraint.constraintType, constraintId: constraint.constraintId }
    };
    this.edges.set(edgeId, edge);

    this.version++;
  }

  /**
   * Add an Engineering Interface
   */
  public addInterface(iface: AssemblyInterface): void {
    this.interfaces.set(iface.interfaceId, iface);

    const edgeId = `EDGE_INTERFACE_${iface.interfaceId}`;
    const edge: AssemblyEdge = {
      edgeId,
      sourceNodeId: `NODE_${iface.sourceOccurrenceId}`,
      targetNodeId: `NODE_${iface.targetOccurrenceId}`,
      edgeType: AssemblyEdgeType.INTERFACES_WITH,
      edgeRevision: this.assemblyRevision,
      sourceOccurrenceId: iface.sourceOccurrenceId,
      targetOccurrenceId: iface.targetOccurrenceId,
      metadata: { interfaceType: iface.interfaceType, interfaceId: iface.interfaceId }
    };
    this.edges.set(edgeId, edge);

    this.version++;
  }

  /**
   * Add a Kinematic Joint
   */
  public addJoint(joint: AssemblyKinematicJoint): void {
    this.joints.set(joint.jointId, joint);
    this.version++;
  }

  /**
   * Add or Update Configuration
   */
  public setConfiguration(config: AssemblyConfiguration): void {
    this.configurations.set(config.configurationId, config);
    this.version++;
  }

  /**
   * Set active configuration
   */
  public setActiveConfiguration(configId: string): void {
    if (!this.configurations.has(configId)) {
      throw new Error(`Configuration ${configId} does not exist in assembly ${this.assemblyId}`);
    }
    this.activeConfigurationId = configId;
    const config = this.configurations.get(configId)!;

    for (const [occId, state] of Object.entries(config.occurrenceStates)) {
      const occ = this.occurrences.get(occId);
      if (occ) {
        occ.configurationState = state;
        const node = this.nodes.get(`NODE_${occId}`);
        if (node) node.configurationState = state;
      }
    }

    this.version++;
  }

  /**
   * Compute Deterministic Graph Hash & Fingerprint
   */
  public computeFingerprint(): { canonicalJson: string; graphHash: string; fingerprint: string } {
    return AssemblyGraphCanonicalizer.computeGraphHash({
      assemblyId: this.assemblyId,
      assemblyRevision: this.assemblyRevision,
      nodes: Array.from(this.nodes.values()),
      occurrences: Array.from(this.occurrences.values()),
      edges: Array.from(this.edges.values()),
      constraints: Array.from(this.constraints.values()),
      interfaces: Array.from(this.interfaces.values()),
      configurations: Array.from(this.configurations.values()),
      partDefinitions: Array.from(this.partDefinitions.values())
    });
  }

  /**
   * Create Immutable Forensic Snapshot
   */
  public createSnapshot(): AssemblySnapshot {
    const { graphHash, fingerprint } = this.computeFingerprint();
    return AssemblyGraphCanonicalizer.createForensicSnapshot(
      this.assemblyId,
      this.assemblyRevision,
      graphHash,
      fingerprint,
      this.nodes.size,
      this.edges.size,
      this.occurrences.size,
      this.activeConfigurationId
    );
  }

  /**
   * Clone graph for branch/revisioning
   */
  public clone(newRevision: string): AssemblyGraph {
    const cloned = new AssemblyGraph({
      assemblyId: this.assemblyId,
      assemblyRevision: newRevision,
      name: this.name,
      description: this.description,
      unitSystem: { ...this.unitSystem },
      lifecycleState: AssemblyLifecycleState.DRAFT,
      provenance: {
        createdBy: "SYSTEM_ENGINEER",
        createdAt: Date.now(),
        source: "BRANCH_OPERATION",
        sourceRevision: this.assemblyRevision,
        parentRevision: this.assemblyRevision,
        changeSetDescription: `Branched from ${this.assemblyRevision}`
      }
    });

    // Copy parts
    for (const [k, p] of this.partDefinitions) {
      cloned.partDefinitions.set(k, { ...p });
    }

    // Clear root from constructor to copy exact state
    cloned.occurrences.clear();
    cloned.nodes.clear();
    cloned.edges.clear();
    cloned.constraints.clear();
    cloned.interfaces.clear();
    cloned.joints.clear();
    cloned.configurations.clear();

    for (const [id, occ] of this.occurrences) {
      cloned.occurrences.set(id, {
        ...occ,
        assemblyRevision: newRevision,
        localTransform: { ...occ.localTransform, matrix: JSON.parse(JSON.stringify(occ.localTransform.matrix)) },
        worldTransform: { ...occ.worldTransform, matrix: JSON.parse(JSON.stringify(occ.worldTransform.matrix)) },
        geometryReference: { ...occ.geometryReference }
      });
    }

    for (const [id, node] of this.nodes) {
      cloned.nodes.set(id, { ...node, assemblyRevision: newRevision });
    }

    for (const [id, edge] of this.edges) {
      cloned.edges.set(id, { ...edge, edgeRevision: newRevision });
    }

    for (const [id, c] of this.constraints) {
      cloned.constraints.set(id, { ...c });
    }

    for (const [id, iface] of this.interfaces) {
      cloned.interfaces.set(id, { ...iface });
    }

    for (const [id, joint] of this.joints) {
      cloned.joints.set(id, { ...joint });
    }

    for (const [id, cfg] of this.configurations) {
      cloned.configurations.set(id, {
        ...cfg,
        occurrenceStates: { ...cfg.occurrenceStates },
        parameterOverrides: { ...cfg.parameterOverrides },
        suppressedConstraints: [...cfg.suppressedConstraints],
        suppressedInterfaces: [...cfg.suppressedInterfaces]
      });
    }

    cloned.rootOccurrenceId = this.rootOccurrenceId;
    cloned.activeConfigurationId = this.activeConfigurationId;
    return cloned;
  }
}
