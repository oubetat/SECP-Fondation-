import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, FEMElement, FEMMaterial, FEMModel, FEMSection } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";

export interface FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[];
  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult;
}
