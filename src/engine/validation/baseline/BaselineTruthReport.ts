import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaselineTruthReportData, CapabilityBaselineRecord } from './BaselineTruthTypes';

export class BaselineTruthReport {
  /**
   * Save JSON report to reports/secp-baseline-truth.json
   */
  public static saveJsonReport(data: BaselineTruthReportData, outDir = 'reports'): string {
    const fullDir = path.resolve(process.cwd(), outDir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const filePath = path.join(fullDir, 'secp-baseline-truth.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Save Evidence JSON report to reports/secp-baseline-truth-evidence.json
   */
  public static saveEvidenceReport(
    data: BaselineTruthReportData,
    testResults: unknown[] = [],
    gateResult: unknown = {},
    outDir = 'reports'
  ): string {
    const fullDir = path.resolve(process.cwd(), outDir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const evidenceData = {
      patch: 'PATCH-007',
      generatedAt: data.generatedAt,
      report: 'reports/secp-baseline-truth.json',
      tests: testResults,
      gate: gateResult,
      findings: data.criticalFindings,
      summary: data.summary,
      evidenceCoverage: data.evidenceCoverage
    };

    const filePath = path.join(fullDir, 'secp-baseline-truth-evidence.json');
    fs.writeFileSync(filePath, JSON.stringify(evidenceData, null, 2), 'utf8');
    return filePath;
  }

  /**
   * Generate Markdown report and save to reports/SECP_BASELINE_TRUTH_REPORT.md
   */
  public static generateMarkdownReport(data: BaselineTruthReportData, outDir = 'reports'): string {
    const fullDir = path.resolve(process.cwd(), outDir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const formatCaps = (caps: CapabilityBaselineRecord[]) => {
      if (caps.length === 0) return '_None identified._\n';
      return caps
        .map(
          (c) =>
            `- **[${c.domain}] ${c.capability}** (Confidence: \`${c.confidence}\`)\n` +
            `  - Sources: ${c.provenance.sourceFiles.join(', ') || 'None'}\n` +
            `  - Limitations: ${c.limitations.join('; ') || 'None'}`
        )
        .join('\n\n');
    };

    const working = data.capabilities.filter((c) => c.status === 'WORKING');
    const failed = data.capabilities.filter((c) => c.status === 'FAILED');
    const unproven = data.capabilities.filter((c) => c.status === 'UNPROVEN');
    const simulated = data.capabilities.filter((c) => c.status === 'SIMULATED');
    const prodReady = data.capabilities.filter((c) => c.status === 'PRODUCTION_READY');

    const totalCapabilities = data.capabilities.length;

    const md = `# SECP Industrial OS v2
# Baseline Truth Report

_Generated At: ${data.generatedAt}_
_Schema Version: ${data.schemaVersion}_

---

## Executive Summary
This document provides the canonical **Phase 0 Baseline Truth Report** for SECP Industrial OS v2.
In accordance with non-negotiable engineering rules, capability claims are based exclusively on verified physical, mathematical, and algorithmic evidence. 
The presence of source files, classes, or test fixtures does **not** constitute proof of production readiness.

### Capability Status Breakdown
- **PRODUCTION_READY**: ${data.summary.productionReady} / ${totalCapabilities}
- **WORKING**: ${data.summary.working} / ${totalCapabilities}
- **UNPROVEN**: ${data.summary.unproven} / ${totalCapabilities}
- **SIMULATED**: ${data.summary.simulated} / ${totalCapabilities}
- **FAILED**: ${data.summary.failed} / ${totalCapabilities}

---

## WHAT WORKS
Capabilities with verified source implementation, executable logic, and measurable outputs:

${formatCaps(working)}

---

## WHAT FAILS
Capabilities where actual execution or automated validation encountered reproducible failures:

${formatCaps(failed)}

---

## WHAT IS UNPROVEN
Capabilities with partial implementations or unverified assumptions lacking complete multi-pass verification chains:

${formatCaps(unproven)}

---

## WHAT IS SIMULATED
Capabilities containing synthetic workloads, mock fixtures, or demonstration-only logic:

${formatCaps(simulated)}

---

## WHAT IS PRODUCTION-READY
Capabilities meeting the full standard of production truth: genuine execution, repeatable verification, failure handling, automated tests, adversarial resistance, cryptographic provenance, and documented limitations:

${formatCaps(prodReady)}

---

## Critical Findings
${
  data.criticalFindings.length > 0
    ? data.criticalFindings.map((f) => `- ${f}`).join('\n')
    : '- No unhandled critical findings detected during automated discovery.'
}

---

## Evidence Coverage
- **Source Implementation References**: ${data.evidenceCoverage.implementation}
- **Execution References**: ${data.evidenceCoverage.execution}
- **Test & Gate Verification References**: ${data.evidenceCoverage.tests}
- **Adversarial & Perturbation References**: ${data.evidenceCoverage.adversarial}
- **External Benchmarks**: ${data.evidenceCoverage.externalValidation}

---

## Known Limitations
${
  data.limitations.length > 0
    ? data.limitations.map((l) => `- ${l}`).join('\n')
    : '- No global limitations declared.'
}

---

## Missing Evidence
1. **3D Continuum Navier-Stokes Solvers**: Boundary-flux mass conservation requires MMS (Method of Manufactured Solutions) verification under high Reynolds numbers.
2. **CAD Non-Manifold B-Rep Stitching**: Healing of degenerate edge curves and micro-gap stitching on dirty STEP AP242 imports requires topological stress-testing.
3. **Multithreaded / WebAssembly HPC Scaling**: Strong and weak scaling benchmarks on distributed clusters require hardware attestation.

---

## Recommended Next Verification Steps
1. Implement independent CleanRoom verification for all CFD flux boundary conditions.
2. Expand adversarial fault-injection suites to CAD B-Rep topological boolean operations.
3. Parameterize all stochastic routines with seeded deterministic PRNGs.
4. Establish cryptographic ledger attestation across all engineering decision gates.
`;

    const filePath = path.join(fullDir, 'SECP_BASELINE_TRUTH_REPORT.md');
    fs.writeFileSync(filePath, md, 'utf8');
    return filePath;
  }
}
