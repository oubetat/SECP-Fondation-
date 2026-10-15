import { test, expect, describe } from 'vitest';
import { SECP082IndependentCFDVerifier } from '../SECP082IndependentCFDVerifier';
import { FvmMesh3D, FvmCell3D, FvmFace3D } from '../Fvm3DTypes';

function createTestCell(cellId: number, faceIds: number[], volume: number = 1.0, centroid = { x: 0.5, y: 0.5, z: 0.5 }): FvmCell3D {
  return {
    cellId,
    volume,
    centroid,
    faceIds,
    neighborCellIds: [],
    boundaryFaceIds: [],
    skewness: 0,
    aspectRatio: 1,
    nonOrthogonalityDeg: 0
  };
}

function createTestFace(
  faceId: number,
  ownerCellId: number,
  neighborCellId: number,
  normal = { x: 1, y: 0, z: 0 },
  area: number = 1.0,
  boundaryType: 'INLET' | 'OUTLET' | 'WALL' | 'INTERNAL' = 'INTERNAL',
  u_bc?: number,
  v_bc?: number,
  w_bc?: number
): FvmFace3D {
  return {
    faceId,
    ownerCellId,
    neighborCellId,
    centroid: { x: 0.5, y: 0.5, z: 0.5 },
    normal,
    area,
    boundaryType,
    u_bc,
    v_bc,
    w_bc
  };
}

function createTestMesh(cells: FvmCell3D[], faces: FvmFace3D[]): FvmMesh3D {
  return {
    meshId: 'test-mesh',
    cells,
    faces,
    quality: {
      totalCells: cells.length,
      totalFaces: faces.length,
      totalBoundaryFaces: faces.filter(f => f.boundaryType !== 'INTERNAL').length,
      minCellVolume: 1.0,
      maxCellVolume: 1.0,
      maxSkewness: 0,
      maxAspectRatio: 1,
      maxNonOrthogonalityDeg: 0,
      hasPositiveVolumes: true,
      hasNonzeroAreas: true,
      isClosedTopology: true,
      isNeighborConsistent: true,
      hasDegenerateCells: false,
      meshQualityStatus: 'EXCELLENT',
      passed: true
    },
    boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }
  };
}

