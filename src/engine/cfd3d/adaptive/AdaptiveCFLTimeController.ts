import { AdaptiveTimeStepController, ControllerConfig } from '../solvers/adaptive/AdaptiveTimeStepController';
import { LimiterReason } from '../solvers/adaptive/AdaptiveTypes';
import { FvmMesh3D } from '../Fvm3DTypes';
import { FluidProperties3D, AdaptiveCFLState } from './AdaptiveCFDTypes';

export class AdaptiveCFLTimeController {
  private controller: AdaptiveTimeStepController;
  private currentDt: number;
  private targetCFL: number;
  private minDt: number;
  private maxDt: number;
  private cflHistory: number[] = [];
  private dtHistory: number[] = [];

  constructor(targetCFL: number, minDt: number, maxDt: number, initialDt: number) {
    this.targetCFL = targetCFL;
    this.minDt = minDt;
    this.maxDt = maxDt;
    this.currentDt = initialDt;

    const config: ControllerConfig = {
      minDt,
      maxDt,
      initialDt,
      growthLimit: 1.2,
      shrinkLimit: 0.5,
      safetyFactor: 0.9,
      targetCFL,
      targetError: 1e-4
    };

    this.controller = new AdaptiveTimeStepController(config);
    this.dtHistory.push(initialDt);
  }

  /**
   * Performs spatial reduction over the mesh to find the maximum local Courant number.
   * Uses both convective and acoustic wave speeds.
   */
  public computeMaxCFL(
    mesh: FvmMesh3D,
    u: number[],
    v: number[],
    w: number[],
    fluid: FluidProperties3D
  ): { maxCFL: number } {
    if (!mesh || !mesh.cells || mesh.cells.length === 0) return { maxCFL: 0 };

    let maxCFL = 0;
    // Speed of sound evaluation: a = sqrt(gamma * R * T)
    const gamma = fluid.specificHeatRatioGamma ?? 1.4;
    const R = fluid.specificGasConstantR ?? 287.05;
    const T = fluid.referenceTemperatureK ?? 288.15;
    const soundSpeed = Math.sqrt(gamma * R * T);

    for (let i = 0; i < mesh.cells.length; i++) {
      const cell = mesh.cells[i];
      const velMag = Math.sqrt(u[i] * u[i] + v[i] * v[i] + w[i] * w[i]);
      
      // Approximate characteristic length dx via volume/area ratio
      let totalArea = 0;
      if (cell.faceIds) {
        for (const fId of cell.faceIds) {
          if (mesh.faces[fId]) totalArea += mesh.faces[fId].area;
        }
      }
      
      const dx = cell.volume / (totalArea || 1e-12);
      
      // Local CFL based on fastest information propagation speed (u + a)
      const localCFL = this.currentDt * (velMag + soundSpeed) / (dx || 1e-12);
      
      if (Number.isFinite(localCFL) && localCFL > maxCFL) {
        maxCFL = localCFL;
      }
    }

    this.cflHistory.push(maxCFL);
    if (this.cflHistory.length > 1000) this.cflHistory.shift();

    return { maxCFL };
  }

  /**
   * Adapts the global timestep based on measured CFL and residual convergence rate.
   */
  public adaptTimestep(maxCFL: number, errorRatio: number, forceAccept: boolean = false): number {
    const previousDt = this.currentDt;
    
    // Bridge to production engine. 
    // We map errorRatio to absolute error relative to 1e-4 target.
    const measuredError = (errorRatio > 1.0) ? errorRatio * 1e-4 : 0;

    const result = this.controller.estimateNextDt(
      previousDt,
      measuredError,
      maxCFL,
      LimiterReason.FLOW
    );

    this.currentDt = result.dt;
    
    // Record history
    this.dtHistory.push(this.currentDt);
    if (this.dtHistory.length > 1000) this.dtHistory.shift();

    return this.currentDt;
  }

  /**
   * Returns full diagnostic state for telemetry and evidence generation.
   */
  public getState(): AdaptiveCFLState {
    return {
      currentCFL: this.cflHistory[this.cflHistory.length - 1] || 0,
      targetCFL: this.targetCFL,
      minCFL: 0.1,
      maxCFL: this.targetCFL * 2.0,
      currentTimestepS: this.currentDt,
      minTimestepS: this.minDt,
      maxTimestepS: this.maxDt,
      temporalErrorEstimate: 0, 
      cflHistory: [...this.cflHistory],
      timestepHistory: [...this.dtHistory]
    };
  }
}
