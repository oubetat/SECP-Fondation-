/**
 * SECP Industrial OS v2 — IGES Fidelity Gate
 * PATCH-037: IGES Fidelity
 */

import { IGESFidelityResult } from '../IGESFidelityTypes';

export class HardAcceptanceGateIGESFidelity {
  public static evaluate(result: IGESFidelityResult): {
    passed: boolean;
    verdict: string;
    findings: string[];
  } {
    const findings: string[] = [];
    let passed = false;

    if (result.verdict === 'INVALID') {
      findings.push('File format is invalid or unparsable');
      return { passed: false, verdict: 'INVALID', findings };
    }

    if (result.verdict === 'FAIL') {
      findings.push(`Fidelity failure detected`);
      result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR').forEach(i => {
        findings.push(`[${i.severity}] ${i.code}: ${i.message}`);
      });
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (result.verdict === 'UNPROVEN') {
      findings.push('Some entities were unsupported, fidelity is unproven');
      return { passed: false, verdict: 'UNPROVEN', findings };
    }

    if (result.verdict === 'PASS') {
      findings.push('IGES fidelity verified across Geometry, Topology, and Metadata');
      passed = true;
    }

    return {
      passed,
      verdict: result.verdict,
      findings
    };
  }
}
