
import { DesignIntent, IntentDiagnostic, IntentStatus } from './IntentTypes';

export class DesignIntentGraph {
  private intents: Map<string, DesignIntent> = new Map();

  public addIntent(intent: DesignIntent) {
    this.intents.set(intent.id, intent);
    this.checkConflicts(intent);
  }

  public getIntents(): DesignIntent[] {
    return Array.from(this.intents.values());
  }

  public getIntent(id: string): DesignIntent | undefined {
    return this.intents.get(id);
  }

  public updateIntentStatus(id: string, status: IntentStatus) {
    const intent = this.intents.get(id);
    if (intent) {
      intent.status = status;
    }
  }

  public verifyIntent(id: string): boolean {
    const intent = this.intents.get(id);
    if (!intent) return false;

    // In a real engine, this would perform a geometric proof
    // For now, we simulate the verification of the evidence
    if (intent.confidence > 0.99) {
      intent.status = 'VERIFIED';
      return true;
    }
    intent.status = 'UNPROVEN';
    return false;
  }

  private checkConflicts(newIntent: DesignIntent) {
    // Basic conflict detection: same geometry with incompatible intents
    // e.g. Parallel AND Perpendicular on the same face pairs
    for (const existing of this.intents.values()) {
      if (existing.id === newIntent.id) continue;

      const sharedSource = existing.sourceGeometryIds.some(id => newIntent.sourceGeometryIds.includes(id));
      const sharedTarget = existing.targetGeometryIds.some(id => newIntent.targetGeometryIds.includes(id));

      if (sharedSource && sharedTarget) {
        if (this.isIncompatible(existing.type, newIntent.type)) {
          existing.status = 'CONFLICTED';
          newIntent.status = 'CONFLICTED';
        }
      }
    }
  }

  private isIncompatible(type1: string, type2: string): boolean {
    if (type1 === 'PARALLEL' && type2 === 'PERPENDICULAR') return true;
    if (type1 === 'PERPENDICULAR' && type2 === 'PARALLEL') return true;
    return false;
  }
}
