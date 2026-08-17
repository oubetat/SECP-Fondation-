/**
 * PATCH-SECP-082: 3D Finite Volume Navier-Stokes SIMPLE Solver Engine (BASELINE 082.0)
 */

import {
  FvmMesh3D,
  FluidProperties3D,
  SolverConfig3D,
  CfdSolution3D,
  VelocityField3D,
  TurbulenceField3D,
  CfdIterationLog3D,
  AerodynamicMonitors3D
} from './Fvm3DTypes';

export class Fvm3DNavierStokesSolver {

  public static solve(
    mesh: FvmMesh3D,
    fluid: FluidProperties3D,
    config: SolverConfig3D,
    referenceAreaM2: number = 1.0,
    referenceVelocityMS: number = 1.0
  ): CfdSolution3D {
    const numCells = mesh.cells.length;
    const rho = fluid.densityKgM3;
    const mu = fluid.viscosityPaS;

    // Reynolds Number calculation based on bounding box
    const lx = mesh.boundingBox.max.x - mesh.boundingBox.min.x;
    const reynoldsNumber = (rho * referenceVelocityMS * lx) / mu;
    const flowRegime = reynoldsNumber > 2300 ? 'TURBULENT' : 'LAMINAR';

    // Initialize Fields
    const u = new Array<number>(numCells).fill(0.0);
    const v = new Array<number>(numCells).fill(0.0);
    const w = new Array<number>(numCells).fill(0.0);
    const p = new Array<number>(numCells).fill(0.0);

    // Turbulence fields (k, epsilon, nut)
    const k = new Array<number>(numCells).fill(1e-4);
    const eps = new Array<number>(numCells).fill(1e-3);
    const nut = new Array<number>(numCells).fill(0.0);

    // Initialize velocity from inlet boundary conditions
    for (const f of mesh.faces) {
      if (f.boundaryType === 'INLET' && f.u_bc !== undefined) {
        if (f.neighborCellId === -1 && f.ownerCellId !== -1) {
          u[f.ownerCellId] = f.u_bc;
          if (f.v_bc !== undefined) v[f.ownerCellId] = f.v_bc;
          if (f.w_bc !== undefined) w[f.ownerCellId] = f.w_bc;
        }
      }
    }

    const iterationHistory: CfdIterationLog3D[] = [];
    let converged = false;
    let finalContinuityResidual = 1.0;
    let finalMomentumResidual = 1.0;
    let globalMassImbalanceNorm = 0.0;

    const alpha_u = config.underRelaxationVelocity || 0.7;
    const alpha_p = config.underRelaxationPressure || 0.3;

    // Outer SIMPLE Iterations
    for (let iter = 1; iter <= config.maxIterations; iter++) {
      // -------------------------------------------------------------
      // Step 1: Update Effective Viscosity (k-epsilon model if enabled)
      // -------------------------------------------------------------
      if (config.useTurbulenceModel && config.turbulenceScheme === 'K_EPSILON') {
        const C_mu = 0.09;
        for (let c = 0; c < numCells; c++) {
          nut[c] = rho * C_mu * (k[c] * k[c]) / Math.max(eps[c], 1e-10);
        }
      }

      // -------------------------------------------------------------
      // Step 2: Momentum Predictor Step (Solve u*, v*, w*)
      // -------------------------------------------------------------
      const aP_u = new Array<number>(numCells).fill(0.0);
      const b_u = new Array<number>(numCells).fill(0.0);
      const b_v = new Array<number>(numCells).fill(0.0);
      const b_w = new Array<number>(numCells).fill(0.0);

      let maxMomRes = 0.0;

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        let aP = 0.0;
        let su = 0.0, sv = 0.0, sw = 0.0;

        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          const n = face.normal;
          const Af = face.area;
          const effMu = mu + nut[c];

          // Face normal velocity
          let u_f = 0.5 * (u[c] + (neighborId !== -1 ? u[neighborId] : u[c]));
          let v_f = 0.5 * (v[c] + (neighborId !== -1 ? v[neighborId] : v[c]));
          let w_f = 0.5 * (w[c] + (neighborId !== -1 ? w[neighborId] : w[c]));

          if (face.boundaryType === 'INLET') {
            u_f = face.u_bc ?? u[c];
            v_f = face.v_bc ?? 0;
            w_f = face.w_bc ?? 0;
          } else if (face.boundaryType === 'WALL') {
            u_f = 0; v_f = 0; w_f = 0;
          }

          const Vn = sign * (u_f * n.x + v_f * n.y + w_f * n.z);
          const F_f = rho * Vn * Af;

          // Diffusion conductance
          const d_PN = (neighborId !== -1)
            ? Math.sqrt(
                Math.pow(mesh.cells[neighborId].centroid.x - cell.centroid.x, 2) +
                Math.pow(mesh.cells[neighborId].centroid.y - cell.centroid.y, 2) +
                Math.pow(mesh.cells[neighborId].centroid.z - cell.centroid.z, 2)
              )
            : Math.sqrt(
                Math.pow(face.centroid.x - cell.centroid.x, 2) +
                Math.pow(face.centroid.y - cell.centroid.y, 2) +
                Math.pow(face.centroid.z - cell.centroid.z, 2)
              );
          const D_f = effMu * Af / Math.max(d_PN, 1e-6);

          // First Order Upwind (FOU) Convection-Diffusion
          const aN = D_f + Math.max(-F_f, 0.0);
          aP += D_f + Math.max(F_f, 0.0);

          if (neighborId !== -1) {
            su += aN * u[neighborId];
            sv += aN * v[neighborId];
            sw += aN * w[neighborId];
          } else {
            // Boundary Condition terms
            if (face.boundaryType === 'INLET' || face.boundaryType === 'WALL') {
              const u_b = face.u_bc ?? 0;
              const v_b = face.v_bc ?? 0;
              const w_b = face.w_bc ?? 0;
              su += (D_f + Math.max(-F_f, 0)) * u_b;
              sv += (D_f + Math.max(-F_f, 0)) * v_b;
              sw += (D_f + Math.max(-F_f, 0)) * w_b;
            } else if (face.boundaryType === 'OUTLET') {
              su += aN * u[c];
              sv += aN * v[c];
              sw += aN * w[c];
            }
          }

          // Pressure gradient force
          const p_f = (face.boundaryType === 'OUTLET' && face.p_bc !== undefined)
            ? face.p_bc
            : p[c];
          su -= sign * p_f * n.x * Af;
          sv -= sign * p_f * n.y * Af;
          sw -= sign * p_f * n.z * Af;
        }

        aP_u[c] = aP / alpha_u;
        b_u[c] = su + (1.0 - alpha_u) * aP_u[c] * u[c];
        b_v[c] = sv + (1.0 - alpha_u) * aP_u[c] * v[c];
        b_w[c] = sw + (1.0 - alpha_u) * aP_u[c] * w[c];
      }

