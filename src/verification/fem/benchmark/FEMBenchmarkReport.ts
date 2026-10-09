/**
 * PATCH-177: FEM Benchmark Report Generator
 * 
 * Generates machine-readable JSON (PATCH177_FEM_BENCHMARK_REPORT.json)
 * and human-readable Markdown (PATCH177_FEM_BENCHMARK_REPORT.md)
 */

import { FinalFEMBenchmarkReport } from './types';

export class FEMBenchmarkReportGenerator {
  /**
   * Generates formatted Markdown report string
   */
  public static generateMarkdownReport(report: FinalFEMBenchmarkReport): string {
    const date = report.timestamp;
    const gate = report.gateResult;

    let md = `# PATCH-177: FEM Benchmark Battery Final Report\n\n`;
    md += `**Timestamp:** ${date}\n`;
    md += `**Final Verdict:** \`${report.finalVerdict}\`\n`;
    md += `**Gate 177 Score:** \`${gate.score} / 100\`\n`;
    md += `**Attestation Signature:** \`${gate.attestationSignature}\`\n`;
    md += `**Determinism Verified:** \`${report.isDeterministic ? 'YES (100% Identical Execution Hashes)' : 'NO'}\` \n\n`;

    md += `---
`;
    md += `## 1. Summary Statistics\n\n`;
    md += `- **Total Benchmark Cases:** ${report.summary.totalCases}\n`;
    md += `- **Passed:** ${report.summary.passed}\n`;
    md += `- **Failed:** ${report.summary.failed}\n`;
    md += `- **Unproven:** ${report.summary.unproven}\n`;
    md += `- **Inconclusive:** ${report.summary.inconclusive}\n`;
    md += `- **Invalid / Rejected:** ${report.summary.invalid}\n\n`;

    md += `---
`;
    md += `## 2. Benchmark Case Results Table\n\n`;
    md += `| Benchmark | Result | Error (%) | Equilibrium Residual (N) | Convergence | Verdict |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const c of report.caseResults) {
      const errStr = c.metrics.displacementErrorPercent.toFixed(4) + '%';
      const equilStr = c.metrics.independentEquilibriumResidualN.toExponential(3) + ' N';
      const convStr = c.metrics.meshConvergenceTrend || 'CONVERGED';
      md += `| **${c.caseId}** (${c.caseName}) | ${c.verdict} | ${errStr} | ${equilStr} | ${convStr} | \`${c.verdict}\` |\n`;
    }

    md += `\n---\n`;
    md += `## 3. Adversarial Pathology Tests\n\n`;
    md += `| Test ID | Test Name | Attack Vector | Expected | Actual | Verdict |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const adv of report.adversarialResults) {
      md += `| **${adv.testId}** | ${adv.testName} | ${adv.attackVector} | ${adv.expectedVerdict} | ${adv.actualVerdict} | \`${adv.passed ? 'PASS' : 'FAIL'}\` |\n`;
    }

    md += `\n---\n`;
    md += `## 4. Gate 177 Criteria Compliance\n\n`;
    for (const crit of gate.criteriaResults) {
      md += `- **[${crit.passed ? 'PASS' : 'FAIL'}] ${crit.id}:** ${crit.name} (${crit.score}/12.5 pts)\n`;
      md += `  *${crit.details}*\n`;
    }

    md += `\n---\n`;
    md += `## 5. Anti-Fabrication & Evidence Audit\n\n`;
    md += `- **Hardcoded Values Detected:** ${report.antiFabricationAudit.hardcodedValuesDetected}\n`;
    md += `- **Hardcoded Runtime Detected:** ${report.antiFabricationAudit.hardcodedRuntimeDetected}\n`;
    md += `- **Mocked Solver Execution:** ${report.antiFabricationAudit.mockedSolverExecutionDetected}\n`;
    md += `- **Cached Result Reuse:** ${report.antiFabricationAudit.cachedResultReuseDetected}\n`;
    md += `- **Audit Verdict:** \`${report.antiFabricationAudit.auditVerdict}\` \n\n`;

    return md;
  }

  /**
   * Generates JSON string report
   */
  public static generateJsonReport(report: FinalFEMBenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }
}
