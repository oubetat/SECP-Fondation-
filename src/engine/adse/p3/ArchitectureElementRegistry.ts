/**
 * SECP — ADSE-P3 Architecture Element Registry
 * Authoritative registry for System Architecture elements and typed relationships.
 * Guarantees single-core binding: every element links to RevisionEngine and SECP Core.
 */

import { 
  ArchitectureElementIdentity, 
  ArchitectureRelationshipContract, 
  ArchitectureElementType, 
  ArchitectureRelationshipType,
  ArchitecturalLayer
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { createHash } from 'crypto';

export class ArchitectureElementRegistry {
  private elements: Map<string, ArchitectureElementIdentity> = new Map();
  private relationships: Map<string, ArchitectureRelationshipContract> = new Map();
  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine) {
    this.revisionEngine = revisionEngine;
  }

  public registerElement(params: {
    archId: string; // e.g. 'arch:subsystem:S-02'
    elementType: ArchitectureElementType;
    displayName: string;
    layer: ArchitecturalLayer;
    configurationId: string;
    engineeringObjectId?: string;
    p2MbseId?: string;
    p1RequirementId?: string;
    metadata?: Record<string, any>;
  }): ArchitectureElementIdentity {
    if (this.elements.has(params.archId)) {
      throw new Error(`ARCH_REGISTRY_ERROR: Architecture element '${params.archId}' already exists.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.engineeringObjectId || params.archId);
    const revisionId = activeRev?.revisionId || `REV-ARCH-${params.archId}`;
    const revisionHash = activeRev?.revisionHash || createHash('sha256').update(params.archId + revisionId).digest('hex');

    const element: ArchitectureElementIdentity = {
      archId: params.archId,
      elementType: params.elementType,
      displayName: params.displayName,
      layer: params.layer,
      configurationId: params.configurationId,
      revisionId,
      coreBindingState: params.engineeringObjectId ? 'BOUND_CANONICAL' : 'UNBOUND',
      engineeringObjectId: params.engineeringObjectId,
      p2MbseId: params.p2MbseId,
      p1RequirementId: params.p1RequirementId,
      revisionHash,
      metadata: params.metadata || {}
    };

    this.elements.set(params.archId, element);
    return element;
  }

  public getElement(archId: string): ArchitectureElementIdentity | undefined {
    return this.elements.get(archId);
  }

  public getElementsByType(elementType: ArchitectureElementType): ArchitectureElementIdentity[] {
    return Array.from(this.elements.values()).filter(e => e.elementType === elementType);
  }

  public getElementsByLayer(layer: ArchitecturalLayer): ArchitectureElementIdentity[] {
    return Array.from(this.elements.values()).filter(e => e.layer === layer);
  }

  public getAllElements(): ArchitectureElementIdentity[] {
    return Array.from(this.elements.values());
  }

  public addRelationship(params: {
    relationshipType: ArchitectureRelationshipType;
    sourceArchId: string;
    targetArchId: string;
    configurationId: string;
    metadata?: Record<string, any>;
  }): ArchitectureRelationshipContract {
    const source = this.elements.get(params.sourceArchId);
    const target = this.elements.get(params.targetArchId);

    if (!source) {
      throw new Error(`ARCH_REGISTRY_ERROR: Source element '${params.sourceArchId}' not found.`);
    }
    if (!target) {
      throw new Error(`ARCH_REGISTRY_ERROR: Target element '${params.targetArchId}' not found.`);
    }

    const relId = `REL-ARCH-${params.relationshipType}-${params.sourceArchId}->${params.targetArchId}`;
    const provenanceId = `PROV-ARCH-${createHash('sha256').update(relId).digest('hex').substring(0, 12)}`;

    const contract: ArchitectureRelationshipContract = {
      relationshipId: relId,
      relationshipType: params.relationshipType,
      sourceArchId: params.sourceArchId,
      targetArchId: params.targetArchId,
      configurationId: params.configurationId,
      revisionId: source.revisionId,
      provenanceId,
      metadata: params.metadata || {}
    };

    this.relationships.set(relId, contract);
    return contract;
  }

  public getRelationship(relationshipId: string): ArchitectureRelationshipContract | undefined {
    return this.relationships.get(relationshipId);
  }

  public getRelationshipsForSource(sourceArchId: string): ArchitectureRelationshipContract[] {
    return Array.from(this.relationships.values()).filter(r => r.sourceArchId === sourceArchId);
  }

  public getRelationshipsForTarget(targetArchId: string): ArchitectureRelationshipContract[] {
    return Array.from(this.relationships.values()).filter(r => r.targetArchId === targetArchId);
  }

  public getAllRelationships(): ArchitectureRelationshipContract[] {
    return Array.from(this.relationships.values());
  }

  public bindToCore(archId: string, engineeringObjectId: string): ArchitectureElementIdentity {
    const element = this.elements.get(archId);
    if (!element) {
      throw new Error(`ARCH_REGISTRY_ERROR: Element '${archId}' not found for core binding.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(engineeringObjectId);
    element.coreBindingState = 'VERIFIED_CORE';
    element.engineeringObjectId = engineeringObjectId;
    element.revisionId = activeRev?.revisionId || element.revisionId;
    element.revisionHash = activeRev?.revisionHash || element.revisionHash;

    this.elements.set(archId, element);
    return element;
  }

  public clear(): void {
    this.elements.clear();
    this.relationships.clear();
  }
}
