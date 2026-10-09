/**
 * SECP Industrial OS v2 — GCS Hard Acceptance Gate 173 Evaluator
 * Phase 15 (PATCH-173)
 */

import { GCSBatteryReport } from './types';

export interface HardGate173Report {
  verdict: 'PASS' | 'FAIL';
  batteryReport?: any;
  overallPassed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    description: string;
  }>;
  summary: string;
}

export class HardAcceptanceGate173 {
  public static evaluateGate(report: GCSBatteryReport): HardGate173Report {
    // Fail closed if report or mandatory evidence is missing or malformed
    if (!report || !report.evidenceLedger || !Array.isArray(report.evidenceLedger) || report.evidenceLedger.length === 0 || !report.mutationReport) {
      return {
        verdict: 'FAIL',
        overallPassed: false,
        checks: [
          {
            name: 'Report Structural Integrity',
            passed: false,
            description: 'Mandatory battery report, evidence ledger, or mutation report is missing or malformed.'
          }
        ],
        summary: 'Hard Acceptance Gate 173 FAIL_CLOSED: Incomplete or missing forensic evidence.'
      };
    }

    const checks = [
      {
        name: 'GCS Solver Pass Rate',
        passed: report.passRatePercent === 100 && report.totalCases >= 18 && report.evidenceLedger.length >= 18 && report.evidenceLedger.every(e => e.verdict === 'PASS'),
        description: 'All basic, over-constrained, and multi-scale benchmark cases must pass.'
      },
      {
        name: 'Solver Numerical Determinism',
        passed: report.nonDeterministicCount === 0 && report.determinismScore === 100 && report.evidenceLedger.every(e => e.determinismResult?.isDeterministic === true),
        description: 'Zero drift/variance in solver outputs across consecutive runs.'
      },
      {
        name: 'Adversarial Mutation Detection',
        passed: report.mutationReport.mutationsInjected > 0 && report.mutationReport.mutationsDetected === report.mutationReport.mutationsInjected,
        description: 'All injected geometric anomalies must be flagged by the GCS independent oracle.'
      },
      {
        name: 'Oracle Robustness / False Acceptance Rate',
        passed: report.mutationReport.falseAcceptanceCount === 0,
        description: 'Oracle must never allow anomalous or corrupted states to pass.'
      },
      {
        name: 'Solver Scalability & Stress Performance',
        passed: Array.isArray(report.stressReport) && report.stressReport.length > 0 && report.stressReport.every(r => r.failures === 0 && r.timeouts === 0),
        description: 'Solver executes high-density layouts without memory leaks, crashes, or timeouts.'
      },
      {
        name: 'Inconsistency/Contradiction Resolution',
        passed: report.failedCount === 0 && report.inconsistentCount > 0,
        description: 'Contradictory and conflicting constraint graphs must be flagged as INCONSISTENT/CONFLICTING.'
      },
      {
        name: 'Geometric Fidelity',
        passed: report.geometricVerificationScore === 100 && report.evidenceLedger.every(e => e.expectedState === 'INCONSISTENT' || e.expectedState === 'OVER_CONSTRAINED' || (e.geometricValidation?.satisfied === true && e.residual <= 1e-4)),
        description: 'All valid solved configurations must achieve independent geometric verification.'
      },
      {
        name: 'Execution Liveness & Anti-Timeout Guard',
        passed: report.timeoutCount === 0 && report.evidenceLedger.every(e => e.verdict !== 'TIMEOUT'),
        description: 'Zero test runs must hit the execution limits or time out.'
      }
    ];

    const overallPassed = checks.every(c => c.passed);

    return {
      verdict: overallPassed ? 'PASS' : 'FAIL',
      batteryReport: report,
      overallPassed,
      checks,
      summary: overallPassed
        ? 'GCS solver passed 3D benchmark suite and met all Hard Acceptance Gate 173 criteria.'
        : 'GCS solver failed to meet all Hard Acceptance Gate 173 criteria.'
    };
  }
}
