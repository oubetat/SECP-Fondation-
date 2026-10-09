/**
 * SECP Industrial OS v2 — CAM Provenance Engine Core
 * Orchestrates Contract, Graph, Impact, Timeline, Reconstruction, and API Layer
 */

import { 
  CAMProvenanceContract, 
  RootArtifactIdentity, 
  CAMArtifactIdentity, 
  CAMArtifactType, 
  ProvenanceEdgeType, 
  AgentType, 
  AgentIdentity, 
  ArtifactLifecycleStatus, 
  ProvenanceNode, 
  ProvenanceEdge, 
  CAMEnvironmentFingerprint, 
  ApprovalRecord, 
  ProvenanceVerdict, 
  ForensicQueryResponse,
  ParameterSource,
  ParameterProvenance
} from "./types";
import { CanonicalizationEngine } from "./CanonicalizationEngine";
import { CAMProvenanceGraphEngine } from "./CAMProvenanceGraph";
import { CAMProvenanceImpactEngine } from "./CAMProvenanceImpactEngine";
import { CAMProvenanceTimelineEngine } from "./CAMProvenanceTimeline";
import { CAMProvenanceReconstructionEngine } from "./CAMProvenanceReconstructionEngine";
import { CAMProvenanceDiffEngine } from "./CAMProvenanceDiffEngine";

export class CAMProvenanceEngine {
  private contract: CAMProvenanceContract;
  private rootIdentity: RootArtifactIdentity;
  private graph: CAMProvenanceGraphEngine;
  private timeline: CAMProvenanceTimelineEngine;
  private impactEngine: CAMProvenanceImpactEngine;
  private reconstructionEngine: CAMProvenanceReconstructionEngine;
  private approvals: Map<string, ApprovalRecord> = new Map();
  private environmentFingerprint: CAMEnvironmentFingerprint;

  constructor(
    contract: CAMProvenanceContract,
    rootIdentity: RootArtifactIdentity
  ) {
    this.contract = contract;
    this.rootIdentity = rootIdentity;
    this.graph = new CAMProvenanceGraphEngine();
    this.timeline = new CAMProvenanceTimelineEngine();
    this.impactEngine = new CAMProvenanceImpactEngine(this.graph);
    this.reconstructionEngine = new CAMProvenanceReconstructionEngine(this.graph);

    this.environmentFingerprint = {
      camEngineHash: CanonicalizationEngine.computeRawHash("SECP_CAM_ENGINE_2026_V2"),
      geometryKernelHash: CanonicalizationEngine.computeRawHash("OPENCASCADE_7.8.0"),
      simulationEngineHash: CanonicalizationEngine.computeRawHash("PATCH_109_SIMULATOR"),
      postProcessorHash: CanonicalizationEngine.computeRawHash("PATCH_107_POST_ENGINE"),
      dependencyLockHash: CanonicalizationEngine.computeRawHash("LOCK_2026_PROD"),
      configurationHash: CanonicalizationEngine.computeRawHash("CONFIG_STRICT_PROVENANCE"),
      os: "Linux 6.6.0-cloud-run",
      runtime: "Node.js 22.x / TS 5.8"
    };

    // Register Root Artifact Node
    this.registerRootNode();
  }

  private registerRootNode(): void {
    const rootNode: ProvenanceNode = {
      identity: {
        artifactId: this.rootIdentity.rootArtifactId,
        artifactType: this.rootIdentity.rootArtifactType,
        artifactRevision: this.rootIdentity.rootRevision,
        artifactFingerprint: this.rootIdentity.rootFingerprint,
        createdAt: this.rootIdentity.createdAt,
        createdBy: "CAD_SYSTEM_AUTHOR",
        sourceSystem: "SECP_CAD_INTEGRATION"
      },
      revision: {
        revisionId: `REV_${this.rootIdentity.rootArtifactId}_1`,
        revisionNumber: 1,
        revisionFingerprint: this.rootIdentity.rootFingerprint,
        changeReason: "Initial CAD Engineering Release",
        status: ArtifactLifecycleStatus.PUBLISHED
      },
      payload: {
        content: { modelName: "AEROSPACE_BRACKET_CAD", geometryHash: this.rootIdentity.rootFingerprint },
        metadata: { author: "Lead CAD Engineer", project: this.contract.projectId },
        configuration: { units: "mm", tolerance: 0.001 }
      },
      contentHash: this.rootIdentity.rootFingerprint,
      metadataHash: CanonicalizationEngine.computeHash({ project: this.contract.projectId }),
      agent: {
        agentType: AgentType.HUMAN,
        agentId: "USER_ENG_01",
        agentRevision: "1.0",
        authorId: "USER_ENG_01",
        role: "CAD_ENGINEER"
      },
      status: ArtifactLifecycleStatus.PUBLISHED,
      isRoot: true
    };

    this.graph.addNode(rootNode);
    this.timeline.appendEvent(
      rootNode.identity.artifactId,
      "REGISTER_ROOT_CAD",
      rootNode.agent,
      rootNode.payload
    );
  }

