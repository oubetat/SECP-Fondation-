import { ContactPointState, ContactStateMode, ContactStatus } from "./types";

export interface ContactStateSnapshot {
  step: number;
  iteration: number;
  states: Map<string, ContactPointState>;
}

export class ContactStateManager {
  private committedStates: Map<string, ContactPointState> = new Map();
  private trialStates: Map<string, ContactPointState> = new Map();
  private rollbackStates: Map<string, ContactPointState> = new Map();
  private historyStack: ContactStateSnapshot[] = [];

  /**
   * Derives the active ContactStateMode given gap, normal force, relative slip, and friction limit.
   */
  static determineStateMode(
    gap: number,
    normalForce: number,
    relativeSlipNorm: number,
    tangentialForceNorm: number,
    frictionLimit: number
  ): { status: ContactStatus; mode: ContactStateMode } {
    if (gap > 1e-7) {
      if (normalForce > 0) {
        return { status: 'SEPARATING', mode: 'SEPARATING' };
      }
      return { status: 'OPEN', mode: 'OPEN' };
    }

    // gap <= 1e-7 -> In contact or penetrating
    const isPenetrating = gap < -1e-4;
    
    if (frictionLimit <= 0) {
      const mode = isPenetrating ? 'PENETRATING' : 'CONTACT';
      const status = isPenetrating ? 'PENETRATING' : 'ACTIVE';
      return { status, mode };
    }

    if (tangentialForceNorm > frictionLimit + 1e-6) {
      return { status: 'SLIDING', mode: 'SLIP' };
    } else {
      return { status: 'STICKING', mode: 'STICK' };
    }
  }

  setTrialState(pointId: string, state: ContactPointState): void {
    this.trialStates.set(pointId, { ...state });
  }

  getTrialState(pointId: string): ContactPointState | undefined {
    return this.trialStates.get(pointId);
  }

  getCommittedState(pointId: string): ContactPointState | undefined {
    return this.committedStates.get(pointId);
  }

  commitStep(step: number, iteration: number): void {
    // Save rollback snapshot from committed before replacing
    this.rollbackStates = new Map(this.committedStates);

    // Commit trial states
    this.committedStates = new Map(this.trialStates);

    this.historyStack.push({
      step,
      iteration,
      states: new Map(this.committedStates)
    });
  }

  rollbackStep(): void {
    // Restore committed states from rollbackStates snapshot
    this.trialStates = new Map(this.rollbackStates);
    this.committedStates = new Map(this.rollbackStates);
  }

  getAllTrialStates(): ContactPointState[] {
    return Array.from(this.trialStates.values());
  }

  getAllCommittedStates(): ContactPointState[] {
    return Array.from(this.committedStates.values());
  }

  clear(): void {
    this.committedStates.clear();
    this.trialStates.clear();
    this.rollbackStates.clear();
    this.historyStack = [];
  }
}
