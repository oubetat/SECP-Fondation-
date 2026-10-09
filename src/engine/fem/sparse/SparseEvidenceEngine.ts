import { HardAcceptanceGate236, Gate236Evaluation } from "./HardAcceptanceGate236";

export class SparseEvidenceEngine {
  /**
   * Generates the complete JSON evidence package for PATCH-236
   */
  static generateEvidencePackage(): Gate236Evaluation {
    return HardAcceptanceGate236.runGate();
  }
}
