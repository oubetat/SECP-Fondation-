import { GPUKernelInfo, BackendType, PrecisionMode } from '../../engine/engineering_gpu/types';

export class KernelRegistry {
  private static kernels = new Map<string, GPUKernelInfo>();

  static {
    this.registerKernel({
      kernelId: 'K-FEM-STIFFNESS-V1',
      kernelName: 'FEM_Element_Stiffness_Assembly',
      version: 1,
      backend: 'CUDA',
      precision: 'FP64',
      category: 'FEM'
    });

    this.registerKernel({
      kernelId: 'K-CFD-FLUX-V1',
      kernelName: 'CFD_FiniteVolume_Flux_Solver',
      version: 1,
      backend: 'CUDA',
      precision: 'FP64',
      category: 'CFD'
    });

    this.registerKernel({
      kernelId: 'K-DETERMINISTIC-REDUCTION-V1',
      kernelName: 'Tree_Reduction_Deterministic_Sum',
      version: 1,
      backend: 'CUDA',
      precision: 'FP64',
      category: 'REDUCTION'
    });

    this.registerKernel({
      kernelId: 'K-SPARSE-CG-V1',
      kernelName: 'Conjugate_Gradient_Sparse_Solver',
      version: 1,
      backend: 'CUDA',
      precision: 'FP64',
      category: 'SPARSE'
    });
  }

  public static registerKernel(kernel: GPUKernelInfo): void {
    this.kernels.set(kernel.kernelId, kernel);
  }

  public static getKernel(kernelId: string): GPUKernelInfo | undefined {
    return this.kernels.get(kernelId);
  }

  public static listKernels(): GPUKernelInfo[] {
    return Array.from(this.kernels.values());
  }

  // CPU reference implementation for deterministic tree reduction
  public static executeCpuReferenceReduction(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    while (sorted.length > 1) {
      const next: number[] = [];
      for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 < sorted.length) {
          next.push(sorted[i] + sorted[i + 1]);
        } else {
          next.push(sorted[i]);
        }
      }
      sorted.splice(0, sorted.length, ...next);
    }
    return sorted[0];
  }

  // Simulated GPU kernel execution with deterministic reduction
  public static executeGpuReduction(values: number[], backend: BackendType, precision: PrecisionMode): number {
    return this.executeCpuReferenceReduction(values);
  }
}
