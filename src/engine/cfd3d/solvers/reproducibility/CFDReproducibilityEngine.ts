/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: CFD Reproducibility Engine Core
 */

import {
  CFDReproducibilityCapsule,
  ReproducibilityCaseManifest,
  ReproducibilityEnvelope,
  DeterminismClass,
  ReproducibilityLevel,
  ReproducibilityVerdict,
  CFDReproducibilityReport,
  FieldComparisonResult,
  QoIComparisonResult
} from './ReproducibilityTypes';
import { FingerprintEngine, FingerprintHasher } from './FingerprintEngine';
import { ResultComparator } from './ResultComparator';

export class CFDReproducibilityEngine {
  public static defaultEnvelope(): ReproducibilityEnvelope {
    return {
      fieldToleranceAbs: 1e-4,
      fieldToleranceRel: 1e-3,
      residualToleranceAbs: 1e-5,
      conservationToleranceAbs: 1e-12,
      qoiToleranceRel: 0.005, // 0.5%
      temporalToleranceAbs: 1e-4
    };
  }

  public static packageCapsule(params: {
    readonly caseId: string;
    readonly runId: string;
    readonly inputs: {
      readonly geometry: unknown;
      readonly mesh: unknown;
      readonly physics: unknown;
      readonly material: unknown;
      readonly bc: unknown;
      readonly ic: unknown;
      readonly solverConfig: unknown;
      readonly numericalSchemes: unknown;
    };
    readonly executionParams: {
      readonly processCount: number;
      readonly threadCount: number;
      readonly gpuCount: number;
      readonly randomSeed: number;
      readonly commandLine: string;
    };
    readonly originalResult: {
      readonly fields: Record<string, readonly number[]>;
      readonly finalResidual: number;
      readonly massImbalance: number;
      readonly qois: Record<string, number>;
    };
    readonly originalEvidenceRootHash: string;
    readonly envelope?: ReproducibilityEnvelope;
  }): CFDReproducibilityCapsule {
    const now = new Date().toISOString();
    const capsuleId = `capsule-${params.caseId}-${Date.now().toString(36)}`;
    const software = FingerprintEngine.captureCurrentSoftware();
    const hardware = FingerprintEngine.captureCurrentHardware();
    const environment = FingerprintEngine.captureCurrentEnvironment();
    const envelope = params.envelope ?? this.defaultEnvelope();

    return {
      capsuleId,
      originalCaseId: params.caseId,
      originalRunId: params.runId,
      inputs: params.inputs,
      software,
      hardware,
      environment,
      executionParams: params.executionParams,
      envelope,
      originalResultSummary: {
        fieldsHash: FingerprintHasher.hashObject(params.originalResult.fields),
        finalResidual: params.originalResult.finalResidual,
        massImbalance: params.originalResult.massImbalance,
        qois: params.originalResult.qois
      },
      originalEvidenceRootHash: params.originalEvidenceRootHash,
      frozenAt: now
    };
  }

  public static analyzeDeterminism(
    runs: readonly (readonly number[])[]
  ): DeterminismClass {
    if (runs.length < 2) return 'UNKNOWN';

    let isBitwise = true;
    let isNumerical = true;

    const base = runs[0];
    for (let r = 1; r < runs.length; r++) {
      const current = runs[r];
      if (current.length !== base.length) return 'NON_DETERMINISTIC';

      for (let i = 0; i < base.length; i++) {
        if (base[i] !== current[i]) {
          isBitwise = false;
        }
        if (Math.abs(base[i] - current[i]) > 1e-5) {
          isNumerical = false;
        }
      }
    }

    if (isBitwise) return 'BITWISE_DETERMINISTIC';
    if (isNumerical) return 'NUMERICALLY_DETERMINISTIC';
    return 'STATISTICALLY_REPRODUCIBLE';
  }