  /**
   * Register a new CAM Artifact along the provenance chain with parent dependency edges
   */
  public registerArtifact(
    identity: CAMArtifactIdentity,
    parentArtifactIds: string[],
    edgeType: ProvenanceEdgeType,
    payload: { content: any; metadata: any; configuration: any },
    agent: AgentIdentity,
    changeReason: string = "Derived engineering artifact creation"
  ): ProvenanceNode {
    const contentHash = CanonicalizationEngine.computeHash(payload.content);
    const metadataHash = CanonicalizationEngine.computeHash(payload.metadata);

    const node: ProvenanceNode = {
      identity,
      revision: {
        revisionId: `REV_${identity.artifactId}_1`,
        revisionNumber: 1,
        revisionFingerprint: identity.artifactFingerprint,
        changeReason,
        status: agent.agentType === AgentType.AI_ENGINE 
          ? ArtifactLifecycleStatus.AI_GENERATED 
          : ArtifactLifecycleStatus.PUBLISHED
      },
      payload,
      contentHash,
      metadataHash,
      agent,
      status: agent.agentType === AgentType.AI_ENGINE 
        ? ArtifactLifecycleStatus.AI_GENERATED 
        : ArtifactLifecycleStatus.PUBLISHED,
      isRoot: false
    };

    this.graph.addNode(node);

    // Create incoming dependency edges from parents
    for (const parentId of parentArtifactIds) {
      const edge: ProvenanceEdge = {
        edgeId: `EDGE_${parentId}_TO_${identity.artifactId}`,
        sourceArtifactId: parentId,
        targetArtifactId: identity.artifactId,
        type: edgeType,
        transformationId: `TR_${parentId}_${identity.artifactId}`,
        timestamp: new Date().toISOString()
      };
      this.graph.addEdge(edge);
    }

    // Log in immutable timeline
    this.timeline.appendEvent(
      identity.artifactId,
      `REGISTER_${identity.artifactType}`,
      agent,
      payload
    );

    return node;
  }

  /**
   * Approves an artifact. Invalidates previous approvals if hash changes.
   */
  public approveArtifact(
    artifactId: string,
    approverId: string,
    approverRole: string
  ): ApprovalRecord {
    const node = this.graph.getNode(artifactId);
    if (!node) {
      throw new Error(`Artifact ${artifactId} not found for approval.`);
    }

    const signature = CanonicalizationEngine.computeHash({
      artifactId,
      contentHash: node.contentHash,
      approverId,
      approverRole,
      timestamp: new Date().toISOString()
    });

    const approval: ApprovalRecord = {
      approvalId: `APP_${artifactId}_${Date.now()}`,
      artifactId,
      artifactHash: node.contentHash,
      approverId,
      approverRole,
      timestamp: new Date().toISOString(),
      decision: "APPROVED",
      signature
    };

    this.approvals.set(artifactId, approval);
    node.status = ArtifactLifecycleStatus.ENGINEERING_VALIDATED;

    this.timeline.appendEvent(
      artifactId,
      "APPROVE_ARTIFACT",
      { agentType: AgentType.HUMAN, agentId: approverId, role: approverRole, agentRevision: "1.0" },
      approval
    );

    return approval;
  }

  /**
   * Verifies approval status; flags invalidation if content changed after approval
   */
  public verifyApproval(artifactId: string): { isValid: boolean; verdict: ProvenanceVerdict } {
    const approval = this.approvals.get(artifactId);
    const node = this.graph.getNode(artifactId);

    if (!approval || !node) {
      return { isValid: false, verdict: ProvenanceVerdict.INVALID };
    }

    if (approval.artifactHash !== node.contentHash) {
      approval.decision = "INVALIDATED";
      approval.invalidationReason = "Content hash changed after approval grant.";
      return { isValid: false, verdict: ProvenanceVerdict.APPROVAL_INVALIDATED };
    }

    return { isValid: true, verdict: ProvenanceVerdict.PROVENANCE_COMPLETE };
  }

