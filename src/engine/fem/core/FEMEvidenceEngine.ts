import { createHash } from "crypto";

export interface FEMEvidencePackage {
  modelHash: string;
  meshHash: string;
  materialHash: string;
  spatialFieldHash: string;
  geometryHash?: string;
  assignmentHash?: string;
  manufacturingProfileHash?: string;
  asBuiltStateHash?: string;
  deviationResultHash?: string;
  truthThreadHash?: string;
  formulationHash: string;
  assemblyHash: string;
  matrixHash: string;
  loadHash: string;
  solverHash: string;
  solutionHash: string;
  fieldHash: string;
  verificationHash: string;
  solverType: string;
  bcMethod: string;
  sparseMetrics: any;
  solverDiagnostics: any;
  timestamp: string;
}

export class FEMEvidenceEngine {
  public static canonicalStringify(data: any): string {
    if (data === null || data === undefined) {
      return JSON.stringify(data);
    }
    if (data instanceof Map) {
      const obj: Record<string, any> = {};
      const sortedKeys = Array.from(data.keys()).sort();
      for (const k of sortedKeys) {
        const val = data.get(k);
        if (val && typeof val.computeHash === "function") {
          obj[String(k)] = { hash: val.computeHash() };
        } else {
          obj[String(k)] = val;
        }
      }
      return this.canonicalStringify(obj);
    }
    if (data instanceof Set) {
      const arr = Array.from(data).sort();
      return this.canonicalStringify(arr);
    }
    if (Array.isArray(data)) {
      return "[" + data.map(item => this.canonicalStringify(item)).join(",") + "]";
    }
    if (typeof data === "object") {
      if (typeof data.computeHash === "function") {
        return JSON.stringify({ hash: data.computeHash() });
      }
      const sortedKeys = Object.keys(data).sort();
      const parts = sortedKeys.map(k => `${JSON.stringify(k)}:${this.canonicalStringify(data[k])}`);
      return "{" + parts.join(",") + "}";
    }
    return JSON.stringify(data);
  }

  public static hashData(data: any): string {
    return createHash("sha256").update(this.canonicalStringify(data)).digest("hex");
  }

  public static generateEvidence(model: any, solveResult: any): FEMEvidencePackage {
    const meshHash = this.hashData(model.nodes);
    const materialHash = this.hashData(model.materials);
    const spatialFieldHash = model.spatialMaterialFields ? this.hashData(model.spatialMaterialFields) : "NONE";
    const geometryHash = model.geometryMetadata ? this.hashData(model.geometryMetadata) : "NONE";
    const assignmentHash = model.materialAssignments ? this.hashData(model.materialAssignments) : "NONE";
    const manufacturingProfileHash = model.manufacturingProfile ? this.hashData(model.manufacturingProfile) : "NONE";
    const asBuiltStateHash = model.asBuiltState ? this.hashData(model.asBuiltState) : "NONE";
    const deviationResultHash = model.deviationResult ? this.hashData(model.deviationResult) : "NONE";
    const truthThreadHash = model.truthThread ? model.truthThread.threadHash : "NONE";
    const formulationHash = this.hashData(model.elements);
    const loadHash = this.hashData(model.loads);
    const bcHash = this.hashData(model.boundaryConditions);

    const modelHash = this.hashData({
      meshHash,
      materialHash,
      spatialFieldHash,
      geometryHash,
      assignmentHash,
      manufacturingProfileHash,
      asBuiltStateHash,
      deviationResultHash,
      truthThreadHash,
      formulationHash,
      loadHash,
      bcHash
    });

    const matrixHash = solveResult.K_global ? this.hashData(solveResult.K_global.data) : "NONE";
    const traceHash = this.hashData(solveResult.trace);
    const solutionHash = this.hashData(solveResult.U);
    const fieldHash = this.hashData(Array.from(solveResult.displacements.entries()));
    const verificationHash = this.hashData([solveResult.equilibrium, solveResult.energy]);

    return {
      modelHash,
      meshHash,
      materialHash,
      spatialFieldHash,
      geometryHash,
      assignmentHash,
      manufacturingProfileHash,
      asBuiltStateHash,
      deviationResultHash,
      truthThreadHash,
      formulationHash,
      assemblyHash: traceHash,
      matrixHash,
      loadHash,
      solverHash: solutionHash,
      solutionHash,
      fieldHash,
      verificationHash,
      solverType: solveResult.solverTypeUsed,
      bcMethod: solveResult.bcMethodUsed,
      sparseMetrics: solveResult.sparseMetrics,
      solverDiagnostics: solveResult.solverDiagnostics,
      timestamp: new Date().toISOString()
    };
  }

