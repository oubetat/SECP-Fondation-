/**
 * SECP CAD Kernel — Healing Evidence & Cryptographic Hash Lineage
 * Phase 2 (PATCH-020)
 */

import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import {
  HealingResult,
  HealingProvenance,
  BeforeAfterComparison
} from './HealingTypes';

export class HealingEvidence {
  private static sanitizeForHash(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'function') return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeForHash(item)).filter(x => x !== undefined);

    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val !== 'function') {
        const sanitized = this.sanitizeForHash(val);
        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      }
    }
    return result;
  }

  public static computeShapeHash(shape: any): string {
    if (!shape) return '0000000000000000000000000000000000000000000000000000000000000000';
    const sanitized = this.sanitizeForHash(shape);
    const res = EngineeringHashChain.computeCanonicalHash(sanitized);
    return res.canonicalHash;
  }

  public static computeDeterminismHash(result: Partial<HealingResult>): string {
    const payload = {
      inputShapeId: result.inputShapeId,
      outputShapeId: result.outputShapeId,
      status: result.status,
      defectsDetected: result.defectsDetected,
      repairsApplied: result.repairsApplied,
      repairsRejected: result.repairsRejected,
      validation: result.validation,
      tolerancePolicy: result.tolerancePolicy,
      beforeAfterComparison: result.beforeAfterComparison
    };

    const sanitized = this.sanitizeForHash(payload);
    const res = EngineeringHashChain.computeCanonicalHash(sanitized);
    return res.canonicalHash;
  }

  public static createProvenance(
    origin: 'IMPORTED' | 'KERNEL_GENERATED' | 'BOOLEAN_OUTPUT' | 'UNKNOWN',
    parentShapeId: string,
    historyHash?: string
  ): HealingProvenance {
    return {
      origin,
      parentShapeId,
      healingEngineVersion: '2.0.0-PATCH-020',
      timestamp: 'CANONICAL_AUDIT_TIMESTAMP',
      historyChainHash: historyHash
    };
  }

  public static createComparison(
    beforeShape: any,
    afterShape: any,
    defectsBefore: number,
    defectsAfter: number,
    statusBefore: string,
    statusAfter: string,
    justifications: string[]
  ): BeforeAfterComparison {
    const topoBefore = this.computeShapeHash(beforeShape);
    const topoAfter = this.computeShapeHash(afterShape);

    const countsBefore = this.countEntities(beforeShape);
    const countsAfter = this.countEntities(afterShape);

    return {
      before: {
        topologyHash: topoBefore,
        geometryHash: topoBefore,
        entityCounts: countsBefore,
        defectCount: defectsBefore,
        validationStatus: statusBefore
      },
      after: {
        topologyHash: topoAfter,
        geometryHash: topoAfter,
        entityCounts: countsAfter,
        defectCount: defectsAfter,
        validationStatus: statusAfter
      },
      changes: {
        entitiesModified: justifications.filter(j => j.startsWith('MODIFIED:')),
        entitiesAdded: justifications.filter(j => j.startsWith('ADDED:')),
        entitiesRemoved: justifications.filter(j => j.startsWith('REMOVED:')),
        justificationSummary: justifications
      }
    };
  }

  private static countEntities(shape: any): Record<string, number> {
    if (!shape) return { solids: 0, shells: 0, faces: 0, loops: 0, edges: 0, vertices: 0 };

    let solids = 0;
    let shells = 0;
    let faces = 0;
    let loops = 0;
    let edges = 0;
    let vertices = 0;

    if (shape.shapeType === 'SOLID') {
      solids++;
      if (shape.outerShell) {
        shells++;
        if (shape.outerShell.orientedFaces) {
          faces += shape.outerShell.orientedFaces.length;
          for (const of of shape.outerShell.orientedFaces) {
            if (of.face && of.face.outerLoop) {
              loops++;
              if (of.face.outerLoop.orientedEdges) {
                edges += of.face.outerLoop.orientedEdges.length;
                for (const oe of of.face.outerLoop.orientedEdges) {
                  if (oe.edge) {
                    if (oe.edge.startVertex) vertices++;
                  }
                }
              }
            }
          }
        }
      }
    }

    return { solids, shells, faces, loops, edges, vertices };
  }
}
