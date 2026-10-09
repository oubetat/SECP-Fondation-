import { Matrix } from "../core/MathUtils";
import { IntegrationEngine } from "./IntegrationEngine";
import { ElementComputedStiffness, ElementStrainStressResult, MaterialProperties } from "./types";

export class BeamElement {
  static readonly formulationVersion = "BEAM-3D-EULER-BERNOULLI-v1";
  static readonly elementTypeId = "BEAM";

  /**
   * Compute Hermite bending shape functions and second derivatives at natural coordinate xi in [-1, 1]
   */
  static evaluateBendingShapeFunctions(xi: number, L: number) {
    // Hermite shape functions
    const N = [
      0.25 * (1 - xi) * (1 - xi) * (2 + xi),
      (L / 8) * (1 - xi) * (1 - xi) * (1 + xi),
      0.25 * (1 + xi) * (1 + xi) * (2 - xi),
      (L / 8) * (1 + xi) * (1 + xi) * (xi - 1)
    ];

    // Second derivatives with respect to xi d^2N/dxi^2
    const d2N_dxi2 = [
      1.5 * xi,
      (L / 4) * (3 * xi - 1),
      -1.5 * xi,
      (L / 4) * (3 * xi + 1)
    ];

    // Convert to spatial second derivatives d^2N/dx^2 = (4 / L^2) * d^2N/dxi^2
    const d2N_dx2 = d2N_dxi2.map(v => (4.0 / (L * L)) * v);

    return { N, d2N_dx2 };
  }

  /**
   * Compute 3D coordinate transformation matrix T (12x12) from direction cosines
   */
  static computeTransformationMatrix(nodeCoords: number[][], L: number): Matrix {
    const p1 = nodeCoords[0];
    const p2 = nodeCoords[1];

    const dx = p2[0] - p1[0];
    const dy = (p2[1] ?? 0) - (p1[1] ?? 0);
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);

    // Local X axis (direction cosines)
    const ux = [dx / L, dy / L, dz / L];

    // Local Y and Z axes
    let uy = [0, 0, 0];
    let uz = [0, 0, 0];

    // If vertical beam along Z-axis
    if (Math.abs(ux[0]) < 1e-6 && Math.abs(ux[1]) < 1e-6) {
      uy = [0, 1, 0];
      uz = [-ux[2], 0, 0]; // Maintains right-handed coordinate system
    } else {
      // General case: Z is perpendicular to local X and global Z
      const len = Math.sqrt(ux[0] * ux[0] + ux[1] * ux[1]);
      uz = [-ux[1] / len, ux[0] / len, 0];
      // Y-axis = Z-axis x X-axis
      uy = [
        uz[1] * ux[2] - uz[2] * ux[1],
        uz[2] * ux[0] - uz[0] * ux[2],
        uz[0] * ux[1] - uz[1] * ux[0]
      ];
    }

    // Normalization of vectors
    const norm = (v: number[]) => {
      const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      return v.map(vi => vi / mag);
    };

    const ex = norm(ux);
    const ey = norm(uy);
    const ez = norm(uz);

    // 3x3 rotation matrix R
    const R = [
      [ex[0], ex[1], ex[2]],
      [ey[0], ey[1], ey[2]],
      [ez[0], ez[1], ez[2]]
    ];

