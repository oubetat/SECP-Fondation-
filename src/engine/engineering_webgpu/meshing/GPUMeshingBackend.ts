/**
 * GPUMeshingBackend.ts
 * WebGPU Compute Engine Backend for High-Throughput Hardware-Accelerated Meshing (PATCH-300)
 */

import {
  CADBRepGeometry,
  CADSurfaceDefinition,
  GPUMeshData,
  ElementQualityMetrics,
  MeshQualityReport,
} from './GPUMeshingTypes';
import { GPUMeshKernelRegistry } from './GPUMeshKernelRegistry';
import { CPUMeshingReference } from './CPUMeshingReference';

export class GPUMeshingBackend {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private isInitialized = false;
  private backendState: 'PROVEN' | 'CPU_FALLBACK' | 'UNINITIALIZED' = 'UNINITIALIZED';

  public async initialize(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      console.warn('WebGPU not supported in environment. Setting GPUMeshingBackend to CPU_FALLBACK.');
      this.backendState = 'CPU_FALLBACK';
      return false;
    }

    try {
      this.adapter = await (navigator as any).gpu.requestAdapter();
      if (!this.adapter) {
        this.backendState = 'CPU_FALLBACK';
        return false;
      }

      this.device = await this.adapter.requestDevice();
      this.isInitialized = true;
      this.backendState = 'PROVEN';
      return true;
    } catch (err) {
      console.warn('Failed to initialize WebGPU device for meshing:', err);
      this.backendState = 'CPU_FALLBACK';
      return false;
    }
  }

  public getStatus(): string {
    return this.backendState;
  }

  public isGPUActive(): boolean {
    return this.isInitialized && this.device !== null;
  }

  /**
   * Surface Discretization & Sampling on GPU
   */
  public async discretizeSurfaceGPU(
    geometry: CADBRepGeometry,
    surface: CADSurfaceDefinition,
    divisionsU = 16,
    divisionsV = 8
  ): Promise<{ mesh: GPUMeshData; durationMs: number; isGPU: boolean }> {
    const t0 = performance.now();

    if (!this.isGPUActive() || !this.device) {
      // Direct CPU Fallback
      const mesh = CPUMeshingReference.discretizeSurface(geometry, surface, divisionsU, divisionsV);
      const durationMs = performance.now() - t0;
      return { mesh, durationMs, isGPU: false };
    }

    const numVertsU = divisionsU + 1;
    const numVertsV = divisionsV + 1;
    const totalVerts = numVertsU * numVertsV;

    // Generate UV grid
    const uvCoords = new Float32Array(totalVerts * 2);
    const du = (surface.uMax - surface.uMin) / divisionsU;
    const dv = (surface.vMax - surface.vMin) / divisionsV;

    let vIdx = 0;
    for (let j = 0; j <= divisionsV; j++) {
      const v = surface.vMin + j * dv;
      for (let i = 0; i <= divisionsU; i++) {
        const u = surface.uMin + i * du;
        uvCoords[vIdx * 2 + 0] = u;
        uvCoords[vIdx * 2 + 1] = v;
        vIdx++;
      }
    }

    // Map surface type to integer
    let surfTypeInt = 0;
    if (surface.type === 'CYLINDER') surfTypeInt = 1;
    else if (surface.type === 'SPHERE') surfTypeInt = 2;
    else if (surface.type === 'CONE') surfTypeInt = 3;
    else if (surface.type === 'HIGH_CURVATURE') surfTypeInt = 4;

    const kernelMeta = GPUMeshKernelRegistry.getKernel('SURFACE_DISCRETIZATION');
    if (!kernelMeta) {
      const mesh = CPUMeshingReference.discretizeSurface(geometry, surface, divisionsU, divisionsV);
      return { mesh, durationMs: performance.now() - t0, isGPU: false };
    }

    try {
      const shaderModule = this.device.createShaderModule({ code: kernelMeta.wgslSource });
      const pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
      });

      // Uniform buffer: SurfaceConfig
      const uniformData = new Float32Array(8);
      const u32View = new Uint32Array(uniformData.buffer);
      u32View[0] = surfTypeInt;
      uniformData[1] = surface.uMin;
      uniformData[2] = surface.uMax;
      uniformData[3] = surface.vMin;
      uniformData[4] = surface.vMax;
      uniformData[5] = surface.parameters?.radius ?? 1.0;
      uniformData[6] = surface.parameters?.height ?? 1.0;
      uniformData[7] = surface.parameters?.amplitude ?? 0.3;

      const uniformBuffer = this.device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      // UV input buffer
      const uvBuffer = this.device.createBuffer({
        size: uvCoords.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(uvBuffer, 0, uvCoords);

      // Output buffers (vec4<f32> per vertex)
      const outPosBuffer = this.device.createBuffer({
        size: totalVerts * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      const outNormBuffer = this.device.createBuffer({
        size: totalVerts * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      const readbackPosBuffer = this.device.createBuffer({
        size: totalVerts * 16,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const readbackNormBuffer = this.device.createBuffer({
        size: totalVerts * 16,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: uvBuffer } },
          { binding: 2, resource: { buffer: outPosBuffer } },
          { binding: 3, resource: { buffer: outNormBuffer } },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      const workgroups = Math.ceil(totalVerts / 64);
      passEncoder.dispatchWorkgroups(workgroups);
      passEncoder.end();

      commandEncoder.copyBufferToBuffer(outPosBuffer, 0, readbackPosBuffer, 0, totalVerts * 16);
      commandEncoder.copyBufferToBuffer(outNormBuffer, 0, readbackNormBuffer, 0, totalVerts * 16);
      this.device.queue.submit([commandEncoder.finish()]);

      await readbackPosBuffer.mapAsync(GPUMapMode.READ);
      await readbackNormBuffer.mapAsync(GPUMapMode.READ);

      const posRaw = new Float32Array(readbackPosBuffer.getMappedRange());
      const normRaw = new Float32Array(readbackNormBuffer.getMappedRange());

      const positions = new Float32Array(totalVerts * 3);
      const normals = new Float32Array(totalVerts * 3);

      for (let i = 0; i < totalVerts; i++) {
        positions[i * 3 + 0] = posRaw[i * 4 + 0];
        positions[i * 3 + 1] = posRaw[i * 4 + 1];
        positions[i * 3 + 2] = posRaw[i * 4 + 2];

        normals[i * 3 + 0] = normRaw[i * 4 + 0];
        normals[i * 3 + 1] = normRaw[i * 4 + 1];
        normals[i * 3 + 2] = normRaw[i * 4 + 2];
      }

      readbackPosBuffer.unmap();
      readbackNormBuffer.unmap();

      // Construct connectivity indices
      const numTris = divisionsU * divisionsV * 2;
      const indices = new Uint32Array(numTris * 3);
      let triIdx = 0;
      for (let j = 0; j < divisionsV; j++) {
        for (let i = 0; i < divisionsU; i++) {
          const row1 = j * numVertsU;
          const row2 = (j + 1) * numVertsU;

          indices[triIdx * 3 + 0] = row1 + i;
          indices[triIdx * 3 + 1] = row1 + i + 1;
          indices[triIdx * 3 + 2] = row2 + i + 1;
          triIdx++;

          indices[triIdx * 3 + 0] = row1 + i;
          indices[triIdx * 3 + 1] = row2 + i + 1;
          indices[triIdx * 3 + 2] = row2 + i;
          triIdx++;
        }
      }

      const durationMs = performance.now() - t0;
      return {
        mesh: {
          meshId: `MESH-GPU-${geometry.geometryId}`,
          geometryId: geometry.geometryId,
          geometryRevision: geometry.revision,
          elementType: 'TRI3',
          numVertices: totalVerts,
          positions,
          normals,
          uvs: uvCoords,
          numElements: numTris,
          indices,
        },
        durationMs,
        isGPU: true,
      };
    } catch (err) {
      console.warn('GPU surface discretization failed, falling back to CPU:', err);
      const mesh = CPUMeshingReference.discretizeSurface(geometry, surface, divisionsU, divisionsV);
      return { mesh, durationMs: performance.now() - t0, isGPU: false };
    }
  }

  /**
   * Element Quality Evaluation on GPU
   */
  public async evaluateQualityGPU(mesh: GPUMeshData): Promise<{ report: MeshQualityReport; durationMs: number; isGPU: boolean }> {
    const t0 = performance.now();

    if (!this.isGPUActive() || !this.device) {
      const report = CPUMeshingReference.evaluateMeshQuality(mesh);
      return { report, durationMs: performance.now() - t0, isGPU: false };
    }

    const kernelMeta = GPUMeshKernelRegistry.getKernel('QUALITY_EVALUATION');
    if (!kernelMeta) {
      const report = CPUMeshingReference.evaluateMeshQuality(mesh);
      return { report, durationMs: performance.now() - t0, isGPU: false };
    }

    try {
      const shaderModule = this.device.createShaderModule({ code: kernelMeta.wgslSource });
      const pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module: shaderModule, entryPoint: 'main' },
      });

      // Prepare vec4 positions
      const posVec4 = new Float32Array(mesh.numVertices * 4);
      for (let i = 0; i < mesh.numVertices; i++) {
        posVec4[i * 4 + 0] = mesh.positions[i * 3 + 0];
        posVec4[i * 4 + 1] = mesh.positions[i * 3 + 1];
        posVec4[i * 4 + 2] = mesh.positions[i * 3 + 2];
        posVec4[i * 4 + 3] = 1.0;
      }

      // Prepare vec4<u32> indices
      const indVec4 = new Uint32Array(mesh.numElements * 4);
      for (let e = 0; e < mesh.numElements; e++) {
        indVec4[e * 4 + 0] = mesh.indices[e * 3 + 0];
        indVec4[e * 4 + 1] = mesh.indices[e * 3 + 1];
        indVec4[e * 4 + 2] = mesh.indices[e * 3 + 2];
        indVec4[e * 4 + 3] = 0;
      }

      const posBuffer = this.device.createBuffer({
        size: posVec4.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(posBuffer, 0, posVec4);

      const indBuffer = this.device.createBuffer({
        size: indVec4.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      this.device.queue.writeBuffer(indBuffer, 0, indVec4);

      // Quality output buffer: 8 floats (32 bytes) per element
      const outBuffer = this.device.createBuffer({
        size: mesh.numElements * 32,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      const readbackBuffer = this.device.createBuffer({
        size: mesh.numElements * 32,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: posBuffer } },
          { binding: 1, resource: { buffer: indBuffer } },
          { binding: 2, resource: { buffer: outBuffer } },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(mesh.numElements / 64));
      pass.end();

      commandEncoder.copyBufferToBuffer(outBuffer, 0, readbackBuffer, 0, mesh.numElements * 32);
      this.device.queue.submit([commandEncoder.finish()]);

      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const rawMetrics = new Float32Array(readbackBuffer.getMappedRange());

      const aspectRatios: number[] = [];
      const skewnesses: number[] = [];
      const minAngles: number[] = [];
      const maxAngles: number[] = [];
      let degenCount = 0;

      for (let e = 0; e < mesh.numElements; e++) {
        const aspect = rawMetrics[e * 8 + 0];
        const skew = rawMetrics[e * 8 + 1];
        const minAng = rawMetrics[e * 8 + 2];
        const maxAng = rawMetrics[e * 8 + 3];
        const isDeg = rawMetrics[e * 8 + 5];

        if (isDeg > 0.5) degenCount++;

        aspectRatios.push(aspect);
        skewnesses.push(skew);
        minAngles.push(minAng);
        maxAngles.push(maxAng);
      }

      readbackBuffer.unmap();

      const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((acc, v) => acc + v, 0) / arr.length : 0);
      const durationMs = performance.now() - t0;

      return {
        report: {
          meshId: mesh.meshId,
          totalElements: mesh.numElements,
          validElements: mesh.numElements - degenCount,
          degenerateElements: degenCount,
          invertedElements: 0,
          aspectRatioStats: {
            min: Math.min(...aspectRatios),
            max: Math.max(...aspectRatios),
            mean: mean(aspectRatios),
            p95: [...aspectRatios].sort((a, b) => a - b)[Math.floor(aspectRatios.length * 0.95)] || 1.0,
          },
          skewnessStats: {
            min: Math.min(...skewnesses),
            max: Math.max(...skewnesses),
            mean: mean(skewnesses),
            p95: [...skewnesses].sort((a, b) => a - b)[Math.floor(skewnesses.length * 0.95)] || 0.0,
          },
          minAngleStats: {
            min: Math.min(...minAngles),
            max: Math.max(...minAngles),
            mean: mean(minAngles),
          },
          maxAngleStats: {
            min: Math.min(...maxAngles),
            max: Math.max(...maxAngles),
            mean: mean(maxAngles),
          },
          histogramBins: [
            {
              metricName: 'AspectRatio',
              binEdges: [1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0],
              counts: [0, 0, 0, 0, 0, 0],
            },
          ],
          worstElementIndex: 0,
          overallStatus: degenCount === 0 ? 'PASSED' : 'FAILED',
        },
        durationMs,
        isGPU: true,
      };
    } catch (err) {
      console.warn('GPU quality evaluation failed, falling back to CPU:', err);
      const report = CPUMeshingReference.evaluateMeshQuality(mesh);
      return { report, durationMs: performance.now() - t0, isGPU: false };
    }
  }
}
