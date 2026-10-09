/**
 * SECP Industrial OS — EPC-015: Master Acceptance Report Formatter
 * Canonical formatting utility for EPC Master Acceptance Gate audit reports.
 */

import { MasterAcceptanceResult, MasterGateCriterionId } from './EPCMasterAcceptanceTypes';

export class EPCMasterAcceptanceReport {
  /**
   * Generates a canonical, human-readable and machine-scannable EPC Master Acceptance Report.
   */
  public static generateReport(result: MasterAcceptanceResult): string {
    const getCriterionStatus = (id: MasterGateCriterionId): string => {
      const match = result.criteria.find(c => c.criterionId === id);
      return match ? match.status : 'NOT_EVALUATED';
    };

    const lines: string[] = [
      'EPC MASTER ACCEPTANCE',
      '=====================',
      '',
      'Case:',
      result.caseId,
      '',
      'Execution:',
      getCriterionStatus(MasterGateCriterionId.EXECUTION),
      '',
      'Configuration:',
      getCriterionStatus(MasterGateCriterionId.CONFIGURATION),
      '',
      'Traceability:',
      getCriterionStatus(MasterGateCriterionId.TRACEABILITY),
      '',
      'Provenance:',
      getCriterionStatus(MasterGateCriterionId.PROVENANCE),
      '',
      'Evidence Integrity:',
      getCriterionStatus(MasterGateCriterionId.INTEGRITY),
      '',
      'Reproducibility:',
      getCriterionStatus(MasterGateCriterionId.REPRODUCIBILITY),
      '',
      'Verdict Integrity:',
      getCriterionStatus(MasterGateCriterionId.VERDICT_INTEGRITY),
      '',
      '---------------------',
      '',
      'FINAL VERDICT:',
      result.verdict,
      '',
      'Evidence:',
      result.evidenceRefs && result.evidenceRefs.length > 0
        ? result.evidenceRefs.join(', ')
        : 'NONE',
      '',
      'Execution:',
      result.executionRef || 'NONE',
      '',
      'Configuration:',
      result.configurationRef || 'NONE'
    ];

    if (result.failures && result.failures.length > 0) {
      lines.push('');
      lines.push('Failures:');
      result.failures.forEach((f, idx) => {
        lines.push(`  [${idx + 1}] ${f.failureCode} (${f.criterion}): ${f.details}`);
      });
    }

    if (result.auditRecord?.auditHash) {
      lines.push('');
      lines.push(`Audit Hash: ${result.auditRecord.auditHash}`);
    }

    return lines.join('\n');
  }
}
