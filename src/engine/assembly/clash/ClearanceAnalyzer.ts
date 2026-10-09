import {
  ClashComponentDefinition,
  ClashVerdict,
  ClashSeverity,
  ClashDetectionOptions,
  ClashContact,
} from './ClashTypes';
import { NarrowPhaseDetector, NarrowPhaseEvaluation } from './NarrowPhaseDetector';
import { ToleranceEngine } from '../../cad-kernel/tolerance/ToleranceModel';
import { ToleranceContext } from '../../cad-kernel/tolerance/ToleranceContext';

export interface ClearanceAnalysisResult {
  verdict: ClashVerdict;
  severity: ClashSeverity;
  penetrationDepth?: number;
  minimumClearance?: number;
  contacts: ClashContact[];
  diagnostics: string[];
}

export class ClearanceAnalyzer {
  /**
   * Analyzes clearance and interference between two components using explicit tolerance models
   */
  public static analyzePair(
    compA: ClashComponentDefinition,
    compB: ClashComponentDefinition,
    options: ClashDetectionOptions = {}
  ): ClearanceAnalysisResult {
    // 1. Run Narrow Phase
    const narrowRes = NarrowPhaseDetector.evaluatePair(compA, compB, options);

    if (narrowRes.verdict === 'INVALID' || narrowRes.verdict === 'INCONCLUSIVE') {
      return {
        verdict: narrowRes.verdict,
        severity: narrowRes.severity,
        contacts: narrowRes.contacts,
        diagnostics: narrowRes.diagnostics,
      };
    }

    const requiredClearance = options.requiredClearance ?? 0;
    const tolerance = options.tolerance ?? 1e-4;

    // 2. Evaluate Clearance vs Penetration
    if (narrowRes.verdict === 'CLASH') {
      return {
        verdict: 'CLASH',
        severity: 'CRITICAL',
        penetrationDepth: narrowRes.penetrationDepth,
        minimumClearance: 0,
        contacts: narrowRes.contacts,
        diagnostics: narrowRes.diagnostics,
      };
    }

    // Distance-based evaluation
    const dist = narrowRes.minimumDistance ?? 0;

    if (requiredClearance > 0 && dist < requiredClearance) {
      return {
        verdict: 'CLEARANCE_VIOLATION',
        severity: 'WARNING',
        minimumClearance: dist,
        penetrationDepth: narrowRes.penetrationDepth ?? 0,
        contacts: narrowRes.contacts,
        diagnostics: [
          `Clearance violation: measured clearance ${dist.toFixed(6)} mm < required ${requiredClearance.toFixed(6)} mm`,
        ],
      };
    }

    return {
      verdict: 'NO_CLASH',
      severity: 'NONE',
      minimumClearance: dist,
      penetrationDepth: narrowRes.penetrationDepth ?? 0,
      contacts: narrowRes.contacts,
      diagnostics: [`Satisfies clearance criteria (distance = ${dist.toFixed(6)} mm)`],
    };
  }
}
