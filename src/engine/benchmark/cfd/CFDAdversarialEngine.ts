/**
 * SECP Industrial OS v2 — CFD Adversarial & Edge-Case Mutation Engine
 * Phase 15 (PATCH-174)
 *
 * Subject CFD solvers to pathological inputs, degenerate meshes, inverted topologies,
 * extreme Reynolds numbers, and incompatible boundary conditions.
 */

import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { FvmMesh3D, FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';
import { CFDAdversarialReport, CFDAdversarialResult, CFDVerdict } from './types';

export class CFDAdversarialEngine {
  /**
   * Runs the complete Adversarial Test Battery
   */
  public static runAdversarialBattery(): CFDAdversarialReport {
    const results: CFDAdversarialResult[] = [];

    // Test 1: Negative Fluid Density
    results.push(this.testNegativeDensity());

    // Test 2: Zero / Negative Viscosity
    results.push(this.testZeroViscosity());

    // Test 3: Inverted / Negative Cell Volume
    results.push(this.testNegativeCellVolume());

    // Test 4: Missing Inlet Velocity Specification (NaN / undefined)
    results.push(this.testMissingInletVelocity());

    // Test 5: Empty Mesh (Zero Cells)
    results.push(this.testEmptyMesh());

    // Test 6: Incompatible Boundary Condition (2 Inlets with No Outlet in Closed Box)
    results.push(this.testIncompatibleBoundaryConditions());

    // Test 7: Degenerate High Aspect Ratio Mesh (dx=1000, dy=0.001)
    results.push(this.testDegenerateAspectRatio());

    // Test 8: Pathological Divergent Under-Relaxation (alpha=3.0)
    results.push(this.testPathologicalUnderRelaxation());

    const testsInjected = results.length;
    const testsDetected = results.filter(r => r.detected).length;
    const falseAcceptanceCount = testsInjected - testsDetected;
    const detectionRatePercent = (testsDetected / testsInjected) * 100.0;

    return {
      testsInjected,
      testsDetected,
      falseAcceptanceCount,
      detectionRatePercent,
      details: results
    };
  }

  private static testNegativeDensity(): CFDAdversarialResult {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_rho', 0.5, 0.05, 0.05, 4, 2, 2);
    const fluid: FluidProperties3D = { densityKgM3: -1000, viscosityPaS: 0.001 };
    const config: SolverConfig3D = this.getDefaultConfig();

    let actualVerdict: CFDVerdict = 'PASS';
    let diagnostic = '';
    let detected = false;

    try {
      Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
      actualVerdict = 'PASS'; // Should not have passed
      diagnostic = 'Vulnerability: Solver accepted negative density without error.';
    } catch (err: any) {
      detected = true;
      actualVerdict = 'INVALID_INPUT';
      diagnostic = `Safely caught negative density: ${err.message}`;
    }

    return {
      adversarialId: 'ADV-01-NEGATIVE-DENSITY',
      adversarialType: 'Physical Property Pathology',
      description: 'Inject negative fluid density (rho = -1000 kg/m^3)',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict,
      detected,
      diagnostic
    };
  }

  private static testZeroViscosity(): CFDAdversarialResult {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_mu', 0.5, 0.05, 0.05, 4, 2, 2);
    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 0.0 };
    const config: SolverConfig3D = this.getDefaultConfig();

    let actualVerdict: CFDVerdict = 'PASS';
    let diagnostic = '';
    let detected = false;

    try {
      Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
      actualVerdict = 'PASS';
      diagnostic = 'Vulnerability: Solver accepted zero viscosity without error.';
    } catch (err: any) {
      detected = true;
      actualVerdict = 'INVALID_INPUT';
      diagnostic = `Safely caught zero viscosity: ${err.message}`;
    }

    return {
      adversarialId: 'ADV-02-ZERO-VISCOSITY',
      adversarialType: 'Singular Diffusion Matrix',
      description: 'Inject zero dynamic viscosity (mu = 0.0 Pa.s)',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict,
      detected,
      diagnostic
    };
  }

  private static testNegativeCellVolume(): CFDAdversarialResult {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_vol', 0.5, 0.05, 0.05, 4, 2, 2);
    // Invert first cell volume
    mesh.cells[0].volume = -0.005;

    const quality = Fvm3DMeshGenerator.auditMeshQuality(mesh.cells, mesh.faces);
    const detected = !quality.passed && quality.meshQualityStatus === 'DEGENERATE';

    return {
      adversarialId: 'ADV-03-NEGATIVE-VOLUME',
      adversarialType: 'Geometric Topology Pathology',
      description: 'Invert cell volume to negative value (V_cell = -0.005 m^3)',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict: detected ? 'INVALID_INPUT' : 'PASS',
      detected,
      diagnostic: detected
        ? 'Mesh Quality Auditor correctly rejected inverted cell volume.'
        : 'Vulnerability: Negative cell volume bypassed mesh audit.'
    };
  }

  private static testMissingInletVelocity(): CFDAdversarialResult {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_bc', 0.5, 0.05, 0.05, 4, 2, 2);
    for (const f of mesh.faces) {
      if (f.boundaryType === 'INLET') {
        f.u_bc = NaN;
      }
    }

    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 0.001 };
    const config = this.getDefaultConfig();

    let actualVerdict: CFDVerdict = 'PASS';
    let diagnostic = '';
    let detected = false;

    try {
      Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
      actualVerdict = 'PASS';
      diagnostic = 'Vulnerability: Solver accepted NaN inlet velocity.';
    } catch (err: any) {
      detected = true;
      actualVerdict = 'INVALID_INPUT';
      diagnostic = `Safely caught invalid boundary specification: ${err.message}`;
    }

    return {
      adversarialId: 'ADV-04-MISSING-INLET-BC',
      adversarialType: 'Boundary Condition Malformation',
      description: 'Prescribe NaN inlet velocity boundary condition',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict,
      detected,
      diagnostic
    };
  }

  private static testEmptyMesh(): CFDAdversarialResult {
    const emptyMesh: FvmMesh3D = {
      meshId: 'empty_mesh',
      cells: [],
      faces: [],
      quality: {
        totalCells: 0,
        totalFaces: 0,
        totalBoundaryFaces: 0,
        minCellVolume: 0,
        maxCellVolume: 0,
        maxSkewness: 0,
        maxAspectRatio: 0,
        maxNonOrthogonalityDeg: 0,
        hasPositiveVolumes: false,
        hasNonzeroAreas: false,
        isClosedTopology: false,
        isNeighborConsistent: false,
        hasDegenerateCells: true,
        meshQualityStatus: 'DEGENERATE',
        passed: false
      },
      boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
    };

    const quality = Fvm3DMeshGenerator.auditMeshQuality(emptyMesh.cells, emptyMesh.faces);
    const detected = !quality.passed;

    return {
      adversarialId: 'ADV-05-EMPTY-MESH',
      adversarialType: 'Boundary Extremum',
      description: 'Submit mesh with zero cells and zero faces',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict: detected ? 'INVALID_INPUT' : 'PASS',
      detected,
      diagnostic: detected ? 'Empty mesh safely rejected by Mesh Auditor.' : 'Empty mesh bypassed auditor.'
    };
  }

  private static testIncompatibleBoundaryConditions(): CFDAdversarialResult {
    // 2 inlets, all other walls are no-slip walls (no outlet in closed box)
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
      'adv_incomp',
      0.5, 0.05, 0.05,
      4, 2, 2,
      'INLET', 'WALL', 'WALL', 'WALL',
      { x: 1.0, y: 0, z: 0 }
    );

    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 0.001 };
    const config = this.getDefaultConfig();

    const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
    // Closed domain without outlet must show massive mass defect
    const isConservationFailed = solution.globalMassImbalanceNorm > 0.05 || !solution.converged;

    return {
      adversarialId: 'ADV-06-INCOMPATIBLE-BC',
      adversarialType: 'Mass Conservation Incompatibility',
      description: 'Prescribe fluid inlet into sealed rigid domain with no mass outlet',
      expectedVerdict: 'CONSERVATION_FAILURE',
      actualVerdict: isConservationFailed ? 'CONSERVATION_FAILURE' : 'PASS',
      detected: isConservationFailed,
      diagnostic: isConservationFailed
        ? `Conservation auditor flagged unresolvable mass accumulation (${(solution.globalMassImbalanceNorm * 100).toFixed(2)}%).`
        : 'Vulnerability: Incompatible BC reported false physical convergence.'
    };
  }

  private static testDegenerateAspectRatio(): CFDAdversarialResult {
    // Extremely distorted block
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_aspect', 1000.0, 0.001, 0.001, 2, 2, 2);
    const quality = Fvm3DMeshGenerator.auditMeshQuality(mesh.cells, mesh.faces);

    const detected = quality.maxAspectRatio > 200 || quality.meshQualityStatus === 'DEGENERATE';

    return {
      adversarialId: 'ADV-07-DEGENERATE-ASPECT-RATIO',
      adversarialType: 'Stiffness Ill-Conditioning',
      description: 'Construct mesh with extreme aspect ratio (AR > 1000)',
      expectedVerdict: 'INVALID_INPUT',
      actualVerdict: detected ? 'INVALID_INPUT' : 'PASS',
      detected,
      diagnostic: detected
        ? `Audit correctly flagged excessive aspect ratio (${quality.maxAspectRatio.toFixed(1)}).`
        : 'Extreme aspect ratio mesh bypassed auditor.'
    };
  }

  private static testPathologicalUnderRelaxation(): CFDAdversarialResult {
    const mesh = Fvm3DMeshGenerator.generate3DBlockMesh('adv_relax', 0.5, 0.05, 0.05, 4, 2, 2);
    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 0.001 };
    const config: SolverConfig3D = {
      maxIterations: 30,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 3.5, // Pathologically unstable
      underRelaxationPressure: 3.5,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    let detected = false;
    let actualVerdict: CFDVerdict = 'PASS';
    let diagnostic = '';

    try {
      const solution = Fvm3DNavierStokesSolver.solve(mesh, fluid, config);
      const isUnconverged = !solution.converged || isNaN(solution.finalContinuityResidual);
      actualVerdict = isUnconverged ? 'DIVERGED' : 'PASS';
      detected = isUnconverged;
      diagnostic = detected ? 'Instability detected with aggressive over-relaxation.' : 'Unexpected convergence.';
    } catch (err: any) {
      detected = true;
      actualVerdict = 'NUMERICAL_FAILURE';
      diagnostic = `Caught instability error: ${err.message}`;
    }

    return {
      adversarialId: 'ADV-08-PATHOLOGICAL-RELAXATION',
      adversarialType: 'Numerical Instability Induction',
      description: 'Inject unstable over-relaxation parameters (alpha_u = alpha_p = 3.5)',
      expectedVerdict: 'DIVERGED',
      actualVerdict,
      detected,
      diagnostic
    };
  }

  private static getDefaultConfig(): SolverConfig3D {
    return {
      maxIterations: 50,
      continuityTol: 1e-3,
      momentumTol: 1e-3,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };
  }
}
