/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 004
 * Canonical Reachability Integration Bridge
 * 
 * Binds Reachability & Reach Envelope results to SECP EngineeringDocument SOT,
 * CAD assembly revisions, and canonical evidence ledgers without in-place SOT mutation.
 */

import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { ReachabilityEvaluationResult, ReachEnvelopeResult } from '../reachability/types';

export class CanonicalReachabilityBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Binds Reachability Evaluation Result to EngineeringDocument and logs evidence
   */
  public static attachReachabilityToDocument(
    doc: EngineeringDocument,
    reachResult: ReachabilityEvaluationResult
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalReachabilityBridge] Target EngineeringDocument is null or undefined.');
    }

    if (!reachResult) {
      throw new Error('[CanonicalReachabilityBridge] Cannot attach null or undefined ReachabilityEvaluationResult.');
    }

    const validation = this.validateReachabilityBinding(doc, reachResult);
    if (!validation.isValid) {
      throw new Error(`[CanonicalReachabilityBridge] Invalid reachability binding: ${validation.errors.join('; ')}`);
    }

    // Deep clone document to preserve SOT immutability
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }
    updatedDoc.derived.reachability = reachResult;

    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.reachabilityProvenanceHash = reachResult.provenanceHash;

    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    const isPass = reachResult.status === 'REACHABLE_COLLISION_FREE';

    updatedDoc.evidence.push({
      evidenceId: `EVID_REACH_${reachResult.evaluationId}`,
      stage: 'HUMAN_FACTORS_REACHABILITY',
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: reachResult.provenanceHash,
      timestamp: reachResult.createdAtIso,
      verdict: isPass ? 'PASS' : 'FAIL',
      payload: {
        evaluationId: reachResult.evaluationId,
        effector: reachResult.effector,
        status: reachResult.status,
        isKinematicallyReachable: reachResult.isKinematicallyReachable,
        isAnatomicallyAdmissible: reachResult.isAnatomicallyAdmissible,
        isCollisionFree: reachResult.isCollisionFree,
        positionResidualMm: reachResult.positionResidualMm,
        limitations: reachResult.limitations
      }
    });

    return updatedDoc;
  }

  /**
   * Binds Reach Envelope Result to EngineeringDocument
   */
  public static attachEnvelopeToDocument(
    doc: EngineeringDocument,
    envelopeResult: ReachEnvelopeResult
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalReachabilityBridge] Target EngineeringDocument is null or undefined.');
    }

    if (!envelopeResult) {
      throw new Error('[CanonicalReachabilityBridge] Cannot attach null or undefined ReachEnvelopeResult.');
    }

    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }
    updatedDoc.derived.reachEnvelope = envelopeResult;

    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.reachEnvelopeProvenanceHash = envelopeResult.provenanceHash;

    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    updatedDoc.evidence.push({
      evidenceId: `EVID_ENV_${envelopeResult.envelopeId}`,
      stage: 'HUMAN_FACTORS_REACH_ENVELOPE',
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: envelopeResult.provenanceHash,
      timestamp: envelopeResult.createdAtIso,
      verdict: 'PASS',
      payload: {
        envelopeId: envelopeResult.envelopeId,
        effector: envelopeResult.effector,
        totalSamplesEvaluated: envelopeResult.totalSamplesEvaluated,
        reachablePointCount: envelopeResult.reachablePointCount,
        collisionFreePointCount: envelopeResult.collisionFreePointCount,
        coverageRatio: envelopeResult.coverageRatio
      }
    });

    return updatedDoc;
  }

  /**
   * Validates binding compatibility and revision match
   */
  public static validateReachabilityBinding(
    doc: EngineeringDocument,
    reachResult: ReachabilityEvaluationResult
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!reachResult) {
      return { isValid: false, errors: ['ReachabilityEvaluationResult is null or undefined.'] };
    }

    if (doc && reachResult.documentId !== doc.documentId) {
      errors.push(`Document ID mismatch: result bound to '${reachResult.documentId}' but document ID is '${doc.documentId}'.`);
    }

    if (doc && String(reachResult.revision) !== String(doc.revision)) {
      errors.push(`Revision mismatch: result bound to revision '${reachResult.revision}' but document revision is '${doc.revision}'.`);
    }

    // Hash integrity verification
    const rawStr = `${reachResult.evaluationId}:${reachResult.documentId}:${reachResult.revision}:${reachResult.dhmProfileId}:${reachResult.effector}:${reachResult.targetPositionMm.x},${reachResult.targetPositionMm.y},${reachResult.targetPositionMm.z}:${reachResult.status}`;
    const recomputedHash = this.hashString(rawStr);

    if (recomputedHash !== reachResult.provenanceHash) {
      errors.push('Reachability result provenance hash verification failed (mutation or tamper detected).');
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
