import { ContactStateHasher } from "./ContactStateHasher";
import { ContactPointState } from "./types";

export class ContactStateHistory {
  private committedStates: Map<string, ContactPointState> = new Map();
  private trialStates: Map<string, ContactPointState> = new Map();
  private stepId: number = 0;
  private incrementId: number = 0;

  constructor(initialStates?: ContactPointState[]) {
    if (initialStates) {
      for (const s of initialStates) {
        this.committedStates.set(s.pointId, { ...s });
        this.trialStates.set(s.pointId, { ...s });
      }
    }
  }

  updateTrialState(state: ContactPointState): void {
    this.trialStates.set(state.pointId, { ...state });
  }

  getTrialStates(): ContactPointState[] {
    return Array.from(this.trialStates.values());
  }

  getCommittedStates(): ContactPointState[] {
    return Array.from(this.committedStates.values());
  }

  commit(stepId?: number, incrementId?: number): string {
    if (stepId !== undefined) this.stepId = stepId;
    if (incrementId !== undefined) this.incrementId = incrementId;

    this.committedStates.clear();
    for (const [id, state] of this.trialStates.entries()) {
      const committed = {
        ...state,
        step: this.stepId,
        iteration: 0
      };
      this.committedStates.set(id, committed);
    }

    const hash = ContactStateHasher.computeStateHash("GLOBAL_PAIR", Array.from(this.committedStates.values()));
    for (const state of this.committedStates.values()) {
      state.stateHash = hash;
    }
    return hash;
  }

  revert(): void {
    this.trialStates.clear();
    for (const [id, state] of this.committedStates.entries()) {
      this.trialStates.set(id, { ...state });
    }
  }
}
