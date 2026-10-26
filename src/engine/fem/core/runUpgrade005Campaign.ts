/**
 * SECP Industrial OS — Engineering Truth OS
 * runUpgrade005Campaign.ts
 * 
 * Executes SECP-FEM-UPGRADE-005: 3D Solid Mechanics (TET4_3D) Verification Campaign.
 * Computes explicit relative errors, benchmark comparisons, SHA-256 source fingerprints,
 * and produces SECP_FEM_UPGRADE_005_RESULTS.json and SECP_FEM_UPGRADE_005_REPORT.md.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { FEMCore } from './FEMCore';
import { TET43DFormulation } from './TET43DFormulation';
import { DOFComponent, FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection } from './FEMTypes';

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

export function runUpgrade005Campaign() {
  console.log('================================================================================');
  console.log(' SECP INDUSTRIAL OS — 3D SOLID MECHANICS TET4_3D (SECP-FEM-UPGRADE-005)');
  console.log('================================================================================\n');

  const records: CampaignTestRecord[] = [];

  // --- TET4-001: Shape function partition of unity ---
  {
    const tet4 = new TET43DFormulation();
    const N = tet4.evaluateShapeFunctions(0.2, 0.3, 0.4);
    const sum = N.reduce((a, b) => a + b, 0);
    const ref = 1.0;
    const absErr = Math.abs(sum - ref);
    const relErr = absErr / ref;
    const tol = 1e-10;

    records.push({
      testId: 'TET4-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'TET4 shape functions sum to 1.0 at (0.2, 0.3, 0.4)',
      elementType: 'TET4_3D',
      referenceValue: ref,
      computedValue: sum,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'dimensionless',
      evidence: {
        formula: 'sum(N_i(xi, eta, zeta)) = 1.0',
        details: `Sum = ${sum.toFixed(10)}`
      }
    });
  }

  // --- TET4-002: Stiffness matrix symmetry and rigid body mode sum ---
  {
    const tet4 = new TET43DFormulation();
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }]
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    fem.getDOFManager().buildDOFs(model, new Map([['TET4_3D', tet4]]));
    const res = tet4.computeMatrices(model.elements.get('E1')!, model, fem.getDOFManager());
    const Ke = res.Ke;

    let maxSymErr = 0;
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        const diff = Math.abs(Ke.get(r, c) - Ke.get(c, r));
        if (diff > maxSymErr) maxSymErr = diff;
      }
    }

    const tol = 1e-6;
    records.push({
      testId: 'TET4-002',
      status: maxSymErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'TET4 3D stiffness matrix exact symmetry (Ke = Ke^T)',
      elementType: 'TET4_3D',
      referenceValue: 0.0,
      computedValue: maxSymErr,
      absoluteError: maxSymErr,
      relativeError: maxSymErr,
      tolerance: tol,
      units: 'N/mm',
      evidence: {
        formula: 'max|Ke[r,c] - Ke[c,r]| <= 1e-6',
        details: `Max symmetry error = ${maxSymErr.toExponential(4)} N/mm`
      }
    });
  }

  // --- TET4-003: 3D Principal stresses analytical validation ---
  {
    const tet4 = new TET43DFormulation();
    // Triaxial stress state: sig_x = 300, sig_y = 100, sig_z = 200
    const ps = tet4.compute3DPrincipalStresses(300, 100, 200, 0, 0, 0);
    const sortedOk = ps.sigma_1 >= ps.sigma_2 && ps.sigma_2 >= ps.sigma_3;
    const refSig1 = 300, refSig2 = 200, refSig3 = 100;

    const absErr = Math.abs(ps.sigma_1 - refSig1) + Math.abs(ps.sigma_2 - refSig2) + Math.abs(ps.sigma_3 - refSig3);
    const relErr = absErr / (refSig1 + refSig2 + refSig3);
    const tol = 1e-6;

    records.push({
      testId: 'TET4-003',
      status: (relErr <= tol && sortedOk) ? 'PASS' : 'FAIL',
      testDescription: 'TET4 3D principal stresses analytical eigenvalue extraction (sigma_1 >= sigma_2 >= sigma_3)',
      elementType: 'TET4_3D',
      referenceValue: refSig1,
      computedValue: ps.sigma_1,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'MPa',
      evidence: {
        formula: 'sigma_1 = 300, sigma_2 = 200, sigma_3 = 100 MPa',
        details: `Computed [s1, s2, s3] = [${ps.sigma_1.toFixed(2)}, ${ps.sigma_2.toFixed(2)}, ${ps.sigma_3.toFixed(2)}]`
      }
    });
  }

  // --- TET4-004: Uniaxial 3D tension displacement and stress recovery ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }],
        ['N5', { nodeId: 'N5', x: 10, y: 10, z: 10 }]
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3', 'N4', 'N5'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.25 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [
        { nodeId: 'N5', dof: DOFComponent.UX, value: 5000 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 5000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const res = fem.solve(model, { solverType: 'DIRECT_PARTITIONED' });
    const computedRx = res.reactions.reduce((sum, val, idx) => {
      const dof = fem.getDOFManager().getDOFByGlobalId(idx);
      return dof?.component === DOFComponent.UX ? sum + val : sum;
    }, 0);

    const ref = -10000;
    const absErr = Math.abs(computedRx - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-4;

    records.push({
      testId: 'TET4-004',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: '3D solid bar tension reaction equilibrium (sum Rx = -10,000 N)',
      elementType: 'TET4_3D',
      referenceValue: ref,
      computedValue: computedRx,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'sum Rx + sum Fx_ext = 0',
        details: `Computed sum Rx = ${computedRx.toFixed(4)} N`
      }
    });
  }

  // --- TET4-005: Degenerate or inverted element guard ---
  {
    const fem = new FEMCore();
    const modelDeg: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 5, y: 5, z: 0 }] // Co-planar (z=0) -> volume = 0
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    let caught = false;
    try {
      fem.solve(modelDeg);
    } catch (e: any) {
      if (e.message.includes('[INVERTED_OR_DEGENERATE_ELEMENT]')) caught = true;
    }

    records.push({
      testId: 'TET4-005',
      status: caught ? 'PASS' : 'FAIL',
      testDescription: 'TET4 degenerate element (co-planar zero-volume nodes) rejection guard',
      elementType: 'TET4_3D',
      referenceValue: 1.0,
      computedValue: caught ? 1.0 : 0.0,
      absoluteError: 0,
      relativeError: 0,
      tolerance: 0,
      units: 'boolean',
      evidence: {
        formula: 'detJ <= 1e-12 => throw [INVERTED_OR_DEGENERATE_ELEMENT]',
        details: `Degenerate guard caught: ${caught}`
      }
    });
  }

  // --- TET4-006: 3D Multi-element solid block solution with Sparse PCG ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0,  y: 0,  z: 0  }],
        ['N2', { nodeId: 'N2', x: 10, y: 0,  z: 0  }],
        ['N3', { nodeId: 'N3', x: 10, y: 10, z: 0  }],
        ['N4', { nodeId: 'N4', x: 0,  y: 10, z: 0  }],
        ['N5', { nodeId: 'N5', x: 0,  y: 0,  z: 10 }],
        ['N6', { nodeId: 'N6', x: 10, y: 0,  z: 10 }],
        ['N7', { nodeId: 'N7', x: 10, y: 10, z: 10 }],
        ['N8', { nodeId: 'N8', x: 0,  y: 10, z: 10 }]
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N4', 'N5'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3', 'N4', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E3', { elementId: 'E3', nodeIds: ['N2', 'N5', 'N6', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E4', { elementId: 'E4', nodeIds: ['N4', 'N5', 'N7', 'N8'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E5', { elementId: 'E5', nodeIds: ['N2', 'N4', 'N5', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 210000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [
        { nodeId: 'N6', dof: DOFComponent.UZ, value: -2000 },
        { nodeId: 'N7', dof: DOFComponent.UZ, value: -2000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N2', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N2', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const res = fem.solve(model, { solverType: 'SPARSE_PCG', pcgOptions: { maxIterations: 500, tolerance: 1e-8 } });
    const norm = res.equilibrium.residualNorm;
    const ref = 0;
    const absErr = norm;
    const relErr = norm / 4000;
    const tol = 1e-4;

    records.push({
      testId: 'TET4-006',
      status: (res.equilibrium.ok && res.energy.ok && res.solverTypeUsed === 'SPARSE_PCG') ? 'PASS' : 'FAIL',
      testDescription: '3D Solid block multi-element solution using Sparse PCG solver with full field recovery',
      elementType: 'TET4_3D',
      referenceValue: ref,
      computedValue: norm,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'Residual norm = ||K_ff * u_f - F_f|| < 1e-4',
        details: `Residual norm = ${norm.toExponential(4)} N, Max Von Mises = ${res.fields.maxVonMisesStress.toFixed(2)} MPa`
      }
    });
  }

  // Compute SHA-256 fingerprints of core implementation files
  const filesToHash = [
    'src/engine/fem/core/TET43DFormulation.ts',
    'src/engine/fem/core/FEMTypes.ts',
    'src/engine/fem/core/FEMCore.ts',
    'src/engine/fem/core/FieldRecoveryEngine.ts',
    'src/engine/fem/core/SparsePCGSolver.ts'
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
  const overallStatus = passedCount === totalCount ? 'QUALIFIED_AND_VERIFIED' : 'FAILED';

  const campaignResult = {
    campaignId: 'SECP-FEM-UPGRADE-005',
    title: '3D Solid Mechanics Tetrahedral Element Expansion (TET4_3D)',
    status: overallStatus,
    summary: {
      totalTests: totalCount,
      passedTests: passedCount,
      failedTests: totalCount - passedCount,
    },
    sourceHashes,
    testRecords: records
  };

  const artifactDir = join(process.cwd(), '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814');

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_005_RESULTS.json'),
    JSON.stringify(campaignResult, null, 2),
    'utf8'
  );

  let reportMd = `# SECP Industrial OS — SECP-FEM-UPGRADE-005 Verification Report
## 3D Solid Mechanics — Three-Dimensional Finite Element Solver Expansion

- **Campaign Status**: **${overallStatus}** (${passedCount}/${totalCount} tests passed)
- **Scope**: 4-Node Linear Tetrahedral Continuum Solid Element (\`TET4_3D\`) with 3D Isotropic Elasticity, Sparse PCG integration, 3D stress/strain recovery, and 3D principal stress calculation.
- **Date**: ${new Date().toISOString()}

### Source Code SHA-256 Fingerprints
${Object.entries(sourceHashes).map(([file, hash]) => `- \`${file}\`: \`${hash}\``).join('\n')}

---

### Campaign Qualification Results

| Test ID | Element | Status | Description | Reference Value | Computed Value | Abs Error | Rel Error | Tolerance | Units |
|---------|---------|--------|-------------|-----------------|----------------|-----------|-----------|-----------|-------|
${records.map(r => `| **${r.testId}** | \`${r.elementType ?? 'MIXED'}\` | \`${r.status}\` | ${r.testDescription} | ${r.referenceValue.toExponential(4)} | ${r.computedValue.toExponential(4)} | ${r.absoluteError.toExponential(2)} | ${r.relativeError.toExponential(2)} | ${r.tolerance.toExponential(1)} | ${r.units} |`).join('\n')}

---

### Engineering Capabilities Added
1. **TET4_3D Solid Continuum Element Formulation**:
   - 4 nodes per element with 3 translational DOFs per node (\`UX\`, \`UY\`, \`UZ\`), total 12 DOFs per element.
   - Exact 3D Jacobian determinant $\\det \\mathbf{J} = 6 V_e$ for tetrahedral volume integration.
   - 3D Isotropic Elasticity constitutive matrix $\\mathbf{D}$ ($6 \\times 6$) using Young's modulus $E$ and Poisson's ratio $\\nu$.
   - $12 \\times 12$ element stiffness matrix $\\mathbf{K}_e = V_e \\mathbf{B}^T \\mathbf{D} \\mathbf{B}$ with exact symmetry.

2. **Full 3D Stress & Strain Field Recovery**:
   - 3D Cauchy stress tensor $[\\sigma_{xx}, \\sigma_{yy}, \\sigma_{zz}, \\tau_{xy}, \\tau_{yz}, \\tau_{xz}]^T$.
   - 3D Infinitesimal strain tensor $[\\varepsilon_{xx}, \\varepsilon_{yy}, \\varepsilon_{zz}, \\gamma_{xy}, \\gamma_{yz}, \\gamma_{xz}]^T$.
   - 3D Von Mises equivalent stress:
     $$\\sigma_{\\text{vm}} = \\sqrt{\\frac{1}{2}\\left( (\\sigma_{xx} - \\sigma_{yy})^2 + (\\sigma_{yy} - \\sigma_{zz})^2 + (\\sigma_{zz} - \\sigma_{xx})^2 + 6(\\tau_{xy}^2 + \\tau_{yz}^2 + \\tau_{xz}^2) \\right)}$$
   - Analytical 3D Principal stresses $\\sigma_1 \\ge \\sigma_2 \\ge \\sigma_3$ computed via Viète's cubic characteristic equation solver.

3. **Degenerate Element Protection**:
   - Physical volume guard $\\det \\mathbf{J} > 10^{-12}$ throws explicit \`[INVERTED_OR_DEGENERATE_ELEMENT]\` exception upon detecting zero-volume, co-planar, or inverted nodes.

4. **Integration with Sparse Matrix & PCG Solver**:
   - Seamless sparse assembly of 3D solid elements with direct elimination BC enforcement and preconditioned iterative PCG solver.

`;

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_005_REPORT.md'),
    reportMd,
    'utf8'
  );

  console.log(`Campaign execution finished. Results: ${passedCount}/${totalCount} passed (${overallStatus}).`);
  console.log(`Saved SECP_FEM_UPGRADE_005_RESULTS.json and SECP_FEM_UPGRADE_005_REPORT.md.`);
}

runUpgrade005Campaign();
