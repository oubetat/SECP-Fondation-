/**
 * SECP CAD Kernel — Predicate Serializer & Evidence Lineage
 * Phase 2 (PATCH-018)
 */
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { GeometricPredicateResult } from './PredicateContracts';

export class PredicateSerializer {
  /**
   * Deterministically serializes a predicate execution for audit logging and hash chains.
   */
  public static serializePredicateExecution(
    predicateName: string,
    inputs: Record<string, any>,
    result: GeometricPredicateResult<any, any>
  ): string {
    const payload = {
      predicate: predicateName,
      inputs: this.sanitizeInputs(inputs),
      result: {
        classification: result.classification,
        value: result.value,
        semantics: result.semantics,
        diagnostics: result.diagnostics
      }
    };

    const res = CanonicalSerializer.serialize(payload);
    return res.canonicalString;
  }

  /**
   * Computes a canonical SHA-256 hash of a predicate execution.
   */
  public static hashPredicateExecution(
    predicateName: string,
    inputs: Record<string, any>,
    result: GeometricPredicateResult<any, any>
  ): string {
    const payload = {
      predicate: predicateName,
      inputs: this.sanitizeInputs(inputs),
      result: {
        classification: result.classification,
        value: result.value,
        semantics: result.semantics,
        diagnostics: result.diagnostics
      }
    };

    const canonicalRes = EngineeringHashChain.computeCanonicalHash(payload);
    return canonicalRes.canonicalHash;
  }

  private static sanitizeInputs(inputs: Record<string, any>): Record<string, any> {
    if (!inputs || typeof inputs !== 'object') return {};
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'function') continue;
      sanitized[key] = val;
    }
    return sanitized;
  }
}
