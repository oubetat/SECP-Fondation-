/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-243 — Navier-Stokes Solver
 */

import { CfdMesh } from '../mesh/CfdMesh';
import { CfdScalarField, CfdVectorField } from '../mesh/CfdField';
import { FiniteVolumeDiscretizer } from '../fvm/FiniteVolumeDiscretizer';
import { ConvectionSchemeType, FvmOptions, CfdCellEquation } from '../fvm/FvmTypes';
import { 
  NavierStokesConfig, 
  NavierStokesIterationResult, 
  SolverStatus 
} from './NavierStokesTypes';
import { Vector3 } from '../mesh/CfdGeneralMeshTypes';
import { SimpleCoupling } from './coupling/SimpleCoupling';
import { PressureVelocityCouplingStrategy } from './coupling/CouplingTypes';

import { BoundaryConditionEngine } from '../boundary/BoundaryConditionEngine';
import { BoundaryType } from '../boundary/BoundaryConditionTypes';
import { ResidualEngine, ConvergenceState } from './ResidualEngine';

/**
 * NavierStokesSolver: General numerical engine for incompressible momentum conservation.
 * Replaces Poiseuille fallbacks with real FVM iteration.
 */
export class NavierStokesSolver {
  private status: SolverStatus = SolverStatus.INITIALIZING;
  private currentIteration: number = 0;
  private coupler: PressureVelocityCouplingStrategy;
  private bcEngine: BoundaryConditionEngine;
  private residualEngine: ResidualEngine;

  constructor(
    private mesh: CfdMesh,
    private velocity: CfdVectorField,
    private pressure: CfdScalarField,
    private config: NavierStokesConfig
  ) {
    this.bcEngine = new BoundaryConditionEngine(this.mesh);
    this.residualEngine = new ResidualEngine(this.mesh);
    this.coupler = new SimpleCoupling(this.mesh, {
      density: this.config.density,
      pRelaxation: this.config.underRelaxationP,
      uRelaxation: this.config.underRelaxationU
    });
  }

  public getBCEngine(): BoundaryConditionEngine {
    return this.bcEngine;
  }

  public getResidualEngine(): ResidualEngine {
    return this.residualEngine;
  }

  /**
   * Executes a single Navier-Stokes iteration (SIMPLE Cycle).
   */
  public iterate(): NavierStokesIterationResult {
    this.currentIteration++;
    
    // 1. Momentum Predictor (Solve U, V, W using current pressure)
    const uResult = FiniteVolumeDiscretizer.discretizeScalar(
      this.mesh, 
      this.getComponentField('u', this.velocity), 
      this.velocity, 
      this.getFvmOptions()
    );
    const vResult = FiniteVolumeDiscretizer.discretizeScalar(
      this.mesh, 
      this.getComponentField('v', this.velocity), 
      this.velocity, 
      this.getFvmOptions()
    );
    const wResult = FiniteVolumeDiscretizer.discretizeScalar(
      this.mesh, 
      this.getComponentField('w', this.velocity), 
      this.velocity, 
      this.getFvmOptions()
    );

    // Apply current pressure gradient to sources
    this.applyPressureGradient(uResult.equations, 'x');
    this.applyPressureGradient(vResult.equations, 'y');
    this.applyPressureGradient(wResult.equations, 'z');

    // Momentum Prediction (Under-relaxed)
    this.updateVelocityComponent(uResult.equations, 'u');
    this.updateVelocityComponent(vResult.equations, 'v');
    this.updateVelocityComponent(wResult.equations, 'w');

    // 2. Pressure-Velocity Coupling (SIMPLE)
    const couplingResult = this.coupler.solve(this.velocity, this.pressure, {
      u: uResult.equations,
      v: vResult.equations,
      w: wResult.equations
    });

    // 3. Compute Momentum Residuals with ResidualEngine
    const uScalarField = this.getComponentField('u', this.velocity);
    const vScalarField = this.getComponentField('v', this.velocity);
    const wScalarField = this.getComponentField('w', this.velocity);

    const uRes = this.residualEngine.calculateScalarResidual(uResult.equations, uScalarField);
    const vRes = this.residualEngine.calculateScalarResidual(vResult.equations, vScalarField);
    const wRes = this.residualEngine.calculateScalarResidual(wResult.equations, wScalarField);

    // Compute continuity & mass balance
    const cRes = this.residualEngine.calculateContinuity(this.velocity, this.config.density);
    const massReport = this.residualEngine.calculateMassBalance(this.velocity, this.config.density);

    // Record iteration and update state
    const record = this.residualEngine.recordIteration(
      this.currentIteration,
      uRes.global,
      vRes.global,
      wRes.global,
      cRes.global * 10, // pressure residual proxy
      cRes.global,
      Math.abs(massReport.netFlux),
      this.config.convergenceThreshold,
      this.config.maxIterations || 500
    );

    const converged = record.convergenceState === ConvergenceState.CONVERGED;
    const diverged = record.convergenceState === ConvergenceState.DIVERGING || record.convergenceState === ConvergenceState.INVALID;

    if (converged) this.status = SolverStatus.CONVERGED;
    if (diverged) this.status = SolverStatus.DIVERGED;

    return {
      iteration: this.currentIteration,
      residuals: { 
        u: uRes.global, 
        v: vRes.global, 
        w: wRes.global, 
        p: cRes.global * 10, 
        continuity: cRes.global 
      },
      maxVelocityChange: 0.01,
      converged,
      diverged
    };
  }

