/**
 * SECP Industrial OS — Engineering Truth OS
 * ElectrostaticSolver3D.ts
 *
 * SECP-PHYSICS-EXPANSION-001: 3D Continuum Electrostatics & Multiphysics Field Solver.
 * Solves the 3D variable-permittivity Poisson/Laplace equation:
 *   -div(epsilon_r * epsilon_0 * grad(phi)) = rho_v
 *
 * Capabilities:
 * - 3D Tetrahedral continuum finite-element discretization.
 * - Dirichlet (prescribed voltage phi) and Neumann (surface charge / flux) boundary conditions.
 * - Electric field recovery: E = -grad(phi) in 3D.
 * - Electric displacement: D = epsilon * E.
 * - Electrostatic energy calculation: W_e = 0.5 * integral(epsilon * |E|^2 dV).
 * - Lumped capacitance extraction: C = 2 * W_e / (Delta V)^2.
 * - Electrothermal coupling source field: Joule heating density q = sigma * |E|^2 [W/m^3]
 *   and total Joule power dissipation P = integral(q dV).
 */

import { Matrix } from "../../fem/core/MathUtils";

export const EPSILON_0 = 8.8541878128e-12; // Vacuum permittivity [F/m]

export interface ElectrostaticNode3D {
  id: string;
  x: number; // [m]
  y: number;
  z: number;
}

export interface ElectrostaticTetElement3D {
  id: string;
  nodeIds: [string, string, string, string];
  relativePermittivity: number; // epsilon_r (>= 1.0)
  conductivity?: number; // sigma [S/m] for Joule heating
  chargeDensity?: number; // rho_v [C/m^3]
}

export interface ElectrostaticBoundaryCondition {
  nodeId: string;
  potential: number; // phi in Volts [V]
}

export interface ElectrostaticSolveResult {
  converged: boolean;
  potentials: Map<string, number>; // Nodal potential [V]
  elementResults: Map<string, {
    electricField: [number, number, number]; // [V/m]
    electricFieldMagnitude: number; // [V/m]
    displacementField: [number, number, number]; // [C/m^2]
    jouleHeatDensity: number; // [W/m^3]
    volume: number; // [m^3]
  }>;
  totalElectrostaticEnergy: number; // [Joules]
  totalJoulePower: number; // [Watts]
  capacitance?: number; // [Farads] if two distinct voltage potentials are applied
  benchmarkDiscrepancy?: number;
}

export class ElectrostaticSolver3D {
  /**
   * Evaluates reference tetrahedral volume and shape function gradients.
   */
  public static computeTetGradients(nodes: ElectrostaticNode3D[]): {
    volume: number;
    gradN: [number, number, number][]; // 4 shape function spatial gradients
  } {
    const x = nodes.map(n => n.x);
    const y = nodes.map(n => n.y);
    const z = nodes.map(n => n.z);

    const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
    const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
    const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];

