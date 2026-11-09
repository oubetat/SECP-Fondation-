/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006-B
 * Canonical Ergonomics Integration Bridge
 * 
 * Binds RULA, REBA, OWAS, and NIOSH assessment results to EngineeringDocument.
 */

import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { ErgonomicEvidence } from '../ergonomics/types';

export class CanonicalErgonomicsBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Binds Ergonomic Evidence to EngineeringDocument
   */
  public static attachErgonomicsToDocument(
    doc: EngineeringDocument,
    evidence: ErgonomicEvidence
  ): EngineeringDocument {
    if (!doc) throw new Error('[CanonicalErgonomicsBridge] Target document is null.');
    if (!evidence) throw new Error('[CanonicalErgonomicsBridge] Evidence is null.');

    const validation = this.validateBinding(doc, evidence);
    if (!validation.isValid) {
      throw new Error(`[CanonicalErgonomicsBridge] Binding invalid: ${validation.errors.join('; ')}`);
    }

    // Clone to maintain immutability
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) updatedDoc.derived = {};
    if (!updatedDoc.derived.humanErgonomics) updatedDoc.derived.humanErgonomics = [];
    
    // Add to derived results
    updatedDoc.derived.humanErgonomics.push(evidence);

    // Append to evidence ledger
    if (!updatedDoc.evidence) updatedDoc.evidence = [];
    updatedDoc.evidence.push({
      evidenceId: `EVID_ERG_${evidence.methodology}_${Date.now()}`,
      stage: `HUMAN_FACTORS_ERGONOMICS_${evidence.methodology}`,
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: evidence.provenanceHash,
      timestamp: evidence.timestampIso,
      verdict: evidence.actionLevel > 2 ? 'FAIL' : 'PASS',
      payload: evidence
    });

    return updatedDoc;
  }

  /**
   * Validates binding integrity
   */
  public static validateBinding(
    doc: EngineeringDocument,
    evidence: ErgonomicEvidence
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (doc && evidence.documentId !== doc.documentId) {
      errors.push(`Document ID mismatch: result bound to '${evidence.documentId}' but document ID is '${doc.documentId}'.`);
    }

    if (doc && String(evidence.revision) !== String(doc.revision)) {
      errors.push(`Revision mismatch: result bound to revision '${evidence.revision}' but document revision is '${doc.revision}'.`);
    }

    // Verify hash integrity (simplified check)
    if (!evidence.provenanceHash) {
      errors.push('Provenance hash is missing.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
