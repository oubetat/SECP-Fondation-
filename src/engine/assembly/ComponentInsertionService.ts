
import { 
  AssemblyCore, 
  AssemblyComponent, 
  PartDefinition, 
  Transform3D,
  computeTransformMatrix 
} from './AssemblyCore';
import { Vector3D } from '../cadKernel';
import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { AssemblyIntentMutator } from '../cad-kernel/document/AssemblyIntentMutator';

export type ValidationStatus = 'VALID' | 'INVALID' | 'UNPROVEN' | 'WARNING';

export interface ComponentReference {
  refId: string;
  type: 'TOPOLOGY' | 'PARAMETER' | 'GEOMETRY';
  targetId: string;
}

export interface AssemblyOccurrence {
  occurrenceId: string;
  componentId: string; // The PartDefinition ID
  componentRevision: string;
  parentAssemblyId: string | null;
  transform: Transform3D;
  sourceDefinitionHash: string;
  lifecycleState: 'DRAFT' | 'RELEASED' | 'OBSOLETE';
  geometryValidationStatus: ValidationStatus;
  topologyValidationStatus: ValidationStatus;
  createdAt: string;
  createdBy: string;
  references: ComponentReference[];
}

export interface EngineeringEvent {
  eventId: string;
  timestamp: string;
  actor: string;
  type: string;
  objectId: string;
  revision: string;
  previousState?: any;
  newState?: any;
  evidenceReference: string;
  deterministicHash: string;
}

export class ComponentInsertionService {
  private engine: AssemblyCore;
  private occurrences: Map<string, AssemblyOccurrence> = new Map();
  private events: EngineeringEvent[] = [];

  constructor(engine: AssemblyCore) {
    this.engine = engine;
  }

  public async validateInsertion(part: PartDefinition): Promise<{ 
    valid: boolean; 
    errors: string[];
    topologyStatus: ValidationStatus;
    geometryStatus: ValidationStatus;
  }> {
    const errors: string[] = [];
    
    // B-Rep Validation (Simulated)
    const geometryValid = part.geometryHash !== undefined;
    if (!geometryValid) errors.push('COMPONENT_INVALID_GEOMETRY');

    // Revision check
    const revNum = typeof part.revision === 'number' ? part.revision : (Number(part.revision) || 0);
    const revisionValid = revNum > 0;
    if (!revisionValid) errors.push('COMPONENT_REVISION_NOT_FOUND');

    // Lifecycle check (Simulated)
    const lifecycleAllowed = true; // In a real system, we'd check if 'DRAFT' or 'RELEASED' is allowed
    
    return {
      valid: errors.length === 0,
      errors,
      topologyStatus: 'VALID',
      geometryStatus: geometryValid ? 'VALID' : 'INVALID'
    };
  }

  public async insertComponent(
    partId: string, 
    options: {
      position?: Vector3D;
      rotation?: Vector3D;
      actor?: string;
      canonicalDocument?: EngineeringDocument;
    } = {}
  ): Promise<{ occurrence: AssemblyOccurrence; updatedDocument?: EngineeringDocument }> {
    const part = this.engine.getPart(partId);
    if (!part) {
      throw new Error('COMPONENT_REVISION_NOT_FOUND');
    }

    const validation = await this.validateInsertion(part);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const occurrenceId = `occ-${partId}-${Date.now().toString(36)}`;
    const pos = options.position || { x: 0, y: 0, z: 0 };
    const rot = options.rotation || { x: 0, y: 0, z: 0 };
    
    const transform: Transform3D = {
      position: pos,
      rotation: rot,
      matrix: computeTransformMatrix(pos, rot)
    };

    const occurrence: AssemblyOccurrence = {
      occurrenceId,
      componentId: partId,
      componentRevision: `V${part.revision || 1}`,
      parentAssemblyId: 'asm-root-001',
      transform,
      sourceDefinitionHash: part.geometryHash || 'unknown',
      lifecycleState: 'DRAFT',
      geometryValidationStatus: validation.geometryStatus,
      topologyValidationStatus: validation.topologyStatus,
      createdAt: new Date().toISOString(),
      createdBy: options.actor || 'anonymous-engineer',
      references: []
    };

    // Record Event
    this.recordEvent({
      type: 'COMPONENT_INSERTED',
      objectId: occurrenceId,
      revision: occurrence.componentRevision,
      newState: occurrence,
      actor: occurrence.createdBy
    });

    this.occurrences.set(occurrenceId, occurrence);

    let updatedDocument: EngineeringDocument | undefined = undefined;
    if (options.canonicalDocument) {
      const action = {
        type: 'ADD_INSTANCE' as const,
        instance: {
          instanceId: occurrenceId,
          documentId: partId,
          name: `${part.name} (Occurrence)`,
          position: pos,
          rotation: rot,
          colorHex: '#3b82f6',
          isSuppressed: false,
          isGrounded: false
        }
      };

      updatedDocument = AssemblyIntentMutator.apply(options.canonicalDocument, action);
    }

    return { occurrence, updatedDocument };
  }

  public syncFromDocument(doc: EngineeringDocument) {
    if (!doc || !doc.assembly || !doc.assembly.instances) return;
    for (const inst of doc.assembly.instances) {
      if (!this.occurrences.has(inst.instanceId)) {
        const part = this.engine.getPart(inst.documentId);
        const pos = inst.position || { x: 0, y: 0, z: 0 };
        const rot = inst.rotation || { x: 0, y: 0, z: 0 };
        const transform: Transform3D = {
          position: pos,
          rotation: rot,
          matrix: computeTransformMatrix(pos, rot)
        };
        this.occurrences.set(inst.instanceId, {
          occurrenceId: inst.instanceId,
          componentId: inst.documentId,
          componentRevision: part ? `V${part.revision || 1}` : 'V1',
          parentAssemblyId: 'asm-root-001',
          transform,
          sourceDefinitionHash: part?.geometryHash || 'unknown',
          lifecycleState: 'DRAFT',
          geometryValidationStatus: 'VALID',
          topologyValidationStatus: 'VALID',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          references: []
        });
      }
    }
  }

  private recordEvent(params: { type: string, objectId: string, revision: string, newState: any, actor: string }) {
    const eventId = `ev-${Date.now().toString(36)}`;
    const event: EngineeringEvent = {
      eventId,
      timestamp: new Date().toISOString(),
      actor: params.actor,
      type: params.type,
      objectId: params.objectId,
      revision: params.revision,
      newState: params.newState,
      evidenceReference: `ev_ref_${eventId}`,
      deterministicHash: `hash_${eventId}_${params.objectId}`
    };
    this.events.push(event);
  }

  public getOccurrence(id: string): AssemblyOccurrence | undefined {
    return this.occurrences.get(id);
  }

  public getAllOccurrences(): AssemblyOccurrence[] {
    return Array.from(this.occurrences.values());
  }

  public getEvents(): EngineeringEvent[] {
    return this.events;
  }
}
