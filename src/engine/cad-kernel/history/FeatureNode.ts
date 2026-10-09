/**
 * SECP CAD Kernel — Feature Node & Deterministic Identity
 * Phase 2 (PATCH-KERNEL-003)
 *
 * ARCHITECTURAL CONTRACT:
 * - Feature identity is strictly deterministic, replay-stable, independent of array position,
 *   and free of wall-clock time (zero Date.now()) or random numbers.
 * - Derived from (documentId + featureType + sequence + canonical definition hash).
 * - Full canonical contract:
 *   interface FeatureNode {
 *       featureId: StableFeatureId;
 *       type: FeatureType;
 *       parameters: Record<string, number | string>;
 *       parents: FeatureId[];
 *       inputs: TopologyReference[];
 *       outputs: TopologyReference[];
 *       resultSolidId?: SolidId;
 *       status: "DIRTY" | "EVALUATING" | "VALID" | "FAILED";
 *   }
 */

import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import {
  FeatureType,
  CanonicalFeatureDefinition,
  GeometryReference,
  TopologyReference,
  CanonicalParameterSet
} from './FeatureDefinition';
import { PersistentTopologyNaming } from '../topology/PersistentTopologyNaming';
import { FeatureState, RegenerationStatus } from './FeatureState';
import type {
  FeatureNode as IFeatureNode,
  FeatureNodeStatus,
  StableFeatureId,
  FeatureId,
  SolidId
} from './HistoryContracts';

export { FeatureId, StableFeatureId, SolidId, FeatureNodeStatus };

export interface FeatureNodeParams {
  id?: FeatureId;
  documentId: string;
  type: FeatureType;
  name: string;
  definition: CanonicalFeatureDefinition;
  sequence: number;
  dependencyIds?: FeatureId[];
  parentId?: FeatureId;
  suppressed?: boolean;
}

export class FeatureNode implements IFeatureNode {
  public readonly id: FeatureId;
  public readonly featureId: StableFeatureId;
  public readonly documentId: string;
  public type: FeatureType;
  public name: string;
  public definition: CanonicalFeatureDefinition;
  public parameters: CanonicalParameterSet;
  public inputReferences: TopologyReference[];
  public dependencyIds: FeatureId[];
  public outputReferences: TopologyReference[];
  public parentId?: FeatureId;
  public sequence: number;
  public state: FeatureState;
  public suppressed: boolean;
  public regenerationStatus: RegenerationStatus;
  public provenanceReference?: string;
  public outputGeometry?: any;
  public definitionHash: string;

  // Canonical Phase 2 (PATCH-KERNEL-003) Properties
  public resultSolidId?: SolidId;
  public status: FeatureNodeStatus;

  public get parents(): FeatureId[] {
    if (this.dependencyIds && this.dependencyIds.length > 0) {
      return this.dependencyIds;
    }
    return this.parentId ? [this.parentId] : [];
  }

  public set parents(ids: FeatureId[]) {
    this.dependencyIds = [...ids];
    if (ids.length > 0) {
      this.parentId = ids[0];
    }
  }

  public get inputs(): TopologyReference[] {
    return this.inputReferences;
  }

  public set inputs(refs: TopologyReference[]) {
    this.inputReferences = refs;
  }

  public get outputs(): TopologyReference[] {
    return this.outputReferences;
  }

  public set outputs(refs: TopologyReference[]) {
    this.outputReferences = refs;
  }

  // Compatibility getter for legacy dependencies
  public get dependencies(): Array<{ dependsOnFeatureId: string }> {
    return this.parents.map(depId => ({ dependsOnFeatureId: depId }));
  }

