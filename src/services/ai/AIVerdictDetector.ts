import { EngineeringVerdict } from '../../engine/engineering_ai/verdict/types';

export interface VerdictDetectionResult {
  hasVerdictIntent: boolean;
  verdictType?: EngineeringVerdict;
  isImplicit: boolean;
  rawPhrase?: string;
}

export class AIVerdictDetector {
  private static verdictKeywords: Array<{ keywords: string[]; verdict: EngineeringVerdict }> = [
    { keywords: ['safe', 'is safe', 'structurally safe'], verdict: 'SAFE' },
    { keywords: ['unsafe', 'is unsafe', 'not safe'], verdict: 'UNSAFE' },
    { keywords: ['compliant', 'is compliant', 'iso compliant'], verdict: 'COMPLIANT' },
    { keywords: ['approved', 'is approved', 'design approved'], verdict: 'APPROVED' },
    { keywords: ['qualified', 'material qualified'], verdict: 'QUALIFIED' },
    { keywords: ['production ready', 'ready for production'], verdict: 'PRODUCTION_READY' },
    { keywords: ['manufacturable', 'can be manufactured'], verdict: 'MANUFACTURABLE' },
  ];

  private static implicitPhrases = [
    'this design can be used',
    'the component is acceptable',
    'the model is good enough',
    'the part should pass',
    'suitable for production',
    'there is no structural concern',
    'is required'
  ];

  public static detect(text: string): VerdictDetectionResult {
    const lower = text.toLowerCase();

    // Check explicit keywords
    for (const item of this.verdictKeywords) {
      for (const kw of item.keywords) {
        if (lower.includes(kw)) {
          return {
            hasVerdictIntent: true,
            verdictType: item.verdict,
            isImplicit: false,
            rawPhrase: kw
          };
        }
      }
    }

    // Check implicit phrases
    for (const phrase of this.implicitPhrases) {
      if (lower.includes(phrase)) {
        return {
          hasVerdictIntent: true,
          verdictType: 'APPROVED',
          isImplicit: true,
          rawPhrase: phrase
        };
      }
    }

    return {
      hasVerdictIntent: false,
      isImplicit: false
    };
  }
}
