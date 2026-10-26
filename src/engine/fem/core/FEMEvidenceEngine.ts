import { createHash } from "crypto";

export class FEMEvidenceEngine {
  static hashData(data: any): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  static generateEvidence(model: any, solveResult: any) {
    const modelHash = this.hashData(model);
    const matrixHash = this.hashData(solveResult.K_global.data);
    const loadHash = this.hashData(solveResult.F_global);
    const solutionHash = this.hashData(solveResult.U);
    const traceHash = this.hashData(solveResult.trace);

    return {
      modelHash,
      meshHash: this.hashData(model.nodes),
      materialHash: this.hashData(model.materials),
      formulationHash: this.hashData(model.elements),
      assemblyHash: traceHash,
      matrixHash,
      loadHash,
      solverHash: solutionHash,
      solutionHash,
      fieldHash: this.hashData(Array.from(solveResult.displacements.entries())),
      verificationHash: this.hashData([solveResult.equilibrium, solveResult.energy]),
      solverType: solveResult.solverTypeUsed,
      bcMethod: solveResult.bcMethodUsed,
      sparseMetrics: solveResult.sparseMetrics,
      solverDiagnostics: solveResult.solverDiagnostics,
      timestamp: new Date().toISOString()
    };
  }
}
