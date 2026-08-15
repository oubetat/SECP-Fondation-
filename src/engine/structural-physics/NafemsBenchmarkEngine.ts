/**
 * PATCH-SECP-073.2: NAFEMS Benchmark & Patch Test Engine
 * Executes standard verification tests (e.g. Constant Stress Patch Test) 
 * to prove numerical convergence and exact mathematical formulation.
 */

import { ElementFormulationEngine } from './ElementFormulationEngine';
import { MeshNode, MeshElement } from './StructuralPhysicsTypes';
import { ShapeFunctionIsoparametricEngine } from './ShapeFunctionIsoparametricEngine';
import { ConstitutiveMatrixEngine } from './ConstitutiveMatrixEngine';
import { MaterialModelEngine } from './MaterialModelEngine';

export class NafemsBenchmarkEngine {
  /**
   * Evaluates the Constant Stress Patch Test for QUAD_2D elements.
   * If the formulation (B-matrix and Quadrature) is rigorous, applying exact 
   * analytical nodal displacements corresponding to a uniform stress state 
   * MUST produce identical (constant) stresses at all integration points.
   */
  public static runQuadPatchTest(): boolean {
    // 1. Setup a single irregularly shaped QUAD_2D to prove non-rectangular robustness
    const nodes: MeshNode[] = [
      { id: 1, x: 0.0, y: 0.0, z: 0, dofIndices: [] },
      { id: 2, x: 2.0, y: 0.5, z: 0, dofIndices: [] },
      { id: 3, x: 1.5, y: 2.0, z: 0, dofIndices: [] },
      { id: 4, x: 0.2, y: 1.8, z: 0, dofIndices: [] }
    ];

    const element: MeshElement = {
      id: 1,
      type: 'QUAD_2D',
      nodeIds: [1, 2, 3, 4],
      materialId: 'MAT-STEEL',
      thickness: 1.0
    };

    const material = MaterialModelEngine.getMaterial(element.materialId);
    const D = ConstitutiveMatrixEngine.getPlaneStressMatrix(material);

    // 2. Impose analytical linear displacement field u_x = a*x + b*y, u_y = c*x + d*y
    // This generates a constant strain field.
    const a = 1e-4, b = 2e-4, c = 3e-4, d = -1e-4;
    const uGlobal = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      uGlobal[2 * i]     = a * nodes[i].x + b * nodes[i].y; // u_x
      uGlobal[2 * i + 1] = c * nodes[i].x + d * nodes[i].y; // u_y
    }

    // 3. Evaluate Stresses at the 4 Gauss Quadrature Points
    const gaussPts = [
      { xi: -0.577, eta: -0.577 },
      { xi:  0.577, eta: -0.577 },
      { xi:  0.577, eta:  0.577 },
      { xi: -0.577, eta:  0.577 }
    ];

    const pointStresses: number[][] = [];

    for (const pt of gaussPts) {
      const { B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(pt.xi, pt.eta, nodes);
      
      // Strain = B * uGlobal
      const strain = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 8; j++) {
          strain[i] += B[i][j] * uGlobal[j];
        }
      }

      // Stress = D * Strain
      const stress = [0, 0, 0];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          stress[i] += D[i][j] * strain[j];
        }
      }
      pointStresses.push(stress);
    }

    // 4. Verification: Stresses at all points must be exactly identical
    const refStress = pointStresses[0];
    for (let i = 1; i < 4; i++) {
      const pStress = pointStresses[i];
      if (Math.abs(pStress[0] - refStress[0]) > 1e-10) return false;
      if (Math.abs(pStress[1] - refStress[1]) > 1e-10) return false;
      if (Math.abs(pStress[2] - refStress[2]) > 1e-10) return false;
    }

    return true; // Patch test passed
  }
}
