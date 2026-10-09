/**
 * SECP — ADSE-P3 System Decomposition Engine
 * Handles hierarchical system architecture breakdown: System -> Subsystems -> Components
 * Enforces typed decomposition relationships and boundary containment rules.
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureElementIdentity, ArchitectureRelationshipContract } from './types';

export class ArchitectureDecompositionEngine {
  private registry: ArchitectureElementRegistry;

  constructor(registry: ArchitectureElementRegistry) {
    this.registry = registry;
  }

  public decompose(params: {
    parentArchId: string;
    childArchId: string;
    configurationId: string;
  }): {
    parent: ArchitectureElementIdentity;
    child: ArchitectureElementIdentity;
    relationship: ArchitectureRelationshipContract;
  } {
    const parent = this.registry.getElement(params.parentArchId);
    const child = this.registry.getElement(params.childArchId);

    if (!parent) {
      throw new Error(`DECOMPOSITION_ERROR: Parent element '${params.parentArchId}' not found.`);
    }
    if (!child) {
      throw new Error(`DECOMPOSITION_ERROR: Child element '${params.childArchId}' not found.`);
    }

    // Layer hierarchy validation: System -> Subsystem -> Component
    if (parent.layer === 'SYSTEM' && child.layer !== 'SUBSYSTEM') {
      throw new Error(`DECOMPOSITION_RULE_VIOLATION: System '${parent.archId}' can only directly decompose into Subsystems. Got '${child.layer}'.`);
    }
    if (parent.layer === 'SUBSYSTEM' && child.layer !== 'COMPONENT' && child.layer !== 'SUBCOMPONENT') {
      throw new Error(`DECOMPOSITION_RULE_VIOLATION: Subsystem '${parent.archId}' can only decompose into Components. Got '${child.layer}'.`);
    }
    if (parent.layer === 'COMPONENT' && child.layer !== 'SUBCOMPONENT') {
      throw new Error(`DECOMPOSITION_RULE_VIOLATION: Component '${parent.archId}' can only decompose into Subcomponents. Got '${child.layer}'.`);
    }

    const rel = this.registry.addRelationship({
      relationshipType: 'DECOMPOSES',
      sourceArchId: params.parentArchId,
      targetArchId: params.childArchId,
      configurationId: params.configurationId
    });

    // Also add reciprocal PART_OF
    this.registry.addRelationship({
      relationshipType: 'PART_OF',
      sourceArchId: params.childArchId,
      targetArchId: params.parentArchId,
      configurationId: params.configurationId
    });

    return { parent, child, relationship: rel };
  }

  public getChildren(parentArchId: string): ArchitectureElementIdentity[] {
    const rels = this.registry.getRelationshipsForSource(parentArchId)
      .filter(r => r.relationshipType === 'DECOMPOSES' || r.relationshipType === 'CONTAINS');
    return rels
      .map(r => this.registry.getElement(r.targetArchId))
      .filter((e): e is ArchitectureElementIdentity => e !== undefined);
  }

  public getParent(childArchId: string): ArchitectureElementIdentity | undefined {
    const rels = this.registry.getRelationshipsForSource(childArchId)
      .filter(r => r.relationshipType === 'PART_OF');
    if (rels.length === 0) return undefined;
    return this.registry.getElement(rels[0].targetArchId);
  }

  public getDecompositionTree(rootArchId: string): any {
    const root = this.registry.getElement(rootArchId);
    if (!root) return null;

    const buildNode = (el: ArchitectureElementIdentity): any => {
      const children = this.getChildren(el.archId);
      return {
        archId: el.archId,
        displayName: el.displayName,
        layer: el.layer,
        elementType: el.elementType,
        children: children.map(buildNode)
      };
    };

    return buildNode(root);
  }
}
