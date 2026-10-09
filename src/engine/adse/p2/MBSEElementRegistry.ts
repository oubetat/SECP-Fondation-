/**
 * SECP — ADSE-P2 MBSE Element Registry
 * Authoritative registry for MBSE / SysML semantic elements.
 * Maintains zero dual-core state: every element references SECP Core & RevisionEngine.
 */

import { 
  MBSEElementIdentity, 
  MBSERelationshipContract, 
  MBSEElementType, 
  MBSERelationshipType,
  MBSESemanticCategory,
  CoreBindingState
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { createHash } from 'crypto';

export class MBSEElementRegistry {
  private elements: Map<string, MBSEElementIdentity> = new Map();
  private relationships: Map<string, MBSERelationshipContract> = new Map();
  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine) {
    this.revisionEngine = revisionEngine;
  }

  /**
   * Registers a new MBSE Element or binds an existing P1 requirement / system model element.
   */
  public registerElement(params: {
    mbseId: string;
    elementType: MBSEElementType;
    displayName: string;
    category: MBSESemanticCategory;
    configurationId: string;
    engineeringObjectId?: string;
    metadata?: Record<string, any>;
  }): MBSEElementIdentity {
    const activeRevision = this.revisionEngine.getLatestRevision(params.engineeringObjectId || params.mbseId);
    const revisionId = activeRevision?.revisionId || `REV-MBSE-${params.mbseId}`;
    const revisionHash = activeRevision?.revisionHash || createHash('sha256').update(params.mbseId + revisionId).digest('hex');

    const element: MBSEElementIdentity = {
      mbseId: params.mbseId,
      elementType: params.elementType,
      displayName: params.displayName,
      category: params.category,
      configurationId: params.configurationId,
      revisionId,
      coreBindingState: params.engineeringObjectId ? 'BOUND_CANONICAL' : 'UNBOUND',
      engineeringObjectId: params.engineeringObjectId,
      revisionHash,
      metadata: params.metadata || {}
    };

    this.elements.set(params.mbseId, element);
    return element;
  }

  /**
   * Returns an MBSE element by ID.
   */
  public getElement(mbseId: string): MBSEElementIdentity | undefined {
    return this.elements.get(mbseId);
  }

  /**
   * Retrieves all elements of a specific type or category.
   */
  public getElementsByType(elementType: MBSEElementType): MBSEElementIdentity[] {
    return Array.from(this.elements.values()).filter(e => e.elementType === elementType);
  }

  public getElementsByCategory(category: MBSESemanticCategory): MBSEElementIdentity[] {
    return Array.from(this.elements.values()).filter(e => e.category === category);
  }

  public getAllElements(): MBSEElementIdentity[] {
    return Array.from(this.elements.values());
  }

  /**
   * Establishes a directed semantic relationship between two MBSE elements.
   */
  public addRelationship(params: {
    relationshipType: MBSERelationshipType;
    sourceMbseId: string;
    targetMbseId: string;
    configurationId: string;
    cardinality?: '1:1' | '1:N' | 'N:1' | 'N:M';
    provenanceId?: string;
  }): MBSERelationshipContract {
    const source = this.elements.get(params.sourceMbseId);
    const target = this.elements.get(params.targetMbseId);

    if (!source) {
      throw new Error(`MBSE_REGISTRY_ERROR: Source element '${params.sourceMbseId}' does not exist.`);
    }
    if (!target) {
      throw new Error(`MBSE_REGISTRY_ERROR: Target element '${params.targetMbseId}' does not exist.`);
    }

    const relId = `REL-${params.relationshipType}-${params.sourceMbseId}->${params.targetMbseId}`;
    const provenanceId = params.provenanceId || `PROV-MBSE-${createHash('sha256').update(relId).digest('hex').substring(0, 12)}`;

    const contract: MBSERelationshipContract = {
      relationshipId: relId,
      relationshipType: params.relationshipType,
      sourceMbseId: params.sourceMbseId,
      targetMbseId: params.targetMbseId,
      configurationId: params.configurationId,
      revisionId: source.revisionId,
      cardinality: params.cardinality || '1:1',
      provenanceId,
      isCustomValid: true
    };

    this.relationships.set(relId, contract);
    return contract;
  }

  public getRelationship(relationshipId: string): MBSERelationshipContract | undefined {
    return this.relationships.get(relationshipId);
  }

  public getRelationshipsForSource(sourceMbseId: string): MBSERelationshipContract[] {
    return Array.from(this.relationships.values()).filter(r => r.sourceMbseId === sourceMbseId);
  }

  public getRelationshipsForTarget(targetMbseId: string): MBSERelationshipContract[] {
    return Array.from(this.relationships.values()).filter(r => r.targetMbseId === targetMbseId);
  }

  public getAllRelationships(): MBSERelationshipContract[] {
    return Array.from(this.relationships.values());
  }

  /**
   * Binds an MBSE Element directly to a canonical SECP Core object.
   */
  public bindToCore(mbseId: string, engineeringObjectId: string): MBSEElementIdentity {
    const element = this.elements.get(mbseId);
    if (!element) {
      throw new Error(`MBSE_REGISTRY_ERROR: Element '${mbseId}' not found for core binding.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(engineeringObjectId);
    element.coreBindingState = 'VERIFIED_CORE';
    element.engineeringObjectId = engineeringObjectId;
    element.revisionId = activeRev?.revisionId || element.revisionId;
    element.revisionHash = activeRev?.revisionHash || element.revisionHash;

    this.elements.set(mbseId, element);
    return element;
  }

  public clear(): void {
    this.elements.clear();
    this.relationships.clear();
  }
}
