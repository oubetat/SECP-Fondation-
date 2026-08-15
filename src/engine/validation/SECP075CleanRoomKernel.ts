/**
 * PATCH-SECP-075.4: Independent Clean-Room Verification Kernel
 * A fully self-contained, zero-dependency finite element formulation and solver kernel.
 * This kernel DOES NOT call any production classes (ElementFormulationEngine, GlobalAssemblyEngine,
 * ShapeFunctionIsoparametricEngine, or LinearSolverAbstraction).
 * It computes element matrices, global assembly, exact Dirichlet reduction, Cholesky SPD,
 * eigenvalues (Rayleigh / Inverse iteration), and equilibrium residuals from mathematical first principles.
 */

export interface CleanRoomRawNode {
  id: number;
  x: number;
  y: number;
}

export interface CleanRoomRawElement {
  id: number;
  nodeIds: [number, number, number, number]; // 4 nodes counter-clockwise
  thickness: number;
}

export interface CleanRoomRawMaterial {
  E: number;
  nu: number;
}

export interface CleanRoomRawBC {
  nodeId: number;
  fixX: boolean;
  fixY: boolean;
}

export interface CleanRoomRawLoad {
  nodeId: number;
  fx: number;
  fy: number;
}

export interface CleanRoomSpectralResult {
  lambdaMin: number;
  lambdaMax: number;
  conditionNumber: number;
  isPositiveDefinite: boolean;
  minCholeskyPivot: number;
}

export interface CleanRoomSolveResult {
  uReduced: number[];
  uGlobal: number[];
  strainEnergy: number;
  residualNorm: number;
  relativeResidual: number;
  spectral: CleanRoomSpectralResult;
  K_reduced: number[][];
  F_reduced: number[];
  freeDofs: number[];
}

export class SECP075CleanRoomKernel {

  /**
   * Evaluates plane stress constitutive matrix D directly from first principles.
   * D = [E / (1 - nu^2)] * [ [1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu)/2] ]
   */
  public static computePlaneStressD(E: number, nu: number): number[][] {
    const factor = E / (1.0 - nu * nu);
    return [
      [factor * 1.0, factor * nu, 0.0],
      [factor * nu, factor * 1.0, 0.0],
      [0.0, 0.0, factor * ((1.0 - nu) / 2.0)]
    ];
  }

  /**
   * Evaluates standard 2x2 Gauss-Legendre quadrature points and weights.
   */
  public static getGaussPoints2x2(): { xi: number; eta: number; weight: number }[] {
    const g = 1.0 / Math.sqrt(3.0);
    return [
      { xi: -g, eta: -g, weight: 1.0 },
      { xi: g, eta: -g, weight: 1.0 },
      { xi: g, eta: g, weight: 1.0 },
      { xi: -g, eta: g, weight: 1.0 }
    ];
  }

