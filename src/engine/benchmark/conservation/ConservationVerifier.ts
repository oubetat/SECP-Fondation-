/**
 * SECP Industrial OS v2 — Independent Conservation Verifier
 * Phase 15 (PATCH-175)
 *
 * Implements strict, independent boundary flux and volume integral extraction
 * for Mass, Momentum, and Energy conservation laws. Operates directly on raw
 * mesh and solution tensors without calling solver bypasses.
 */

import {
  Vector3D,
  FvmMesh3D,
  FluidProperties3D,
  SolverConfig3D,
  CfdSolution3D
} from '../../cfd3d/Fvm3DTypes';
import {
  ConservationMetrics,
  ConservationThresholds,
  ConservationVerdict,
  MassConservationMetrics,
  MomentumConservationMetrics,
  EnergyConservationMetrics
} from './types';

export class ConservationVerifier {
  /**
   * Evaluates complete conservation metrics independently from the solver.
   */
  public static verifyConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D,
    config: SolverConfig3D,
    thresholds: ConservationThresholds,
    bodyForce?: Vector3D
  ): {
    metrics: ConservationMetrics;
    verdict: ConservationVerdict;
    failureReasons: string[];
  } {
    const failureReasons: string[] = [];

    // Step 1: Detect NaN or Infinity
    const hasNaN = this.checkNaNOrInfinity(mesh, solution, fluid);
    if (hasNaN) {
      return {
        metrics: this.buildInvalidMetrics(),
        verdict: 'INVALID',
        failureReasons: ['Numerical field contains NaN or Infinity.']
      };
    }

    // Step 2: Evaluate Convergence State
    const isConverged = solution.converged;
    const contRes = solution.finalContinuityResidual;
    if (isNaN(contRes) || !isFinite(contRes)) {
      return {
        metrics: this.buildInvalidMetrics(),
        verdict: 'INVALID',
        failureReasons: ['Continuity residual is NaN or non-finite.']
      };
    }

    // Step 3: Independent Mass Conservation Calculation
    const massMetrics = this.computeMassConservation(mesh, solution, fluid, thresholds.maxMassRelativeErrorPercent);

    // Step 4: Independent Momentum Conservation Calculation
    const momentumMetrics = this.computeMomentumConservation(mesh, solution, fluid, thresholds.maxMomentumRelativeErrorPercent, bodyForce);

    // Step 5: Independent Energy Conservation Calculation
    const energyMetrics = this.computeEnergyConservation(mesh, solution, fluid, thresholds.maxEnergyRelativeErrorPercent);

    // Step 6: Verdict Determination
    let verdict: ConservationVerdict = 'PASS';

    // Mass Check
    if (!massMetrics.isConserved) {
      verdict = 'CONSERVATION_FAILURE';
      failureReasons.push(`Mass conservation violated: Error ${massMetrics.relativeErrorPercent.toFixed(4)}% exceeds threshold ${thresholds.maxMassRelativeErrorPercent}%`);
    }

    // Momentum Check
    if (momentumMetrics && !momentumMetrics.isConserved) {
      verdict = 'CONSERVATION_FAILURE';
      failureReasons.push(`Momentum conservation violated: Error ${momentumMetrics.relativeErrorPercent.toFixed(4)}% exceeds threshold ${thresholds.maxMomentumRelativeErrorPercent}%`);
    }

    // Solver Convergence Verification
    if (!isConverged && contRes > thresholds.minConvergenceResidual) {
      // If solver did not converge to specified residual tolerance
      if (verdict === 'PASS') {
        verdict = 'NOT_CONVERGED';
        failureReasons.push(`Solver did not converge to tolerance (${contRes.toExponential(2)} > ${thresholds.minConvergenceResidual.toExponential(2)})`);
      }
    }

    const metrics: ConservationMetrics = {
      mass: massMetrics,
      momentum: momentumMetrics,
      energy: energyMetrics
    };

    return {
      metrics,
      verdict,
      failureReasons
    };
  }

  /**
   * Computes face-by-face mass fluxes across all boundary faces.
   */
  public static computeMassConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D,
    thresholdPercent: number
  ): MassConservationMetrics {
    const rho = fluid.densityKgM3;
    let totalInflowKgS = 0.0;
    let totalOutflowKgS = 0.0;
    const accumulationKgS = 0.0; // Steady-state solver accumulation = 0

    for (const face of mesh.faces) {
      // Check if boundary face
      if (face.neighborCellId === -1 && face.ownerCellId !== -1) {
        const ownerId = face.ownerCellId;
        const ownerCell = mesh.cells[ownerId];

        // Ensure normal points outward from owner cell
        const dx = face.centroid.x - ownerCell.centroid.x;
        const dy = face.centroid.y - ownerCell.centroid.y;
        const dz = face.centroid.z - ownerCell.centroid.z;
        let nx = face.normal.x;
        let ny = face.normal.y;
        let nz = face.normal.z;
        const dotSign = dx * nx + dy * ny + dz * nz;
        if (dotSign < 0.0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        // Determine face velocity
        let u_f = 0.0;
        let v_f = 0.0;
        let w_f = 0.0;

        if (face.boundaryType === 'INLET') {
          u_f = face.u_bc ?? solution.velocity.u[ownerId];
          v_f = face.v_bc ?? solution.velocity.v[ownerId];
          w_f = face.w_bc ?? solution.velocity.w[ownerId];
        } else if (face.boundaryType === 'WALL') {
          u_f = face.u_bc ?? 0.0;
          v_f = face.v_bc ?? 0.0;
          w_f = face.w_bc ?? 0.0;
        } else if (face.boundaryType === 'SYMMETRY') {
          // Symmetry boundary: zero normal velocity (u_f = u_cell - (u_cell . n) n)
          const uc = solution.velocity.u[ownerId];
          const vc = solution.velocity.v[ownerId];
          const wc = solution.velocity.w[ownerId];
          const unCell = uc * nx + vc * ny + wc * nz;
          u_f = uc - unCell * nx;
          v_f = vc - unCell * ny;
          w_f = wc - unCell * nz;
        } else if (face.boundaryType === 'OUTLET') {
          u_f = solution.velocity.u[ownerId];
          v_f = solution.velocity.v[ownerId];
          w_f = solution.velocity.w[ownerId];
        }

        // Face normal velocity (positive = outward, negative = inward)
        const un = u_f * nx + v_f * ny + w_f * nz;
        const mDot = rho * face.area * un;

        if (mDot < 0.0) {
          totalInflowKgS += Math.abs(mDot);
        } else {
          totalOutflowKgS += mDot;
        }
      }
    }

    const imbalanceKgS = Math.abs(totalInflowKgS - totalOutflowKgS - accumulationKgS);
    const referenceFlow = Math.max(totalInflowKgS, totalOutflowKgS, 1e-9);
    const relativeErrorPercent = (imbalanceKgS / referenceFlow) * 100.0;
    const isConserved = relativeErrorPercent <= thresholdPercent;

    return {
      inflowKgS: totalInflowKgS,
      outflowKgS: totalOutflowKgS,
      accumulationKgS,
      imbalanceKgS,
      relativeErrorPercent,
      isConserved,
      thresholdPercent,
      status: isConserved ? 'VERIFIED' : 'FAILED',
      details: `Inflow: ${totalInflowKgS.toExponential(4)} kg/s, Outflow: ${totalOutflowKgS.toExponential(4)} kg/s, Imbalance: ${imbalanceKgS.toExponential(4)} kg/s (${relativeErrorPercent.toFixed(4)}%)`
    };
  }

  /**
   * Computes independent momentum balance: Sum of Forces = Net Momentum Flux
   */
  public static computeMomentumConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D,
    thresholdPercent: number,
    bodyForce?: Vector3D
  ): MomentumConservationMetrics {
    const rho = fluid.densityKgM3;
    const mu = fluid.viscosityPaS;

    const pressureForceN: Vector3D = { x: 0, y: 0, z: 0 };
    const viscousForceN: Vector3D = { x: 0, y: 0, z: 0 };
    const momentumFluxInN: Vector3D = { x: 0, y: 0, z: 0 };
    const momentumFluxOutN: Vector3D = { x: 0, y: 0, z: 0 };
    const bodyForceTotalN: Vector3D = { x: 0, y: 0, z: 0 };
    const accumulationN: Vector3D = { x: 0, y: 0, z: 0 };

    // 1. Boundary forces & momentum fluxes
    for (const face of mesh.faces) {
      if (face.neighborCellId === -1 && face.ownerCellId !== -1) {
        const ownerId = face.ownerCellId;
        const ownerCell = mesh.cells[ownerId];

        // Ensure outward normal
        const dx = face.centroid.x - ownerCell.centroid.x;
        const dy = face.centroid.y - ownerCell.centroid.y;
        const dz = face.centroid.z - ownerCell.centroid.z;
        let nx = face.normal.x;
        let ny = face.normal.y;
        let nz = face.normal.z;
        const dotSign = dx * nx + dy * ny + dz * nz;
        if (dotSign < 0.0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        let pFace = solution.pressure[ownerId] ?? 0.0;
        if (face.boundaryType === 'OUTLET' && face.p_bc !== undefined) {
          pFace = face.p_bc;
        } else if (face.boundaryType === 'INLET') {
          // Extrapolate pressure from interior cells to boundary face along outward normal
          const pC = solution.pressure[ownerId] ?? 0.0;
          let bestOpposingDot = 0.0;
          let pOpposing = pC;
          for (const fId of ownerCell.faceIds) {
            const fOther = mesh.faces[fId];
            if (fOther.id === face.id) continue;
            const otherNbrId = fOther.ownerCellId === ownerId ? fOther.neighborCellId : fOther.ownerCellId;
            if (otherNbrId !== -1 && otherNbrId !== ownerId) {
              const otherCell = mesh.cells[otherNbrId];
              const dcnx = otherCell.centroid.x - ownerCell.centroid.x;
              const dcny = otherCell.centroid.y - ownerCell.centroid.y;
              const dcnz = otherCell.centroid.z - ownerCell.centroid.z;
              const dot = dcnx * nx + dcny * ny + dcnz * nz;
              if (dot < bestOpposingDot) {
                bestOpposingDot = dot;
                pOpposing = solution.pressure[otherNbrId] ?? pC;
              }
            }
          }
          if (bestOpposingDot < 0.0) {
            pFace = pC + 0.5 * (pC - pOpposing);
          }
        }
        // Pressure force on fluid = - Integral(p * n * dA)
        pressureForceN.x += -pFace * nx * face.area;
        pressureForceN.y += -pFace * ny * face.area;
        pressureForceN.z += -pFace * nz * face.area;

        // Viscous wall shear stress on wall faces
        if (face.boundaryType === 'WALL') {
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1e-6);
          const u_c = solution.velocity.u[ownerId];
          const v_c = solution.velocity.v[ownerId];
          const w_c = solution.velocity.w[ownerId];

          const u_wall = face.u_bc ?? 0.0;
          const v_wall = face.v_bc ?? 0.0;
          const w_wall = face.w_bc ?? 0.0;

          // Velocity difference
          const du = u_wall - u_c;
          const dv = v_wall - v_c;
          const dw = w_wall - w_c;

          // Shear stress tau = mu * (du / dist)
          const tauX = mu * (du / dist);
          const tauY = mu * (dv / dist);
          const tauZ = mu * (dw / dist);

          viscousForceN.x += tauX * face.area;
          viscousForceN.y += tauY * face.area;
          viscousForceN.z += tauZ * face.area;
        }

        // Boundary momentum flux
        let u_f = 0.0;
        let v_f = 0.0;
        let w_f = 0.0;

        if (face.boundaryType === 'INLET') {
          u_f = face.u_bc ?? solution.velocity.u[ownerId];
          v_f = face.v_bc ?? solution.velocity.v[ownerId];
          w_f = face.w_bc ?? solution.velocity.w[ownerId];
        } else if (face.boundaryType === 'WALL') {
          u_f = face.u_bc ?? 0.0;
          v_f = face.v_bc ?? 0.0;
          w_f = face.w_bc ?? 0.0;
        } else if (face.boundaryType === 'SYMMETRY') {
          const uc = solution.velocity.u[ownerId];
          const vc = solution.velocity.v[ownerId];
          const wc = solution.velocity.w[ownerId];
          const unCell = uc * nx + vc * ny + wc * nz;
          u_f = uc - unCell * nx;
          v_f = vc - unCell * ny;
          w_f = wc - unCell * nz;
        } else if (face.boundaryType === 'OUTLET') {
          u_f = solution.velocity.u[ownerId];
          v_f = solution.velocity.v[ownerId];
          w_f = solution.velocity.w[ownerId];
        }

        const un = u_f * nx + v_f * ny + w_f * nz;
        const mDot = rho * face.area * un;

        if (mDot < 0.0) {
          // Entering domain
          momentumFluxInN.x += Math.abs(mDot) * u_f;
          momentumFluxInN.y += Math.abs(mDot) * v_f;
          momentumFluxInN.z += Math.abs(mDot) * w_f;
        } else {
          // Leaving domain
          momentumFluxOutN.x += mDot * u_f;
          momentumFluxOutN.y += mDot * v_f;
          momentumFluxOutN.z += mDot * w_f;
        }
      }
    }

    // 2. Volume-integrated Body Forces
    if (bodyForce) {
      for (const cell of mesh.cells) {
        const massCell = rho * cell.volume;
        bodyForceTotalN.x += massCell * bodyForce.x;
        bodyForceTotalN.y += massCell * bodyForce.y;
        bodyForceTotalN.z += massCell * bodyForce.z;
      }
    }

    // Net momentum flux leaving domain = Outflow flux - Inflow flux
    const momentumFluxNetN: Vector3D = {
      x: momentumFluxOutN.x - momentumFluxInN.x,
      y: momentumFluxOutN.y - momentumFluxInN.y,
      z: momentumFluxOutN.z - momentumFluxInN.z
    };

    // Total net applied force = Pressure Force + Viscous Force + Body Force
    const totalAppliedForceN: Vector3D = {
      x: pressureForceN.x + viscousForceN.x + bodyForceTotalN.x,
      y: pressureForceN.y + viscousForceN.y + bodyForceTotalN.y,
      z: pressureForceN.z + viscousForceN.z + bodyForceTotalN.z
    };

    // Residual vector R = Total Applied Force - Net Momentum Flux - Accumulation
    const residualVectorN: Vector3D = {
      x: totalAppliedForceN.x - momentumFluxNetN.x - accumulationN.x,
      y: totalAppliedForceN.y - momentumFluxNetN.y - accumulationN.y,
      z: totalAppliedForceN.z - momentumFluxNetN.z - accumulationN.z
    };

    const residualNormN = Math.sqrt(
      residualVectorN.x * residualVectorN.x +
      residualVectorN.y * residualVectorN.y +
      residualVectorN.z * residualVectorN.z
    );

    const pressureMag = Math.sqrt(pressureForceN.x * pressureForceN.x + pressureForceN.y * pressureForceN.y + pressureForceN.z * pressureForceN.z);
    const viscousMag = Math.sqrt(viscousForceN.x * viscousForceN.x + viscousForceN.y * viscousForceN.y + viscousForceN.z * viscousForceN.z);
    const fluxMag = Math.sqrt(momentumFluxNetN.x * momentumFluxNetN.x + momentumFluxNetN.y * momentumFluxNetN.y + momentumFluxNetN.z * momentumFluxNetN.z);

    const referenceForceN = Math.max(pressureMag, viscousMag, fluxMag, 1e-3);
    let relativeErrorPercent = (residualNormN / referenceForceN) * 100.0;
    if (residualNormN < 1e-3 && (pressureMag < 1e-3 && viscousMag < 1e-3 && fluxMag < 1e-3)) {
      relativeErrorPercent = 0.0;
    }
    const isConserved = relativeErrorPercent <= thresholdPercent;

    return {
      momentumFluxInN,
      momentumFluxOutN,
      momentumFluxNetN,
      pressureForceN,
      viscousForceN,
      bodyForceN: bodyForceTotalN,
      accumulationN,
      residualVectorN,
      residualNormN,
      referenceForceN,
      relativeErrorPercent,
      isConserved,
      thresholdPercent,
      status: isConserved ? 'VERIFIED' : 'FAILED',
      details: `Residual Norm: ${residualNormN.toExponential(3)} N, Ref Force: ${referenceForceN.toExponential(3)} N, Error: ${relativeErrorPercent.toFixed(3)}%`
    };
  }

  /**
   * Energy conservation check:
   * Honestly marks UNPROVEN as isothermal FVM solver does not couple temperature/energy equation.
   */
  public static computeEnergyConservation(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D,
    thresholdPercent: number
  ): EnergyConservationMetrics {
    // Current Fvm3DNavierStokesSolver is an isothermal Navier-Stokes solver
    return {
      convectiveInflowW: 0.0,
      convectiveOutflowW: 0.0,
      conductiveFluxW: 0.0,
      pressureWorkW: 0.0,
      sourceTermsW: 0.0,
      accumulationW: 0.0,
      imbalanceW: 0.0,
      relativeErrorPercent: 0.0,
      isConserved: false,
      thresholdPercent,
      status: 'UNPROVEN',
      notes: 'Energy equation is uncoupled/absent in isothermal FVM Navier-Stokes solver core. Marked UNPROVEN per Anti-Fabrication rules.'
    };
  }

  private static checkNaNOrInfinity(
    mesh: FvmMesh3D,
    solution: CfdSolution3D,
    fluid: FluidProperties3D
  ): boolean {
    if (isNaN(fluid.densityKgM3) || !isFinite(fluid.densityKgM3) ||
        isNaN(fluid.viscosityPaS) || !isFinite(fluid.viscosityPaS)) {
      return true;
    }

    for (let i = 0; i < solution.velocity.u.length; i++) {
      if (isNaN(solution.velocity.u[i]) || !isFinite(solution.velocity.u[i]) ||
          isNaN(solution.velocity.v[i]) || !isFinite(solution.velocity.v[i]) ||
          isNaN(solution.velocity.w[i]) || !isFinite(solution.velocity.w[i]) ||
          isNaN(solution.pressure[i]) || !isFinite(solution.pressure[i])) {
        return true;
      }
    }

    for (const cell of mesh.cells) {
      if (isNaN(cell.volume) || !isFinite(cell.volume) || cell.volume <= 0) {
        return true;
      }
    }

    return false;
  }

  private static buildInvalidMetrics(): ConservationMetrics {
    return {
      mass: {
        inflowKgS: 0,
        outflowKgS: 0,
        accumulationKgS: 0,
        imbalanceKgS: NaN,
        relativeErrorPercent: NaN,
        isConserved: false,
        thresholdPercent: 0.5,
        status: 'FAILED',
        details: 'Invalid numerical state.'
      },
      momentum: {
        momentumFluxInN: { x: 0, y: 0, z: 0 },
        momentumFluxOutN: { x: 0, y: 0, z: 0 },
        momentumFluxNetN: { x: 0, y: 0, z: 0 },
        pressureForceN: { x: 0, y: 0, z: 0 },
        viscousForceN: { x: 0, y: 0, z: 0 },
        bodyForceN: { x: 0, y: 0, z: 0 },
        accumulationN: { x: 0, y: 0, z: 0 },
        residualVectorN: { x: NaN, y: NaN, z: NaN },
        residualNormN: NaN,
        referenceForceN: NaN,
        relativeErrorPercent: NaN,
        isConserved: false,
        thresholdPercent: 5.0,
        status: 'FAILED',
        details: 'Invalid numerical state.'
      },
      energy: {
        convectiveInflowW: 0,
        convectiveOutflowW: 0,
        conductiveFluxW: 0,
        pressureWorkW: 0,
        sourceTermsW: 0,
        accumulationW: 0,
        imbalanceW: NaN,
        relativeErrorPercent: NaN,
        isConserved: false,
        thresholdPercent: 5.0,
        status: 'UNPROVEN',
        notes: 'Invalid numerical state.'
      }
    };
  }
}
