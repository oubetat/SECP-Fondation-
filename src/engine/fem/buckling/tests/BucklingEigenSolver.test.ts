/**
 * SECP Industrial OS — Engineering Truth OS
 * BucklingEigenSolver.test.ts
 * 
 * Unit Test Suite for BucklingEigenSolver (SECP-FEM-UPGRADE-006).
 */

import { describe, it, expect } from 'vitest';
import { BucklingEigenSolver } from '../BucklingEigenSolver';
import { Matrix } from '../../core/MathUtils';

describe('SECP-FEM-UPGRADE-006: BucklingEigenSolver', () => {
  const solver = new BucklingEigenSolver();

  it('performs exact Cholesky factorization of SPD matrix K', () => {
    // K = [ 4  12 -16 ; 12  37 -43 ; -16 -43  98 ]
    // L = [ 2   0   0 ;  6   1   0 ;  -8   5   3 ]
    const K = new Matrix(3, 3, [
      [ 4,  12, -16],
      [12,  37, -43],
      [-16, -43, 98]
    ]);

    const L = solver.choleskyFactorization(K);

    expect(L.get(0, 0)).toBeCloseTo(2, 8);
    expect(L.get(1, 0)).toBeCloseTo(6, 8);
    expect(L.get(1, 1)).toBeCloseTo(1, 8);
    expect(L.get(2, 0)).toBeCloseTo(-8, 8);
    expect(L.get(2, 1)).toBeCloseTo(5, 8);
    expect(L.get(2, 2)).toBeCloseTo(3, 8);

    // Verify L * L^T == K
    const Lt = L.transpose();
    const LLt = L.multiply(Lt);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(LLt.get(r, c)).toBeCloseTo(K.get(r, c), 8);
      }
    }
  });

  it('throws error when Cholesky factorizing a non-SPD matrix', () => {
    const K_indefinite = new Matrix(2, 2, [
      [-1, 2],
      [ 2, 5]
    ]);

    expect(() => solver.choleskyFactorization(K_indefinite)).toThrow('[NON_SPD_STIFFNESS_MATRIX]');
  });

  it('solves Jacobi eigenvalue decomposition for symmetric matrix A', () => {
    // A = [ 2  1 ; 1  2 ] -> Eigenvalues = 3, 1
    const A = new Matrix(2, 2, [
      [2, 1],
      [1, 2]
    ]);

    const { eigenvalues, eigenvectors } = solver.jacobiEigenDecomposition(A);

    const sortedEig = Array.from(eigenvalues).sort((a, b) => b - a);
    expect(sortedEig[0]).toBeCloseTo(3.0, 8);
    expect(sortedEig[1]).toBeCloseTo(1.0, 8);

    // Verify orthogonality of eigenvectors V^T * V = I
    const VtV = eigenvectors.transpose().multiply(eigenvectors);
    expect(VtV.get(0, 0)).toBeCloseTo(1.0, 8);
    expect(VtV.get(1, 1)).toBeCloseTo(1.0, 8);
    expect(VtV.get(0, 1)).toBeCloseTo(0.0, 8);
  });

  it('solves small generalized eigenvalue problem K * phi = lambda * K_G * phi with exact analytical eigenvalue', () => {
    // 1 DOF benchmark: K = 100 N/mm, K_G = 10 N/mm => lambda = K / K_G = 10.0
    const K = new Matrix(1, 1, [[100]]);
    const K_G = new Matrix(1, 1, [[10]]);

    const results = solver.solveGeneralizedEigenvalue(K, K_G, 1000);

    expect(results.length).toBe(1);
    expect(results[0].eigenvalue).toBeCloseTo(10.0, 6);
    expect(results[0].criticalLoad).toBeCloseTo(10000.0, 6);
    expect(results[0].verificationStatus).toBe('VERIFIED');
    expect(results[0].relativeResidual).toBeLessThan(1e-6);
  });
});
