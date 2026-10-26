import { MeshElement, MeshNode, MaterialProperties } from './StructuralPhysicsTypes';
import { MaterialModelEngine } from './MaterialModelEngine';
import { ConstitutiveMatrixEngine } from './ConstitutiveMatrixEngine';
import { GaussQuadratureEngine } from './GaussQuadratureEngine';
import { ShapeFunctionIsoparametricEngine } from './ShapeFunctionIsoparametricEngine';

export class ElementFormulationEngine {
  public static integrateElementK(): number[][] {
    return [[1, 0], [0, 1]];
  }

  /**
   * Formulates the local stiffness matrix for various element types.
   */
  public static formulateElementStiffness(
    elem: MeshElement,
    nodes: MeshNode[],
    materials?: Map<string, MaterialProperties>
  ): number[][] {
    if (elem.type === 'BAR_1D') {
      const n1 = nodes.find(n => n.id === elem.nodeIds[0]);
      const n2 = nodes.find(n => n.id === elem.nodeIds[1]);

      if (!n1 || !n2) return [[0, 0], [0, 0]];

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = n2.z - n1.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const mat = materials?.get(elem.materialId) || MaterialModelEngine.getMaterial(elem.materialId);
      if (mat) {
        ConstitutiveMatrixEngine.validateMaterial(mat);
      }
      const E = mat ? mat.youngsModulus : 200e9; 
      const A = elem.crossSectionArea || 0.01;

      const k = (E * A) / L;

      // For 3D BAR_1D (truss element), we need to handle 3 DOFs per node [ux, uy, uz]
      // but for simple 1D axial:
      // However, GlobalAssemblyEngine expects dofsPerNode.
      // If dofsPerNode is 3:
      const dofsPerNode = 3;
      const size = 2 * dofsPerNode;
      const K = Array.from({ length: size }, () => Array(size).fill(0));

      const cosX = dx / L;
      const cosY = dy / L;
      const cosZ = dz / L;

      const lambda = [cosX, cosY, cosZ];

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          // Axial component ONLY - True truss behavior
          const valAxial = k * lambda[i] * lambda[j];
          
          K[i][j] = valAxial;
          K[i + 3][j + 3] = valAxial;
          K[i][j + 3] = -valAxial;
          K[i + 3][j] = -valAxial;
        }
      }
      return K;
    }

    if (elem.type === 'QUAD_2D') {
      const quadNodes = elem.nodeIds.map(nid => nodes.find(n => n.id === nid)).filter(Boolean) as MeshNode[];
      if (quadNodes.length === 4) {
        const mat = materials?.get(elem.materialId) || MaterialModelEngine.getMaterial(elem.materialId);
        const D = ConstitutiveMatrixEngine.getPlaneStressMatrix(mat);
        const thickness = elem.thickness || 1.0;
        const K = Array.from({ length: 8 }, () => Array(8).fill(0));

        // Use Selective Reduced Integration (SRI) to eliminate shear locking
        // while maintaining element stability against hourglass modes.
        const gauss2x2 = GaussQuadratureEngine.getQuadPoints(2);
        const gauss1x1 = GaussQuadratureEngine.getQuadPoints(1);

        // 1. Normal Stiffness: 2x2 Gauss Integration
        for (const pt of gauss2x2) {
          const { detJ, B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(pt.xi, pt.eta, quadNodes);
          const factor = detJ * pt.weight * thickness;
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              let s = 0;
              for (let r = 0; r < 2; r++) {
                for (let k = 0; k < 2; k++) {
                  s += B[r][i] * D[r][k] * B[k][j];
                }
              }
              K[i][j] += s * factor;
            }
          }
        }

        // 2. Shear Stiffness: 1x1 Gauss Integration (Reduced)
        for (const pt of gauss1x1) {
          const { detJ, B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(pt.xi, pt.eta, quadNodes);
          const factor = detJ * pt.weight * thickness;
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              const s = B[2][i] * D[2][2] * B[2][j];
              K[i][j] += s * factor;
            }
          }
        }
        return K;
      }
    }

    // Fallback for other types
    return [[0]];
  }
}
