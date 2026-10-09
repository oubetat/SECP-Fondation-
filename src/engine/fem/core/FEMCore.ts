import { FEMModel, DOFComponent } from "./FEMTypes";
import { FEMElementFormulation } from "./FEMElementFormulation";
import { FEMDOFManager } from "./FEMDOFManager";
import { GlobalAssemblyEngine } from "./GlobalAssemblyEngine";
import { BoundaryConditionEngine } from "./BoundaryConditionEngine";
import { LinearSystemEngine } from "./LinearSystemEngine";
import { FieldRecoveryEngine } from "./FieldRecoveryEngine";
import { FEMVerificationEngine } from "./FEMVerificationEngine";
import { Bar1DFormulation } from "./Bar1DFormulation";
import { CST2DFormulation } from "./CST2DFormulation";

export class FEMCore {
  private dofManager = new FEMDOFManager();
  private assemblyEngine = new GlobalAssemblyEngine();
  private bcEngine = new BoundaryConditionEngine();
  private solver = new LinearSystemEngine();
  private recoveryEngine = new FieldRecoveryEngine();
  private verificationEngine = new FEMVerificationEngine();
  private formulations = new Map<string, FEMElementFormulation>();

  constructor() {
    this.formulations.set("BAR_1D", new Bar1DFormulation());
    this.formulations.set("CST_2D", new CST2DFormulation());
  }

  solve(model: FEMModel) {
    // 1. Determine DOFs
    const requiredDOFs = new Set<DOFComponent>();
    for (const elem of model.elements.values()) {
      const form = this.formulations.get(elem.formulationId);
      if (form) {
        form.getRequiredDOFs().forEach(d => requiredDOFs.add(d));
      }
    }
    this.dofManager.buildDOFs(model, Array.from(requiredDOFs));

    // 2. Global Assembly
    const { K: K_global, F: F_global, trace } = this.assemblyEngine.assemble(model, this.dofManager, this.formulations);

    // 3. Apply Boundary Conditions
    const { modifiedK, modifiedF } = this.bcEngine.applyConstraints(K_global, F_global, model, this.dofManager);

    // 4. Solve
    const U = this.solver.solve(modifiedK, modifiedF);

    // 5. Recover Fields & Reactions
    const displacements = this.recoveryEngine.recoverDisplacements(U, model, this.dofManager);
    const reactions = this.recoveryEngine.computeReactions(K_global, U, F_global, this.dofManager);

    // 6. Verify Equilibrium & Energy
    const eqStatus = this.verificationEngine.verifyEquilibrium(F_global, reactions, this.dofManager);
    if (!eqStatus.ok) throw new Error(eqStatus.error);

    const enStatus = this.verificationEngine.verifyEnergy(K_global, U, F_global, reactions);
    // Depending on tolerance, it might fail. Let's record it.

    return {
      U,
      displacements,
      reactions,
      K_global,
      F_global,
      trace,
      equilibrium: eqStatus,
      energy: enStatus
    };
  }

  getDOFManager() {
    return this.dofManager;
  }
}
