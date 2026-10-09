/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: CFD Reproducibility Adversarial Battery
 */

import { describe, it, expect } from 'vitest';
import {
  FingerprintEngine,
  ResultComparator,
  CFDReproducibilityEngine
} from '../index';

describe('PATCH-074: CFD Reproducibility Adversarial Battery', () => {
  it('1. Field divergence exceeding envelope tolerance triggers failure', () => {
    const envelope = CFDReproducibilityEngine.defaultEnvelope();
    const orig = [1.0, 2.0, 3.0];
    const severelyDiverged = [1.5, 2.8, 4.2]; // 50% drift

    const comp = ResultComparator.compareScalarField('pressure', orig, severelyDiverged, envelope);
    expect(comp.isWithinEnvelope).toBe(false);
  });

  it('2. QoI drift exceeding threshold triggers failure', () => {
    const envelope = CFDReproducibilityEngine.defaultEnvelope(); // 0.5% tolerance
    const origQoI = 0.324;
    const driftedQoI = 0.350; // ~8% drift

    const comp = ResultComparator.compareQoI('dragCoeff', origQoI, driftedQoI, envelope);
    expect(comp.isWithinEnvelope).toBe(false);
  });

  it('3. Environment drift detection on mismatched container or OS', () => {
    const env1 = FingerprintEngine.captureCurrentEnvironment();
    const env2 = {
      ...env1,
      os: 'Windows-Server-2025',
      runtime: 'DotNet-CLR'
    };

    const comp = FingerprintEngine.compareEnvironments(env1, env2);
    expect(comp.status).toBe('DRIFTED');
    expect(comp.drift).toBe('MATERIAL_DRIFT');
    expect(comp.diffs.length).toBeGreaterThan(0);
  });

  it('4. Replay with broken evidence root leads to rejection', () => {
    const capsule = CFDReproducibilityEngine.packageCapsule({
      caseId: 'case-adv-074',
      runId: 'run-adv-074',
      inputs: {
        geometry: {},
        mesh: {},
        physics: {},
        material: {},
        bc: {},
        ic: {},
        solverConfig: {},
        numericalSchemes: {}
      },
      executionParams: {
        processCount: 1,
        threadCount: 1,
        gpuCount: 0,
        randomSeed: 1,
        commandLine: 'solve'
      },
      originalResult: {
        fields: { p: [1, 2] },
        finalResidual: 1e-6,
        massImbalance: 1e-15,
        qois: { q: 10 }
      },
      originalEvidenceRootHash: 'correct-original-evidence-root'
    });

    const report = CFDReproducibilityEngine.replayAndCompare({
      capsule,
      replayRunId: 'run-rep-adv',
      originalFields: { p: [1, 2] },
      replayedFields: { p: [1, 2] },
      originalResidualHistory: [1e-6],
      replayedResidualHistory: [1e-6],
      replayedMassImbalance: 1e-15,
      replayedQoIs: { q: 10 },
      replayedEvidenceRootHash: 'TAMPERED-OR-DIFFERENT-EVIDENCE-ROOT',
      replayedProvenanceMatches: true
    });

    expect(report.evidenceReplayMatch).toBe(false);
    expect(report.reproducibilityLevel).not.toBe('BITWISE_REPRODUCIBLE');
    expect(report.reproducibilityLevel).not.toBe('FORENSICALLY_REPRODUCIBLE');
  });

  it('5. Field length mismatch raises defensive error', () => {
    const envelope = CFDReproducibilityEngine.defaultEnvelope();
    expect(() => {
      ResultComparator.compareScalarField('u', [1, 2], [1, 2, 3], envelope);
    }).toThrowError(/Field length mismatch/);
  });
});
