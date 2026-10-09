import { Matrix } from "../core/MathUtils";
import { ContactPair } from "./ContactPair";
import { ContactForceAssembler, ContactForceAssemblyResult } from "./ContactForceAssembler";
import { ContactTangentAssembler } from "./ContactTangentAssembler";
import { ContactConvergenceChecker } from "./ContactConvergenceChecker";
import { ContactDiagnostics } from "./ContactDiagnostics";
import { ContactStateManager } from "./ContactStateManager";
import { ContactConvergenceResult, ContactParameters } from "./types";

export class ContactManager {
  readonly pairs: ContactPair[] = [];
  readonly stateManager: ContactStateManager = new ContactStateManager();
  readonly diagnostics: ContactDiagnostics = new ContactDiagnostics();

  addPair(pair: ContactPair): void {
    this.pairs.push(pair);
  }

  getPairs(): ContactPair[] {
    return [...this.pairs];
  }

  clearPairs(): void {
    this.pairs.length = 0;
    this.stateManager.clear();
    this.diagnostics.clear();
  }

  /**
   * Updates nodal positions across all master/slave surfaces during large deformation / nonlinear iterations.
   */
  updateGeometryDisplacements(
    nodeDisplacements: Map<string, number[]>
  ): void {
    for (const pair of this.pairs) {
      pair.slaveSurface.updateDisplacements(nodeDisplacements);
      pair.masterSurface.updateDisplacements(nodeDisplacements);
    }
  }

  /**
   * Assembles the global contact force vector F_contact.
   */
  assembleGlobalForce(
    totalDOFs: number,
    nodeDOFMap: Map<string, number[]>
  ): ContactForceAssemblyResult {
    return ContactForceAssembler.assembleForce(
      this.pairs,
      totalDOFs,
      nodeDOFMap,
      this.stateManager
    );
  }

  /**
   * Assembles the global contact tangent stiffness matrix K_contact.
   */
  assembleGlobalTangent(
    totalDOFs: number,
    nodeDOFMap: Map<string, number[]>
  ): Matrix {
    return ContactTangentAssembler.assembleTangent(
      this.pairs,
      totalDOFs,
      nodeDOFMap
    );
  }

  /**
   * Evaluates contact convergence for current iteration.
   */
  evaluateConvergence(
    parameters?: ContactParameters
  ): ContactConvergenceResult {
    const defaultParams: ContactParameters = parameters || (
      this.pairs.length > 0 ? this.pairs[0].parameters : {
        penaltyStiffness: 1e9,
        searchTolerance: 0.05,
        penetrationTolerance: 1e-4
      }
    );

    const trialStates = this.stateManager.getAllTrialStates();
    return ContactConvergenceChecker.evaluateConvergence(trialStates, defaultParams);
  }

  commitStep(step: number, iteration: number): void {
    this.stateManager.commitStep(step, iteration);
  }

  rollbackStep(): void {
    this.stateManager.rollbackStep();
  }
}
