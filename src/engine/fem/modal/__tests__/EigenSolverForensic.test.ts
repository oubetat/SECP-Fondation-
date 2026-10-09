import { describe, it, expect } from 'vitest';
import { Matrix } from '../../core/MathUtils';
import { EigenSolver } from '../EigenSolver';

describe('PATCH-SECP-082: EigenSolver Forensic & Adversarial Audit', () => {
  it('1. Solves a known analytical symmetric 3x3 matrix precisely', () => {
    // Analytical matrix with eigenvalues 1, 2, 3
    const K = new Matrix(3, 3, [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2]
    ]);
    const M = new Matrix(3, 3, [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]);

    const results = EigenSolver.solveGeneralized(K, M, 3);
    expect(results.length).toBe(3);
    
    // Exact eigenvalues for this matrix are 2-sqrt(2), 2, 2+sqrt(2)
    // Approx: 0.5857, 2, 3.4142
    expect(results[0].eigenvalue).toBeCloseTo(0.585786, 5);
    expect(results[1].eigenvalue).toBeCloseTo(2.0, 5);
    expect(results[2].eigenvalue).toBeCloseTo(3.414213, 5);

    // Verify residual ||K*phi - lambda*M*phi|| < 1e-10
    for (const res of results) {
      expect(res.residual).toBeLessThan(1e-10);
    }
  });

  it('2. Handles repeated eigenvalues without bifurcation or loss of precision', () => {
    const K = new Matrix(3, 3, [
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 5]
    ]);
    const M = new Matrix(3, 3, [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]);

    const results = EigenSolver.solveGeneralized(K, M, 3);
    expect(results[0].eigenvalue).toBeCloseTo(2.0, 8);
    expect(results[1].eigenvalue).toBeCloseTo(2.0, 8);
    expect(results[2].eigenvalue).toBeCloseTo(5.0, 8);
    
    for (const res of results) {
      expect(res.residual).toBeLessThan(1e-10);
    }
  });

  it('3. Resists ill-conditioned matrices (Hilbert-like stiffness)', () => {
    // Hilbert-like matrix segment (highly ill-conditioned)
    const K = new Matrix(2, 2, [
      [1, 0.999],
      [0.999, 1]
    ]);
    const M = new Matrix(2, 2, [
      [1, 0],
      [0, 1]
    ]);

    const results = EigenSolver.solveGeneralized(K, M, 2);
    // Eigenvalues are 1 + 0.999 = 1.999 and 1 - 0.999 = 0.001
    expect(results[0].eigenvalue).toBeCloseTo(0.001, 8);
    expect(results[1].eigenvalue).toBeCloseTo(1.999, 8);
    
    for (const res of results) {
      expect(res.residual).toBeLessThan(1e-12);
    }
  });

  it('4. Handles numerical singularity in mass matrix as infinite frequencies', () => {
    const K = new Matrix(2, 2, [[2, 0], [0, 2]]);
    const M = new Matrix(2, 2, [[1, 0], [0, 0]]); // Singular mass

    const results = EigenSolver.solveGeneralized(K, M, 2);
    expect(results.length).toBe(2);
    expect(results[0].eigenvalue).toBeCloseTo(2.0, 8);
    expect(results[1].eigenvalue).toBeGreaterThan(1e18); // Infinite mode
  });

  it('6. Detects numerical singularity in stiffness matrix (Rigid Body Motion without shift)', () => {
    const K = new Matrix(2, 2, [[0, 0], [0, 0]]); // Singular stiffness
    const M = new Matrix(2, 2, [[1, 0], [0, 1]]);

    // Should throw in LU decomposition because K is unstable
    expect(() => EigenSolver.solveGeneralized(K, M, 2)).toThrow(/SINGULARITY/);
  });

  it('5. Maintains mass-normalization phi^T * M * phi = 1', () => {
    const K = new Matrix(2, 2, [[4, 0], [0, 9]]);
    const M = new Matrix(2, 2, [[1, 0], [0, 1]]);

    const results = EigenSolver.solveGeneralized(K, M, 2);
    for (const res of results) {
      const phi = res.eigenvector;
      const phiMphi = phi[0]*phi[0] + phi[1]*phi[1];
      expect(phiMphi).toBeCloseTo(1.0, 10);
    }
  });
});