  public static isEvidenceStale(
    evidence: FEMEvidencePackage,
    currentModel: any,
    currentSolveResult?: any
  ): { isStale: boolean; reason?: string } {
    const currentMeshHash = this.hashData(currentModel.nodes);
    if (currentMeshHash !== evidence.meshHash) {
      return { isStale: true, reason: "Mesh geometry or nodes modified" };
    }

    const currentMaterialHash = this.hashData(currentModel.materials);
    if (currentMaterialHash !== evidence.materialHash) {
      return { isStale: true, reason: "Base material definitions modified" };
    }

    const currentSpatialFieldHash = currentModel.spatialMaterialFields ? this.hashData(currentModel.spatialMaterialFields) : "NONE";
    if (currentSpatialFieldHash !== evidence.spatialFieldHash) {
      return { isStale: true, reason: "Spatial material fields or revisions modified" };
    }

    const currentGeometryHash = currentModel.geometryMetadata ? this.hashData(currentModel.geometryMetadata) : "NONE";
    if (evidence.geometryHash && currentGeometryHash !== evidence.geometryHash) {
      return { isStale: true, reason: "Geometry metadata or coordinate frame modified" };
    }

    const currentAssignmentHash = currentModel.materialAssignments ? this.hashData(currentModel.materialAssignments) : "NONE";
    if (evidence.assignmentHash && currentAssignmentHash !== evidence.assignmentHash) {
      return { isStale: true, reason: "Material assignments modified" };
    }

    const currentManufacturingProfileHash = currentModel.manufacturingProfile ? this.hashData(currentModel.manufacturingProfile) : "NONE";
    if (evidence.manufacturingProfileHash && currentManufacturingProfileHash !== evidence.manufacturingProfileHash) {
      return { isStale: true, reason: "Manufacturing constraint profile modified" };
    }

    const currentAsBuiltStateHash = currentModel.asBuiltState ? this.hashData(currentModel.asBuiltState) : "NONE";
    if (evidence.asBuiltStateHash && currentAsBuiltStateHash !== evidence.asBuiltStateHash) {
      return { isStale: true, reason: "As-Built actual material state or dataset modified" };
    }

    const currentDeviationResultHash = currentModel.deviationResult ? this.hashData(currentModel.deviationResult) : "NONE";
    if (evidence.deviationResultHash && currentDeviationResultHash !== evidence.deviationResultHash) {
      return { isStale: true, reason: "Spatial material deviation result or acceptance criteria modified" };
    }

    const currentTruthThreadHash = currentModel.truthThread ? currentModel.truthThread.threadHash : "NONE";
    if (evidence.truthThreadHash && currentTruthThreadHash !== evidence.truthThreadHash) {
      return { isStale: true, reason: "Material truth thread DAG or node validity modified" };
    }

    const currentFormulationHash = this.hashData(currentModel.elements);
    if (currentFormulationHash !== evidence.formulationHash) {
      return { isStale: true, reason: "Element connectivity or formulation bindings modified" };
    }

    if (currentSolveResult) {
      const currentSolutionHash = this.hashData(currentSolveResult.U);
      if (currentSolutionHash !== evidence.solutionHash) {
        return { isStale: true, reason: "Solution vector mismatch" };
      }
    }

    return { isStale: false };
  }
}
