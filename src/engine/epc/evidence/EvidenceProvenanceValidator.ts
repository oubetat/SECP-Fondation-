/**
 * SECP Industrial OS — EPC-011: Engineering Evidence Provenance Validator
 */

import { EvidenceProvenance, ProvenanceValidationResult } from './EvidenceProvenanceTypes';

export class EvidenceProvenanceValidator {
  /**
   * Validates that a provenance record contains all mandatory fields.
   */
  public static validate(provenance: EvidenceProvenance): ProvenanceValidationResult {
    const missingFields: string[] = [];

    if (!provenance.provenanceId) missingFields.push('provenanceId');
    if (!provenance.evidenceId) missingFields.push('evidenceId');
    if (!provenance.actor || provenance.actor === 'unknown') missingFields.push('actor');
    if (!provenance.action) missingFields.push('action');
    if (!provenance.timestamp) missingFields.push('timestamp');
    if (!provenance.source) missingFields.push('source');
    if (!provenance.sourceVersion) missingFields.push('sourceVersion');
    if (!provenance.inputs || Object.keys(provenance.inputs).length === 0) missingFields.push('inputs');
    if (!provenance.process || !provenance.process.executionId) missingFields.push('process.executionId');
    if (!provenance.outputs || provenance.outputs.length === 0) missingFields.push('outputs');
    if (!provenance.revisionId) missingFields.push('revisionId');

    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }
}
