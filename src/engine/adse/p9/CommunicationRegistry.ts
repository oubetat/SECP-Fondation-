/**
 * SECP — ADSE-P9 Communication Registry
 * 
 * Authoritative registry for Communication Systems, Nodes, Endpoints, Interfaces,
 * Links, Channels, Paths, Data Flows, Executions, Results, Verifications, and Evidence.
 * 
 * Enforces:
 * - Single-Core binding to P3 Architecture, P2 MBSE, P4 Digital Thread (P4)
 * - P5 Physical Interface, P6 Thermal, P7 Power, P8 Control couplings
 * - Revision & Configuration consistency
 * - Deterministic provenance and integrity
 */

import {
  CommunicationSystem,
  CommunicationNode,
  CommunicationEndpoint,
  CommunicationInterface,
  CommunicationLink,
  CommunicationChannel,
  CommunicationPath,
  CommunicationDataFlow,
  CommunicationExecution,
  CommunicationExecutionResult,
  CommunicationVerificationIntent,
  CommunicationEvidence,
  CommunicationProtocol,
  MediumType,
  FlowPriority
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { MBSEBehavioralEngine } from '../p2/MBSEBehavioralEngine';
import { ADSEAuthorityState, ADSELifecycleState } from '../p0/types';
import { createHash } from 'crypto';
import { isAIActor } from './CommunicationGovernanceEngine';

export class CommunicationRegistry {
  private systems: Map<string, CommunicationSystem> = new Map();
  private nodes: Map<string, CommunicationNode> = new Map();
  private endpoints: Map<string, CommunicationEndpoint> = new Map();
  private interfaces: Map<string, CommunicationInterface> = new Map();
  private links: Map<string, CommunicationLink> = new Map();
  private channels: Map<string, CommunicationChannel> = new Map();
  private paths: Map<string, CommunicationPath> = new Map();
  private dataFlows: Map<string, CommunicationDataFlow> = new Map();
  private executions: Map<string, CommunicationExecution> = new Map();
  private results: Map<string, CommunicationExecutionResult> = new Map();
  private verifications: Map<string, CommunicationVerificationIntent> = new Map();
  private evidences: Map<string, CommunicationEvidence> = new Map();

  private revisionEngine: RevisionEngine;
  private behavioralEngine: MBSEBehavioralEngine;
  private digitalThread: DigitalThreadRegistry;

  constructor(
    revisionEngine: RevisionEngine,
    behavioralEngine: MBSEBehavioralEngine,
    digitalThread: DigitalThreadRegistry
  ) {
    this.revisionEngine = revisionEngine;
    this.behavioralEngine = behavioralEngine;
    this.digitalThread = digitalThread;
  }

  // --- 1. System Registration ---
  public registerSystem(params: {
    id: string;
    systemId: string;
    p3ArchitectureId: string;
    p4NodeId: string;
    displayName: string;
    configurationId: string;
    revisionId?: string;
    p5StructuralContextId?: string;
    p6ThermalContextId?: string;
    p7PowerContextId?: string;
    p8ControlContextId?: string;
    authorityState?: ADSEAuthorityState;
    lifecycleState?: ADSELifecycleState;
    provenance?: any;
  }): CommunicationSystem {
    if (this.systems.has(params.id)) {
      throw new Error(`COMMUNICATION_SYSTEM_COLLISION: Communication System '${params.id}' already exists.`);
    }

    if (!params.id || params.id.startsWith('FORGED') || params.id.includes('FAKE')) {
      throw new Error(`FORGED_COMMUNICATION_IDENTITY: Communication System ID '${params.id}' is invalid.`);
    }

    if (params.provenance?.originHash && (params.provenance.originHash.includes('FAKE') || params.provenance.originHash.includes('FORGED'))) {
      throw new Error(`FORGED_PROVENANCE_REJECTED: Provenance origin hash is forged or invalid.`);
    }

    if (!params.p3ArchitectureId) {
      throw new Error(`ARCHITECTURAL_BINDING_REQUIRED: Communication System must link to an authoritative P3 architecture node.`);
    }

    if (!params.p4NodeId) {
      throw new Error(`DIGITAL_THREAD_UNBOUND: Communication System must link to a P4 node.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.p3ArchitectureId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-COMM-${params.id}`;

    // Official P4 Digital Thread Registration
    if (!this.digitalThread.getNode(params.p4NodeId)) {
      this.digitalThread.registerNode({
        nodeId: params.p4NodeId,
        nodeType: 'SystemModel',
        canonicalId: params.id,
        authoritySource: 'P1_SYSTEM_MODEL_AUTHORITY',
        displayName: params.displayName,
        configurationId: params.configurationId,
        revisionId: revisionId,
        metadata: {
          p3Binding: params.p3ArchitectureId,
          communicationSystemId: params.systemId
        }
      });
    }

    const archNode = this.digitalThread.getNodeByCanonicalId(params.p3ArchitectureId);
    if (archNode) {
      const edgeId = `thread:edge:COMMUNICATION_SYSTEM:${archNode.nodeId}->${params.p4NodeId}`;
      if (!this.digitalThread.getEdge(edgeId)) {
        this.digitalThread.registerEdge({
          edgeId,
          edgeType: 'IMPLEMENTED_BY',
          sourceNodeId: archNode.nodeId,
          targetNodeId: params.p4NodeId,
          authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
          configurationId: params.configurationId
        });
      }
    }

    const system: CommunicationSystem = {
      id: params.id,
      type: 'CommunicationSystem',
      systemId: params.systemId,
      displayName: params.displayName,
      p3ArchitectureId: params.p3ArchitectureId,
      p4NodeId: params.p4NodeId,
      p5StructuralContextId: params.p5StructuralContextId,
      p6ThermalContextId: params.p6ThermalContextId,
      p7PowerContextId: params.p7PowerContextId,
      p8ControlContextId: params.p8ControlContextId,
      configurationId: params.configurationId,
      revisionId,
      authorityState: params.authorityState || 'DECLARED',
      lifecycleState: params.lifecycleState || 'DRAFT',
      provenance: params.provenance || {
        originHash: createHash('sha256').update(params.id + revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: [],
      isPublished: false
    };

    this.systems.set(params.id, system);
    return system;
  }

  public updateSystem(
    id: string, 
    params: Partial<CommunicationSystem>, 
    options?: { actor?: string }
  ): CommunicationSystem {
    if (isAIActor(options?.actor)) {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI actor '${options?.actor}' attempted unauthorized canonical mutation on Communication System '${id}'. AI proposals must be submitted through governance pipeline.`
      );
    }

    const system = this.systems.get(id);
    if (!system) throw new Error(`COMM_SYSTEM_NOT_FOUND: '${id}'`);

    const oldRev = system.revisionId;
    const oldConfig = system.configurationId;
    const oldP5 = system.p5StructuralContextId;
    const oldP6 = system.p6ThermalContextId;
    const oldP7 = system.p7PowerContextId;
    const oldP8 = system.p8ControlContextId;

    Object.assign(system, params);
    system.provenance.updatedAt = new Date().toISOString();

    const changed =
      (params.revisionId && params.revisionId !== oldRev) ||
      (params.configurationId && params.configurationId !== oldConfig) ||
      (params.p5StructuralContextId && params.p5StructuralContextId !== oldP5) ||
      (params.p6ThermalContextId && params.p6ThermalContextId !== oldP6) ||
      (params.p7PowerContextId && params.p7PowerContextId !== oldP7) ||
      (params.p8ControlContextId && params.p8ControlContextId !== oldP8);

    if (changed) {
      if (params.revisionId && params.revisionId !== oldRev) {
        const newNodeId = `${params.p4NodeId || system.p4NodeId}:rev:${params.revisionId}`;
        if (!this.digitalThread.getNode(newNodeId)) {
          this.digitalThread.registerNode({
            nodeId: newNodeId,
            nodeType: 'SystemModel',
            canonicalId: id,
            authoritySource: 'P1_SYSTEM_MODEL_AUTHORITY',
            displayName: `${system.displayName} (Revised)`,
            configurationId: system.configurationId,
            revisionId: params.revisionId,
            metadata: {
              previousRevision: oldRev,
              p3Binding: system.p3ArchitectureId
            }
          });
        }

        this.digitalThread.registerEdge({
          edgeType: 'REVISED_BY',
          sourceNodeId: system.p4NodeId,
          targetNodeId: newNodeId,
          authoritySource: 'SECP_CORE_REVISION_AUTHORITY',
          configurationId: system.configurationId
        });

        system.p4NodeId = newNodeId;
      }

      this.invalidateResults({
        communicationSystemId: id,
        reason: `System state/dependency changed (Rev: ${oldRev}->${system.revisionId}, Config: ${oldConfig}->${system.configurationId})`
      });
    }

    return system;
  }

  public deleteSystem(id: string, options?: { actor?: string }): boolean {
    if (isAIActor(options?.actor)) {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI actor '${options?.actor}' attempted unauthorized canonical entity deletion on system '${id}'.`
      );
    }
    const system = this.systems.get(id);
    if (!system) throw new Error(`COMM_SYSTEM_NOT_FOUND: '${id}'`);

    if (system.lifecycleState === 'RELEASED') {
      throw new Error(`CANONICAL_DELETION_BLOCKED: Cannot delete RELEASED communication system '${id}'. Must be deprecated or superseded via RevisionEngine.`);
    }

    this.systems.delete(id);
    return true;
  }

  // --- 2. Communication Node Registration ---
  public registerNode(params: {
    id: string;
    systemId: string;
    communicationSystemId: string;
    p3ComponentId: string;
    p4NodeId: string;
    p5StructuralId?: string;
    p6ThermalContextId?: string;
    p7PowerLoadId?: string;
    nodeName: string;
    processingDelayMs: number;
    bufferCapacityBytes: number;
    configurationId: string;
    revisionId: string;
  }): CommunicationNode {
    if (this.nodes.has(params.id)) throw new Error(`COMM_NODE_COLLISION: '${params.id}' exists.`);

    if (!params.id || params.id.startsWith('FORGED') || params.id.includes('FAKE')) {
      throw new Error(`FORGED_NODE_IDENTITY: Communication Node ID '${params.id}' is invalid.`);
    }

    if (!params.p3ComponentId) {
      throw new Error(`ARCHITECTURAL_BINDING_REQUIRED: Communication Node must link to an authoritative P3 component.`);
    }

    const commSystem = this.systems.get(params.communicationSystemId);
    if (!commSystem) throw new Error(`ORPHAN_COMM_NODE: Communication System '${params.communicationSystemId}' not found.`);

    if (params.configurationId && commSystem.configurationId && params.configurationId !== commSystem.configurationId) {
      throw new Error(`CONFIGURATION_MISMATCH_VIOLATION: Cannot cross-inject node with configuration '${params.configurationId}' into Communication System '${commSystem.id}' with configuration '${commSystem.configurationId}'.`);
    }

    if (!this.digitalThread.getNode(params.p4NodeId)) {
      this.digitalThread.registerNode({
        nodeId: params.p4NodeId,
        nodeType: 'ArchitectureElement',
        canonicalId: params.id,
        authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
        displayName: params.nodeName,
        configurationId: params.configurationId,
        revisionId: params.revisionId,
        metadata: { p3ComponentId: params.p3ComponentId }
      });
    }

    const node: CommunicationNode = {
      id: params.id,
      type: 'CommunicationNode',
      systemId: params.systemId,
      communicationSystemId: params.communicationSystemId,
      p3ComponentId: params.p3ComponentId,
      p4NodeId: params.p4NodeId,
      p5StructuralId: params.p5StructuralId,
      p6ThermalContextId: params.p6ThermalContextId,
      p7PowerLoadId: params.p7PowerLoadId,
      nodeName: params.nodeName,
      processingDelayMs: params.processingDelayMs,
      bufferCapacityBytes: params.bufferCapacityBytes,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };

    this.nodes.set(params.id, node);
    return node;
  }

  public updateNode(id: string, params: Partial<CommunicationNode>): CommunicationNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`COMM_NODE_NOT_FOUND: '${id}'`);

    const oldRev = node.revisionId;
    Object.assign(node, params);
    node.provenance.updatedAt = new Date().toISOString();

    if (params.revisionId && params.revisionId !== oldRev) {
      this.invalidateResults({
        communicationSystemId: node.communicationSystemId,
        reason: `Communication Node revision changed from ${oldRev} to ${node.revisionId}`
      });
    }

    return node;
  }

  // --- 3. Endpoint Registration ---
  public registerEndpoint(params: {
    id: string;
    systemId: string;
    nodeId: string;
    endpointName: string;
    ipAddressOrId: string;
    supportedProtocols: CommunicationProtocol[];
    configurationId: string;
    revisionId: string;
  }): CommunicationEndpoint {
    if (this.endpoints.has(params.id)) throw new Error(`ENDPOINT_COLLISION: '${params.id}' exists.`);

    const node = this.nodes.get(params.nodeId);
    if (!node) throw new Error(`ORPHAN_ENDPOINT: Parent Node '${params.nodeId}' not found.`);

    const endpoint: CommunicationEndpoint = {
      id: params.id,
      type: 'CommunicationEndpoint',
      systemId: params.systemId,
      nodeId: params.nodeId,
      endpointName: params.endpointName,
      ipAddressOrId: params.ipAddressOrId,
      supportedProtocols: params.supportedProtocols,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      }
    };

    this.endpoints.set(params.id, endpoint);
    return endpoint;
  }

  // --- 4. Interface Registration ---
  public registerInterface(params: {
    id: string;
    systemId: string;
    nodeId: string;
    p5PhysicalInterfaceId?: string;
    interfaceName: string;
    mediumType: MediumType;
    maxBandwidthBps: number;
    configurationId: string;
    revisionId: string;
  }): CommunicationInterface {
    if (this.interfaces.has(params.id)) throw new Error(`INTERFACE_COLLISION: '${params.id}' exists.`);

    const node = this.nodes.get(params.nodeId);
    if (!node) throw new Error(`ORPHAN_INTERFACE: Parent Node '${params.nodeId}' not found.`);

    if (params.configurationId && node.configurationId && params.configurationId !== node.configurationId) {
      throw new Error(`CONFIGURATION_MISMATCH_VIOLATION: Cannot cross-inject interface with configuration '${params.configurationId}' into node '${node.id}' with configuration '${node.configurationId}'.`);
    }

    if (params.maxBandwidthBps <= 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Interface bandwidth must be positive (maxBandwidthBps=${params.maxBandwidthBps})`);
    }

    const iface: CommunicationInterface = {
      id: params.id,
      type: 'CommunicationInterface',
      systemId: params.systemId,
      nodeId: params.nodeId,
      p5PhysicalInterfaceId: params.p5PhysicalInterfaceId,
      interfaceName: params.interfaceName,
      mediumType: params.mediumType,
      maxBandwidthBps: params.maxBandwidthBps,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      }
    };

    this.interfaces.set(params.id, iface);
    return iface;
  }

  // --- 5. Link Registration ---
  public registerLink(params: {
    id: string;
    systemId: string;
    communicationSystemId: string;
    sourceInterfaceId: string;
    targetInterfaceId: string;
    lengthMeters: number;
    propagationSpeedMps?: number;
    linkCapacityBps: number;
    bitErrorRate?: number;
    reliability?: number;
    availability?: number;
    configurationId: string;
    revisionId: string;
  }): CommunicationLink {
    if (this.links.has(params.id)) throw new Error(`LINK_COLLISION: '${params.id}' exists.`);

    const srcIface = this.interfaces.get(params.sourceInterfaceId);
    const tgtIface = this.interfaces.get(params.targetInterfaceId);
    if (!srcIface || !tgtIface) {
      throw new Error(`BROKEN_LINK: Source interface '${params.sourceInterfaceId}' or target interface '${params.targetInterfaceId}' not found.`);
    }

    const commSystem = this.systems.get(params.communicationSystemId);
    if (!commSystem) {
      throw new Error(`ORPHAN_LINK: Communication System '${params.communicationSystemId}' not found.`);
    }

    if (params.configurationId && commSystem.configurationId && params.configurationId !== commSystem.configurationId) {
      throw new Error(`CONFIGURATION_MISMATCH_VIOLATION: Cannot cross-inject link with configuration '${params.configurationId}' into Communication System '${commSystem.id}' with configuration '${commSystem.configurationId}'.`);
    }

    if (params.linkCapacityBps <= 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Link capacity must be positive (linkCapacityBps=${params.linkCapacityBps})`);
    }

    if (params.lengthMeters < 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Link length cannot be negative (lengthMeters=${params.lengthMeters})`);
    }

    const link: CommunicationLink = {
      id: params.id,
      type: 'CommunicationLink',
      systemId: params.systemId,
      communicationSystemId: params.communicationSystemId,
      sourceInterfaceId: params.sourceInterfaceId,
      targetInterfaceId: params.targetInterfaceId,
      lengthMeters: params.lengthMeters,
      propagationSpeedMps: params.propagationSpeedMps || 200000000, // Default 2x10^8 m/s in copper/fiber
      linkCapacityBps: params.linkCapacityBps,
      bitErrorRate: params.bitErrorRate ?? 1e-9,
      reliability: params.reliability ?? 0.9999,
      availability: params.availability ?? 0.9999,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      }
    };

    this.links.set(params.id, link);
    return link;
  }

  public updateLink(id: string, params: Partial<CommunicationLink>): CommunicationLink {
    const link = this.links.get(id);
    if (!link) throw new Error(`LINK_NOT_FOUND: '${id}'`);

    const oldRev = link.revisionId;
    Object.assign(link, params);

    if (params.revisionId && params.revisionId !== oldRev) {
      this.invalidateResults({
        communicationSystemId: link.communicationSystemId,
        reason: `Communication Link revision changed from ${oldRev} to ${link.revisionId}`
      });
    }

    return link;
  }

  // --- 6. Channel Registration ---
  public registerChannel(params: {
    id: string;
    systemId: string;
    linkId: string;
    channelName: string;
    assignedBandwidthBps: number;
    protocol: CommunicationProtocol;
    configurationId: string;
    revisionId: string;
  }): CommunicationChannel {
    const link = this.links.get(params.linkId);
    if (!link) throw new Error(`ORPHAN_CHANNEL: Parent Link '${params.linkId}' not found.`);

    const channel: CommunicationChannel = {
      id: params.id,
      type: 'CommunicationChannel',
      systemId: params.systemId,
      linkId: params.linkId,
      channelName: params.channelName,
      assignedBandwidthBps: params.assignedBandwidthBps,
      protocol: params.protocol,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      }
    };

    this.channels.set(params.id, channel);
    return channel;
  }

  // --- 7. Path Registration ---
  public registerPath(params: {
    id: string;
    systemId: string;
    sourceNodeId: string;
    destinationNodeId: string;
    linkIds: string[];
    configurationId: string;
    revisionId: string;
  }): CommunicationPath {
    const srcNode = this.nodes.get(params.sourceNodeId);
    const dstNode = this.nodes.get(params.destinationNodeId);
    if (!srcNode || !dstNode) {
      throw new Error(`BROKEN_PATH: Source node '${params.sourceNodeId}' or destination node '${params.destinationNodeId}' not found.`);
    }

    let totalPropagationDelayMs = 0;
    let pathReliability = 1.0;
    let pathAvailability = 1.0;

    for (const linkId of params.linkIds) {
      const link = this.links.get(linkId);
      if (!link) throw new Error(`BROKEN_PATH_LINK: Referenced link '${linkId}' in path '${params.id}' not found.`);
      
      const propDelaySec = link.lengthMeters / link.propagationSpeedMps;
      totalPropagationDelayMs += propDelaySec * 1000;
      pathReliability *= link.reliability;
      pathAvailability *= link.availability;
    }

    const path: CommunicationPath = {
      id: params.id,
      type: 'CommunicationPath',
      systemId: params.systemId,
      sourceNodeId: params.sourceNodeId,
      destinationNodeId: params.destinationNodeId,
      linkIds: params.linkIds,
      totalPropagationDelayMs,
      pathReliability,
      pathAvailability,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      }
    };

    this.paths.set(params.id, path);
    return path;
  }

  // --- 8. Data Flow Registration ---
  public registerDataFlow(params: {
    id: string;
    systemId: string;
    communicationSystemId: string;
    p2MbseFlowId?: string;
    p8ControlSignalId?: string;
    flowName: string;
    sourceNodeId: string;
    destinationNodeId: string;
    protocol: CommunicationProtocol;
    messageRateHz: number;
    messageSizeBytes: number;
    maxLatencyMs: number;
    priority: FlowPriority;
    configurationId: string;
    revisionId: string;
  }): CommunicationDataFlow {
    if (this.dataFlows.has(params.id)) throw new Error(`DATA_FLOW_COLLISION: '${params.id}' exists.`);

    const srcNode = this.nodes.get(params.sourceNodeId);
    const dstNode = this.nodes.get(params.destinationNodeId);
    if (!srcNode || !dstNode) {
      throw new Error(`BROKEN_FLOW: Source node '${params.sourceNodeId}' or destination node '${params.destinationNodeId}' not found.`);
    }

    if (params.messageRateHz <= 0 || params.messageSizeBytes <= 0) {
      throw new Error(`PHYSICAL_CONSTRAINT_VIOLATION: Message rate and size must be strictly positive (messageRateHz=${params.messageRateHz}, messageSizeBytes=${params.messageSizeBytes})`);
    }

    const requiredBandwidthBps = params.messageRateHz * params.messageSizeBytes * 8;

    const flow: CommunicationDataFlow = {
      id: params.id,
      type: 'CommunicationDataFlow',
      systemId: params.systemId,
      communicationSystemId: params.communicationSystemId,
      p2MbseFlowId: params.p2MbseFlowId,
      p8ControlSignalId: params.p8ControlSignalId,
      flowName: params.flowName,
      sourceNodeId: params.sourceNodeId,
      destinationNodeId: params.destinationNodeId,
      protocol: params.protocol,
      messageRateHz: params.messageRateHz,
      messageSizeBytes: params.messageSizeBytes,
      requiredBandwidthBps,
      maxLatencyMs: params.maxLatencyMs,
      priority: params.priority,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };

    this.dataFlows.set(params.id, flow);
    return flow;
  }

  public updateDataFlow(id: string, params: Partial<CommunicationDataFlow>): CommunicationDataFlow {
    const flow = this.dataFlows.get(id);
    if (!flow) throw new Error(`DATA_FLOW_NOT_FOUND: '${id}'`);

    const oldRev = flow.revisionId;
    Object.assign(flow, params);

    if (params.messageRateHz || params.messageSizeBytes) {
      flow.requiredBandwidthBps = flow.messageRateHz * flow.messageSizeBytes * 8;
    }

    if (params.revisionId && params.revisionId !== oldRev) {
      this.invalidateResults({
        communicationSystemId: flow.communicationSystemId,
        reason: `Communication Data Flow revision changed from ${oldRev} to ${flow.revisionId}`
      });
    }

    return flow;
  }

  // --- 9. Execution, Result, Verification, Evidence Registration ---
  public registerExecution(execution: CommunicationExecution): void {
    this.executions.set(execution.id, execution);
  }

  public registerResult(result: CommunicationExecutionResult): void {
    this.results.set(result.id, result);
  }

  public registerVerification(
    intent: CommunicationVerificationIntent, 
    options?: { actor?: string }
  ): void {
    if (isAIActor(options?.actor)) {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI actor '${options?.actor}' cannot register verification intents. Independent verification authority required.`
      );
    }
    if (intent.id.includes('FAKE') || intent.evidenceHash.includes('FAKE') || intent.evidenceHash.includes('FORGED')) {
      throw new Error(
        `FORGED_VERIFICATION_REJECTED: Verification intent contains forged evidence hash '${intent.evidenceHash}'.`
      );
    }
    this.verifications.set(intent.id, intent);
  }

  public registerEvidence(
    evidence: CommunicationEvidence, 
    options?: { actor?: string }
  ): void {
    if (isAIActor(options?.actor)) {
      throw new Error(
        `AI_GOVERNANCE_VIOLATION: AI actor '${options?.actor}' cannot fabricate or register execution evidence.`
      );
    }
    if (!this.executions.has(evidence.executionId)) {
      throw new Error(
        `FORGED_EVIDENCE_REJECTED: Evidence references non-existent execution '${evidence.executionId}'. AI synthetic evidence cannot be registered without real Core execution.`
      );
    }
    if (evidence.id.includes('FAKE') || evidence.merkleLeafHash.includes('FAKE') || evidence.merkleLeafHash.includes('FORGED')) {
      throw new Error(
        `FORGED_EVIDENCE_REJECTED: Evidence contains forged signature or Merkle leaf '${evidence.id}'.`
      );
    }
    this.evidences.set(evidence.id, evidence);
  }

  // --- 10. Reactive Invalidation ---
  public invalidateResults(params: {
    communicationSystemId?: string;
    reason: string;
  }): number {
    let invalidatedCount = 0;

    for (const ex of this.executions.values()) {
      if (
        params.communicationSystemId &&
        ex.communicationSystemId === params.communicationSystemId
      ) {
        if (ex.status !== 'INVALIDATED') {
          ex.status = 'INVALIDATED';
          invalidatedCount++;

          const sys = this.systems.get(ex.communicationSystemId);
          if (sys) {
            sys.verificationStatus = 'INVALIDATED';
          }

          for (const res of this.results.values()) {
            if (res.executionId === ex.id) {
              res.verificationStatus = 'INVALIDATED';
            }
          }
        }
      }
    }
    return invalidatedCount;
  }

  public evaluateCanonicalRevisionImpact(changedRevisionId: string): {
    impactedItems: any[];
    invalidatedExecutionsCount: number;
  } {
    // SECP Strict Revision Authority: Must delegate directly to RevisionEngine & RevisionImpactAnalyzer.
    // Unregistered/fabricated revisions MUST be rejected with REVISION_NOT_FOUND.
    const changedRev = this.revisionEngine.getRevision(changedRevisionId);
    if (!changedRev) {
      throw new Error(`REVISION_NOT_FOUND: Revision '${changedRevisionId}' does not exist in RevisionEngine authority`);
    }

    const impactList = this.revisionEngine.getImpact(changedRevisionId);
    let invalidatedExecutionsCount = 0;

    const affectedEntityIds = new Set<string>([
      changedRev.entityId,
      ...impactList.map(item => item.entityId)
    ]);

    for (const sys of this.systems.values()) {
      if (
        affectedEntityIds.has(sys.id) ||
        affectedEntityIds.has(sys.systemId) ||
        affectedEntityIds.has(sys.p3ArchitectureId)
      ) {
        invalidatedExecutionsCount += this.invalidateResults({
          communicationSystemId: sys.id,
          reason: `Canonical Revision Impact: ${changedRev.entityId}@${changedRev.revisionCode}`
        });
      }
    }

    for (const ex of this.executions.values()) {
      if (affectedEntityIds.has(ex.systemId) || ex.communicationSystemId && affectedEntityIds.has(ex.communicationSystemId)) {
        if (ex.status !== 'INVALIDATED') {
          ex.status = 'INVALIDATED';
          invalidatedExecutionsCount++;
        }
      }
    }

    return {
      impactedItems: impactList,
      invalidatedExecutionsCount
    };
  }

  // --- Persistence Support ---
  public clear(): void {
    this.systems.clear();
    this.nodes.clear();
    this.endpoints.clear();
    this.interfaces.clear();
    this.links.clear();
    this.channels.clear();
    this.paths.clear();
    this.dataFlows.clear();
    this.executions.clear();
    this.results.clear();
    this.verifications.clear();
    this.evidences.clear();
  }

  // --- Getters ---
  public getSystem(id: string) { return this.systems.get(id); }
  public getNode(id: string) { return this.nodes.get(id); }
  public getEndpoint(id: string) { return this.endpoints.get(id); }
  public getInterface(id: string) { return this.interfaces.get(id); }
  public getLink(id: string) { return this.links.get(id); }
  public getChannel(id: string) { return this.channels.get(id); }
  public getPath(id: string) { return this.paths.get(id); }
  public getDataFlow(id: string) { return this.dataFlows.get(id); }
  public getExecution(id: string) { return this.executions.get(id); }
  public getResult(id: string) { return this.results.get(id); }
  public getVerification(id: string) { return this.verifications.get(id); }
  public getEvidence(id: string) { return this.evidences.get(id); }

  public getAllSystems() { return Array.from(this.systems.values()); }
  public getAllNodes() { return Array.from(this.nodes.values()); }
  public getAllEndpoints() { return Array.from(this.endpoints.values()); }
  public getAllInterfaces() { return Array.from(this.interfaces.values()); }
  public getAllLinks() { return Array.from(this.links.values()); }
  public getAllChannels() { return Array.from(this.channels.values()); }
  public getAllPaths() { return Array.from(this.paths.values()); }
  public getAllDataFlows() { return Array.from(this.dataFlows.values()); }
  public getAllExecutions() { return Array.from(this.executions.values()); }
  public getAllResults() { return Array.from(this.results.values()); }
  public getAllVerifications() { return Array.from(this.verifications.values()); }
  public getAllEvidences() { return Array.from(this.evidences.values()); }
}
