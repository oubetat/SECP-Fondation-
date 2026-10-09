import { ContactPointState, ContactStatus } from "./types";

export class ContactActiveSet {
  private activePoints: Map<string, ContactPointState> = new Map();
  private inactivePoints: Map<string, ContactPointState> = new Map();
  private churnCount: number = 0;

  updateActiveSet(newStates: ContactPointState[]): {
    activeCount: number;
    inactiveCount: number;
    churnCount: number;
    changed: boolean;
  } {
    let changed = false;

    for (const state of newStates) {
      const prevActive = this.activePoints.get(state.pointId);
      const prevInactive = this.inactivePoints.get(state.pointId);

      const isActive = state.status === 'ACTIVE' || state.status === 'CONTACTING';

      if (isActive) {
        if (!prevActive) {
          changed = true;
          this.churnCount++;
        }
        this.activePoints.set(state.pointId, { ...state });
        this.inactivePoints.delete(state.pointId);
      } else {
        if (!prevInactive) {
          changed = true;
          this.churnCount++;
        }
        this.inactivePoints.set(state.pointId, { ...state });
        this.activePoints.delete(state.pointId);
      }
    }

    return {
      activeCount: this.activePoints.size,
      inactiveCount: this.inactivePoints.size,
      churnCount: this.churnCount,
      changed
    };
  }

  getActivePoints(): ContactPointState[] {
    return Array.from(this.activePoints.values());
  }

  getInactivePoints(): ContactPointState[] {
    return Array.from(this.inactivePoints.values());
  }

  getChurnCount(): number {
    return this.churnCount;
  }

  resetChurnCount(): void {
    this.churnCount = 0;
  }

  clear(): void {
    this.activePoints.clear();
    this.inactivePoints.clear();
    this.churnCount = 0;
  }
}
