/**
 * SECP CAD/CAE Platform - PATCH-233: Material Point State Manager
 *
 * Tracks independent MaterialPointState at every Gauss / Integration point across elements.
 * Supports state history management:
 * - trialState: Working candidate state during local/global iteration
 * - committedState: Fully converged state at end of load increment
 * - rollbackState: Preserved state used to roll back failed Newton-Raphson iterations
 */

import { MaterialPointState } from './ConstitutiveTypes';

export class MaterialPointStateManager {
  private committedStates: Map<string, MaterialPointState> = new Map();
  private trialStates: Map<string, MaterialPointState> = new Map();
  private rollbackStates: Map<string, MaterialPointState> = new Map();

  public static makeKey(elementId: string, integrationPointId: number): string {
    return `${elementId}_gp_${integrationPointId}`;
  }

  /**
   * Initializes state at an integration point
   */
  public initializeState(
    elementId: string,
    integrationPointId: number,
    initialTemperatureK: number = 293.15
  ): MaterialPointState {
    const key = MaterialPointStateManager.makeKey(elementId, integrationPointId);
    const state: MaterialPointState = {
      elementId,
      integrationPointId,
      temperatureK: initialTemperatureK,
      totalStrain: new Array(6).fill(0),
      stress: new Array(6).fill(0),
      plasticStrain: new Array(6).fill(0),
      equivalentPlasticStrain: 0,
      backStress: new Array(6).fill(0),
      elasticEnergyDensity: 0,
      plasticDissipation: 0,
      internalVariables: {},
      status: 'ELASTIC',
      stepId: 0,
      iterationId: 0
    };

    this.committedStates.set(key, JSON.parse(JSON.stringify(state)));
    this.trialStates.set(key, JSON.parse(JSON.stringify(state)));
    this.rollbackStates.set(key, JSON.parse(JSON.stringify(state)));

    return state;
  }

  /**
   * Gets current trial state for calculation
   */
  public getTrialState(elementId: string, integrationPointId: number): MaterialPointState {
    const key = MaterialPointStateManager.makeKey(elementId, integrationPointId);
    let st = this.trialStates.get(key);
    if (!st) {
      st = this.initializeState(elementId, integrationPointId);
    }
    return JSON.parse(JSON.stringify(st));
  }

  /**
   * Sets new trial state
   */
  public setTrialState(elementId: string, integrationPointId: number, state: MaterialPointState): void {
    const key = MaterialPointStateManager.makeKey(elementId, integrationPointId);
    this.trialStates.set(key, JSON.parse(JSON.stringify(state)));
  }

  /**
   * Commits trial state upon load step convergence
   */
  public commitState(elementId: string, integrationPointId: number): void {
    const key = MaterialPointStateManager.makeKey(elementId, integrationPointId);
    const trial = this.trialStates.get(key);
    if (trial) {
      this.committedStates.set(key, JSON.parse(JSON.stringify(trial)));
      this.rollbackStates.set(key, JSON.parse(JSON.stringify(trial)));
    }
  }

  /**
   * Rolls back trial state to last committed state if iteration fails
   */
  public rollbackState(elementId: string, integrationPointId: number): MaterialPointState {
    const key = MaterialPointStateManager.makeKey(elementId, integrationPointId);
    const lastCommitted = this.committedStates.get(key);
    if (lastCommitted) {
      this.trialStates.set(key, JSON.parse(JSON.stringify(lastCommitted)));
      return JSON.parse(JSON.stringify(lastCommitted));
    }
    return this.initializeState(elementId, integrationPointId);
  }
}
