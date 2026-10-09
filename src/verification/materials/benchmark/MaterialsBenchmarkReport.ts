/**
 * PATCH-178: Materials Benchmark Report Generator
 *
 * Generates official JSON and Markdown benchmark reports with complete case breakdown,
 * evidence ledger references, and gate criteria evaluation.
 */

import { MaterialsBenchmarkSuiteReport } from './types';

export class MaterialsBenchmarkReportGenerator {
  /**
   * Generates the complete Markdown report content.
   */
  public static generateMarkdownReport(report: MaterialsBenchmarkSuiteReport): string {
    const lines: string[] = [];

    lines.push('# PATCH-178: Materials Benchmark & Gate 178 Official Report');
    lines.push(`**Executed At:** ${report.timestamp}`);
    lines.push(`**Gate ID:** ${report.gateResult.gateId}`);
    lines.push(`**Gate Score:** ${report.gateResult.score.toFixed(2)} / 100.00`);
    lines.push(`**Final Gate Verdict:** \`${report.gateResult.finalVerdict}\``);
    lines.push(`**Attestation Signature:** \`${report.gateResult.attestationSignature}\``);
    lines.push(`**Evidence Ledger Entry:** \`${report.evidenceLedgerId}\``);
    lines.push('');

    lines.push('---');
    lines.push('## Executive Summary Table');
    lines.push('');
    lines.push('| Benchmark | Material | Reference | Measured | Error | Verdict |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

    report.caseResults.forEach((c) => {
      const refVal = c.metrics.referenceValue.toExponential(4);
      const measVal = c.metrics.measuredValue.toExponential(4);
      const errStr = `${c.metrics.relativeErrorPercent.toFixed(4)}%`;
      const verdictStr = `**${c.verdict}**`;

      lines.push(
        `| ${c.caseId}: ${c.caseName} | ${c.materialName} | ${refVal} ${c.metrics.unit} | ${measVal} ${c.metrics.unit} | ${errStr} | ${verdictStr} |`
      );
    });

    lines.push('');
    lines.push('---');
    lines.push('## Gate 178 Criteria Evaluation');
    lines.push('');
    lines.push('| Criterion ID | Name | Score | Verdict | Details |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');

    report.gateResult.criteriaResults.forEach((crit) => {
      lines.push(
        `| ${crit.id} | ${crit.name} | ${crit.score.toFixed(2)} | **${crit.verdict}** | ${crit.details} |`
      );
    });

    lines.push('');
    lines.push('---');
    lines.push('## Anti-Fabrication & Truth Audit Summary');
    lines.push('');
    lines.push(`- **Audit Status:** ${report.auditSummary.passed ? 'PASSED' : 'FAILED'}`);
    lines.push(`- **Violations Detected:** ${report.auditSummary.violationsCount}`);
    if (report.auditSummary.details.length > 0) {
      lines.push('- **Details:**');
      report.auditSummary.details.forEach((d) => lines.push(`  - ${d}`));
    }

    lines.push('');
    lines.push('---');
    lines.push('## Adversarial Testing Battery');
    lines.push('');
    lines.push('| Test ID | Description | Verdict | Details |');
    lines.push('| :--- | :--- | :--- | :--- |');

    report.adversarialResults.forEach((adv) => {
      lines.push(
        `| ${adv.testId} | ${adv.description} | **${adv.verdict}** | ${adv.details} |`
      );
    });

    lines.push('');
    lines.push('---');
    lines.push('**End of Official Materials Benchmark Verification Report (PATCH-178)**');

    return lines.join('\n');
  }

  /**
   * Generates JSON report representation.
   */
  public static generateJsonReport(report: MaterialsBenchmarkSuiteReport): string {
    return JSON.stringify(report, null, 2);
  }
}
