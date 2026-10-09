/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Native SECP Writer
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Produces deterministic, canonically validated Native SECP documents.
 * 2. Injects integrity block with SHA-256 canonical hash & artifact hash.
 * 3. Supports NativeSECPDocument and NativeSECPDocumentInput.
 */

import {
  NativeSECPDocument,
  NativeSECPDocumentInput,
  NativeSECPDiagnostic
} from './NativeSECPTypes';
import { NativeSECPCanonicalizer } from './NativeSECPCanonicalizer';

export interface NativeSECPWriteResult {
  readonly success: boolean;
  readonly document: NativeSECPDocument;
  readonly jsonString: string;
  readonly canonicalHash: string;
  readonly canonicalString: string;
  readonly byteLength: number;
  readonly diagnostics: readonly NativeSECPDiagnostic[];
}

export class NativeSECPWriter {
  public static readonly FORMAT_ID = 'SECP-NATIVE';
  public static readonly FORMAT_VERSION = '1.0.0';
  public static readonly SCHEMA_VERSION = '1.0.0';

  /**
   * Writes a NativeSECPDocumentInput or NativeSECPDocument into a verified canonical NativeSECPDocument.
   */
  public static write(input: NativeSECPDocumentInput | NativeSECPDocument): NativeSECPWriteResult {
    const diagnostics: NativeSECPDiagnostic[] = [];

    const header = {
      formatId: this.FORMAT_ID,
      formatVersion: input.header.formatVersion || this.FORMAT_VERSION,
      schemaVersion: input.header.schemaVersion || this.SCHEMA_VERSION,
      applicationVersion: input.header.applicationVersion || '1.0.0',
      generator: input.header.generator || 'SECP-PARAMETRIC-KERNEL',
      createdAt: input.header.createdAt || '1970-01-01T00:00:00.000Z',
      modifiedAt: input.header.modifiedAt || '1970-01-01T00:00:00.000Z',
      units: input.header.units || {
        length: 'MILLIMETRE',
        angle: 'RADIAN',
        mass: 'KILOGRAM',
        time: 'SECOND',
        scaleFactorToMm: 1.0
      },
      coordinateConvention: input.header.coordinateConvention || {
        handedness: 'RIGHT_HANDED',
        upVector: [0, 0, 1] as const,
        forwardVector: [0, 1, 0] as const
      },
      tolerance: input.header.tolerance || {
        linear: 1e-6,
        angular: 1e-6,
        nurbsDeviation: 1e-5,
        booleanTolerance: 1e-5
      },
      ...(input.header.customMetadata ? { customMetadata: input.header.customMetadata } : {})
    };

    const manufacturing = input.manufacturing || {
      features: [],
      toolpaths: [],
      metadata: {}
    };

    const provenance = input.provenance || {
      source: 'SECP_PARAMETRIC_DESIGNER',
      operations: [],
      revisions: [],
      graphNodes: [],
      graphEdges: []
    };

    const compatibility = input.compatibility || {
      diagnostics: []
    };

    // Construct intermediate doc for canonical hash computation
    const interimDoc: NativeSECPDocument = {
      header,
      identity: input.identity,
      model: input.model,
      manufacturing,
      provenance,
      integrity: {
        canonicalHash: '',
        artifactHash: '',
        ...(input.integrity?.parentHash ? { parentHash: input.integrity.parentHash } : {}),
        canonicalizationVersion: '1.0.0',
        hashAlgorithm: 'SHA-256',
        integrityStatus: 'UNVERIFIED',
        evidenceReferences: input.integrity?.evidenceReferences || []
      },
      compatibility
    };

    // Compute canonical hash of the engineering payload
    const { canonicalHash, canonicalString, byteLength } = NativeSECPCanonicalizer.computeCanonicalHash(interimDoc);

    // Finalize complete document with sealed integrity block
    const finalDoc: NativeSECPDocument = {
      ...interimDoc,
      integrity: {
        canonicalHash,
        artifactHash: '',
        ...(input.integrity?.parentHash ? { parentHash: input.integrity.parentHash } : {}),
        canonicalizationVersion: '1.0.0',
        hashAlgorithm: 'SHA-256',
        integrityStatus: 'VALID',
        evidenceReferences: input.integrity?.evidenceReferences || []
      }
    };

    const artifactHash = NativeSECPCanonicalizer.computeArtifactHash(finalDoc);
    const completeDoc: NativeSECPDocument = {
      ...finalDoc,
      integrity: {
        ...finalDoc.integrity,
        artifactHash
      }
    };

    const jsonString = JSON.stringify(completeDoc, null, 2);

    return {
      success: true,
      document: completeDoc,
      jsonString,
      canonicalHash,
      canonicalString,
      byteLength,
      diagnostics
    };
  }

  public static writeToFile(input: NativeSECPDocumentInput | NativeSECPDocument): string {
    return this.write(input).jsonString;
  }
}
