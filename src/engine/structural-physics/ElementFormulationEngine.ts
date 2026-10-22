import { MeshElement, MeshNode } from './StructuralPhysicsTypes';

export class ElementFormulationEngine {
  public static integrateElementK(): number[][] {
    return [[1, 0], [0, 1]];
  }

  /**
   * Formulates the local stiffness matrix for various element types.
   */
  public static formulateElementStiffness(elem: MeshElement, nodes: MeshNode[], materials: Map<string, MaterialProperties>): number[][] {
    if (elem.type === 'BAR_1D') {
      const n1 = nodes.find(n => n.id === elem.nodeIds[0]);
      const n2 = nodes.find(n => n.id === elem.nodeIds[1]);

      if (!n1 || !n2) return [[0, 0], [0, 0]];

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = n2.z - n1.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const mat = materials.get(elem.materialId);
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
      const kTrans = k * 0.01; // 1% transverse stiffness to stabilize mechanisms

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          // Axial component
          const valAxial = k * lambda[i] * lambda[j];
          
          // Transverse component (simplified: isotropic in plane perpendicular to axis)
          // Kronecker delta - lambda_i * lambda_j gives the transverse projection
          const delta = (i === j) ? 1 : 0;
          const valTrans = kTrans * (delta - lambda[i] * lambda[j]);
          
          const totalVal = valAxial + valTrans;

          K[i][j] = totalVal;
          K[i + 3][j + 3] = totalVal;
          K[i][j + 3] = -totalVal;
          K[i + 3][j] = -totalVal;
        }
      }
      return K;
    }

    // Fallback for other types
    return [[0]];
  }
}
