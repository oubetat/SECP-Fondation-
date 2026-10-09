/**
 * SECP CAD Kernel — Canonical Curvature Evaluator
 * PROMPT-038: Real Curvature Analysis from Engineering Truth
 */

import { Point } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface, BRepPlane, BRepTrimmedSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { CurvatureAnalysis } from '../nurbs/NURBSTypes';
import { EvidenceRecord } from '../../cad-kernel/document/CADDocument';

export interface CurvatureVerificationReport {
  isMathematicallyConsistent: boolean;
  gaussianIdentityError: number;
  meanIdentityError: number;
  diagnostics: string[];
}

export class CurvatureEvaluator {
  /**
   * Evaluates curvature for a canonical surface at (u, v).
   */
  public static evaluate(surface: any, u: number, v: number): CurvatureAnalysis {
    if (!surface) throw new Error('Cannot evaluate curvature on null surface');

    let result: CurvatureAnalysis;

    if (surface instanceof BRepNURBSSurface) {
      result = NURBSEngine.analyzeCurvature(surface, u, v);
    } else if (surface instanceof BRepPlane) {
      result = this.evaluatePlanarCurvature(surface, u, v);
    } else if (surface instanceof BRepTrimmedSurface) {
      // Check if (u,v) is within trim loops? 
      // For now, evaluate base surface
      result = this.evaluate(surface.baseSurface, u, v);
    } else {
      // Try to get NURBS representation
      try {
        const nurbs = (surface as any).toNURBS ? (surface as any).toNURBS() : surface;
        result = NURBSEngine.analyzeCurvature(nurbs, u, v);
      } catch (e) {
        throw new Error(`Curvature analysis not supported for surface type: ${surface.constructor.name}`);
      }
    }

    return result;
  }

  /**
   * Verifies the mathematical consistency of curvature results.
   */
  public static verify(analysis: CurvatureAnalysis): CurvatureVerificationReport {
    const { gaussianCurvature, meanCurvature, principalCurvatures } = analysis;
    const [k1, k2] = principalCurvatures;

    // Identities:
    // K = k1 * k2
    // H = (k1 + k2) / 2

    const kExpected = k1 * k2;
    const hExpected = (k1 + k2) / 2;

    const gError = Math.abs(gaussianCurvature - kExpected);
    const mError = Math.abs(meanCurvature - hExpected);

    const diagnostics: string[] = [];
    const tol = 1e-6;

    if (gError > tol) diagnostics.push(`Gaussian identity mismatch: error=${gError}`);
    if (mError > tol) diagnostics.push(`Mean identity mismatch: error=${mError}`);
    
    if (analysis.classification === 'SINGULAR') {
      diagnostics.push('Surface is singular at this point; results may be unreliable.');
    }

    return {
      isMathematicallyConsistent: gError <= tol && mError <= tol,
      gaussianIdentityError: gError,
      meanIdentityError: mError,
      diagnostics
    };
  }

  private static evaluatePlanarCurvature(plane: BRepPlane, u: number, v: number): CurvatureAnalysis {
    const normal = { x: 0, y: 0, z: 1 }; // Default for plane if not defined
    return {
      gaussianCurvature: 0,
      meanCurvature: 0,
      principalCurvatures: [0, 0],
      principalDirections: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
      normal,
      fundamentalForms: {
        first: { E: 1, F: 0, G: 1 },
        second: { e: 0, f: 0, g: 0 }
      },
      classification: 'PLANAR',
      continuity: 'G2'
    };
  }

  /**
   * Generates engineering evidence for curvature analysis.
   */
  public static recordEvidence(
    analysis: CurvatureAnalysis,
    meta: { featureId: string; docId: string; rev: number }
  ): EvidenceRecord {
    const verification = this.verify(analysis);

    return {
      evidenceId: `EVID_CURV_${Date.now()}_${meta.featureId}`,
      stage: 'GEOMETRY_ANALYSIS',
      sourceSystem: 'SECP_CURVATURE_EVALUATOR',
      documentId: meta.docId,
      revision: meta.rev,
      canonicalHash: 'computed_from_geometry', // In real system, hash of geometry
      timestamp: new Date().toISOString(),
      payload: {
        analysis,
        verification
      },
      verdict: verification.isMathematicallyConsistent ? 'PASS' : 'FAIL'
    };
  }
}