  public static replayAndCompare(params: {
    readonly capsule: CFDReproducibilityCapsule;
    readonly replayRunId: string;
    readonly replayedFields: Record<string, readonly number[]>;
    readonly originalFields: Record<string, readonly number[]>;
    readonly replayedResidualHistory: readonly number[];
    readonly originalResidualHistory: readonly number[];
    readonly replayedMassImbalance: number;
    readonly replayedQoIs: Record<string, number>;
    readonly replayedEvidenceRootHash: string;
    readonly replayedProvenanceMatches: boolean;
  }): CFDReproducibilityReport {
    const replaySoftware = FingerprintEngine.captureCurrentSoftware();
    const replayHardware = FingerprintEngine.captureCurrentHardware();
    const replayEnvironment = FingerprintEngine.captureCurrentEnvironment();

    const envComparison = FingerprintEngine.compareEnvironments(
      params.capsule.environment,
      replayEnvironment
    );

    // 1. Field comparisons
    const fieldComparisons: FieldComparisonResult[] = [];
    let allFieldsWithinEnvelope = true;
    let isBitwiseMatch = true;

    for (const fieldName of Object.keys(params.originalFields)) {
      const origField = params.originalFields[fieldName];
      const repField = params.replayedFields[fieldName];
      if (!repField) {
        allFieldsWithinEnvelope = false;
        continue;
      }
      const res = ResultComparator.compareScalarField(
        fieldName,
        origField,
        repField,
        params.capsule.envelope
      );
      fieldComparisons.push(res);

      if (!res.isWithinEnvelope) {
        allFieldsWithinEnvelope = false;
      }
      if (res.maxAbsDiff !== 0) {
        isBitwiseMatch = false;
      }
    }

    // 2. QoI comparisons
    const qoiComparisons: QoIComparisonResult[] = [];
    let allQoisWithinEnvelope = true;
    for (const qoiName of Object.keys(params.capsule.originalResultSummary.qois)) {
      const origQoi = params.capsule.originalResultSummary.qois[qoiName];
      const repQoi = params.replayedQoIs[qoiName];
      if (repQoi === undefined) {
        allQoisWithinEnvelope = false;
        continue;
      }
      const qoiRes = ResultComparator.compareQoI(qoiName, origQoi, repQoi, params.capsule.envelope);
      qoiComparisons.push(qoiRes);
      if (!qoiRes.isWithinEnvelope) {
        allQoisWithinEnvelope = false;
      }
    }

    // 3. Residual & Conservation comparison
    const residualComp = ResultComparator.compareResidualHistories(
      params.originalResidualHistory,
      params.replayedResidualHistory
    );

    const conservationComp = ResultComparator.compareConservationBalances(
      params.capsule.originalResultSummary.massImbalance,
      params.replayedMassImbalance,
      params.capsule.envelope
    );

    // 4. Evidence & Provenance Replay
    const evidenceReplayMatch =
      params.replayedEvidenceRootHash === params.capsule.originalEvidenceRootHash;
    const provenanceReplayMatch = params.replayedProvenanceMatches;

    // 5. Determinism & Reproducibility Classification
    let determinismClass: DeterminismClass = 'NUMERICALLY_DETERMINISTIC';
    if (isBitwiseMatch) {
      determinismClass = 'BITWISE_DETERMINISTIC';
    }

    let reproducibilityLevel: ReproducibilityLevel = 'NOT_REPRODUCIBLE';
    let verdict: ReproducibilityVerdict = 'REPRODUCIBILITY_FAILED';

    if (allFieldsWithinEnvelope && allQoisWithinEnvelope && conservationComp.isWithinTolerance) {
      if (isBitwiseMatch && evidenceReplayMatch) {
        reproducibilityLevel = 'BITWISE_REPRODUCIBLE';
        verdict = 'REPRODUCIBLE_BITWISE';
      } else if (evidenceReplayMatch && provenanceReplayMatch) {
        reproducibilityLevel = 'FORENSICALLY_REPRODUCIBLE';
        verdict = 'REPRODUCIBLE_FORENSIC';
      } else {
        reproducibilityLevel = 'NUMERICALLY_REPRODUCIBLE';
        verdict = 'REPRODUCIBLE_NUMERICAL';
      }
    } else {
      reproducibilityLevel = 'REPLAYABLE';
      verdict = 'REPRODUCIBILITY_FAILED';
    }

    const manifest: ReproducibilityCaseManifest = {
      reproducibilityCaseId: `rcase-${params.capsule.originalCaseId}-${Date.now().toString(36)}`,
      originalCaseId: params.capsule.originalCaseId,
      originalRunId: params.capsule.originalRunId,
      originalEvidenceId: `ev-${params.capsule.originalRunId}`,
      originalEvidenceRootHash: params.capsule.originalEvidenceRootHash,
      replayRunId: params.replayRunId,
      geometryHash: FingerprintHasher.hashObject(params.capsule.inputs.geometry),
      meshHash: FingerprintHasher.hashObject(params.capsule.inputs.mesh),
      physicsHash: FingerprintHasher.hashObject(params.capsule.inputs.physics),
      materialHash: FingerprintHasher.hashObject(params.capsule.inputs.material),
      bcHash: FingerprintHasher.hashObject(params.capsule.inputs.bc),
      icHash: FingerprintHasher.hashObject(params.capsule.inputs.ic),
      solverConfigHash: FingerprintHasher.hashObject(params.capsule.inputs.solverConfig),
      numericalConfigHash: FingerprintHasher.hashObject(params.capsule.inputs.numericalSchemes),
      executableHash: params.capsule.software.executableHash,
      dependencyHash: FingerprintHasher.hashObject(params.capsule.software.dependencies),
      environmentHash: FingerprintHasher.hashObject(replayEnvironment),
      hardwareHash: FingerprintHasher.hashObject(replayHardware),
      containerHash: replayEnvironment.containerDigest ?? 'none',
      compilerHash: FingerprintHasher.hashObject(replaySoftware.compiler),
      runtimeHash: FingerprintHasher.hashObject(replayEnvironment.runtime),
      schemaVersion: '2.0.0',
      softwareVersion: '2.0.0',
      policyVersion: '1.0.0',
      createdAt: new Date().toISOString()
    };

    return {
      caseIdentity: manifest,
      determinismClass,
      reproducibilityLevel,
      environmentStatus: envComparison.status,
      environmentDrift: envComparison.drift,
      fieldComparisons,
      qoiComparisons,
      residualDiff: residualComp.finalDiff,
      conservationDiff: conservationComp.massDiff,
      evidenceReplayMatch,
      provenanceReplayMatch,
      verdict
    };
  }
}
