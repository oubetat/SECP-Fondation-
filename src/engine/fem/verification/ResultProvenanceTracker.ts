import { ResultProvenance, AnalysisType } from "./types";

export class ResultProvenanceTracker {
  /**
   * Generates a deterministic hash string for arbitrary serializable payload.
   */
  public static hashData(data: any): string {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    let hashVal = 0;
    for (let i = 0; i < raw.length; i++) {
      hashVal = ((hashVal << 5) - hashVal) + raw.charCodeAt(i);
      hashVal |= 0;
    }
    return Math.abs(hashVal).toString(16).padStart(8, '0');
  }

  /**
   * Constructs complete ResultProvenance metadata object.
   */
  public static createProvenance(
    analysisId: string,
    meshData: any,
    materialData: any,
    loadData: any,
    bcData: any,
    solverSettings: any,
    resultData: any,
    analysisType: AnalysisType = AnalysisType.LINEAR_STATIC,
    documentRevision: number = 1
  ): ResultProvenance {
    const meshHash = `MESH_${this.hashData(meshData)}`;
    const materialHash = `MAT_${this.hashData(materialData)}`;
    const loadHash = `LOAD_${this.hashData(loadData)}`;
    const boundaryConditionHash = `BC_${this.hashData(bcData)}`;
    const solverHash = `SOLVER_${this.hashData(solverSettings)}`;
    const resultHash = `RES_${this.hashData(resultData)}`;
    const modelHash = `MODEL_${this.hashData(`${meshHash}|${materialHash}|${loadHash}|${boundaryConditionHash}`)}`;

    const manifestHash = `MANIFEST_${this.hashData(`REV_${documentRevision}|${meshHash}|${materialHash}|${loadHash}|${boundaryConditionHash}|${solverHash}|${resultHash}`)}`;
    const verificationId = `VERIF_${this.hashData(`${manifestHash}|${modelHash}|${resultHash}`)}`;

    return {
      verificationId,
      analysisId,
      documentRevision,
      manifestHash,
      modelHash,
      meshHash,
      materialHash,
      loadHash,
      boundaryConditionHash,
      solverHash,
      resultHash,
      analysisType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verifies provenance integrity against live model and result data.
   */
  public static verifyProvenance(
    provenance: ResultProvenance,
    meshData: any,
    materialData: any,
    loadData: any,
    bcData: any,
    solverSettings: any,
    resultData: any,
    documentRevision: number = 1
  ): { valid: boolean; reason?: string } {
    if (!provenance) {
      return { valid: false, reason: "PROVENANCE_FAILURE: Provenance record is null or undefined" };
    }

    if (provenance.documentRevision !== undefined && provenance.documentRevision !== documentRevision) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Document revision mismatch (stale verification for rev ${provenance.documentRevision} vs current rev ${documentRevision})` };
    }

    const expectedMeshHash = `MESH_${this.hashData(meshData)}`;
    if (provenance.meshHash !== expectedMeshHash) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Mesh hash mismatch (${provenance.meshHash} vs ${expectedMeshHash})` };
    }

    const expectedMatHash = `MAT_${this.hashData(materialData)}`;
    if (provenance.materialHash !== expectedMatHash) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Material hash mismatch (${provenance.materialHash} vs ${expectedMatHash})` };
    }

    const expectedLoadHash = `LOAD_${this.hashData(loadData)}`;
    if (provenance.loadHash !== expectedLoadHash) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Load hash mismatch (${provenance.loadHash} vs ${expectedLoadHash})` };
    }

    const expectedBCHash = `BC_${this.hashData(bcData)}`;
    if (provenance.boundaryConditionHash !== expectedBCHash) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Boundary condition hash mismatch (${provenance.boundaryConditionHash} vs ${expectedBCHash})` };
    }

    const expectedResHash = `RES_${this.hashData(resultData)}`;
    if (provenance.resultHash !== expectedResHash) {
      return { valid: false, reason: `PROVENANCE_FAILURE: Result hash mismatch (${provenance.resultHash} vs ${expectedResHash})` };
    }

    return { valid: true };
  }
}
