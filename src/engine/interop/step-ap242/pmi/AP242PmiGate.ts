/**
 * SECP Industrial OS v2 — AP242 PMI Gate
 * PATCH-035: AP242 PMI
 */

import { PmiValidationResult, PmiFidelityReport } from './AP242PmiTypes';

export class AP242PmiGate {
  public static evaluate(
    validations: PmiValidationResult[], 
    fidelity: PmiFidelityReport
  ): {
    passed: boolean;
    verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
    findings: string[];
  } {
    const findings: string[] = [];

    const invalidPmis = validations.filter(v => v.status === 'INVALID');
    if (invalidPmis.length > 0) {
      findings.push(`Validation failed for ${invalidPmis.length} PMI objects`);
      return { passed: false, verdict: 'INVALID', findings };
    }

    if (!fidelity) {
      findings.push('No fidelity report provided');
      return { passed: false, verdict: 'UNPROVEN', findings };
    }

    // Must have successfully preserved at least some semantic PMI if any existed
    if (fidelity.totalPmi > 0 && fidelity.semanticPreserved === 0 && fidelity.graphicalPreserved === 0) {
      findings.push('Complete loss of PMI data during round-trip');
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (fidelity.criticalPmiLosses.length > 0) {
      findings.push(`Critical PMI loss detected: ${fidelity.criticalPmiLosses.join(', ')}`);
      return { passed: false, verdict: 'FAIL', findings };
    }

    if (fidelity.verdict === 'DEGRADED') {
      findings.push(`PMI fidelity degraded: ratio ${fidelity.fidelityRatio}`);
      return { passed: false, verdict: 'INCONCLUSIVE', findings };
    }

    if (fidelity.verdict === 'LOSS_DETECTED') {
      findings.push('Loss detected in non-critical PMI');
      return { passed: false, verdict: 'FAIL', findings };
    }

    // Ensure we actually checked something and aren't just passing 0 objects
    if (fidelity.totalPmi === 0) {
      findings.push('No PMI evaluated, capability unproven');
      return { passed: false, verdict: 'UNPROVEN', findings };
    }

    return {
      passed: true,
      verdict: 'PASS',
      findings
    };
  }
}
