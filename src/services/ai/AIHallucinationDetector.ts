import { AIHallucinationEvent, AIHallucinationType } from '../../engine/engineering_ai/verdict/types';
import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';

export class AIHallucinationDetector {
  public static detectFabricatedNumber(
    text: string,
    evidenceList: EngineeringEvidence[]
  ): { fabricated: boolean; value?: number } {
    // Regex for matching numbers with units (e.g. 187.3 MPa or 187.3)
    const matches = text.match(/\b\d+(\.\d+)?\b/g);
    if (!matches) return { fabricated: false };

    const validMeasurements = evidenceList
      .filter(e => e.measurement !== undefined)
      .map(e => e.measurement!);

    if (validMeasurements.length === 0 && matches.length > 0) {
      // Numbers mentioned without any underlying measurement evidence
      const num = parseFloat(matches[0]);
      if (!isNaN(num) && num > 10) { // filter out small common numbers
        return { fabricated: true, value: num };
      }
    }

    for (const m of matches) {
      const val = parseFloat(m);
      if (val > 10) {
        const found = validMeasurements.some(vm => Math.abs(vm - val) < 1e-2);
        if (!found) {
          return { fabricated: true, value: val };
        }
      }
    }

    return { fabricated: false };
  }

  public static detectFabricatedStandard(text: string, evidenceList: EngineeringEvidence[]): boolean {
    if (text.toLowerCase().includes('iso') || text.toLowerCase().includes('asme')) {
      const hasStandardEv = evidenceList.some(e => e.sourceType === 'ENGINEERING_STANDARD' && e.state === 'VALID');
      if (!hasStandardEv) return true;
    }
    return false;
  }

  public static createEvent(
    type: AIHallucinationType,
    claim: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'CRITICAL'
  ): AIHallucinationEvent {
    return {
      eventId: `HAL-${Date.now()}`,
      sessionId: 'SESS-101',
      modelId: 'Gemini-3.6-Flash',
      modelVersion: '1.0.0',
      hallucinationType: type,
      claim,
      evidenceState: 'MISSING',
      detectedBy: 'AIHallucinationDetector',
      timestamp: new Date().toISOString(),
      severity,
      blocked: true
    };
  }
}
