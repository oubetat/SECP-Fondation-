/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Native SECP Reader
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Reads and validates Native SECP documents from string or object format.
 * 2. Validates format ID, version constraints, integrity signatures and canonical hashes.
 * 3. Classifies entity support coverage and collects deterministic diagnostics.
 */

import {
  NativeSECPDocument,
  NativeSECPDiagnostic,
  EntityClassification
} from './NativeSECPTypes';
import { NativeSECPCanonicalizer } from './NativeSECPCanonicalizer';

export interface NativeSECPReadResult {
  readonly success: boolean;
  readonly document: NativeSECPDocument | null;
  readonly integrityValid: boolean;
  readonly diagnostics: readonly NativeSECPDiagnostic[];
  readonly entityCoverage: {
    readonly supported: number;
    readonly partial: number;
    readonly unsupported: number;
    readonly invalid: number;
  };
}

export class NativeSECPReader {
  public static readonly SUPPORTED_FORMAT_IDS = ['SECP-NATIVE'];
  public static readonly SUPPORTED_SCHEMA_VERSIONS = ['1.0.0'];

  /**
   * Reads and verifies a Native SECP document from JSON string or object.
   */
  public static read(input: string | NativeSECPDocument): NativeSECPReadResult {
    const diagnostics: NativeSECPDiagnostic[] = [];
    let document: NativeSECPDocument;

    if (typeof input === 'string') {
      try {
        document = JSON.parse(input) as NativeSECPDocument;
      } catch (err: any) {
        diagnostics.push({
          code: 'ERR_JSON_PARSE',
          severity: 'CRITICAL',
          category: 'FORMAT',
          message: `Failed to parse JSON string: ${err.message}`
        });
        return {
          success: false,
          document: null,
          integrityValid: false,
          diagnostics,
          entityCoverage: { supported: 0, partial: 0, unsupported: 0, invalid: 1 }
        };
      }
    } else {
      document = input;
    }

    // 1. Format & Header validation
    if (!document || typeof document !== 'object') {
      diagnostics.push({
        code: 'ERR_INVALID_ROOT',
        severity: 'CRITICAL',
        category: 'FORMAT',
        message: 'Document root is null or not an object'
      });
      return {
        success: false,
        document: null,
        integrityValid: false,
        diagnostics,
        entityCoverage: { supported: 0, partial: 0, unsupported: 0, invalid: 1 }
      };
    }

    if (!document.header || !this.SUPPORTED_FORMAT_IDS.includes(document.header.formatId)) {
      diagnostics.push({
        code: 'ERR_UNSUPPORTED_FORMAT',
        severity: 'CRITICAL',
        category: 'HEADER',
        message: `Unsupported format ID: ${document?.header?.formatId || 'MISSING'}`
      });
    }

    if (!document.identity || !document.identity.engineeringObjectId) {
      diagnostics.push({
        code: 'ERR_MISSING_IDENTITY',
        severity: 'CRITICAL',
        category: 'IDENTITY',
        message: 'Missing canonical engineering identity or objectId'
      });
    }

    if (!document.model || !document.model.geometry || !document.model.topology) {
      diagnostics.push({
        code: 'ERR_MISSING_MODEL',
        severity: 'CRITICAL',
        category: 'BREP',
        message: 'Missing required B-Rep geometry or topology structures'
      });
    }

    // 2. Integrity Hash Validation
    let integrityValid = false;
    if (document.integrity && document.integrity.canonicalHash) {
      const computed = NativeSECPCanonicalizer.computeCanonicalHash(document);
      integrityValid = (computed.canonicalHash === document.integrity.canonicalHash);

      if (!integrityValid) {
        diagnostics.push({
          code: 'ERR_INTEGRITY_MISMATCH',
          severity: 'CRITICAL',
          category: 'INTEGRITY',
          message: `Integrity hash mismatch: expected ${document.integrity.canonicalHash}, computed ${computed.canonicalHash}`
        });
      }
    } else {
      diagnostics.push({
        code: 'ERR_MISSING_INTEGRITY',
        severity: 'WARNING',
        category: 'INTEGRITY',
        message: 'Document lacks a sealed integrity hash block'
      });
    }

    // 3. Entity Coverage Metrics
    let supported = 0;
    let partial = 0;
    let unsupported = 0;
    let invalid = 0;

    if (document.model) {
      const geom = document.model.geometry;
      const topo = document.model.topology;

      if (geom) {
        supported += (geom.points?.length || 0);
        supported += (geom.analyticCurves?.length || 0);
        supported += (geom.nurbsCurves?.length || 0);
        supported += (geom.analyticSurfaces?.length || 0);
        supported += (geom.nurbsSurfaces?.length || 0);
      }

      if (topo) {
        supported += (topo.vertices?.length || 0);
        supported += (topo.edges?.length || 0);
        supported += (topo.loops?.length || 0);
        supported += (topo.faces?.length || 0);
        supported += (topo.shells?.length || 0);
        supported += (topo.solids?.length || 0);
      }

      if (document.model.features) {
        supported += (document.model.features.features?.length || 0);
      }

      if (document.model.assemblies) {
        supported += (document.model.assemblies.instances?.length || 0);
        supported += (document.model.assemblies.nodes?.length || 0);
      }
    }

    const hasCritical = diagnostics.some(d => d.severity === 'CRITICAL');
    const hasError = diagnostics.some(d => d.severity === 'ERROR');

    return {
      success: !hasCritical && !hasError,
      document: (!hasCritical && !hasError) ? document : null,
      integrityValid,
      diagnostics,
      entityCoverage: {
        supported,
        partial,
        unsupported,
        invalid
      }
    };
  }

  public static readFromString(content: string): any {
    return this.read(content).document;
  }
}
