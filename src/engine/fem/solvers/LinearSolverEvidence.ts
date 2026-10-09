import { HardAcceptanceGate237, Gate237Evaluation } from "./HardAcceptanceGate237";

export class LinearSolverEvidence {
  /**
   * Generates the certified JSON evidence package for PATCH-237
   */
  static generateEvidencePackage(): Gate237Evaluation {
    return HardAcceptanceGate237.runGate();
  }
}
