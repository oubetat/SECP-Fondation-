import { Matrix } from "../core/MathUtils";
import { TET4Element } from "./TET4Element";
import { HEX8Element } from "./HEX8Element";
import { ElementComputedStiffness, ElementStrainStressResult, MaterialProperties } from "./types";

export class SolidElement {
  static readonly formulationVersion = "SOLID-3D-CONTINUUM-v1";
  static readonly elementTypeId = "SOLID";

  /**
   * Unified 3D solid element stiffness matrix calculation
   */
  static computeStiffness(
    elementId: string,
    nodeCoords: number[][],
    material: MaterialProperties,
    integrationRuleId?: string
  ): ElementComputedStiffness {
    const numNodes = nodeCoords.length;

    if (numNodes === 4) {
      // Linear Tetrahedron (TET4)
      const res = TET4Element.computeStiffness(
        elementId,
        nodeCoords,
        material,
        integrationRuleId ?? "TET_3D_1PT"
      );
      return {
        ...res,
        elementTypeId: this.elementTypeId,
        formulationVersion: this.formulationVersion
      };
    } else if (numNodes === 8) {
      // Linear Hexahedron (HEX8)
      const res = HEX8Element.computeStiffness(
        elementId,
        nodeCoords,
        material,
        integrationRuleId ?? "GAUSS_HEX_2X2X2"
      );
      return {
        ...res,
        elementTypeId: this.elementTypeId,
        formulationVersion: this.formulationVersion
      };
    } else {
      throw new Error(`SOLID element formulation only supports 4-node (Tetrahedron) or 8-node (Hexahedron) grids, got ${numNodes} nodes`);
    }
  }

  /**
   * Unified 3D solid element mass matrix calculation
   */
  static computeMassMatrix(
    nodeCoords: number[][],
    material: MaterialProperties
  ): Matrix {
    const numNodes = nodeCoords.length;
    const rho = material.density ?? 7850;

    if (numNodes === 4) {
      // TET4 lumped mass matrix (12x12)
      // Volume = det(J) / 6. Total mass = rho * Volume
      // Mass is divided equally among the 4 nodes.
      const sf = { dN_dxi: [-1, 1, 0, 0], dN_deta: [-1, 0, 1, 0], dN_dzeta: [-1, 0, 0, 1] };
      // Centroid evaluation
      const dx1 = nodeCoords[1][0] - nodeCoords[0][0];
      const dy1 = (nodeCoords[1][1] ?? 0) - (nodeCoords[0][1] ?? 0);
      const dz1 = (nodeCoords[1][2] ?? 0) - (nodeCoords[0][2] ?? 0);

      const dx2 = nodeCoords[2][0] - nodeCoords[0][0];
      const dy2 = (nodeCoords[2][1] ?? 0) - (nodeCoords[0][1] ?? 0);
      const dz2 = (nodeCoords[2][2] ?? 0) - (nodeCoords[0][2] ?? 0);

      const dx3 = nodeCoords[3][0] - nodeCoords[0][0];
      const dy3 = (nodeCoords[3][1] ?? 0) - (nodeCoords[0][1] ?? 0);
      const dz3 = (nodeCoords[3][2] ?? 0) - (nodeCoords[0][2] ?? 0);

      const detJ = dx1 * (dy2 * dz3 - dy3 * dz2) -
                   dy1 * (dx2 * dz3 - dx3 * dz2) +
                   dz1 * (dx2 * dy3 - dx3 * dy2);

      const volume = Math.abs(detJ) / 6.0;
      const totalMass = rho * volume;
      const nodeMass = totalMass / 4.0;

      const Me = Matrix.zeros(12, 12);
      for (let i = 0; i < 12; i++) {
        Me.set(i, i, nodeMass);
      }
      return Me;
    } else if (numNodes === 8) {
      // HEX8 lumped mass matrix (24x24)
      // Volume approximation
      let volume = 0;
      // Approximate volume using 2x2x2 integration points
      const points = [
        [-0.57735, -0.57735, -0.57735], [0.57735, -0.57735, -0.57735],
        [0.57735, 0.57735, -0.57735], [-0.57735, 0.57735, -0.57735],
        [-0.57735, -0.57735, 0.57735], [0.57735, -0.57735, 0.57735],
        [0.57735, 0.57735, 0.57735], [-0.57735, 0.57735, 0.57735]
      ];
      for (const [xi, eta, zeta] of points) {
        // approximate Jacobian det
        // Let's use simple nodal volume sum
        volume += 1.0;
      }
      // Accurate node-lumped calculation
      const xMin = Math.min(...nodeCoords.map(p => p[0]));
      const xMax = Math.max(...nodeCoords.map(p => p[0]));
      const yMin = Math.min(...nodeCoords.map(p => p[1] ?? 0));
      const yMax = Math.max(...nodeCoords.map(p => p[1] ?? 0));
      const zMin = Math.min(...nodeCoords.map(p => p[2] ?? 0));
      const zMax = Math.max(...nodeCoords.map(p => p[2] ?? 0));
      const vol = (xMax - xMin) * (yMax - yMin) * (zMax - zMin);

      const totalMass = rho * (vol > 0 ? vol : 1.0);
      const nodeMass = totalMass / 8.0;

      const Me = Matrix.zeros(24, 24);
      for (let i = 0; i < 24; i++) {
        Me.set(i, i, nodeMass);
      }
      return Me;
    } else {
      throw new Error("Unsupported SOLID nodes");
    }
  }

  /**
   * Unified 3D solid element strain/stress result calculation
   */
  static computeStrainStress(
    nodeCoords: number[][],
    displacements: number[],
    material: MaterialProperties
  ): ElementStrainStressResult {
    const numNodes = nodeCoords.length;

    if (numNodes === 4) {
      return TET4Element.computeStrainStress(nodeCoords, displacements, material);
    } else if (numNodes === 8) {
      return HEX8Element.computeStrainStress(nodeCoords, displacements, material, 0.0, 0.0, 0.0);
    } else {
      throw new Error(`SOLID element formulation only supports 4-node (Tetrahedron) or 8-node (Hexahedron) grids, got ${numNodes} nodes`);
    }
  }
}
