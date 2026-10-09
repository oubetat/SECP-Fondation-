/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-253 — Compressible Flow Solver Engine
 */

import {
  CompressiblePhysicsModel,
  ThermodynamicState,
  CompressibleBC,
  CompressibleFlowDiagnostics,
  FluxSchemeType,
  CompressibleFailureCode253
} from './CompressibleTypes';
import { EquationOfState } from './EquationOfState';
import { CompressibleFluxCalculator } from './CompressibleFluxCalculator';

export class CompressibleFlowSolver {
  private numCells: number;
  private dx: number;
  private physics: CompressiblePhysicsModel;

  // Conservative arrays
  private rho: number[] = [];
  private rhoU: number[] = [];
  private rhoV: number[] = [];
  private rhoW: number[] = [];
  private rhoE: number[] = [];

  // Reconstructed primitives / thermodynamics state
  private states: ThermodynamicState[] = [];
  private velocities: [number, number, number][] = [];

  // Boundary conditions list
  private boundaryConditions: CompressibleBC[] = [];

  // Residual monitoring
  private massResiduals: number[] = [];
  private momentumResiduals: number[] = [];
  private energyResiduals: number[] = [];

  constructor(numCells: number, dx: number, physics: CompressiblePhysicsModel) {
    this.numCells = numCells;
    this.dx = dx;
    this.physics = physics;
  }

  public initializeField(
    density: number | number[],
    velocity: [number, number, number] | [number, number, number][],
    pressure: number | number[]
  ): void {
    this.rho = [];
    this.rhoU = [];
    this.rhoV = [];
    this.rhoW = [];
    this.rhoE = [];
    this.states = [];
    this.velocities = [];

    const R = this.physics.gasConstant;
    const gamma = this.physics.specificHeatRatio;

    for (let i = 0; i < this.numCells; i++) {
      const rhoVal = Array.isArray(density) ? density[i] : density;
      const velVal = (Array.isArray(velocity) && Array.isArray(velocity[0])) ? (velocity[i] as [number, number, number]) : (velocity as [number, number, number]);
      const pressVal = Array.isArray(pressure) ? pressure[i] : pressure;

      if (rhoVal <= 0) {
        throw new Error(`${CompressibleFailureCode253.NEGATIVE_DENSITY}: Initial density must be positive. Received: ${rhoVal}`);
      }
      if (pressVal <= 0) {
        throw new Error(`${CompressibleFailureCode253.NEGATIVE_PRESSURE}: Initial pressure must be positive. Received: ${pressVal}`);
      }

      // Compute temperature from EOS
      const tempVal = pressVal / (rhoVal * R);
      const state = EquationOfState.calculateStateFromPrimitive(rhoVal, velVal, tempVal, R, gamma);

      this.rho.push(state.density);
      this.rhoU.push(state.density * velVal[0]);
      this.rhoV.push(state.density * velVal[1]);
      this.rhoW.push(state.density * velVal[2]);
      this.rhoE.push(state.density * state.totalEnergy);

      this.states.push(state);
      this.velocities.push(velVal);
    }
  }

  public setBoundaryConditions(bcs: CompressibleBC[]): void {
    this.boundaryConditions = bcs;
  }