    // Build 12x12 block diagonal transformation matrix T
    const T = Matrix.zeros(12, 12);
    for (let b = 0; b < 4; b++) {
      const rowOffset = b * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          T.set(rowOffset + i, rowOffset + j, R[i][j]);
        }
      }
    }

    return T;
  }

  /**
   * Compute 3D Euler-Bernoulli beam stiffness matrix (12x12)
   */
  static computeStiffness(
    elementId: string,
    nodeCoords: number[][],
    material: MaterialProperties,
    integrationRuleId = "GAUSS_1D_2PT"
  ): ElementComputedStiffness {
    if (nodeCoords.length !== 2) {
      throw new Error(`BEAM element requires exactly 2 nodes, got ${nodeCoords.length}`);
    }

    const p1 = nodeCoords[0];
    const p2 = nodeCoords[1];

    const dx = p2[0] - p1[0];
    const dy = (p2[1] ?? 0) - (p1[1] ?? 0);
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L < 1e-12) {
      throw new Error(`INVALID_GEOMETRY: BEAM length is zero, L=${L}`);
    }

    const E = material.E;
    if (E <= 0) throw new Error("Young's modulus E must be positive");

    const nu = material.nu ?? 0.3;
    const G = E / (2 * (1 + nu)); // Shear modulus

    const A = material.area ?? 0.01;
    const Iy = (material as any).Iy ?? 1e-5;
    const Iz = (material as any).Iz ?? 1e-5;
    const J = (material as any).J ?? 2e-5;

    if (A <= 0 || Iy <= 0 || Iz <= 0 || J <= 0) {
      throw new Error(`INVALID_GEOMETRY: Cross-section parameters (A, Iy, Iz, J) must be positive: A=${A}, Iy=${Iy}, Iz=${Iz}, J=${J}`);
    }

    // Initialize 12x12 local stiffness matrix
    const Ke_local = Matrix.zeros(12, 12);

    // 1. Axial deformation: k_axial = EA/L * [[1, -1], [-1, 1]]
    // DOFs: 0 (u1), 6 (u2)
    const k_axial = (E * A) / L;
    Ke_local.set(0, 0, k_axial);
    Ke_local.set(0, 6, -k_axial);
    Ke_local.set(6, 0, -k_axial);
    Ke_local.set(6, 6, k_axial);

    // 2. Torsional deformation: k_torsion = GJ/L * [[1, -1], [-1, 1]]
    // DOFs: 3 (theta_x1), 9 (theta_x2)
    const k_torsion = (G * J) / L;
    Ke_local.set(3, 3, k_torsion);
    Ke_local.set(3, 9, -k_torsion);
    Ke_local.set(9, 3, -k_torsion);
    Ke_local.set(9, 9, k_torsion);

    // 3. Bending: Integrate shape functions numerically using Gauss-Legendre
    const rule = IntegrationEngine.getRule(integrationRuleId);
    const detJ = L / 2; // mapping [-1, 1] to [0, L]

    for (const pt of rule.points) {
      const xi = pt.xi;
      const weight = pt.weight;

      const evalY = this.evaluateBendingShapeFunctions(xi, L);
      const evalZ = this.evaluateBendingShapeFunctions(xi, L);

      // Bending about local Z axis: displacement v (DOFs 1, 7) and rotations theta_z (DOFs 5, 11)
      // Bending stiffness term is EI_z * d^2N_i/dx^2 * d^2N_j/dx^2
      const mapZ = [1, 5, 7, 11];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const r = mapZ[i];
          const c = mapZ[j];
          const val = E * Iz * evalZ.d2N_dx2[i] * evalZ.d2N_dx2[j] * detJ * weight;
          Ke_local.add(r, c, val);
        }
      }

      // Bending about local Y axis: displacement w (DOFs 2, 8) and rotations theta_y (DOFs 4, 10)
      // Bending stiffness term is EI_y * d^2N_i/dx^2 * d^2N_j/dx^2
      // Standard Hermite sign convention for coordinate system rotation
      const mapY = [2, 4, 8, 10];
      const signY = [1, -1, 1, -1]; // to maintain right-handed bending coordinate consistency
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const r = mapY[i];
          const c = mapY[j];
          const val = E * Iy * evalY.d2N_dx2[i] * evalY.d2N_dx2[j] * signY[i] * signY[j] * detJ * weight;
          Ke_local.add(r, c, val);
        }
      }
    }

    // Transform local stiffness to global system Ke_global = T^T * Ke_local * T
    const T = this.computeTransformationMatrix(nodeCoords, L);
    const Ke_global = T.transpose().multiply(Ke_local).multiply(T);

    const matrixHash = `BEAM_12x12_L${L.toFixed(6)}_E${E}_A${A}_Iy${Iy}_Iz${Iz}_J${J}`;

    return {
      elementId,
      elementTypeId: this.elementTypeId,
      formulationVersion: this.formulationVersion,
      stiffnessMatrix: Ke_global,
      integrationRuleId,
      dofCount: 12,
      matrixHash
    };
  }

  /**
   * Compute consistent mass matrix (12x12)
   */
  static computeMassMatrix(
    nodeCoords: number[][],
    material: MaterialProperties
  ): Matrix {
    const p1 = nodeCoords[0];
    const p2 = nodeCoords[1];

    const dx = p2[0] - p1[0];
    const dy = (p2[1] ?? 0) - (p1[1] ?? 0);
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const rho = material.density ?? 7850;
    const A = material.area ?? 0.01;
    const J = (material as any).J ?? 2e-5;
    const mL = rho * A * L;

    // Direct consistent mass matrix calculation in local coordinates
    const Me_local = Matrix.zeros(12, 12);

    // Axial translation mass
    const m_axial = (rho * A * L) / 6;
    Me_local.set(0, 0, m_axial * 2);
    Me_local.set(0, 6, m_axial);
    Me_local.set(6, 0, m_axial);
    Me_local.set(6, 6, m_axial * 2);

    // Torsional inertia mass
    const m_torsion = (rho * J * L) / 6;
    Me_local.set(3, 3, m_torsion * 2);
    Me_local.set(3, 9, m_torsion);
    Me_local.set(9, 3, m_torsion);
    Me_local.set(9, 9, m_torsion * 2);

    // Bending transverse and rotation mass in Z-plane (Hermite consistent mass matrix)
    const factorY = mL / 420;
    const bendY = [
      [156, 22 * L, 54, -13 * L],
      [22 * L, 4 * L * L, 13 * L, -3 * L * L],
      [54, 13 * L, 156, -22 * L],
      [-13 * L, -3 * L * L, -22 * L, 4 * L * L]
    ];
    const mapZ = [1, 5, 7, 11];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        Me_local.set(mapZ[i], mapZ[j], factorY * bendY[i][j]);
      }
    }

    // Bending in Y-plane
    const mapY = [2, 4, 8, 10];
    const signY = [1, -1, 1, -1];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        Me_local.set(mapY[i], mapY[j], factorY * bendY[i][j] * signY[i] * signY[j]);
      }
    }

    // Rotate local mass matrix to global system Me_global = T^T * Me_local * T
    const T = this.computeTransformationMatrix(nodeCoords, L);
    const Me_global = T.transpose().multiply(Me_local).multiply(T);

    return Me_global;
  }

  /**
   * Compute strain & stress results for a beam element given nodal displacements
   */
  static computeStrainStress(
    nodeCoords: number[][],
    displacements: number[],
    material: MaterialProperties
  ): ElementStrainStressResult {
    if (displacements.length !== 12) {
      throw new Error(`BEAM requires 12 displacement DOFs, got ${displacements.length}`);
    }

    const p1 = nodeCoords[0];
    const p2 = nodeCoords[1];

    const dx = p2[0] - p1[0];
    const dy = (p2[1] ?? 0) - (p1[1] ?? 0);
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const E = material.E;
    const A = material.area ?? 0.01;
    const Iz = (material as any).Iz ?? 1e-5;

    // Transform displacements from global to local coordinate system: u_local = T * u_global
    const T = this.computeTransformationMatrix(nodeCoords, L);
    const u_local = T.multiplyVector(displacements);

    // Axial strain: (u_local2 - u_local1) / L
    const axialStrain = (u_local[6] - u_local[0]) / L;
    const axialStress = E * axialStrain;

    // Max bending stress: sigma_b = M * c / I where c is distance to neutral axis (approximate c = sqrt(A)/2)
    const c = Math.sqrt(A) / 2.0;
    // Bending moment at center of beam (xi = 0)
    // d^2v/dx^2 = sum_i d^2N_i/dx^2 * u_local_i
    const evalZ = this.evaluateBendingShapeFunctions(0.0, L);
    const mapZ = [1, 5, 7, 11];
    let d2v_dx2 = 0;
    for (let i = 0; i < 4; i++) {
      d2v_dx2 += evalZ.d2N_dx2[i] * u_local[mapZ[i]];
    }

    const bendingStrain = c * Math.abs(d2v_dx2);
    const bendingStress = E * bendingStrain;

    // Total combined axial + bending stress
    const combinedStress = axialStress + (axialStress >= 0 ? bendingStress : -bendingStress);
    const combinedStrain = axialStrain + (axialStrain >= 0 ? bendingStrain : -bendingStrain);

    return {
      strain: [combinedStrain, axialStrain, bendingStrain],
      stress: [combinedStress, axialStress, bendingStress],
      vonMisesStress: Math.abs(combinedStress),
      location: { xi: 0.0 }
    };
  }
}
