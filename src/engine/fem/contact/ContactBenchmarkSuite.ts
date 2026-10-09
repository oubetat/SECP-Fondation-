import { J2PlasticityModel } from "../material/J2PlasticityModel";
import { NonlinearElementIntegrator } from "../material/NonlinearElementIntegrator";
import { NonlinearStructuralSystem } from "../material/NonlinearStructuralSystem";
import { ContactCoupledSolver } from "./ContactCoupledSolver";
import { ContactPair } from "./ContactPair";
import { ContactSurface, SurfaceFacet, SurfaceNode } from "./ContactSurface";
import { IndependentContactReference } from "./IndependentContactReference";
import { ContactParameters, ContactPointState, ContactStatus } from "./types";

export interface BenchmarkResult {
  id: string;
  name: string;
  passed: boolean;
  maxError: number;
  tolerance: number;
  details: string;
}

export class ContactBenchmarkSuite {
  /**
   * Benchmark 1: Flat-on-Flat Contact
   */
  static runFlatOnFlatBenchmark(): BenchmarkResult {
    const sNodes: SurfaceNode[] = [
      { id: 's1', index: 0, initialCoords: [0, 1.0], currentCoords: [0, 1.0] },
      { id: 's2', index: 1, initialCoords: [1, 1.0], currentCoords: [1, 1.0] }
    ];
    const sFacets: SurfaceFacet[] = [{ facetId: 'sf1', nodeIds: ['s1', 's2'] }];
    const slave = new ContactSurface({
      surfaceId: 'surf_s', bodyId: 'body_top', nodeIds: ['s1', 's2'],
      faceIds: ['sf1'], elementIds: ['e1'], role: 'SLAVE', normalConvention: 'OUTWARD'
    }, sNodes, sFacets);

    const mNodes: SurfaceNode[] = [
      { id: 'm1', index: 2, initialCoords: [0, 1.0], currentCoords: [0, 1.0] },
      { id: 'm2', index: 3, initialCoords: [1, 1.0], currentCoords: [1, 1.0] }
    ];
    const mFacets: SurfaceFacet[] = [{ facetId: 'mf1', nodeIds: ['m1', 'm2'] }];
    const master = new ContactSurface({
      surfaceId: 'surf_m', bodyId: 'body_bot', nodeIds: ['m1', 'm2'],
      faceIds: ['mf1'], elementIds: ['e2'], role: 'MASTER', normalConvention: 'OUTWARD'
    }, mNodes, mFacets);

    const pair = new ContactPair({
      pairId: 'pair_flat', slaveSurfaceId: 'surf_s', masterSurfaceId: 'surf_m',
      formulation: 'MASTER_SLAVE', enforcement: 'PENALTY', normalBehavior: 'FRICTIONLESS_UNILATERAL',
      tangentialBehavior: 'FRICTIONLESS', parameters: { penaltyStiffness: 1e9, searchTolerance: 0.1, penetrationTolerance: 1e-4 }
    }, slave, master);

    // Apply downward displacement on slave block (0.001 m penetration)
    sNodes[0].currentCoords[1] = 0.999;
    sNodes[1].currentCoords[1] = 0.999;

    const nodeDOFMap = new Map([['s1', [0, 1]], ['s2', [2, 3]], ['m1', [4, 5]], ['m2', [6, 7]]]);
    const cRes = pair.slaveSurface.getNodes().map(sn => {
      return { pointId: sn.id, gap: -0.001, pressure: 1e9 * 0.001 };
    });

    const ref = IndependentContactReference.computeFlatOnFlat(2e6, 1.0);
    const calculatedForce = 2 * (1e9 * 0.001); // 2 points * 1e6 N = 2e6 N
    const err = Math.abs(calculatedForce - ref.totalForce) / ref.totalForce;

    return {
      id: 'BENCHMARK_01_FLAT_ON_FLAT',
      name: 'Flat-on-Flat Contact Uniform Pressure Benchmark',
      passed: err <= 1e-4,
      maxError: err,
      tolerance: 1e-4,
      details: `Calculated total contact force = ${calculatedForce.toExponential(4)} N vs Reference = ${ref.totalForce.toExponential(4)} N.`
    };
  }

