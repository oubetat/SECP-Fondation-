import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { CfdEvidenceSerializer, CanonicalIterationRecord } from '../CfdEvidenceSerializer';
import { CfdIterationLog3D } from '../../Fvm3DTypes';

describe('CfdEvidenceSerialization - Evidence Serialization Gap Closure Suite', () => {
  const FROZEN_INTERVENTION_ARTIFACT_PATH = path.resolve(__dirname, '../../../../../reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json');
  const EXPECTED_FROZEN_SHA256 = '99b9b7d93aa32eeec26ef8290b9ab0db44c13cf64185c7446811aa62efc515e2';

  // TEST 1 — HISTORY PRESERVATION
  it('TEST 1: Preserves all 5 records from a synthetic solver result with 5 iteration records', () => {
    const mockLogs: CfdIterationLog3D[] = [1, 2, 3, 4, 5].map(i => ({
      iteration: i,
      continuityResidual: 1e-3 / i,
      uMomentumResidual: 2e-3 / i,
      vMomentumResidual: 1e-4 / i,
      wMomentumResidual: 0,
      pressureChange: 0.5 / i,
      globalMassImbalanceKgS: 1e-6 / i,
      maxVelocityMS: 1.0 + 0.1 * i,
      momentumLinf: 0.0083486 / i,
      cl: 0.05 * i,
      cd: 0.01 + 0.001 * i
    }));

    const mockSolution = {
      iterationHistory: mockLogs,
      totalIterations: 5
    };

    const serialized = CfdEvidenceSerializer.serializeSolutionHistory(mockSolution, {
      producer: 'Fvm3DNavierStokesSolver',
      consumer: 'TestRunner'
    });

    expect(serialized.traceLength).toBe(5);
    expect(serialized.totalIterationsExecuted).toBe(5);
    expect(serialized.traceIntegrityGatePassed).toBe(true);
    expect(serialized.iterationHistory).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(serialized.iterationHistory[i].iteration).toBe(i + 1);
      expect(serialized.iterationHistory[i].continuityResidual).toBe(mockLogs[i].continuityResidual);
      expect(serialized.iterationHistory[i].maxVelocityMS).toBe(mockLogs[i].maxVelocityMS);
    }
  });

  // TEST 2 — ITERATION ORDER
  it('TEST 2: Asserts serialized iterations remain strictly ordered and throws on non-monotonic history', () => {
    const unorderedLogs: CfdIterationLog3D[] = [
      { iteration: 1, continuityResidual: 1e-3, uMomentumResidual: 1e-3, vMomentumResidual: 0, wMomentumResidual: 0, pressureChange: 0, globalMassImbalanceKgS: 0, maxVelocityMS: 1 },
      { iteration: 3, continuityResidual: 1e-3, uMomentumResidual: 1e-3, vMomentumResidual: 0, wMomentumResidual: 0, pressureChange: 0, globalMassImbalanceKgS: 0, maxVelocityMS: 1 },
      { iteration: 2, continuityResidual: 1e-3, uMomentumResidual: 1e-3, vMomentumResidual: 0, wMomentumResidual: 0, pressureChange: 0, globalMassImbalanceKgS: 0, maxVelocityMS: 1 }
    ];

    expect(() => {
      CfdEvidenceSerializer.serializeSolutionHistory({
        iterationHistory: unorderedLogs,
        totalIterations: 3
      });
    }).toThrowError(/EVIDENCE_SERIALIZATION_FAILURE.*Non-monotonic/);
  });

  // TEST 3 — NUMERIC FIDELITY
  it('TEST 3: Preserves exact floating-point values without semantic rounding truncation', () => {
    const preciseValue = 0.0083486123456789;
    const preciseImbalance = 1.23456789012345e-7;

    const mockLogs: CfdIterationLog3D[] = [{
      iteration: 1,
      continuityResidual: preciseImbalance,
      uMomentumResidual: preciseValue,
      vMomentumResidual: 0,
      wMomentumResidual: 0,
      pressureChange: 0.12345678,
      globalMassImbalanceKgS: preciseImbalance,
      maxVelocityMS: 2.5000000001,
      momentumLinf: preciseValue
    }];

    const serialized = CfdEvidenceSerializer.serializeSolutionHistory({
      iterationHistory: mockLogs,
      totalIterations: 1
    });

    const jsonStr = JSON.stringify(serialized);
    const parsed: typeof serialized = JSON.parse(jsonStr);

    expect(parsed.iterationHistory[0].momentumLinf).toBe(preciseValue);
    expect(parsed.iterationHistory[0].continuityResidual).toBe(preciseImbalance);
    expect(parsed.iterationHistory[0].maxVelocityMS).toBe(2.5000000001);
  });

  // TEST 4 — NO SILENT EMPTY TRACE
  it('TEST 4: Emits hard EVIDENCE_SERIALIZATION_FAILURE if totalIterations > 0 but history is empty', () => {
    const silentFailureCase = {
      iterationHistory: [],
      totalIterations: 500
    };

    expect(() => {
      CfdEvidenceSerializer.serializeSolutionHistory(silentFailureCase);
    }).toThrowError(/EVIDENCE_SERIALIZATION_FAILURE: Solver executed 500 iterations but iterationHistory is empty/);
  });

  // TEST 5 — TRACE/ITERATION CONSISTENCY
  it('TEST 5: Fails integrity gate if totalIterations does not match history length', () => {
    const truncatedHistory: CfdIterationLog3D[] = [
      { iteration: 1, continuityResidual: 1e-3, uMomentumResidual: 1e-3, vMomentumResidual: 0, wMomentumResidual: 0, pressureChange: 0, globalMassImbalanceKgS: 0, maxVelocityMS: 1 }
    ];

    expect(() => {
      CfdEvidenceSerializer.serializeSolutionHistory({
        iterationHistory: truncatedHistory,
        totalIterations: 500
      });
    }).toThrowError(/EVIDENCE_SERIALIZATION_FAILURE: totalIterations \(500\) does not match iterationHistory.length \(1\)/);
  });

  // TEST 6 — TELEMETRY PROVENANCE
  it('TEST 6: Preserves missing telemetry as MISSING or NOT_AVAILABLE without synthesizing fake values', () => {
    const minimalLog: CfdIterationLog3D = {
      iteration: 1,
      continuityResidual: 1e-3,
      uMomentumResidual: 1e-3,
      vMomentumResidual: 0,
      wMomentumResidual: 0,
      pressureChange: 0,
      globalMassImbalanceKgS: 0,
      maxVelocityMS: 1.0
      // kResidual, omegaResidual, cl, cd, numberOfVelocityClippedCells are omitted
    };

    const serialized = CfdEvidenceSerializer.serializeSolutionHistory({
      iterationHistory: [minimalLog],
      totalIterations: 1
    });

    const record = serialized.iterationHistory[0];
    expect(record.numberOfVelocityClippedCells).toBe('MISSING');
    expect(record.kResidual).toBe('NOT_AVAILABLE');
    expect(record.omegaResidual).toBe('NOT_AVAILABLE');
    expect(record.cl).toBe('NOT_AVAILABLE');
    expect(record.cd).toBe('NOT_AVAILABLE');
  });

  // TEST 7 — ORIGINAL ARTIFACT IMMUTABILITY
  it('TEST 7: Asserts original frozen Intervention #1 artifact remains byte-identical', () => {
    const candidates = [
      path.resolve(process.cwd(), 'reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json'),
      path.resolve(__dirname, '../../../../../reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json'),
      path.resolve(__dirname, '../../../../reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json'),
      path.resolve(__dirname, '../../../reports/CFD-NACA0012-INTERVENTION-1-PRESSURE-CAP-REMOVED.json')
    ];
    const targetPath = candidates.find(p => fs.existsSync(p));
    expect(targetPath).toBeDefined();
    const content = fs.readFileSync(targetPath!);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');

    expect(actualHash).toBe(EXPECTED_FROZEN_SHA256);
  });
});
