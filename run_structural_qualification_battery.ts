/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-ENGINE-QUALIFICATION-002-FSI-STRUCTURAL-SOLVER-QUALIFICATION-001
 * Comprehensive Independent FEM Qualification Battery Before FSI Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { StructuralAnalysisEngine } from './src/engine/structural-physics/StructuralAnalysisEngine';
import { FEAMesh, BoundaryCondition, LoadDefinition, MaterialProperties } from './src/engine/structural-physics/StructuralPhysicsTypes';
import { MaterialModelEngine } from './src/engine/structural-physics/MaterialModelEngine';
import { RealNafemsBenchmarkEngine } from './src/engine/structural-physics/RealNafemsBenchmarkEngine';
import { FEAValidationEngine } from './src/engine/structural-physics/FEAValidationEngine';

async function runQualificationBattery() {
  console.log('========================================================================');
  console.log('SECP-ENGINE-QUALIFICATION-002-FSI-STRUCTURAL-SOLVER-QUALIFICATION-001');
  console.log('Independent FEM Qualification Before FSI Integration');
  console.log('========================================================================\n');

  const outDir = path.resolve('qualification-002/fsi');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Stage A: Execution Map Generation
  // -------------------------------------------------------------------------
  console.log('[Stage A] Auditing Actual Engine Interfaces & Mapping Execution Flow...');
  const executionMap = {
    qualificationTask: 'SECP-ENGINE-QUALIFICATION-002-FSI-STRUCTURAL-SOLVER-QUALIFICATION-001',
    scope: 'src/engine/structural-physics/',
    entryPoint: 'StructuralAnalysisEngine.runFEA',
    pipelineSteps: [
      {
        step: 1,
        component: 'GlobalAssemblyEngine.assembleSystemWithoutBoundaryPenalty',
        role: 'Assembles unconstrained global stiffness matrix K_unconstrained and nodal force vector F_applied'
      },
      {
        step: 2,
        component: 'ElementFormulationEngine.formulateElementStiffness',
        role: 'Evaluates local element stiffness for BAR_1D, QUAD_2D (isoparametric Quad4), HEX8 via Gauss quadrature'
      },
      {
        step: 3,
        component: 'MaterialModelEngine',
        role: 'Provides verified linear elastic material constants (E, nu, rho, yieldStrength)'
      },
      {
        step: 4,
        component: 'BoundaryConditionEngine & GlobalAssemblyEngine penalty enforcement',
        role: 'Applies Dirichlet boundary constraints via penalty formulation (PENALTY = 1e15)'
      },
      {
        step: 5,
        component: 'LinearSolverAbstraction & PCGSolverEngine',
        role: 'Solves algebraic system K * u = F using Direct Dense / Preconditioned Conjugate Gradient'
      },
      {
        step: 6,
        component: 'StructuralAnalysisEngine (Reactions & Equilibrium)',
        role: 'Computes nodal internal forces F_int = K_unpenalized * u, recovers reaction forces R = F_int - F_applied, and verifies equilibrium error'
      },
      {
        step: 7,
        component: 'StrainAnalysisEngine & StressRecoveryEngine & VonMisesEvaluationEngine',
        role: 'Computes physical strain tensors, axial/bending stresses, and equivalent von Mises profiles'
      },
      {
        step: 8,
        component: 'FEAValidationEngine',
        role: 'Audits numerical finiteness, residual norms, boundary condition satisfaction, and physical realism'
      }
    ],
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-fem-execution-map.json'), JSON.stringify(executionMap, null, 2));

  // -------------------------------------------------------------------------
  // Stage B: Analytical Tensile Rod Benchmark
  // L = 1.0 m, A = 0.001 m^2, E = 200 GPa, F = 10,000 N
  // Analytical: delta = F*L/(A*E) = 5.0e-5 m, sigma = F/A = 10 MPa, R = -10,000 N
  // -------------------------------------------------------------------------
  console.log('\n[Stage B] Running Analytical Tensile Rod Benchmark (FSI-FEM-001)...');
  const L = 1.0;
  const A = 0.001;
  const E = 200e9; // MAT-STEEL
  const F_applied = 10000;

  const rodMesh: FEAMesh = {
    nodes: [
      { id: 1, x: 0, y: 0, z: 0, dofIndices: [0, 1, 2] },
      { id: 2, x: L, y: 0, z: 0, dofIndices: [3, 4, 5] }
    ],
    elements: [
      { id: 1, type: 'BAR_1D', nodeIds: [1, 2], materialId: 'MAT-STEEL', crossSectionArea: A }
    ],
    qualityMetrics: { aspectRatioMin: 1, aspectRatioMax: 1, jacobianDeterminantMin: 1, isValid: true }
  };

  const rodBCs: BoundaryCondition[] = [
    { id: 'bc-fixed-root', nodeId: 1, type: 'FIXED', constrainedDOFs: [true, true, true] }
  ];

  const rodLoads: LoadDefinition[] = [
    { id: 'load-tip-tension', nodeId: 2, forceVector: { x: F_applied, y: 0, z: 0 } }
  ];

  const rodResult = StructuralAnalysisEngine.runFEA('analytical-rod-baseline', rodMesh, rodBCs, rodLoads);
  const tipNode = rodResult.nodes.find(n => n.nodeId === 2);
  const rootNode = rodResult.nodes.find(n => n.nodeId === 1);

  const analyticalDisp = (F_applied * L) / (A * E); // 5.0e-5
  const analyticalStress = F_applied / A;           // 1.0e7
  const analyticalReaction = -F_applied;            // -10000

  const calculatedDisp = tipNode ? tipNode.displacement.x : 0;
  const calculatedStress = tipNode ? tipNode.stress.xx : 0;
  const calculatedReaction = rootNode?.reactionForce?.x ?? 0;

  const dispRelError = Math.abs(calculatedDisp - analyticalDisp) / analyticalDisp;
  const stressRelError = Math.abs(calculatedStress - analyticalStress) / analyticalStress;
  const reactionRelError = Math.abs(calculatedReaction - analyticalReaction) / Math.abs(analyticalReaction);

  console.log(`  Analytical Displacement: ${analyticalDisp.toExponential(6)} m`);
  console.log(`  Calculated Displacement: ${calculatedDisp.toExponential(6)} m (Error: ${(dispRelError * 100).toFixed(4)}%)`);
  console.log(`  Analytical Axial Stress: ${(analyticalStress / 1e6).toFixed(4)} MPa`);
  console.log(`  Calculated Axial Stress: ${(calculatedStress / 1e6).toFixed(4)} MPa (Error: ${(stressRelError * 100).toFixed(4)}%)`);
  console.log(`  Analytical Reaction Force: ${analyticalReaction.toFixed(2)} N`);
  console.log(`  Calculated Reaction Force: ${calculatedReaction.toFixed(2)} N (Error: ${(reactionRelError * 100).toFixed(4)}%)`);

  const rodQualificationPass = dispRelError < 0.001 && stressRelError < 0.001 && reactionRelError < 0.001;
  console.log(`  Stage B Verdict: ${rodQualificationPass ? 'PASS' : 'FAIL'}`);

  const solverQualificationEvidence = {
    testId: 'FSI-FEM-001',
    description: 'Analytical Tensile Rod Solution Verification',
    inputs: {
      lengthM: L,
      crossSectionAreaM2: A,
      youngsModulusPa: E,
      appliedForceN: F_applied,
      materialId: 'MAT-STEEL'
    },
    referenceAnalytical: {
      displacementM: analyticalDisp,
      axialStressPa: analyticalStress,
      reactionForceN: analyticalReaction
    },
    numericalMeasured: {
      displacementM: calculatedDisp,
      axialStressPa: calculatedStress,
      reactionForceN: calculatedReaction,
      equilibriumError: rodResult.equilibriumError
    },
    relativeErrors: {
      displacementRelError: dispRelError,
      stressRelError: stressRelError,
      reactionRelError: reactionRelError
    },
    tolerances: {
      maxAllowedRelError: 0.001 // 0.1% strict tolerance
    },
    verdict: rodQualificationPass ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-structural-solver-qualification.json'), JSON.stringify(solverQualificationEvidence, null, 2));

  // -------------------------------------------------------------------------
  // Stage C: Physical Sensitivity Tests (FEM-SENS-001 to 005)
  // -------------------------------------------------------------------------
  console.log('\n[Stage C] Running Physical Sensitivity Battery (FEM-SENS-001 to 005)...');
  const sensitivityCases: any[] = [];

  // SENS-001: Double Load (2*F) -> 2*delta, 2*sigma
  console.log('  Testing FEM-SENS-001: Double Load (2*F)...');
  const resSens1 = StructuralAnalysisEngine.runFEA(
    'sens-1',
    rodMesh,
    rodBCs,
    [{ id: 'load-double', nodeId: 2, forceVector: { x: 2 * F_applied, y: 0, z: 0 } }]
  );
  const dispSens1 = resSens1.nodes.find(n => n.nodeId === 2)!.displacement.x;
  const stressSens1 = resSens1.nodes.find(n => n.nodeId === 2)!.stress.xx;
  const sens1Pass = Math.abs(dispSens1 / calculatedDisp - 2.0) < 1e-4 && Math.abs(stressSens1 / calculatedStress - 2.0) < 1e-4;
  sensitivityCases.push({
    testId: 'FEM-SENS-001',
    parameter: 'Load F',
    action: 'Double Load from 10,000 N to 20,000 N',
    expectedRatio: 2.0,
    measuredDispRatio: dispSens1 / calculatedDisp,
    measuredStressRatio: stressSens1 / calculatedStress,
    passed: sens1Pass
  });

  // SENS-002: Double Young's Modulus (2*E) -> 0.5*delta
  console.log('  Testing FEM-SENS-002: Double Young Modulus (2*E)...');
  MaterialModelEngine.registerMaterial({
    id: 'MAT-DOUBLE-E',
    name: 'Steel with Double Stiffness',
    youngsModulus: 2 * E,
    poissonsRatio: 0.3,
    yieldStrength: 500e6,
    density: 7850
  });
  const meshSens2: FEAMesh = {
    ...rodMesh,
    elements: [{ ...rodMesh.elements[0], materialId: 'MAT-DOUBLE-E' }]
  };
  const resSens2 = StructuralAnalysisEngine.runFEA('sens-2', meshSens2, rodBCs, rodLoads);
  const dispSens2 = resSens2.nodes.find(n => n.nodeId === 2)!.displacement.x;
  const sens2Pass = Math.abs(dispSens2 / calculatedDisp - 0.5) < 1e-4;
  sensitivityCases.push({
    testId: 'FEM-SENS-002',
    parameter: 'Young Modulus E',
    action: 'Double E from 200 GPa to 400 GPa',
    expectedRatio: 0.5,
    measuredDispRatio: dispSens2 / calculatedDisp,
    passed: sens2Pass
  });

  // SENS-003: Double Cross-Section Area (2*A) -> 0.5*delta, 0.5*sigma
  console.log('  Testing FEM-SENS-003: Double Cross-Section Area (2*A)...');
  const meshSens3: FEAMesh = {
    ...rodMesh,
    elements: [{ ...rodMesh.elements[0], crossSectionArea: 2 * A }]
  };
  const resSens3 = StructuralAnalysisEngine.runFEA('sens-3', meshSens3, rodBCs, rodLoads);
  const dispSens3 = resSens3.nodes.find(n => n.nodeId === 2)!.displacement.x;
  const stressSens3 = resSens3.nodes.find(n => n.nodeId === 2)!.stress.xx;
  const sens3Pass = Math.abs(dispSens3 / calculatedDisp - 0.5) < 1e-4 && Math.abs(stressSens3 / calculatedStress - 0.5) < 1e-4;
  sensitivityCases.push({
    testId: 'FEM-SENS-003',
    parameter: 'Cross Section Area A',
    action: 'Double A from 0.001 m^2 to 0.002 m^2',
    expectedRatio: 0.5,
    measuredDispRatio: dispSens3 / calculatedDisp,
    measuredStressRatio: stressSens3 / calculatedStress,
    passed: sens3Pass
  });

  // SENS-004: Reverse Load (-F) -> -delta, -sigma, +R
  console.log('  Testing FEM-SENS-004: Reverse Load (-F)...');
  const resSens4 = StructuralAnalysisEngine.runFEA(
    'sens-4',
    rodMesh,
    rodBCs,
    [{ id: 'load-reversed', nodeId: 2, forceVector: { x: -F_applied, y: 0, z: 0 } }]
  );
  const dispSens4 = resSens4.nodes.find(n => n.nodeId === 2)!.displacement.x;
  const rxSens4 = resSens4.nodes.find(n => n.nodeId === 1)!.reactionForce!.x;
  const sens4Pass = Math.abs(dispSens4 + calculatedDisp) < 1e-9 && Math.abs(rxSens4 + calculatedReaction) < 1e-4;
  sensitivityCases.push({
    testId: 'FEM-SENS-004',
    parameter: 'Load Direction',
    action: 'Invert axial force sign from +10,000 N to -10,000 N',
    expectedSignDisplacement: -1,
    expectedSignReaction: +1,
    measuredDisp: dispSens4,
    measuredReaction: rxSens4,
    passed: sens4Pass
  });

  // SENS-005: Remove BC -> Detect Singularity / Instability
  console.log('  Testing FEM-SENS-005: Remove BC (Singularity / Rigid Body Motion)...');
  let sens5Pass = false;
  let sens5Message = '';
  try {
    const unconstrainedSolve = StructuralAnalysisEngine.runFEA(
      'sens-5-unconstrained',
      rodMesh,
      [], // No BCs!
      rodLoads
    );
    // If it didn't throw, check whether FEAValidationEngine correctly rejects it
    const validation = FEAValidationEngine.validateResults(unconstrainedSolve, rodMesh, [], rodLoads);
    if (!validation.isValid || !unconstrainedSolve.converged || !isFinite(unconstrainedSolve.maxDisplacement)) {
      sens5Pass = true;
      sens5Message = 'Rejected by FEA validation as unstable/non-physical';
    } else {
      sens5Message = 'FAILED: Unconstrained mechanism passed as valid solution!';
    }
  } catch (err: any) {
    sens5Pass = true;
    sens5Message = `Properly detected and rejected with error: ${err.message}`;
  }
  sensitivityCases.push({
    testId: 'FEM-SENS-005',
    parameter: 'Boundary Conditions',
    action: 'Completely remove Dirichlet boundary conditions (unconstrained body)',
    expectedBehavior: 'Singularity detected or rejected by verification gate',
    observedBehavior: sens5Message,
    passed: sens5Pass
  });

  const allSensitivityPassed = sensitivityCases.every(c => c.passed);
  console.log(`  Stage C Verdict: ${allSensitivityPassed ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(
    path.join(outDir, 'fsi-structural-sensitivity-evidence.json'),
    JSON.stringify({ sensitivityCases, allSensitivityPassed, timestamp: new Date().toISOString() }, null, 2)
  );

  // -------------------------------------------------------------------------
  // Stage D: Equilibrium & Reaction Force Balance Verification
  // -------------------------------------------------------------------------
  console.log('\n[Stage D] Verifying Static Equilibrium & Boundary Reaction Balance...');
  const equilibriumReport = {
    testId: 'FSI-EQUIL-001',
    appliedLoads: rodResult.totalAppliedLoad,
    reactionForces: rodResult.totalReaction,
    sumForces: {
      fx: (rodResult.totalAppliedLoad?.fx || 0) + (rodResult.totalReaction?.fx || 0),
      fy: (rodResult.totalAppliedLoad?.fy || 0) + (rodResult.totalReaction?.fy || 0),
      fz: (rodResult.totalAppliedLoad?.fz || 0) + (rodResult.totalReaction?.fz || 0)
    },
    equilibriumError: rodResult.equilibriumError,
    acceptanceThreshold: 1e-4, // 0.01%
    isEquilibriumSatisfied: (rodResult.equilibriumError || 1) < 1e-4,
    notes: 'Equilibrium verified directly against independent unpenalized stiffness matrix multiplication F_int = K * u'
  };
  console.log(`  Applied Load Fx: ${equilibriumReport.appliedLoads?.fx} N`);
  console.log(`  Reaction Force Rx: ${equilibriumReport.reactionForces?.fx.toFixed(2)} N`);
  console.log(`  Net Equilibrium Residual Fx + Rx: ${equilibriumReport.sumForces.fx.toExponential(4)} N`);
  console.log(`  Relative Equilibrium Error: ${((equilibriumReport.equilibriumError || 0) * 100).toFixed(6)}%`);
  console.log(`  Stage D Verdict: ${equilibriumReport.isEquilibriumSatisfied ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(path.join(outDir, 'fsi-structural-equilibrium-evidence.json'), JSON.stringify(equilibriumReport, null, 2));

  // -------------------------------------------------------------------------
  // Stage E: Failure Detection & Adversarial Input Robustness
  // -------------------------------------------------------------------------
  console.log('\n[Stage E] Running Failure Detection & Solution Quality Battery...');
  const failureBattery: any[] = [];

  // E.1: Invalid Material (Negative Young's Modulus)
  let f1Pass = false;
  try {
    MaterialModelEngine.registerMaterial({
      id: 'MAT-INVALID-E',
      name: 'Invalid Negative E',
      youngsModulus: -100e9,
      poissonsRatio: 0.3,
      yieldStrength: 250e6,
      density: 7850
    });
    const m1: FEAMesh = { ...rodMesh, elements: [{ ...rodMesh.elements[0], materialId: 'MAT-INVALID-E' }] };
    StructuralAnalysisEngine.runFEA('fail-mat', m1, rodBCs, rodLoads);
  } catch (e: any) {
    f1Pass = true;
  }
  failureBattery.push({
    testId: 'FEM-FAIL-001',
    description: 'Reject negative Youngs Modulus',
    passed: f1Pass
  });

  // E.2: NaN / Infinity Force
  let f2Pass = false;
  try {
    const nanLoads = [{ id: 'load-nan', nodeId: 2, forceVector: { x: NaN, y: 0, z: 0 } }];
    const rNan = StructuralAnalysisEngine.runFEA('fail-nan', rodMesh, rodBCs, nanLoads);
    const vNan = FEAValidationEngine.validateResults(rNan, rodMesh, rodBCs, nanLoads);
    if (!vNan.isValid) f2Pass = true;
  } catch (e: any) {
    f2Pass = true;
  }
  failureBattery.push({
    testId: 'FEM-FAIL-002',
    description: 'Reject NaN or Infinite load vectors',
    passed: f2Pass
  });

  // E.3: Distorted Element (Degenerate length L=0)
  let f3Pass = false;
  try {
    const degenerateMesh: FEAMesh = {
      nodes: [
        { id: 1, x: 0, y: 0, z: 0, dofIndices: [0, 1, 2] },
        { id: 2, x: 0, y: 0, z: 0, dofIndices: [3, 4, 5] } // identical coordinates!
      ],
      elements: rodMesh.elements,
      qualityMetrics: { aspectRatioMin: 0, aspectRatioMax: Infinity, jacobianDeterminantMin: 0, isValid: false }
    };
    const rDegen = StructuralAnalysisEngine.runFEA('fail-degen', degenerateMesh, rodBCs, rodLoads);
    const vDegen = FEAValidationEngine.validateResults(rDegen, degenerateMesh, rodBCs, rodLoads);
    if (!vDegen.isValid || !rDegen.converged || !isFinite(rDegen.maxDisplacement)) f3Pass = true;
  } catch (e: any) {
    f3Pass = true;
  }
  failureBattery.push({
    testId: 'FEM-FAIL-003',
    description: 'Reject degenerate zero-length geometry elements',
    passed: f3Pass
  });

  const allFailurePassed = failureBattery.every(c => c.passed);
  console.log(`  Stage E Verdict: ${allFailurePassed ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(
    path.join(outDir, 'fsi-structural-failure-detection.json'),
    JSON.stringify({ failureBattery, allFailurePassed, timestamp: new Date().toISOString() }, null, 2)
  );

  // -------------------------------------------------------------------------
  // Stage F: Independent Benchmark (Real NAFEMS Patch Test)
  // -------------------------------------------------------------------------
  console.log('\n[Stage F] Running Independent NAFEMS Benchmark...');
  let nafemsResult = false;
  let nafemsDetails = '';
  try {
    nafemsResult = RealNafemsBenchmarkEngine.runRealQuadPatchTest();
    nafemsDetails = nafemsResult ? 'NAFEMS Quad4 Constant Stress Patch Test PASS' : 'NAFEMS Quad4 Patch Test FAIL';
  } catch (err: any) {
    nafemsResult = false;
    nafemsDetails = `NAFEMS Benchmark error: ${err.message}`;
  }
  console.log(`  NAFEMS Benchmark Result: ${nafemsResult ? 'PASS' : 'FAIL'} (${nafemsDetails})`);
  console.log(`  Stage F Verdict: ${nafemsResult ? 'PASS' : 'FAIL'}`);

  const benchmarkEvidence = {
    testId: 'FSI-BENCH-001',
    benchmarkName: 'NAFEMS Standard 2D Quad4 Constant Stress Patch Test',
    engine: 'RealNafemsBenchmarkEngine',
    passed: nafemsResult,
    details: nafemsDetails,
    standardReference: 'NAFEMS Standard Benchmark Test No. 1: Membrane Patch Test',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-structural-benchmark-evidence.json'), JSON.stringify(benchmarkEvidence, null, 2));

  // -------------------------------------------------------------------------
  // Stage G: Qualification Gap Register & Final Structural Verdict
  // -------------------------------------------------------------------------
  console.log('\n[Stage G] Assembling Structural Qualification Gap Register...');
  const gaps: any[] = [];
  if (!rodQualificationPass) {
    gaps.push({ gapId: 'GAP-FEM-001', severity: 'BLOCKER', description: 'Analytical rod test did not converge within 0.1% tolerance.' });
  }
  if (!allSensitivityPassed) {
    gaps.push({ gapId: 'GAP-FEM-002', severity: 'CRITICAL', description: 'Physical sensitivity tests failed to demonstrate linear physical response.' });
  }
  if (!equilibriumReport.isEquilibriumSatisfied) {
    gaps.push({ gapId: 'GAP-FEM-003', severity: 'BLOCKER', description: 'Equilibrium force balance error exceeds 0.01% threshold.' });
  }
  if (!allFailurePassed) {
    gaps.push({ gapId: 'GAP-FEM-004', severity: 'MAJOR', description: 'Failure detection battery missed adversarial invalid input.' });
  }
  if (!nafemsResult) {
    gaps.push({ gapId: 'GAP-FEM-005', severity: 'MAJOR', description: 'NAFEMS Quad4 Patch Test benchmark failed.' });
  }

  // Document Scope limitation
  gaps.push({
    gapId: 'GAP-SCOPE-LIMITATION',
    severity: 'INFO',
    description: 'Structural solver qualification is currently established for 1D axial truss/bar elements and 2D membrane quad elements. 3D solid continuum elements (TET4/HEX8) require integration with SECP077CleanRoomKernel before qualifying 3D solid FSI.'
  });

  const structuralQualificationVerdict = (gaps.filter(g => g.severity === 'BLOCKER' || g.severity === 'CRITICAL').length === 0)
    ? 'QUALIFIED_FOR_BAR_AND_QUAD'
    : 'FAIL_NUMERICAL_OR_PHYSICAL_DEFECT';

  const gapRegister = {
    campaignId: 'SECP-ENGINE-QUALIFICATION-002-FSI-STRUCTURAL-SOLVER-QUALIFICATION-001',
    verdict: structuralQualificationVerdict,
    gaps,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-structural-qualification-gap-register.json'), JSON.stringify(gapRegister, null, 2));

  console.log('\n========================================================================');
  console.log('QUALIFICATION SUMMARY:');
  console.log(`  Stage B (Analytical Rod):        ${rodQualificationPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Stage C (Physical Sensitivity):   ${allSensitivityPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Stage D (Static Equilibrium):     ${equilibriumReport.isEquilibriumSatisfied ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Stage E (Failure Detection):      ${allFailurePassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Stage F (NAFEMS Benchmark):       ${nafemsResult ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  OVERALL STRUCTURAL VERDICT:       ${structuralQualificationVerdict}`);
  console.log('========================================================================\n');
}

runQualificationBattery().catch(console.error);
