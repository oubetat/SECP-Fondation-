/**
 * SECP Industrial OS v2 — STEP AP242 Native Gate
 * PATCH-034: STEP AP242 Native Pipeline
 */

import { StepAp242PipelineResult } from './StepAp242Types';

export class StepAp242NativeGate {
  public static evaluate(result: StepAp242PipelineResult): {
    passed: boolean;
    verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
    findings: string[];
  } {
    const findings: string[] = [];

    if (result.validation.status !== 'VALID') {
      findings.push(`Input validation failed: ${result.validation.errors.join(', ')}`);
      return { passed: false, verdict: 'INVALID', findings };
    }

    if (!result.validation.referenceIntegrity) {
      findings.push('Reference integrity check failed (dangling references detected)');
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (!result.fidelity) {
      return { passed: false, verdict: 'UNPROVEN', findings: ['No fidelity report generated'] };
    }

    const highSeverityLoss = result.fidelity.lossReports.some(l => l.severity === 'CRITICAL' || l.severity === 'HIGH');
    if (highSeverityLoss) {
      findings.push('High severity geometric or topological loss detected during mapping/round-trip');
      return { passed: false, verdict: 'FAIL', findings };
    }

    let verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID' = 'PASS';
    if (result.fidelity.verdict === 'DEGRADED') {
      verdict = 'INCONCLUSIVE';
      findings.push('Model fidelity degraded during round-trip comparison');
    }

    return {
      passed: verdict === 'PASS',
      verdict,
      findings
    };
  }
}
