export type ProductionOperationType = 'BREP_HEALING_SEWING' | 'CLASS_A_SURFACING_ZEBRA' | 'LINEAR_STRUCTURAL_FEA' | 'CFD_3D_FVM_FLOW' | 'CAM_5AXIS_SIMULTANEOUS' | 'ASSEMBLY_KINEMATICS_SOLVE';
export interface ProductionEngineeringCommand {
  commandId: string; operationType: ProductionOperationType; engineId: string;
  entityRef: { entityId: string; entityName: string; revisionId: string };
  config: any; submittedBy: string; submittedAt: string;
}
export interface ProductionExecutionResult {
  status: 'COMPLETED' | 'REJECTED' | 'VERIFICATION_FAILED' | 'TIMEOUT' | 'FAILED';
  verificationResult?: { passed: boolean }; visualizationData?: any;
  numericalResult?: any; durationMs: number; errorMessage?: string;
  provenanceDigest?: string;
}
