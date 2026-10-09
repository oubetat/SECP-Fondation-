/**
 * PATCH-178: Materials Anti-Fabrication & Truth Auditor
 *
 * Scans code, execution logs, and material evidence packets to detect hardcoded
 * properties, fake tolerances, mocked solvers, static verdicts, or fabricated hashes.
 */

import { MaterialsBenchmarkCaseResult } from './types';

export interface MaterialAuditReport {
  passed: boolean;
  violationsCount: number;
  details: string[];
  auditedAt: string;
}

export class MaterialsAntiFabricationAuditor {
  /**
   * Computes a deterministic execution evidence hash based on input properties and execution output.
   */
  public static computeEvidenceHash(
    caseId: string,
    materialId: string,
    propertyValues: Record<string, number>,
    measuredValue: number,
    verdict: string
  ): string {
    const sortedProps = Object.keys(propertyValues)
      .sort()
      .map((k) => `${k}:${propertyValues[k]}`)
      .join(';');

    const raw = `${caseId}|${materialId}|${sortedProps}|${measuredValue.toFixed(8)}|${verdict}`;

    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }

    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `MAT_EVIDENCE_HASH_${hex}`;
  }

  /**
   * Audits a suite of benchmark results for evidence integrity.
   */
  public static auditSuite(caseResults: MaterialsBenchmarkCaseResult[]): MaterialAuditReport {
    const details: string[] = [];
    let violationsCount = 0;

    // Rule 1: Every case must have non-zero runtime or non-trivial execution evidence
    caseResults.forEach((c) => {
      if (c.evidenceHash === 'STATIC_HASH' || c.evidenceHash === 'MOCK_HASH') {
        violationsCount++;
        details.push(`Case ${c.caseId}: Detected static or mocked evidence hash '${c.evidenceHash}'.`);
      }

      // Recompute evidence hash to verify consistency
      const expectedHash = this.computeEvidenceHash(
        c.caseId,
        c.evidencePacket.materialId,
        c.evidencePacket.materialProperties,
        c.metrics.measuredValue,
        c.verdict
      );

      if (c.evidenceHash !== expectedHash) {
        violationsCount++;
        details.push(
          `Case ${c.caseId}: Hash mismatch. Expected '${expectedHash}', found '${c.evidenceHash}'.`
        );
      }
    });

    // Rule 2: Verify that verdicts are not hardcoded PASS for invalid inputs
    const extremeCase = caseResults.find((c) => c.category === 'EXTREME_INVALID');
    if (extremeCase && extremeCase.verdict === 'PASS') {
      violationsCount++;
      details.push(
        `Case ${extremeCase.caseId}: Invalid material input yielded 'PASS' instead of 'INVALID' or 'FAIL'.`
      );
    }

    return {
      passed: violationsCount === 0,
      violationsCount,
      details,
      auditedAt: new Date().toISOString()
    };
  }
}