  /**
   * Evaluates maximum stable time step based on acoustic CFL limit
   */
  public calculateStableTimeStep(requestedCFL: number): number {
    let maxWaveSpeed = 1e-3;
    for (let i = 0; i < this.numCells; i++) {
      const state = this.states[i];
      const vel = this.velocities[i];
      const speed = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]);
      const waveSpeed = speed + state.speedOfSound;
      if (waveSpeed > maxWaveSpeed) {
        maxWaveSpeed = waveSpeed;
      }
    }
    return (requestedCFL * this.dx) / maxWaveSpeed;
  }

  /**
   * Execute single time integration step with CFL-bounded sub-cycling to prevent divergence
   */
  public step(dt: number): void {
    const maxStableDt = this.calculateStableTimeStep(0.4);
    if (dt > maxStableDt && maxStableDt > 0 && isFinite(maxStableDt)) {
      let remainingDt = dt;
      while (remainingDt > 1e-12) {
        const curMax = this.calculateStableTimeStep(0.4);
        const subDt = Math.min(remainingDt, curMax > 0 && isFinite(curMax) ? curMax : remainingDt);
        this.stepSingle(subDt);
        remainingDt -= subDt;
      }
      return;
    }
    this.stepSingle(dt);
  }

  private stepSingle(dt: number): void {
    const R = this.physics.gasConstant;
    const gamma = this.physics.specificHeatRatio;

    // Temporary residual/flux accumulators
    const dRho = new Array(this.numCells).fill(0);
    const dRhoU = new Array(this.numCells).fill(0);
    const dRhoV = new Array(this.numCells).fill(0);
    const dRhoW = new Array(this.numCells).fill(0);
    const dRhoE = new Array(this.numCells).fill(0);

    // Loop over internal faces (1D representation along X-axis with normal [1, 0, 0])
    for (let i = 0; i < this.numCells - 1; i++) {
      const stateL = this.states[i];
      const velL = this.velocities[i];
      const stateR = this.states[i + 1];
      const velR = this.velocities[i + 1];

      const flux = CompressibleFluxCalculator.computeFlux(
        stateL,
        velL,
        stateR,
        velR,
        [1, 0, 0],
        this.physics.fluxScheme,
        gamma,
        this.physics.enableShockCapturing
      );

      // FVM cell contributions: Left cell loses flux, Right cell gains flux
      dRho[i] -= flux.massFlux;
      dRhoU[i] -= flux.momentumFlux[0];
      dRhoV[i] -= flux.momentumFlux[1];
      dRhoW[i] -= flux.momentumFlux[2];
      dRhoE[i] -= flux.energyFlux;

      dRho[i + 1] += flux.massFlux;
      dRhoU[i + 1] += flux.momentumFlux[0];
      dRhoV[i + 1] += flux.momentumFlux[1];
      dRhoW[i + 1] += flux.momentumFlux[2];
      dRhoE[i + 1] += flux.energyFlux;
    }

    // Apply Boundaries at left (Inlet / Symmetry) and right (Outlet / Wall)
    this.applyBoundaryFluxes(dRho, dRhoU, dRhoV, dRhoW, dRhoE);

    // Update conservative variables with safety positivity checks
    let maxMassRes = 0;
    let maxMomRes = 0;
    let maxEnergyRes = 0;

    for (let i = 0; i < this.numCells; i++) {
      const factor = dt / this.dx;
      const newRho = this.rho[i] + dRho[i] * factor;
      const newRhoU = this.rhoU[i] + dRhoU[i] * factor;
      const newRhoV = this.rhoV[i] + dRhoV[i] * factor;
      const newRhoW = this.rhoW[i] + dRhoW[i] * factor;
      const newRhoE = this.rhoE[i] + dRhoE[i] * factor;

      if (newRho <= 0) {
        throw new Error(`${CompressibleFailureCode253.NEGATIVE_DENSITY}: Solver divergence detected. Negative density in Cell ${i}: ${newRho}`);
      }

      // Reconstruct primitives to perform physical validation
      try {
        const updatedState = EquationOfState.calculateStateFromConservative(
          newRho,
          newRhoU,
          newRhoV,
          newRhoW,
          newRhoE,
          R,
          gamma
        );

        this.rho[i] = newRho;
        this.rhoU[i] = newRhoU;
        this.rhoV[i] = newRhoV;
        this.rhoW[i] = newRhoW;
        this.rhoE[i] = newRhoE;

        this.states[i] = updatedState;
        this.velocities[i] = [newRhoU / newRho, newRhoV / newRho, newRhoW / newRho];
      } catch (err: any) {
        throw new Error(`${CompressibleFailureCode253.INVALID_THERMODYNAMIC_STATE}: Thermodynamic breakdown at cell ${i} iteration. Error: ${err.message}`);
      }

      // Monitor absolute residuals
      maxMassRes = Math.max(maxMassRes, Math.abs(dRho[i]));
      maxMomRes = Math.max(maxMomRes, Math.abs(dRhoU[i]));
      maxEnergyRes = Math.max(maxEnergyRes, Math.abs(dRhoE[i]));
    }

    this.massResiduals.push(maxMassRes);
    this.momentumResiduals.push(maxMomRes);
    this.energyResiduals.push(maxEnergyRes);
  }

  private applyBoundaryFluxes(
    dRho: number[],
    dRhoU: number[],
    dRhoV: number[],
    dRhoW: number[],
    dRhoE: number[]
  ): void {
    const R = this.physics.gasConstant;
    const gamma = this.physics.specificHeatRatio;

    // Boundary treatment at left boundary (Cell 0)
    const inletBC = this.boundaryConditions.find((bc) => bc.type === 'INLET');
    const inletVel = inletBC?.velocity || this.velocities[0] || [100, 0, 0];
    const inletT = inletBC?.totalTemperature || this.states[0]?.temperature || 300;
    const inletP = inletBC?.totalPressure || this.states[0]?.pressure || 101325;
    const inletRho = inletP / (R * inletT);

    const inletState = EquationOfState.calculateStateFromPrimitive(inletRho, inletVel, inletT, R, gamma);
    const fluxInlet = CompressibleFluxCalculator.computeFlux(
      inletState,
      inletVel,
      this.states[0],
      this.velocities[0],
      [1, 0, 0],
      this.physics.fluxScheme,
      gamma,
      false
    );

    dRho[0] += fluxInlet.massFlux;
    dRhoU[0] += fluxInlet.momentumFlux[0];
    dRhoV[0] += fluxInlet.momentumFlux[1];
    dRhoW[0] += fluxInlet.momentumFlux[2];
    dRhoE[0] += fluxInlet.energyFlux;

    // Boundary treatment at right boundary (Cell N-1)
    const outletBC = this.boundaryConditions.find((bc) => bc.type === 'OUTLET');
    const exitP = outletBC?.staticPressure || this.states[this.numCells - 1]?.pressure || 101325;
    const endCellState = this.states[this.numCells - 1];
    const endCellVel = this.velocities[this.numCells - 1];

    // Reconstruct outflow thermodynamic variables
    const outletState = EquationOfState.calculateStateFromPrimitive(
      endCellState.density,
      endCellVel,
      endCellState.temperature,
      R,
      gamma
    );

    const fluxOutlet = CompressibleFluxCalculator.computeFlux(
      this.states[this.numCells - 1],
      this.velocities[this.numCells - 1],
      outletState,
      endCellVel,
      [1, 0, 0],
      this.physics.fluxScheme,
      gamma,
      false
    );

    dRho[this.numCells - 1] -= fluxOutlet.massFlux;
    dRhoU[this.numCells - 1] -= fluxOutlet.momentumFlux[0];
    dRhoV[this.numCells - 1] -= fluxOutlet.momentumFlux[1];
    dRhoW[this.numCells - 1] -= fluxOutlet.momentumFlux[2];
    dRhoE[this.numCells - 1] -= fluxOutlet.energyFlux;
  }

  public getDiagnostics(requestedCFL: number): CompressibleFlowDiagnostics {
    let totalMach = 0;
    let maxMach = 0;
    let minDensity = Infinity;
    let maxDensity = -Infinity;
    let minPressure = Infinity;
    let maxPressure = -Infinity;
    let totalTemp = 0;
    let shockCellsCount = 0;

    for (let i = 0; i < this.numCells; i++) {
      const state = this.states[i];
      totalMach += state.machNumber;
      if (state.machNumber > maxMach) {
        maxMach = state.machNumber;
      }
      if (state.density < minDensity) minDensity = state.density;
      if (state.density > maxDensity) maxDensity = state.density;
      if (state.pressure < minPressure) minPressure = state.pressure;
      if (state.pressure > maxPressure) maxPressure = state.pressure;
      totalTemp += state.temperature;

      // Identify shock regions via pressure slope
      if (i > 0 && i < this.numCells - 1) {
        const dp = Math.abs(this.states[i + 1].pressure - this.states[i - 1].pressure);
        if (dp > 0.1 * state.pressure) {
          shockCellsCount++;
        }
      }
    }

    // Core conservation check: total mass flow imbalance
    const inletVel = this.velocities[0];
    const outletVel = this.velocities[this.numCells - 1];
    const massIn = this.states[0].density * inletVel[0];
    const massOut = this.states[this.numCells - 1].density * outletVel[0];

    const energyIn = (this.states[0].density * this.states[0].totalEnergy + this.states[0].pressure) * inletVel[0];
    const energyOut = (this.states[this.numCells - 1].density * this.states[this.numCells - 1].totalEnergy + this.states[this.numCells - 1].pressure) * outletVel[0];

    return {
      maxMach,
      meanMach: totalMach / this.numCells,
      minDensity,
      maxDensity,
      minPressure,
      maxPressure,
      meanTemperature: totalTemp / this.numCells,
      maxCFL: requestedCFL,
      massImbalance: Math.abs(massIn - massOut),
      energyImbalance: Math.abs(energyIn - energyOut),
      shockCellsCount
    };
  }

  // Getters for frontend plotting
  public getPrimitiveFields(): {
    rho: number[];
    p: number[];
    T: number[];
    u: number[];
    mach: number[];
    E: number[];
    a: number[];
  } {
    return {
      rho: [...this.rho],
      p: this.states.map((s) => s.pressure),
      T: this.states.map((s) => s.temperature),
      u: this.velocities.map((v) => v[0]),
      mach: this.states.map((s) => s.machNumber),
      E: this.states.map((s) => s.totalEnergy),
      a: this.states.map((s) => s.speedOfSound)
    };
  }

  public getResiduals(): { mass: number[]; momentum: number[]; energy: number[] } {
    return {
      mass: [...this.massResiduals],
      momentum: [...this.momentumResiduals],
      energy: [...this.energyResiduals]
    };
  }
}
