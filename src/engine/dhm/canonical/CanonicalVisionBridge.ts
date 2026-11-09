/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 005
 * Canonical Human Vision Integration Bridge
 * 
 * Binds Line-of-Sight & Visibility results to SECP EngineeringDocument SOT,
 * CAD assembly revisions, and canonical evidence ledgers without in-place SOT mutation.
 */

import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { LineOfSightQueryResult } from '../vision/types';

export class CanonicalVisionBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Binds Line-of-Sight Query Result to EngineeringDocument and appends evidence
   */
  public static attachVisionToDocument(
    doc: EngineeringDocument,
    visionResult: LineOfSightQueryResult
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalVisionBridge] Target EngineeringDocument is null or undefined.');
    }

    if (!visionResult) {
      throw new Error('[CanonicalVisionBridge] Cannot attach null or undefined LineOfSightQueryResult.');
    }

    const validation = this.validateVisionBinding(doc, visionResult);
    if (!validation.isValid) {
      throw new Error(`[CanonicalVisionBridge] Invalid vision binding: ${validation.errors.join('; ')}`);
    }

    // Deep clone document to preserve SOT immutability
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }
    updatedDoc.derived.humanVision = visionResult;

    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.visionProvenanceHash = visionResult.provenanceHash;

    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    const isPass = visionResult.status === 'VISIBLE_BINOCULAR' ||
      visionResult.status === 'VISIBLE_LEFT_EYE_ONLY' ||
      visionResult.status === 'VISIBLE_RIGHT_EYE_ONLY';

    updatedDoc.evidence.push({
      evidenceId: `EVID_VIS_${visionResult.queryId}`,
      stage: 'HUMAN_FACTORS_VISION',
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: visionResult.provenanceHash,
      timestamp: visionResult.createdAtIso,
      verdict: isPass ? 'PASS' : 'FAIL',
      payload: {
        queryId: visionResult.queryId,
        dhmProfileId: visionResult.dhmProfileId,
        status: visionResult.status,
        isLeftEyeUnobstructed: visionResult.isLeftEyeUnobstructed,
        isRightEyeUnobstructed: visionResult.isRightEyeUnobstructed,
        isInsideVisualField: visionResult.isInsideVisualField,
        occlusionPercentage: visionResult.occlusionPercentage,
        firstHitObstacle: visionResult.firstHitObstacle
      }
    });

    return updatedDoc;
  }

  /**
   * Validates binding compatibility and revision match
   */
  public static validateVisionBinding(
    doc: EngineeringDocument,
    visionResult: LineOfSightQueryResult
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!visionResult) {
      return { isValid: false, errors: ['LineOfSightQueryResult is null or undefined.'] };
    }

    if (doc && visionResult.documentId !== doc.documentId) {
      errors.push(`Document ID mismatch: result bound to '${visionResult.documentId}' but document ID is '${doc.documentId}'.`);
    }

    if (doc && String(visionResult.revision) !== String(doc.revision)) {
      errors.push(`Revision mismatch: result bound to revision '${visionResult.revision}' but document revision is '${doc.revision}'.`);
    }

    // Provenance Hash Verification
    const rawStr = `${visionResult.queryId}:${visionResult.documentId}:${visionResult.revision}:${visionResult.dhmProfileId}:${visionResult.status}:${visionResult.occlusionPercentage}`;
    const recomputedHash = this.hashString(rawStr);

    if (recomputedHash !== visionResult.provenanceHash) {
      errors.push('Vision result provenance hash verification failed (mutation or tamper detected).');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
