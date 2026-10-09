/**
 * SECP — ADSE-P2 MBSE Semantic Graph
 * Graph navigation, traceability queries, and impact pathways across the MBSE model.
 */

import { MBSEElementRegistry } from './MBSEElementRegistry';
import { 
  MBSEElementIdentity, 
  MBSERelationshipContract, 
  MBSERelationshipType 
} from './types';

export class MBSESemanticGraph {
  private registry: MBSEElementRegistry;

  constructor(registry: MBSEElementRegistry) {
    this.registry = registry;
  }

  /**
   * Which requirements constrain this subsystem?
   * Traverses ALLOCATES, COMPOSES, or CONSTRAINS relationships backwards to P1 / P2 requirements.
   */
  public getRequirementsConstrainingSubsystem(subsystemMbseId: string): MBSEElementIdentity[] {
    const constraining: MBSEElementIdentity[] = [];
    const relsTargetingSubsystem = this.registry.getRelationshipsForTarget(subsystemMbseId);

    for (const rel of relsTargetingSubsystem) {
      if (rel.relationshipType === 'CONSTRAINS' || rel.relationshipType === 'SATISFIES' || rel.relationshipType === 'ALLOCATES') {
        const sourceElem = this.registry.getElement(rel.sourceMbseId);
        if (sourceElem && (sourceElem.category === 'REQUIREMENT' || sourceElem.elementType === 'Requirement' || sourceElem.elementType === 'ConstraintBlock')) {
          constraining.push(sourceElem);
        }
      }
    }

    // Also check components composed under this subsystem
    const componentRels = this.registry.getRelationshipsForSource(subsystemMbseId)
      .filter(r => r.relationshipType === 'COMPOSES');
    for (const compRel of componentRels) {
      const compTarget = compRel.targetMbseId;
      const compConstraining = this.getRequirementsConstrainingSubsystem(compTarget);
      for (const req of compConstraining) {
        if (!constraining.some(r => r.mbseId === req.mbseId)) {
          constraining.push(req);
        }
      }
    }

    return constraining;
  }

  /**
   * Which functions realize this requirement?
   */
  public getFunctionsRealizingRequirement(requirementMbseId: string): MBSEElementIdentity[] {
    const functions: MBSEElementIdentity[] = [];
    const relsTargetingReq = this.registry.getRelationshipsForTarget(requirementMbseId);

    for (const rel of relsTargetingReq) {
      if (rel.relationshipType === 'SATISFIES' || rel.relationshipType === 'IMPLEMENTS' || rel.relationshipType === 'PERFORMS') {
        const source = this.registry.getElement(rel.sourceMbseId);
        if (source && (source.elementType === 'Function' || source.elementType === 'Activity' || source.elementType === 'Behavior')) {
          functions.push(source);
        }
      }
    }

    const relsSourcedByReq = this.registry.getRelationshipsForSource(requirementMbseId);
    for (const rel of relsSourcedByReq) {
      if (rel.relationshipType === 'REFINES' || rel.relationshipType === 'DERIVES_FROM') {
        const target = this.registry.getElement(rel.targetMbseId);
        if (target && (target.elementType === 'Function' || target.elementType === 'Activity')) {
          functions.push(target);
        }
      }
    }

    return functions;
  }

  /**
   * Which interfaces connect component A to component B?
   */
  public getInterfacesConnectingComponents(componentAMbseId: string, componentBMbseId: string): MBSEElementIdentity[] {
    const interfaces: MBSEElementIdentity[] = [];
    const sourceRels = this.registry.getRelationshipsForSource(componentAMbseId);

    for (const rel of sourceRels) {
      if (rel.relationshipType === 'CONNECTS' && rel.targetMbseId === componentBMbseId) {
        const elem = this.registry.getElement(rel.sourceMbseId);
        if (elem && (elem.elementType === 'Interface' || elem.elementType === 'Connector')) {
          interfaces.push(elem);
        }
      }
    }

    // Also check ports under Component A connected to ports under Component B
    const portAMbseIds = this.registry.getRelationshipsForSource(componentAMbseId)
      .filter(r => r.relationshipType === 'COMPOSES' || r.relationshipType === 'CONNECTS')
      .map(r => r.targetMbseId);

    const portBMbseIds = this.registry.getRelationshipsForSource(componentBMbseId)
      .filter(r => r.relationshipType === 'COMPOSES' || r.relationshipType === 'CONNECTS')
      .map(r => r.targetMbseId);

    for (const pA of portAMbseIds) {
      for (const pB of portBMbseIds) {
        const connRels = this.registry.getRelationshipsForSource(pA).filter(r => r.targetMbseId === pB);
        for (const cRel of connRels) {
          const interfaceElem = this.registry.getElement(cRel.sourceMbseId);
          if (interfaceElem && !interfaces.some(i => i.mbseId === interfaceElem.mbseId)) {
            interfaces.push(interfaceElem);
          }
        }
      }
    }

    return interfaces;
  }

  /**
   * Which item flows traverse this port?
   */
  public getItemFlowsTraversingPort(portMbseId: string): MBSEElementIdentity[] {
    const flows: MBSEElementIdentity[] = [];
    const allFlows = this.registry.getElementsByType('ItemFlow');

    for (const flow of allFlows) {
      const rels = this.registry.getRelationshipsForSource(flow.mbseId);
      const targetsPort = rels.some(r => r.targetMbseId === portMbseId || r.sourceMbseId === portMbseId);
      if (targetsPort) {
        flows.push(flow);
      }
    }

    return flows;
  }

  /**
   * Multi-hop upstream graph traversal from an element.
   */
  public getUpstreamTraceability(startMbseId: string, maxDepth: number = 5): Array<{ element: MBSEElementIdentity; relationship: MBSERelationshipType; depth: number }> {
    const results: Array<{ element: MBSEElementIdentity; relationship: MBSERelationshipType; depth: number }> = [];
    const visited = new Set<string>();

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const incomingRels = this.registry.getRelationshipsForTarget(currentId);
      for (const rel of incomingRels) {
        const sourceElem = this.registry.getElement(rel.sourceMbseId);
        if (sourceElem) {
          results.push({ element: sourceElem, relationship: rel.relationshipType, depth });
          traverse(rel.sourceMbseId, depth + 1);
        }
      }
    };

    traverse(startMbseId, 1);
    return results;
  }

  /**
   * Multi-hop downstream graph traversal from an element.
   */
  public getDownstreamTraceability(startMbseId: string, maxDepth: number = 5): Array<{ element: MBSEElementIdentity; relationship: MBSERelationshipType; depth: number }> {
    const results: Array<{ element: MBSEElementIdentity; relationship: MBSERelationshipType; depth: number }> = [];
    const visited = new Set<string>();

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const outgoingRels = this.registry.getRelationshipsForSource(currentId);
      for (const rel of outgoingRels) {
        const targetElem = this.registry.getElement(rel.targetMbseId);
        if (targetElem) {
          results.push({ element: targetElem, relationship: rel.relationshipType, depth });
          traverse(rel.targetMbseId, depth + 1);
        }
      }
    };

    traverse(startMbseId, 1);
    return results;
  }
}
