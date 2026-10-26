/**
 * SECP Industrial OS — FEM Core Structural Dynamics (SECP-FEM-UPGRADE-007)
 * MassMatrixEngine.ts
 * 
 * Computes consistent and lumped mass matrices for all supported FEM element formulations:
 * - BAR_1D
 * - BEAM_2D
 * - FRAME_2D
 * - CST_2D
 * - Q4_2D
 * - T6_2D
 * - TET4_3D
 * 
 * Assembles global sparse mass matrix M in SparseMatrix format.
 */

import { Matrix } from "../core/MathUtils";
import { SparseMatrix } from "../core/SparseMatrix";
import { DOFComponent, FEMElement, FEMModel } from "../core/FEMTypes";
import { FEMDOFManager } from "../core/FEMDOFManager";

export type MassMatrixType = 'CONSISTENT' | 'LUMPED';

export interface MassMatrixOptions {
  type?: MassMatrixType;
}

export interface ElementMassResult {
  Me: Matrix;
  globalDOFs: number[];
}

export class MassMatrixEngine {
  /**
   * Compute element mass matrix (consistent or lumped) in global coordinates.
   */
  public computeElementMassMatrix(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    type: MassMatrixType = 'CONSISTENT'
  ): ElementMassResult {
    const material = model.materials.get(element.materialId);
    if (!material) {
      throw new Error(`[INVALID_MATERIAL] Material '${element.materialId}' not found for element '${element.elementId}'`);
    }

    const rho = material.density;
    if (rho === undefined || rho <= 0 || !Number.isFinite(rho)) {
      throw new Error(`[INVALID_DENSITY] Invalid or non-positive material density rho=${rho} for material '${element.materialId}'`);
    }

    if (!Number.isFinite(material.E) || material.E <= 0) {
      throw new Error(`[INVALID_MATERIAL] Invalid Young's modulus E=${material.E} for material '${element.materialId}'`);
    }

    const formulationId = element.formulationId;

    switch (formulationId) {
      case 'BAR_1D':
        return this.computeBar1DMass(element, model, dofManager, rho, type);
      case 'BEAM_2D':
      case 'FRAME_2D':
        return this.computeFrame2DMass(element, model, dofManager, rho, type);
      case 'CST_2D':
        return this.computeCST2DMass(element, model, dofManager, rho, type);
      case 'Q4_2D':
        return this.computeQ42DMass(element, model, dofManager, rho, type);
      case 'T6_2D':
        return this.computeT62DMass(element, model, dofManager, rho, type);
      case 'TET4_3D':
        return this.computeTET43DMass(element, model, dofManager, rho, type);
      default:
        throw new Error(`[UNSUPPORTED_FORMULATION] Mass matrix not implemented for formulation '${formulationId}'`);
    }
  }

  /**
   * Assembles the global sparse mass matrix M.
   */
  public assembleSparseMassMatrix(
    model: FEMModel,
    dofManager: FEMDOFManager,
    options: MassMatrixOptions = {}
  ): SparseMatrix {
    const type = options.type || 'CONSISTENT';
    const totalDOFs = dofManager.getTotalDOFCount();
    if (totalDOFs === 0) {
      throw new Error("[EMPTY_MODEL] Cannot assemble mass matrix for model with 0 DOFs");
    }

    const M_sparse = new SparseMatrix(totalDOFs, totalDOFs);

    for (const [elemId, element] of model.elements.entries()) {
      const { Me, globalDOFs } = this.computeElementMassMatrix(element, model, dofManager, type);

      for (let i = 0; i < globalDOFs.length; i++) {
        const row = globalDOFs[i];
        if (row < 0 || row >= totalDOFs) {
          throw new Error(`[DOF_OUT_OF_BOUNDS] Global DOF ${row} out of bounds for element '${elemId}'`);
        }
        for (let j = 0; j < globalDOFs.length; j++) {
          const col = globalDOFs[j];
          if (col < 0 || col >= totalDOFs) {
            throw new Error(`[DOF_OUT_OF_BOUNDS] Global DOF ${col} out of bounds for element '${elemId}'`);
          }
          const val = Me.get(i, j);
          if (!Number.isFinite(val)) {
            throw new Error(`[NUMERICAL_ERROR] Non-finite mass value ${val} for element '${elemId}' at (${i},${j})`);
          }
          if (val !== 0) {
            M_sparse.add(row, col, val);
          }
        }
      }
    }

    return M_sparse;
  }