  /**
   * Full Digital Thread Integration: Registers complete end-to-end chain from PATCH-101 to PATCH-110
   */
  public buildFullDigitalThread(): {
    featureNode: ProvenanceNode;
    toolpathNode: ProvenanceNode;
    simNode: ProvenanceNode;
    ncNode: ProvenanceNode;
    verifNode: ProvenanceNode;
    twinNode: ProvenanceNode;
  } {
    const cadId = this.rootIdentity.rootArtifactId;
    const now = new Date().toISOString();

    // 1. Manufacturing Feature (PATCH-101)
    const featureNode = this.registerArtifact(
      { artifactId: "FEAT_MODEL_01", artifactType: CAMArtifactType.MANUFACTURING_FEATURE, artifactRevision: "1.0", artifactFingerprint: "HASH_FEAT_01", createdAt: now, createdBy: "FEATURE_ENGINE", sourceSystem: "PATCH_101" },
      [cadId],
      ProvenanceEdgeType.DERIVED_FROM,
      { content: { featureType: "POCKET", depthMM: 15.0, widthMM: 50.0 }, metadata: { algorithm: "RECOGNIZER_V1" }, configuration: { toleranceMM: 0.001 } },
      { agentType: AgentType.CAM_ENGINE, agentId: "FEATURE_RECOGNIZER", agentRevision: "1.0" }
    );

    // 2. Material (Materials Intelligence)
    const materialNode = this.registerArtifact(
      { artifactId: "MAT_AL7075_T6", artifactType: CAMArtifactType.MATERIAL, artifactRevision: "1.0", artifactFingerprint: "HASH_MAT_01", createdAt: now, createdBy: "MATERIALS_DB", sourceSystem: "SECP_MATERIALS" },
      [cadId],
      ProvenanceEdgeType.USED,
      { content: { materialName: "Aluminum 7075-T6", hardnessHB: 150, densityGCM3: 2.81 }, metadata: { batchId: "BATCH_984" }, configuration: {} },
      { agentType: AgentType.SYSTEM, agentId: "MATERIALS_SERVICE", agentRevision: "1.0" }
    );

    // 3. Tool (PATCH-102)
    const toolNode = this.registerArtifact(
      { artifactId: "TOOL_ENDMILL_10MM", artifactType: CAMArtifactType.TOOL, artifactRevision: "1.0", artifactFingerprint: "HASH_TOOL_01", createdAt: now, createdBy: "TOOL_LIBRARY", sourceSystem: "PATCH_102" },
      [cadId],
      ProvenanceEdgeType.USED,
      { content: { toolId: "T1_ENDMILL_10", diameter: 10.0, length: 75.0, flutes: 4, material: "CARBIDE" }, metadata: { holder: "ER32" }, configuration: {} },
      { agentType: AgentType.SYSTEM, agentId: "TOOL_LIBRARY_ENGINE", agentRevision: "1.0" }
    );

    // 4. Machine & Kinematics (PATCH-103)
    const machineNode = this.registerArtifact(
      { artifactId: "MACH_DMG_50", artifactType: CAMArtifactType.MACHINE, artifactRevision: "1.0", artifactFingerprint: "HASH_MACH_01", createdAt: now, createdBy: "KINEMATICS_ENGINE", sourceSystem: "PATCH_103" },
      [cadId],
      ProvenanceEdgeType.USED,
      { content: { machineId: "MACH_DMG_50_01", chainType: "TABLE_TABLE", maxRPM: 18000, axisLimits: { x: 500, y: 500, z: 500 } }, metadata: { serial: "SN-98421-2026" }, configuration: {} },
      { agentType: AgentType.SYSTEM, agentId: "KINEMATICS_SERVICE", agentRevision: "1.0" }
    );

    // 5. CAM Operation (PATCH-104)
    const opNode = this.registerArtifact(
      { artifactId: "OP_AERO_POCKET_01", artifactType: CAMArtifactType.CAM_OPERATION, artifactRevision: "1.0", artifactFingerprint: "HASH_OP_01", createdAt: now, createdBy: "CAM_ENGINE", sourceSystem: "PATCH_104" },
      [featureNode.identity.artifactId, materialNode.identity.artifactId, toolNode.identity.artifactId, machineNode.identity.artifactId],
      ProvenanceEdgeType.DERIVED_FROM,
      { content: { operationName: "POCKET_ROUGHING", strategy: "ADAPTIVE_POCKETING" }, metadata: { author: "CAM_ENGINEER" }, configuration: {} },
      { agentType: AgentType.CAM_ENGINE, agentId: "CAM_3AXIS_ENGINE", agentRevision: "1.0" }
    );

    // 6. Toolpath (PATCH-105)
    const toolpathNode = this.registerArtifact(
      { artifactId: "TOOLPATH_AERO_01", artifactType: CAMArtifactType.TOOLPATH, artifactRevision: "1.0", artifactFingerprint: "HASH_TP_01", createdAt: now, createdBy: "CAM_5AXIS_ENGINE", sourceSystem: "PATCH_105" },
      [opNode.identity.artifactId],
      ProvenanceEdgeType.GENERATED,
      { content: { strategy: "ADAPTIVE_POCKETING", stepOver: 4.0, feedRateMMMin: 1200, maxRPM: 8000, pointCount: 1500, boundingVolume: { x: 100, y: 100, z: 50 } }, metadata: { algorithm: "SURFACE_MORPH_V2" }, configuration: { tolerance: 0.005 } },
      { agentType: AgentType.CAM_ENGINE, agentId: "CAM_5AXIS_SOLVER", agentRevision: "2.1" }
    );

    // 7. Simulation (PATCH-109)
    const simNode = this.registerArtifact(
      { artifactId: "SIM_AERO_01", artifactType: CAMArtifactType.SIMULATION, artifactRevision: "1.0", artifactFingerprint: "HASH_SIM_01", createdAt: now, createdBy: "SIMULATOR", sourceSystem: "PATCH_109" },
      [toolpathNode.identity.artifactId],
      ProvenanceEdgeType.SIMULATED_FROM,
      { content: { verdict: "SIMULATION_PASSED", totalCollisions: 0, maxGougeMM: 0.0 }, metadata: { voxelsChecked: 500000 }, configuration: { voxelResolutionMM: 0.1 } },
      { agentType: AgentType.SIMULATOR, agentId: "SIM_ENGINE_109", agentRevision: "1.0" }
    );

    // 8. Post Processor Engine (PATCH-107)
    const postNode = this.registerArtifact(
      { artifactId: "POST_ENGINE_TNC640", artifactType: CAMArtifactType.POST_PROCESSOR, artifactRevision: "1.0", artifactFingerprint: "HASH_POST_01", createdAt: now, createdBy: "POST_LIBRARY", sourceSystem: "PATCH_107" },
      [machineNode.identity.artifactId],
      ProvenanceEdgeType.USED,
      { content: { postProcessorId: "POST_HEIDENHAIN_TNC640", dialect: "HEIDENHAIN" }, metadata: { author: "POST_AUTHOR" }, configuration: {} },
      { agentType: AgentType.SYSTEM, agentId: "POST_REGISTRY", agentRevision: "1.0" }
    );

    // 9. NC Program (PATCH-107)
    const ncNode = this.registerArtifact(
      { artifactId: "NC_O1001", artifactType: CAMArtifactType.NC_PROGRAM, artifactRevision: "1.0", artifactFingerprint: "HASH_NC_01", createdAt: now, createdBy: "POST_PROCESSOR", sourceSystem: "PATCH_107" },
      [toolpathNode.identity.artifactId, postNode.identity.artifactId],
      ProvenanceEdgeType.POST_PROCESSED_FROM,
      { content: { programId: "O1001.NC", lineCount: 850, controller: "HEIDENHAIN_TNC640" }, metadata: { postRevision: "3.2" }, configuration: { dialect: "HEIDENHAIN" } },
      { agentType: AgentType.POST_PROCESSOR, agentId: "POST_ENGINE_107", agentRevision: "3.2" }
    );

    // 10. Verification (PATCH-108)
    const verifNode = this.registerArtifact(
      { artifactId: "VERIF_NC_01", artifactType: CAMArtifactType.GCODE_VERIFICATION, artifactRevision: "1.0", artifactFingerprint: "HASH_VERIF_01", createdAt: now, createdBy: "VERIFIER", sourceSystem: "PATCH_108" },
      [ncNode.identity.artifactId, simNode.identity.artifactId],
      ProvenanceEdgeType.VERIFIED_FROM,
      { content: { verdict: "VERIFIED", syntaxErrors: 0, kinematicsErrors: 0 }, metadata: { rulesChecked: 45 }, configuration: { strictDialect: true } },
      { agentType: AgentType.VERIFIER, agentId: "GCODE_VERIFIER_108", agentRevision: "1.0" }
    );

    // 9. Digital Twin State (PATCH-110)
    const twinNode = this.registerArtifact(
      { artifactId: "TWIN_EXEC_01", artifactType: CAMArtifactType.DIGITAL_TWIN_STATE, artifactRevision: "1.0", artifactFingerprint: "HASH_TWIN_01", createdAt: now, createdBy: "DIGITAL_TWIN", sourceSystem: "PATCH_110" },
      [verifNode.identity.artifactId, machineNode.identity.artifactId],
      ProvenanceEdgeType.EXECUTED_FROM,
      { content: { twinId: "TWIN_5AXIS_001", verdict: "SYNCHRONIZED", maxTrackingErrorMM: 0.003 }, metadata: { serial: "SN-98421-2026" }, configuration: { syncMode: "REAL_TIME" } },
      { agentType: AgentType.SYSTEM, agentId: "DIGITAL_TWIN_ENGINE_110", agentRevision: "1.0" }
    );

    return {
      featureNode,
      toolpathNode,
      simNode,
      ncNode,
      verifNode,
      twinNode
    };
  }