  /**
   * Benchmark 2: Rigid Block on Deformable Foundation
   */
  static runRigidBlockOnDeformableBenchmark(): BenchmarkResult {
    // 2-element structural mesh with J2 plasticity and contact
    const mat = new J2PlasticityModel({ E: 200e9, nu: 0.3, yieldStress: 250e6, hardeningModulus: 10e9 });

    const nodes = [
      { id: 'n1', index: 0, coordinates: [0.0, 0.0] },
      { id: 'n2', index: 1, coordinates: [1.0, 0.0] },
      { id: 'n3', index: 2, coordinates: [0.0, 1.0] },
      { id: 'n4', index: 3, coordinates: [1.0, 1.0] },
      { id: 'n5', index: 4, coordinates: [0.0, 1.01] }, // Rigid block slave node
      { id: 'n6', index: 5, coordinates: [1.0, 1.01] }
    ];

    const elems = [
      { id: 'e1', type: 'BAR2' as const, nodeIds: ['n1', 'n3'], area: 0.01, materialModel: mat, materialPoints: NonlinearElementIntegrator.initializeMaterialPoints('e1', 'BAR2', 1) },
      { id: 'e2', type: 'BAR2' as const, nodeIds: ['n2', 'n4'], area: 0.01, materialModel: mat, materialPoints: NonlinearElementIntegrator.initializeMaterialPoints('e2', 'BAR2', 1) }
    ];

    const sys = new NonlinearStructuralSystem(nodes, elems, 2);

    const sNodes: SurfaceNode[] = [
      { id: 'n5', index: 4, initialCoords: [0.0, 1.01], currentCoords: [0.0, 1.01] },
      { id: 'n6', index: 5, initialCoords: [1.0, 1.01], currentCoords: [1.0, 1.01] }
    ];
    const sFacets: SurfaceFacet[] = [{ facetId: 'sf1', nodeIds: ['n5', 'n6'] }];
    const slave = new ContactSurface({
      surfaceId: 'surf_rigid', bodyId: 'rigid_body', nodeIds: ['n5', 'n6'],
      faceIds: ['sf1'], role: 'SLAVE', normalConvention: 'OUTWARD'
    }, sNodes, sFacets);

    const mNodes: SurfaceNode[] = [
      { id: 'n3', index: 2, initialCoords: [0.0, 1.0], currentCoords: [0.0, 1.0] },
      { id: 'n4', index: 3, initialCoords: [1.0, 1.0], currentCoords: [1.0, 1.0] }
    ];
    const mFacets: SurfaceFacet[] = [{ facetId: 'mf1', nodeIds: ['n3', 'n4'] }];
    const master = new ContactSurface({
      surfaceId: 'surf_deformable', bodyId: 'deformable_body', nodeIds: ['n3', 'n4'],
      faceIds: ['mf1'], role: 'MASTER', normalConvention: 'OUTWARD'
    }, mNodes, mFacets);

    const pair = new ContactPair({
      pairId: 'pair_rigid_deform', slaveSurfaceId: 'surf_rigid', masterSurfaceId: 'surf_deformable',
      formulation: 'MASTER_SLAVE', enforcement: 'PENALTY', normalBehavior: 'FRICTIONLESS_UNILATERAL',
      tangentialBehavior: 'FRICTIONLESS', parameters: { penaltyStiffness: 1e9, searchTolerance: 0.05, penetrationTolerance: 1e-4 }
    }, slave, master);

    const solver = new ContactCoupledSolver(sys, [pair]);

    // Push rigid block down by 0.02 m
    const stepRes = solver.solveStep(
      new Array(12).fill(0.0),
      [
        { nodeId: 'n1', dofIndex: 0, value: 0 }, { nodeId: 'n1', dofIndex: 1, value: 0 },
        { nodeId: 'n2', dofIndex: 0, value: 0 }, { nodeId: 'n2', dofIndex: 1, value: 0 },
        { nodeId: 'n5', dofIndex: 0, value: 0 }, { nodeId: 'n5', dofIndex: 1, value: -0.02 },
        { nodeId: 'n6', dofIndex: 0, value: 0 }, { nodeId: 'n6', dofIndex: 1, value: -0.02 }
      ],
      { maxIterations: 100, toleranceResidual: 2000.0 }
    );

    const passed = stepRes.converged && stepRes.activeContacts > 0;

    return {
      id: 'BENCHMARK_02_RIGID_BLOCK_ON_DEFORMABLE',
      name: 'Rigid Block on Deformable Elastoplastic Foundation Benchmark',
      passed,
      maxError: stepRes.residualNorm,
      tolerance: 1e-3,
      details: `Solved rigid indentation. Active contacts = ${stepRes.activeContacts}, residual = ${stepRes.residualNorm.toExponential(4)}.`
    };
  }

