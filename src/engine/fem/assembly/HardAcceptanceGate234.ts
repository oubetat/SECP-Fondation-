/**
 * SECP CAD/CAE Platform - Hard Acceptance Gate 234
 * PATCH-234 — Global Stiffness Assembly
 *
 * Runs the complete 18-criteria engineering audit battery (234.01 through 234.18)
 * covering DOF management, connectivity, Ke generation, CSR assembly, duplicate accumulation,
 * boundary conditions, matrix diagnostics, symmetry, analytical bar & beam benchmarks,
 * patch test, determinism, adversarial battery, evidence generation, and OS invalidation.
 */

import { FEMNode } from '../mesh/FEMNode';
import { FEMElement } from '../mesh/FEMElement';
import { DOFManager } from './DOFManager';
import { ElementConnectivity } from './ElementConnectivity';
import { ElementStiffnessProvider } from './ElementStiffnessProvider';
import { SparseMatrixBuilder } from './SparseMatrixBuilder';
import { ConstraintAssembler } from './ConstraintAssembler';
import { LoadVectorAssembler } from './LoadVectorAssembler';
import { AssemblyDiagnostics } from './AssemblyDiagnostics';
import { GlobalStiffnessAssembler } from './GlobalStiffnessAssembler';
import { GlobalAssemblyEvidenceEngine } from './GlobalAssemblyEvidenceEngine';
import { Bar1DBenchmark } from './benchmarks/Bar1DBenchmark';
import { CantileverBeamBenchmark } from './benchmarks/CantileverBeamBenchmark';
import { PatchTestBenchmark } from './benchmarks/PatchTestBenchmark';

export interface GateTestCriterion234 {
  testId: string; // e.g. 234.01
  name: string;
  passed: boolean;
  details: string;
}

export interface HardGateResult234 {
  gateId: 'GATE-SECP-234';
  timestamp: string;
  totalTests: number;
  passCount: number;
  overallPassed: boolean;
  results: GateTestCriterion234[];
  evidenceHash: string;
}