  // REST API Endpoints simulation
  public apiGetProvenance(artifactId: string): ProvenanceNode | undefined {
    return this.graph.getNode(artifactId);
  }

  public apiGetParents(artifactId: string): ProvenanceNode[] {
    const trace = this.graph.traceBackward(artifactId);
    return trace.path.slice(1).map(id => this.graph.getNode(id)!).filter(Boolean);
  }

  public apiGetChildren(artifactId: string): ProvenanceNode[] {
    const forward = this.graph.traceForward(artifactId);
    return forward.reachableArtifactIds.slice(1).map(id => this.graph.getNode(id)!).filter(Boolean);
  }

  public apiGetTimeline(): any[] {
    return this.timeline.getEvents();
  }

  public apiGetImpact(artifactId: string) {
    return this.impactEngine.analyzeImpact(artifactId, "ENGINEERING_RELEVANT" as any);
  }

  public apiVerifyProvenance(artifactId: string) {
    const chainCheck = this.timeline.validateChainIntegrity();
    const completeness = this.graph.calculateCompleteness(artifactId);
    const orphans = this.graph.detectOrphans();

    const isComplete = completeness.completenessRatio === 1.0;
    const isIntegrityValid = chainCheck.isValid;
    const hasOrphans = orphans.orphanArtifactIds.length > 0;

    let verdict = ProvenanceVerdict.PROVENANCE_COMPLETE;
    if (!isIntegrityValid) {
      verdict = ProvenanceVerdict.PROVENANCE_INTEGRITY_FAILURE;
    } else if (hasOrphans) {
      verdict = ProvenanceVerdict.ORPHAN_PROVENANCE;
    } else if (!isComplete) {
      verdict = ProvenanceVerdict.PROVENANCE_GAP;
    }

    return {
      artifactId,
      verdict,
      isVerified: verdict === ProvenanceVerdict.PROVENANCE_COMPLETE,
      completenessRatio: completeness.completenessRatio,
      chainIntegrityValid: isIntegrityValid,
      orphansDetectedCount: orphans.orphanArtifactIds.length
    };
  }

  public getGraphEngine(): CAMProvenanceGraphEngine {
    return this.graph;
  }

  public getTimelineEngine(): CAMProvenanceTimelineEngine {
    return this.timeline;
  }

  public getImpactEngine(): CAMProvenanceImpactEngine {
    return this.impactEngine;
  }

  public getReconstructionEngine(): CAMProvenanceReconstructionEngine {
    return this.reconstructionEngine;
  }

  public getContract(): CAMProvenanceContract {
    return this.contract;
  }

  public getRootIdentity(): RootArtifactIdentity {
    return this.rootIdentity;
  }

  public getEnvironmentFingerprint(): CAMEnvironmentFingerprint {
    return this.environmentFingerprint;
  }
}
