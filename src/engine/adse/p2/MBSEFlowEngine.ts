/**
 * SECP — ADSE-P2 MBSE Flow Engine
 * Authoritative management of Item Flows, Flow Ports, Connectors, Signals & Data Flow compatibility.
 */

import { MBSEElementRegistry } from './MBSEElementRegistry';
import { MBSEFlowPort, MBSEItemFlow, MBSEConnector } from './types';

export class MBSEFlowEngine {
  private registry: MBSEElementRegistry;
  private flowPorts: Map<string, MBSEFlowPort> = new Map();
  private itemFlows: Map<string, MBSEItemFlow> = new Map();
  private connectors: Map<string, MBSEConnector> = new Map();

  constructor(registry: MBSEElementRegistry) {
    this.registry = registry;
  }

  /**
   * Registers a FlowPort on a component or subsystem.
   */
  public registerFlowPort(params: {
    mbseId: string;
    name: string;
    direction: 'IN' | 'OUT' | 'INOUT';
    ownerMbseId: string;
    dataType?: string;
    configurationId: string;
  }): MBSEFlowPort {
    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'FlowPort',
      displayName: `FlowPort ${params.name} [${params.direction}] (${params.dataType || 'GENERIC'})`,
      category: 'FLOW',
      configurationId: params.configurationId
    });

    const port: MBSEFlowPort = {
      mbseId: params.mbseId,
      name: params.name,
      direction: params.direction,
      ownerMbseId: params.ownerMbseId,
      dataType: params.dataType
    };

    this.flowPorts.set(params.mbseId, port);

    this.registry.addRelationship({
      relationshipType: 'COMPOSES',
      sourceMbseId: params.ownerMbseId,
      targetMbseId: params.mbseId,
      configurationId: params.configurationId
    });

    return port;
  }

  /**
   * Registers a connector connecting source and target flow ports.
   */
  public registerConnector(params: {
    mbseId: string;
    name: string;
    sourcePortMbseId: string;
    targetPortMbseId: string;
    configurationId: string;
  }): MBSEConnector {
    const sourcePort = this.flowPorts.get(params.sourcePortMbseId);
    const targetPort = this.flowPorts.get(params.targetPortMbseId);

    if (!sourcePort || !targetPort) {
      throw new Error(`FLOW_ENGINE_ERROR: Both source port '${params.sourcePortMbseId}' and target port '${params.targetPortMbseId}' must exist.`);
    }

    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'Connector',
      displayName: `Connector ${params.name}: ${sourcePort.name} -> ${targetPort.name}`,
      category: 'FLOW',
      configurationId: params.configurationId
    });

    const connector: MBSEConnector = {
      mbseId: params.mbseId,
      name: params.name,
      sourcePortMbseId: params.sourcePortMbseId,
      targetPortMbseId: params.targetPortMbseId,
      configurationId: params.configurationId
    };

    this.connectors.set(params.mbseId, connector);

    this.registry.addRelationship({
      relationshipType: 'CONNECTS',
      sourceMbseId: params.sourcePortMbseId,
      targetMbseId: params.targetPortMbseId,
      configurationId: params.configurationId
    });

    return connector;
  }

  /**
   * Registers an ItemFlow traversing a connector or ports.
   */
  public registerItemFlow(params: {
    mbseId: string;
    name: string;
    itemType: string;
    sourcePortMbseId: string;
    targetPortMbseId: string;
    flowDirection: 'IN' | 'OUT' | 'INOUT';
    configurationId: string;
    connectorMbseId?: string;
    rate?: number;
    unit?: string;
  }): MBSEItemFlow {
    // Validate port direction compatibility
    const sourcePort = this.flowPorts.get(params.sourcePortMbseId);
    const targetPort = this.flowPorts.get(params.targetPortMbseId);

    if (sourcePort && sourcePort.direction === 'IN' && targetPort && targetPort.direction === 'OUT') {
      throw new Error(`FLOW_DIRECTION_MISMATCH: Source port '${sourcePort.name}' is IN and Target port '${targetPort.name}' is OUT. Inverted flow direction.`);
    }

    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'ItemFlow',
      displayName: `ItemFlow ${params.name} [${params.itemType}]`,
      category: 'FLOW',
      configurationId: params.configurationId
    });

    const itemFlow: MBSEItemFlow = {
      mbseId: params.mbseId,
      name: params.name,
      itemType: params.itemType,
      sourcePortMbseId: params.sourcePortMbseId,
      targetPortMbseId: params.targetPortMbseId,
      flowDirection: params.flowDirection,
      connectorMbseId: params.connectorMbseId,
      rate: params.rate,
      unit: params.unit
    };

    this.itemFlows.set(params.mbseId, itemFlow);

    this.registry.addRelationship({
      relationshipType: 'FLOWS_TO',
      sourceMbseId: params.sourcePortMbseId,
      targetMbseId: params.targetPortMbseId,
      configurationId: params.configurationId
    });

    return itemFlow;
  }

  public getFlowPort(mbseId: string): MBSEFlowPort | undefined {
    return this.flowPorts.get(mbseId);
  }

  public getItemFlow(mbseId: string): MBSEItemFlow | undefined {
    return this.itemFlows.get(mbseId);
  }

  public getAllFlowPorts(): MBSEFlowPort[] {
    return Array.from(this.flowPorts.values());
  }

  public getAllItemFlows(): MBSEItemFlow[] {
    return Array.from(this.itemFlows.values());
  }

  public clear(): void {
    this.flowPorts.clear();
    this.itemFlows.clear();
    this.connectors.clear();
  }
}
