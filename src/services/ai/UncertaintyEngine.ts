import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';

export class UncertaintyEngine {
  public static propagateUncertainty(evidenceList: EngineeringEvidence[]): number {
    if (evidenceList.length === 0) return 1.0; // 100% uncertainty
    
    // Average uncertainty or max uncertainty
    const uncertainties = evidenceList.map(e => 1.0 - (e.confidence || 0.5));
    return Math.max(...uncertainties);
  }
}
