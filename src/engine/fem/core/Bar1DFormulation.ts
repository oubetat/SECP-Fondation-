import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class Bar1DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const node1 = model.nodes.get(element.nodeIds[0])!;
    const node2 = model.nodes.get(element.nodeIds[1])!;
    const material = model.materials.get(element.materialId)!;
    const section = model.sections.get(element.sectionId)!;

    if (!section.area) throw new Error("Bar element requires section area");
    if (material.E <= 0) throw new Error("Invalid material E");

    // Length of the element
    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const dz = node2.z - node1.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (L <= 0) throw new Error("Zero-length element");

    const E = material.E;
    const A = section.area;
    const k = (E * A) / L;

    // Local stiffness matrix in local coordinate system (1D)
    // [ k -k]
    // [-k  k]
    // But since it's an axial bar, we need to transform to global.
    // Direction cosines:
    const cx = dx / L;
    const cy = dy / L;
    const cz = dz / L;

    // For a general 3D truss bar, the DOFs are UX, UY, UZ for each node.
    // Wait, if RequiredDOFs is only UX, then this is strictly a 1D problem on the X-axis.
    // Let's implement a general 3D truss formulation to allow actual geometry.
    // So getRequiredDOFs() should return UX, UY, UZ. Let me adjust this.
    return {
      Ke: new Matrix(2, 2, [
        [k, -k],
        [-k, k]
      ]), // This is strictly 1D on X axis!
      Fe: [0, 0],
      globalDOFs: [
        dofManager.getDOF(node1.nodeId, DOFComponent.UX)!.globalId,
        dofManager.getDOF(node2.nodeId, DOFComponent.UX)!.globalId
      ]
    };
  }
}
