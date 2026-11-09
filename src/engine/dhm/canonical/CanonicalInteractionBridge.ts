/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 007
 * Canonical Interaction Integration Bridge
 * 
 * Binds Human-Environment Interaction Analysis to SECP EngineeringDocument,
 * ensures revision integrity, and logs formal evidence for task feasibility.
 */

import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { HumanTaskAnalysis } from '../interaction/types';

export class CanonicalInteractionBridge {
  public static readonly VERSION = '1.0.0-PROD';

  /**
   * Binds Human Task Analysis result to EngineeringDocument and logs evidence
   */
  public static attachAnalysisToDocument(
    doc: EngineeringDocument,
    analysis: HumanTaskAnalysis
  ): EngineeringDocument {
    if (!doc) {
      throw new Error('[CanonicalInteractionBridge] Target EngineeringDocument is null.');
    }

    if (!analysis) {
      throw new Error('[CanonicalInteractionBridge] Cannot attach null HumanTaskAnalysis.');
    }

    const validation = this.validateAnalysisBinding(doc, analysis);
    if (!validation.isValid) {
      throw new Error(`[CanonicalInteractionBridge] Invalid analysis binding: ${validation.errors.join('; ')}`);
    }

    // Deep clone document
    const updatedDoc: EngineeringDocument = JSON.parse(JSON.stringify(doc));

    if (!updatedDoc.derived) {
      updatedDoc.derived = {};
    }
    updatedDoc.derived.taskAnalysis = analysis;

    if (!updatedDoc.metadata) {
      updatedDoc.metadata = {};
    }
    updatedDoc.metadata.taskAnalysisProvenanceHash = analysis.provenanceHash;

    if (!updatedDoc.evidence) {
      updatedDoc.evidence = [];
    }

    updatedDoc.evidence.push({
      evidenceId: `EVID_TASK_${analysis.analysisId}`,
      stage: 'HUMAN_ENVIRONMENT_INTERACTION',
      sourceSystem: 'SECP-HFEE-001',
      documentId: doc.documentId,
      revision: doc.revision,
      canonicalHash: analysis.provenanceHash,
      timestamp: analysis.createdAtIso,
      verdict: analysis.overallFeasibility ? 'PASS' : 'FAIL',
      payload: {
        analysisId: analysis.analysisId,
        taskId: analysis.taskId,
        overallFeasibility: analysis.overallFeasibility,
        maxErgonomicRiskScore: analysis.maxErgonomicRiskScore,
        criticalIssues: analysis.criticalIssues,
        stateCount: analysis.states.length,
        limitations: analysis.limitations
      }
    });

    return updatedDoc;
  }

  /**
   * Validates binding compatibility and integrity
   */
  public static validateAnalysisBinding(
    doc: EngineeringDocument,
    analysis: HumanTaskAnalysis
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (doc && analysis.documentId !== doc.documentId) {
      errors.push(`Document ID mismatch: result bound to '${analysis.documentId}' but document ID is '${doc.documentId}'.`);
    }

    if (doc && String(analysis.revision) !== String(doc.revision)) {
      errors.push(`Revision mismatch: result bound to revision '${analysis.revision}' but document revision is '${doc.revision}'.`);
    }

    // Hash integrity verification
    const rawStr = `${analysis.analysisId}:${analysis.taskId}:${analysis.documentId}:${analysis.revision}:${analysis.overallFeasibility}`;
    const recomputedHash = this.hashString(rawStr);

    if (recomputedHash !== analysis.provenanceHash) {
      errors.push('Task analysis result provenance hash verification failed (mutation detected).');
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

  /**
   * RECOGNIZED LIMITATION: PERSISTENCE_NOT_PROVEN
   * Evidence is bound to the document object in-memory but no physical database
   * persistence or verified read-back cycle is currently implemented.
   */
  public static readonly PERSISTENCE_LIMITATION = 'PERSISTENCE_NOT_PROVEN';
}
