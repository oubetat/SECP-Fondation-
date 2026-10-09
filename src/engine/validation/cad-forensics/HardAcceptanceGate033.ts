/**
 * SECP Industrial OS v2 — Hard Acceptance Gate 033
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { CADForensicReport, CADCapabilityMatrixEntry } from './CADForensicTypes';

export class HardAcceptanceGate033 {
  public static evaluateGate(report: CADForensicReport): {
    passed: boolean;
    verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
    findings: string[];
    missingBatteries: string[];
  } {
    const findings: string[] = [];
    const missingBatteries: string[] = [];

    const capabilities = report.matrix.map(m => m.capability);
    
    const requiredBatteries = [
      'Geometry',
      'Topology',
      'Modeling',
      'Assembly',
      'Boolean',
      'GCS',
      'B-Rep',
      'Tolerance',
      'Interoperability'
    ];

    for (const req of requiredBatteries) {
      if (!capabilities.includes(req)) {
        missingBatteries.push(req);
      }
    }

    // Check for hardcoded PASS or fabricated metrics (Simulated detection)
    // In real gate, we would audit the code or evidence hashes
    const fabricatedMetrics = report.findings.some(f => f.metrics.executionTimeMs < 0);
    if (fabricatedMetrics) {
      findings.push('Detected fabricated metrics (negative execution time)');
    }

    const hasFailed = report.summary.failedCount > 0;
    if (hasFailed) {
      findings.push(`Qualification failed with ${report.summary.failedCount} failures.`);
    }

    const allTested = requiredBatteries.every(b => capabilities.includes(b));
    
    let verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID' = 'PASS';

    if (missingBatteries.length > 0) {
      verdict = 'UNPROVEN';
      findings.push(`Missing coverage for: ${missingBatteries.join(', ')}`);
    }

    if (hasFailed) {
      verdict = 'FAIL';
    }

    return {
      passed: verdict === 'PASS',
      verdict,
      findings,
      missingBatteries
    };
  }
}
