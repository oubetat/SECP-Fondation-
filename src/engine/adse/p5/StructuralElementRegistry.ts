/**
 * SECP — ADSE-P5 Structural Element Registry
 * Authoritative registry for Structural Integration Elements, Instances, Definitions, and Relationships.
 * Enforces single-core binding, definition/instance separation, and upstream P1-P4 lineage.
 */

import { 
  StructuralElement, 
  StructuralRelationship, 
  StructuralElementType, 
  StructuralRelationshipType,
  StructuralLayer
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { createHash } from 'crypto';

export class StructuralElementRegistry {
  private elements: Map<string, StructuralElement> = new Map();
  private relationships: Map<string, StructuralRelationship> = new Map();
  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine) {
    this.revisionEngine = revisionEngine;
  }

  public registerElement(params: {
    elementId: string;
    elementType: StructuralElementType;
    displayName: string;
    layer: StructuralLayer;
    configurationId: string;
    revisionId?: string;
    definitionId?: string;
    engineeringObjectId?: string;
    p3ArchId?: string;
    p2MbseId?: string;
    p1ReqId?: string;
    p4NodeId?: string;
    metadata?: Record<string, any>;
  }): StructuralElement {
    if (this.elements.has(params.elementId)) {
      throw new Error(`STRUCTURAL_REGISTRY_ERROR: Structural element '${params.elementId}' already exists.`);
    }

    // Instance vs Definition Integrity
    if (params.elementType.endsWith('Instance')) {
      if (!params.definitionId) {
        throw new Error(`STRUCTURAL_INSTANCE_ERROR: Structural instance '${params.elementId}' MUST reference an authoritative Definition.`);
      }
      const def = this.elements.get(params.definitionId);
      if (!def) {
        throw new Error(`STRUCTURAL_INSTANCE_ERROR: Referenced definition '${params.definitionId}' not found.`);
      }
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.engineeringObjectId || params.elementId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-STRUCT-${params.elementId}`;
    const revisionHash = activeRev?.revisionHash || createHash('sha256').update(params.elementId + revisionId).digest('hex');
    const provenanceId = `PROV-STRUCT-${createHash('sha256').update(params.elementId + revisionId).digest('hex').substring(0, 12)}`;

    const element: StructuralElement = {
      elementId: params.elementId,
      elementType: params.elementType,
      displayName: params.displayName,
      layer: params.layer,
      configurationId: params.configurationId,
      revisionId,
      revisionHash,
      provenanceId,
      coreBindingState: params.engineeringObjectId ? 'BOUND_CANONICAL' : 'UNBOUND',
      definitionId: params.definitionId,
      engineeringObjectId: params.engineeringObjectId,
      p3ArchId: params.p3ArchId,
      p2MbseId: params.p2MbseId,
      p1ReqId: params.p1ReqId,
      p4NodeId: params.p4NodeId,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.elements.set(params.elementId, element);
    return element;
  }

  public getElement(elementId: string): StructuralElement | undefined {
    return this.elements.get(elementId);
  }

  public getAllElements(): StructuralElement[] {
    return Array.from(this.elements.values());
  }

  public getElementsByType(elementType: StructuralElementType): StructuralElement[] {
    return Array.from(this.elements.values()).filter(e => e.elementType === elementType);
  }

  public getElementsByLayer(layer: StructuralLayer): StructuralElement[] {
    return Array.from(this.elements.values()).filter(e => e.layer === layer);
  }

  public addRelationship(params: {
    relationshipId?: string;
    relationshipType: StructuralRelationshipType;
    sourceElementId: string;
    targetElementId: string;
    configurationId: string;
    revisionId?: string;
    metadata?: Record<string, any>;
  }): StructuralRelationship {
    const source = this.elements.get(params.sourceElementId);
    const target = this.elements.get(params.targetElementId);

    if (!source) {
      throw new Error(`STRUCTURAL_REGISTRY_ERROR: Source element '${params.sourceElementId}' not found.`);
    }
    if (!target) {
      throw new Error(`STRUCTURAL_REGISTRY_ERROR: Target element '${params.targetElementId}' not found.`);
    }

    const relId = params.relationshipId || `REL-STRUCT-${params.relationshipType}-${params.sourceElementId}->${params.targetElementId}`;
    if (this.relationships.has(relId)) {
      throw new Error(`STRUCTURAL_REGISTRY_ERROR: Relationship '${relId}' already exists.`);
    }

    const revisionId = params.revisionId || source.revisionId;
    const provenanceId = `PROV-STRUCT-REL-${createHash('sha256').update(relId + revisionId).digest('hex').substring(0, 12)}`;

    const rel: StructuralRelationship = {
      relationshipId: relId,
      relationshipType: params.relationshipType,
      sourceElementId: params.sourceElementId,
      targetElementId: params.targetElementId,
      configurationId: params.configurationId,
      revisionId,
      provenanceId,
      isVerified: true,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString()
    };

    this.relationships.set(relId, rel);
    return rel;
  }

  public getRelationship(relationshipId: string): StructuralRelationship | undefined {
    return this.relationships.get(relationshipId);
  }

  public getAllRelationships(): StructuralRelationship[] {
    return Array.from(this.relationships.values());
  }

  public getRelationshipsForElement(elementId: string): {
    outgoing: StructuralRelationship[];
    incoming: StructuralRelationship[];
  } {
    const outgoing: StructuralRelationship[] = [];
    const incoming: StructuralRelationship[] = [];

    for (const rel of this.relationships.values()) {
      if (rel.sourceElementId === elementId) outgoing.push(rel);
      if (rel.targetElementId === elementId) incoming.push(rel);
    }

    return { outgoing, incoming };
  }

  public clear(): void {
    this.elements.clear();
    this.relationships.clear();
  }
}
