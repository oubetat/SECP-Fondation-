/**
 * SECP Structural Physics & Finite Element Analysis — Verification & Validation Engine
 * Implements rigorous numerical, equilibrium, boundary condition, and convergence validation.
 */
import {
  StructuralAnalysisResults,
  FEAMesh,
  BoundaryCondition,
  LoadDefinition,
  NodeResults
} from './StructuralPhysicsTypes';

export interface FEAValidationReport {
  isValid: boolean;
  verdict: 'ACCEPT' | 'REJECT';
  residualValid: boolean;
  numericalValid: boolean;
  boundaryConditionsValid: boolean;
  equilibriumValid: boolean;
  residualNorm: number;
  maxStress: number;
  maxDisplacement: number;
  diagnostics: string[];
}

export interface FEAValidationOptions {
  residualTolerance?: number; // e.g. 1e-4
  maxAllowedDisplacementM?: number; // e.g. 10.0 meters
  maxAllowedStressPa?: number; // e.g. 1e11 Pa
  bcToleranceM?: number; // e.g. 1e-7
}

export class FEAValidationEngine {
  private static readonly DEFAULT_RESIDUAL_TOLERANCE = 1e-3;
  private static readonly DEFAULT_BC_TOLERANCE = 1e-6;
  private static readonly DEFAULT_MAX_DISPLACEMENT = 100.0; // 100m sanity upper bound
  private static readonly DEFAULT_MAX_STRESS = 1e12; // 1 TPa sanity upper bound

  /**
   * Performs rigorous engineering validation of FEA simulation results.
   * Rejects incomplete, divergent, unphysical, non-finite, or BC-violating results.
   */
  public static validateResults(
    results?: StructuralAnalysisResults | null,
    mesh?: FEAMesh | null,
    boundaryConditions?: BoundaryCondition[] | null,
    loads?: LoadDefinition[] | null,
    options?: FEAValidationOptions
  ): FEAValidationReport {
    const diagnostics: string[] = [];

    if (!results) {
      return {
        isValid: false,
        verdict: 'REJECT',
        residualValid: false,
        numericalValid: false,
        boundaryConditionsValid: false,
        equilibriumValid: false,
        residualNorm: NaN,
        maxStress: NaN,
        maxDisplacement: NaN,
        diagnostics: ['Null or undefined FEA results provided.']
      };
    }

    const residualTol = options?.residualTolerance ?? this.DEFAULT_RESIDUAL_TOLERANCE;
    const bcTol = options?.bcToleranceM ?? this.DEFAULT_BC_TOLERANCE;
    const maxAllowedDisp = options?.maxAllowedDisplacementM ?? this.DEFAULT_MAX_DISPLACEMENT;
    const maxAllowedStress = options?.maxAllowedStressPa ?? this.DEFAULT_MAX_STRESS;

    // 1. Numerical Finiteness & Sanity Check
    let numericalValid = true;
    if (!Number.isFinite(results.maxDisplacement) || results.maxDisplacement < 0 || results.maxDisplacement > maxAllowedDisp) {
      numericalValid = false;
      diagnostics.push(`Invalid maxDisplacement: ${results.maxDisplacement} (must be finite, non-negative, and <= ${maxAllowedDisp})`);
    }

    if (!Number.isFinite(results.maxStress) || results.maxStress < 0 || results.maxStress > maxAllowedStress) {
      numericalValid = false;
      diagnostics.push(`Invalid maxStress: ${results.maxStress} (must be finite, non-negative, and <= ${maxAllowedStress})`);
    }

    if (!Array.isArray(results.nodes) || results.nodes.length === 0) {
      numericalValid = false;
      diagnostics.push('Nodal results array is empty or missing.');
    } else {
      for (const node of results.nodes) {
        if (
          !Number.isFinite(node.displacement.x) ||
          !Number.isFinite(node.displacement.y) ||
          !Number.isFinite(node.displacement.z)
        ) {
          numericalValid = false;
          diagnostics.push(`Non-finite displacement detected at node ${node.nodeId}: (${node.displacement.x}, ${node.displacement.y}, ${node.displacement.z})`);
          break;
        }

        if (!Number.isFinite(node.vonMises) || node.vonMises < 0) {
          numericalValid = false;
          diagnostics.push(`Invalid von Mises stress at node ${node.nodeId}: ${node.vonMises}`);
          break;
        }
      }
    }

    // 2. Residual & Convergence Check
    let residualValid = true;
    if (!results.converged) {
      residualValid = false;
      diagnostics.push('Solver reported non-convergence (converged === false).');
    }

    if (!Number.isFinite(results.residualNorm) || results.residualNorm < 0) {
      residualValid = false;
      diagnostics.push(`Invalid residualNorm: ${results.residualNorm}`);
    } else if (results.residualNorm > residualTol) {
      residualValid = false;
      diagnostics.push(`Residual norm ${results.residualNorm.toExponential(4)} exceeds tolerance ${residualTol.toExponential(4)}`);
    }

    // 3. Boundary Condition Consistency Check
    let boundaryConditionsValid = true;
    if (boundaryConditions && boundaryConditions.length > 0 && results.nodes) {
      const nodeMap = new Map<number, NodeResults>();
      for (const n of results.nodes) {
        nodeMap.set(n.nodeId, n);
      }

      for (const bc of boundaryConditions) {
        const nodeRes = nodeMap.get(bc.nodeId);
        if (!nodeRes) continue;

        const prescribed = bc.prescribedDisplacements || [0, 0, 0];
        const disp = [nodeRes.displacement.x, nodeRes.displacement.y, nodeRes.displacement.z];

        for (let dof = 0; dof < 3; dof++) {
          if (bc.constrainedDOFs[dof]) {
            const expectedVal = prescribed[dof] ?? 0;
            const actualVal = disp[dof];
            const diff = Math.abs(actualVal - expectedVal);
            if (diff > bcTol) {
              boundaryConditionsValid = false;
              diagnostics.push(
                `Boundary condition violation at node ${bc.nodeId}, DOF ${dof}: expected ${expectedVal}, got ${actualVal} (diff=${diff.toExponential(3)} > tol=${bcTol})`
              );
            }
          }
        }
      }
    }

    // 4. Equilibrium / Physics Check
    let equilibriumValid = true;
    if (loads && loads.length > 0 && results.nodes.length > 0) {
      const totalLoadMag = loads.reduce((sum, l) => {
        const fx = l.forceVector?.x || 0;
        const fy = l.forceVector?.y || 0;
        const fz = l.forceVector?.z || 0;
        return sum + Math.sqrt(fx * fx + fy * fy + fz * fz);
      }, 0);

      // If applied load is significant, displacement and stress cannot be identically zero everywhere
      if (totalLoadMag > 1e-3 && results.maxDisplacement === 0 && results.maxStress === 0) {
        equilibriumValid = false;
        diagnostics.push(`Trivial zero response for non-zero applied load (${totalLoadMag.toFixed(2)} N). Physics violated.`);
      }
    }

    const isValid = numericalValid && residualValid && boundaryConditionsValid && equilibriumValid;
    const verdict = isValid ? 'ACCEPT' : 'REJECT';

    return {
      isValid,
      verdict,
      residualValid,
      numericalValid,
      boundaryConditionsValid,
      equilibriumValid,
      residualNorm: results.residualNorm,
      maxStress: results.maxStress,
      maxDisplacement: results.maxDisplacement,
      diagnostics
    };
  }
}