describe('SECP-082 Independent CFD Verifier Forensic Test Suite', () => {

  // Test A — Prescribed Inlet
  test('SECP-082 Test A - Prescribed Inlet', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0)],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 10.0, 0.0, 0.0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const solution = {
      u: [10.0], // converged plug flow matching inlet
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-12.25, 12.25], // rho=1.225 * 10 * (-1) * 1.0 = -12.25
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.boundaryConditionCompliance).toBe(true);
    expect(res.gate1BoundaryFluxCompliance).toBe(true);
    expect(res.inletMassFlowKgS).toBeCloseTo(12.25, 6);
    expect(res.outletMassFlowKgS).toBeCloseTo(12.25, 6);
    expect(res.globalMassImbalance).toBeLessThan(1e-10);
    expect(res.numericalConsistencyPassed).toBe(true);
    expect(res.gate6PhysicalPlausibility).toBe(true);
    expect(res.independentVerdict).toBe('VERIFIED_NUMERICAL_CONSISTENCY');
  });

  // Test B — Cell-center != Boundary Velocity
  test('SECP-082 Test B - Cell-center != Boundary Velocity', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0)],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 5.0, 0.0, 0.0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const solution = {
      u: [999.0], // corrupted cell center, boundary is 5.0
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-6.125, 6.125], // 1.225 * 5 * (-1) * 1.0 = -6.125
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.inletMassFlowKgS).toBeCloseTo(6.125, 6);
    expect(res.gate1BoundaryFluxCompliance).toBe(true);
  });

  // Test C — Stationary Wall
  test('SECP-082 Test C - Stationary Wall', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0], 1.0)],
      [createTestFace(0, 0, -1, { x: 0, y: 1, z: 0 }, 1.0, 'WALL', 0.0, 0.0, 0.0)]
    );

    const solution = {
      u: [10.0],
      v: [10.0],
      w: [10.0],
      p: [0.0],
      faceFluxes: [0.0],
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.wallNormalMassFluxKgS).toBe(0.0);
    expect(res.gate1BoundaryFluxCompliance).toBe(true);
  });

  // Test D — Internal Face owner/neighbor sign cancellation
  test('SECP-082 Test D - Internal Face owner/neighbor sign cancellation', () => {
    const mesh = createTestMesh(
      [
        createTestCell(0, [0], 0.5, { x: 0.25, y: 0.5, z: 0.5 }),
        createTestCell(1, [0], 0.5, { x: 0.75, y: 0.5, z: 0.5 })
      ],
      [createTestFace(0, 0, 1, { x: 1, y: 0, z: 0 }, 1.0, 'INTERNAL')]
    );

    const solution = {
      u: [2.0, 4.0], // uf = 0.5 * (2 + 4) = 3.0
      v: [0.0, 0.0],
      w: [0.0, 0.0],
      p: [0.0, 0.0],
      faceFluxes: [3.675], // 1.225 * 3.0 * 1.0
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    // Face 0 contributes +3.675 to cell 0 and -3.675 to cell 1 -> sum across cells cancels identically to 0
    expect(res.gate2InternalFluxReconstruction).toBe(true);
    expect(res.internalFaceCount).toBe(1);
    expect(res.internalFaceCorrectionMagnitude).toBeLessThan(1e-10);
  });

  // Test E — Zero-flow Case
  test('SECP-082 Test E - Zero-flow Case', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0], 1.0)],
      [createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 0.0, 0.0, 0.0)]
    );

    const solution = {
      u: [0.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [1e-8],
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.globalMassImbalance).toBe(0.0);
    expect(res.gate3GlobalMassConservation).toBe(true);
    expect(res.numericalConsistencyPassed).toBe(true);
    expect(res.gate6PhysicalPlausibility).toBe(true);
    expect(res.independentVerdict).toBe('VERIFIED_NUMERICAL_CONSISTENCY');
  });

  // Test F — Sign Consistency
  test('SECP-082 Test F - Sign Consistency', () => {
    const mesh = createTestMesh(
      [
        createTestCell(0, [0], 1.0, { x: 0.5, y: 0.5, z: 0.5 }),
        createTestCell(1, [0], 1.0, { x: -0.5, y: 0.5, z: 0.5 })
      ],
      [createTestFace(0, 0, 1, { x: -1, y: 0, z: 0 }, 1.0, 'INTERNAL')]
    );

    const solution = {
      u: [10.0, 10.0],
      v: [0.0, 0.0],
      w: [0.0, 0.0],
      p: [0.0, 0.0],
      faceFluxes: [-12.25], // Normal points in -x, u is +x -> flux is negative
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.internalFaceCorrectionMagnitude).toBeLessThan(1e-10);
    expect(res.gate2InternalFluxReconstruction).toBe(true);
  });

  // Test G — Internal Rhie-Chow reconstruction & interface consistency
  test('SECP-082 Test G - Internal Rhie-Chow reconstruction', () => {
    const mesh = createTestMesh(
      [
        createTestCell(0, [0], 0.5, { x: 0.25, y: 0.5, z: 0.5 }),
        createTestCell(1, [0], 0.5, { x: 0.75, y: 0.5, z: 0.5 })
      ],
      [createTestFace(0, 0, 1, { x: 1, y: 0, z: 0 }, 1.0, 'INTERNAL')]
    );

    // Stored flux contains arithmetic + Rhie-Chow smoothing
    const arithmeticFlux = 1.225 * 3.0 * 1.0; // 3.675
    const rhieChowDiff = 0.00005; // 5e-5 smoothing
    const solution = {
      u: [3.0, 3.0],
      v: [0.0, 0.0],
      w: [0.0, 0.0],
      p: [100.0, 80.0],
      faceFluxes: [arithmeticFlux + rhieChowDiff],
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.internalFaceCount).toBe(1);
    expect(res.internalFaceCorrectionMagnitude).toBeCloseTo(0.00005, 6);
    expect(res.gate2InternalFluxReconstruction).toBe(true);
  });

  // Test H — Pressure-correction reconstruction
  test('SECP-082 Test H - Pressure-correction reconstruction', () => {
    const mesh = createTestMesh(
      [
        createTestCell(0, [0, 1], 0.5, { x: 0.25, y: 0.5, z: 0.5 }),
        createTestCell(1, [1, 2], 0.5, { x: 0.75, y: 0.5, z: 0.5 })
      ],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, 1, { x: 1, y: 0, z: 0 }, 1.0, 'INTERNAL'),
        createTestFace(2, 1, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const mdot_inlet = -1.225 * 1.0;
    const mdot_internal = 1.225 * 1.0;
    const mdot_outlet = 1.225 * 1.0;

    const solution = {
      u: [1.0, 1.0],
      v: [0.0, 0.0],
      w: [0.0, 0.0],
      p: [10.0, 5.0],
      faceFluxes: [mdot_inlet, mdot_internal, mdot_outlet],
      finalContinuityResidual: 1e-7,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.inletMassFlowKgS).toBeCloseTo(1.225, 6);
    expect(res.outletMassFlowKgS).toBeCloseTo(1.225, 6);
    expect(res.globalMassImbalance).toBeLessThan(1e-10);
    expect(res.gate3GlobalMassConservation).toBe(true);
  });

  // Test I — Global boundary mass imbalance
  test('SECP-082 Test I - Global boundary mass imbalance', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    // Solution where outlet flux creates 5% mass imbalance
    const solution = {
      u: [1.05],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 1.225 * 1.05], // 5% extra outflow
      finalContinuityResidual: 0.05,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.globalMassImbalance).toBeCloseTo(0.05, 4);
    expect(res.gate3GlobalMassConservation).toBe(false);
    expect(res.independentVerdict).toBe('CONSERVATION_VIOLATION');
  });

  // Test J — Deliberate internal stored-flux mutation
  test('SECP-082 Test J - Deliberate internal stored-flux mutation', () => {
    const mesh = createTestMesh(
      [
        createTestCell(0, [0], 0.5, { x: 0.25, y: 0.5, z: 0.5 }),
        createTestCell(1, [0], 0.5, { x: 0.75, y: 0.5, z: 0.5 })
      ],
      [createTestFace(0, 0, 1, { x: 1, y: 0, z: 0 }, 1.0, 'INTERNAL')]
    );

    // Mutate internal face flux with NaN
    const solution = {
      u: [2.0, 4.0],
      v: [0.0, 0.0],
      w: [0.0, 0.0],
      p: [0.0, 0.0],
      faceFluxes: [NaN],
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.gate2InternalFluxReconstruction).toBe(false);
    expect(res.passed).toBe(false);
  });

  // Test K — Deliberate boundary-flux mutation
  test('SECP-082 Test K - Deliberate boundary-flux mutation', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [createTestFace(0, 0, -1, { x: 0, y: 1, z: 0 }, 1.0, 'WALL', 50.0, 0, 0)]
    );

    const solution = {
      u: [0.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [0.0],
      finalContinuityResidual: 0,
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.gate1BoundaryFluxCompliance).toBe(false);
    expect(res.boundaryConditionCompliance).toBe(false);
    expect(res.passed).toBe(false);
  });

  // Test L — Deliberate reported-residual mutation (Forgery detection)
  test('SECP-082 Test L - Deliberate reported-residual mutation', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    // Claims 1e-12 residual while cell has a 0.5 kg/s mass defect
    const solution = {
      u: [1.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 0.0], // Huge defect of 1.225 kg/s
      finalContinuityResidual: 1e-12, // Forged claim
      converged: true
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.gate5MutationDetection).toBe(false);
    expect(res.independentVerdict).toBe('FORGED_RESIDUAL_DETECTED');
    expect(res.passed).toBe(false);
  });

  // Test M — Phase 3 Unconverged NACA0012 Scenario (Gate 6 catches lack of convergence)
  test('SECP-082 Test M - Unconverged solution rejected by Gate 6', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const unconvergedSolution = {
      u: [1.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 1.225],
      finalContinuityResidual: 7.0e-7,
      converged: false, // Explicitly unconverged
      convergenceAudit: {
        terminationReason: 'MAX_ITERATIONS_REACHED'
      },
      cl: 0.0255, // Erroneous lift at AoA=2 deg
      cd: 0.008,
      aoaDeg: 2.0
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, unconvergedSolution, 1.225, 1.8e-5);

    // Tier 1 numerical consistency passes
    expect(res.gate1BoundaryFluxCompliance).toBe(true);
    expect(res.gate2InternalFluxReconstruction).toBe(true);
    expect(res.gate3GlobalMassConservation).toBe(true);
    expect(res.gate4ContinuityResidualConsistency).toBe(true);
    expect(res.gate5MutationDetection).toBe(true);
    expect(res.numericalConsistencyPassed).toBe(true);

    // Tier 2 physical plausibility MUST FAIL
    expect(res.gate6PhysicalPlausibility).toBe(false);
    expect(res.physicalPlausibilityPassed).toBe(false);
    expect(res.independentVerdict).toBe('UNCONVERGED_SOLUTION');
    expect(res.passed).toBe(false);
    expect(res.physicalDiagnostics.failureReasons.length).toBeGreaterThan(0);
  });

  // Test N — Aerodynamic lift slope violation caught by Gate 6
  test('SECP-082 Test N - Aerodynamic lift slope violation caught by Gate 6', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const solution = {
      u: [1.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 1.225],
      finalContinuityResidual: 1e-7,
      converged: true,
      cl: 0.0255, // Lift slope dCl/d(alpha) = 0.01275 / deg, well below thin airfoil theory minimum 0.03
      cd: 0.012,
      aoaDeg: 2.0
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.numericalConsistencyPassed).toBe(true);
    expect(res.gate6PhysicalPlausibility).toBe(false);
    expect(res.independentVerdict).toBe('PHYSICAL_UNPLAUSIBILITY_DETECTED');
    expect(res.passed).toBe(false);
  });

  // Test O — Negative drag caught by Gate 6
  test('SECP-082 Test O - Negative drag violation caught by Gate 6', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const solution = {
      u: [1.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 1.225],
      finalContinuityResidual: 1e-7,
      converged: true,
      cl: 0.22,
      cd: -0.05, // Unphysical negative drag
      aoaDeg: 2.0
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.numericalConsistencyPassed).toBe(true);
    expect(res.gate6PhysicalPlausibility).toBe(false);
    expect(res.independentVerdict).toBe('PHYSICAL_UNPLAUSIBILITY_DETECTED');
    expect(res.passed).toBe(false);
  });

  // Test P — Fully converged aerodynamic solution satisfies both Tier 1 and Tier 2
  test('SECP-082 Test P - Fully converged aerodynamic solution passes both tiers', () => {
    const mesh = createTestMesh(
      [createTestCell(0, [0, 1], 1.0, { x: 0.5, y: 0.5, z: 0.5 })],
      [
        createTestFace(0, 0, -1, { x: -1, y: 0, z: 0 }, 1.0, 'INLET', 1.0, 0, 0),
        createTestFace(1, 0, -1, { x: 1, y: 0, z: 0 }, 1.0, 'OUTLET')
      ]
    );

    const solution = {
      u: [1.0],
      v: [0.0],
      w: [0.0],
      p: [0.0],
      faceFluxes: [-1.225, 1.225],
      finalContinuityResidual: 1e-7,
      converged: true,
      cl: 0.22, // Thin-airfoil theoretical expectation at AoA=2 deg
      cd: 0.012,
      aoaDeg: 2.0
    };

    const verifier = new SECP082IndependentCFDVerifier();
    const res = verifier.verifyPhysicalConservation(mesh, solution, 1.225, 1.8e-5);

    expect(res.gate1BoundaryFluxCompliance).toBe(true);
    expect(res.gate2InternalFluxReconstruction).toBe(true);
    expect(res.gate3GlobalMassConservation).toBe(true);
    expect(res.gate4ContinuityResidualConsistency).toBe(true);
    expect(res.gate5MutationDetection).toBe(true);
    expect(res.gate6PhysicalPlausibility).toBe(true);
    expect(res.numericalConsistencyPassed).toBe(true);
    expect(res.physicalPlausibilityPassed).toBe(true);
    expect(res.independentVerdict).toBe('VERIFIED_NUMERICAL_CONSISTENCY');
    expect(res.passed).toBe(true);
  });
});