  constructor(params: FeatureNodeParams) {
    this.documentId = params.documentId;
    this.type = params.type;
    this.name = params.name;
    this.definition = params.definition;
    this.parameters = params.definition.parameters;
    this.inputReferences = params.definition.inputReferences ? [...params.definition.inputReferences] : [];
    this.dependencyIds = params.dependencyIds ? [...params.dependencyIds] : [];
    this.outputReferences = [];
    this.parentId = params.parentId;
    this.sequence = params.sequence;
    this.suppressed = params.suppressed ?? false;
    this.state = this.suppressed ? 'SUPPRESSED' : 'DEFINED';
    this.regenerationStatus = 'PENDING';
    this.status = 'DIRTY';

    // Compute canonical definition hash
    const { canonicalHash } = EngineeringHashChain.computeCanonicalHash({
      type: this.type,
      name: this.name,
      parameters: this.parameters,
      inputReferences: this.inputReferences,
      dependencyIds: this.dependencyIds
    });
    this.definitionHash = canonicalHash;

    // Generate or assign deterministic identity
    if (params.id) {
      this.id = params.id;
    } else {
      this.id = FeatureNode.generateDeterministicId(
        this.documentId,
        this.type,
        this.sequence,
        this.definitionHash
      );
    }
    this.featureId = this.id;
  }

  /**
   * Generates a deterministic, stable, unit-testable Feature ID.
   * Conforms to SECP Canonical Identity pattern (SECP:GEOMETRY:feat_...).
   */
  public static generateDeterministicId(
    documentId: string,
    type: FeatureType,
    sequence: number,
    definitionHash: string
  ): FeatureId {
    const shortHash = definitionHash.substring(0, 12);
    const rawArtifactId = `feat_${type.toLowerCase()}_${String(sequence).padStart(3, '0')}_${shortHash}`;
    
    // Create canonical identity via factory
    const canonical = EngineeringIdentityFactory.createIdentity({
      objectType: 'GEOMETRY',
      projectId: rawArtifactId,
      parentId: documentId,
      sourceSystem: 'SECP_CAD_KERNEL',
      revisionId: 'rev-01',
      createdBy: 'system',
      seed: 'seed'
    }, {});

    return EngineeringIdentityFactory.formatCanonicalIdentity(canonical);
  }

  /**
   * Updates definition and recomputes definition hash.
   */
  public updateDefinition(newDef: CanonicalFeatureDefinition): void {
    this.definition = newDef;
    this.type = newDef.type || this.type;
    this.name = newDef.name || this.name;
    this.parameters = newDef.parameters;
    this.inputReferences = newDef.inputReferences ? [...newDef.inputReferences] : [];
    this.status = 'DIRTY';

    const { canonicalHash } = EngineeringHashChain.computeCanonicalHash({
      type: this.type,
      name: this.name,
      parameters: this.parameters,
      inputReferences: this.inputReferences,
      dependencyIds: this.dependencyIds
    });
    this.definitionHash = canonicalHash;
  }

  /**
   * Marks the feature as currently evaluating.
   */
  public markEvaluating(): void {
    this.status = 'EVALUATING';
    this.regenerationStatus = 'EXECUTING';
  }

  /**
   * Marks the feature as successfully validated with output geometry and solid ID.
   */
  public markValid(outputGeometry: any, solidId?: SolidId): void {
    this.status = 'VALID';
    this.state = 'VALID';
    this.regenerationStatus = 'UP_TO_DATE';
    this.outputGeometry = outputGeometry;
    this.resultSolidId = solidId || (outputGeometry && typeof outputGeometry === 'object' && outputGeometry.id ? outputGeometry.id : undefined);

    // If output is a Solid with outer shell, populate output persistent topology references
    if (outputGeometry && outputGeometry.outerShell && Array.isArray(outputGeometry.outerShell.orientedFaces)) {
      PersistentTopologyNaming.assignPersistentTopology(outputGeometry, this.featureId);
      this.outputReferences = PersistentTopologyNaming.extractOutputReferences(outputGeometry, this.featureId);
    } else if (this.resultSolidId) {
      this.outputReferences = [{
        entityType: 'SOLID',
        persistentId: `${this.featureId}:SOLID:Main`,
        lineage: {
          createdByFeature: this.featureId,
          sourceEntities: ['Solid'],
          geometricSignature: `SOLID|ID:${this.resultSolidId}`
        },
        type: 'SOLID',
        targetFeatureId: this.featureId,
        entityId: this.resultSolidId,
        persistentTag: `${this.featureId}:SOLID:Main`
      }];
    }
  }

  /**
   * Marks the feature evaluation as failed.
   */
  public markFailed(): void {
    this.status = 'FAILED';
    this.state = 'FAILED';
    this.regenerationStatus = 'FAILED';
    this.outputGeometry = undefined;
    this.resultSolidId = undefined;
  }
}
