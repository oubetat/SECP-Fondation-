/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Native SECP Canonicalizer
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Prepares the canonical engineering payload for hashing and serialization.
 * 2. Uses PATCH-009 CanonicalSerializer to ensure deterministic UTF-8 encoding,
 *    key-sorting, numerical normalization, and strict immutability.
 * 3. Volatile/transport timestamps (e.g. read timestamp) are excluded from the
 *    canonical hash calculation.
 */

import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { NativeSECPDocument, NativeSECPModel } from './NativeSECPTypes';
import * as crypto from 'crypto';

export interface CanonicalNativePayload {
  readonly formatId: string;
  readonly formatVersion: string;
  readonly schemaVersion: string;
  readonly units: unknown;
  readonly coordinateConvention: unknown;
  readonly tolerance: unknown;
  readonly identity: unknown;
  readonly model: unknown;
  readonly manufacturing: unknown;
  readonly provenance: {
    readonly source: string;
    readonly operations: readonly unknown[];
    readonly revisions: readonly unknown[];
    readonly graphNodes: readonly unknown[];
    readonly graphEdges: readonly unknown[];
  };
}

export class NativeSECPCanonicalizer {
  public static readonly FORMAT_ID = 'SECP-NATIVE';
  public static readonly FORMAT_VERSION = '1.0.0';
  public static readonly SCHEMA_VERSION = '1.0.0';

  /**
   * Extracts the deterministic canonical engineering payload from a Native SECP document.
   */
  public static extractCanonicalPayload(document: NativeSECPDocument): CanonicalNativePayload {
    return {
      formatId: this.FORMAT_ID,
      formatVersion: document.header.formatVersion || this.FORMAT_VERSION,
      schemaVersion: document.header.schemaVersion || this.SCHEMA_VERSION,
      units: document.header.units,
      coordinateConvention: document.header.coordinateConvention,
      tolerance: document.header.tolerance,
      identity: {
        engineeringObjectId: document.identity.engineeringObjectId,
        revisionId: document.identity.revisionId,
        ...(document.identity.parentRevisionId ? { parentRevisionId: document.identity.parentRevisionId } : {}),
        canonicalIdentity: document.identity.canonicalIdentity
      },
      model: this.canonicalizeModel(document.model),
      manufacturing: document.manufacturing,
      provenance: {
        source: document.provenance.source,
        operations: document.provenance.operations,
        revisions: document.provenance.revisions,
        graphNodes: document.provenance.graphNodes,
        graphEdges: document.provenance.graphEdges
      }
    };
  }

  /**
   * Computes the deterministic SHA-256 canonical hash of a Native SECP document
   * using CanonicalSerializer (PATCH-009 / PATCH-010).
   */
  public static computeCanonicalHash(document: NativeSECPDocument): {
    canonicalHash: string;
    canonicalString: string;
    byteLength: number;
    schemaVersion: string;
  } {
    const payload = this.extractCanonicalPayload(document);
    const serializationResult = CanonicalSerializer.serialize(payload);
    const canonicalHash = crypto
      .createHash('sha256')
      .update(serializationResult.canonicalString, 'utf8')
      .digest('hex');

    return {
      canonicalHash,
      canonicalString: serializationResult.canonicalString,
      byteLength: serializationResult.byteLength,
      schemaVersion: serializationResult.schemaVersion
    };
  }

  /**
   * Computes artifact hash of the entire document container (including headers & integrity block).
   */
  public static computeArtifactHash(document: NativeSECPDocument): string {
    const serializationResult = CanonicalSerializer.serialize(document);
    return crypto
      .createHash('sha256')
      .update(serializationResult.canonicalString, 'utf8')
      .digest('hex');
  }

  /**
   * Normalize and sort internal arrays of the model for stable canonical representation.
   */
  private static canonicalizeModel(model: NativeSECPModel): NativeSECPModel {
    return {
      geometry: {
        points: [...model.geometry.points].sort((a, b) => a.id.localeCompare(b.id)),
        analyticCurves: [...model.geometry.analyticCurves].sort((a, b) => a.id.localeCompare(b.id)),
        nurbsCurves: [...model.geometry.nurbsCurves].sort((a, b) => a.id.localeCompare(b.id)),
        analyticSurfaces: [...model.geometry.analyticSurfaces].sort((a, b) => a.id.localeCompare(b.id)),
        nurbsSurfaces: [...model.geometry.nurbsSurfaces].sort((a, b) => a.id.localeCompare(b.id))
      },
      topology: {
        vertices: [...model.topology.vertices].sort((a, b) => a.id.localeCompare(b.id)),
        edges: [...model.topology.edges].sort((a, b) => a.id.localeCompare(b.id)),
        loops: [...model.topology.loops].sort((a, b) => a.id.localeCompare(b.id)),
        faces: [...model.topology.faces].sort((a, b) => a.id.localeCompare(b.id)),
        shells: [...model.topology.shells].sort((a, b) => a.id.localeCompare(b.id)),
        solids: [...model.topology.solids].sort((a, b) => a.id.localeCompare(b.id))
      },
      features: {
        features: [...model.features.features].sort((a, b) => a.creationOrder - b.creationOrder || a.featureId.localeCompare(b.featureId)),
        executionOrder: [...model.features.executionOrder],
        isValid: model.features.isValid
      },
      sketches: [...model.sketches].sort((a, b) => a.id.localeCompare(b.id)),
      assemblies: {
        nodes: [...model.assemblies.nodes].sort((a, b) => a.id.localeCompare(b.id)),
        instances: [...model.assemblies.instances].sort((a, b) => a.id.localeCompare(b.id)),
        mates: [...model.assemblies.mates].sort((a, b) => a.id.localeCompare(b.id))
      }
    };
  }
}
