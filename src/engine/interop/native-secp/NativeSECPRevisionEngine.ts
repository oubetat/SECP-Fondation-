/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Native SECP Revision Engine
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Manages Native SECP document revisions with cryptographic lineage.
 * 2. Links parent revision hashes, records provenance events, preserves immutable identity.
 * 3. Never overwrites revision history silently.
 */

import { NativeSECPDocument, NativeSECPModel, NativeSECPManufacturing } from './NativeSECPTypes';
import { NativeSECPWriter } from './NativeSECPWriter';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';

export interface CreateRevisionParams {
  readonly parentDocument: NativeSECPDocument;
  readonly newRevisionId: string;
  readonly author: string;
  readonly changeSummary: string;
  readonly modelChanges?: Partial<NativeSECPModel>;
  readonly manufacturingChanges?: Partial<NativeSECPManufacturing>;
  readonly timestamp?: string;
}

export class NativeSECPRevisionEngine {

  /**
   * Creates a new immutable revision derived from a parent Native SECP document.
   */
  public static createRevision(params: CreateRevisionParams): NativeSECPDocument {
    const parent = params.parentDocument;
    const timestamp = params.timestamp || '1970-01-01T00:00:00.000Z';

    const childIdentity = EngineeringIdentityFactory.createIdentity({ 
      objectType: parent.identity.canonicalIdentity.objectType,
      projectId: parent.identity.engineeringObjectId,
      parentIdentityId: parent.identity.revisionId,
      revisionId: params.newRevisionId,
      createdBy: "system",
      seed: "seed" 
    }, {});

    const updatedModel: NativeSECPModel = {
      geometry: params.modelChanges?.geometry || parent.model.geometry,
      topology: params.modelChanges?.topology || parent.model.topology,
      features: params.modelChanges?.features || parent.model.features,
      sketches: params.modelChanges?.sketches || parent.model.sketches,
      assemblies: params.modelChanges?.assemblies || parent.model.assemblies
    };

    const updatedManufacturing: NativeSECPManufacturing = {
      features: params.manufacturingChanges?.features || parent.manufacturing.features,
      toolpaths: params.manufacturingChanges?.toolpaths || parent.manufacturing.toolpaths,
      metadata: params.manufacturingChanges?.metadata || parent.manufacturing.metadata
    };

    const newOperation = {
      operationId: `OP_REV_${params.newRevisionId}`,
      operationType: 'CREATE_REVISION',
      timestamp,
      author: params.author,
      identityRef: `${parent.identity.engineeringObjectId}:${params.newRevisionId}`,
      parameters: {
        parentRevisionId: parent.identity.revisionId,
        changeSummary: params.changeSummary,
        parentCanonicalHash: parent.integrity.canonicalHash
      }
    };

    const newRevisionRecord = {
      revisionId: params.newRevisionId,
      parentRevisionId: parent.identity.revisionId,
      createdAt: timestamp,
      author: params.author,
      changeSummary: params.changeSummary,
      canonicalHash: '' // Will be computed by NativeSECPWriter
    };

    const writeResult = NativeSECPWriter.write({
      header: {
        ...parent.header,
        modifiedAt: timestamp
      },
      identity: {
        engineeringObjectId: parent.identity.engineeringObjectId,
        revisionId: params.newRevisionId,
        parentRevisionId: parent.identity.revisionId,
        canonicalIdentity: childIdentity
      },
      model: updatedModel,
      manufacturing: updatedManufacturing,
      provenance: {
        source: parent.provenance.source,
        operations: [...parent.provenance.operations, newOperation],
        revisions: [...parent.provenance.revisions, newRevisionRecord],
        graphNodes: parent.provenance.graphNodes,
        graphEdges: parent.provenance.graphEdges
      },
      integrity: {
        parentHash: parent.integrity.canonicalHash
      },
      compatibility: parent.compatibility
    });

    if (!writeResult.success) {
      throw new Error(`Failed to create revision: ${writeResult.diagnostics.map(d => d.message).join('; ')}`);
    }

    return writeResult.document;
  }
}
