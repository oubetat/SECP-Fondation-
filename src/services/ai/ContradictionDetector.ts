import { EngineeringEvidence, ContradictionState } from '../../engine/engineering_ai/evidence/types';

export class ContradictionDetector {
  public static detectConflict(
    evidenceA: EngineeringEvidence,
    evidenceB: EngineeringEvidence
  ): ContradictionState {
    if (evidenceA.sourceId === evidenceB.sourceId && evidenceA.sourceRevision !== evidenceB.sourceRevision) {
      return 'POTENTIAL_CONFLICT';
    }

    if (evidenceA.measurement !== undefined && evidenceB.measurement !== undefined) {
      const diff = Math.abs(evidenceA.measurement - evidenceB.measurement);
      if (diff > 1e-2) {
        return 'CONFIRMED_CONFLICT';
      }
    }

    return 'NO_CONFLICT';
  }
}
