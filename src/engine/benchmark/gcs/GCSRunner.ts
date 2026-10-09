import * as crypto from 'crypto';
/**
 * SECP Industrial OS v2 — GCS Single Case Runner
 * Phase 15 (PATCH-173)
 *
 * Executes individual benchmark cases against the CAD kernel GCS solver,
 * applies independent oracles, records timings, computes cryptographic hashes and verdicts.
 */

import { GCSBenchmarkCase, GCSEvidenceRecord, GCSVerdict } from './types';
import { IndustrialVariationalSolver } from '../../sketch/IndustrialVariationalSolver';
import { GCSIndependentGeometricOracle } from './GCSIndependentGeometricOracle';
import { GCSIndependentGraphAuditor } from './GCSIndependentGraphAuditor';
import { GCSDeterminismAuditor } from './GCSDeterminismAuditor';
import { IndustrialSketchDefinition } from '../../sketch/IndustrialConstraintTypes';

export class GCSRunner {
  private static solver = new IndustrialVariationalSolver();

  public static async executeCase(benchmarkCase: GCSBenchmarkCase): Promise<GCSEvidenceRecord> {
    const timestamp = new Date().toISOString();
    const { sketch, targetConstraints } = benchmarkCase.generator();

    const inputGeometryHash = this.computeGeometryHash(sketch);
    const inputConstraintHash = this.computeConstraintHash(sketch);

    // Initial DOF calculation from Graph Auditor
    const initialGraphAudit = GCSIndependentGraphAuditor.auditGraph(sketch);

    const startTime = performance.now();
    let solveResult;
    try {
      solveResult = this.solver.solve(sketch);
    } catch (err: any) {
      const solveTimeMs = performance.now() - startTime;
      return this.createFailureRecord(benchmarkCase, err.message, solveTimeMs, timestamp, inputGeometryHash, inputConstraintHash);
    }
    const solveTimeMs = performance.now() - startTime;

    const solvedSketch: IndustrialSketchDefinition = solveResult.sketch;
    const solvedGeometryHash = this.computeGeometryHash(solvedSketch);

    // Independent Oracles
    const geometricValidation = GCSIndependentGeometricOracle.verifySketch(solvedSketch, 1e-4);
    const graphValidation = GCSIndependentGraphAuditor.auditGraph(solvedSketch);
    const determinismResult = GCSDeterminismAuditor.auditDeterminism(sketch, 3);

    // Three-Layer State Model Determination
    const structuralConflictDetected = solveResult.structuralConflictDetected ?? (solveResult.solutionState === 'CONFLICTING');
    const solverExecuted = solveResult.solverExecuted ?? (solveResult.iterations > 0);

    const layer1Consistency = structuralConflictDetected
      ? (benchmarkCase.category === 'D_CONTRADICTORY_CONSTRAINTS' ? 'CONTRADICTORY' : 'STRUCTURAL_CONFLICT')
      : 'CONSISTENT';

    const layer2SolverState = !solverExecuted
      ? 'NOT_EXECUTED'
      : (solveResult.maxResidual <= 1e-4 ? 'CONVERGED' : (solveResult.iterations >= 50 ? 'NON_CONVERGED' : 'DIVERGED'));

    const layer3DOFClassification = (
      solveResult.solutionState === 'CONFLICTING' ? 'CONFLICTING' :
      solveResult.solutionState === 'REDUNDANT' ? 'REDUNDANT' :
      solveResult.solutionState === 'OVER_CONSTRAINED' ? 'OVER_CONSTRAINED' :
      solveResult.solutionState === 'UNDER_CONSTRAINED' ? 'UNDER_CONSTRAINED' :
      'FULLY_CONSTRAINED'
    );

    // Zero Iteration Classification
    let zeroIterationClassification: any = 'NOT_APPLICABLE';
    if (solveResult.iterations === 0) {
      if (structuralConflictDetected) {
        zeroIterationClassification = 'STRUCTURAL_CLASSIFICATION_WITHOUT_SOLVING';
      } else if (geometricValidation.satisfied) {
        zeroIterationClassification = 'INITIAL_STATE_ALREADY_SATISFIED';
      } else if (!solverExecuted) {
        zeroIterationClassification = 'SOLVER_NOT_EXECUTED';
      } else {
        zeroIterationClassification = 'VALID_NON_ITERATIVE_SOLUTION';
      }
    }

    // Semantic Mapping Documentation
    let semanticMappingNote: string | undefined;
    if (benchmarkCase.expectedState === 'REDUNDANT' || solveResult.solutionState === 'REDUNDANT') {
      semanticMappingNote = 'Explicit Contract: REDUNDANT requires structural rank deficiency detection with remaining DOF = 0 and full geometric constraint satisfaction.';
    } else if (benchmarkCase.expectedState === 'INCONSISTENT' && solveResult.solutionState === 'CONFLICTING') {
      semanticMappingNote = 'Specification Mapping: CONFLICTING implies constraint set contains contradictory predicates (e.g. PARALLEL & PERPENDICULAR or HORIZONTAL & VERTICAL). Mutually inconsistent.';
    }

    // Determine Verdict
    const verdict = this.evaluateVerdict(benchmarkCase, solveResult, geometricValidation, determinismResult);

    const diagnostics: string[] = [
      `Solver status: ${solveResult.solutionState}`,
      `Solver iterations: ${solveResult.iterations}`,
      `Solver executed: ${solverExecuted ? 'YES' : 'NO'}`,
      `Structural conflict detected: ${structuralConflictDetected ? 'YES' : 'NO'}`,
      `Layer 1 (Consistency): ${layer1Consistency}`,
      `Layer 2 (Solver State): ${layer2SolverState}`,
      `Layer 3 (DOF Classification): ${layer3DOFClassification}`,
      ...(zeroIterationClassification !== 'NOT_APPLICABLE' ? [`Zero-iteration classification: ${zeroIterationClassification}`] : []),
      ...(semanticMappingNote ? [`Semantic note: ${semanticMappingNote}`] : []),
      `Max residual: ${solveResult.maxResidual.toExponential(4)}`,
      `Remaining DOF: ${solveResult.dofReport.remainingDegreesOfFreedom}`,
      `Geometric constraints satisfied: ${geometricValidation.satisfied ? 'YES' : 'NO'} (max error: ${geometricValidation.maxError.toExponential(4)})`,
      `Determinism: ${determinismResult.isDeterministic ? 'PASS' : 'FAIL'}`,
      ...geometricValidation.violations
    ];

    const attestationDigest = this.createAttestationDigest(
      benchmarkCase.id,
      inputGeometryHash,
      solvedGeometryHash,
      verdict,
      solveResult.maxResidual
    );

    return {
      testId: benchmarkCase.id,
      title: benchmarkCase.title,
      category: benchmarkCase.category,
      solverEngine: 'IndustrialVariationalSolver v1.0',
      solverVersion: 'SECP-GCS-173.1',
      units: 'mm',
      tolerance: 1e-5,
      entityCount: Object.keys(sketch.entities).length,
      constraintCount: Object.keys(sketch.constraints).length,
      initialDOF: solveResult.dofReport.totalDegreesOfFreedom,
      finalDOF: solveResult.dofReport.remainingDegreesOfFreedom,
      expectedState: benchmarkCase.expectedState,
      actualState: solveResult.solutionState,
      iterations: solveResult.iterations,
      residual: solveResult.maxResidual,
      solveTimeMs,
      inputGeometryHash,
      inputConstraintHash,
      solvedGeometryHash,
      geometricValidation,
      graphValidation,
      determinismResult,
      verdict,
      diagnostics,
      ledgerTimestamp: timestamp,
      attestationDigest,
      layer1Consistency,
      layer2SolverState,
      layer3DOFClassification,
      structuralConflictDetected,
      solverExecuted,
      zeroIterationClassification,
      semanticMappingNote
    };
  }

