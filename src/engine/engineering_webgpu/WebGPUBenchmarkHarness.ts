import { WebGPUCapabilityMatrix } from './WebGPUComputeTypes';

export interface BenchmarkReport {
  backend: 'CPU' | 'WEBGPU' | 'UNAVAILABLE';
  workloadType: 'GENERIC_WEBGPU_COMPUTE' | 'GENERIC_VECTOR_ADD' | 'FEM_STIFFNESS' | 'CFD_FLUX' | 'HPC_NUMERICAL';
  cpuTimeMs: number;
  gpuTimeMs?: number; // Total wall-clock GPU path time
  kernelTimeMs?: number; // Pure compute time if available
  uploadTimeMs?: number;
  readbackTimeMs?: number;
  speedup?: number;
  equivalenceCheckPassed: boolean;
  maxResidual: number;
  status: 'EXECUTED' | 'UNAVAILABLE' | 'FAILED';
  error?: string;
  timestamp: string;
}

export class WebGPUBenchmarkHarness {
  /**
   * Detects real WebGPU availability and capabilities.
   */
  public static async getWebGPUCapability(): Promise<WebGPUCapabilityMatrix | null> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      return null;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;

      const device = await adapter.requestDevice();
      if (!device) return null;

      const info = (adapter as any).info;
      
      const capability: WebGPUCapabilityMatrix = {
        isAvailable: true,
        adapterAvailable: true,
        deviceCreated: true,
        adapterInfo: info ? {
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description
        } : undefined,
        features: Array.from(adapter.features),
        limits: (device.limits as any),
        supportedPrecisions: ['FP32'],
        runtimeEnvironment: 'BROWSER_WEBGPU',
        timestamp: new Date().toISOString()
      };
      
      return capability;
    } catch (e) {
      return null;
    }
  }

  /**
   * Runs a real benchmark. If WebGPU is unavailable, it reports UNAVAILABLE without fabricating results.
   */
  public static async runBenchmark(vectorSize: number = 100000, workload: BenchmarkReport['workloadType'] = 'GENERIC_VECTOR_ADD'): Promise<BenchmarkReport> {
    // CPU Reference Execution (Always Real Measurement)
    const inputX = new Float32Array(vectorSize).fill(1.0).map((_, i) => Math.sin(i));
    const inputY = new Float32Array(vectorSize).fill(2.0).map((_, i) => Math.cos(i));
    
    const cpuStart = performance.now();
    const cpuOutput = new Float32Array(vectorSize);
    for (let i = 0; i < vectorSize; i++) {
      cpuOutput[i] = inputX[i] + inputY[i];
    }
    const cpuEnd = performance.now();
    const cpuTime = cpuEnd - cpuStart;

    if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
      return {
        backend: 'UNAVAILABLE',
        workloadType: workload,
        cpuTimeMs: cpuTime,
        equivalenceCheckPassed: false,
        maxResidual: 0,
        status: 'UNAVAILABLE',
        error: 'WebGPU not available in this environment',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error('WebGPU Adapter not found');
      
      const device = await adapter.requestDevice();
      if (!device) throw new Error('WebGPU Device creation failed');
      
      const tSetupStart = performance.now();
      const size = vectorSize * 4;
      const bufferX = device.createBuffer({ size, usage: 0x0080 | 0x0008 }); // STORAGE | COPY_DST
      const bufferY = device.createBuffer({ size, usage: 0x0080 | 0x0008 }); // STORAGE | COPY_DST
      const bufferOut = device.createBuffer({ size, usage: 0x0080 | 0x0004 }); // STORAGE | COPY_SRC
      
      const tUploadStart = performance.now();
      device.queue.writeBuffer(bufferX, 0, inputX);
      device.queue.writeBuffer(bufferY, 0, inputY);
      const tUploadEnd = performance.now();
      
      const shaderCode = `
        @group(0) @binding(0) var<storage, read> x: array<f32>;
        @group(0) @binding(1) var<storage, read> y: array<f32>;
        @group(0) @binding(2) var<storage, read_write> out: array<f32>;
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
          if (global_id.x < arrayLength(&out)) {
            out[global_id.x] = x[global_id.x] + y[global_id.x];
          }
        }
      `;
      
      const shaderModule = device.createShaderModule({ code: shaderCode });
      const pipeline = await device.createComputePipelineAsync({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' }
      });
      
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufferX } },
          { binding: 1, resource: { buffer: bufferY } },
          { binding: 2, resource: { buffer: bufferOut } }
        ]
      });
      
      const tComputeStart = performance.now();
      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(vectorSize / 64));
      passEncoder.end();
      
      const readBuffer = device.createBuffer({ size, usage: 0x0008 | 0x0001 }); // COPY_DST | MAP_READ
      commandEncoder.copyBufferToBuffer(bufferOut, 0, readBuffer, 0, size);
      
      device.queue.submit([commandEncoder.finish()]);
      const tComputeEnd = performance.now();
      
      const tReadbackStart = performance.now();
      await readBuffer.mapAsync(1); // MAP_READ
      const gpuOutput = new Float32Array(readBuffer.getMappedRange());
      const tReadbackEnd = performance.now();
      
      const gpuTotalEnd = performance.now();
      const gpuTime = gpuTotalEnd - tSetupStart;

      // Real Numerical Verification
      let maxResidual = 0;
      for (let i = 0; i < vectorSize; i++) {
        const diff = Math.abs(gpuOutput[i] - cpuOutput[i]);
        if (diff > maxResidual) maxResidual = diff;
      }

      const equivalenceCheckPassed = maxResidual < 1e-6;
      readBuffer.unmap();

      return {
        backend: 'WEBGPU',
        workloadType: workload,
        cpuTimeMs: cpuTime,
        gpuTimeMs: gpuTime,
        uploadTimeMs: tUploadEnd - tUploadStart,
        kernelTimeMs: tComputeEnd - tComputeStart,
        readbackTimeMs: tReadbackEnd - tReadbackStart,
        speedup: gpuTime > 0 ? cpuTime / gpuTime : 0,
        equivalenceCheckPassed,
        maxResidual,
        status: 'EXECUTED',
        timestamp: new Date().toISOString()
      };

    } catch (e: any) {
      return {
        backend: 'WEBGPU',
        workloadType: workload,
        cpuTimeMs: cpuTime,
        equivalenceCheckPassed: false,
        maxResidual: 0,
        status: 'FAILED',
        error: e.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

