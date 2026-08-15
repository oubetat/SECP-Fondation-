/**
 * PATCH-SECP-073.3: Element Formulation Engine (End-to-End Integrated)
 * Formulates individual element stiffness matrices and local strain-displacement matrices.
 * Supports 1D Axial Bars, 2D CST, 2D Isoparametric Quads, and 3D Hexahedra.
 */

import { MeshElement, MeshNode } from './StructuralPhysicsTypes';
import { MaterialModelEngine } from './MaterialModelEngine';
import { ConstitutiveMatrixEngine } from './ConstitutiveMatrixEngine';
import { ShapeFunctionEngine } from './ShapeFunctionEngine';
import { ShapeFunctionIsoparametricEngine } from './ShapeFunctionIsoparametricEngine';
import { GaussQuadratureEngine } from './GaussQuadratureEngine';

export class ElementFormulationEngine {
  /**
   * Computes element stiffness matrix [k] = integral( B^T * D * B * dV )
   */
  public static formulateElementStiffness(
    element: MeshElement,
    nodes: MeshNode[],
    isPlaneStrain: boolean = false
  ): number[][] {
    const material = MaterialModelEngine.getMaterial(element.materialId);

    if (element.type === 'BAR_1D') {
      const nodeA = nodes.find(n => n.id === element.nodeIds[0]);
      const nodeB = nodes.find(n => n.id === element.nodeIds[1]);
      if (!nodeA || !nodeB) throw new Error(`Nodes for element ${element.id} not found.`);

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dz = nodeB.z - nodeA.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5;
      const E = material.youngsModulus;
      const A = element.crossSectionArea || 1.0;
      const k = (A * E) / L;

      return [
        [ k, -k],
        [-k,  k]
      ];
    }

    if (element.type === 'TRI_2D') {
      const n1 = nodes.find(n => n.id === element.nodeIds[0]);
      const n2 = nodes.find(n => n.id === element.nodeIds[1]);
      const n3 = nodes.find(n => n.id === element.nodeIds[2]);
      if (!n1 || !n2 || !n3) throw new Error(`Nodes for TRI_2D element ${element.id} not found.`);

      const { area, B } = ShapeFunctionEngine.formulateCSTTriangle(n1, n2, n3);
      const D = isPlaneStrain 
        ? ConstitutiveMatrixEngine.getPlaneStrainMatrix(material)
        : ConstitutiveMatrixEngine.getPlaneStressMatrix(material);
      const thickness = element.thickness || 1.0;
      const volume = area * thickness;

      const kLocal: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          let sum = 0;
          for (let m = 0; m < 3; m++) {
            for (let n = 0; n < 3; n++) {
              sum += B[m][i] * D[m][n] * B[n][j];
            }
          }
          kLocal[i][j] = sum * volume;
        }
      }
      return kLocal;
    }

    if (element.type === 'QUAD_2D') {
      const elNodes = element.nodeIds.map(id => nodes.find(n => n.id === id));
      if (elNodes.some(n => !n)) throw new Error(`Nodes for QUAD_2D element ${element.id} not found.`);
      
      const D = isPlaneStrain 
        ? ConstitutiveMatrixEngine.getPlaneStrainMatrix(material)
        : ConstitutiveMatrixEngine.getPlaneStressMatrix(material);
      
      const thickness = element.thickness || 1.0;
      const kLocal: number[][] = Array.from({ length: 8 }, () => Array(8).fill(0));
      const gaussPts = GaussQuadratureEngine.getQuadPoints(2);

      for (const pt of gaussPts) {
        const { detJ, B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(pt.xi, pt.eta, elNodes as MeshNode[]);
        const dV = detJ * pt.weight * thickness;

        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            let sum = 0;
            for (let m = 0; m < 3; m++) {
              for (let n = 0; n < 3; n++) {
                sum += B[m][i] * D[m][n] * B[n][j];
              }
            }
            kLocal[i][j] += sum * dV;
          }
        }
      }
      return kLocal;
    }

    if (element.type === 'HEX_3D') {
      const elNodes = element.nodeIds.map(id => nodes.find(n => n.id === id));
      if (elNodes.some(n => !n)) throw new Error(`Nodes for HEX_3D element ${element.id} not found.`);
      
      const D = ConstitutiveMatrixEngine.getIsotropic3DMatrix(material);
      const kLocal: number[][] = Array.from({ length: 24 }, () => Array(24).fill(0));
      const gaussPts = GaussQuadratureEngine.getHexPoints(2);

      for (const pt of gaussPts) {
        const { detJ, B } = ShapeFunctionIsoparametricEngine.evaluateHex8(pt.xi, pt.eta, pt.zeta, elNodes as MeshNode[]);
        const dV = detJ * pt.weight;

        for (let i = 0; i < 24; i++) {
          for (let j = 0; j < 24; j++) {
            let sum = 0;
            for (let m = 0; m < 6; m++) {
              for (let n = 0; n < 6; n++) {
                sum += B[m][i] * D[m][n] * B[n][j];
              }
            }
            kLocal[i][j] += sum * dV;
          }
        }
      }
      return kLocal;
    }

    throw new Error(`Element formulation for type ${element.type} is not yet implemented.`);
  }
}