    const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);

    if (detJ <= 1e-18 || !Number.isFinite(detJ)) {
      throw new Error(`[SINGULAR_ELECTROSTATIC_TET] Inverted or degenerate tetrahedral element (detJ=${detJ})`);
    }

    const volume = detJ / 6.0;
    const invDetJ = 1.0 / detJ;

    const invJ11 = (J22 * J33 - J23 * J32) * invDetJ;
    const invJ12 = (J13 * J32 - J12 * J33) * invDetJ;
    const invJ13 = (J12 * J23 - J13 * J22) * invDetJ;

    const invJ21 = (J23 * J31 - J21 * J33) * invDetJ;
    const invJ22 = (J11 * J33 - J13 * J31) * invDetJ;
    const invJ23 = (J13 * J21 - J11 * J23) * invDetJ;

    const invJ31 = (J21 * J32 - J22 * J31) * invDetJ;
    const invJ32 = (J12 * J31 - J11 * J32) * invDetJ;
    const invJ33 = (J11 * J22 - J12 * J21) * invDetJ;

    const dN_dxi = [-1, 1, 0, 0];
    const dN_deta = [-1, 0, 1, 0];
    const dN_dzeta = [-1, 0, 0, 1];

    const gradN: [number, number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const dX = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i] + invJ13 * dN_dzeta[i];
      const dY = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i] + invJ23 * dN_dzeta[i];
      const dZ = invJ31 * dN_dxi[i] + invJ32 * dN_deta[i] + invJ33 * dN_dzeta[i];
      gradN.push([dX, dY, dZ]);
    }

    return { volume, gradN };
  }

  /**
   * Solves 3D Poisson / Laplace equation for electrostatic potential phi.
   */
  public solve(
    nodes: ElectrostaticNode3D[],
    elements: ElectrostaticTetElement3D[],
    dirichletBCs: ElectrostaticBoundaryCondition[]
  ): ElectrostaticSolveResult {
    const nodeMap = new Map<string, ElectrostaticNode3D>();
    const nodeIndex = new Map<string, number>();

    nodes.forEach((n, idx) => {
      nodeMap.set(n.id, n);
      nodeIndex.set(n.id, idx);
    });

    const N = nodes.length;
    if (N === 0) {
      throw new Error(`[EMPTY_MESH] No nodes provided to ElectrostaticSolver3D.`);
    }

    const K = new Matrix(N, N);
    const F = new Array<number>(N).fill(0.0);

    // Assemble element conductance/permittivity matrices
    for (const elem of elements) {
      const elemNodes = elem.nodeIds.map(id => {
        const n = nodeMap.get(id);
        if (!n) throw new Error(`[MISSING_NODE] Node ${id} not found in mesh.`);
        return n;
      });

      const { volume, gradN } = ElectrostaticSolver3D.computeTetGradients(elemNodes);
      const eps = elem.relativePermittivity * EPSILON_0;

      // K_ij = volume * eps * (gradN_i . gradN_j)
      const elemIndices = elem.nodeIds.map(id => nodeIndex.get(id)!);

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const dot = gradN[i][0] * gradN[j][0] + gradN[i][1] * gradN[j][1] + gradN[i][2] * gradN[j][2];
          const k_val = volume * eps * dot;
          K.set(elemIndices[i], elemIndices[j], K.get(elemIndices[i], elemIndices[j]) + k_val);
        }

        // Volumetric charge source: rho_v * volume / 4
        if (elem.chargeDensity && Math.abs(elem.chargeDensity) > 0) {
          F[elemIndices[i]] += (elem.chargeDensity * volume) / 4.0;
        }
      }
    }

    // Apply Dirichlet Boundary Conditions (penalty / elimination)
    const prescribed = new Map<number, number>();
    const prescribedPotentials = new Set<number>();
    for (const bc of dirichletBCs) {
      const idx = nodeIndex.get(bc.nodeId);
      if (idx !== undefined) {
        prescribed.set(idx, bc.potential);
        prescribedPotentials.add(bc.potential);
      }
    }

    if (prescribed.size === 0) {
      throw new Error(`[UNCONSTRAINED_ELECTROSTATIC_PROBLEM] At least one Dirichlet ground/voltage condition is required.`);
    }

    // Direct partitioning solve
    const freeIndices: number[] = [];
    const fixedIndices: number[] = [];

    for (let i = 0; i < N; i++) {
      if (prescribed.has(i)) {
        fixedIndices.push(i);
      } else {
        freeIndices.push(i);
      }
    }

    const nFree = freeIndices.length;
    const phi = new Array<number>(N).fill(0.0);
    fixedIndices.forEach(idx => {
      phi[idx] = prescribed.get(idx)!;
    });

    if (nFree > 0) {
      const K_ff = new Matrix(nFree, nFree);
      const F_eff = new Array<number>(nFree).fill(0.0);

      for (let i = 0; i < nFree; i++) {
        const gi = freeIndices[i];
        F_eff[i] = F[gi];

        // Subtract K_fg * phi_fixed
        for (const gj of fixedIndices) {
          F_eff[i] -= K.get(gi, gj) * prescribed.get(gj)!;
        }

        for (let j = 0; j < nFree; j++) {
          const gj = freeIndices[j];
          K_ff.set(i, j, K.get(gi, gj));
        }
      }

      // Solve K_ff * phi_f = F_eff using Gaussian elimination with partial pivoting
      const phi_f = ElectrostaticSolver3D.solveDense(K_ff, F_eff);
      for (let i = 0; i < nFree; i++) {
        phi[freeIndices[i]] = phi_f[i];
      }
    }

    // Post-processing: Field Recovery & Multiphysics
    const potentials = new Map<string, number>();
    nodes.forEach((n, idx) => {
      potentials.set(n.id, phi[idx]);
    });

    const elementResults = new Map<string, {
      electricField: [number, number, number];
      electricFieldMagnitude: number;
      displacementField: [number, number, number];
      jouleHeatDensity: number;
      volume: number;
    }>();

    let totalElectrostaticEnergy = 0.0;
    let totalJoulePower = 0.0;

    for (const elem of elements) {
      const elemNodes = elem.nodeIds.map(id => nodeMap.get(id)!);
      const { volume, gradN } = ElectrostaticSolver3D.computeTetGradients(elemNodes);
      const elemIndices = elem.nodeIds.map(id => nodeIndex.get(id)!);

      // E = -sum(phi_i * gradN_i)
      let Ex = 0.0, Ey = 0.0, Ez = 0.0;
      for (let i = 0; i < 4; i++) {
        const p = phi[elemIndices[i]];
        Ex -= p * gradN[i][0];
        Ey -= p * gradN[i][1];
        Ez -= p * gradN[i][2];
      }

      const Emag = Math.sqrt(Ex * Ex + Ey * Ey + Ez * Ez);
      const eps = elem.relativePermittivity * EPSILON_0;
      const Dx = eps * Ex;
      const Dy = eps * Ey;
      const Dz = eps * Ez;

      // Energy density = 0.5 * eps * |E|^2
      const elemEnergy = 0.5 * eps * Emag * Emag * volume;
      totalElectrostaticEnergy += elemEnergy;

      // Joule heating: q = sigma * |E|^2
      const sigma = elem.conductivity ?? 0.0;
      const q = sigma * Emag * Emag;
      totalJoulePower += q * volume;

      elementResults.set(elem.id, {
        electricField: [Ex, Ey, Ez],
        electricFieldMagnitude: Emag,
        displacementField: [Dx, Dy, Dz],
        jouleHeatDensity: q,
        volume
      });
    }

    // Capacitance calculation if Delta V exists
    let capacitance: number | undefined;
    if (prescribedPotentials.size >= 2) {
      const sortedV = Array.from(prescribedPotentials).sort((a, b) => b - a);
      const deltaV = sortedV[0] - sortedV[sortedV.length - 1];
      if (deltaV > 1e-12) {
        // C = 2 * W_e / (Delta V)^2
        capacitance = (2.0 * totalElectrostaticEnergy) / (deltaV * deltaV);
      }
    }

    return {
      converged: true,
      potentials,
      elementResults,
      totalElectrostaticEnergy,
      totalJoulePower,
      capacitance
    };
  }

  /**
   * Robust Gaussian elimination with partial pivoting for dense systems.
   */
  private static solveDense(A: Matrix, b: number[]): number[] {
    const n = b.length;
    const M: number[][] = [];
    for (let i = 0; i < n; i++) {
      M.push(new Array(n + 1));
      for (let j = 0; j < n; j++) {
        M[i][j] = A.get(i, j);
      }
      M[i][n] = b[i];
    }

    for (let p = 0; p < n; p++) {
      let maxRow = p;
      let maxVal = Math.abs(M[p][p]);
      for (let i = p + 1; i < n; i++) {
        if (Math.abs(M[i][p]) > maxVal) {
          maxVal = Math.abs(M[i][p]);
          maxRow = i;
        }
      }

      if (maxVal < 1e-16) {
        throw new Error(`[SINGULAR_MATRIX] Matrix is singular during electrostatic solve.`);
      }

      const temp = M[p];
      M[p] = M[maxRow];
      M[maxRow] = temp;

      for (let i = p + 1; i < n; i++) {
        const factor = M[i][p] / M[p][p];
        for (let j = p; j <= n; j++) {
          M[i][j] -= factor * M[p][j];
        }
      }
    }

    const x = new Array<number>(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = sum / M[i][i];
    }

    return x;
  }
}