  // --- Formulation Specific Implementations ---

  private computeBar1DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const section = model.sections.get(element.sectionId);

    if (!section || !section.area || section.area <= 0) {
      throw new Error(`[INVALID_SECTION] Bar element '${element.elementId}' requires valid area`);
    }

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = n2.z - n1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length bar element '${element.elementId}'`);
    }

    const totalMass = rho * section.area * L;
    let Me: Matrix;

    if (type === 'LUMPED') {
      const halfM = totalMass / 2;
      Me = new Matrix(2, 2, [
        [halfM, 0],
        [0, halfM]
      ]);
    } else {
      const factor = totalMass / 6;
      Me = new Matrix(2, 2, [
        [2 * factor, factor],
        [factor, 2 * factor]
      ]);
    }

    const dof1 = dofManager.getDOF(n1.nodeId, DOFComponent.UX);
    const dof2 = dofManager.getDOF(n2.nodeId, DOFComponent.UX);

    if (!dof1 || !dof2) {
      throw new Error(`[DOF_NOT_FOUND] Bar DOFs missing for element '${element.elementId}'`);
    }

    return {
      Me,
      globalDOFs: [dof1.globalId, dof2.globalId]
    };
  }

  private computeFrame2DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const section = model.sections.get(element.sectionId);

    if (!section || !section.area || section.area <= 0) {
      throw new Error(`[INVALID_SECTION] Beam/Frame element '${element.elementId}' requires valid area`);
    }

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.sqrt(dx * dx + dy * dy);

    if (L <= 0 || !Number.isFinite(L)) {
      throw new Error(`[ZERO_LENGTH_ELEMENT] Zero length frame element '${element.elementId}'`);
    }

    const c = dx / L;
    const s = dy / L;

    const A = section.area;
    const m = rho * A * L;

    // Local mass matrix (6x6): DOFs = [u1, v1, theta1, u2, v2, theta2]
    const Me_local = new Matrix(6, 6);

    if (type === 'LUMPED') {
      const halfM = m / 2;
      // Rotational lump: m * L^2 / 78 or similar HRZ-type rotational lumping
      const rotM = (m * L * L) / 78;

      Me_local.set(0, 0, halfM);
      Me_local.set(1, 1, halfM);
      Me_local.set(2, 2, rotM);

      Me_local.set(3, 3, halfM);
      Me_local.set(4, 4, halfM);
      Me_local.set(5, 5, rotM);
    } else {
      // Axial contribution
      const ma = m / 6;
      Me_local.set(0, 0, 2 * ma);
      Me_local.set(0, 3, ma);
      Me_local.set(3, 0, ma);
      Me_local.set(3, 3, 2 * ma);

      // Transverse bending contribution (Euler-Bernoulli)
      const mb = m / 420;
      Me_local.set(1, 1, 156 * mb);
      Me_local.set(1, 2, 22 * L * mb);
      Me_local.set(1, 4, 54 * mb);
      Me_local.set(1, 5, -13 * L * mb);

      Me_local.set(2, 1, 22 * L * mb);
      Me_local.set(2, 2, 4 * L * L * mb);
      Me_local.set(2, 4, 13 * L * mb);
      Me_local.set(2, 5, -3 * L * L * mb);

      Me_local.set(4, 1, 54 * mb);
      Me_local.set(4, 2, 13 * L * mb);
      Me_local.set(4, 4, 156 * mb);
      Me_local.set(4, 5, -22 * L * mb);

      Me_local.set(5, 1, -13 * L * mb);
      Me_local.set(5, 2, -3 * L * L * mb);
      Me_local.set(5, 4, -22 * L * mb);
      Me_local.set(5, 5, 4 * L * L * mb);
    }

    // Transformation T: 6x6 block diagonal
    // T_node = [c s 0; -s c 0; 0 0 1]
    const T = new Matrix(6, 6);
    T.set(0, 0, c); T.set(0, 1, s);
    T.set(1, 0, -s); T.set(1, 1, c);
    T.set(2, 2, 1);

    T.set(3, 3, c); T.set(3, 4, s);
    T.set(4, 3, -s); T.set(4, 4, c);
    T.set(5, 5, 1);

    // Me_global = T^T * Me_local * T
    const T_trans = T.transpose();
    const Me_global = T_trans.multiply(Me_local).multiply(T);

    const globalDOFs = [
      dofManager.getDOF(n1.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n1.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n1.nodeId, DOFComponent.RZ)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.RZ)!.globalId,
    ];

    return {
      Me: Me_global,
      globalDOFs
    };
  }

  private computeCST2DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const n3 = model.nodes.get(element.nodeIds[2])!;
    const section = model.sections.get(element.sectionId);

    if (!section || !section.thickness || section.thickness <= 0) {
      throw new Error(`[INVALID_SECTION] CST element '${element.elementId}' requires valid thickness`);
    }

    const detJ = (n2.x - n1.x) * (n3.y - n1.y) - (n3.x - n1.x) * (n2.y - n1.y);
    const Area = detJ / 2;

    if (Area <= 0 || !Number.isFinite(Area)) {
      throw new Error(`[NEGATIVE_JACOBIAN] CST element '${element.elementId}' has invalid orientation or zero area`);
    }

    const totalMass = rho * section.thickness * Area;
    const Me = new Matrix(6, 6);

    if (type === 'LUMPED') {
      const nodeMass = totalMass / 3;
      for (let i = 0; i < 6; i++) {
        Me.set(i, i, nodeMass);
      }
    } else {
      // Consistent mass matrix for 3-node triangle (2 DOFs/node = 6 DOFs)
      // M_ij = totalMass / 12 for off-diag, totalMass / 6 for diag blocks
      const offDiag = totalMass / 12;
      const diag = totalMass / 6;

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const factor = (i === j) ? diag : offDiag;
          Me.set(2 * i, 2 * j, factor);
          Me.set(2 * i + 1, 2 * j + 1, factor);
        }
      }
    }

    const globalDOFs = [
      dofManager.getDOF(n1.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n1.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UY)!.globalId,
    ];

    return { Me, globalDOFs };
  }

  private computeQ42DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    if (nodes.length !== 4) {
      throw new Error(`[INVALID_ELEMENT] Q4 element '${element.elementId}' must have 4 nodes`);
    }
    const section = model.sections.get(element.sectionId);

    if (!section || !section.thickness || section.thickness <= 0) {
      throw new Error(`[INVALID_SECTION] Q4 element '${element.elementId}' requires valid thickness`);
    }

    const t = section.thickness;
    const Me = new Matrix(8, 8);

    if (type === 'LUMPED') {
      // Calculate total area via Gauss integration or 2 triangles
      let totalMass = 0;
      const gaussPts = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];

      for (const xi of gaussPts) {
        for (const eta of gaussPts) {
          let dXdXi = 0, dXdEta = 0, dYdXi = 0, dYdEta = 0;
          const dN_dXi = [
            -0.25 * (1 - eta), 0.25 * (1 - eta), 0.25 * (1 + eta), -0.25 * (1 + eta)
          ];
          const dN_dEta = [
            -0.25 * (1 - xi), -0.25 * (1 + xi), 0.25 * (1 + xi), 0.25 * (1 - xi)
          ];

          for (let i = 0; i < 4; i++) {
            dXdXi += dN_dXi[i] * nodes[i].x;
            dXdEta += dN_dEta[i] * nodes[i].x;
            dYdXi += dN_dXi[i] * nodes[i].y;
            dYdEta += dN_dEta[i] * nodes[i].y;
          }

          const detJ = dXdXi * dYdEta - dXdEta * dYdXi;
          if (detJ <= 0) {
            throw new Error(`[NEGATIVE_JACOBIAN] Q4 element '${element.elementId}' negative determinant at (${xi}, ${eta})`);
          }
          totalMass += rho * t * detJ * 1.0;
        }
      }

      const nodeMass = totalMass / 4;
      for (let i = 0; i < 8; i++) {
        Me.set(i, i, nodeMass);
      }
    } else {
      // 2x2 Gauss integration for consistent mass matrix
      const gaussPts = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];

      for (const xi of gaussPts) {
        for (const eta of gaussPts) {
          const N = [
            0.25 * (1 - xi) * (1 - eta),
            0.25 * (1 + xi) * (1 - eta),
            0.25 * (1 + xi) * (1 + eta),
            0.25 * (1 - xi) * (1 + eta)
          ];

          const dN_dXi = [
            -0.25 * (1 - eta), 0.25 * (1 - eta), 0.25 * (1 + eta), -0.25 * (1 + eta)
          ];
          const dN_dEta = [
            -0.25 * (1 - xi), -0.25 * (1 + xi), 0.25 * (1 + xi), 0.25 * (1 - xi)
          ];

          let dXdXi = 0, dXdEta = 0, dYdXi = 0, dYdEta = 0;
          for (let i = 0; i < 4; i++) {
            dXdXi += dN_dXi[i] * nodes[i].x;
            dXdEta += dN_dEta[i] * nodes[i].x;
            dYdXi += dN_dXi[i] * nodes[i].y;
            dYdEta += dN_dEta[i] * nodes[i].y;
          }

          const detJ = dXdXi * dYdEta - dXdEta * dYdXi;
          if (detJ <= 0) {
            throw new Error(`[NEGATIVE_JACOBIAN] Q4 element '${element.elementId}' negative determinant at (${xi}, ${eta})`);
          }

          const factor = rho * t * detJ;

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
              const val = N[i] * N[j] * factor;
              Me.set(2 * i, 2 * j, Me.get(2 * i, 2 * j) + val);
              Me.set(2 * i + 1, 2 * j + 1, Me.get(2 * i + 1, 2 * j + 1) + val);
            }
          }
        }
      }
    }

    const globalDOFs = [
      dofManager.getDOF(nodes[0].nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(nodes[0].nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(nodes[1].nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(nodes[1].nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(nodes[2].nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(nodes[2].nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(nodes[3].nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(nodes[3].nodeId, DOFComponent.UY)!.globalId,
    ];

    return { Me, globalDOFs };
  }

  private computeT62DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    if (nodes.length !== 6) {
      throw new Error(`[INVALID_ELEMENT] T6 element '${element.elementId}' must have 6 nodes`);
    }
    const section = model.sections.get(element.sectionId);

    if (!section || !section.thickness || section.thickness <= 0) {
      throw new Error(`[INVALID_SECTION] T6 element '${element.elementId}' requires valid thickness`);
    }

    const t = section.thickness;
    const Me = new Matrix(12, 12);

    // 3-point triangle Gauss rule
    const quadPts = [
      { L1: 2 / 3, L2: 1 / 6, L3: 1 / 6, w: 1 / 3 },
      { L1: 1 / 6, L2: 2 / 3, L3: 1 / 6, w: 1 / 3 },
      { L1: 1 / 6, L2: 1 / 6, L3: 2 / 3, w: 1 / 3 },
    ];

    // Compute Jacobian via node coordinates
    // Area = 0.5 * detJ
    const detJ = (nodes[1].x - nodes[0].x) * (nodes[2].y - nodes[0].y) - (nodes[2].x - nodes[0].x) * (nodes[1].y - nodes[0].y);
    if (detJ <= 0) {
      throw new Error(`[NEGATIVE_JACOBIAN] T6 element '${element.elementId}' negative determinant ${detJ}`);
    }

    if (type === 'LUMPED') {
      const totalMass = rho * t * (detJ / 2);
      // HRZ lumping or equal distribution across nodes
      const nodeMass = totalMass / 6;
      for (let i = 0; i < 12; i++) {
        Me.set(i, i, nodeMass);
      }
    } else {
      for (const pt of quadPts) {
        const { L1, L2, L3, w } = pt;
        const N = [
          L1 * (2 * L1 - 1),
          L2 * (2 * L2 - 1),
          L3 * (2 * L3 - 1),
          4 * L1 * L2,
          4 * L2 * L3,
          4 * L3 * L1
        ];

        const factor = w * rho * t * detJ;

        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            const val = N[i] * N[j] * factor;
            Me.set(2 * i, 2 * j, Me.get(2 * i, 2 * j) + val);
            Me.set(2 * i + 1, 2 * j + 1, Me.get(2 * i + 1, 2 * j + 1) + val);
          }
        }
      }
    }

    const globalDOFs: number[] = [];
    for (let i = 0; i < 6; i++) {
      globalDOFs.push(dofManager.getDOF(nodes[i].nodeId, DOFComponent.UX)!.globalId);
      globalDOFs.push(dofManager.getDOF(nodes[i].nodeId, DOFComponent.UY)!.globalId);
    }

    return { Me, globalDOFs };
  }

  private computeTET43DMass(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    rho: number,
    type: MassMatrixType
  ): ElementMassResult {
    const nodes = element.nodeIds.map(id => model.nodes.get(id)!);
    if (nodes.length !== 4) {
      throw new Error(`[INVALID_ELEMENT] TET4 element '${element.elementId}' must have 4 nodes`);
    }

    const [n1, n2, n3, n4] = nodes;
    const x21 = n2.x - n1.x, y21 = n2.y - n1.y, z21 = n2.z - n1.z;
    const x31 = n3.x - n1.x, y31 = n3.y - n1.y, z31 = n3.z - n1.z;
    const x41 = n4.x - n1.x, y41 = n4.y - n1.y, z41 = n4.z - n1.z;

    const detJ = x21 * (y31 * z41 - y41 * z31) - y21 * (x31 * z41 - x41 * z31) + z21 * (x31 * y41 - x41 * y31);
    const volume = detJ / 6;

    if (volume <= 0 || !Number.isFinite(volume)) {
      throw new Error(`[NEGATIVE_JACOBIAN] TET4 element '${element.elementId}' has non-positive volume ${volume}`);
    }

    const totalMass = rho * volume;
    const Me = new Matrix(12, 12);

    if (type === 'LUMPED') {
      const nodeMass = totalMass / 4;
      for (let i = 0; i < 12; i++) {
        Me.set(i, i, nodeMass);
      }
    } else {
      // Consistent mass matrix for TET4 (12x12)
      // M_ij = totalMass / 20 for off-diag node blocks, totalMass / 10 for diag node blocks
      const diag = totalMass / 10;
      const offDiag = totalMass / 20;

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const factor = (i === j) ? diag : offDiag;
          Me.set(3 * i, 3 * j, factor);
          Me.set(3 * i + 1, 3 * j + 1, factor);
          Me.set(3 * i + 2, 3 * j + 2, factor);
        }
      }
    }

    const globalDOFs: number[] = [];
    for (let i = 0; i < 4; i++) {
      globalDOFs.push(dofManager.getDOF(nodes[i].nodeId, DOFComponent.UX)!.globalId);
      globalDOFs.push(dofManager.getDOF(nodes[i].nodeId, DOFComponent.UY)!.globalId);
      globalDOFs.push(dofManager.getDOF(nodes[i].nodeId, DOFComponent.UZ)!.globalId);
    }

    return { Me, globalDOFs };
  }
}
