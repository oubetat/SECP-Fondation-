import { CanonicalCollisionResult } from '../types';
import { CanonicalResultEquivalenceResult } from './types';

export class CanonicalCollisionResultEquivalence {
  public static evaluate(
    a: CanonicalCollisionResult,
    b: CanonicalCollisionResult
  ): CanonicalResultEquivalenceResult {
    const mismatches: string[] = [];
    const operationalDiffs: string[] = [];

    if (!a || !b) {
      return {
        isEquivalent: false,
        mismatches: ['One or both results are null/undefined'],
        operationalDiffs: []
      };
    }

    if (a.executionId !== b.executionId) {
      operationalDiffs.push(`executionId diff: '${a.executionId}' vs '${b.executionId}'`);
    }
    if (a.timestampIso !== b.timestampIso) {
      operationalDiffs.push(`timestampIso diff: '${a.timestampIso}' vs '${b.timestampIso}'`);
    }

    if (a.status !== b.status) {
      mismatches.push(`status mismatch: '${a.status}' vs '${b.status}'`);
    }
    if (a.severity !== b.severity) {
      mismatches.push(`severity mismatch: '${a.severity}' vs '${b.severity}'`);
    }
    if (a.exactness !== b.exactness) {
      mismatches.push(`exactness mismatch: '${a.exactness}' vs '${b.exactness}'`);
    }
    if (a.provenSafe !== b.provenSafe) {
      mismatches.push(`provenSafe mismatch: '${a.provenSafe}' vs '${b.provenSafe}'`);
    }

    if (!CanonicalCollisionResultEquivalence.areNumbersEquivalent(a.metrics?.minClearanceMm, b.metrics?.minClearanceMm)) {
      mismatches.push(`minClearanceMm mismatch: ${a.metrics?.minClearanceMm} vs ${b.metrics?.minClearanceMm}`);
    }
    if (!CanonicalCollisionResultEquivalence.areNumbersEquivalent(a.metrics?.maxPenetrationDepthMm, b.metrics?.maxPenetrationDepthMm)) {
      mismatches.push(`maxPenetrationDepthMm mismatch: ${a.metrics?.maxPenetrationDepthMm} vs ${b.metrics?.maxPenetrationDepthMm}`);
    }
    if (!CanonicalCollisionResultEquivalence.areNumbersEquivalent(a.metrics?.volumetricInterferenceMm3, b.metrics?.volumetricInterferenceMm3)) {
      mismatches.push(`volumetricInterferenceMm3 mismatch: ${a.metrics?.volumetricInterferenceMm3} vs ${b.metrics?.volumetricInterferenceMm3}`);
    }

    if (a.temporalInfo?.timeOfImpactNormalized !== b.temporalInfo?.timeOfImpactNormalized) {
      mismatches.push(`timeOfImpactNormalized mismatch: ${a.temporalInfo?.timeOfImpactNormalized} vs ${b.temporalInfo?.timeOfImpactNormalized}`);
    }
    if (a.temporalInfo?.criticalSubStepIndex !== b.temporalInfo?.criticalSubStepIndex) {
      mismatches.push(`criticalSubStepIndex mismatch: ${a.temporalInfo?.criticalSubStepIndex} vs ${b.temporalInfo?.criticalSubStepIndex}`);
    }

    if (a.failureState?.isFailed !== b.failureState?.isFailed) {
      mismatches.push(`isFailed mismatch: ${a.failureState?.isFailed} vs ${b.failureState?.isFailed}`);
    }
    if (a.failureState?.failureReason !== b.failureState?.failureReason) {
      mismatches.push(`failureReason mismatch: '${a.failureState?.failureReason}' vs '${b.failureState?.failureReason}'`);
    }
    if (a.failureState?.exceptionType !== b.failureState?.exceptionType) {
      mismatches.push(`exceptionType mismatch: '${a.failureState?.exceptionType}' vs '${b.failureState?.exceptionType}'`);
    }

    if (a.provenance?.cadDocumentRevisionId !== b.provenance?.cadDocumentRevisionId) {
      mismatches.push(`cadDocumentRevisionId mismatch: '${a.provenance?.cadDocumentRevisionId}' vs '${b.provenance?.cadDocumentRevisionId}'`);
    }
    if (a.provenance?.geometryHash !== b.provenance?.geometryHash) {
      mismatches.push(`geometryHash mismatch: '${a.provenance?.geometryHash}' vs '${b.provenance?.geometryHash}'`);
    }
    if (a.provenance?.algorithmVersion !== b.provenance?.algorithmVersion) {
      mismatches.push(`algorithmVersion mismatch: '${a.provenance?.algorithmVersion}' vs '${b.provenance?.algorithmVersion}'`);
    }

    const contactsA = a.contactManifold || [];
    const contactsB = b.contactManifold || [];
    if (contactsA.length !== contactsB.length) {
      mismatches.push(`contactManifold length mismatch: ${contactsA.length} vs ${contactsB.length}`);
    } else {
      for (let i = 0; i < contactsA.length; i++) {
        const cA = contactsA[i];
        const cB = contactsB[i];
        if (cA.entityIdA !== cB.entityIdA || cA.entityIdB !== cB.entityIdB) {
          mismatches.push(`contact [${i}] entity pair mismatch: ${cA.entityIdA}-${cA.entityIdB} vs ${cB.entityIdA}-${cB.entityIdB}`);
        }
        if (Math.abs(cA.penetrationDepthMm - cB.penetrationDepthMm) > 1e-9) {
          mismatches.push(`contact [${i}] depth mismatch: ${cA.penetrationDepthMm} vs ${cB.penetrationDepthMm}`);
        }
      }
    }

    const diagA = a.diagnostics || [];
    const diagB = b.diagnostics || [];
    if (diagA.length !== diagB.length) {
      mismatches.push(`diagnostics length mismatch: ${diagA.length} vs ${diagB.length}`);
    }

    return {
      isEquivalent: mismatches.length === 0,
      mismatches,
      operationalDiffs
    };
  }

  public static evaluateExactParity(
    a: CanonicalCollisionResult,
    b: CanonicalCollisionResult
  ): CanonicalResultEquivalenceResult {
    const res = this.evaluate(a, b);
    const extraMismatches = [...res.mismatches, ...res.operationalDiffs];
    return {
      isEquivalent: extraMismatches.length === 0,
      mismatches: extraMismatches,
      operationalDiffs: res.operationalDiffs
    };
  }

  public static areNumbersEquivalent(a: number | undefined | null, b: number | undefined | null): boolean {
    if (a === b) return true;
    if (a === undefined || a === null || b === undefined || b === null) return false;
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= 1e-9;
    }
    return false;
  }

  public static compare(
    a: CanonicalCollisionResult,
    b: CanonicalCollisionResult
  ): { equivalent: boolean; isEquivalent: boolean; mismatches: string[]; operationalDiffs: string[] } {
    const res = this.evaluate(a, b);
    return {
      equivalent: res.isEquivalent,
      isEquivalent: res.isEquivalent,
      mismatches: res.mismatches,
      operationalDiffs: res.operationalDiffs
    };
  }
}
