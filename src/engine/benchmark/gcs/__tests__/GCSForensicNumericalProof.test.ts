/**
 * SECP Industrial OS v2 — GCS Forensic Numerical Proof Suite
 * Phase 15 (PATCH-GCS-002 Numerical Closure)
 */

import { describe, it, expect } from 'vitest';
import { IndustrialVariationalSolver } from '../../../sketch/IndustrialVariationalSolver';
import { GCSIndependentGeometricOracle } from '../GCSIndependentGeometricOracle';
import { ConstraintResiduals } from '../../../sketch/gcs/ConstraintResidual';
import { GCSBenchmarkBattery } from '../GCSBenchmarkBattery';
import { GCSRunner } from '../GCSRunner';
import { GCSBenchmarkCaseRegistry } from '../GCSBenchmarkCaseRegistry';
import { HardAcceptanceGate173 } from '../HardAcceptanceGate173';

describe('PATCH-GCS-002: Forensic Numerical Proof Suite', () => {

  // =========================================================================
  // PHASE 1 — MINIMAL NUMERICAL PROOF
  // =========================================================================
  it('Phase 1: Minimal numerical proof on P1=(0,0,0) fixed, P2=(10,0,0), DISTANCE=5', () => {
    const sketch = {
      id: 'sketch-phase1-proof',
      name: 'Minimal Numerical Proof',
      plane: 'XY',
      revision: 1,
      entities: {
        'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
        'p2': { id: 'p2', type: 'POINT', x: 10, y: 0 }
      },
      constraints: {
        'c1': {
          id: 'c1',
          type: 'DISTANCE',
          entityIds: ['p1', 'p2'],
          value: 5,
          suppressionState: 'ACTIVE'
        }
      }
    };

    const initialP1 = { x: sketch.entities.p1.x, y: sketch.entities.p1.y };
    const initialP2 = { x: sketch.entities.p2.x, y: sketch.entities.p2.y };
    const initialDist = Math.hypot(initialP2.x - initialP1.x, initialP2.y - initialP1.y);
    const initialResidual = Math.abs(initialDist - 5);
    const tolerance = 1e-4;

    // Pre-solve verification
    expect(initialResidual).toBeGreaterThan(tolerance);
    expect(initialDist).toBe(10);

    const solver = new IndustrialVariationalSolver();
    const solveResult = solver.solve(sketch as any);

    const finalP1 = { x: solveResult.sketch.entities.p1.x, y: solveResult.sketch.entities.p1.y };
    const finalP2 = { x: solveResult.sketch.entities.p2.x, y: solveResult.sketch.entities.p2.y };
    const finalDist = Math.hypot(finalP2.x - finalP1.x, finalP2.y - finalP1.y);
    const totalDeltaNorm = Math.hypot(finalP2.x - initialP2.x, finalP2.y - initialP2.y);

    // Independent Oracle verification
    const oracleResult = GCSIndependentGeometricOracle.verifySketch(solveResult.sketch as any, tolerance);

    // Mandatory Assertions (Section Phase 1)
    expect(initialResidual).toBeGreaterThan(tolerance);
    expect(solveResult.iterations).toBeGreaterThan(0);
    expect(solveResult.solverExecuted).toBe(true);
    expect(totalDeltaNorm).toBeGreaterThan(0);
    expect(solveResult.maxResidual).toBeLessThan(tolerance);
    expect(Math.abs(finalDist - 5)).toBeLessThan(tolerance);
    expect(oracleResult.satisfied).toBe(true);

    // Confirm physical geometry mutation: P2 moved by ~5.0mm towards target
    expect(Math.abs(totalDeltaNorm - 5.0)).toBeLessThan(0.01);
  });

  // =========================================================================
  // PHASE 2 — CONTRADICTION PROOF
  // =========================================================================
  it('Phase 2: Contradiction proof rejects false convergence on DISTANCE=5 and DISTANCE=20', () => {
    const contradictorySketch = {
      id: 'sketch-phase2-contradiction',
      name: 'Contradiction Proof',
      plane: 'XY',
      revision: 1,
      entities: {
        'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
        'p2': { id: 'p2', type: 'POINT', x: 10, y: 0 }
      },
      constraints: {
        'c1': {
          id: 'c1',
          type: 'DISTANCE',
          entityIds: ['p1', 'p2'],
          value: 5,
          suppressionState: 'ACTIVE'
        },
        'c2': {
          id: 'c2',
          type: 'DISTANCE',
          entityIds: ['p1', 'p2'],
          value: 20,
          suppressionState: 'ACTIVE'
        }
      }
    };

    const solver = new IndustrialVariationalSolver();
    const solveResult = solver.solve(contradictorySketch as any);

    // Must be flagged as CONFLICTING/INCONSISTENT or OVER_CONSTRAINED, never CONVERGED with residual < tolerance
    expect(solveResult.solutionState).toBe('CONFLICTING');
    expect(solveResult.maxResidual).toBeGreaterThan(1e-4);
    expect(solveResult.structuralConflictDetected).toBe(true);

    const oracleResult = GCSIndependentGeometricOracle.verifySketch(solveResult.sketch as any);
    expect(oracleResult.satisfied).toBe(false);
    expect(oracleResult.violations.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // PHASE 3 — ZERO-LENGTH DIRECTIONAL SAFETY
  // =========================================================================
  it('Phase 3: Zero-length line rejected for HORIZONTAL, VERTICAL, PARALLEL, PERPENDICULAR', () => {
    const zeroLenSketch = {
      id: 'sketch-phase3-zero-len',
      name: 'Degenerate Zero-Length Line',
      plane: 'XY',
      revision: 1,
      entities: {
        'p1': { id: 'p1', type: 'POINT', x: 5, y: 5 },
        'p2': { id: 'p2', type: 'POINT', x: 5, y: 5 },
        'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' }
      },
      constraints: {
        'c-h': { id: 'c-h', type: 'HORIZONTAL', entityIds: ['l1'] },
        'c-v': { id: 'c-v', type: 'VERTICAL', entityIds: ['l1'] }
      }
    };

    const oracleResult = GCSIndependentGeometricOracle.verifySketch(zeroLenSketch as any);
    expect(oracleResult.satisfied).toBe(false);
    expect(oracleResult.violations.some(v => v.includes('Degeneracy Violation'))).toBe(true);

    // Directional residuals must return non-zero penalty
    const pA = { x: 3, y: 3 };
    const pB = { x: 3, y: 3 };
    expect(ConstraintResiduals.horizontal(pA, pB)).toBe(1.0);
    expect(ConstraintResiduals.vertical(pA, pB)).toBe(1.0);
    expect(ConstraintResiduals.parallel({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeGreaterThan(0);
    expect(ConstraintResiduals.perpendicular({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeGreaterThan(0);
  });

  // =========================================================================
  // PHASE 4 — E01 SEMANTIC CONTRACT
  // =========================================================================
  it('Phase 4: GCS-E01 Redundancy Contract defines acceptable outcome', async () => {
    const e01Case = GCSBenchmarkCaseRegistry.getAllCases().find(c => c.id === 'GCS-E01-DUPLICATE-HORIZONTAL')!;
    expect(e01Case.expectedState).toBe('REDUNDANT');

    const record = await GCSRunner.executeCase(e01Case);
    expect(record.expectedState).toBe('REDUNDANT');
    expect(record.actualState).toBe('REDUNDANT');
    expect(record.verdict).toBe('PASS');
    expect(record.finalDOF).toBe(0);
    expect(record.residual).toBeLessThan(1e-4);
    expect(record.geometricValidation.satisfied).toBe(true);
    expect(record.semanticMappingNote).toContain('Explicit Contract');
  });

  // =========================================================================
  // PHASE 6 — DETERMINISTIC EVIDENCE HASH
  // =========================================================================
  it('Phase 6: Attestation digest is invariant to execution runtime and wall-clock time', async () => {
    const c = GCSBenchmarkCaseRegistry.getAllCases().find(x => x.id === 'GCS-A01-HORIZ-LINE')!;
    const rec1 = await GCSRunner.executeCase(c);
    const rec2 = await GCSRunner.executeCase(c);

    // Solved geometry hashes must match exactly
    expect(rec1.solvedGeometryHash).toBe(rec2.solvedGeometryHash);
    // Attestation digest must match exactly
    expect(rec1.attestationDigest).toBe(rec2.attestationDigest);
  });

  // =========================================================================
  // PHASE 7 — GATE INDEPENDENCE & ANTI-TAMPER
  // =========================================================================
  it('Phase 7: HardAcceptanceGate173 fails on corrupted evidence and malformed reports', async () => {
    const report = await GCSBenchmarkBattery.runFullBattery();
    const cleanGate = HardAcceptanceGate173.evaluateGate(report);
    expect(cleanGate.overallPassed).toBe(true);
    expect(cleanGate.verdict).toBe('PASS');

    // Anti-Tamper 1: Corrupt geometric validation on record 0
    const tamperedGeom = JSON.parse(JSON.stringify(report));
    tamperedGeom.evidenceLedger[0].geometricValidation.satisfied = false;
    expect(HardAcceptanceGate173.evaluateGate(tamperedGeom).verdict).toBe('FAIL');

    // Anti-Tamper 2: Corrupt determinism
    const tamperedDet = JSON.parse(JSON.stringify(report));
    tamperedDet.nonDeterministicCount = 1;
    expect(HardAcceptanceGate173.evaluateGate(tamperedDet).verdict).toBe('FAIL');

    // Anti-Tamper 3: Corrupt mutation false acceptance
    const tamperedMut = JSON.parse(JSON.stringify(report));
    tamperedMut.mutationReport.falseAcceptanceCount = 1;
    expect(HardAcceptanceGate173.evaluateGate(tamperedMut).verdict).toBe('FAIL');

    // Anti-Tamper 4: Missing or empty report
    expect(HardAcceptanceGate173.evaluateGate(null as any).verdict).toBe('FAIL');
    expect(HardAcceptanceGate173.evaluateGate(undefined as any).verdict).toBe('FAIL');
    expect(HardAcceptanceGate173.evaluateGate({} as any).verdict).toBe('FAIL');
  });
});