  /**
   * Evaluates QUAD4 isoparametric shape function derivatives and Jacobian from first principles.
   * N1 = 0.25*(1-xi)*(1-eta), N2 = 0.25*(1+xi)*(1-eta), N3 = 0.25*(1+xi)*(1+eta), N4 = 0.25*(1-xi)*(1+eta)
   */
  public static computeQuad4B(
    xi: number,
    eta: number,
    coords: { x: number; y: number }[]
  ): { B: number[][]; detJ: number } {
    // dN / dxi
    const dNdxi = [
      -0.25 * (1.0 - eta),
      0.25 * (1.0 - eta),
      0.25 * (1.0 + eta),
      -0.25 * (1.0 + eta)
    ];

    // dN / deta
    const dNdeta = [
      -0.25 * (1.0 - xi),
      -0.25 * (1.0 + xi),
      0.25 * (1.0 + xi),
      0.25 * (1.0 - xi)
    ];

    // Jacobian matrix J = [ [dx/dxi, dy/dxi], [dx/deta, dy/deta] ]
    let J11 = 0.0, J12 = 0.0, J21 = 0.0, J22 = 0.0;
    for (let i = 0; i < 4; i++) {
      J11 += dNdxi[i] * coords[i].x;
      J12 += dNdxi[i] * coords[i].y;
      J21 += dNdeta[i] * coords[i].x;
      J22 += dNdeta[i] * coords[i].y;
    }

    const detJ = J11 * J22 - J12 * J21;
    if (Math.abs(detJ) < 1e-15) {
      throw new Error(`CleanRoom: Singular or inverted Jacobian detJ=${detJ}`);
    }

    const invDetJ = 1.0 / detJ;
    const invJ11 = J22 * invDetJ;
    const invJ12 = -J12 * invDetJ;
    const invJ21 = -J21 * invDetJ;
    const invJ22 = J11 * invDetJ;

    // dN / dx and dN / dy
    const dNdx = new Array(4);
    const dNdy = new Array(4);
    for (let i = 0; i < 4; i++) {
      dNdx[i] = invJ11 * dNdxi[i] + invJ12 * dNdeta[i];
      dNdy[i] = invJ21 * dNdxi[i] + invJ22 * dNdeta[i];
    }

    // Strain-displacement matrix B (3 rows, 8 columns)
    const B: number[][] = [
      new Array(8).fill(0),
      new Array(8).fill(0),
      new Array(8).fill(0)
    ];

    for (let i = 0; i < 4; i++) {
      // eps_xx = du/dx
      B[0][2 * i] = dNdx[i];
      B[0][2 * i + 1] = 0.0;

      // eps_yy = dv/dy
      B[1][2 * i] = 0.0;
      B[1][2 * i + 1] = dNdy[i];

      // gamma_xy = du/dy + dv/dx
      B[2][2 * i] = dNdy[i];
      B[2][2 * i + 1] = dNdx[i];
    }

    return { B, detJ };
  }

