import { IntegrationPointState, MaterialState } from "./FEMTypes";

export class MaterialStateManager {
  private committedState: MaterialState = { elementStates: new Map() };
  private trialState: MaterialState = { elementStates: new Map() };

  /**
   * Initializes state for a given element and number of integration points.
   */
  public initializeElement(elementId: string, numPoints: number, initialState: IntegrationPointState) {
    const states = Array.from({ length: numPoints }, () => ({ ...initialState }));
    this.committedState.elementStates.set(elementId, states);
    this.trialState.elementStates.set(elementId, states.map(s => ({ ...s })));
  }

  public getElementStates(elementId: string, useTrial: boolean = true): IntegrationPointState[] {
    const source = useTrial ? this.trialState : this.committedState;
    const states = source.elementStates.get(elementId);
    if (!states) throw new Error(`[STATE_NOT_FOUND] No state for element ${elementId}`);
    return states;
  }

  public updateIntegrationPoint(elementId: string, pointIndex: number, newState: IntegrationPointState) {
    const states = this.trialState.elementStates.get(elementId);
    if (!states) throw new Error(`[STATE_NOT_FOUND] No state for element ${elementId}`);
    states[pointIndex] = newState;
  }

  /**
   * Commits trial states to committed states after a converged load increment.
   */
  public commit() {
    for (const [elemId, states] of this.trialState.elementStates.entries()) {
      this.committedState.elementStates.set(elemId, states.map(s => ({ ...s })));
    }
  }

  /**
   * Discards trial states and reverts to last committed state.
   */
  public rollback() {
    for (const [elemId, states] of this.committedState.elementStates.entries()) {
      this.trialState.elementStates.set(elemId, states.map(s => ({ ...s })));
    }
  }

  /**
   * Resets trial state to match committed state (start of a new iteration or step).
   */
  public resetTrial() {
    this.rollback();
  }
}