export class HardAcceptanceGate234 {
  public static runGate(): HardGateResult234 {
    const results: GateTestCriterion234[] = [];

    // Helper setup sample mesh
    const sampleNodes: FEMNode[] = [
      { id: 'N1', x: 0, y: 0, z: 0, boundaryTags: ['FIXED'], regionIds: ['R1'] },
      { id: 'N2', x: 1, y: 0, z: 0, boundaryTags: [], regionIds: ['R1'] },
      { id: 'N3', x: 2, y: 0, z: 0, boundaryTags: ['LOAD'], regionIds: ['R1'] }
    ];
    const sampleElements: FEMElement[] = [
      { id: 'E1', type: 'BAR', nodeIds: ['N1', 'N2'], regionId: 'R1', materialId: 'MAT_STEEL_S355' },
      { id: 'E2', type: 'BAR', nodeIds: ['N2', 'N3'], regionId: 'R1', materialId: 'MAT_STEEL_S355' }
    ];

    // 234.01 DOF Manager
    try {
      const dofMgr = new DOFManager(sampleNodes, ['UX', 'UY', 'UZ']);
      const totalDOFs = dofMgr.totalDOFs;
      const gIdx = dofMgr.getGlobalDOFIndex('N2', 'UY');
      results.push({
        testId: '234.01',
        name: 'DOF Manager',
        passed: totalDOFs === 9 && typeof gIdx === 'number',
        details: `Allocated ${totalDOFs} DOFs across 3 nodes. N2.UY mapped to global index ${gIdx}.`
      });
    } catch (err: any) {
      results.push({ testId: '234.01', name: 'DOF Manager', passed: false, details: err.message });
    }

    // 234.02 Connectivity Validation
    try {
      const val = ElementConnectivity.validateConnectivity(sampleNodes, sampleElements);
      const invalidNodes: FEMNode[] = [{ id: 'N1', x: 0, y: 0, z: 0, boundaryTags: [], regionIds: [] }];
      const invalidElements: FEMElement[] = [
        { id: 'E_BAD', type: 'BAR', nodeIds: ['N1', 'N_NON_EXISTENT'], regionId: 'R1', materialId: 'MAT_STEEL_S355' }
      ];
      const valBad = ElementConnectivity.validateConnectivity(invalidNodes, invalidElements);

      results.push({
        testId: '234.02',
        name: 'Connectivity Validation',
        passed: val.isValid && !valBad.isValid && valBad.missingNodes.includes('N_NON_EXISTENT'),
        details: `Valid mesh approved. Missing node N_NON_EXISTENT correctly identified.`
      });
    } catch (err: any) {
      results.push({ testId: '234.02', name: 'Connectivity Validation', passed: false, details: err.message });
    }

    // 234.03 Local-to-Global Mapping
    try {
      const dofMgr = new DOFManager(sampleNodes, ['UX', 'UY', 'UZ']);
      const mapping = ElementConnectivity.buildElementDOFMapping(sampleElements[0], dofMgr);
      results.push({
        testId: '234.03',
        name: 'Local-to-Global Mapping',
        passed: mapping.globalDofIndices.length === 6,
        details: `Mapped 6 local DOFs of E1 to global indices: [${mapping.globalDofIndices.join(', ')}].`
      });
    } catch (err: any) {
      results.push({ testId: '234.03', name: 'Local-to-Global Mapping', passed: false, details: err.message });
    }

    // 234.04 Element Ke Generation
    try {
      const nodesMap = new Map(sampleNodes.map((n) => [n.id, n]));
      const keRes = ElementStiffnessProvider.computeElementStiffness(sampleElements[0], nodesMap);
      results.push({
        testId: '234.04',
        name: 'Element Ke Generation',
        passed: keRes.isValid && keRes.Ke.length === 6 && keRes.Ke[0][0] > 0,
        details: `Evaluated 6x6 local stiffness Ke for BAR element E1 (K0,0 = ${(keRes.Ke[0][0] / 1e6).toFixed(1)} MPa/m).`
      });
    } catch (err: any) {
      results.push({ testId: '234.04', name: 'Element Ke Generation', passed: false, details: err.message });
    }

    // 234.05 Sparse Matrix Assembly
    try {
      const builder = new SparseMatrixBuilder(9);
      builder.addEntry(0, 0, 100);
      builder.addEntry(0, 1, -50);
      builder.addEntry(1, 0, -50);
      builder.addEntry(1, 1, 100);
      const csr = builder.assembleCSR();
      results.push({
        testId: '234.05',
        name: 'Sparse Matrix Assembly',
        passed: csr.rows === 9 && csr.nnz === 4 && csr.isCanonical,
        details: `Assembled canonical CSR matrix (9x9, NNZ=4).`
      });
    } catch (err: any) {
      results.push({ testId: '234.05', name: 'Sparse Matrix Assembly', passed: false, details: err.message });
    }

    // 234.06 Duplicate Contribution Handling
    try {
      const builder = new SparseMatrixBuilder(6);
      builder.addElementStiffness([0, 1], [[10, 5], [5, 10]]);
      builder.addElementStiffness([0, 1], [[20, 15], [15, 20]]);
      const csr = builder.assembleCSR();
      const val00 = csr.get(0, 0);
      results.push({
        testId: '234.06',
        name: 'Duplicate Contribution Handling',
        passed: val00 === 30,
        details: `Accumulated duplicate coordinates additively: K(0,0) = 10 + 20 = 30.`
      });
    } catch (err: any) {
      results.push({ testId: '234.06', name: 'Duplicate Contribution Handling', passed: false, details: err.message });
    }

    // 234.07 Global Load Assembly
    try {
      const dofMgr = new DOFManager(sampleNodes);
      const loadRes = LoadVectorAssembler.assembleGlobalLoadVector(dofMgr, [
        { nodeId: 'N3', field: 'UX', magnitude: 5000 }
      ]);
      results.push({
        testId: '234.07',
        name: 'Global Load Assembly',
        passed: loadRes.F_global.length === 9 && loadRes.nodalLoadSum[0] === 5000,
        details: `Assembled RHS load vector with concentrated nodal force 5000 N at N3.UX.`
      });
    } catch (err: any) {
      results.push({ testId: '234.07', name: 'Global Load Assembly', passed: false, details: err.message });
    }

    // 234.08 Boundary Conditions
    try {
      const dofMgr = new DOFManager(sampleNodes);
      dofMgr.setBoundaryCondition('N1', 'UX', 0.0);
      const builder = new SparseMatrixBuilder(9);
      builder.addEntry(0, 0, 100);
      builder.addEntry(0, 1, 50);
      builder.addEntry(1, 0, 50);
      builder.addEntry(1, 1, 100);
      const csr = builder.assembleCSR();

      const { K_mod } = ConstraintAssembler.applyRowColumnModification(csr, new Array(9).fill(0), dofMgr);
      const diag0 = K_mod.get(0, 0);
      const off01 = K_mod.get(0, 1);

      results.push({
        testId: '234.08',
        name: 'Boundary Conditions',
        passed: diag0 === 1.0 && off01 === 0.0,
        details: `Enforced Dirichlet constraint: row 0 zeroed, diagonal set to 1.0.`
      });
    } catch (err: any) {
      results.push({ testId: '234.08', name: 'Boundary Conditions', passed: false, details: err.message });
    }

    // 234.09 Matrix Diagnostics
    try {
      const builder = new SparseMatrixBuilder(3);
      builder.addEntry(0, 0, 10);
      builder.addEntry(1, 1, 20);
      const csr = builder.assembleCSR();
      const diag = SparseMatrixBuilder.diagnoseMatrix(csr);
      results.push({
        testId: '234.09',
        name: 'Matrix Diagnostics',
        passed: diag.hasZeroDiagonal && diag.zeroDiagonalIndices.includes(2),
        details: `Identified unconstrained zero diagonal entry at row index 2.`
      });
    } catch (err: any) {
      results.push({ testId: '234.09', name: 'Matrix Diagnostics', passed: false, details: err.message });
    }

    // 234.10 Symmetry Verification
    try {
      const builder = new SparseMatrixBuilder(2);
      builder.addEntry(0, 0, 100);
      builder.addEntry(0, 1, 25);
      builder.addEntry(1, 0, 25);
      builder.addEntry(1, 1, 100);
      const csr = builder.assembleCSR();
      const diag = SparseMatrixBuilder.diagnoseMatrix(csr);
      results.push({
        testId: '234.10',
        name: 'Symmetry Verification',
        passed: diag.isSymmetric && diag.symmetryErrorNorm < 1e-12,
        details: `Matrix symmetry error norm = ${diag.symmetryErrorNorm.toExponential(2)} (PASSED).`
      });
    } catch (err: any) {
      results.push({ testId: '234.10', name: 'Symmetry Verification', passed: false, details: err.message });
    }

    // 234.11 Analytical Bar Benchmark
    try {
      const barRes = Bar1DBenchmark.runBenchmark(4, 2.0, 0.001, 210e9, 10000);
      results.push({
        testId: '234.11',
        name: 'Analytical Bar Benchmark',
        passed: barRes.passed,
        details: `u_FEM = ${(barRes.uFEM * 1e3).toFixed(4)} mm vs u_analytical = ${(barRes.uAnalytical * 1e3).toFixed(4)} mm (Error: ${(barRes.relativeError * 100).toFixed(4)}%).`
      });
    } catch (err: any) {
      results.push({ testId: '234.11', name: 'Analytical Bar Benchmark', passed: false, details: err.message });
    }

    // 234.12 Cantilever Benchmark
    try {
      const beamRes = CantileverBeamBenchmark.runBenchmark(4, 1.0, 0.05, 0.1, 210e9, 5000);
      results.push({
        testId: '234.12',
        name: 'Cantilever Benchmark',
        passed: beamRes.passed,
        details: `Tip deflection delta_FEM = ${(beamRes.deltaFEM * 1e3).toFixed(3)} mm (solvable FE system verified).`
      });
    } catch (err: any) {
      results.push({ testId: '234.12', name: 'Cantilever Benchmark', passed: false, details: err.message });
    }

    // 234.13 Patch Test
    try {
      const patchRes = PatchTestBenchmark.runPatchTest();
      results.push({
        testId: '234.13',
        name: 'Patch Test',
        passed: patchRes.passed,
        details: `Multi-element patch constant stress transmission verified.`
      });
    } catch (err: any) {
      results.push({ testId: '234.13', name: 'Patch Test', passed: false, details: err.message });
    }

    // 234.14 Determinism
    try {
      const asm1 = new GlobalStiffnessAssembler();
      asm1.setMesh({ id: 'M1', nodes: sampleNodes, elements: sampleElements, boundaries: [], regions: [], timestamp: 0 });
      const res1 = asm1.assembleAndSolve();

      const asm2 = new GlobalStiffnessAssembler();
      asm2.setMesh({ id: 'M1', nodes: sampleNodes, elements: sampleElements, boundaries: [], regions: [], timestamp: 0 });
      const res2 = asm2.assembleAndSolve();

      const match = res1.evidence.matrixFingerprint === res2.evidence.matrixFingerprint;
      results.push({
        testId: '234.14',
        name: 'Determinism',
        passed: match,
        details: `Identical mesh produces exact identical matrix fingerprint: ${res1.evidence.matrixFingerprint}`
      });
    } catch (err: any) {
      results.push({ testId: '234.14', name: 'Determinism', passed: false, details: err.message });
    }

    // 234.15 Adversarial Battery
    try {
      const badElements: FEMElement[] = [
        { id: 'E_ZERO', type: 'BAR', nodeIds: ['N1', 'N1'], regionId: 'R1', materialId: 'MAT_STEEL_S355' }
      ];
      const asm = new GlobalStiffnessAssembler();
      asm.setMesh({ id: 'M_BAD', nodes: sampleNodes, elements: badElements, boundaries: [], regions: [], timestamp: 0 });
      const res = asm.assembleAndSolve();

      results.push({
        testId: '234.15',
        name: 'Adversarial Battery',
        passed: !res.isSolvable && res.diagnostics.preAssemblyAudit.errors.length > 0,
        details: `Gracefully detected degenerate zero-length element E_ZERO without unhandled crash.`
      });
    } catch (err: any) {
      results.push({ testId: '234.15', name: 'Adversarial Battery', passed: false, details: err.message });
    }

    // 234.16 Evidence Generation
    try {
      const asm = new GlobalStiffnessAssembler();
      asm.setMesh({ id: 'M1', nodes: sampleNodes, elements: sampleElements, boundaries: [], regions: [], timestamp: 0 });
      const res = asm.assembleAndSolve();

      results.push({
        testId: '234.16',
        name: 'Evidence Generation',
        passed: res.evidence.evidenceHash.startsWith('GATE234_EVIDENCE_'),
        details: `Generated cryptographic evidence hash: ${res.evidence.evidenceHash}`
      });
    } catch (err: any) {
      results.push({ testId: '234.16', name: 'Evidence Generation', passed: false, details: err.message });
    }

    // 234.17 Industrial OS Invalidation
    try {
      const asm = new GlobalStiffnessAssembler();
      asm.setMesh({ id: 'M1', nodes: sampleNodes, elements: sampleElements, boundaries: [], regions: [], timestamp: 0 });
      asm.invalidateMesh('REV_002');
      const res = asm.assembleAndSolve();

      results.push({
        testId: '234.17',
        name: 'Industrial OS Invalidation',
        passed: res.invalidationState === 'MESH_INVALIDATED',
        details: `Revision update triggered invalidation state MESH_INVALIDATED (PATCH-190 OS compliance).`
      });
    } catch (err: any) {
      results.push({ testId: '234.17', name: 'Industrial OS Invalidation', passed: false, details: err.message });
    }

    // 234.18 Hard Acceptance Gate
    const passCount = results.filter((r) => r.passed).length;
    const overallPassed = passCount === results.length;

    results.push({
      testId: '234.18',
      name: 'Hard Acceptance Gate',
      passed: overallPassed,
      details: overallPassed
        ? 'GATE 234 QUALIFICATION: PASSED 100%'
        : `GATE 234 FAILED (${passCount}/${results.length} passed)`
    });

    let hashInt = 0x811c9dc5;
    const summaryStr = `GATE234_${passCount}_${results.length}_${overallPassed}`;
    for (let i = 0; i < summaryStr.length; i++) {
      hashInt = (hashInt ^ summaryStr.charCodeAt(i)) * 0x01000193;
    }
    const evidenceHash = `GATE234_MASTER_${(hashInt >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

    return {
      gateId: 'GATE-SECP-234',
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passCount: results.filter((r) => r.passed).length,
      overallPassed,
      results,
      evidenceHash
    };
  }
}
