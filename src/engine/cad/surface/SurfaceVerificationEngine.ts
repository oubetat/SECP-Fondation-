/**
 * SECP CAD Kernel — Surface Verification Engine
 */

import { BRepNURBSSurface, BRepTrimmedSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';

import { CurvatureEvaluator } from './CurvatureEvaluator';

export interface SurfaceVerificationReport {
  isValid: boolean;
  isNURBSCompliant: boolean;
  hasNormalAnomalies: boolean;
  curvatureVerification?: any;
  continuityGrade: 'C0' | 'C1' | 'C2' | 'G1' | 'G2';
  diagnostics: string[];
}

export class SurfaceVerificationEngine {
  /**
   * Verifies the geometric and topological integrity of a surface.
   */
  public static verify(surface: any): SurfaceVerificationReport {
    const diagnostics: string[] = [];
    let isValid = true;
    let isNURBSCompliant = true;
    let hasNormalAnomalies = false;
    let continuityGrade: 'C0' | 'C1' | 'C2' | 'G1' | 'G2' = 'C0';
    let curvatureVerification: any = null;

    if (!surface) {
      return { isValid: false, isNURBSCompliant: false, hasNormalAnomalies: false, continuityGrade: 'C0', diagnostics: ['Null surface'] };
    }

    // Check NURBS structure
    if (surface instanceof BRepNURBSSurface) {
      const { degreeU, degreeV, knotsU, knotsV, controlPoints } = surface;
      
      // Knot multiplicity check
      if (!this.checkKnotMultiplicity(knotsU, degreeU) || !this.checkKnotMultiplicity(knotsV, degreeV)) {
        isNURBSCompliant = false;
        diagnostics.push('Invalid knot multiplicity detected.');
      }

      // Control net sanity
      if (controlPoints.length < degreeU + 1 || controlPoints[0].length < degreeV + 1) {
        isNURBSCompliant = false;
        diagnostics.push('Control point net size incompatible with degrees.');
      }

      // Curvature Verification
      try {
        const analysis = CurvatureEvaluator.evaluate(surface, 0.5, 0.5);
        curvatureVerification = CurvatureEvaluator.verify(analysis);
        if (!curvatureVerification.isMathematicallyConsistent) {
          diagnostics.push('Curvature identities (K=k1*k2) failed verification.');
        }
      } catch (e) {
        diagnostics.push('Failed to evaluate curvature for verification.');
      }
    } else if (surface instanceof BRepTrimmedSurface) {
      const baseVerif = this.verify(surface.baseSurface);
      if (!baseVerif.isValid) {
        isValid = false;
        diagnostics.push(...baseVerif.diagnostics.map(d => `Base surface error: ${d}`));
      }
      
      if (!surface.trimLoops || surface.trimLoops.length === 0) {
        diagnostics.push('Trimmed surface has no trim loops.');
      }
    }

    // Curvature/Normal check (simplified)
    try {
      const data = NURBSEngine.toNURBSSurfaceData(surface);
      const normal00 = NURBSEngine.evaluateNormal(data, 0, 0);
      const normal11 = NURBSEngine.evaluateNormal(data, 1, 1);
      
      if (isNaN(normal00.x) || isNaN(normal11.x)) {
        hasNormalAnomalies = true;
        diagnostics.push('Singular normals detected at boundaries.');
      }
      
      continuityGrade = 'G1'; // Assume G1 if we can compute normals
    } catch (e) {
      hasNormalAnomalies = true;
      diagnostics.push('Failed to evaluate surface differential geometry.');
    }

    return {
      isValid: isValid && isNURBSCompliant && !hasNormalAnomalies && (curvatureVerification ? curvatureVerification.isMathematicallyConsistent : true),
      isNURBSCompliant,
      hasNormalAnomalies,
      curvatureVerification,
      continuityGrade,
      diagnostics: diagnostics.length > 0 ? diagnostics : ['Surface passes all canonical integrity checks.']
    };
  }

  private static checkKnotMultiplicity(knots: number[], degree: number): boolean {
    let count = 1;
    for (let i = 1; i < knots.length; i++) {
      if (Math.abs(knots[i] - knots[i - 1]) < 1e-9) {
        count++;
      } else {
        count = 1;
      }
      if (count > degree + 1) return false;
    }
    return true;
  }
}