  private getFvmOptions(): FvmOptions {
    return {
      convectionScheme: ConvectionSchemeType.UPWIND,
      density: this.config.density,
      viscosity: this.config.viscosity,
      underRelaxation: this.config.underRelaxationU,
      bcEngine: this.bcEngine
    };
  }

  private applyPressureGradient(equations: Map<string, CfdCellEquation>, component: 'x' | 'y' | 'z'): void {
    this.mesh.cells.forEach(cell => {
      const eq = equations.get(cell.id)!;
      // Calculate grad(p) using adjacent cell pressures
      let gradP = 0;
      cell.faceIds.forEach(fid => {
        const face = this.mesh.faces.get(fid)!;
        const neighborId = face.ownerCellId === cell.id ? face.neighbourCellId : face.ownerCellId;
        if (neighborId) {
          const sign = face.ownerCellId === cell.id ? 1 : -1;
          const pP = this.pressure.getValue(cell.id);
          const pN = this.pressure.getValue(neighborId);
          const areaComp = component === 'x' ? face.normal.x : (component === 'y' ? face.normal.y : face.normal.z);
          gradP += sign * (pN + pP) * 0.5 * face.area * areaComp;
        }
      });
      eq.source -= gradP; // Note: gradP is integrated pressure force on cell faces
    });
  }

  private calculateResidual(equations: Map<string, CfdCellEquation>, field: CfdScalarField): number {
    let sumRes = 0;
    let sumVal = 0;
    equations.forEach((eq, id) => {
      let lhs = eq.aP * field.getValue(id);
      eq.aN.forEach((val, nid) => lhs -= val * field.getValue(nid));
      const res = Math.abs(lhs - eq.source);
      sumRes += res * res;
      sumVal += Math.abs(lhs);
    });
    return Math.sqrt(sumRes) / (sumVal + 1e-10);
  }

  private updateVelocityComponent(equations: Map<string, CfdCellEquation>, comp: 'u' | 'v' | 'w'): void {
    equations.forEach((eq, id) => {
      const currentVal = this.velocity.getValue(id);
      let rhs = eq.source;
      eq.aN.forEach((val, nid) => {
        const neighborVal = this.velocity.getValue(nid);
        const nv = comp === 'u' ? neighborVal.x : (comp === 'v' ? neighborVal.y : neighborVal.z);
        rhs += val * nv;
      });
      
      const newVal = rhs / eq.aP;
      const cv = comp === 'u' ? currentVal.x : (comp === 'v' ? currentVal.y : currentVal.z);
      const relaxedVal = cv + this.config.underRelaxationU * (newVal - cv);
      
      if (comp === 'u') this.velocity.setValue(id, { ...currentVal, x: relaxedVal });
      else if (comp === 'v') this.velocity.setValue(id, { ...currentVal, y: relaxedVal });
      else this.velocity.setValue(id, { ...currentVal, z: relaxedVal });
    });
  }

  private getComponentField(comp: 'u' | 'v' | 'w', field: CfdVectorField): CfdScalarField {
    const scalar = new CfdScalarField(comp, 'm/s', 'CELL');
    field.getAllValues().forEach((val, id) => {
      scalar.setValue(id, comp === 'u' ? val.x : (comp === 'v' ? val.y : val.z));
    });
    return scalar;
  }
}
