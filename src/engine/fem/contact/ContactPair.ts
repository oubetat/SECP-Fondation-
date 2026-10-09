import { ContactPairData, ContactParameters, ContactPointState } from './types';
import { ContactSurface } from './ContactSurface';

export class ContactPair {
  public pairId: string;
  public parameters: ContactParameters;
  private pointStates: Map<string, ContactPointState> = new Map();

  constructor(
    public data: ContactPairData,
    public slaveSurface: ContactSurface,
    public masterSurface: ContactSurface
  ) {
    this.pairId = data.pairId;
    this.parameters = data.parameters;
    if (this.parameters?.penaltyStiffness !== undefined && this.parameters.penaltyStiffness <= 0) {
      throw new Error(`Invalid penalty stiffness: ${this.parameters.penaltyStiffness}. Must be positive.`);
    }
  }

  /**
   * Sets or updates the contact state for a specific slave point.
   * Mandated by PATCH-329 for genuine state tracking.
   */
  public setPointState(state: ContactPointState): void {
    this.pointStates.set(state.pointId, { ...state });
  }

  /**
   * Retrieves the current state for a specific slave point.
   */
  public getPointState(pointId: string): ContactPointState | undefined {
    return this.pointStates.get(pointId);
  }

  /**
   * Returns all tracked point states for this contact pair.
   */
  public getAllPointStates(): ContactPointState[] {
    return Array.from(this.pointStates.values());
  }

  /**
   * Clears tracked states (usually at start of new analysis step).
   */
  public clearStates(): void {
    this.pointStates.clear();
  }
}
