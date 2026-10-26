/**
 * SECP Industrial OS — Engineering Truth OS
 * GeometricStiffnessEngine.ts
 * 
 * SECP-FEM-UPGRADE-006: Geometric Stiffness Matrix Engine for Linear Buckling Analysis.
 * Computes exact element-level geometric stiffness matrices K_Ge from internal reference axial forces N,
 * and assembles the global geometric stiffness matrix K_G (SparseMatrix and Matrix).
 */

import { Matrix } from "../core/MathUtils";
import { SparseMatrix } from "../core/SparseMatrix";
import { DOFComponent, ElementStressStrainResult, FEMElement, FEMModel } from "../core/FEMTypes";
import { FEMDOFManager } from "../core/FEMDOFManager";
import { Frame2DFormulation } from "../core/Frame2DFormulation";

export class GeometricStiffnessEngine {
  private frameFormulation = new Frame2DFormulation();

  /**
   * Computes the 6x6 local geometric stiffness matrix K_g_local for a 2D Beam / Frame element
   * subjected to compressive axial load P = -N (where N is internal axial force, N < 0 for compression).
   */
  public computeBeam2DGeometricStiffnessLocal(L: number, P: number): Matrix {
    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[INVALID_GEOMETRY] Invalid element length L=${L} for geometric stiffness computation.`);
    }

    const factor = P / (30 * L);
    const L2 = L * L;

    // DOFs: [u1, v1, theta1, u2, v2, theta2]
    return new Matrix(6, 6, [
      [ 0,       0,        0,  0,        0,        0],
      [ 0,      36,    3 * L,  0,      -36,    3 * L],
      [ 0,   3 * L,   4 * L2,  0,   -3 * L,     -L2],
      [ 0,       0,        0,  0,        0,        0],
      [ 0,     -36,   -3 * L,  0,       36,   -3 * L],
      [ 0,   3 * L,     -L2,  0,   -3 * L,   4 * L2]
    ]).scale(factor);
  }

  /**
   * Computes global element geometric stiffness matrix K_Ge for a given element and reference stress result.
   */
  public computeElementGeometricStiffness(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    elemResult: ElementStressStrainResult
  ): { Kg_element: Matrix; globalDOFs: number[] } {
    const formulationId = element.formulationId;

    if (formulationId !== "BEAM_2D" && formulationId !== "FRAME_2D") {
      throw new Error(
        `[UNSUPPORTED_ELEMENT_FOR_BUCKLING] Formulation '${formulationId}' on element '${element.elementId}' is not supported for flexural buckling stiffness assembly. Supported elements: BEAM_2D, FRAME_2D.`
      );
    }

    const node1 = model.nodes.get(element.nodeIds[0]);
    const node2 = model.nodes.get(element.nodeIds[1]);
    if (!node1 || !node2) {
      throw new Error(`[ELEMENT_NODE_MISSING] Missing node definitions for element '${element.elementId}'`);
    }

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const L = Math.sqrt(dx * dx + dy * dy);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length element '${element.elementId}' in geometric stiffness calculation.`);
    }

    // Extract internal axial force N (N > 0 for tension, N < 0 for compression)
    const N = elemResult.internalForces?.N;
    if (N === undefined || !Number.isFinite(N)) {
      throw new Error(`[MISSING_REFERENCE_FORCE] Element '${element.elementId}' is missing reference internal axial force N.`);
    }

    // Compressive force P = -N
    const P = -N;

    // Local geometric stiffness matrix
    const Kg_local = this.computeBeam2DGeometricStiffnessLocal(L, P);

    // Coordinate transformation to global system
    const T = this.frameFormulation.computeTransformationMatrix(dx, dy, L);
    const T_trans = T.transpose();
    const Kg_global = T_trans.multiply(Kg_local).multiply(T);

    // Map global DOFs [UX, UY, RZ]
    const dofU1 = dofManager.getDOF(node1.nodeId, DOFComponent.UX);
    const dofV1 = dofManager.getDOF(node1.nodeId, DOFComponent.UY);
    const dofR1 = dofManager.getDOF(node1.nodeId, DOFComponent.RZ);
    const dofU2 = dofManager.getDOF(node2.nodeId, DOFComponent.UX);
    const dofV2 = dofManager.getDOF(node2.nodeId, DOFComponent.UY);
    const dofR2 = dofManager.getDOF(node2.nodeId, DOFComponent.RZ);

    if (!dofU1 || !dofV1 || !dofR1 || !dofU2 || !dofV2 || !dofR2) {
      throw new Error(`[DOF_NOT_FOUND] Missing degrees of freedom for element '${element.elementId}'`);
    }

    const globalDOFs = [
      dofU1.globalId,
      dofV1.globalId,
      dofR1.globalId,
      dofU2.globalId,
      dofV2.globalId,
      dofR2.globalId
    ];

    return { Kg_element: Kg_global, globalDOFs };
  }

  /**
   * Assembles the complete global geometric stiffness matrix K_G (SparseMatrix).
   */
  public assembleGlobalGeometricStiffness(
    model: FEMModel,
    dofManager: FEMDOFManager,
    elementFields: Map<string, ElementStressStrainResult>
  ): SparseMatrix {
    const totalDOFs = dofManager.getTotalDOFCount();
    const K_G_sparse = new SparseMatrix(totalDOFs, totalDOFs);

    for (const [elemId, element] of model.elements.entries()) {
      const elemResult = elementFields.get(elemId);
      if (!elemResult) {
        throw new Error(`[MISSING_ELEMENT_RESULT] Missing reference stress result for element '${elemId}'`);
      }

      const { Kg_element, globalDOFs } = this.computeElementGeometricStiffness(
        element,
        model,
        dofManager,
        elemResult
      );

      for (let r = 0; r < globalDOFs.length; r++) {
        const rowDOF = globalDOFs[r];
        for (let c = 0; c < globalDOFs.length; c++) {
          const colDOF = globalDOFs[c];
          const val = Kg_element.get(r, c);
          if (Math.abs(val) > 1e-15) {
            K_G_sparse.add(rowDOF, colDOF, val);
          }
        }
      }
    }

    return K_G_sparse;
  }
}
