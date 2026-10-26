import { FEAMesh, MeshElement, MeshNode } from './StructuralPhysicsTypes';
import { ShapeFunctionIsoparametricEngine } from './ShapeFunctionIsoparametricEngine';

export interface StrainTensor2D {
  xx: number;
  yy: number;
  xy: number;
}

export class StrainAnalysisEngine {
  /**
   * Calculates 1D element strain: epsilon_xx = (u_B - u_A) / L
   */
  public static calculate1DStrain(
    nodeIdx: number,
    globalDisplacements: number[],
    mesh: FEAMesh
  ): number {
    if (mesh.elements.length === 0) return 0;
    
    // Find connected element
    const elem = mesh.elements.find(e => e.nodeIds.includes(nodeIdx + 1));
    if (!elem) return 0;
    const idxA = elem.nodeIds[0] - 1;
    const idxB = elem.nodeIds[1] - 1;

    const dofsPerNode = 3;
    const uAx = globalDisplacements[idxA * dofsPerNode + 0] || 0;
    const uAy = globalDisplacements[idxA * dofsPerNode + 1] || 0;
    const uAz = globalDisplacements[idxA * dofsPerNode + 2] || 0;

    const uBx = globalDisplacements[idxB * dofsPerNode + 0] || 0;
    const uBy = globalDisplacements[idxB * dofsPerNode + 1] || 0;
    const uBz = globalDisplacements[idxB * dofsPerNode + 2] || 0;

    const nodeA = mesh.nodes[idxA];
    const nodeB = mesh.nodes[idxB];

    if (!nodeA || !nodeB) return 0;

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const dz = nodeB.z - nodeA.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;

    const cosX = dx / L;
    const cosY = dy / L;
    const cosZ = dz / L;

    const uA_axial = uAx * cosX + uAy * cosY + uAz * cosZ;
    const uB_axial = uBx * cosX + uBy * cosY + uBz * cosZ;

    return (uB_axial - uA_axial) / L;
  }

  /**
   * Calculates 2D strain tensor for a QUAD_2D isoparametric element at natural coordinates (xi, eta).
   * Default evaluates at the element centroid (xi=0, eta=0).
   * Returns { xx, yy, xy } where xy is engineering shear strain gamma_xy.
   */
  public static calculate2DQuadStrain(
    elem: MeshElement,
    globalDisplacements: number[],
    mesh: FEAMesh,
    xi: number = 0,
    eta: number = 0,
    dofsPerNode: number = 2
  ): StrainTensor2D {
    const quadNodes = elem.nodeIds.map(nid => mesh.nodes.find(n => n.id === nid)).filter(Boolean) as MeshNode[];
    if (quadNodes.length !== 4) {
      return { xx: 0, yy: 0, xy: 0 };
    }

    const { B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(xi, eta, quadNodes);
    const u_elem = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      const nid = elem.nodeIds[i];
      const nodeIndex = mesh.nodes.findIndex(n => n.id === nid);
      if (nodeIndex >= 0) {
        u_elem[2 * i + 0] = globalDisplacements[nodeIndex * dofsPerNode + 0] || 0;
        u_elem[2 * i + 1] = globalDisplacements[nodeIndex * dofsPerNode + 1] || 0;
      }
    }

    let eps_xx = 0;
    let eps_yy = 0;
    let gam_xy = 0;

    for (let j = 0; j < 8; j++) {
      eps_xx += B[0][j] * u_elem[j];
      eps_yy += B[1][j] * u_elem[j];
      gam_xy += B[2][j] * u_elem[j];
    }

    return {
      xx: eps_xx,
      yy: eps_yy,
      xy: gam_xy
    };
  }
}
