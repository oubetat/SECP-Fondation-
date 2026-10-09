/**
 * SECP — ADSE-P1 Verification Intent Engine
 * Authoritative link between system requirements and core verification evidence.
 */

import { ADSEVerificationIntent } from './types';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { GenericExecutionRegistry } from '../../execution/GenericExecutionRegistry';

export class VerificationIntentEngine {
  private intents: Map<string, ADSEVerificationIntent> = new Map();

  /**
   * Records a new verification intent for a requirement.
   */
  public createIntent(intentData: Omit<ADSEVerificationIntent, 'status' | 'evidenceLeafHash'>): ADSEVerificationIntent {
    const intent: ADSEVerificationIntent = {
      ...intentData,
      status: 'PENDING'
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  /**
   * Binds a Core Execution Evidence to a Verification Intent.
   * Authoritatively updates status based on Core Evidence verification.
   */
  public bindEvidence(intentId: string, executionId: string): ADSEVerificationIntent {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`INTENT_NOT_FOUND: ${intentId}`);

    const envelope = GenericExecutionRegistry.getExecution(executionId);
    if (!envelope) throw new Error(`CORE_EVIDENCE_NOT_FOUND: ${executionId}`);

    // Verify evidence integrity
    if (envelope.state !== 'SEALED') {
      throw new Error(`UNSEALED_EVIDENCE_REJECTED: Execution ${executionId} is not sealed.`);
    }

    intent.status = envelope.verificationResult.overallVerdict === 'PASS' ? 'VERIFIED' : 'FAILED';
    intent.evidenceLeafHash = envelope.evidenceLeaf.leafHash;

    return intent;
  }

  public getIntent(id: string): ADSEVerificationIntent | undefined {
    return this.intents.get(id);
  }

  public getIntentsByRequirement(requirementId: string): ADSEVerificationIntent[] {
    return Array.from(this.intents.values()).filter(i => i.requirementId === requirementId);
  }

  public clear(): void {
    this.intents.clear();
  }
}
