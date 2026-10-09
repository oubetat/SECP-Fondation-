/**
 * SECP Industrial OS v2 — AP242 Validation Hard Acceptance Gate
 * PATCH-036: AP242 Validation
 */

import { AP242ValidationResult } from './AP242ValidationTypes';

export class HardAcceptanceGateAP242Validation {
  public static evaluate(result: AP242ValidationResult): {
    passed: boolean;
    verdict: string;
    findings: string[];
  } {
    const findings: string[] = [];
    let passed = false;

    if (result.verdict === 'INVALID') {
      findings.push('File is invalid or unparsable');
      return { passed: false, verdict: 'INVALID', findings };
    }

    if (result.verdict === 'FAIL') {
      findings.push(`Validation failed with ${result.issues.length} issues`);
      result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR').forEach(i => {
        findings.push(`[${i.severity}] ${i.code}: ${i.message}`);
      });
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (result.verdict === 'UNPROVEN') {
      findings.push('File schema or capabilities are unproven in SECP');
      return { passed: false, verdict: 'UNPROVEN', findings };
    }

    if (result.verdict === 'PASS') {
      // Must check that we actually validated things
      if (result.entityCount === 0) {
         findings.push('Passed but zero entities found (Inconclusive)');
         return { passed: false, verdict: 'INCONCLUSIVE', findings };
      }
      if (!result.checks.header || !result.checks.references || !result.checks.consistency) {
         findings.push('Passed but missing critical checks');
         return { passed: false, verdict: 'INCONCLUSIVE', findings };
      }
      
      findings.push('All checks passed successfully');
      passed = true;
    }

    return {
      passed,
      verdict: result.verdict,
      findings
    };
  }
}