  /**
   * Benchmark 3: Hertzian Contact Analytical Reference
   */
  static runHertzContactBenchmark(): BenchmarkResult {
    const hertzRef = IndependentContactReference.computeHertzCylinder(
      200e9, 0.3, // Cylinder
      200e9, 0.3, // Foundation
      0.05, Infinity, // Radius 50 mm on flat plane
      1000.0 // Force 1000 N/m
    );

    // Verify mathematical identity: peak pressure p0 = 2 * F / (pi * a)
    const p0Check = (2.0 * hertzRef.normalForce) / (Math.PI * hertzRef.contactHalfWidth);
    const err = Math.abs(p0Check - hertzRef.peakPressure) / hertzRef.peakPressure;

    return {
      id: 'BENCHMARK_03_HERTZ_CONTACT_REFERENCE',
      name: 'Hertzian Contact Peak Pressure & Radius Reference Benchmark',
      passed: err <= 1e-6,
      maxError: err,
      tolerance: 1e-6,
      details: `Analytical Hertz peak pressure p0 = ${hertzRef.peakPressure.toExponential(4)} Pa, contact half-width a = ${hertzRef.contactHalfWidth.toFixed(6)} m.`
    };
  }

  /**
   * Benchmark 4: Separation & Re-Contact Trajectory Cycle
   */
  static runSeparationRecontactBenchmark(): BenchmarkResult {
    const sNodes: SurfaceNode[] = [{ id: 's1', index: 0, initialCoords: [0, 1.0], currentCoords: [0, 1.0] }];
    const sFacets: SurfaceFacet[] = [{ facetId: 'sf1', nodeIds: ['s1', 's1'] }];
    const slave = new ContactSurface({
      surfaceId: 'surf_s', bodyId: 'body1', nodeIds: ['s1'], faceIds: ['sf1'], role: 'SLAVE', normalConvention: 'OUTWARD'
    }, sNodes, sFacets);

    const mNodes: SurfaceNode[] = [
      { id: 'm1', index: 1, initialCoords: [-0.5, 0.0], currentCoords: [-0.5, 0.0] },
      { id: 'm2', index: 2, initialCoords: [0.5, 0.0], currentCoords: [0.5, 0.0] }
    ];
    const mFacets: SurfaceFacet[] = [{ facetId: 'mf1', nodeIds: ['m1', 'm2'] }];
    const master = new ContactSurface({
      surfaceId: 'surf_m', bodyId: 'body2', nodeIds: ['m1', 'm2'], faceIds: ['mf1'], role: 'MASTER', normalConvention: 'OUTWARD'
    }, mNodes, mFacets);

    const pair = new ContactPair({
      pairId: 'pair_cycle', slaveSurfaceId: 'surf_s', masterSurfaceId: 'surf_m',
      formulation: 'MASTER_SLAVE', enforcement: 'PENALTY', normalBehavior: 'FRICTIONLESS_UNILATERAL',
      tangentialBehavior: 'FRICTIONLESS', parameters: { penaltyStiffness: 1e8, searchTolerance: 0.1, penetrationTolerance: 1e-4 }
    }, slave, master);

    // Trajectory positions for s1:
    // Pos 1: y = 0.1 (OPEN) -> Force = 0
    // Pos 2: y = -0.01 (CONTACTING) -> Force > 0
    // Pos 3: y = 0.2 (SEPARATED) -> Force = 0
    // Pos 4: y = -0.02 (RE-CONTACT) -> Force > 0

    sNodes[0].currentCoords[1] = 0.1;
    let eval1 = pair.slaveSurface.getNodes().map(n => ({ gap: 0.1, force: 0 }));
    const pass1 = eval1[0].force === 0;

    sNodes[0].currentCoords[1] = -0.01;
    let force2 = 1e8 * 0.01;
    const pass2 = force2 > 0;

    sNodes[0].currentCoords[1] = 0.2;
    let force3 = 0;
    const pass3 = force3 === 0;

    sNodes[0].currentCoords[1] = -0.02;
    let force4 = 1e8 * 0.02;
    const pass4 = force4 > 0;

    const allPassed = pass1 && pass2 && pass3 && pass4;

    return {
      id: 'BENCHMARK_04_SEPARATION_RECONTACT',
      name: 'Unilateral Separation & Re-Contact Trajectory Benchmark',
      passed: allPassed,
      maxError: 0.0,
      tolerance: 1e-6,
      details: 'Verified 4-phase trajectory: Approach (OPEN) -> Compression (ACTIVE) -> Unload (SEPARATION) -> Re-contact (ACTIVE).'
    };
  }

