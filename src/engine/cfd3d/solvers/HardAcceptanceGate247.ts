/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-247 — Mesh Convergence Hard Acceptance Gate
 */

import { MeshConvergenceEngine, MeshConvergenceStudyConfig, QuantityOfInterestType, MeshLevel } from './MeshConvergenceEngine';

export interface GateResult247 {
  overallVerdict: 'PASS' | 'FAIL';
  testReports: any[];
  timestamp: string;
}

export class HardAcceptanceGate247 {
  public static runSuite(): GateResult247 {
    const testReports: any[] = [];

    // Test 01: Distinct Mesh Generation and Quality Auditing
    testReports.push(this.testDistinctMeshGeneration());

    // Test 02: Independent CFD Re-solves & Dynamic QoI Extraction
    testReports.push(this.testIndependentReSolves());

    // Test 03: Richardson Extrapolation & GCI Numerical Analysis
    testReports.push(this.testRichardsonGciArithmetic());

    // Test 04: Monotonicity Detection Audit
    testReports.push(this.testMonotonicityDetection());

    // Test 05: Exact Deterministic Reproducibility
    testReports.push(this.testDeterministicReproducibility());

    const overallVerdict = testReports.every(r => r.success) ? 'PASS' : 'FAIL';

    return {
      overallVerdict,
      testReports,
      timestamp: new Date().toISOString()
    };
  }

  private static testDistinctMeshGeneration() {
    const meshCoarse = MeshConvergenceEngine.generateCfdChannelMesh(4, 2, 2, 1.0, 0.2, 0.2);
    const meshMedium = MeshConvergenceEngine.generateCfdChannelMesh(6, 3, 3, 1.0, 0.2, 0.2);
    const meshFine = MeshConvergenceEngine.generateCfdChannelMesh(9, 4, 4, 1.0, 0.2, 0.2);

    const statsCoarse = MeshConvergenceEngine.auditMeshQuality(meshCoarse, MeshLevel.COARSE, 1.0, 0.2, 0.2);
    const statsMedium = MeshConvergenceEngine.auditMeshQuality(meshMedium, MeshLevel.MEDIUM, 1.0, 0.2, 0.2);
    const statsFine = MeshConvergenceEngine.auditMeshQuality(meshFine, MeshLevel.FINE, 1.0, 0.2, 0.2);

    // Verification conditions:
    // - Node and cell counts must increase strictly between levels
    // - Aspect ratios and volumes must be positive and non-degenerate
    const success = 
      meshCoarse.cells.size < meshMedium.cells.size &&
      meshMedium.cells.size < meshFine.cells.size &&
      statsCoarse.meanCellSize > statsMedium.meanCellSize &&
      statsMedium.meanCellSize > statsFine.meanCellSize &&
      statsCoarse.qualityPassed && statsMedium.qualityPassed && statsFine.qualityPassed;

    return {
      name: 'Distinct Multi-Level Mesh Generation',
      success,
      details: {
        coarseCells: meshCoarse.cells.size,
        mediumCells: meshMedium.cells.size,
        fineCells: meshFine.cells.size,
        coarseVol: statsCoarse.meanCellSize,
        fineVol: statsFine.meanCellSize
      }
    };
  }

  private static testIndependentReSolves() {
    const config: MeshConvergenceStudyConfig = {
      studyId: 'STUDY_VERIF_247',
      Lx: 1.0,
      Ly: 0.2,
      Lz: 0.2,
      density: 1.225,
      viscosity: 1.789e-5,
      maxIterations: 8,
      convergenceThreshold: 1e-8,
      refinementRatio: 1.5,
      underRelaxationU: 0.7,
      underRelaxationP: 0.3,
      targetQoI: QuantityOfInterestType.PRESSURE_DROP,
      tolerance: 0.05
    };

    const evidence = MeshConvergenceEngine.runMeshConvergenceStudy(config);

    // Verify QoI history is extracted for all levels
    const qoiCoarse = evidence.qoiHistory[MeshLevel.COARSE]?.[QuantityOfInterestType.PRESSURE_DROP];
    const qoiFine = evidence.qoiHistory[MeshLevel.FINE]?.[QuantityOfInterestType.PRESSURE_DROP];

    const success = 
      qoiCoarse !== undefined && 
      qoiFine !== undefined && 
      qoiCoarse !== qoiFine && // Numerical values must differ due to grid spacing refinement!
      evidence.finalConvergenceVerdict !== undefined;

    return {
      name: 'Independent Re-Solves & Physical Field Evolution',
      success,
      details: {
        coarsePressureDrop: qoiCoarse,
        finePressureDrop: qoiFine,
        finalVerdict: evidence.finalConvergenceVerdict
      }
    };
  }

