import { NativeBuildFingerprint } from '../../engine/engineering_hpc/types';

export interface NativeKernel {
  kernelId: string;
  version: number;
  binaryHash: string;
  buildFingerprint: NativeBuildFingerprint;
  qualificationStatus: 'QUALIFIED' | 'PENDING' | 'REJECTED';
}

export class NativeKernelRegistry {
  private static kernels = new Map<string, NativeKernel>();

  static {
    this.register({
      kernelId: 'HPC-SOLVER-CFD-V1',
      version: 1,
      binaryHash: 'hash-bin-cfd-v1-sha256',
      qualificationStatus: 'QUALIFIED',
      buildFingerprint: {
        sourceRevision: 'rev-a1b2c3d',
        compiler: 'gcc',
        compilerVersion: '13.2.0',
        buildFlags: ['-O3', '-march=skylake-avx512', '-fopenmp'],
        targetArchitecture: 'x86_64',
        binaryHash: 'hash-bin-cfd-v1-sha256'
      }
    });

    this.register({
      kernelId: 'HPC-SOLVER-FEM-V1',
      version: 1,
      binaryHash: 'hash-bin-fem-v1-sha256',
      qualificationStatus: 'QUALIFIED',
      buildFingerprint: {
        sourceRevision: 'rev-e5f6g7h',
        compiler: 'clang',
        compilerVersion: '17.0.6',
        buildFlags: ['-O3', '-mavx512f', '-mprefer-vector-width=512'],
        targetArchitecture: 'x86_64',
        binaryHash: 'hash-bin-fem-v1-sha256'
      }
    });
  }

  public static register(kernel: NativeKernel): void {
    this.kernels.set(kernel.kernelId, kernel);
  }

  public static get(kernelId: string): NativeKernel | undefined {
    return this.kernels.get(kernelId);
  }

  public static list(): NativeKernel[] {
    return Array.from(this.kernels.values());
  }
}
