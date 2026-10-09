/**
 * SECP — ADSE-P4 Digital Thread Configuration Engine
 * Manages configuration-aware digital thread slices and enforces strict cross-configuration boundary isolation.
 */

import { DigitalThreadRegistry } from './DigitalThreadRegistry';
import { DigitalThreadNode, DigitalThreadEdge } from './types';

export class DigitalThreadConfigurationEngine {
  private registry: DigitalThreadRegistry;

  constructor(registry: DigitalThreadRegistry) {
    this.registry = registry;
  }

  /**
   * Validates that an edge does not contaminate configurations across incompatible boundaries.
   */
  public validateConfigurationCoupling(sourceNodeId: string, targetNodeId: string): { isValid: boolean; reason?: string } {
    const source = this.registry.getNode(sourceNodeId);
    const target = this.registry.getNode(targetNodeId);

    if (!source || !target) {
      return { isValid: false, reason: 'Source or target node not found in registry.' };
    }

    // Common/Universal configurations ('CONF-COMMON', 'CONF-BASE', 'GLOBAL') can connect to specific configurations
    const isSourceUniversal = ['CONF-COMMON', 'CONF-BASE', 'GLOBAL', 'BASE'].includes(source.configurationId);
    const isTargetUniversal = ['CONF-COMMON', 'CONF-BASE', 'GLOBAL', 'BASE'].includes(target.configurationId);

    if (source.configurationId !== target.configurationId && !isSourceUniversal && !isTargetUniversal) {
      return {
        isValid: false,
        reason: `CROSS_CONFIGURATION_CONTAMINATION: Node '${source.nodeId}' (Config: ${source.configurationId}) connects to incompatible node '${target.nodeId}' (Config: ${target.configurationId}).`
      };
    }

    return { isValid: true };
  }

  /**
   * Returns a complete, isolated digital thread slice for a specific configuration.
   */
  public getThreadSliceForConfiguration(configurationId: string): {
    configurationId: string;
    nodes: DigitalThreadNode[];
    edges: DigitalThreadEdge[];
  } {
    const allNodes = this.registry.getAllNodes();
    const allEdges = this.registry.getAllEdges();

    const configNodes = allNodes.filter(
      n => n.configurationId === configurationId || ['CONF-COMMON', 'CONF-BASE', 'GLOBAL', 'BASE'].includes(n.configurationId)
    );
    const nodeIds = new Set(configNodes.map(n => n.nodeId));

    const configEdges = allEdges.filter(
      e => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)
    );

    return {
      configurationId,
      nodes: configNodes,
      edges: configEdges
    };
  }
}
