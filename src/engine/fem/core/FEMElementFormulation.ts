import { Matrix } from "./MathUtils";
import { DOFComponent, ElementMatrixResult, ElementNonlinearResult, ElementStressStrainResult, FEMElement, FEMMaterial, FEMModel, FEMSection, IntegrationPointState } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";
import { MaterialStateManager } from "./MaterialStateManager";
import { ConstitutiveModel } from "./ConstitutiveModel";

export interface ElementNonlinearResult {
  Kt: Matrix; // Tangent stiffness matrix
  Fint: number[]; // Internal force vector
  globalDOFs: number[];
}

export interface FEMElementFormulation {
  getRequiredDOFs(): DOFComponent[];
  computeMatrices(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager
  ): ElementMatrixResult;
  computeStressStrain?(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array
  ): ElementStressStrainResult;
  /**
   * Computes tangent stiffness matrix and internal force vector for nonlinear analysis.
   * @param U Current displacement vector.
   * @param stateManager Manager for integration point states.
   * @param materialModel Optional constitutive model for material nonlinearity.
   */
  computeNonlinearMatrices?(
    element: FEMElement,
    model: FEMModel,
    dofManager: FEMDOFManager,
    U: number[] | Float64Array,
    stateManager?: MaterialStateManager,
    materialModel?: ConstitutiveModel
  ): ElementNonlinearResult;
}