      // Solve intermediate velocity u*, v*, w*
      const u_star = new Array<number>(numCells);
      const v_star = new Array<number>(numCells);
      const w_star = new Array<number>(numCells);

      for (let c = 0; c < numCells; c++) {
        u_star[c] = b_u[c] / Math.max(aP_u[c], 1e-10);
        v_star[c] = b_v[c] / Math.max(aP_u[c], 1e-10);
        w_star[c] = b_w[c] / Math.max(aP_u[c], 1e-10);

        const resU = Math.abs(aP_u[c] * u_star[c] - b_u[c]);
        if (resU > maxMomRes) maxMomRes = resU;
      }

      // -------------------------------------------------------------
      // Step 3: Pressure Correction p' Poisson System
      // -------------------------------------------------------------
      const p_prime = new Array<number>(numCells).fill(0.0);
      const b_p = new Array<number>(numCells).fill(0.0);
      let totalMassImbalance = 0.0;
      let inletMassFlow = 0.0;
      let outletMassFlow = 0.0;

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        let fluxDefect = 0.0;

        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          let u_f = 0.5 * (u_star[c] + (neighborId !== -1 ? u_star[neighborId] : u_star[c]));
          let v_f = 0.5 * (v_star[c] + (neighborId !== -1 ? v_star[neighborId] : v_star[c]));
          let w_f = 0.5 * (w_star[c] + (neighborId !== -1 ? w_star[neighborId] : w_star[c]));

