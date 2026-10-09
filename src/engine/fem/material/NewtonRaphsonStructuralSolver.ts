import { Matrix } from "../core/MathUtils";
import { NonlinearStructuralSystem, PrescribedDisplacement } from "./NonlinearStructuralSystem";

export type GlobalNonlinearVerdict =
  | 'NONLINEAR_CONVERGED'
  | 'NONLINEAR_NOT_CONVERGED'
  | 'MATERIAL_FAILURE'
  | 'SINGULAR_TANGENT'
  | 'INVALID_MODEL'
  | 'NUMERICAL_FAILURE';

export interface NewtonRaphsonConfig {
  loadSteps: number;
  maxIterationsPerStep: number;
  residualTolerance: number;
  displacementTolerance: number;
  energyTolerance: number;
}

export interface StepIterationLog {
  step: number;
  iteration: number;
  residualNorm: number;
  displacementCorrectionNorm: number;
  energyNorm: number;
  isConverged: boolean;
}

export interface NewtonRaphsonSolveResult {
  verdict: GlobalNonlinearVerdict;
  converged: boolean;
  totalLoadSteps: number;
  completedLoadSteps: number;
  totalIterations: number;
  displacements: number[];
  internalForce: number[];
  appliedExternalForce: number[];
  iterationLogs: StepIterationLog[];
  plasticityEngaged: boolean;
  diagnostics: string;
}

export class NewtonRaphsonStructuralSolver {
  private config: NewtonRaphsonConfig;

  constructor(config?: Partial<NewtonRaphsonConfig>) {
    this.config = {
      loadSteps: 5,
      maxIterationsPerStep: 30,
      residualTolerance: 1e-6,
      displacementTolerance: 1e-6,
      energyTolerance: 1e-8,
      ...config
    };
  }