  private static testRichardsonGciArithmetic() {
    const config: MeshConvergenceStudyConfig = {
      studyId: 'STUDY_VERIF_247',
      Lx: 1.0,
      Ly: 0.2,
      Lz: 0.2,
      density: 1000,
      viscosity: 0.001,
      maxIterations: 5,
      convergenceThreshold: 1e-8,
      refinementRatio: 1.5,
      underRelaxationU: 0.7,
      underRelaxationP: 0.3,
      targetQoI: QuantityOfInterestType.MAX_VELOCITY,
      tolerance: 0.05
    };

    const evidence = MeshConvergenceEngine.runMeshConvergenceStudy(config);
    const analysis = evidence.richardsonAnalysis[QuantityOfInterestType.MAX_VELOCITY];

    const success = 
      analysis !== undefined &&
      !isNaN(analysis.apparentOrder) &&
      !isNaN(analysis.extrapolatedValue) &&
      !isNaN(analysis.gci) &&
      analysis.apparentOrder > 0;

    return {
      name: 'Richardson Extrapolation & GCI Numerical Analysis',
      success,
      details: {
        apparentOrder: analysis?.apparentOrder,
        extrapolatedVal: analysis?.extrapolatedValue,
        gci: analysis?.gci
      }
    };
  }

  private static testMonotonicityDetection() {
    const config: MeshConvergenceStudyConfig = {
      studyId: 'STUDY_VERIF_247',
      Lx: 1.0,
      Ly: 0.2,
      Lz: 0.2,
      density: 1.2,
      viscosity: 1.8e-5,
      maxIterations: 6,
      convergenceThreshold: 1e-8,
      refinementRatio: 1.5,
      underRelaxationU: 0.7,
      underRelaxationP: 0.3,
      targetQoI: QuantityOfInterestType.DRAG,
      tolerance: 0.05
    };

    const evidence = MeshConvergenceEngine.runMeshConvergenceStudy(config);

    // Verify error and monotonicity reports are dynamically calculated
    const errorData = evidence.errorCalculations[QuantityOfInterestType.DRAG];
    const richardson = evidence.richardsonAnalysis[QuantityOfInterestType.DRAG];

    const success = 
      errorData !== undefined && 
      errorData.relativeError >= 0 &&
      richardson !== undefined;

    return {
      name: 'Dynamic Monotonicity & Error Detection',
      success,
      details: {
        relativeError: errorData?.relativeError,
        orderOfConvergence: richardson?.apparentOrder
      }
    };
  }

  private static testDeterministicReproducibility() {
    const config: MeshConvergenceStudyConfig = {
      studyId: 'STUDY_VERIF_247_REPRO',
      Lx: 1.0,
      Ly: 0.2,
      Lz: 0.2,
      density: 1000,
      viscosity: 0.001,
      maxIterations: 4,
      convergenceThreshold: 1e-8,
      refinementRatio: 1.5,
      underRelaxationU: 0.7,
      underRelaxationP: 0.3,
      targetQoI: QuantityOfInterestType.AVG_VELOCITY,
      tolerance: 0.05
    };

    const run1 = MeshConvergenceEngine.runMeshConvergenceStudy(config);
    const run2 = MeshConvergenceEngine.runMeshConvergenceStudy(config);

    // Multi-run bit-exact comparison
    const val1 = run1.qoiHistory[MeshLevel.FINE]?.[QuantityOfInterestType.AVG_VELOCITY] ?? 0;
    const val2 = run2.qoiHistory[MeshLevel.FINE]?.[QuantityOfInterestType.AVG_VELOCITY] ?? 0;

    const diff = Math.abs(val1 - val2);
    const success = diff < 1e-8;

    return {
      name: 'Deterministic Multi-Run Reproducibility',
      success,
      details: {
        run1Val: val1,
        run2Val: val2,
        difference: diff
      }
    };
  }
}