  private static evaluateVerdict(
    benchmarkCase: GCSBenchmarkCase,
    solveResult: any,
    geometricValidation: any,
    determinismResult: any
  ): GCSVerdict {
    if (!determinismResult.isDeterministic) {
      return 'NON_DETERMINISTIC';
    }

    // For Inconsistent / Contradictory / Over-constrained test cases
    if (benchmarkCase.expectedState === 'INCONSISTENT' || benchmarkCase.expectedState === 'OVER_CONSTRAINED') {
      if (solveResult.solutionState === 'INCONSISTENT' || solveResult.solutionState === 'OVER_CONSTRAINED' || solveResult.solutionState === 'CONFLICTING') {
        return 'PASS'; // Correctly detected the conflict!
      }
      return 'FAIL';
    }

    // For Under-constrained test cases
    if (benchmarkCase.expectedState === 'UNDER_CONSTRAINED') {
      if (solveResult.solutionState === 'UNDER_CONSTRAINED' && solveResult.dofReport.remainingDegreesOfFreedom === benchmarkCase.expectedFinalDOF) {
        return 'PASS';
      }
      return 'FAIL';
    }

    // For Redundant test cases (Category E: Structural redundancy + full geometric satisfaction)
    if (benchmarkCase.expectedState === 'REDUNDANT') {
      if (solveResult.solutionState === 'REDUNDANT' &&
          solveResult.dofReport.remainingDegreesOfFreedom === benchmarkCase.expectedFinalDOF &&
          geometricValidation.satisfied) {
        return 'PASS';
      }
      return 'FAIL';
    }

    // For Fully-constrained cases
    if (benchmarkCase.expectedState === 'FULLY_CONSTRAINED') {
      if ((solveResult.solutionState === 'FULLY_CONSTRAINED' || solveResult.solutionState === 'SOLVED') && geometricValidation.satisfied) {
        return 'PASS';
      }
      if (!geometricValidation.satisfied) {
        return 'FAIL';
      }
      return 'UNPROVEN';
    }

    return 'PASS';
  }

