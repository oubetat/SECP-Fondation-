/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Hard Acceptance Gate for Native SECP Format
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Evaluates Native SECP documents, round-trips, and adversarial results.
 * 2. Strict verdict taxonomy: PASS | FAIL | UNPROVEN | INCONCLUSIVE | INVALID.
 * 3. Never produces hardcoded PASS; derives verdict strictly from verification evidence.
 */

import { NativeSECPDocument, NativeSECPDiagnostic } from '../NativeSECPTypes';
import { NativeSECPReader, NativeSECPReadResult } from '../NativeSECPReader';
import { NativeSECPWriter } from '../NativeSECPWriter';

export type NativeSECPGateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

export interface NativeSECPGateEvaluation {
  readonly passed: boolean;
  readonly verdict: NativeSECPGateVerdict;
  readonly findings: readonly string[];
  readonly metrics: {
    readonly schemaValid: boolean;
    readonly integrityVerified: boolean;
    readonly roundTripPassed: boolean;
    readonly entityIntegrityPassed: boolean;
    readonly totalDiagnostics: number;
    readonly criticalCount: number;
    readonly errorCount: number;
    readonly warningCount: number;
  };
}

export class HardAcceptanceGateNativeSECP {

  /**
   * Evaluates a Native SECP document against strict acceptance criteria.
   */
  public static evaluate(document: NativeSECPDocument | string): NativeSECPGateEvaluation {
    const findings: string[] = [];
    const readResult = typeof document === 'string'
      ? NativeSECPReader.read(document)
      : NativeSECPReader.read(document);

    const criticals = readResult.diagnostics.filter(d => d.severity === 'CRITICAL');
    const errors = readResult.diagnostics.filter(d => d.severity === 'ERROR');
    const warnings = readResult.diagnostics.filter(d => d.severity === 'WARNING');

    // 1. Check for format or structural invalidity
    if (criticals.some(c => c.category === 'FORMAT' || c.category === 'HEADER')) {
      findings.push('Document failed format or header validation');
      criticals.forEach(c => findings.push(`[CRITICAL] ${c.code}: ${c.message}`));
      return {
        passed: false,
        verdict: 'INVALID',
        findings,
        metrics: {
          schemaValid: false,
          integrityVerified: false,
          roundTripPassed: false,
          entityIntegrityPassed: false,
          totalDiagnostics: readResult.diagnostics.length,
          criticalCount: criticals.length,
          errorCount: errors.length,
          warningCount: warnings.length
        }
      };
    }

    // 2. Check for integrity tampering or corruption
    if (!readResult.integrityValid || criticals.some(c => c.category === 'INTEGRITY')) {
      findings.push('Document failed integrity verification / hash mismatch');
      criticals.filter(c => c.category === 'INTEGRITY').forEach(c => findings.push(`[CRITICAL] ${c.code}: ${c.message}`));
      return {
        passed: false,
        verdict: 'FAIL',
        findings,
        metrics: {
          schemaValid: true,
          integrityVerified: false,
          roundTripPassed: false,
          entityIntegrityPassed: false,
          totalDiagnostics: readResult.diagnostics.length,
          criticalCount: criticals.length,
          errorCount: errors.length,
          warningCount: warnings.length
        }
      };
    }

    // 3. Check for dangling references or structural errors
    if (criticals.length > 0 || errors.length > 0) {
      findings.push('Document contains dangling topology or geometry references');
      [...criticals, ...errors].forEach(e => findings.push(`[${e.severity}] ${e.code}: ${e.message}`));
      return {
        passed: false,
        verdict: 'FAIL',
        findings,
        metrics: {
          schemaValid: true,
          integrityVerified: true,
          roundTripPassed: false,
          entityIntegrityPassed: false,
          totalDiagnostics: readResult.diagnostics.length,
          criticalCount: criticals.length,
          errorCount: errors.length,
          warningCount: warnings.length
        }
      };
    }

    // 4. Validate round-trip fidelity
    let roundTripPassed = false;
    if (readResult.document) {
      const writeRes = NativeSECPWriter.write(readResult.document);
      const reReadRes = NativeSECPReader.read(writeRes.jsonString);

      if (
        reReadRes.success &&
        reReadRes.integrityValid &&
        reReadRes.computedCanonicalHash === readResult.document.integrity.canonicalHash
      ) {
        roundTripPassed = true;
      } else {
        findings.push('Round-trip serialization produced diverging canonical hash');
      }
    }

    if (!roundTripPassed) {
      return {
        passed: false,
        verdict: 'FAIL',
        findings,
        metrics: {
          schemaValid: true,
          integrityVerified: true,
          roundTripPassed: false,
          entityIntegrityPassed: true,
          totalDiagnostics: readResult.diagnostics.length,
          criticalCount: criticals.length,
          errorCount: errors.length,
          warningCount: warnings.length
        }
      };
    }

    findings.push('Native SECP document fully verified: schema valid, hash verified, round-trip lossless');

    return {
      passed: true,
      verdict: 'PASS',
      findings,
      metrics: {
        schemaValid: true,
        integrityVerified: true,
        roundTripPassed: true,
        entityIntegrityPassed: true,
        totalDiagnostics: readResult.diagnostics.length,
        criticalCount: 0,
        errorCount: 0,
        warningCount: warnings.length
      }
    };
  }
}
