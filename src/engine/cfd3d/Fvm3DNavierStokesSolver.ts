/**
 * PATCH-SECP-082.1: 3D Finite Volume Navier-Stokes SIMPLE Solver Engine (STABLE & PHYSICAL REMEDIATION)
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

    // SECTION 8: Physical input validation
    if (rho <= 0.0 || isNaN(rho) || !isFinite(rho)) {
      throw new Error(`NUMERICAL_FAILURE: Fluid density must be positive. Found: ${rho}`);
    }
    if (mu <= 0.0 || isNaN(mu) || !isFinite(mu)) {
      throw new Error(`NUMERICAL_FAILURE: Fluid viscosity must be positive. Found: ${mu}`);
    }

    // Correct boundary face normals to always point outward from the owner cell
    for (const face of mesh.faces) {
      if (face.neighborCellId === -1 && face.ownerCellId !== -1) {
        const owner = mesh.cells[face.ownerCellId];
        const dx = face.centroid.x - owner.centroid.x;
        const dy = face.centroid.y - owner.centroid.y;
        const dz = face.centroid.z - owner.centroid.z;
        const dot = dx * face.normal.x + dy * face.normal.y + dz * face.normal.z;
        if (dot < 0.0) {
          face.normal.x = -face.normal.x;
          face.normal.y = -face.normal.y;
          face.normal.z = -face.normal.z;
        }
      }
    }

    const face_dPN = new Array<number>(mesh.faces.length);
    for (let fId = 0; fId < mesh.faces.length; fId++) {
      const face = mesh.faces[fId];
      const ownerId = face.ownerCellId;
      const neighborId = face.neighborCellId;
      if (neighborId !== -1) {
        face_dPN[fId] = Math.sqrt(
          Math.pow(mesh.cells[neighborId].centroid.x - mesh.cells[ownerId].centroid.x, 2) +
          Math.pow(mesh.cells[neighborId].centroid.y - mesh.cells[ownerId].centroid.y, 2) +
          Math.pow(mesh.cells[neighborId].centroid.z - mesh.cells[ownerId].centroid.z, 2)
        );
      } else {
        face_dPN[fId] = Math.sqrt(
          Math.pow(face.centroid.x - mesh.cells[ownerId].centroid.x, 2) +
          Math.pow(face.centroid.y - mesh.cells[ownerId].centroid.y, 2) +
          Math.pow(face.centroid.z - mesh.cells[ownerId].centroid.z, 2)
        );
      }
    }

    // Reynolds Number calculation based on bounding box
    const lx = mesh.boundingBox.max.x - mesh.boundingBox.min.x;
    const reynoldsNumber = (rho * referenceVelocityMS * lx) / mu;
    const flowRegime = reynoldsNumber > 2300 ? 'TURBULENT' : 'LAMINAR';

    // SECTION 6: Boundary Condition Audit & Scaling (PATCH-SECP-083.1 Sensitivity Fix)
    let hasOutlet = false;
    for (const face of mesh.faces) {
      if (face.boundaryType === 'INLET') {
        // If the user provided a reference velocity and the mesh has normalized BCs (1.0), scale them.
        // Or if u_bc is just 1.0, and refVel is not 1.0, we prioritize refVel.
        if (face.u_bc === 1.0 && referenceVelocityMS !== 1.0) {
          face.u_bc = referenceVelocityMS;
        }
        if (face.u_bc === undefined || isNaN(face.u_bc) || !isFinite(face.u_bc)) {
          throw new Error(`BOUNDARY_CONDITION_FAILURE: Inlet boundary face ${face.faceId} lacks valid velocity specification.`);
        }
      } else if (face.boundaryType === 'OUTLET') {
        hasOutlet = true;
      }
    }

    // Initialize Fields
    let initialU = referenceVelocityMS;
    for (const f of mesh.faces) {
      if (f.boundaryType === 'INLET' && f.u_bc !== undefined) {
        initialU = Math.max(initialU, f.u_bc);
      }
    }

    const u = new Array<number>(numCells).fill(initialU);
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
    const faceFluxes = new Array<number>(mesh.faces.length).fill(0.0);
    let converged = false;
    let finalContinuityResidual = 1.0;
    let finalMomentumResidual = 1.0;
    let globalMassImbalanceNorm = 0.0;

    const alpha_u = config.underRelaxationVelocity || 0.7;
    const alpha_p = config.underRelaxationPressure || 0.3;

    // Outer SIMPLE Iterations
    for (let iter = 1; iter <= config.maxIterations; iter++) {
      const u_prev = [...u];
      const v_prev = [...v];
      const w_prev = [...w];
      // -------------------------------------------------------------
      // Step 1: Update Effective Viscosity (k-epsilon model if enabled)
      // -------------------------------------------------------------
      if (config.useTurbulenceModel && config.turbulenceScheme === 'K_EPSILON') {
        const C_mu = 0.09;
        for (let c = 0; c < numCells; c++) {
          nut[c] = rho * C_mu * (k[c] * k[c]) / Math.max(eps[c], 1e-10);
        }
      }

      // Assemble Momentum Predictor (PHASE 2 & 4 Audit)
      const aP_u = new Array<number>(numCells).fill(0.0);
      const aP_u_unrelaxed = new Array<number>(numCells).fill(0.0);
      const b_u = new Array<number>(numCells).fill(0.0);
      const b_v = new Array<number>(numCells).fill(0.0);
      const b_w = new Array<number>(numCells).fill(0.0);
      
      // Freeze neighbor coefficients to ensure consistency in Gauss-Seidel sweeps
      const aN_matrix = new Array<number>(mesh.faces.length).fill(0.0);

      // We use the faceFluxes from the previous iteration for convection (Rhie-Chow consistency)
      if (iter === 1) {
        for (let f = 0; f < mesh.faces.length; f++) {
          const face = mesh.faces[f];
          const owner = face.ownerCellId;
          const nb = face.neighborCellId;
          const u_f = 0.5 * (u[owner] + (nb !== -1 ? u[nb] : u[owner]));
          const v_f = 0.5 * (v[owner] + (nb !== -1 ? v[nb] : v[owner]));
          const w_f = 0.5 * (w[owner] + (nb !== -1 ? w[nb] : w[owner]));
          const Vn = u_f * face.normal.x + v_f * face.normal.y + w_f * face.normal.z;
          faceFluxes[f] = rho * Vn * face.area;
        }
      }

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        
        // Steady-state formulation with ramp-up for stability
        const dt = (iter < 50) ? 0.1 : 1e10; 
        const transientTerm = (rho * cell.volume) / dt;

        let aP = transientTerm;
        let su_bc_p = transientTerm * u[c];
        let sv_bc_p = transientTerm * v[c];
        let sw_bc_p = transientTerm * w[c];

        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          const n = face.normal;
          const Af = face.area;
          const effMu = mu + nut[c];

          // Convective flux F_f using persistent faceFluxes (Rhie-Chow coupling)
          const F_f = sign * faceFluxes[faceId];

          // Diffusion conductance
          const d_PN = face_dPN[faceId];
          const D_f = effMu * Af / Math.max(d_PN, 1e-6);

          // First Order Upwind (FOU) discretization
          const aN = D_f + Math.max(-F_f, 0.0);
          
          // Store aN for the owner cell's perspective (to use in sweeps)
          if (isOwner) aN_matrix[faceId] = aN;
          else {
             // For neighbor, sign is flipped, so F_f_nb = -F_f_owner.
             // aN_nb = D_f + max(-F_f_nb, 0) = D_f + max(F_f_owner, 0)
             // We'll calculate it inside the sweep or store both.
             // Simpler: just store the absolute D_f and F_f and calc aN on the fly.
          }
          
          if (face.boundaryType !== 'SYMMETRY') {
            aP += D_f + Math.max(F_f, 0.0);
          }

          if (neighborId === -1) {
            // Boundary Condition terms
            if (face.boundaryType === 'INLET' || face.boundaryType === 'WALL') {
              const u_b = face.u_bc ?? 0.0;
              const v_b = face.v_bc ?? 0.0;
              const w_b = face.w_bc ?? 0.0;
              su_bc_p += (D_f + Math.max(-F_f, 0.0)) * u_b;
              sv_bc_p += (D_f + Math.max(-F_f, 0.0)) * v_b;
              sw_bc_p += (D_f + Math.max(-F_f, 0.0)) * w_b;
            } else if (face.boundaryType === 'OUTLET') {
              su_bc_p += aN * u[c];
              sv_bc_p += aN * v[c];
              sw_bc_p += aN * w[c];
            } else if (face.boundaryType === 'SYMMETRY') {
              // Symmetry: zero normal flux, zero normal gradient.
              // convective/diffusive fluxes are zero. 
              // su_bc_p += 0; aP += 0; 
            }
          }

          const p_neighbor = (neighborId !== -1) ? p[neighborId] : p[c];
          let p_f = 0.5 * (p[c] + p_neighbor);
          if (face.boundaryType === 'OUTLET' && face.p_bc !== undefined) {
            p_f = face.p_bc;
          }

          su_bc_p -= sign * p_f * n.x * Af;
          sv_bc_p -= sign * p_f * n.y * Af;
          sw_bc_p -= sign * p_f * n.z * Af;
        }

        aP_u_unrelaxed[c] = aP;
        aP_u[c] = aP / alpha_u;
        b_u[c] = su_bc_p + (1.0 - alpha_u) * aP_u[c] * u[c];
        b_v[c] = sv_bc_p + (1.0 - alpha_u) * aP_u[c] * v[c];
        b_w[c] = sw_bc_p + (1.0 - alpha_u) * aP_u[c] * w[c];
      }

      // Solve intermediate velocity u*, v*, w* via 40 sweeps of Gauss-Seidel
      const u_star = [...u];
      const v_star = [...v];
      const w_star = [...w];

      for (let sweep = 0; sweep < 40; sweep++) {
        for (let c = 0; c < numCells; c++) {
          const cell = mesh.cells[c];
          let sum_nb_u = 0.0, sum_nb_v = 0.0, sum_nb_w = 0.0;

          for (const faceId of cell.faceIds) {
            const face = mesh.faces[faceId];
            const isOwner = face.ownerCellId === c;
            const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;

            if (neighborId !== -1) {
              const sign = isOwner ? 1.0 : -1.0;
              const F_outward = sign * faceFluxes[faceId];
              const effMu = mu + nut[c];
              const Af = face.area;
              const d_PN = face_dPN[faceId];
              const D_f = effMu * Af / Math.max(d_PN, 1e-6);
              const aN = D_f + Math.max(-F_outward, 0.0);

              sum_nb_u += aN * u_star[neighborId];
              sum_nb_v += aN * v_star[neighborId];
              sum_nb_w += aN * w_star[neighborId];
            }
          }

          u_star[c] = (b_u[c] + sum_nb_u) / Math.max(aP_u[c], 1e-12);
          v_star[c] = (b_v[c] + sum_nb_v) / Math.max(aP_u[c], 1e-12);
          w_star[c] = (b_w[c] + sum_nb_w) / Math.max(aP_u[c], 1e-12);
        }
      }

      // Calculate physical Momentum residuals before solver corrections
      let sumMomRes = 0.0;
      let maxMomRes = 0.0;
      for (let c = 0; c < numCells; c++) {
        let sum_nb_u = 0.0;
        let sum_nb_v = 0.0;
        let sum_nb_w = 0.0;
        for (const faceId of mesh.cells[c].faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;

          if (neighborId !== -1) {
            const sign = isOwner ? 1.0 : -1.0;
            const Vn = sign * (0.5 * (u[c] + u[neighborId]) * face.normal.x + 
                               0.5 * (v[c] + v[neighborId]) * face.normal.y + 
                               0.5 * (w[c] + w[neighborId]) * face.normal.z);
            const F_f = rho * Vn * face.area;
            const effMu = mu + nut[c];
            const D_f = effMu * face.area / Math.max(face_dPN[faceId], 1e-6);
            const aN = D_f + Math.max(-F_f, 0.0);

            sum_nb_u += aN * u[neighborId];
            sum_nb_v += aN * v[neighborId];
            sum_nb_w += aN * w[neighborId];
          }
        }
        const resU = Math.abs(aP_u[c] * u[c] - (b_u[c] + sum_nb_u));
        const resV = Math.abs(aP_u[c] * v[c] - (b_v[c] + sum_nb_v));
        const resW = Math.abs(aP_u[c] * w[c] - (b_w[c] + sum_nb_w));
        const cellRes = Math.max(resU, resV, resW);
        if (cellRes > maxMomRes) maxMomRes = cellRes;
        sumMomRes += cellRes;
      }

      // -------------------------------------------------------------
      // Step 3: Pressure Correction p' Poisson System (PHASE 3 & 5 Audit)
      // -------------------------------------------------------------
      const p_prime = new Array<number>(numCells).fill(0.0);
      const b_p = new Array<number>(numCells).fill(0.0);
      let totalMassImbalance = 0.0;
      let netGlobalMassFlux = 0.0; 
      let inletMassFlow = 0.0;
      let outletMassFlow = 0.0;

      // Compute cell-centered pressure gradients for Rhie-Chow
      const gradPx_cell = new Array<number>(numCells).fill(0.0);
      const gradPy_cell = new Array<number>(numCells).fill(0.0);
      const gradPz_cell = new Array<number>(numCells).fill(0.0);

      // Compute uncorrected global mass flows for boundary scaling
      let rawInletFlow = 0.0;
      let rawOutletFlow = 0.0;
      for (const face of mesh.faces) {
        if (face.boundaryType === 'INLET') {
          const Vn_bc = (face.u_bc ?? 0) * face.normal.x + (face.v_bc ?? 0) * face.normal.y + (face.w_bc ?? 0) * face.normal.z;
          rawInletFlow += Math.abs(rho * Vn_bc * face.area);
        } else if (face.boundaryType === 'OUTLET') {
          const c = face.ownerCellId;
          const Vn_star = u_star[c] * face.normal.x + v_star[c] * face.normal.y + w_star[c] * face.normal.z;
          rawOutletFlow += Math.abs(rho * Vn_star * face.area);
        }
      }

      // Enforce global mass conservation by scaling outlet velocities uniformly
      if (rawInletFlow > 1e-12 && rawOutletFlow > 1e-12) {
        const massScaling = rawInletFlow / rawOutletFlow;
        for (const face of mesh.faces) {
          if (face.boundaryType === 'OUTLET') {
            const c = face.ownerCellId;
            u_star[c] *= massScaling;
            v_star[c] *= massScaling;
            w_star[c] *= massScaling;
          }
        }
      }

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        let sum_x = 0.0, sum_y = 0.0, sum_z = 0.0;
        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          const p_neighbor = (neighborId !== -1) ? p[neighborId] : p[c];
          let p_f = 0.5 * (p[c] + p_neighbor);
          if (face.boundaryType === 'OUTLET' && face.p_bc !== undefined) {
            p_f = face.p_bc;
          }

          sum_x += sign * p_f * face.normal.x * face.area;
          sum_y += sign * p_f * face.normal.y * face.area;
          sum_z += sign * p_f * face.normal.z * face.area;
        }
        gradPx_cell[c] = sum_x / cell.volume;
        gradPy_cell[c] = sum_y / cell.volume;
        gradPz_cell[c] = sum_z / cell.volume;
      }

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        let fluxDefect = 0.0;

        for (const faceId of cell.faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          let faceFlux = 0.0;

          if (face.boundaryType === 'INLET') {
            const Vn_bc = (face.u_bc ?? 0) * face.normal.x + (face.v_bc ?? 0) * face.normal.y + (face.w_bc ?? 0) * face.normal.z;
            faceFlux = rho * Vn_bc * face.area;
            if (isOwner) inletMassFlow += Math.abs(faceFlux);
          } else if (face.boundaryType === 'WALL' || face.boundaryType === 'SYMMETRY') {
            // No-penetration wall or symmetry: zero normal flux
            faceFlux = 0.0;
          } else if (face.boundaryType === 'OUTLET') {
            const Vn_star = u_star[c] * face.normal.x + v_star[c] * face.normal.y + w_star[c] * face.normal.z;
            faceFlux = rho * Vn_star * face.area;
            if (isOwner) outletMassFlow += Math.abs(faceFlux);
          } else {
            // Internal face: Rhie-Chow interpolation (PHASE 7 Audit)
            const ownerId = face.ownerCellId;
            const neighborId = face.neighborCellId;
            
            const u_star_f = 0.5 * (u_star[ownerId] + u_star[neighborId]);
            const v_star_f = 0.5 * (v_star[ownerId] + v_star[neighborId]);
            const w_star_f = 0.5 * (w_star[ownerId] + w_star[neighborId]);
            const Vn_star = u_star_f * face.normal.x + v_star_f * face.normal.y + w_star_f * face.normal.z;

            const d_PN = face_dPN[faceId];
            const dp_dn_discrete = (p[neighborId] - p[ownerId]) / Math.max(d_PN, 1e-6);
            const gradP_owner_n = gradPx_cell[ownerId] * face.normal.x + gradPy_cell[ownerId] * face.normal.y + gradPz_cell[ownerId] * face.normal.z;
            const gradP_nb_n = gradPx_cell[neighborId] * face.normal.x + gradPy_cell[neighborId] * face.normal.y + gradPz_cell[neighborId] * face.normal.z;
            const dp_dn_average = 0.5 * (gradP_owner_n + gradP_nb_n);

            const aP_face = 0.5 * (aP_u[ownerId] + aP_u[neighborId]);
            const d_f = face.area / Math.max(aP_face, 1e-12);

            // Corrected Rhie-Chow: must be u_f = u_f_star - d_f * (gradP_f - gradP_f_avg)
            const Vn = Vn_star - d_f * (dp_dn_discrete - dp_dn_average) * d_PN;
            faceFlux = rho * Vn * face.area;
          }

          fluxDefect += sign * faceFlux;
          if (isOwner) netGlobalMassFlux += faceFlux;
          else netGlobalMassFlux -= faceFlux;
        }
        b_p[c] = -fluxDefect;
        totalMassImbalance += Math.abs(fluxDefect);
      }

      // PHASE 5: Compatibility Condition check
      let sum_bp = 0.0;
      for (let c = 0; c < numCells; c++) sum_bp += b_p[c];
      
      if (iter === 1 || iter === 10) {
        console.log(`[DIAGNOSTIC] Iter ${iter}: totalMassImbalance=${totalMassImbalance.toExponential(4)}, sum_bp=${sum_bp.toExponential(4)}, inletMassFlow=${inletMassFlow.toExponential(4)}, outletMassFlow=${outletMassFlow.toExponential(4)}`);
      }

      if (!hasOutlet && Math.abs(sum_bp) > 1e-6) {
        // Compatibility failure diagnosis
        if (iter === 1) console.warn(`PRESSURE_CORRECTION_COMPATIBILITY_WARNING: SUM_BP = ${sum_bp.toExponential(4)} in closed domain.`);
      }

      const contRes = totalMassImbalance / Math.max(inletMassFlow, 1.0);
      
      // Solve Pressure Correction p' Poisson System (500 sweeps for tight convergence)
      for (let pIter = 0; pIter < 500; pIter++) {
        let maxPIterChange = 0.0;
        for (let c = 0; c < numCells; c++) {
          let aP_p = 0.0;
          let sum_aN_pN = 0.0;
          for (const faceId of mesh.cells[c].faceIds) {
            const face = mesh.faces[faceId];
            const isOwner = face.ownerCellId === c;
            const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
            
            if (neighborId !== -1) {
              const aP_face = 0.5 * (aP_u[c] + aP_u[neighborId]);
              const aN_p = (rho * face.area * face.area) / Math.max(aP_face, 1e-12);
              aP_p += aN_p;
              sum_aN_pN += aN_p * p_prime[neighborId];
            } else if (face.boundaryType === 'OUTLET') {
              const aN_p = (rho * face.area * face.area) / Math.max(aP_u[c], 1e-12);
              aP_p += aN_p;
              // neighbor p' is 0 (Dirichlet)
            }
          }
          if (aP_p > 1e-18) {
            const p_new = (b_p[c] + sum_aN_pN) / aP_p;
            maxPIterChange = Math.max(maxPIterChange, Math.abs(p_new - p_prime[c]));
            p_prime[c] = p_new;
          }
        }
        if (!hasOutlet) {
          let avgP = 0; for(let c=0; c<numCells; c++) avgP += p_prime[c];
          avgP /= numCells;
          for(let c=0; c<numCells; c++) p_prime[c] -= avgP;
        }
        if (maxPIterChange < 1e-8) {
          if (iter === 1 || iter === 10) {
            console.log(`[DIAGNOSTIC] Poisson converged in ${pIter + 1} sweeps. Final maxPIterChange: ${maxPIterChange.toExponential(4)}`);
          }
          break;
        }
        if (pIter === 199 && (iter === 1 || iter === 10)) {
          console.log(`[DIAGNOSTIC] Poisson DID NOT converge in 200 sweeps. Final maxPIterChange: ${maxPIterChange.toExponential(4)}`);
        }
      }

      // -------------------------------------------------------------
      // Step 4: Correct Velocities and Pressure Field (PHASE 6 & 10)
      // -------------------------------------------------------------
      let maxDeltaP = 0.0;

      // Correct face fluxes and velocities (PHASE 6 & 10)
      for (let f = 0; f < mesh.faces.length; f++) {
        const face = mesh.faces[f];
        const ownerId = face.ownerCellId;
        const neighborId = face.neighborCellId;

        if (neighborId !== -1) {
          const aP_face = 0.5 * (aP_u[ownerId] + aP_u[neighborId]);
          const d_f = face.area / Math.max(aP_face, 1e-12);
          const Vn_star = (0.5*(u_star[ownerId]+u_star[neighborId])*face.normal.x + 
                           0.5*(v_star[ownerId]+v_star[neighborId])*face.normal.y + 
                           0.5*(w_star[ownerId]+w_star[neighborId])*face.normal.z);
          
          // Re-compute Rhie-Chow corrected flux with updated p'
          const dp_dn_discrete = (p[neighborId] - p[ownerId]) / Math.max(face_dPN[f], 1e-6);
          const gradP_owner_n = gradPx_cell[ownerId]*face.normal.x + gradPy_cell[ownerId]*face.normal.y + gradPz_cell[ownerId]*face.normal.z;
          const gradP_nb_n = gradPx_cell[neighborId]*face.normal.x + gradPy_cell[neighborId]*face.normal.y + gradPz_cell[neighborId]*face.normal.z;
          const dp_dn_average = 0.5 * (gradP_owner_n + gradP_nb_n);

          const Vn_rhie = Vn_star - d_f * (dp_dn_discrete - dp_dn_average) * face_dPN[f];
          // Apply pressure correction to flux
          const aN_p = (rho * face.area * face.area) / Math.max(aP_face, 1e-12);
          faceFluxes[f] = rho * Vn_rhie * face.area - aN_p * (p_prime[neighborId] - p_prime[ownerId]);
        } else if (face.boundaryType === 'OUTLET') {
          const Vn_star = u_star[ownerId]*face.normal.x + v_star[ownerId]*face.normal.y + w_star[ownerId]*face.normal.z;
          const aN_p = (rho * face.area * face.area) / Math.max(aP_u[ownerId], 1e-12);
          faceFluxes[f] = rho * Vn_star * face.area - aN_p * (0.0 - p_prime[ownerId]);
        } else if (face.boundaryType === 'INLET') {
          const Vn_bc = (face.u_bc ?? 0)*face.normal.x + (face.v_bc ?? 0)*face.normal.y + (face.w_bc ?? 0)*face.normal.z;
          faceFluxes[f] = rho * Vn_bc * face.area;
        } else if (face.boundaryType === 'WALL' || face.boundaryType === 'SYMMETRY') {
          faceFluxes[f] = 0.0;
        } else {
          faceFluxes[f] = 0.0;
        }
      }

      // --- FORENSIC FACE-FLUX DIAGNOSTIC ---
      let totalArithFlux = 0.0;
      let totalRhieCorrection = 0.0;
      let totalPressCorrection = 0.0;
      let totalFinalFlux = 0.0;

      for (let f = 0; f < mesh.faces.length; f++) {
        const face = mesh.faces[f];
        const ownerId = face.ownerCellId;
        const neighborId = face.neighborCellId;

        if (neighborId !== -1) {
          const u_star_f = 0.5 * (u_star[ownerId] + u_star[neighborId]);
          const v_star_f = 0.5 * (v_star[ownerId] + v_star[neighborId]);
          const w_star_f = 0.5 * (w_star[ownerId] + w_star[neighborId]);
          const Vn_star = u_star_f * face.normal.x + v_star_f * face.normal.y + w_star_f * face.normal.z;

          const d_PN = face_dPN[f];
          const dp_dn_discrete = (p[neighborId] - p[ownerId]) / Math.max(d_PN, 1e-6);
          const gradP_owner_n = gradPx_cell[ownerId] * face.normal.x + gradPy_cell[ownerId] * face.normal.y + gradPz_cell[ownerId] * face.normal.z;
          const gradP_nb_n = gradPx_cell[neighborId] * face.normal.x + gradPy_cell[neighborId] * face.normal.y + gradPz_cell[neighborId] * face.normal.z;
          const dp_dn_average = 0.5 * (gradP_owner_n + gradP_nb_n);

          const aP_face = 0.5 * (aP_u[ownerId] + aP_u[neighborId]);
          const d_f = face.area / Math.max(aP_face, 1e-12);
          
          const rhieChowVelocityCorr = - d_f * (dp_dn_discrete - dp_dn_average) * d_PN;
          const Vn_rhie = Vn_star + rhieChowVelocityCorr;

          const aN_p = (rho * face.area * face.area) / Math.max(aP_face, 1e-12);
          const pressCorrFlux = - aN_p * (p_prime[neighborId] - p_prime[ownerId]);
          
          const arithMassFlux = rho * Vn_star * face.area;
          const rhieMassFlux = rho * Vn_rhie * face.area;
          const finalFaceFlux = rhieMassFlux + pressCorrFlux;

          totalArithFlux += Math.abs(arithMassFlux);
          totalRhieCorrection += Math.abs(rho * rhieChowVelocityCorr * face.area);
          totalPressCorrection += Math.abs(pressCorrFlux);
          totalFinalFlux += Math.abs(finalFaceFlux);
        } else if (face.boundaryType === 'INLET') {
          const inletFlux = Math.abs(rho * ((face.u_bc ?? 0)*face.normal.x + (face.v_bc ?? 0)*face.normal.y + (face.w_bc ?? 0)*face.normal.z) * face.area);
          totalArithFlux += inletFlux;
          totalFinalFlux += inletFlux;
        } else if (face.boundaryType === 'OUTLET') {
          const outletFlux = Math.abs(rho * (u_star[ownerId]*face.normal.x + v_star[ownerId]*face.normal.y + w_star[ownerId]*face.normal.z) * face.area);
          totalArithFlux += outletFlux;
          totalFinalFlux += outletFlux;
        }
      }

      if (iter % 10 === 0 || iter === config.maxIterations) {
         const rhieRatio = totalRhieCorrection / Math.max(totalArithFlux, 1e-12);
         const pCorrRatio = totalPressCorrection / Math.max(totalArithFlux, 1e-12);
         console.log(`[DIAGNOSTIC] Face-Flux: Arith=${totalArithFlux.toExponential(4)}, RhieCorr=${totalRhieCorrection.toExponential(4)} (Ratio: ${rhieRatio.toFixed(4)}), PCorrRatio: ${pCorrRatio.toFixed(4)}`);
      }

      for (let c = 0; c < numCells; c++) {
        p[c] += alpha_p * p_prime[c];
        if (Math.abs(p_prime[c]) > maxDeltaP) maxDeltaP = Math.abs(p_prime[c]);

        // Cell-centered pressure correction gradient for velocity correction
        let gradPx_prime = 0.0, gradPy_prime = 0.0, gradPz_prime = 0.0;
        for (const faceId of mesh.cells[c].faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          const sign = isOwner ? 1.0 : -1.0;

          let p_prime_f = 0.0;
          if (neighborId !== -1) {
            p_prime_f = 0.5 * (p_prime[c] + p_prime[neighborId]);
          } else if (face.boundaryType === 'OUTLET') {
            p_prime_f = 0.0; 
          } else {
            p_prime_f = p_prime[c]; 
          }

          gradPx_prime += sign * p_prime_f * face.normal.x * face.area;
          gradPy_prime += sign * p_prime_f * face.normal.y * face.area;
          gradPz_prime += sign * p_prime_f * face.normal.z * face.area;
        }

        const aP_c = aP_u[c];
        u[c] = u_star[c] - gradPx_prime / aP_c;
        v[c] = v_star[c] - gradPy_prime / aP_c;
        w[c] = w_star[c] - gradPz_prime / aP_c;


        if (!isFinite(u[c]) || isNaN(u[c]) || !isFinite(p[c]) || isNaN(p[c])) {
          throw new Error(`SECP-083-DIAGNOSTIC-FAILURE: Divergence at Cell ${c}, Iter ${iter}. u=${u[c].toExponential(4)}, p=${p[c].toExponential(4)}`);
        }
      }

      // -------------------------------------------------------------
      // PHASE 10: Final Independent Residual Verification (Post-Correction)
      // -------------------------------------------------------------
      let maxV = 0.0;
      let velocityUpdateResidual = 0.0;
      let postCorrContRes = 0.0;
      let postCorrMomRes = 0.0;
      let totalMassAudit = 0.0;

      for (let c = 0; c < numCells; c++) {
        const speed = Math.sqrt(u[c] * u[c] + v[c] * v[c] + w[c] * w[c]);
        if (speed > maxV) maxV = speed;
        
        const change = Math.sqrt(Math.pow(u[c]-u_prev[c], 2) + Math.pow(v[c]-v_prev[c], 2) + Math.pow(w[c]-w_prev[c], 2));
        if (change > velocityUpdateResidual) velocityUpdateResidual = change;

        // Post-Correction Continuity Audit (Using corrected faceFluxes for consistency)
        let fluxDefect = 0.0;
        for (const faceId of mesh.cells[c].faceIds) {
          const isOwner = mesh.faces[faceId].ownerCellId === c;
          const sign = isOwner ? 1.0 : -1.0;
          fluxDefect += sign * faceFluxes[faceId];
        }
        postCorrContRes += Math.abs(fluxDefect);


        // Post-Correction Momentum Audit
        let sum_nb_u = 0.0, sum_nb_v = 0.0, sum_nb_w = 0.0;
        for (const faceId of mesh.cells[c].faceIds) {
          const face = mesh.faces[faceId];
          const isOwner = face.ownerCellId === c;
          const neighborId = isOwner ? face.neighborCellId : face.ownerCellId;
          if (neighborId !== -1) {
            const sign = isOwner ? 1.0 : -1.0;
            const Vn = sign * (0.5 * (u[c] + u[neighborId]) * face.normal.x + 
                               0.5 * (v[c] + v[neighborId]) * face.normal.y + 
                               0.5 * (w[c] + w[neighborId]) * face.normal.z);
            const F_outward = rho * Vn * face.area;
            const effMu = mu + nut[c];
            const D_f = effMu * face.area / Math.max(face_dPN[faceId], 1e-6);
            const aN = D_f + Math.max(-F_outward, 0.0);
            sum_nb_u += aN * u[neighborId];
            sum_nb_v += aN * v[neighborId];
            sum_nb_w += aN * w[neighborId];
          }
        }
        const resU = Math.abs(aP_u[c] * u[c] - (b_u[c] + sum_nb_u));
        postCorrMomRes = Math.max(postCorrMomRes, resU);
      }

      const normalizedContRes = postCorrContRes / Math.max(inletMassFlow, 1e-12);
      globalMassImbalanceNorm = postCorrContRes / Math.max(inletMassFlow, 1e-12);

      iterationHistory.push({
        iteration: iter,
        continuityResidual: normalizedContRes,
        uMomentumResidual: postCorrMomRes,
        vMomentumResidual: postCorrMomRes,
        wMomentumResidual: postCorrMomRes,
        pressureChange: maxDeltaP,
        globalMassImbalanceKgS: postCorrContRes,
        maxVelocityMS: maxV
      });

      if (iter % 10 === 0 || iter === 1) {
        console.log(`Iter ${iter}: Cont=${normalizedContRes.toExponential(4)}, Mom=${postCorrMomRes.toExponential(4)}, dV=${velocityUpdateResidual.toExponential(4)}, MaxV=${maxV.toExponential(4)}`);
      }

      // -------------------------------------------------------------
      // Convergence Gate (PATCH-SECP-083.1 Forensic Gate)
      // -------------------------------------------------------------
      const momentum_tol = config.momentumTol || 1e-4;
      const continuity_tol = config.continuityTol || 1e-4;
      
      if (iter >= 10 && normalizedContRes < continuity_tol && postCorrMomRes < momentum_tol && velocityUpdateResidual < momentum_tol) {
        converged = true;
        finalContinuityResidual = normalizedContRes;
        finalMomentumResidual = postCorrMomRes;
        break;
      }
      finalContinuityResidual = normalizedContRes;
      finalMomentumResidual = postCorrMomRes;
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

        // Viscous Shear Force tau = mu * ((u - u_wall) / d_wall)
        const cellCentroid = mesh.cells[c].centroid;
        const d_wall = Math.sqrt(
          Math.pow(cellCentroid.x - face.centroid.x, 2) +
          Math.pow(cellCentroid.y - face.centroid.y, 2) +
          Math.pow(cellCentroid.z - face.centroid.z, 2)
        );
        const effMu = mu + nut[c];
        const u_wall = face.u_bc ?? 0.0;
        const v_wall = face.v_bc ?? 0.0;
        
        const tau_x = effMu * ((u[c] - u_wall) / Math.max(d_wall, 1e-6));
        const tau_y = effMu * ((v[c] - v_wall) / Math.max(d_wall, 1e-6));

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
      faceFluxes,
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