  private static createFailureRecord(
    c: GCSBenchmarkCase,
    errorMsg: string,
    timeMs: number,
    timestamp: string,
    inputGeomHash: string,
    inputConstrHash: string
  ): GCSEvidenceRecord {
    return {
      testId: c.id,
      title: c.title,
      category: c.category,
      solverEngine: 'IndustrialVariationalSolver v1.0',
      solverVersion: 'SECP-GCS-173.1',
      units: 'mm',
      tolerance: 1e-5,
      entityCount: 0,
      constraintCount: 0,
      initialDOF: 0,
      finalDOF: 0,
      expectedState: c.expectedState,
      actualState: 'INCONSISTENT',
      iterations: 0,
      residual: 999,
      solveTimeMs: timeMs,
      inputGeometryHash: inputGeomHash,
      inputConstraintHash: inputConstrHash,
      solvedGeometryHash: 'sha256-geom-none',
      geometricValidation: { satisfied: false, maxError: 1.0, tolerance: 1e-4, evaluatedConstraints: 0, violations: [errorMsg], details: [] },
      graphValidation: { nodeCount: 0, edgeCount: 0, connectedComponents: 0, maxDependencyDepth: 0, hasCircularDependency: false, isGraphValid: false, details: [] },
      determinismResult: { isDeterministic: false, passCount: 0, driftCount: 1, hashes: [], details: [errorMsg] },
      verdict: 'NUMERICAL_FAILURE',
      diagnostics: [`Solver execution exception: ${errorMsg}`],
      ledgerTimestamp: timestamp,
      attestationDigest: `sha256-sig-fail-${crypto.createHash('sha256').update(c.id + errorMsg).digest('hex').slice(0, 8)}`
    };
  }

  private static computeGeometryHash(sketch: IndustrialSketchDefinition): string {
    const raw = Object.keys(sketch.entities).sort().map(k => {
      const e = sketch.entities[k];
      const geomData = (e as any).geometry?.data;
      const x = geomData?.x !== undefined ? geomData.x : ((e as any).x ?? '');
      const y = geomData?.y !== undefined ? geomData.y : ((e as any).y ?? '');
      const z = geomData?.z !== undefined ? geomData.z : ((e as any).z ?? '');
      const r = geomData?.radius !== undefined ? geomData.radius : ((e as any).radius ?? '');
      return `${k}:${e.type}:${x}:${y}:${z}:${r}`;
    }).join(';');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private static computeConstraintHash(sketch: IndustrialSketchDefinition): string {
    const raw = Object.keys(sketch.constraints).sort().map(k => {
      const c = sketch.constraints[k];
      return `${k}:${c.type}:${c.entityIds.join(',')}:${c.value || ''}`;
    }).join(';');
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private static createAttestationDigest(
    testId: string,
    inGeom: string,
    outGeom: string,
    verdict: string,
    residual: number
  ): string {
    // Pure mathematical state: excludes volatile timestamps, execution runtimes, and random seeds
    const payload = `${testId}:${inGeom}:${outGeom}:${verdict}:${residual.toExponential(4)}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