  /**
   * Integrates 8x8 element stiffness matrix for a QUAD4 element directly using 2x2 Gauss quadrature.
   */
  public static computeQuad4Ke(
    coords: { x: number; y: number }[],
    material: CleanRoomRawMaterial,
    thickness: number
  ): number[][] {
    const D = this.computePlaneStressD(material.E, material.nu);
    const gauss = this.getGaussPoints2x2();

    const Ke: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0.0));

    for (const pt of gauss) {
      const { B, detJ } = this.computeQuad4B(pt.xi, pt.eta, coords);
      const dV = detJ * pt.weight * thickness;

      // DB = D * B (3x8)
      const DB: number[][] = [
        new Array(8).fill(0),
        new Array(8).fill(0),
        new Array(8).fill(0)
      ];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          let sum = 0.0;
          for (let k = 0; k < 3; k++) {
            sum += D[r][k] * B[k][c];
          }
          DB[r][c] = sum;
        }
      }

      // Ke += B^T * DB * dV
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          let sum = 0.0;
          for (let k = 0; k < 3; k++) {
            sum += B[k][i] * DB[k][j];
          }
          Ke[i][j] += sum * dV;
        }
      }
    }

    return Ke;
  }

  /**
   * Assembles the independent global stiffness matrix and force vector from raw mesh and BC primitives.
   */
  public static assembleAndSolve(
    nodes: CleanRoomRawNode[],
    elements: CleanRoomRawElement[],
    material: CleanRoomRawMaterial,
    bcs: CleanRoomRawBC[],
    loads: CleanRoomRawLoad[]
  ): CleanRoomSolveResult {
    const numNodes = nodes.length;
    const totalDOFs = numNodes * 2;

    const nodeIndexMap = new Map<number, number>();
    nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

    // Global K (totalDOFs x totalDOFs)
    const K_global: number[][] = Array.from({ length: totalDOFs }, () => new Array(totalDOFs).fill(0.0));
    const F_global: number[] = new Array(totalDOFs).fill(0.0);

    // Assemble elements
    for (const elem of elements) {
      const elemCoords = elem.nodeIds.map(nid => {
        const idx = nodeIndexMap.get(nid);
        if (idx === undefined) throw new Error(`CleanRoom: Node ${nid} not found`);
        return { x: nodes[idx].x, y: nodes[idx].y };
      });

      const Ke = this.computeQuad4Ke(elemCoords, material, elem.thickness);

      // DOF mapping for this element
      const elemDofs: number[] = [];
      for (const nid of elem.nodeIds) {
        const idx = nodeIndexMap.get(nid)!;
        elemDofs.push(2 * idx, 2 * idx + 1);
      }

      for (let i = 0; i < 8; i++) {
        const gi = elemDofs[i];
        for (let j = 0; j < 8; j++) {
          const gj = elemDofs[j];
          K_global[gi][gj] += Ke[i][j];
        }
      }
    }

    // Apply nodal loads to F_global
    for (const l of loads) {
      const idx = nodeIndexMap.get(l.nodeId);
      if (idx !== undefined) {
        F_global[2 * idx] += l.fx;
        F_global[2 * idx + 1] += l.fy;
      }
    }

    // Identify constrained DOFs
    const constrained = new Set<number>();
    for (const bc of bcs) {
      const idx = nodeIndexMap.get(bc.nodeId);
      if (idx !== undefined) {
        if (bc.fixX) constrained.add(2 * idx);
        if (bc.fixY) constrained.add(2 * idx + 1);
      }
    }

    // Exact Dirichlet reduction: collect free DOFs
    const freeDofs: number[] = [];
    for (let i = 0; i < totalDOFs; i++) {
      if (!constrained.has(i)) {
        freeDofs.push(i);
      }
    }

    const nRed = freeDofs.length;
    const K_reduced: number[][] = Array.from({ length: nRed }, () => new Array(nRed).fill(0.0));
    const F_reduced: number[] = new Array(nRed).fill(0.0);

    for (let i = 0; i < nRed; i++) {
      const gi = freeDofs[i];
      F_reduced[i] = F_global[gi];
      for (let j = 0; j < nRed; j++) {
        const gj = freeDofs[j];
        K_reduced[i][j] = K_global[gi][gj];
      }
    }

    // Spectral and Cholesky analysis on K_reduced
    const spectral = this.computeCleanRoomSpectral(K_reduced);

    // Independent Direct Solve (Gaussian Elimination with partial pivoting)
    const uReduced = this.solveGaussian(K_reduced, F_reduced);

    // Expand to global displacement
    const uGlobal: number[] = new Array(totalDOFs).fill(0.0);
    for (let i = 0; i < nRed; i++) {
      uGlobal[freeDofs[i]] = uReduced[i];
    }

    // Strain Energy: 0.5 * u^T * K * u
    let strainEnergy = 0.0;
    for (let i = 0; i < nRed; i++) {
      for (let j = 0; j < nRed; j++) {
        strainEnergy += 0.5 * uReduced[i] * K_reduced[i][j] * uReduced[j];
      }
    }

    // Independent Residual: r = K_reduced * uReduced - F_reduced
    let residualNormSq = 0.0;
    let fNormSq = 0.0;
    for (let i = 0; i < nRed; i++) {
      let ku = 0.0;
      for (let j = 0; j < nRed; j++) {
        ku += K_reduced[i][j] * uReduced[j];
      }
      const ri = ku - F_reduced[i];
      residualNormSq += ri * ri;
      fNormSq += F_reduced[i] * F_reduced[i];
    }
    const residualNorm = Math.sqrt(residualNormSq);
    const fNorm = Math.sqrt(fNormSq);
    const relativeResidual = residualNorm / Math.max(1e-12, fNorm);

    return {
      uReduced,
      uGlobal,
      strainEnergy,
      residualNorm,
      relativeResidual,
      spectral,
      K_reduced,
      F_reduced,
      freeDofs
    };
  }

  /**
   * Independent Gaussian Elimination with row partial pivoting for general SPD / symmetric systems.
   */
  public static solveGaussian(A: number[][], b: number[]): number[] {
    const n = b.length;
    const M: number[][] = A.map((row, i) => [...row, b[i]]);

    for (let p = 0; p < n; p++) {
      // Find pivot
      let maxVal = Math.abs(M[p][p]);
      let maxRow = p;
      for (let r = p + 1; r < n; r++) {
        const val = Math.abs(M[r][p]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = r;
        }
      }

      if (maxVal < 1e-16) {
        throw new Error(`CleanRoom: Matrix is singular at pivot row ${p}`);
      }

      // Swap
      if (maxRow !== p) {
        const temp = M[p];
        M[p] = M[maxRow];
        M[maxRow] = temp;
      }

      // Eliminate
      for (let r = p + 1; r < n; r++) {
        const factor = M[r][p] / M[p][p];
        for (let c = p; c <= n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }

    // Back-substitution
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let sum = M[r][n];
      for (let c = r + 1; c < n; c++) {
        sum -= M[r][c] * x[c];
      }
      x[r] = sum / M[r][r];
    }

    return x;
  }

  /**
   * Independent Cholesky Decomposition L * L^T = A
   */
  public static choleskyDecomposition(A: number[][]): { isSPD: boolean; minPivot: number; L: number[][] } {
    const n = A.length;
    const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0.0));
    let minPivot = Infinity;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0.0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }

        if (i === j) {
          const val = A[i][i] - sum;
          if (val <= 1e-15 || !Number.isFinite(val)) {
            return { isSPD: false, minPivot: val, L };
          }
          minPivot = Math.min(minPivot, val);
          L[i][j] = Math.sqrt(val);
        } else {
          L[i][j] = (A[i][j] - sum) / L[j][j];
        }
      }
    }

    return { isSPD: true, minPivot, L };
  }

  /**
   * Independent Power Iteration & Shifted Inverse Iteration for spectral conditioning.
   */
  public static computeCleanRoomSpectral(A: number[][]): CleanRoomSpectralResult {
    const n = A.length;
    if (n === 0) {
      return { lambdaMin: 0, lambdaMax: 0, conditionNumber: 1, isPositiveDefinite: false, minCholeskyPivot: 0 };
    }

    const chol = this.choleskyDecomposition(A);

    // 1. Power iteration for lambda_max
    let q = new Array(n).fill(1.0 / Math.sqrt(n));
    let lambdaMax = 0.0;
    for (let iter = 0; iter < 120; iter++) {
      // z = A * q
      const z = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let s = 0.0;
        for (let j = 0; j < n; j++) s += A[i][j] * q[j];
        z[i] = s;
      }
      let normZ = 0.0;
      for (let i = 0; i < n; i++) normZ += z[i] * z[i];
      normZ = Math.sqrt(normZ);

      if (normZ < 1e-18) break;

      for (let i = 0; i < n; i++) q[i] = z[i] / normZ;

      // Rayleigh quotient
      let num = 0.0, den = 0.0;
      for (let i = 0; i < n; i++) {
        let s = 0.0;
        for (let j = 0; j < n; j++) s += A[i][j] * q[j];
        num += q[i] * s;
        den += q[i] * q[i];
      }
      lambdaMax = num / den;
    }

    // 2. Inverse iteration for lambda_min (solving A * w = q)
    let w = new Array(n).fill(1.0 / Math.sqrt(n));
    let lambdaMin = lambdaMax;
    if (chol.isSPD) {
      for (let iter = 0; iter < 120; iter++) {
        // solve A * z = w
        const z = this.solveGaussian(A, w);
        let normZ = 0.0;
        for (let i = 0; i < n; i++) normZ += z[i] * z[i];
        normZ = Math.sqrt(normZ);

        if (normZ < 1e-18) break;
        for (let i = 0; i < n; i++) w[i] = z[i] / normZ;

        // Rayleigh quotient
        let num = 0.0, den = 0.0;
        for (let i = 0; i < n; i++) {
          let s = 0.0;
          for (let j = 0; j < n; j++) s += A[i][j] * w[j];
          num += w[i] * s;
          den += w[i] * w[i];
        }
        lambdaMin = num / den;
      }
    }

    const conditionNumber = lambdaMin > 0 ? lambdaMax / lambdaMin : Infinity;

    return {
      lambdaMin,
      lambdaMax,
      conditionNumber,
      isPositiveDefinite: chol.isSPD,
      minCholeskyPivot: chol.minPivot
    };
  }

  /**
   * Computes relative Frobenius distance between two matrices: ||A - B||_F / max(1, ||B||_F)
   */
  public static computeMatrixRelativeDifference(A: number[][], B: number[][]): number {
    const n = A.length;
    let diffNormSq = 0.0;
    let bNormSq = 0.0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const d = A[i][j] - B[i][j];
        diffNormSq += d * d;
        bNormSq += B[i][j] * B[i][j];
      }
    }
    return Math.sqrt(diffNormSq) / Math.max(1e-15, Math.sqrt(bNormSq));
  }
}