          if (face.boundaryType === 'INLET') {
            u_f = face.u_bc ?? u_star[c];
            v_f = face.v_bc ?? 0;
            w_f = face.w_bc ?? 0;
            const mdot = rho * (u_f * face.normal.x + v_f * face.normal.y + w_f * face.normal.z) * face.area;
            inletMassFlow += Math.abs(mdot);
          } else if (face.boundaryType === 'OUTLET') {
            const mdot = rho * (u_f * face.normal.x + v_f * face.normal.y + w_f * face.normal.z) * face.area;
            outletMassFlow += Math.abs(mdot);
          } else if (face.boundaryType === 'WALL') {
            u_f = 0; v_f = 0; w_f = 0;
          }

          const faceFlux = rho * (u_f * face.normal.x + v_f * face.normal.y + w_f * face.normal.z) * face.area;
          fluxDefect += sign * faceFlux;
        }

        b_p[c] = -fluxDefect;
        totalMassImbalance += Math.abs(fluxDefect);
      }

      const contRes = totalMassImbalance / Math.max(inletMassFlow, 1.0);
      globalMassImbalanceNorm = Math.abs(inletMassFlow - outletMassFlow) / Math.max(inletMassFlow, 1e-6);

      // Solve Pressure Correction p' via Gauss-Seidel iterations
      for (let pIter = 0; pIter < 20; pIter++) {
        for (let c = 0; c < numCells; c++) {
          const cell = mesh.cells[c];
          let aP_p = 0.0;
          let sum_aN_pN = 0.0;

          for (const faceId of cell.faceIds) {
            const face = mesh.faces[faceId];
            const isOwner = face.ownerCellId === c;
            const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;

            const aP_face = 0.5 * (aP_u[c] + (neighborId !== -1 ? aP_u[neighborId] : aP_u[c]));
            const aN_p = (rho * face.area * face.area) / Math.max(aP_face, 1e-10);
            aP_p += aN_p;

            if (neighborId !== -1) {
              sum_aN_pN += aN_p * p_prime[neighborId];
            }
          }

          p_prime[c] = (b_p[c] + sum_aN_pN) / Math.max(aP_p, 1e-10);
        }
      }

      // -------------------------------------------------------------
      // Step 4: Correct Velocities and Pressure Field
      // -------------------------------------------------------------
      let maxDeltaP = 0.0;
      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        p[c] += alpha_p * p_prime[c];

        if (Math.abs(p_prime[c]) > maxDeltaP) {
          maxDeltaP = Math.abs(p_prime[c]);
        }

        // Velocity correction
        let gradPx = 0.0, gradPy = 0.0, gradPz = 0.0;
        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          const p_neighbor = (neighborId !== -1) ? p_prime[neighborId] : 0.0;
          const p_f = 0.5 * (p_prime[c] + p_neighbor);

          gradPx += sign * p_f * face.normal.x * face.area;
          gradPy += sign * p_f * face.normal.y * face.area;
          gradPz += sign * p_f * face.normal.z * face.area;
        }

        const vol = cell.volume;
        u[c] = u_star[c] - (vol / Math.max(aP_u[c], 1e-10)) * (gradPx / vol);
        v[c] = v_star[c] - (vol / Math.max(aP_u[c], 1e-10)) * (gradPy / vol);
        w[c] = w_star[c] - (vol / Math.max(aP_u[c], 1e-10)) * (gradPz / vol);
      }

      // Track iteration log
      let maxV = 0.0;
      for (let c = 0; c < numCells; c++) {
        const speed = Math.sqrt(u[c] * u[c] + v[c] * v[c] + w[c] * w[c]);
        if (speed > maxV) maxV = speed;
      }

      iterationHistory.push({
        iteration: iter,
        continuityResidual: contRes,
        uMomentumResidual: maxMomRes,
        vMomentumResidual: maxMomRes,
        wMomentumResidual: maxMomRes,
        pressureChange: maxDeltaP,
        globalMassImbalanceKgS: totalMassImbalance,
        maxVelocityMS: maxV
      });

      // Convergence Check
      if (contRes < config.continuityTol && maxMomRes < config.momentumTol) {
        converged = true;
        finalContinuityResidual = contRes;
        finalMomentumResidual = maxMomRes;
        break;
      }

      finalContinuityResidual = contRes;
      finalMomentumResidual = maxMomRes;
    }

    // -------------------------------------------------------------
    // Aerodynamic Monitors: Pressure Drop, Drag (Cd), and Lift (Cl)
    // -------------------------------------------------------------
    let inletPressSum = 0.0, inletAreaSum = 0.0;
    let outletPressSum = 0.0, outletAreaSum = 0.0;

    let fxPressure = 0.0, fyPressure = 0.0;
    let fxViscous = 0.0, fyViscous = 0.0;

    for (const face of mesh.faces) {
      if (face.boundaryType === 'INLET') {
        inletPressSum += p[face.ownerCellId] * face.area;
        inletAreaSum += face.area;
      } else if (face.boundaryType === 'OUTLET') {
        outletPressSum += (face.p_bc ?? p[face.ownerCellId]) * face.area;
        outletAreaSum += face.area;
      } else if (face.boundaryType === 'WALL') {
        const c = face.ownerCellId;
        const p_wall = p[c];

        // Pressure Force F_p = - p_wall * n * A
        fxPressure += -p_wall * face.normal.x * face.area;
        fyPressure += -p_wall * face.normal.y * face.area;

        // Viscous Shear Force tau = mu * (u / d_wall)
        const cellCentroid = mesh.cells[c].centroid;
        const d_wall = Math.sqrt(
          Math.pow(cellCentroid.x - face.centroid.x, 2) +
          Math.pow(cellCentroid.y - face.centroid.y, 2) +
          Math.pow(cellCentroid.z - face.centroid.z, 2)
        );
        const effMu = mu + nut[c];
        const tau_x = effMu * (u[c] / Math.max(d_wall, 1e-6));
        const tau_y = effMu * (v[c] / Math.max(d_wall, 1e-6));

        fxViscous += tau_x * face.area;
        fyViscous += tau_y * face.area;
      }
    }

    const avgPInlet = inletAreaSum > 0 ? inletPressSum / inletAreaSum : p[0];
    const avgPOutlet = outletAreaSum > 0 ? outletPressSum / outletAreaSum : 0.0;
    const pressureDropPa = avgPInlet - avgPOutlet;

    const dragForceN = fxPressure + fxViscous;
    const liftForceN = fyPressure + fyViscous;

    const dynamicPressure = 0.5 * rho * referenceVelocityMS * referenceVelocityMS;
    const Cd = dragForceN / Math.max(dynamicPressure * referenceAreaM2, 1e-10);
    const Cl = liftForceN / Math.max(dynamicPressure * referenceAreaM2, 1e-10);

    const monitors: AerodynamicMonitors3D = {
      pressureDropPa,
      dragForceN,
      liftForceN,
      pressureDragForceN: fxPressure,
      viscousDragForceN: fxViscous,
      dragCoefficientCd: Cd,
      liftCoefficientCl: Cl,
      referenceAreaM2,
      referenceVelocityMS
    };

    let numericalStatus: 'STABLE' | 'SENSITIVE' | 'ILL_CONDITIONED' | 'UNSTABLE' | 'INVALID' = 'STABLE';
    if (isNaN(finalContinuityResidual) || !isFinite(finalContinuityResidual)) {
      numericalStatus = 'INVALID';
    } else if (finalContinuityResidual > 1.0) {
      numericalStatus = 'UNSTABLE';
    } else if (finalContinuityResidual > 0.05) {
      numericalStatus = 'SENSITIVE';
    }

    const velocityField: VelocityField3D = { u, v, w };
    const turbulenceField: TurbulenceField3D = { k, epsilon: eps, nut };

    return {
      mesh,
      fluid,
      reynoldsNumber,
      flowRegime,
      velocity: velocityField,
      pressure: p,
      turbulence: turbulenceField,
      iterationHistory,
      totalIterations: iterationHistory.length,
      converged,
      finalContinuityResidual,
      finalMomentumResidual,
      globalMassImbalanceNorm,
      monitors,
      numericalStatus
    };
  }
}
