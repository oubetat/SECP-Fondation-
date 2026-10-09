/**
 * SECP — ADSE-P9 Communication Architecture Engine
 * 
 * Responsible for verifying communication architecture consistency, topology checks,
 * node-to-component mappings, and path connectivity.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { CommunicationSystem, CommunicationNode, CommunicationPath } from './types';

export class CommunicationArchitectureEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Validates topology completeness for a Communication System
   */
  public validateTopology(systemId: string): {
    isValid: boolean;
    errors: string[];
  } {
    const system = this.registry.getSystem(systemId);
    if (!system) {
      return { isValid: false, errors: [`Communication System '${systemId}' not found.`] };
    }

    const errors: string[] = [];

    // Verify all nodes bound to this system have valid P3 components
    const nodes = this.registry.getAllNodes().filter(n => n.communicationSystemId === systemId);
    if (nodes.length === 0) {
      errors.push(`Communication System '${systemId}' has no Communication Nodes.`);
    }

    for (const node of nodes) {
      if (!node.p3ComponentId) {
        errors.push(`Node '${node.id}' lacks an authoritative P3 Component binding.`);
      }
    }

    // Verify links connect valid interfaces
    const links = this.registry.getAllLinks().filter(l => l.communicationSystemId === systemId);
    for (const link of links) {
      const srcIface = this.registry.getInterface(link.sourceInterfaceId);
      const tgtIface = this.registry.getInterface(link.targetInterfaceId);

      if (!srcIface || !tgtIface) {
        errors.push(`Link '${link.id}' references non-existent source/target interfaces.`);
      } else if (srcIface.nodeId === tgtIface.nodeId) {
        errors.push(`Link '${link.id}' connects an interface to itself on node '${srcIface.nodeId}'.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Evaluates if a continuous communication path exists between two nodes
   */
  public verifyPathContinuity(sourceNodeId: string, destinationNodeId: string): {
    isConnected: boolean;
    pathId?: string;
  } {
    const paths = this.registry.getAllPaths().filter(
      p => p.sourceNodeId === sourceNodeId && p.destinationNodeId === destinationNodeId
    );

    if (paths.length > 0) {
      return { isConnected: true, pathId: paths[0].id };
    }

    return { isConnected: false };
  }
}
