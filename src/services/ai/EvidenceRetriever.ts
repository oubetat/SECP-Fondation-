import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';

export class EvidenceRetriever {
  private store: Map<string, EngineeringEvidence> = new Map();

  public addEvidence(ev: EngineeringEvidence) {
    this.store.set(ev.evidenceId, ev);
  }

  public retrieveByContext(context: Record<string, any>): EngineeringEvidence[] {
    const results: EngineeringEvidence[] = [];
    for (const ev of this.store.values()) {
      let match = true;
      for (const k of Object.keys(context)) {
        if (ev.context[k] !== context[k]) {
          match = false;
          break;
        }
      }
      if (match) results.push(ev);
    }
    return results;
  }

  public getById(id: string): EngineeringEvidence | undefined {
    return this.store.get(id);
  }
}
