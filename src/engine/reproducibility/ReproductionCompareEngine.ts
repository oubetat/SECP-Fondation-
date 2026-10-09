/**
 * SECP Industrial OS v3 — PATCH-183: Reproduction Compare Engine
 * Audits and compares original vs independent execution across 10 structural stages,
 * supporting STRICT, NUMERIC, and ENGINEERING modes with difference localization.
 */

import {
  ReproducibleEngineeringPackage,
  ComparisonMode,
  ReproducibilityComparisonReport,
  StageComparisonResult,
  ReproducibilityDivergence
} from './ReproducibilityTypes';
import { IndependentRunOutput } from './IndependentReproductionEngine';
import { generateDeterministicHashSync } from '../../lib/hash';

export class ReproductionCompareEngine {
  /**
   * Compares an original Reproducible Engineering Package with an Independent Run Output.
   */
  public static compare(
    originalPkg: ReproducibleEngineeringPackage,
    independentRun: IndependentRunOutput,
    mode: ComparisonMode = 'STRICT'
  ): ReproducibilityComparisonReport {
    const stageResults: StageComparisonResult[] = [];
    let divergence: ReproducibilityDivergence = { divergenceFound: false };

    // Stage 1: Model
    const modelMatched = originalPkg.hashes.modelHash === independentRun.reproducedHashes.modelHash;
    stageResults.push({
      stageName: 'Model',
      originalHash: originalPkg.hashes.modelHash,
      reproducedHash: independentRun.reproducedHashes.modelHash,
      matched: modelMatched,
      deltaSummary: modelMatched ? 'Canonical B-Rep geometry & topology identity confirmed.' : 'Geometry hash mismatch!'
    });

    // Stage 2: Materials
    const matMatched = originalPkg.hashes.materialHash === independentRun.reproducedHashes.materialHash;
    stageResults.push({
      stageName: 'Materials',
      originalHash: originalPkg.hashes.materialHash,
      reproducedHash: independentRun.reproducedHashes.materialHash,
      matched: matMatched,
      deltaSummary: matMatched ? 'Material ontology properties & constitutive parameters match.' : 'Material property mismatch!'
    });

    // Stage 3: Boundary Conditions
    const bcMatched = originalPkg.hashes.boundaryHash === independentRun.reproducedHashes.boundaryHash;
    stageResults.push({
      stageName: 'BoundaryConditions',
      originalHash: originalPkg.hashes.boundaryHash,
      reproducedHash: independentRun.reproducedHashes.boundaryHash,
      matched: bcMatched,
      deltaSummary: bcMatched ? 'Boundary conditions & entity bindings identical.' : 'Boundary condition mismatch!'
    });

    // Stage 4: Mesh
    const meshMatched = originalPkg.hashes.meshHash === independentRun.reproducedHashes.meshHash;
    stageResults.push({
      stageName: 'Mesh',
      originalHash: originalPkg.hashes.meshHash,
      reproducedHash: independentRun.reproducedHashes.meshHash,
      matched: meshMatched,
      deltaSummary: meshMatched ? 'Canonical node & element numbering, connectivity & quality metrics match.' : 'Mesh mismatch!'
    });

    // Stage 5: Solver Configuration
    const solverMatched = originalPkg.hashes.solverHash === independentRun.reproducedHashes.solverHash;
    stageResults.push({
      stageName: 'Solver',
      originalHash: originalPkg.hashes.solverHash,
      reproducedHash: independentRun.reproducedHashes.solverHash,
      matched: solverMatched,
      deltaSummary: solverMatched ? 'Solver type, tolerances, and linear algorithms match.' : 'Solver config mismatch!'
    });

    // Stage 6: Seed
    const seedMatched = originalPkg.hashes.seedHash === independentRun.reproducedHashes.seedHash;
    stageResults.push({
      stageName: 'Seed',
      originalHash: originalPkg.hashes.seedHash,
      reproducedHash: independentRun.reproducedHashes.seedHash,
      matched: seedMatched,
      deltaSummary: seedMatched ? 'Master seed & deterministic algorithm policies match.' : 'Seed mismatch!'
    });

    // Stage 7: Runtime Specification
    const runtimeMatched = originalPkg.hashes.runtimeHash === independentRun.reproducedHashes.runtimeHash;
    stageResults.push({
      stageName: 'Runtime',
      originalHash: originalPkg.hashes.runtimeHash,
      reproducedHash: independentRun.reproducedHashes.runtimeHash,
      matched: runtimeMatched,
      deltaSummary: runtimeMatched ? 'Runtime OS, CPU architecture, and container spec match.' : 'Runtime environment drift.'
    });

    // Stage 8: Execution Trace
    const execTraceMatched = originalPkg.hashes.evidenceHash === independentRun.reproducedHashes.evidenceHash;
    stageResults.push({
      stageName: 'ExecutionTrace',
      originalHash: originalPkg.hashes.evidenceHash,
      reproducedHash: independentRun.reproducedHashes.evidenceHash,
      matched: execTraceMatched,
      deltaSummary: execTraceMatched ? 'Evidence logs and iteration traces matched.' : 'Execution trace drift.'
    });

    // Stage 9: Residuals
    const origResiduals = originalPkg.result.residuals;
    const repResiduals = independentRun.reproducedResult.residuals;
    let residualMatched = true;
    if (origResiduals.length !== repResiduals.length) {
      residualMatched = false;
    } else {
      for (let i = 0; i < origResiduals.length; i++) {
        if (Math.abs(origResiduals[i] - repResiduals[i]) > 1e-12) {
          residualMatched = false;
          break;
        }
      }
    }
    const resHashOrig = `RES-NORM-${generateDeterministicHashSync({ res: origResiduals })}`;
    const resHashRep = `RES-NORM-${generateDeterministicHashSync({ res: repResiduals })}`;
    stageResults.push({
      stageName: 'Residuals',
      originalHash: resHashOrig,
      reproducedHash: resHashRep,
      matched: residualMatched,
      deltaSummary: residualMatched ? 'Convergence residual norm progression matched.' : 'Residual history mismatch!'
    });

    // Stage 10: Final Result Data & Difference Localization
    const origScalars = originalPkg.result.scalars;
    const repScalars = independentRun.reproducedResult.scalars;
    const origStresses = originalPkg.result.fieldData.vonMisesStressMPa;
    const repStresses = independentRun.reproducedResult.fieldData.vonMisesStressMPa;

    let resultMatched = true;

    if (mode === 'STRICT') {
      resultMatched = originalPkg.hashes.resultHash === independentRun.reproducedHashes.resultHash;
    } else if (mode === 'NUMERIC') {
      const absErr = Math.abs(origScalars.maxStressMPa - repScalars.maxStressMPa);
      const relErr = absErr / (Math.abs(origScalars.maxStressMPa) || 1.0);
      resultMatched = absErr <= 1e-5 && relErr <= 1e-4;
    } else if (mode === 'ENGINEERING') {
      const absErr = Math.abs(origScalars.maxStressMPa - repScalars.maxStressMPa);
      const relErr = absErr / (Math.abs(origScalars.maxStressMPa) || 1.0);
      resultMatched = relErr <= 0.001; // 0.1% engineering tolerance
    }

    // Perform Difference Localization if result didn't match strictly or if field stresses differ
    if (!resultMatched || origStresses.length !== repStresses.length) {
      let firstDivergentNode = -1;
      let expVal = 0;
      let actVal = 0;

      const minLen = Math.min(origStresses.length, repStresses.length);
      for (let i = 0; i < minLen; i++) {
        const diff = Math.abs(origStresses[i] - repStresses[i]);
        if (diff > 1e-6) {
          firstDivergentNode = i + 1;
          expVal = origStresses[i];
          actVal = repStresses[i];
          break;
        }
      }

      if (firstDivergentNode !== -1) {
        const absErr = Math.abs(expVal - actVal);
        const relErr = absErr / (Math.abs(expVal) || 1.0);

        divergence = {
          divergenceFound: true,
          divergenceStage: 'RESULT',
          iterationNumber: 10,
          variableName: 'vonMisesStressMPa',
          nodeOrElementId: firstDivergentNode,
          expectedValue: expVal,
          actualValue: actVal,
          absoluteError: absErr,
          relativeError: relErr,
          classification: absErr > 1e-3 ? 'NUMERICAL_DIVERGENCE' : 'ROUNDING_DRIFT'
        };
      }
    }

    stageResults.push({
      stageName: 'FinalResult',
      originalHash: originalPkg.hashes.resultHash,
      reproducedHash: independentRun.reproducedHashes.resultHash,
      matched: resultMatched,
      deltaSummary: resultMatched
        ? `Result fields matched under ${mode} comparison mode.`
        : `Result divergence localized at node ${divergence.nodeOrElementId ?? 1}`
    });

    const overallMatch = stageResults.every(r => r.matched);

    return {
      comparisonId: `CMP-${generateDeterministicHashSync({ pkgId: originalPkg.manifest.packageId, mode, time: Date.now() })}`,
      timestamp: new Date().toISOString(),
      comparisonMode: mode,
      overallMatch,
      stageResults,
      divergence
    };
  }
}
