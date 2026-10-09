/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-012: Evidence Dependency Verifier
 */

import { EngineeringEvidence, EvidenceDependency } from './EngineeringEvidenceTypes';
import { VerificationCheck } from './EvidenceVerificationTypes';

export class EvidenceDependencyVerifier {
  /**
   * Verifies declared dependencies.
   */
  public static verify(evidence: EngineeringEvidence): VerificationCheck {
    const dependencies = evidence.inputs;

    if (!dependencies || dependencies.length === 0) {
      return {
        status: 'PASS',
        executed: true,
        reason: 'No dependencies declared'
      };
    }

    const checks: string[] = [];
    let cycleDetected = false;

    for (const dep of dependencies) {
      // 1. Identity check
      if (!dep.artifactId || !dep.artifactType) {
        return {
          status: 'INVALID',
          executed: true,
          reason: `Malformed dependency: ${dep.dependencyId}`
        };
      }

      // 2. Hash check
      if (!dep.canonicalHash || dep.canonicalHash.length !== 64) {
        return {
          status: 'FAIL',
          executed: true,
          reason: `Invalid hash for dependency: ${dep.artifactId}`
        };
      }

      // 3. Simple Cycle Detection (within the immediate dependency list)
      // If the artifact ID of the evidence itself is in its own dependency list
      if (dep.artifactId === evidence.artifact.artifactId) {
        cycleDetected = true;
      }
    }

    if (cycleDetected) {
      return {
        status: 'FAIL',
        executed: true,
        reason: 'DEPENDENCY_CYCLE_DETECTED: Evidence references itself as dependency'
      };
    }

    // Since we don't have a global artifact repository to fetch and verify the actual dependencies yet,
    // we mark the verification as UNPROVEN if we can't fully "resolve" them.
    // However, if we're just checking the *list* for internal consistency:
    
    return {
      status: 'UNPROVEN',
      executed: true,
      reason: 'Deep dependency resolution and validation not yet available in this runtime',
      observed: `${dependencies.length} dependencies declared`
    };
  }
}