  solve(
    system: NonlinearStructuralSystem,
    targetExternalForce: number[],
    constraints: PrescribedDisplacement[]
  ): NewtonRaphsonSolveResult {
    const totalDOFs = system.totalDOFs;
    let u_current = new Array(totalDOFs).fill(0);
    const iterationLogs: StepIterationLog[] = [];
    let totalIterations = 0;
    let anyPlasticity = false;

    // Identify constrained DOFs
    const constrainedDOFSet = new Map<number, number>();
    for (const c of constraints) {
      const node = system.nodes.find(n => n.id === c.nodeId);
      if (node) {
        constrainedDOFSet.set(node.index * system.dofsPerNode + c.dofIndex, c.value);
      }
    }

    const nSteps = this.config.loadSteps;

    for (let step = 1; step <= nSteps; step++) {
      const loadFactor = step / nSteps;
      const F_ext_step = targetExternalForce.map(f => f * loadFactor);
      let stepConverged = false;

      for (let iter = 0; iter < this.config.maxIterationsPerStep; iter++) {
        totalIterations++;

        // 1. Assemble system at current displacement trial u_current
        const { internalForce, tangentStiffness, plasticityOccurred } = system.assembleSystem(u_current);
        if (plasticityOccurred) anyPlasticity = true;

        // 2. Compute residual: R = F_int - F_ext
        const residual = new Array(totalDOFs).fill(0);
        for (let i = 0; i < totalDOFs; i++) {
          residual[i] = internalForce[i] - F_ext_step[i];
        }

        // Apply Dirichlet constraints on residual
        for (const [dofIdx] of constrainedDOFSet.entries()) {
          residual[dofIdx] = 0.0;
        }

        const resNorm = this.vectorNorm(residual);
        const extNorm = this.vectorNorm(F_ext_step) + 1e-12;
        const relativeRes = resNorm / extNorm;

        // Check if already converged
        if (relativeRes <= this.config.residualTolerance && iter > 0) {
          stepConverged = true;
          iterationLogs.push({
            step,
            iteration: iter,
            residualNorm: resNorm,
            displacementCorrectionNorm: 0.0,
            energyNorm: 0.0,
            isConverged: true
          });
          break;
        }

        // 3. Solve tangent linear system: K_t * delta_u = -R
        const delta_u = this.solveLinearSystem(tangentStiffness, residual.map(r => -r), constrainedDOFSet);

        const deltaUNorm = this.vectorNorm(delta_u);
        const uNorm = this.vectorNorm(u_current) + 1e-12;
        const relativeDU = deltaUNorm / uNorm;
        const energyNorm = Math.abs(delta_u.reduce((sum, du, idx) => sum + du * residual[idx], 0.0));

        iterationLogs.push({
          step,
          iteration: iter,
          residualNorm: resNorm,
          displacementCorrectionNorm: deltaUNorm,
          energyNorm,
          isConverged: false
        });

        // 4. Update displacements: u = u + delta_u
        for (let i = 0; i < totalDOFs; i++) {
          if (!constrainedDOFSet.has(i)) {
            u_current[i] += delta_u[i];
          } else {
            u_current[i] = constrainedDOFSet.get(i)!;
          }
        }

        // Check convergence criteria
        if (relativeRes <= this.config.residualTolerance && relativeDU <= this.config.displacementTolerance) {
          stepConverged = true;
          break;
        }
      }

      if (stepConverged) {
        // Commit material states for this accepted load step
        system.commitAllMaterialStates();
      } else {
        // Revert material trial states
        system.revertAllMaterialStates();
        return {
          verdict: 'NONLINEAR_NOT_CONVERGED',
          converged: false,
          totalLoadSteps: nSteps,
          completedLoadSteps: step - 1,
          totalIterations,
          displacements: u_current,
          internalForce: [],
          appliedExternalForce: F_ext_step,
          iterationLogs,
          plasticityEngaged: anyPlasticity,
          diagnostics: `Newton-Raphson failed to converge at load step ${step} of ${nSteps} within ${this.config.maxIterationsPerStep} iterations.`
        };
      }
    }

    const finalAssembly = system.assembleSystem(u_current);

    return {
      verdict: 'NONLINEAR_CONVERGED',
      converged: true,
      totalLoadSteps: nSteps,
      completedLoadSteps: nSteps,
      totalIterations,
      displacements: u_current,
      internalForce: finalAssembly.internalForce,
      appliedExternalForce: targetExternalForce,
      iterationLogs,
      plasticityEngaged: anyPlasticity,
      diagnostics: `Successfully converged across all ${nSteps} load steps in ${totalIterations} total iterations.`
    };
  }

  private vectorNorm(vec: number[]): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
  }

  private solveLinearSystem(K: Matrix, rhs: number[], constraints: Map<number, number>): number[] {
    const n = rhs.length;
    const A = K.clone();
    const b = [...rhs];

    // Enforce Dirichlet constraints
    for (const [dof] of constraints.entries()) {
      for (let j = 0; j < n; j++) {
        A.set(dof, j, 0.0);
      }
      A.set(dof, dof, 1.0);
      b[dof] = 0.0;
    }

    // Gaussian elimination with partial pivoting
    const aData = A.data;
    for (let p = 0; p < n; p++) {
      let maxRow = p;
      let maxVal = Math.abs(aData[p][p]);
      for (let r = p + 1; r < n; r++) {
        const val = Math.abs(aData[r][p]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
      }

      if (maxVal < 1e-15) {
        throw new Error(`Singular tangent matrix encountered during Newton-Raphson at DOF ${p}`);
      }

      if (maxRow !== p) {
        const tempRow = aData[p];
        aData[p] = aData[maxRow];
        aData[maxRow] = tempRow;
        const tempB = b[p];
        b[p] = b[maxRow];
        b[maxRow] = tempB;
      }

      for (let r = p + 1; r < n; r++) {
        const factor = aData[r][p] / aData[p][p];
        for (let c = p; c < n; c++) {
          aData[r][c] -= factor * aData[p][c];
        }
        b[r] -= factor * b[p];
      }
    }

    // Back substitution
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let sum = b[r];
      for (let c = r + 1; c < n; c++) {
        sum -= aData[r][c] * x[c];
      }
      x[r] = sum / aData[r][r];
    }

    return x;
  }
}
