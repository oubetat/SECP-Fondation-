import { VerdictResponse, AIHallucinationEvent, EngineeringVerdict } from '../../engine/engineering_ai/verdict/types';
import { EngineeringEvidence } from '../../engine/engineering_ai/evidence/types';
import { AIVerdictDetector } from './AIVerdictDetector';
import { AIHallucinationDetector } from './AIHallucinationDetector';
import { AIVerdictPolicy } from './AIVerdictPolicy';
import { ContradictionDetector } from './ContradictionDetector';

export class AIVerdictGate {
  public static evaluateVerdict(
    responseText: string,
    evidenceList: EngineeringEvidence[],
    contextRevision: string = 'R1'
  ): { response: VerdictResponse; event?: AIHallucinationEvent } {
    const verdictDetection = AIVerdictDetector.detect(responseText);

    // If no verdict intent, it's explanation/reasoning -> Allowed
    if (!verdictDetection.hasVerdictIntent) {
      return {
        response: {
          verdictState: 'ALLOWED',
          evidenceStatus: 'VALIDATED',
          evidenceIds: evidenceList.map(e => e.evidenceId),
          supportScore: 1.0,
          coverage: 1.0,
          uncertainty: 0,
          conflicts: [],
          assumptions: [],
          verificationState: 'EXPLANATION_ONLY',
          authorizationState: 'UNAUTHORIZED'
        }
      };
    }

    const verdict = verdictDetection.verdictType || 'APPROVED';

    // 1. Zero-Evidence Rule
    if (!evidenceList || evidenceList.length === 0) {
      const event = AIHallucinationDetector.createEvent('UNSUPPORTED_VERDICT', responseText, 'CRITICAL');
      return {
        response: {
          verdictState: 'BLOCKED',
          verdict,
          reason: 'NO_EVIDENCE',
          evidenceStatus: 'MISSING',
          evidenceIds: [],
          supportScore: 0,
          coverage: 0,
          uncertainty: 1.0,
          conflicts: [],
          assumptions: [],
          verificationState: 'UNSUPPORTED',
          authorizationState: 'UNAUTHORIZED'
        },
        event
      };
    }

    // 2. AI-generated evidence self-proof check
    const hasOnlyAIEvidence = evidenceList.every(e => e.authority === 'AI_GENERATED');
    if (hasOnlyAIEvidence) {
      const event = AIHallucinationDetector.createEvent('UNSUPPORTED_VERDICT', responseText, 'CRITICAL');
      return {
        response: {
          verdictState: 'BLOCKED',
          verdict,
          reason: 'NO_EVIDENCE',
          evidenceStatus: 'INSUFFICIENT',
          evidenceIds: [],
          supportScore: 0,
          coverage: 0,
          uncertainty: 1.0,
          conflicts: [],
          assumptions: [],
          verificationState: 'AI_SELF_PROOF_BLOCKED',
          authorizationState: 'UNAUTHORIZED'
        },
        event
      };
    }

    // 3. Revision and Context Lock
    const contextCheck = AIVerdictPolicy.checkContextAndRevision(contextRevision, evidenceList);
    if (!contextCheck.valid) {
      return {
        response: {
          verdictState: 'BLOCKED',
          verdict,
          reason: contextCheck.reason as any,
          evidenceStatus: 'INSUFFICIENT',
          evidenceIds: evidenceList.map(e => e.evidenceId),
          supportScore: 0,
          coverage: 0,
          uncertainty: 1.0,
          conflicts: [],
          assumptions: [],
          verificationState: 'CONTEXT_LOCK_FAILED',
          authorizationState: 'UNAUTHORIZED'
        }
      };
    }

    // 4. Contradiction Detection
    if (evidenceList.length >= 2) {
      for (let i = 0; i < evidenceList.length; i++) {
        for (let j = i + 1; j < evidenceList.length; j++) {
          const conflict = ContradictionDetector.detectConflict(evidenceList[i], evidenceList[j]);
          if (conflict === 'CONFIRMED_CONFLICT') {
            return {
              response: {
                verdictState: 'BLOCKED',
                verdict,
                reason: 'UNRESOLVED_CONFLICT',
                evidenceStatus: 'CONFLICTED',
                evidenceIds: evidenceList.map(e => e.evidenceId),
                supportScore: 0,
                coverage: 0.5,
                uncertainty: 0.8,
                conflicts: ['CONFIRMED_CONFLICT'],
                assumptions: [],
                verificationState: 'CONFLICTED',
                authorizationState: 'UNAUTHORIZED'
              }
            };
          }
        }
      }
    }

    // 5. Fabricated Number Check
    const numCheck = AIHallucinationDetector.detectFabricatedNumber(responseText, evidenceList);
    if (numCheck.fabricated) {
      const event = AIHallucinationDetector.createEvent('FABRICATED_NUMBER', responseText, 'HIGH');
      return {
        response: {
          verdictState: 'BLOCKED',
          verdict,
          reason: 'FABRICATED_NUMBER',
          evidenceStatus: 'INSUFFICIENT',
          evidenceIds: evidenceList.map(e => e.evidenceId),
          supportScore: 0,
          coverage: 0,
          uncertainty: 1.0,
          conflicts: [],
          assumptions: [],
          verificationState: 'FABRICATED_NUMBER',
          authorizationState: 'UNAUTHORIZED'
        },
        event
      };
    }

    // 6. Fabricated Standard Check
    if (AIHallucinationDetector.detectFabricatedStandard(responseText, evidenceList)) {
      const event = AIHallucinationDetector.createEvent('FABRICATED_STANDARD', responseText, 'HIGH');
      return {
        response: {
          verdictState: 'BLOCKED',
          verdict,
          reason: 'FABRICATED_STANDARD',
          evidenceStatus: 'INSUFFICIENT',
          evidenceIds: evidenceList.map(e => e.evidenceId),
          supportScore: 0,
          coverage: 0,
          uncertainty: 1.0,
          conflicts: [],
          assumptions: [],
          verificationState: 'FABRICATED_STANDARD',
          authorizationState: 'UNAUTHORIZED'
        },
        event
      };
    }

    // 7. Check Independent Verification requirement for Critical Safety Verdicts
    const hasPrimary = evidenceList.some(e => e.authority === 'PRIMARY_VERIFIED');
    if (!hasPrimary) {
      return {
        response: {
          verdictState: 'AUTHORIZATION_REQUIRED',
          verdict,
          reason: 'INSUFFICIENT_INDEPENDENCE',
          evidenceStatus: 'VALIDATED',
          evidenceIds: evidenceList.map(e => e.evidenceId),
          supportScore: 0.7,
          coverage: 0.8,
          uncertainty: 0.2,
          conflicts: [],
          assumptions: [],
          verificationState: 'VERIFIED_PENDING_AUTHORIZATION',
          authorizationState: 'PENDING_REVIEW'
        }
      };
    }

    // Fully Validated Evidence -> Verdict Allowed / Eligible for Authorization
    return {
      response: {
        verdictState: 'ALLOWED',
        verdict,
        evidenceStatus: 'VALIDATED',
        evidenceIds: evidenceList.map(e => e.evidenceId),
        supportScore: 1.0,
        coverage: 1.0,
        uncertainty: 0,
        conflicts: [],
        assumptions: [],
        verificationState: 'VERIFIED',
        authorizationState: 'AUTHORIZED'
      }
    };
  }
}
