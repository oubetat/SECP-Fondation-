import { ElementFormulationEngine } from './src/engine/structural-physics/ElementFormulationEngine';
import { MaterialModelEngine } from './src/engine/structural-physics/MaterialModelEngine';

function auditSRIMatrix() {
  console.log('=== QUAD_2D SRI STIFFNESS MATRIX MATHEMATICAL AUDIT ===');

  const nodes = [
    { id: 1, x: 0, y: 0.05, z: 0, dofIndices: [0, 1] },
    { id: 2, x: 0, y: -0.05, z: 0, dofIndices: [2, 3] },
    { id: 3, x: 0.1, y: -0.05, z: 0, dofIndices: [4, 5] },
    { id: 4, x: 0.1, y: 0.05, z: 0, dofIndices: [6, 7] }
  ];

  const matId = 'MAT-AL-AUDIT';
  MaterialModelEngine.registerMaterial({
    id: matId,
    name: 'Aluminum',
    youngsModulus: 70e9,
    poissonsRatio: 0.3,
    yieldStrength: 500e6,
    density: 7850
  });

  const elem = {
    id: 1,
    type: 'QUAD_2D' as const,
    nodeIds: [2, 3, 4, 1], // CCW
    materialId: matId,
    thickness: 0.1
  };

  const K = ElementFormulationEngine.formulateElementStiffness(elem, nodes as any);

  // 1. Symmetry Audit
  let maxSymmetryError = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const err = Math.abs(K[i][j] - K[j][i]);
      if (err > maxSymmetryError) maxSymmetryError = err;
    }
  }
  console.log(`1. Symmetry Check: Max |K_ij - K_ji| = ${maxSymmetryError.toExponential(4)} (${maxSymmetryError < 1e-10 ? 'PASSED (Symmetric)' : 'FAILED'})`);

  // 2. Rank & Eigenvalue Analysis via Jacobi Method for Symmetric Matrix
  function jacobiEigenvalues(matrix: number[][]): number[] {
    const n = matrix.length;
    const A = matrix.map(row => [...row]);
    const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

    for (let iter = 0; iter < 100; iter++) {
      let maxOffDiag = 0;
      let p = 0, q = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (Math.abs(A[i][j]) > maxOffDiag) {
            maxOffDiag = Math.abs(A[i][j]);
            p = i;
            q = j;
          }
        }
      }
      if (maxOffDiag < 1e-12) break;

      const app = A[p][p], aqq = A[q][q], apq = A[p][q];
      const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
      const c = Math.cos(phi), s = Math.sin(phi);

      for (let i = 0; i < n; i++) {
        if (i !== p && i !== q) {
          const aip = A[i][p], aiq = A[i][q];
          A[i][p] = A[p][i] = c * aip - s * aiq;
          A[i][q] = A[q][i] = s * aip + c * aiq;
        }
      }
      A[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
      A[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
      A[p][q] = A[q][p] = 0;
    }

    return A.map((row, i) => row[i]).sort((a, b) => a - b);
  }

  const eigenvalues = jacobiEigenvalues(K);
  console.log('\n2. Eigenvalue Spectrum (8 DOFs):');
  eigenvalues.forEach((ev, idx) => {
    console.log(`   λ_${idx + 1} = ${ev.toExponential(4)}`);
  });

  const zeroEigenvalues = eigenvalues.filter(ev => Math.abs(ev) < 1e-2);
  const nonZeroEigenvalues = eigenvalues.filter(ev => Math.abs(ev) >= 1e-2);
  const matrixRank = nonZeroEigenvalues.length;

  console.log(`\n3. Matrix Rank Assessment:`);
  console.log(`   Zero Eigenvalues (Rigid Body Modes): ${zeroEigenvalues.length}`);
  console.log(`   Non-Zero Eigenvalues (Elastic Modes): ${matrixRank}`);
  console.log(`   Rank = ${matrixRank} / 8`);
  console.log(`   Verdict: ${matrixRank === 5 && zeroEigenvalues.length === 3 ? 'PASSED (Exactly 3 Rigid Body Modes, NO Hourglass Modes)' : 'FAILED'}`);

  // 3. Strain Energy under Bending Deformation
  // Pure bending displacement vector: u_x = y * kappa, u_y = 0
  const kappa = 0.01; // curvature
  const u_bending = [
    0.05 * kappa, 0,  // Node 1 (top-left)
    0.05 * kappa, 0,  // Node 2 (top-right)
    -0.05 * kappa, 0, // Node 3 (bottom-right)
    -0.05 * kappa, 0  // Node 4 (bottom-left)
  ];

  let strainEnergyBending = 0;
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      strainEnergyBending += 0.5 * u_bending[i] * K[i][j] * u_bending[j];
    }
  }
  console.log(`\n4. Bending Strain Energy U = 1/2 u^T K u = ${strainEnergyBending.toExponential(4)} J (${strainEnergyEnergyStatus(strainEnergyBending)})`);

  function strainEnergyEnergyStatus(val: number) {
    return val > 0 ? 'PASSED (Positive Definite Strain Energy)' : 'FAILED (Non-Positive Strain Energy)';
  }
}

auditSRIMatrix();
