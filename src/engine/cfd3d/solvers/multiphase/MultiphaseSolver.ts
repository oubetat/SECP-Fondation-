/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-252 — Multiphase CFD Solver Orchestrator
 */

import { Phase, MultiphasePhysicsModel, MultiphaseBC, MultiphaseDiagnostics, MultiphaseFailureCode252 } from './MultiphaseTypes';
import { MultiphasePropertyModel } from './MultiphasePropertyModel';
import { SurfaceTensionModel } from './SurfaceTensionModel';
import { VOFTransportEquation, VOFTransportResult } from './VOFTransportEquation';

export class MultiphaseSolver {
  /**
   * Main multi-phase solution step:
   * 1. Check Courant limits.
   * 2. Advect Phase Fractions (VOF Transport).
   * 3. Compute Mixture Properties.
   * 4. Apply Surface Tension forces (Momentum source terms).
   * 5. Solve Navier-Stokes flow (coupled velocity-pressure correction with mixture properties).
   * 6. Formulate residuals & diagnostics.
   */
  public static solveTimeStep(
    meshSize: number,
    phase1: Phase,
    phase2: Phase,
    initialAlpha: number[],
    initialVelocity: [number, number, number][],
    initialPressure: number[],
    physicsModel: MultiphasePhysicsModel,
    bcs: MultiphaseBC[],
    isSteady: boolean,
    dt: number,
    maxIterations: number = 30,
    underRelaxation: number = 0.7
  ): {
    alpha1: number[];
    velocity: [number, number, number][];
    pressure: number[];
    residuals: { momentum: number[]; continuity: number[]; phaseFraction: number[] };
    diagnostics: MultiphaseDiagnostics;
    failureCodes: MultiphaseFailureCode252[];
  } {
    const failureCodes: MultiphaseFailureCode252[] = [];
    const size = meshSize;

    // Validate inputs
    if (phase1.density <= 0 || phase2.density <= 0 || phase1.viscosity <= 0 || phase2.viscosity <= 0) {
      failureCodes.push(MultiphaseFailureCode252.INVALID_PHASE_PROPERTIES);
    }

    if (failureCodes.length > 0) {
      return {
        alpha1: [...initialAlpha],
        velocity: [...initialVelocity],
        pressure: [...initialPressure],
        residuals: { momentum: [1.0], continuity: [1.0], phaseFraction: [1.0] },
        diagnostics: this.createEmptyDiagnostics(initialAlpha, phase1, phase2),
        failureCodes
      };
    }

    // Geometry parameters
    const dx = 1.0 / Math.cbrt(size);
    const volume = dx * dx * dx;
    const faceArea = dx * dx;

    const nx = Math.ceil(Math.cbrt(size));
    const ny = Math.ceil(size / (nx * nx));
    const nz = nx;

    // Boundary maps / neighbors
    const getNeighbors = (i: number): number[] => {
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;

      const neighs: number[] = [];
      if (x > 0) neighs.push(i - 1);
      if (x < nx - 1 && i + 1 < size) neighs.push(i + 1);
      if (y > 0) neighs.push(i - nx);
      if (y < ny - 1 && i + nx < size) neighs.push(i + nx);
      if (z > 0) neighs.push(i - nx * ny);
      if (z < nz - 1 && i + nx * ny < size) neighs.push(i + nx * ny);
      return neighs;
    };

    const neighborsList = Array.from({ length: size }, (_, i) => getNeighbors(i));

    // Stencil Centroids
    const cellCentroids: [number, number, number][] = Array.from({ length: size }, (_, i) => {
      const z = Math.floor(i / (nx * ny));
      const y = Math.floor((i % (nx * ny)) / nx);
      const x = i % nx;
      return [(x + 0.5) * dx, (y + 0.5) * dx, (z + 0.5) * dx];
    });

    // 1. Interface CFL check
    let maxVelMag = 1e-3;
    for (const v of initialVelocity) {
      const mag = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      if (mag > maxVelMag) maxVelMag = mag;
    }
    const globalCFL = (maxVelMag * dt) / dx;
    if (globalCFL > 1.2) {
      failureCodes.push(MultiphaseFailureCode252.INTERFACE_CFL_FAILURE);
    }

    // 2. VOF transport advection step
    const vofResult: VOFTransportResult = VOFTransportEquation.solveAdvection(
      initialAlpha,
      initialVelocity,
      dx,
      dt,
      nx,
      ny,
      nz,
      neighborsList,
      1.0 // sharpening compression factor
    );

    const alpha1 = vofResult.alphaNew;

    // Bounds checking
    for (const a of alpha1) {
      if (a < -1e-4 || a > 1.0001) {
        failureCodes.push(MultiphaseFailureCode252.PHASE_FRACTION_OUT_OF_BOUNDS);
        break;
      }
    }

    // 3. Dynamic Mixture Properties
    const mixDensity = MultiphasePropertyModel.computeMixtureDensity(alpha1, phase1, phase2);
    const mixViscosity = MultiphasePropertyModel.computeMixtureViscosity(alpha1, phase1, phase2);

    // 4. Continuum Surface Force (CSF) Calculation
    const csf = SurfaceTensionModel.computeCurvatureAndForces(
      alpha1,
      physicsModel.surfaceTensionCoefficient,
      physicsModel.staticContactAngle,
      dx,
      nx,
      ny,
      nz,
      neighborsList
    );

    // 5. Flow Coupling & Navier-Stokes Solver Iterations (Momentum + Pressure Poisson correction)
    const velocity: [number, number, number][] = Array.from({ length: size }, () => [0, 0, 0]);
    const pressure = [...initialPressure];

    const momentumResiduals: number[] = [];
    const continuityResiduals: number[] = [];
    const phaseFractionResiduals: number[] = [vofResult.phaseResidual];

    // Simple solver loop: Predictor corrector sequence for Coupled NS + Buoyancy + Surface forces
    for (let iter = 0; iter < maxIterations; iter++) {
      let momentumErr = 0;
      let continuityErr = 0;

      for (let i = 0; i < size; i++) {
        const rho = mixDensity[i];
        const mu = mixViscosity[i];
        const centP = cellCentroids[i];
        const neighs = neighborsList[i];

        // Momentum sources: Gravity (Buoyancy) + Surface Tension CSF
        const F_gravity = [rho * physicsModel.gravityVector[0], rho * physicsModel.gravityVector[1], rho * physicsModel.gravityVector[2]];
        const F_surf = csf.surfaceForces[i];

        // Navier-Stokes Momentum transport: diffusion + advection
        let sumMom = [0, 0, 0];
        let coeffP = 0;

        for (const n of neighs) {
          const viscFlux = (mu * faceArea) / dx;
          sumMom[0] += viscFlux * (initialVelocity[n]?.[0] ?? 0);
          sumMom[1] += viscFlux * (initialVelocity[n]?.[1] ?? 0);
          sumMom[2] += viscFlux * (initialVelocity[n]?.[2] ?? 0);
          coeffP += viscFlux;
        }

        // Apply pressure gradients to predict velocity: u = (sum(u_nb) - dP/dx * Vol + F_body * Vol) / coeffP
        let dpdx = 0, dpdy = 0, dpdz = 0;
        const z = Math.floor(i / (nx * ny));
        const y = Math.floor((i % (nx * ny)) / nx);
        const x = i % nx;

        if (x > 0 && x < nx - 1) dpdx = (pressure[i + 1] - pressure[i - 1]) / (2 * dx);
        if (y > 0 && y < ny - 1 && i + nx < size) dpdy = (pressure[i + nx] - pressure[i - nx]) / (2 * dx);
        if (z > 0 && z < nz - 1 && i + nx * ny < size) dpdz = (pressure[i + nx * ny] - pressure[i - nx * ny]) / (2 * dx);

        const rhsX = sumMom[0] - dpdx * volume + (F_gravity[0] + F_surf[0]) * volume;
        const rhsY = sumMom[1] - dpdy * volume + (F_gravity[1] + F_surf[1]) * volume;
        const rhsZ = sumMom[2] - dpdz * volume + (F_gravity[2] + F_surf[2]) * volume;

        if (coeffP <= 0) coeffP = 1.0;

        // Velocity prediction
        const u_pred = rhsX / coeffP;
        const v_pred = rhsY / coeffP;
        const w_pred = rhsZ / coeffP;

        // Simple relaxation update
        const relaxedU = initialVelocity[i][0] + underRelaxation * (u_pred - initialVelocity[i][0]);
        const relaxedV = initialVelocity[i][1] + underRelaxation * (v_pred - initialVelocity[i][1]);
        const relaxedW = initialVelocity[i][2] + underRelaxation * (w_pred - initialVelocity[i][2]);

        velocity[i] = [relaxedU, relaxedV, relaxedW];

        // 6. Pressure Correction (Simple segregated loop matching PATCH-244 continuity check)
        // div(U_pred) = continuity error
        let divU = 0;
        if (x > 0 && x < nx - 1) divU += (velocity[i+1][0] - velocity[i-1][0]) / (2 * dx);
        if (y > 0 && y < ny - 1 && i + nx < size) divU += (velocity[i+nx][1] - velocity[i-nx][1]) / (2 * dx);
        if (z > 0 && z < nz - 1 && i + nx * ny < size) divU += (velocity[i+nx*ny][2] - velocity[i-nx*ny][2]) / (2 * dx);

        const p_corr = -divU * (rho * dx * dx) * underRelaxation;
        pressure[i] += p_corr;

        // Accumulate convergence statistics
        momentumErr += Math.abs(u_pred - initialVelocity[i][0]) + Math.abs(v_pred - initialVelocity[i][1]);
        continuityErr += Math.abs(divU);
      }

      momentumResiduals.push(momentumErr / size);
      continuityResiduals.push(continuityErr / size);

      if (continuityErr / size < 1e-5 && iter > 3) {
        break;
      }
    }

    // 7. Calculate Spurious currents / velocities inside fluid interface
    let maxSpuriousVel = 0;
    let meanSpuriousVel = 0;
    let spuriousCount = 0;

    for (let i = 0; i < size; i++) {
      const a = alpha1[i];
      const isInterface = (a > 0.01 && a < 0.99);
      if (isInterface) {
        const velMag = Math.sqrt(velocity[i][0]*velocity[i][0] + velocity[i][1]*velocity[i][1] + velocity[i][2]*velocity[i][2]);
        if (velMag > maxSpuriousVel) maxSpuriousVel = velMag;
        meanSpuriousVel += velMag;
        spuriousCount++;
      }
    }
    meanSpuriousVel = spuriousCount > 0 ? meanSpuriousVel / spuriousCount : 0;

    if (maxSpuriousVel > 0.1) {
      failureCodes.push(MultiphaseFailureCode252.SPURIOUS_CURRENT_FAILURE);
    }

    // Diagnostics package formulation
    let totalVol1 = 0;
    let totalVol2 = 0;
    let interfaceArea = 0;
    let sumInterfaceX = 0;
    let sumInterfaceY = 0;
    let sumInterfaceZ = 0;
    let interfaceCellsCount = 0;

    for (let i = 0; i < size; i++) {
      const a = alpha1[i];
      totalVol1 += a * volume;
      totalVol2 += (1.0 - a) * volume;

      const norm = csf.normals[i];
      const magNorm = Math.sqrt(norm[0]*norm[0] + norm[1]*norm[1] + norm[2]*norm[2]);
      if (magNorm > 0.1) {
        interfaceArea += magNorm * faceArea;
        sumInterfaceX += cellCentroids[i][0];
        sumInterfaceY += cellCentroids[i][1];
        sumInterfaceZ += cellCentroids[i][2];
        interfaceCellsCount++;
      }
    }

    const totalMass1 = totalVol1 * phase1.density;
    const totalMass2 = totalVol2 * phase2.density;

    const interfaceLocation: [number, number, number] = interfaceCellsCount > 0 ? [
      sumInterfaceX / interfaceCellsCount,
      sumInterfaceY / interfaceCellsCount,
      sumInterfaceZ / interfaceCellsCount
    ] : [0.5, 0.5, 0.5];

    const diagnostics: MultiphaseDiagnostics = {
      time: dt,
      iteration: maxIterations,
      minPhaseFraction: Math.min(...alpha1),
      maxPhaseFraction: Math.max(...alpha1),
      totalVolume1: totalVol1,
      totalVolume2: totalVol2,
      totalMass1,
      totalMass2,
      interfaceArea,
      interfaceLocation,
      interfaceCFL: globalCFL,
      massImbalance: Math.abs(totalMass1 + totalMass2 - (phase1.density * volume * size * 0.5 + phase2.density * volume * size * 0.5)),
      volumeImbalance: Math.abs(totalVol1 + totalVol2 - size * volume),
      maxSpuriousVelocity: maxSpuriousVel,
      meanSpuriousVelocity: meanSpuriousVel,
      spuriousCurrentStatus: maxSpuriousVel < 0.05 ? 'STABLE' : 'UNSTABLE'
    };

    return {
      alpha1,
      velocity,
      pressure,
      residuals: {
        momentum: momentumResiduals,
        continuity: continuityResiduals,
        phaseFraction: phaseFractionResiduals
      },
      diagnostics,
      failureCodes
    };
  }

  private static createEmptyDiagnostics(alpha: number[], phase1: Phase, phase2: Phase): MultiphaseDiagnostics {
    return {
      time: 0,
      iteration: 0,
      minPhaseFraction: 0,
      maxPhaseFraction: 1,
      totalVolume1: 0.5,
      totalVolume2: 0.5,
      totalMass1: 0.5 * phase1.density,
      totalMass2: 0.5 * phase2.density,
      interfaceArea: 0,
      interfaceLocation: [0.5, 0.5, 0.5],
      interfaceCFL: 0,
      massImbalance: 0,
      volumeImbalance: 0,
      maxSpuriousVelocity: 0,
      meanSpuriousVelocity: 0,
      spuriousCurrentStatus: 'STABLE'
    };
  }
}
