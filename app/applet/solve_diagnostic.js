const { GaussSeidelSolver } = require('./src/engine/cfd3d/linear-solvers/GaussSeidelSolver');
const { SparseMatrix } = require('./src/engine/cfd3d/linear-solvers/SparseMatrix');
const { SparseVector } = require('./src/engine/cfd3d/linear-solvers/SparseVector');

console.log('=== SECP CFD LINEAR SOLVER FORENSIC DIAGNOSTIC (JS) ===');

const mat1 = new SparseMatrix(2);
mat1.set(0, 0, 10.0);
mat1.set(1, 1, 10.0);
const rhs1 = new SparseVector([5.0, 5.0]);
const x0_converged = new SparseVector([0.5, 0.5]);
const sys1 = { matrix: mat1, rhs: rhs1, initialGuess: x0_converged };

const config = {
  absoluteTolerance: 1e-6,
  relativeTolerance: 1e-3,
  maxIterations: 5,
  divergenceThreshold: 1e6,
  stagnationWindow: 20
};

const solver = new GaussSeidelSolver();
const res1 = solver.solve(sys1, config);
console.log('Case 1 (Pre-converged initial guess):', {
  status: res1.status,
  iterations: res1.iterations,
  convergence: res1.convergence,
  initialNormL2: res1.initialResidual.l2,
  finalNormL2: res1.finalResidual.l2,
  normalizedRes: res1.finalResidual.normalized
});

const n = 10;
const mat2 = new SparseMatrix(n);
const rhs2 = new SparseVector(n);
for (let i = 0; i < n; i++) {
  mat2.set(i, i, 2.0);
  if (i > 0) mat2.set(i, i - 1, -1.5);
  if (i < n - 1) mat2.set(i, i + 1, -0.5);
  rhs2.set(i, 1.0);
}
const sys2 = { matrix: mat2, rhs: rhs2, initialGuess: new SparseVector(n) };

const res2_5 = solver.solve(sys2, { ...config, maxIterations: 5 });
console.log('Case 2a (Stiff system, maxIterations: 5):', {
  status: res2_5.status,
  iterations: res2_5.iterations,
  convergence: res2_5.convergence,
  initialNormL2: res2_5.initialResidual.l2,
  finalNormL2: res2_5.finalResidual.l2,
  normalizedRes: res2_5.finalResidual.normalized
});

const res2_50 = solver.solve(sys2, { ...config, maxIterations: 50 });
console.log('Case 2b (Stiff system, maxIterations: 50):', {
  status: res2_50.status,
  iterations: res2_50.iterations,
  convergence: res2_50.convergence,
  initialNormL2: res2_50.initialResidual.l2,
  finalNormL2: res2_50.finalResidual.l2,
  normalizedRes: res2_50.finalResidual.normalized
});
