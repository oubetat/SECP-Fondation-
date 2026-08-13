/// <reference types="@webgpu/types" />

/**
 * WebGPU Pipeline Manager
 * Compiles WGSL shaders and manages GPURenderPipelines.
 */

export class PipelineManager {
  private device: GPUDevice;
  private pipelineCache: Map<string, GPURenderPipeline> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Creates or retrieves a compiled render pipeline for CAD meshes
   */
  public getOrCreateRenderPipeline(
    shaderCode: string,
    format: GPUTextureFormat,
    hasNormals: boolean = true
  ): GPURenderPipeline {
    const cacheKey = `${format}_normals_${hasNormals}`;
    if (this.pipelineCache.has(cacheKey)) {
      return this.pipelineCache.get(cacheKey)!;
    }

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    // Vertex input buffer layouts
    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 3 * 4, // 3 floats (Position x, y, z)
        attributes: [
          {
            shaderLocation: 0, // location(0) in shader
            offset: 0,
            format: 'float32x3',
          },
        ],
      },
    ];

    if (hasNormals) {
      vertexBuffers.push({
        arrayStride: 3 * 4, // 3 floats (Normal x, y, z)
        attributes: [
          {
            shaderLocation: 1, // location(1) in shader
            offset: 0,
            format: 'float32x3',
          },
        ],
      });
    }

    const pipeline = this.device.createRenderPipeline({
      label: 'SECP Main Mesh Render Pipeline',
      layout: 'auto', // Auto-generates BindGroup layout based on bindings in shader
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: vertexBuffers,
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        frontFace: 'ccw',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    this.pipelineCache.set(cacheKey, pipeline);
    return pipeline;
  }

  public clearCache(): void {
    this.pipelineCache.clear();
  }
}
