import { BackendType, PrecisionMode, GPUExecutionEvidence } from '../../engine/engineering_gpu/types';

export interface ComputeExecutionParams {
  kernelId: string;
  inputs: Record<string, any>;
  precision: PrecisionMode;
  allowCpuFallback?: boolean;
}

export interface ComputeExecutionResult {
  success: boolean;
  outputs?: Record<string, any>;
  evidence?: GPUExecutionEvidence;
  error?: string;
}

export abstract class ComputeBackend {
  public abstract backendType: BackendType;
  public abstract execute(params: ComputeExecutionParams): Promise<ComputeExecutionResult>;
}
