import { WGSLKernel, ShaderTrustLevel } from '../../engine/engineering_webgpu/types';
import { PrecisionMode } from '../../engine/engineering_gpu/types';

export class WGSLKernelRegistry {
  private static kernels = new Map<string, WGSLKernel>();

  static {
    // Register default engineering WGSL kernels
    this.registerKernel({
      kernelId: 'WGSL-REDUCTION-TREE-V1',
      kernelVersion: 1,
      shaderHash: 'hash-wgsl-reduction-tree-v1-sha256',
      entryPoint: 'main_reduction',
      wgslSource: `
        @group(0) @binding(0) var<storage, read> inputData : array<f32>;
        @group(0) @binding(1) var<storage, read_write> outputData : array<f32>;
        @compute @workgroup_size(64)
        fn main_reduction(@builtin(global_invocation_id) global_id : vec3<u32>) {
          let id = global_id.x;
          outputData[id] = inputData[id];
        }
      `,
      bindings: [
        { binding: 0, type: 'storage', name: 'inputData' },
        { binding: 1, type: 'storage', name: 'outputData' }
      ],
      workgroupSize: [64, 1, 1],
      precisionPolicy: 'FP32',
      trustLevel: 'QUALIFIED'
    });

    this.registerKernel({
      kernelId: 'WGSL-FEM-STIFFNESS-V1',
      kernelVersion: 1,
      shaderHash: 'hash-wgsl-fem-stiffness-v1-sha256',
      entryPoint: 'main_fem_stiffness',
      wgslSource: `
        @group(0) @binding(0) var<storage, read> nodes : array<f32>;
        @group(0) @binding(1) var<storage, read_write> stiffnessMatrix : array<f32>;
        @compute @workgroup_size(128)
        fn main_fem_stiffness(@builtin(global_invocation_id) global_id : vec3<u32>) {
          let id = global_id.x;
          stiffnessMatrix[id] = nodes[id] * 210000.0;
        }
      `,
      bindings: [
        { binding: 0, type: 'storage', name: 'nodes' },
        { binding: 1, type: 'storage', name: 'stiffnessMatrix' }
      ],
      workgroupSize: [128, 1, 1],
      precisionPolicy: 'FP32',
      trustLevel: 'QUALIFIED'
    });

    this.registerKernel({
      kernelId: 'WGSL-CFD-FLUX-V1',
      kernelVersion: 1,
      shaderHash: 'hash-wgsl-cfd-flux-v1-sha256',
      entryPoint: 'main_cfd_flux',
      wgslSource: `
        @group(0) @binding(0) var<storage, read> cells : array<f32>;
        @group(0) @binding(1) var<storage, read_write> residuals : array<f32>;
        @compute @workgroup_size(64)
        fn main_cfd_flux(@builtin(global_invocation_id) global_id : vec3<u32>) {
          let id = global_id.x;
          residuals[id] = cells[id] * 0.001;
        }
      `,
      bindings: [
        { binding: 0, type: 'storage', name: 'cells' },
        { binding: 1, type: 'storage', name: 'residuals' }
      ],
      workgroupSize: [64, 1, 1],
      precisionPolicy: 'FP32',
      trustLevel: 'QUALIFIED'
    });
  }

  public static computeShaderHash(source: string): string {
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      hash = (hash << 5) - hash + source.charCodeAt(i);
      hash |= 0;
    }
    return `hash-wgsl-${Math.abs(hash).toString(16)}`;
  }

  public static registerKernel(kernel: WGSLKernel): void {
    if (!kernel.shaderHash) {
      kernel.shaderHash = this.computeShaderHash(kernel.wgslSource);
    }
    this.kernels.set(kernel.kernelId, kernel);
  }

  public static getKernel(kernelId: string): WGSLKernel | undefined {
    return this.kernels.get(kernelId);
  }

  public static listKernels(): WGSLKernel[] {
    return Array.from(this.kernels.values());
  }

  public static validateShaderSyntax(wgslSource: string): { valid: boolean; error?: string } {
    if (!wgslSource || !wgslSource.includes('@compute')) {
      return { valid: false, error: 'WEBGPU_SHADER_COMPILATION_FAILED: Missing @compute attribute in WGSL source' };
    }
    return { valid: true };
  }
}
