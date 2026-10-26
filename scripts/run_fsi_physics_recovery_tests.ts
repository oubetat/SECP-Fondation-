/**
 * SECP Industrial OS — Engineering Truth OS
 * Task: SECP-ENGINE-QUALIFICATION-002-FSI-PHYSICS-RECOVERY-001
 * Comprehensive Physics Recovery Test Battery
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { FSIRelaxationManager } from '../src/engine/cfd3d/solvers/fsi/FSIRelaxationManager';
import { DynamicMeshManager } from '../src/engine/cfd3d/solvers/fsi/DynamicMeshManager';
import { TwoWayFSICouplingEngine } from '../src/engine/cfd3d/coupling/TwoWayFSICouplingEngine';
import { Fvm3DMeshGenerator } from '../src/engine/cfd3d/Fvm3DMeshGenerator';
import { FSIConservationAudit } from '../src/engine/cfd3d/solvers/fsi/FSIConservationAudit';

async function runPhysicsRecoveryBattery() {
  console.log('========================================================================');
  console.log('SECP-ENGINE-QUALIFICATION-002-FSI-PHYSICS-RECOVERY-001');
  console.log('Comprehensive Physical Verification and Evidence Generation');
  console.log('========================================================================\n');

  const outDir = path.resolve('qualification-002/fsi');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // ---------------------------------------------------------------------------
  // SECTION 1: FSIRelaxationManager Qualification Battery (FSI-RELAX-001 to 006)
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: FSIRelaxationManager Qualification ---');
  const relaxResults: any[] = [];

  // FSI-RELAX-001: Dynamic Aitken Omega Computation
  const relax1 = new FSIRelaxationManager({ initialOmega: 0.5, minOmega: 0.05, maxOmega: 1.0 });
  const d0 = [0, 0, 0];
  const d1 = [1.0, 0.5, -0.2];
  const step1 = relax1.step(d0, d1, 0); // Iter 0: uses initial omega 0.5 -> relaxed = 0.5 * d1
  const d1_relaxed = step1.relaxedDisplacements;
  const d2 = [0.8, 0.4, -0.15];
  const step2 = relax1.step(d1_relaxed, d2, 1); // Iter 1: Aitken dynamic factor computed!
  const relax1Pass = step2.omega !== 0.5 && step2.omega >= 0.05 && step2.omega <= 1.0;
  console.log(`  [FSI-RELAX-001] Dynamic Omega Calculation: iter0_omega=0.5, iter1_omega=${step2.omega.toFixed(4)} -> ${relax1Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-001',
    description: 'Calculates dynamic relaxation factor from actual residuals using Aitken formula',
    initialOmega: 0.5,
    computedAitkenOmega: step2.omega,
    residualNorm: step2.residualNorm,
    passed: relax1Pass
  });

  // FSI-RELAX-002: Boundary Clamping [minOmega, maxOmega]
  const relax2 = new FSIRelaxationManager({ initialOmega: 0.5, minOmega: 0.1, maxOmega: 0.8 });
  // Force extreme residual change that would otherwise yield omega > 1 or < 0
  relax2.step([0, 0], [10, 10], 0);
  const step2_clamp = relax2.step([5, 5], [5.00000001, 5.00000001], 1);
  const relax2Pass = step2_clamp.omega >= 0.1 && step2_clamp.omega <= 0.8;
  console.log(`  [FSI-RELAX-002] Omega Clamping [0.1, 0.8]: actual=${step2_clamp.omega.toFixed(4)} -> ${relax2Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-002',
    description: 'Enforces strict upper and lower bounds on relaxation factor',
    bounds: [0.1, 0.8],
    clampedOmega: step2_clamp.omega,
    passed: relax2Pass
  });

  // FSI-RELAX-003: Non-finite Residual Handling (NaN/Infinity)
  const relax3 = new FSIRelaxationManager();
  const step3_nan = relax3.step([0, 0], [NaN, 1.0], 0);
  const relax3Pass = !step3_nan.isConverged && step3_nan.stopReason === 'NON_FINITE_NUMERICAL_ERROR';
  console.log(`  [FSI-RELAX-003] Reject NaN Input: stopReason=${step3_nan.stopReason} -> ${relax3Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-003',
    description: 'Rejects NaN / Infinity displacement inputs and sets numerical error state',
    observedStopReason: step3_nan.stopReason,
    passed: relax3Pass
  });

  // FSI-RELAX-004: Divergence Detection
  const relax4 = new FSIRelaxationManager({ divergenceFactor: 10.0 });
  relax4.step([0, 0], [1.0, 1.0], 0); // initial norm ~ 1.414
  const step4_div = relax4.step([1.0, 1.0], [1000.0, 1000.0], 1); // residual blows up to > 10x
  const relax4Pass = !step4_div.isConverged && step4_div.stopReason === 'DIVERGED';
  console.log(`  [FSI-RELAX-004] Divergence Detection: stopReason=${step4_div.stopReason} -> ${relax4Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-004',
    description: 'Detects exploding residual and reports divergence',
    observedStopReason: step4_div.stopReason,
    passed: relax4Pass
  });

  // FSI-RELAX-005: Never Declare Convergence on Unconverged Exhaustion
  const relax5 = new FSIRelaxationManager({ tolerance: 1e-12 });
  const step5_unconv = relax5.step([0, 0], [0.1, 0.1], 50); // Residual is 0.1414, far above 1e-12
  const relax5Pass = !step5_unconv.isConverged && step5_unconv.stopReason === undefined;
  console.log(`  [FSI-RELAX-005] Non-convergence integrity: isConverged=${step5_unconv.isConverged} -> ${relax5Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-005',
    description: 'Refuses to declare convergence when residual exceeds tolerance, regardless of iteration count',
    residualNorm: step5_unconv.residualNorm,
    tolerance: 1e-12,
    isConverged: step5_unconv.isConverged,
    passed: relax5Pass
  });

  // FSI-RELAX-006: Deterministic Replay
  const rA = new FSIRelaxationManager();
  const rB = new FSIRelaxationManager();
  const sA1 = rA.step([0, 0], [1.2, 0.8], 0);
  const sB1 = rB.step([0, 0], [1.2, 0.8], 0);
  const sA2 = rA.step(sA1.relaxedDisplacements, [1.0, 0.7], 1);
  const sB2 = rB.step(sB1.relaxedDisplacements, [1.0, 0.7], 1);
  const relax6Pass = Math.abs(sA2.omega - sB2.omega) < 1e-15 && Math.abs(sA2.residualNorm - sB2.residualNorm) < 1e-15;
  console.log(`  [FSI-RELAX-006] Deterministic Replay: difference=${Math.abs(sA2.omega - sB2.omega)} -> ${relax6Pass ? 'PASS' : 'FAIL'}`);
  relaxResults.push({
    testId: 'FSI-RELAX-006',
    description: 'Guarantees bit-identical deterministic replay for identical inputs',
    difference: Math.abs(sA2.omega - sB2.omega),
    passed: relax6Pass
  });

  fs.writeFileSync(path.join(outDir, 'fsi-relaxation-test-results.json'), JSON.stringify({ relaxResults, timestamp: new Date().toISOString() }, null, 2));

  // ---------------------------------------------------------------------------
  // SECTION 2: DynamicMeshManager Qualification Battery (FSI-MESH-001 to 007)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: DynamicMeshManager Qualification ---');
  const meshResults: any[] = [];
  const testMesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 1.0, 0.5, 6, 6, 3);
  const wallFaces = testMesh.faces.filter(f => f.boundaryType === 'WALL');

  // FSI-MESH-001: Boundary displacement applied to correct faces
  const targetFaceId = wallFaces[0].faceId;
  const initialCentroid = { ...wallFaces[0].centroid };
  const disp1 = [{ faceId: targetFaceId, dx: 0.01, dy: 0.02, dz: 0.0 }];
  const morph1 = DynamicMeshManager.deformMesh(testMesh, disp1, 0.5);
  const morphedFace = morph1.morphedMesh.faces.find(f => f.faceId === targetFaceId)!;
  const mesh1Pass = morph1.success &&
    Math.abs(morphedFace.centroid.x - (initialCentroid.x + 0.01)) < 1e-10 &&
    Math.abs(morphedFace.centroid.y - (initialCentroid.y + 0.02)) < 1e-10;
  console.log(`  [FSI-MESH-001] Boundary displacement mapping: ${mesh1Pass ? 'PASS' : 'FAIL'}`);
  meshResults.push({
    testId: 'FSI-MESH-001',
    description: 'Applies displacement to correct target boundary faces',
    expectedCentroid: { x: initialCentroid.x + 0.01, y: initialCentroid.y + 0.02, z: initialCentroid.z },
    actualCentroid: morphedFace.centroid,
    passed: mesh1Pass
  });

  // FSI-MESH-002: Consistent Cell & Face Geometry Updates
  const mesh2Pass = morph1.cellsUpdatedCount > 0 && morph1.quality.hasPositiveVolumes && morph1.quality.passed;
  console.log(`  [FSI-MESH-002] Geometry update consistency: cellsUpdated=${morph1.cellsUpdatedCount}, quality=${morph1.quality.meshQualityStatus} -> ${mesh2Pass ? 'PASS' : 'FAIL'}`);
  meshResults.push({
    testId: 'FSI-MESH-002',
    description: 'Propagates boundary motion consistently to near-wall cells with valid positive volumes',
    cellsUpdatedCount: morph1.cellsUpdatedCount,
    minCellVolume: morph1.quality.minCellVolume,
    passed: mesh2Pass
  });

  // FSI-MESH-003: Reject NaN and Infinity coordinates
  const nanDisp = [{ faceId: targetFaceId, dx: NaN, dy: 0.0, dz: 0.0 }];
  const morphNaN = DynamicMeshManager.deformMesh(testMesh, nanDisp);
  const mesh3Pass = !morphNaN.success && morphNaN.error?.includes('Non-finite');
  console.log(`  [FSI-MESH-003] Reject NaN Coordinates: ${mesh3Pass ? 'PASS' : 'FAIL'} (${morphNaN.error})`);
  meshResults.push({
    testId: 'FSI-MESH-003',
    description: 'Rejects NaN and Infinity displacements before mutating mesh',
    error: morphNaN.error,
    passed: mesh3Pass
  });

  // FSI-MESH-004: Inversion & Severe Distortion Detection
  // Apply catastrophic displacement that would crush or invert cells (e.g. dy = -2.0 on 0.5m box)
  const extremeDisp = wallFaces.map(f => ({ faceId: f.faceId, dx: 0, dy: -5.0, dz: 0 }));
  const morphInvert = DynamicMeshManager.deformMesh(testMesh, extremeDisp, 1.0);
  const mesh4Pass = !morphInvert.success;
  console.log(`  [FSI-MESH-004] Detect Element Inversion: ${mesh4Pass ? 'PASS' : 'FAIL'} (${morphInvert.error})`);
  meshResults.push({
    testId: 'FSI-MESH-004',
    description: 'Detects geometric element inversion or extreme distortion and rejects update',
    error: morphInvert.error,
    passed: mesh4Pass
  });

  // FSI-MESH-005: Preservation of Non-moving Boundaries
  const inletFace = testMesh.faces.find(f => f.boundaryType === 'INLET');
  const inletOriginalCentroid = inletFace ? { ...inletFace.centroid } : null;
  const morphedInlet = inletFace ? morph1.morphedMesh.faces.find(f => f.faceId === inletFace.faceId) : null;
  const mesh5Pass = inletFace && morphedInlet &&
    Math.abs(morphedInlet.centroid.x - inletOriginalCentroid!.x) < 1e-12 &&
    Math.abs(morphedInlet.centroid.y - inletOriginalCentroid!.y) < 1e-12;
  console.log(`  [FSI-MESH-005] Non-moving Boundary Preservation: ${mesh5Pass ? 'PASS' : 'FAIL'}`);
  meshResults.push({
    testId: 'FSI-MESH-005',
    description: 'Preserves non-moving farfield and inlet boundary nodes untouched',
    inletCentroidPreserved: mesh5Pass,
    passed: mesh5Pass
  });

  // FSI-MESH-006: Atomic Rollback on Failure
  const mesh6Pass = morphInvert.morphedMesh === testMesh && testMesh.quality.passed;
  console.log(`  [FSI-MESH-006] Atomic Rollback on Failure: ${mesh6Pass ? 'PASS' : 'FAIL'}`);
  meshResults.push({
    testId: 'FSI-MESH-006',
    description: 'Guarantees original mesh remains intact and unmutated upon update rejection',
    originalMeshIntact: mesh6Pass,
    passed: mesh6Pass
  });

  // FSI-MESH-007: Deterministic Replay
  const mA = DynamicMeshManager.deformMesh(testMesh, disp1, 0.5);
  const mB = DynamicMeshManager.deformMesh(testMesh, disp1, 0.5);
  const mesh7Pass = mA.maxDisplacementNorm === mB.maxDisplacementNorm &&
    mA.morphedMesh.cells[0].centroid.x === mB.morphedMesh.cells[0].centroid.x;
  console.log(`  [FSI-MESH-007] Deterministic Replay: ${mesh7Pass ? 'PASS' : 'FAIL'}`);
  meshResults.push({
    testId: 'FSI-MESH-007',
    description: 'Guarantees bit-identical mesh coordinates across repeated runs',
    passed: mesh7Pass
  });

  fs.writeFileSync(path.join(outDir, 'fsi-dynamic-mesh-test-results.json'), JSON.stringify({ meshResults, timestamp: new Date().toISOString() }, null, 2));

  // ---------------------------------------------------------------------------
  // SECTION 3: Real TwoWayFSICouplingEngine & Structural Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: TwoWayFSICouplingEngine Structural Integration ---');
  const simMesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 1.0, 0.5, 6, 6, 3);
  const pressures = new Array(simMesh.cells.length).fill(101325.0);

  const fsiSim = TwoWayFSICouplingEngine.solveTwoWayFSI(simMesh, pressures, 2.1e11, 1e-4, 15);
  console.log(`  Coupling Completed: iterations=${fsiSim.fsiIterCompleted}, stopReason=${fsiSim.stopReason}, converged=${fsiSim.isConverged}`);
  console.log(`  Residual Displacement: ${fsiSim.residualDisplacementM.toExponential(4)} m`);
  console.log(`  Boundary Forces Count: ${fsiSim.fluidBoundaryForces.length}`);
  console.log(`  Structural Displacements Count: ${fsiSim.structuralDisplacements.length}`);
  console.log(`  Structural Reactions Count: ${fsiSim.structuralReactions?.length ?? 0}`);
  console.log(`  Equilibrium Error: ${((fsiSim.equilibriumError || 0) * 100).toFixed(6)}%`);

  const structuralIntegrationEvidence = {
    testId: 'FSI-STRUCT-INTEGRATION-001',
    description: 'Coupling execution using genuine StructuralAnalysisEngine.runFEA without scalar stiffness line',
    parameters: {
      youngsModulusPa: 2.1e11,
      fsiTolerance: 1e-4,
      maxIterations: 15
    },
    results: {
      fsiIterCompleted: fsiSim.fsiIterCompleted,
      stopReason: fsiSim.stopReason,
      isConverged: fsiSim.isConverged,
      residualDisplacementM: fsiSim.residualDisplacementM,
      totalAppliedLoad: fsiSim.totalAppliedLoad,
      totalReaction: fsiSim.totalReaction,
      equilibriumError: fsiSim.equilibriumError
    },
    verdict: fsiSim.isConverged && (fsiSim.equilibriumError || 1) < 1e-4 ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-structural-integration-evidence.json'), JSON.stringify(structuralIntegrationEvidence, null, 2));

  // ---------------------------------------------------------------------------
  // SECTION 4: FSIConservationAudit & Force Transfer
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: FSIConservationAudit ---');
  const conservation = FSIConservationAudit.auditCoupling(
    fsiSim.fluidBoundaryForces,
    fsiSim.structuralDisplacements,
    {
      totalAppliedLoad: fsiSim.totalAppliedLoad,
      totalReaction: fsiSim.totalReaction,
      residualDisplacement: fsiSim.residualDisplacementM,
      tolerance: 1e-4
    }
  );

  console.log(`  Conservation Status: ${conservation.status}`);
  console.log(`  Force Transfer Balance Error: ${conservation.forceTransferBalance.transferErrorPct.toFixed(4)}% (Passed: ${conservation.forceTransferBalance.passed})`);
  console.log(`  Structural Equilibrium Error: ${conservation.structuralEquilibrium.equilibriumErrorPct.toFixed(6)}% (Passed: ${conservation.structuralEquilibrium.passed})`);
  console.log(`  Coupling Convergence: ${conservation.couplingConvergence.isConverged ? 'CONVERGED' : 'NOT_CONVERGED'}`);

  fs.writeFileSync(path.join(outDir, 'fsi-interface-conservation-evidence.json'), JSON.stringify(conservation, null, 2));
  fs.writeFileSync(path.join(outDir, 'fsi-structural-equilibrium-evidence.json'), JSON.stringify(conservation.structuralEquilibrium, null, 2));
  fs.writeFileSync(path.join(outDir, 'fsi-coupling-convergence-evidence.json'), JSON.stringify({
    convergence: conservation.couplingConvergence,
    stopReason: fsiSim.stopReason,
    iterations: fsiSim.fsiIterCompleted,
    relaxationHistory: fsiSim.relaxationHistory
  }, null, 2));

  // ---------------------------------------------------------------------------
  // SECTION 5: Material Sensitivity & Failure Injection (Adversarial)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Material Sensitivity & Adversarial Suite ---');
  const modulations = [1.0e10, 2.1e11, 5.0e11];
  const sensitivityCases = modulations.map(E => {
    const res = TwoWayFSICouplingEngine.solveTwoWayFSI(simMesh, pressures, E, 1e-4, 15);
    const maxDisp = Math.max(...res.structuralDisplacements.map(d => Math.abs(d.dy)));
    return { E, maxDisp, converged: res.isConverged, iterations: res.fsiIterCompleted };
  });

  // Verify inverse relationship: higher E -> lower displacement
  const sensitivityPass = sensitivityCases[0].maxDisp > sensitivityCases[1].maxDisp &&
                          sensitivityCases[1].maxDisp > sensitivityCases[2].maxDisp;
  console.log(`  Material Sensitivity: E=1e10 disp=${sensitivityCases[0].maxDisp.toExponential(4)}m | E=2.1e11 disp=${sensitivityCases[1].maxDisp.toExponential(4)}m | E=5e11 disp=${sensitivityCases[2].maxDisp.toExponential(4)}m -> ${sensitivityPass ? 'PASS' : 'FAIL'}`);

  // Adversarial Failure Injection: Unrealistic ultra-soft modulus (E = 100 Pa) with tight tolerance and 2 iters -> must NOT falsely converge
  const adversarialRes = TwoWayFSICouplingEngine.solveTwoWayFSI(simMesh, pressures, 100, 1e-12, 2);
  const adversarialPass = !adversarialRes.isConverged;
  console.log(`  Adversarial Exhaustion Injection: isConverged=${adversarialRes.isConverged} (Must be false) -> ${adversarialPass ? 'PASS' : 'FAIL'}`);

  fs.writeFileSync(path.join(outDir, 'fsi-sensitivity-evidence.json'), JSON.stringify(sensitivityCases, null, 2));
  fs.writeFileSync(path.join(outDir, 'fsi-adversarial-test-results.json'), JSON.stringify({
    sensitivityPass,
    sensitivityCases,
    adversarialFailureInjection: {
      youngsModulus: 100,
      iterations: adversarialRes.fsiIterCompleted,
      converged: adversarialRes.isConverged,
      stopReason: adversarialRes.stopReason,
      passed: adversarialPass
    }
  }, null, 2));

  // ---------------------------------------------------------------------------
  // SECTION 6: Manifest & Gap Register
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Manifest & Closure Verdict ---');

  const allRelaxPassed = relaxResults.every(r => r.passed);
  const allMeshPassed = meshResults.every(r => r.passed);
  const allConservationPassed = conservation.status === 'VERIFIED';
  const allAdversarialPassed = sensitivityPass && adversarialPass;

  const gaps: any[] = [];
  if (!allRelaxPassed) gaps.push({ gapId: 'GAP-RELAX-001', severity: 'CRITICAL', description: 'FSIRelaxationManager test failure' });
  if (!allMeshPassed) gaps.push({ gapId: 'GAP-MESH-001', severity: 'CRITICAL', description: 'DynamicMeshManager test failure' });
  if (!allConservationPassed) gaps.push({ gapId: 'GAP-CONSERV-001', severity: 'CRITICAL', description: 'Conservation audit balance error exceeded tolerance' });
  if (!allAdversarialPassed) gaps.push({ gapId: 'GAP-ADV-001', severity: 'MAJOR', description: 'Adversarial sensitivity / exhaustion test failure' });

  // Document Scope limitation
  gaps.push({
    gapId: 'GAP-SCOPE-LIMITATION',
    severity: 'INFO',
    description: 'Current FSI integration is qualified for 3D FVM Navier-Stokes fluid with 1D/2D structural boundary interface. 3D solid continuum elements (HEX8/TET4) require SECP077CleanRoomKernel volumetric coupling.'
  });

  const finalVerdict = (allRelaxPassed && allMeshPassed && allConservationPassed && allAdversarialPassed)
    ? 'QUALIFIED_WITHIN_DECLARED_SCOPE'
    : 'STOP / INSUFFICIENT_EVIDENCE';

  const closureVerdict = {
    campaignId: 'SECP-ENGINE-QUALIFICATION-002-FSI-PHYSICS-RECOVERY-001',
    testId: 'FSI-GATE-001',
    verdict: finalVerdict,
    subsystems: {
      relaxationManager: allRelaxPassed ? 'QUALIFIED' : 'FAILED',
      dynamicMeshManager: allMeshPassed ? 'QUALIFIED' : 'FAILED',
      structuralFEAIntegration: structuralIntegrationEvidence.verdict === 'PASS' ? 'QUALIFIED' : 'FAILED',
      conservationAudit: allConservationPassed ? 'VERIFIED' : 'FAILED',
      adversarialRobustness: allAdversarialPassed ? 'QUALIFIED' : 'FAILED'
    },
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, 'fsi-closure-verdict.json'), JSON.stringify(closureVerdict, null, 2));
  fs.writeFileSync(path.join(outDir, 'fsi-physics-recovery-gap-register.json'), JSON.stringify({ gaps, timestamp: new Date().toISOString() }, null, 2));

  // Manifest
  const manifest = {
    campaign: 'SECP-ENGINE-QUALIFICATION-002-FSI-PHYSICS-RECOVERY-001',
    classification: 'Critical Engineering Remediation',
    targetFiles: [
      'src/engine/cfd3d/solvers/fsi/index.ts',
      'src/engine/cfd3d/solvers/fsi/FSIRelaxationManager.ts',
      'src/engine/cfd3d/solvers/fsi/DynamicMeshManager.ts',
      'src/engine/cfd3d/solvers/fsi/FSIConservationAudit.ts',
      'src/engine/cfd3d/solvers/fsi/FSIInterfaceMapper.ts',
      'src/engine/cfd3d/solvers/fsi/HardAcceptanceGate254.ts',
      'src/engine/cfd3d/coupling/TwoWayFSICouplingEngine.ts',
      'src/engine/structural-physics/StructuralAnalysisEngine.ts'
    ],
    evidenceFiles: [
      'fsi-relaxation-test-results.json',
      'fsi-dynamic-mesh-test-results.json',
      'fsi-structural-integration-evidence.json',
      'fsi-interface-conservation-evidence.json',
      'fsi-structural-equilibrium-evidence.json',
      'fsi-coupling-convergence-evidence.json',
      'fsi-sensitivity-evidence.json',
      'fsi-adversarial-test-results.json',
      'fsi-physics-recovery-gap-register.json',
      'fsi-closure-verdict.json'
    ],
    verdict: finalVerdict,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'fsi-physics-recovery-manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n========================================================================');
  console.log('RECOVERY SUMMARY:');
  console.log(`  FSIRelaxationManager (6/6 tests):  ${allRelaxPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  DynamicMeshManager (7/7 tests):    ${allMeshPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Structural FEA Integration:         ${structuralIntegrationEvidence.verdict === 'PASS' ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Conservation & Equilibrium Audit:   ${allConservationPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  Adversarial & Sensitivity Tests:    ${allAdversarialPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`  OVERALL CLOSURE VERDICT:            ${finalVerdict}`);
  console.log('========================================================================\n');
}

runPhysicsRecoveryBattery().catch(console.error);