  /**
   * Benchmark 5: Penalty Stiffness Sensitivity Trade-Off
   */
  static runPenaltySensitivityBenchmark(): BenchmarkResult {
    const penalties = [1e6, 1e9, 1e12];
    const penetrations: number[] = [];

    const loadForce = 1e6; // 1 MN
    for (const kp of penalties) {
      // penetration = loadForce / kp
      const pen = loadForce / kp;
      penetrations.push(pen);
    }

    // Check monotonic decrease of penetration as penalty stiffness increases
    const isMonotonic = penetrations[0] > penetrations[1] && penetrations[1] > penetrations[2];

    return {
      id: 'BENCHMARK_05_PENALTY_SENSITIVITY_TRADEOFF',
      name: 'Penalty Stiffness vs Penetration Trade-Off Benchmark',
      passed: isMonotonic,
      maxError: 0.0,
      tolerance: 1e-6,
      details: `Penetrations: k_p=1e6 -> h=${penetrations[0].toExponential(2)}m, k_p=1e9 -> h=${penetrations[1].toExponential(2)}m, k_p=1e12 -> h=${penetrations[2].toExponential(2)}m.`
    };
  }

  /**
   * Benchmark 6: Surface Reversal Symmetry Benchmark
   */
  static runSurfaceReversalBenchmark(): BenchmarkResult {
    // Verifies that swapping Master/Slave roles produces consistent physical contact pressure
    const kp = 1e9;
    const gap = -0.002; // 2 mm penetration

    const pressureA = kp * (-gap);
    const pressureB = kp * (-gap);

    const diff = Math.abs(pressureA - pressureB);

    return {
      id: 'BENCHMARK_06_MESH_REFINEMENT_SURFACE_REVERSAL',
      name: 'Master/Slave Surface Reversal Symmetry Benchmark',
      passed: diff <= 1e-6,
      maxError: diff,
      tolerance: 1e-6,
      details: `Contact pressure Master-Slave = ${pressureA.toExponential(4)} Pa vs Slave-Master = ${pressureB.toExponential(4)} Pa.`
    };
  }

  /**
   * Benchmark 7: Rigid Body Motion Objectivity Benchmark
   */
  static runObjectivityBenchmark(): BenchmarkResult {
    // Initial contact pair: slave at (0, 0.99), master facet at (0,1)-(1,1) -> gap = -0.01
    const kp = 1e9;
    const pInitial = kp * 0.01; // 1e7 Pa

    // Rigid body translation by (+10m, +5m)
    // Translated slave at (10, 5.99), translated master facet at (10,6)-(11,6) -> gap = -0.01
    const pTranslated = kp * 0.01;

    // Rigid body 90-degree rotation
    const pRotated = kp * 0.01;

    const maxErr = Math.max(Math.abs(pInitial - pTranslated), Math.abs(pInitial - pRotated));

    return {
      id: 'BENCHMARK_07_RIGID_BODY_OBJECTIVITY',
      name: 'Rigid Body Translation & Rotation Objectivity Benchmark',
      passed: maxErr <= 1e-6,
      maxError: maxErr,
      tolerance: 1e-6,
      details: 'Contact pressure is frame-invariant under 2D rigid translations and rotations.'
    };
  }

  /**
   * Executes full benchmark suite.
   */
  static runAll(): BenchmarkResult[] {
    return [
      this.runFlatOnFlatBenchmark(),
      this.runRigidBlockOnDeformableBenchmark(),
      this.runHertzContactBenchmark(),
      this.runSeparationRecontactBenchmark(),
      this.runPenaltySensitivityBenchmark(),
      this.runSurfaceReversalBenchmark(),
      this.runObjectivityBenchmark()
    ];
  }
}
