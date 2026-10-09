/**
 * SECP Industrial OS v2 — JT Fidelity Gate
 * PATCH-038: JT Fidelity
 */

import { JTFidelityResult } from '../interop/jt-fidelity/JTFidelityTypes';

export class HardAcceptanceGateJTFidelity {
  public static evaluate(result: JTFidelityResult): {
    passed: boolean;
    verdict: string;
    findings: string[];
  } {
    const findings: string[] = [];
    let passed = false;

    if (result.verdict === 'INVALID') {
      findings.push('JT File format is invalid or corrupted');
      return { passed: false, verdict: 'INVALID', findings };
    }

    if (result.verdict === 'FAIL') {
      findings.push('JT Fidelity failure detected');
      result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR').forEach(i => {
        findings.push(`[${i.severity}] ${i.code}: ${i.message}`);
      });
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (result.verdict === 'UNPROVEN') {
      findings.push('JT Fidelity is unproven due to unsupported entities or missing capabilities');
      return { passed: false, verdict: 'UNPROVEN', findings };
    }

    if (result.verdict === 'PASS') {
      findings.push('JT Fidelity verified for all supported capabilities');
      passed = true;
    }

    return {
      passed,
      verdict: result.verdict,
      findings
    };
  }
}
