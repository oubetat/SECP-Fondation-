/**
 * SECP — ADSE-P3 Architecture Allocation & View Engine
 * Manages Component Allocations (Functions -> Components, Software -> Hardware)
 * and generates Projections of the unified architecture model into multiple views
 * (Functional, Logical, Physical, Interface, Dependency, Behavior, Configuration, Verification).
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureInterfaceEngine } from './ArchitectureInterfaceEngine';
import { ArchitectureDependencyEngine } from './ArchitectureDependencyEngine';
import { ArchitectureDecisionEngine } from './ArchitectureDecisionEngine';
import { 
  ArchitectureViewType, 
  ArchitectureViewProjection,
  ArchitectureElementIdentity,
  ArchitectureRelationshipContract 
} from './types';

export class ArchitectureViewEngine {
  private registry: ArchitectureElementRegistry;
  private interfaceEngine: ArchitectureInterfaceEngine;
  private dependencyEngine: ArchitectureDependencyEngine;
  private decisionEngine?: ArchitectureDecisionEngine;

  constructor(
    registry: ArchitectureElementRegistry,
    interfaceEngine: ArchitectureInterfaceEngine,
    dependencyEngine: ArchitectureDependencyEngine,
    decisionEngine?: ArchitectureDecisionEngine
  ) {
    this.registry = registry;
    this.interfaceEngine = interfaceEngine;
    this.dependencyEngine = dependencyEngine;
    this.decisionEngine = decisionEngine;
  }

  public setDecisionEngine(decisionEngine: ArchitectureDecisionEngine) {
    this.decisionEngine = decisionEngine;
  }

  public allocate(params: {
    sourceArchId: string;
    targetArchId: string;
    configurationId: string;
    allocationKind?: 'FUNCTION_TO_COMPONENT' | 'SOFTWARE_TO_HARDWARE' | 'LOGICAL_TO_PHYSICAL';
  }): ArchitectureRelationshipContract {
    const source = this.registry.getElement(params.sourceArchId);
    const target = this.registry.getElement(params.targetArchId);

    if (!source || !target) {
      throw new Error(`ALLOCATION_ERROR: Both source '${params.sourceArchId}' and target '${params.targetArchId}' must exist.`);
    }

    return this.registry.addRelationship({
      relationshipType: 'ALLOCATED_TO',
      sourceArchId: params.sourceArchId,
      targetArchId: params.targetArchId,
      configurationId: params.configurationId,
      metadata: { allocationKind: params.allocationKind || 'FUNCTION_TO_COMPONENT' }
    });
  }

  /**
   * Project the Single Master Architecture Model into a specific Architecture View.
   * "One Architecture Model -> Multiple Views"
   */
  public projectView(viewType: ArchitectureViewType, configurationId: string): ArchitectureViewProjection {
    const allElements = this.registry.getAllElements().filter(e => e.configurationId === configurationId);
    const allRelationships = this.registry.getAllRelationships().filter(r => r.configurationId === configurationId);
    const allInterfaces = this.interfaceEngine.getAllInterfaces().filter(i => i.configurationId === configurationId);
    const allDependencies = this.dependencyEngine.getAllDependencies().filter(d => d.configurationId === configurationId);
    const allDecisions = this.decisionEngine ? this.decisionEngine.getAllDecisions().filter(d => d.configurationId === configurationId) : [];

    let filteredElements: ArchitectureElementIdentity[] = [];
    let filteredRelationships: ArchitectureRelationshipContract[] = [];

    switch (viewType) {
      case 'FUNCTIONAL':
        filteredElements = allElements.filter(e => e.p2MbseId?.includes(':fn:') || e.metadata?.isFunctional);
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'ALLOCATED_TO' || r.relationshipType === 'DECOMPOSES');
        break;

      case 'LOGICAL':
        filteredElements = allElements.filter(e => e.layer === 'SUBSYSTEM' || e.layer === 'SYSTEM');
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'DECOMPOSES' || r.relationshipType === 'PART_OF');
        break;

      case 'PHYSICAL':
        filteredElements = allElements.filter(e => e.layer === 'COMPONENT' || e.layer === 'SUBCOMPONENT');
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'CONTAINS' || r.relationshipType === 'PART_OF');
        break;

      case 'INTERFACE':
        filteredElements = allElements.filter(e => {
          return allInterfaces.some(i => i.providerArchId === e.archId || i.consumerArchId === e.archId);
        });
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'INTERFACES_WITH');
        break;

      case 'DEPENDENCY':
        filteredElements = allElements.filter(e => {
          return allDependencies.some(d => d.sourceArchId === e.archId || d.targetArchId === e.archId);
        });
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'DEPENDS_ON');
        break;

      case 'CONFIGURATION':
        filteredElements = allElements;
        filteredRelationships = allRelationships;
        break;

      case 'VERIFICATION':
        filteredElements = allElements.filter(e => e.p1RequirementId || e.metadata?.verificationIntentId);
        filteredRelationships = allRelationships.filter(r => r.relationshipType === 'VERIFIED_BY' || r.relationshipType === 'SATISFIES');
        break;

      default:
        filteredElements = allElements;
        filteredRelationships = allRelationships;
        break;
    }

    return {
      viewType,
      configurationId,
      elements: filteredElements,
      relationships: filteredRelationships,
      interfaces: (viewType === 'INTERFACE' || viewType === 'LOGICAL') ? allInterfaces : [],
      dependencies: (viewType === 'DEPENDENCY' || viewType === 'LOGICAL') ? allDependencies : [],
      decisions: allDecisions
    };
  }
}
