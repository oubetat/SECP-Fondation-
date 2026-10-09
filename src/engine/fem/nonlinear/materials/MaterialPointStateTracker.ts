/**
 * SECP Industrial OS v3 — Material Point State Tracker (PATCH-238)
 *
 * Manages integration point state variables across all mesh elements:
 * - Maintains Trial State (during Newton iterations)
 * - Maintains Committed State (after load step convergence)
 * - Supports Rollback State (restores state on step failure/cutback)
 */

import {
  DomainMaterialStates,
  MaterialPointState,
  ReturnMappingOptions,
  ReturnMappingOutput
} from '../types/NonlinearStructuralTypes';
import { ReturnMappingAlgorithm } from './ReturnMappingAlgorithm';

export class MaterialPointStateTracker {
  private committedStates: Map<string, MaterialPointState> = new Map();
  private trialStates: Map<string, MaterialPointState> = new Map();
  private rollbackStates: Map<string, MaterialPointState> = new Map();

  constructor() {}

  /**
   * Initializes integration point states for a given mesh configuration
   */
  public initializeDomain(
    elements: { id: string; gaussPointCount: number }[],
    options: ReturnMappingOptions
  ): void {
    this.committedStates.clear();
    this.trialStates.clear();
    this.rollbackStates.clear();

    elements.forEach(elem => {
      for (let gp = 0; gp < elem.gaussPointCount; gp++) {
        const key = `${elem.id}_GP${gp}`;
        const initialState: MaterialPointState = {
          integrationPointId: key,
          elementId: elem.id,
          gaussPointIndex: gp,
          strainVoigt: [0, 0, 0, 0, 0, 0],
          stressVoigt: [0, 0, 0, 0, 0, 0],
          plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
          equivalentPlasticStrain: 0.0,
          backStressVoigt: [0, 0, 0, 0, 0, 0],
          yieldState: 'ELASTIC',
          hardeningState: options.initialYieldStress,
          plasticDissipation: 0.0,
          historyVariables: {}
        };

        this.committedStates.set(key, { ...initialState });
        this.trialStates.set(key, { ...initialState });
        this.rollbackStates.set(key, { ...initialState });
      }
    });
  }

  /**
   * Retrieves trial state for a specific integration point
   */
  public getState(elementId: string, gaussPointIndex: number): MaterialPointState {
    const key = `${elementId}_GP${gaussPointIndex}`;
    const state = this.trialStates.get(key);
    if (!state) {
      throw new Error(`MaterialPointState for key ${key} not found.`);
    }
    return state;
  }

  /**
   * Performs material return mapping update at a specific integration point
   */
  public updatePointState(
    elementId: string,
    gaussPointIndex: number,
    trialStrainVoigt: number[],
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    const key = `${elementId}_GP${gaussPointIndex}`;
    const prevState = this.committedStates.get(key) || this.getState(elementId, gaussPointIndex);

    const result = ReturnMappingAlgorithm.execute(trialStrainVoigt, prevState, options);

    const updatedTrialState: MaterialPointState = {
      integrationPointId: key,
      elementId,
      gaussPointIndex,
      strainVoigt: [...trialStrainVoigt],
      stressVoigt: [...result.stressVoigt],
      plasticStrainVoigt: [...result.plasticStrainVoigt],
      equivalentPlasticStrain: result.equivalentPlasticStrain,
      backStressVoigt: [...result.backStressVoigt],
      yieldState: result.yieldState,
      hardeningState: result.currentYieldStress,
      plasticDissipation: (prevState.plasticDissipation || 0) + result.plasticDissipationIncrement,
      historyVariables: { ...prevState.historyVariables }
    };

    this.trialStates.set(key, updatedTrialState);
    return result;
  }

  /**
   * Saves current committed states to rollback buffer prior to attempting a load step
   */
  public prepareStepBackup(): void {
    this.rollbackStates.clear();
    this.committedStates.forEach((val, key) => {
      this.rollbackStates.set(key, JSON.parse(JSON.stringify(val)));
    });
  }

  /**
   * Commits current trial states upon load step convergence
   */
  public commitStep(): void {
    this.trialStates.forEach((val, key) => {
      this.committedStates.set(key, JSON.parse(JSON.stringify(val)));
    });
  }

  /**
   * Restores states from rollback buffer upon load step divergence or retry
   */
  public rollbackStep(): void {
    this.committedStates.clear();
    this.trialStates.clear();

    this.rollbackStates.forEach((val, key) => {
      this.committedStates.set(key, JSON.parse(JSON.stringify(val)));
      this.trialStates.set(key, JSON.parse(JSON.stringify(val)));
    });
  }

  /**
   * Exports summary domain material statistics
   */
  public getDomainSummary(): DomainMaterialStates {
    let maxEqPlastic = 0;
    let yieldedCount = 0;
    let totalDissipation = 0;

    this.committedStates.forEach(st => {
      if (st.equivalentPlasticStrain > maxEqPlastic) {
        maxEqPlastic = st.equivalentPlasticStrain;
      }
      if (st.yieldState === 'PLASTIC' || st.equivalentPlasticStrain > 1e-9) {
        yieldedCount++;
      }
      totalDissipation += st.plasticDissipation;
    });

    return {
      pointStates: new Map(this.committedStates),
      maxEquivalentPlasticStrain: maxEqPlastic,
      yieldedPointCount: yieldedCount,
      totalPlasticDissipation: totalDissipation
    };
  }
}
