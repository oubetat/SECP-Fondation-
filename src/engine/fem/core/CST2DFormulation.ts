import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, FEMElement, FEMModel } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";

export class CST2DFormulation implements FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[] {
    return [DOFComponent.UX, DOFComponent.UY];
  }

  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult {
    const n1 = model.nodes.get(element.nodeIds[0])!;
    const n2 = model.nodes.get(element.nodeIds[1])!;
    const n3 = model.nodes.get(element.nodeIds[2])!;
    const mat = model.materials.get(element.materialId)!;
    const sec = model.sections.get(element.sectionId)!;

    if (!sec.thickness) throw new Error("CST element requires section thickness");
    if (mat.E <= 0) throw new Error("Invalid material E");
    if (mat.nu < -1 || mat.nu >= 0.5) throw new Error("Invalid material nu");

    const x1 = n1.x, y1 = n1.y;
    const x2 = n2.x, y2 = n2.y;
    const x3 = n3.x, y3 = n3.y;

    const detJ = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const Area = detJ / 2;

    if (Area <= 0) throw new Error("Element orientation invalid or zero volume (Negative Jacobian)");

    const b1 = y2 - y3;
    const b2 = y3 - y1;
    const b3 = y1 - y2;
    const c1 = x3 - x2;
    const c2 = x1 - x3;
    const c3 = x2 - x1;

    // B matrix (3x6)
    const B = new Matrix(3, 6, [
      [b1, 0, b2, 0, b3, 0],
      [0, c1, 0, c2, 0, c3],
      [c1, b1, c2, b2, c3, b3]
    ]).scale(1 / detJ);

    // D matrix for Plane Stress
    const E = mat.E;
    const nu = mat.nu;
    const factor = E / (1 - nu * nu);
    const D = new Matrix(3, 3, [
      [1, nu, 0],
      [nu, 1, 0],
      [0, 0, (1 - nu) / 2]
    ]).scale(factor);

    // Ke = B^T * D * B * Area * thickness
    const Bt = B.transpose();
    const BtD = Bt.multiply(D);
    let Ke = BtD.multiply(B);
    Ke = Ke.scale(Area * sec.thickness);

    const globalDOFs = [
      dofManager.getDOF(n1.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n1.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n2.nodeId, DOFComponent.UY)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UX)!.globalId,
      dofManager.getDOF(n3.nodeId, DOFComponent.UY)!.globalId,
    ];

    return { Ke, Fe: new Array(6).fill(0), globalDOFs };
  }
}
