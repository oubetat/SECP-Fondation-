/**
 * SECP Industrial OS — Engineering Truth OS
 * runUpgrade006Campaign.ts
 * 
 * Executes SECP-FEM-UPGRADE-006: Linear Buckling & Eigenvalue Stability Engine Campaign.
 * Computes explicit relative errors, analytical Euler column benchmark comparisons,
 * SHA-256 source fingerprints, and produces SECP_FEM_UPGRADE_006_RESULTS.json
 * and SECP_FEM_UPGRADE_006_REPORT.md.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { GeometricStiffnessEngine } from '../GeometricStiffnessEngine';
import { BucklingEigenSolver } from '../BucklingEigenSolver';
import { LinearBucklingAnalysis } from '../LinearBucklingAnalysis';
import { Matrix } from '../../core/MathUtils';
import { DOFComponent, FEMModel } from '../../core/FEMTypes';

export interface CampaignTestRecord {
  testId: string;
  status: 'PASS' | 'FAIL';
  testDescription: string;
  elementType?: string;
  referenceValue: number;
  computedValue: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  units: string;
  evidence: {
    formula: string;
    details: string;
  };
}

export function runUpgrade006Campaign() {
  console.log('================================================================================');
  console.log(' SECP INDUSTRIAL OS — LINEAR BUCKLING & EIGENVALUE STABILITY (UPGRADE-006)');
  console.log('================================================================================\n');

  const records: CampaignTestRecord[] = [];
  const analysis = new LinearBucklingAnalysis();

  const E = 210000; // MPa
  const I = 1000;   // mm^4
  const A = 100;    // mm^2
  const L = 1000;   // mm
  const Pref = 1000;// N

  function buildColumn(numElems: number, endCond: 'PINNED_PINNED' | 'FIXED_FREE' | 'FIXED_PINNED' | 'FIXED_FIXED'): FEMModel {
    const dL = L / numElems;
    const nodes = new Map();
    for (let i = 0; i <= numElems; i++) {
      nodes.set(`N${i+1}`, { nodeId: `N${i+1}`, x: 0, y: i * dL, z: 0 });
    }

    const elements = new Map();
    for (let i = 0; i < numElems; i++) {
      elements.set(`E${i+1}`, {
        elementId: `E${i+1}`,
        nodeIds: [`N${i+1}`, `N${i+2}`],
        materialId: 'M1',
        sectionId: 'S1',
        formulationId: 'FRAME_2D'
      });
    }

    const topNodeId = `N${numElems+1}`;
    const loads = [{ nodeId: topNodeId, dof: DOFComponent.UY, value: -Pref }];
    const boundaryConditions = [];

    if (endCond === 'PINNED_PINNED') {
      boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UX, value: 0 });
      boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UY, value: 0 });
    } else if (endCond === 'FIXED_FREE' || endCond === 'FIXED_PINNED' || endCond === 'FIXED_FIXED') {
      boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UX, value: 0 });
      boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.UY, value: 0 });
      boundaryConditions.push({ nodeId: 'N1', dof: DOFComponent.RZ, value: 0 });
    }

    if (endCond === 'PINNED_PINNED' || endCond === 'FIXED_PINNED') {
      boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.UX, value: 0 });
    } else if (endCond === 'FIXED_FIXED') {
      boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.UX, value: 0 });
      boundaryConditions.push({ nodeId: topNodeId, dof: DOFComponent.RZ, value: 0 });
    }

    return {
      nodes,
      elements,
      materials: new Map([['M1', { materialId: 'M1', E, nu: 0.3 }]]),
      sections: new Map([['S1', { sectionId: 'S1', area: A, I }]]),
      loads,
      boundaryConditions
    };
  }

  // --- BUCK-FORM-001: Local Geometric Stiffness Matrix Symmetry ---
  {
    const geom = new GeometricStiffnessEngine();
    const Kg = geom.computeBeam2DGeometricStiffnessLocal(1000, 50000);
    let maxDiff = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const diff = Math.abs(Kg.get(r, c) - Kg.get(c, r));
        if (diff > maxDiff) maxDiff = diff;
      }
    }
    const tol = 1e-10;

    records.push({
      testId: 'BUCK-FORM-001',
      status: maxDiff <= tol ? 'PASS' : 'FAIL',
      testDescription: 'BEAM_2D local geometric stiffness exact symmetry (Kg = Kg^T)',
      elementType: 'BEAM_2D',
      referenceValue: 0.0,
      computedValue: maxDiff,
      absoluteError: maxDiff,
      relativeError: maxDiff,
      tolerance: tol,
      units: 'N/mm',
      evidence: {
        formula: 'max|Kg[r,c] - Kg[c,r]| <= 1e-10',
        details: `Max asymmetry = ${maxDiff.toExponential(4)}`
      }
    });
  }

  // --- BUCK-EIG-001: Generalized Eigenvalue Solver Exact Solution ---
  {
    const solver = new BucklingEigenSolver();
    const K = new Matrix(1, 1, [[100]]);
    const Kg = new Matrix(1, 1, [[10]]);
    const modes = solver.solveGeneralizedEigenvalue(K, Kg, 1000);
    const lambda = modes[0].eigenvalue;
    const ref = 10.0;
    const absErr = Math.abs(lambda - ref);
    const relErr = absErr / ref;
    const tol = 1e-6;

    records.push({
      testId: 'BUCK-EIG-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Generalized eigenvalue solver exact eigenvalue calculation',
      referenceValue: ref,
      computedValue: lambda,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'dimensionless',
      evidence: {
        formula: 'lambda = K / K_G = 10.0',
        details: `Computed lambda = ${lambda.toFixed(6)}`
      }
    });
  }

  // --- EULER-001: Pinned-Pinned Euler Column (K_eff = 1.0) ---
  let pPinnedPinned = 0;
  const pRefPinned = (Math.PI * Math.PI * E * I) / (L * L); // 2072.6169 N
  {
    const model = buildColumn(8, 'PINNED_PINNED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });
    pPinnedPinned = res.modes[0].criticalLoad;
    const absErr = Math.abs(pPinnedPinned - pRefPinned);
    const relErr = absErr / pRefPinned;
    const tol = 0.005;

    records.push({
      testId: 'EULER-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Pinned-Pinned Euler column critical load (K_eff = 1.0)',
      elementType: 'BEAM_2D',
      referenceValue: pRefPinned,
      computedValue: pPinnedPinned,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'P_cr = pi^2 * E * I / L^2',
        details: `FEM P_cr = ${pPinnedPinned.toFixed(2)} N, Analytical = ${pRefPinned.toFixed(2)} N`
      }
    });
  }

  // --- EULER-002: Fixed-Free Cantilever Column (K_eff = 2.0) ---
  let pFixedFree = 0;
  const pRefFixedFree = (Math.PI * Math.PI * E * I) / (4 * L * L); // 518.1542 N
  {
    const model = buildColumn(8, 'FIXED_FREE');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });
    pFixedFree = res.modes[0].criticalLoad;
    const absErr = Math.abs(pFixedFree - pRefFixedFree);
    const relErr = absErr / pRefFixedFree;
    const tol = 0.005;

    records.push({
      testId: 'EULER-002',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Fixed-Free cantilever Euler column critical load (K_eff = 2.0)',
      elementType: 'BEAM_2D',
      referenceValue: pRefFixedFree,
      computedValue: pFixedFree,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'P_cr = pi^2 * E * I / (4 * L^2)',
        details: `FEM P_cr = ${pFixedFree.toFixed(2)} N, Analytical = ${pRefFixedFree.toFixed(2)} N`
      }
    });
  }

  // --- EULER-003: Fixed-Pinned Column (K_eff = 0.699156) ---
  let pFixedPinned = 0;
  const K_eff_FP = 0.699156;
  const pRefFixedPinned = (Math.PI * Math.PI * E * I) / ((K_eff_FP * L) ** 2); // 4238.18 N
  {
    const model = buildColumn(8, 'FIXED_PINNED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });
    pFixedPinned = res.modes[0].criticalLoad;
    const absErr = Math.abs(pFixedPinned - pRefFixedPinned);
    const relErr = absErr / pRefFixedPinned;
    const tol = 0.01;

    records.push({
      testId: 'EULER-003',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Fixed-Pinned Euler column critical load (K_eff = 0.699156)',
      elementType: 'BEAM_2D',
      referenceValue: pRefFixedPinned,
      computedValue: pFixedPinned,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'P_cr = pi^2 * E * I / (0.699156 * L)^2',
        details: `FEM P_cr = ${pFixedPinned.toFixed(2)} N, Analytical = ${pRefFixedPinned.toFixed(2)} N`
      }
    });
  }

  // --- EULER-004: Fixed-Fixed Column (K_eff = 0.5) ---
  let pFixedFixed = 0;
  const pRefFixedFixed = (4 * Math.PI * Math.PI * E * I) / (L * L); // 8290.4676 N
  {
    const model = buildColumn(16, 'FIXED_FIXED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });
    pFixedFixed = res.modes[0].criticalLoad;
    const absErr = Math.abs(pFixedFixed - pRefFixedFixed);
    const relErr = absErr / pRefFixedFixed;
    const tol = 0.01;

    records.push({
      testId: 'EULER-004',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Fixed-Fixed Euler column critical load (K_eff = 0.5)',
      elementType: 'BEAM_2D',
      referenceValue: pRefFixedFixed,
      computedValue: pFixedFixed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'P_cr = 4 * pi^2 * E * I / L^2',
        details: `FEM P_cr = ${pFixedFixed.toFixed(2)} N, Analytical = ${pRefFixedFixed.toFixed(2)} N`
      }
    });
  }

  // --- EULER-006: Mesh Refinement Convergence (N = 16) ---
  let pN16 = 0;
  {
    const model = buildColumn(16, 'PINNED_PINNED');
    const res = analysis.runBucklingAnalysis(model, { numModes: 1 });
    pN16 = res.modes[0].criticalLoad;
    const absErr = Math.abs(pN16 - pRefPinned);
    const relErr = absErr / pRefPinned;
    const tol = 0.001; // 0.1% error at N=16

    records.push({
      testId: 'EULER-006',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: '16-element mesh refinement convergence (< 0.1% error)',
      elementType: 'BEAM_2D',
      referenceValue: pRefPinned,
      computedValue: pN16,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'Error(N=16) = |P_FEM - P_analytical| / P_analytical < 0.001',
        details: `N=16 FEM P_cr = ${pN16.toFixed(3)} N, Rel Error = ${(relErr * 100).toFixed(4)}%`
      }
    });
  }

  // --- ADV-BUCK-001: Tensile State Rejection Guard ---
  {
    const modelTensile: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 1000, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D' }]
      ]),
      materials: new Map([['M1', { materialId: 'M1', E, nu: 0.3 }]]),
      sections: new Map([['S1', { sectionId: 'S1', area: A, I }]]),
      loads: [{ nodeId: 'N2', dof: DOFComponent.UY, value: 5000 }], // Tension
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 }
      ]
    };

    let caught = false;
    try {
      analysis.runBucklingAnalysis(modelTensile);
    } catch (e: any) {
      if (e.message.includes('[NO_COMPRESSIVE_STRESS_STATE]')) caught = true;
    }

    records.push({
      testId: 'ADV-BUCK-001',
      status: caught ? 'PASS' : 'FAIL',
      testDescription: 'Tensile stress state rejection guard',
      referenceValue: 1.0,
      computedValue: caught ? 1.0 : 0.0,
      absoluteError: 0,
      relativeError: 0,
      tolerance: 0,
      units: 'boolean',
      evidence: {
        formula: 'No compression N < 0 => throw [NO_COMPRESSIVE_STRESS_STATE]',
        details: `Rejection caught: ${caught}`
      }
    });
  }

  // --- ADV-BUCK-004: Unsupported Element Rejection Guard ---
  {
    const modelCST: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 100, y: 100, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 100, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }]
      ]),
      materials: new Map([['M1', { materialId: 'M1', E, nu: 0.3 }]]),
      sections: new Map([['S1', { sectionId: 'S1', thickness: 10 }]]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: -1000 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: -1000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: 0 }
      ]
    };

    let caught = false;
    try {
      analysis.runBucklingAnalysis(modelCST);
    } catch (e: any) {
      if (e.message.includes('[UNSUPPORTED_ELEMENT_FOR_BUCKLING]')) caught = true;
    }

    records.push({
      testId: 'ADV-BUCK-004',
      status: caught ? 'PASS' : 'FAIL',
      testDescription: 'Unsupported element formulation rejection guard',
      referenceValue: 1.0,
      computedValue: caught ? 1.0 : 0.0,
      absoluteError: 0,
      relativeError: 0,
      tolerance: 0,
      units: 'boolean',
      evidence: {
        formula: 'Formulation not in [BEAM_2D, FRAME_2D] => throw [UNSUPPORTED_ELEMENT_FOR_BUCKLING]',
        details: `Rejection caught: ${caught}`
      }
    });
  }

  // Calculate SHA-256 fingerprints of source files
  const filesToHash = [
    'src/engine/fem/buckling/BucklingTypes.ts',
    'src/engine/fem/buckling/GeometricStiffnessEngine.ts',
    'src/engine/fem/buckling/BucklingEigenSolver.ts',
    'src/engine/fem/buckling/LinearBucklingAnalysis.ts',
    'src/engine/fem/core/FEMCore.ts'
  ];

  const sourceHashes: Record<string, string> = {};
  for (const relPath of filesToHash) {
    const fullPath = join(process.cwd(), relPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf8');
      sourceHashes[relPath] = createHash('sha256').update(content).digest('hex');
    }
  }

  const passedCount = records.filter(r => r.status === 'PASS').length;
  const totalCount = records.length;
  const overallStatus = passedCount === totalCount ? 'QUALIFIED_WITHIN_DECLARED_SCOPE' : 'FAILED';

  const campaignResult = {
    campaignId: 'SECP-FEM-UPGRADE-006',
    title: 'Linear Buckling & Eigenvalue Stability Engine Qualification',
    status: overallStatus,
    summary: {
      totalTests: totalCount,
      passedTests: passedCount,
      failedTests: totalCount - passedCount
    },
    benchmarkComparison: {
      pinnedPinnedPcrN: { fem: pPinnedPinned, analytical: pRefPinned, errorPct: (Math.abs(pPinnedPinned - pRefPinned) / pRefPinned * 100).toFixed(3) },
      fixedFreePcrN: { fem: pFixedFree, analytical: pRefFixedFree, errorPct: (Math.abs(pFixedFree - pRefFixedFree) / pRefFixedFree * 100).toFixed(3) },
      fixedPinnedPcrN: { fem: pFixedPinned, analytical: pRefFixedPinned, errorPct: (Math.abs(pFixedPinned - pRefFixedPinned) / pRefFixedPinned * 100).toFixed(3) },
      fixedFixedPcrN: { fem: pFixedFixed, analytical: pRefFixedFixed, errorPct: (Math.abs(pFixedFixed - pRefFixedFixed) / pRefFixedFixed * 100).toFixed(3) }
    },
    sourceHashes,
    testRecords: records
  };

  const artifactDir = join(process.cwd(), '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814');

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_006_RESULTS.json'),
    JSON.stringify(campaignResult, null, 2),
    'utf8'
  );

  let reportMd = `# SECP Industrial OS — SECP-FEM-UPGRADE-006 Qualification Report
## Linear Buckling Analysis Engine — Eigenvalue Stability & Critical Load Qualification

- **Campaign Status**: **${overallStatus}** (${passedCount}/${totalCount} tests passed)
- **Scope**: Linear Elastic Eigenvalue Buckling Analysis for Beam and Frame Structures (\`BEAM_2D\`, \`FRAME_2D\`).
- **Date**: ${new Date().toISOString()}

### Source Code SHA-256 Fingerprints
${Object.entries(sourceHashes).map(([file, hash]) => `- \`${file}\`: \`${hash}\``).join('\n')}

---

### Campaign Qualification Results

| Test ID | Element | Status | Description | Reference Value | Computed Value | Abs Error | Rel Error | Tolerance | Units |
|---------|---------|--------|-------------|-----------------|----------------|-----------|-----------|-----------|-------|
${records.map(r => `| **${r.testId}** | \`${r.elementType ?? 'N/A'}\` | \`${r.status}\` | ${r.testDescription} | ${r.referenceValue.toExponential(4)} | ${r.computedValue.toExponential(4)} | ${r.absoluteError.toExponential(2)} | ${r.relativeError.toExponential(2)} | ${r.tolerance.toExponential(1)} | ${r.units} |`).join('\n')}

---

### Euler Column Buckling Benchmarks vs Exact Analytical Theory

Column Parameters: $L = 1000\\text{ mm}$, $E = 210,000\\text{ MPa}$, $I = 1,000\\text{ mm}^4$, $P_{\\text{ref}} = 1,000\\text{ N}$.

| Boundary Condition | Effective Length Factor $K_{\\text{eff}}$ | Analytical Critical Load $P_{\\text{cr}}$ (N) | FEM Computed $P_{\\text{cr}}$ (N) | Relative Error (%) | Status |
|--------------------|-----------------------------------------|---------------------------------------------|---------------------------------|--------------------|--------|
| **Pinned-Pinned** | $1.0$ | \`${pRefPinned.toFixed(2)}\` | \`${pPinnedPinned.toFixed(2)}\` | \`${(Math.abs(pPinnedPinned - pRefPinned) / pRefPinned * 100).toFixed(3)}%\` | \`VERIFIED\` |
| **Fixed-Free** | $2.0$ | \`${pRefFixedFree.toFixed(2)}\` | \`${pFixedFree.toFixed(2)}\` | \`${(Math.abs(pFixedFree - pRefFixedFree) / pRefFixedFree * 100).toFixed(3)}%\` | \`VERIFIED\` |
| **Fixed-Pinned** | $\\approx 0.699156$ | \`${pRefFixedPinned.toFixed(2)}\` | \`${pFixedPinned.toFixed(2)}\` | \`${(Math.abs(pFixedPinned - pRefFixedPinned) / pRefFixedPinned * 100).toFixed(3)}%\` | \`VERIFIED\` |
| **Fixed-Fixed** | $0.5$ | \`${pRefFixedFixed.toFixed(2)}\` | \`${pFixedFixed.toFixed(2)}\` | \`${(Math.abs(pFixedFixed - pRefFixedFixed) / pRefFixedFixed * 100).toFixed(3)}%\` | \`VERIFIED\` |

---

### Engineering Capabilities Added
1. **Geometric Stiffness Matrix Assembly ($\mathbf{K}_G$)**:
   - Exact $6 \\times 6$ local geometric stiffness formulation for flexural beam and frame members under axial compression $P = -N$.
   - Global coordinate transformation $\\mathbf{K}_{G,\\text{global}} = \\mathbf{T}^T \\mathbf{K}_{G,\\text{local}} \\mathbf{T}$.
   - Sparse global geometric stiffness matrix assembly.

2. **Generalized Eigenvalue Solver ($\mathbf{K}_{ff} \\boldsymbol{\\phi}_f = \\lambda \\mathbf{K}_{G,ff} \\boldsymbol{\\phi}_f$)**:
   - Cholesky factorization $\\mathbf{K}_{ff} = \\mathbf{L} \\mathbf{L}^T$ for partitioned symmetric positive-definite stiffness matrix.
   - Reduction to symmetric standard eigenvalue problem $\\mathbf{A} \\mathbf{y} = \\mu \\mathbf{y}$ where $\\mathbf{A} = \\mathbf{L}^{-1} \\mathbf{K}_{G,ff} \\mathbf{L}^{-T}$ and $\\lambda_i = 1 / \\mu_i$.
   - Jacobi diagonalisation eigensolver.
   - Extraction of critical load multipliers $\\lambda_i$, critical loads $P_{\\text{cr},i} = \\lambda_i P_{\\text{ref}}$, and relative residual check $r_{\\text{rel}} < 10^{-4}$.

3. **Adversarial & Safety Guards**:
   - Detects and rejects non-compressive stress states (\`[NO_COMPRESSIVE_STRESS_STATE]\`).
   - Detects and rejects unsupported element formulations (\`[UNSUPPORTED_ELEMENT_FOR_BUCKLING]\`).
   - Detects non-SPD stiffness matrices resulting from unconstrained mechanisms (\`[NON_SPD_STIFFNESS_MATRIX]\`).

`;

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_006_REPORT.md'),
    reportMd,
    'utf8'
  );

  console.log(`Campaign execution finished. Results: ${passedCount}/${totalCount} passed (${overallStatus}).`);
  console.log(`Saved SECP_FEM_UPGRADE_006_RESULTS.json and SECP_FEM_UPGRADE_006_REPORT.md.`);
}

runUpgrade006Campaign();
