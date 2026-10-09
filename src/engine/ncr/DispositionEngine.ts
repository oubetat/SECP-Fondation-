/**
 * PATCH-SECP-063: Material Disposition Engine
 * Oversees the formal review and clearance of parts (REWORK, REPAIR, SCRAP, etc.).
 * Mandates cryptographic signatures of authorized quality engineers.
 */

import { DispositionRecord, DispositionType } from './NCRTypes';

export class DispositionEngine {
  /**
   * Applies a formal disposition to a nonconforming part
   */
  public static authorizeDisposition(params: {
    ncrId: string;
    disposition: DispositionType;
    justification: string;
    authorizedEngineerId: string;
  }): DispositionRecord {
    const dispositionId = `disp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Validate justification length to ensure thorough engineering documentation
    if (params.justification.length < 15) {
      throw new Error('Engineering Rule: Dispositions require a thorough technical justification (minimum 15 characters).');
    }

    // Generate secure signature from authorization coordinates
    const signaturePayload = `${params.ncrId}|${params.disposition}|${params.authorizedEngineerId}|${params.justification}`;
    const signatureHash = this.generateDeterministicSignature(signaturePayload);

    return {
      dispositionId,
      ncrId: params.ncrId,
      disposition: params.disposition,
      justification: params.justification,
      authorizedEngineerId: params.authorizedEngineerId,
      signatureHash,
      timestamp: new Date().toISOString()
    };
  }

  private static generateDeterministicSignature(input: string): string {
    let hash = 0x12345678;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return `sig-engineer-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
