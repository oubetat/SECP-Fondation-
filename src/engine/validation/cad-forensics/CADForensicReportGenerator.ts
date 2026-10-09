/**
 * SECP Industrial OS v2 — CAD Forensic Report Generator
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { CADForensicReport } from './CADForensicTypes';

export class CADForensicReportGenerator {
  public static generateMarkdown(report: CADForensicReport): string {
    let md = `# CAD Kernel Forensic Qualification Report\n\n`;
    md += `**Kernel Version:** ${report.kernelVersion}\n`;
    md += `**Timestamp:** ${report.timestamp}\n`;
    md += `**Gate Verdict:** ${report.gateVerdict}\n\n`;

    md += `## Summary\n`;
    md += `- **Proven:** ${report.summary.provenCount}\n`;
    md += `- **Partial:** ${report.summary.partialCount}\n`;
    md += `- **Unproven:** ${report.summary.unprovenCount}\n`;
    md += `- **Failed:** ${report.summary.failedCount}\n`;
    md += `- **Total Capabilities Evaluated:** ${report.summary.totalCount}\n\n`;

    md += `## Capability Matrix\n\n`;
    md += `| Capability | Implementation | Verdict | Verified | Evidence |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const entry of report.matrix) {
      md += `| ${entry.capability} | ${entry.implementation} | ${entry.verdict} | ${entry.verified ? 'YES' : 'NO'} | ${entry.evidence ? 'YES' : 'NO'} |\n`;
    }
    md += `\n`;

    md += `## Forensic Findings\n\n`;
    for (const finding of report.findings) {
      md += `### ${finding.caseId}\n`;
      md += `- **Verdict:** ${finding.verdict}\n`;
      md += `- **Execution Time:** ${finding.metrics.executionTimeMs}ms\n`;
      md += `- **Observations:**\n`;
      finding.observations.forEach(o => md += `  - ${o}\n`);
      if (finding.limitations.length > 0) {
        md += `- **Limitations:**\n`;
        finding.limitations.forEach(l => md += `  - ${l}\n`);
      }
      md += `\n`;
    }

    md += `\n---\n*End of Forensic Report*`;
    return md;
  }
}
