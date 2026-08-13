/// <reference types="@webgpu/types" />

/**
 * WebGPU Renderer Orchestrator
 * Integrates device, buffers, textures, and pipeline states to draw interactive CAD meshes.
 */

import { IRenderer, RenderableMesh, CameraUniforms } from '../shared/RendererInterface';
import { DeviceManager } from './DeviceManager';
import { PipelineManager } from './PipelineManager';
import { BufferManager } from './BufferManager';
import { TextureManager } from './TextureManager';
import { RenderPass } from './RenderPass';

export class WebGPURenderer implements IRenderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private deviceManager: DeviceManager;
  private pipelineManager: PipelineManager | null = null;
  private bufferManager: BufferManager | null = null;
  private textureManager: TextureManager | null = null;
  private renderPass: RenderPass | null = null;

  // Custom shader for drawing 3D CAD models
  private wgslShaderCode = `
    struct Camera {
      viewMatrix: mat4x4<f32>,
      projectionMatrix: mat4x4<f32>,
      position: vec3<f32>,
    }

    @group(0) @binding(0) var<uniform> camera: Camera;

    struct VertexInput {
      @location(0) position: vec3<f32>,
      @location(1) normal: vec3<f32>,
    }

    struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) worldPos: vec3<f32>,
      @location(1) normal: vec3<f32>,
    }

    @vertex
    fn vs_main(input: VertexInput) -> VertexOutput {
      var output: VertexOutput;
      let localPos = vec4<f32>(input.position, 1.0);
      
      // Calculate view-projection transformation
      output.position = camera.projectionMatrix * camera.viewMatrix * localPos;
      output.worldPos = input.position;
      output.normal = input.normal;
      return output;
    }

    @fragment
    fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
      // Basic Phong Shading with CAD edge highlights
      let N = normalize(input.normal);
      let L = normalize(vec3<f32>(5.0, 10.0, 7.0)); // directional light source
      let V = normalize(camera.position - input.worldPos);
      
      let diffuseIntensity = max(dot(N, L), 0.15);
      
      // High-quality CAD Metallic Material reflection
      let baseColor = vec3<f32>(0.388, 0.400, 0.945); // Indigo accent
      let lightColor = vec3<f32>(1.0, 1.0, 1.0);
      let ambientColor = vec3<f32>(0.08, 0.09, 0.14);
      
      let diffuse = baseColor * diffuseIntensity * lightColor;
      
      // Specular Highlight
      let R = reflect(-L, N);
      let specularIntensity = pow(max(dot(R, V), 0.0), 32.0);
      let specular = vec3<f32>(0.5) * specularIntensity;

      let finalColor = ambientColor + diffuse + specular;
      return vec4<f32>(finalColor, 1.0);
    }
  `;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.deviceManager = new DeviceManager();
  }

  public async initialize(): Promise<boolean> {
    const success = await this.deviceManager.initialize();
    if (!success) {
      return false;
    }

    const device = this.deviceManager.getDevice();
    this.context = this.canvas.getContext('webgpu') as unknown as GPUCanvasContext;

    if (!this.context) {
      console.warn('Could not get WebGPU rendering context from canvas.');
      return false;
    }

    // Configure swap chain context
    this.context.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'opaque',
    });

    // Initialize individual subsystem managers
    this.pipelineManager = new PipelineManager(device);
    this.bufferManager = new BufferManager(device);
    this.textureManager = new TextureManager(device);
    this.renderPass = new RenderPass(device);

    return true;
  }

  public resize(width: number, height: number): void {
    // Canvas dimension resizing is handled on the element side,
    // TextureManager will dynamically adjust the Depth attachments when rendering.
  }

  public render(meshes: RenderableMesh[], camera: CameraUniforms): void {
    if (!this.isReady() || meshes.length === 0) return;

    const device = this.deviceManager.getDevice();
    const context = this.context!;
    const textureManager = this.textureManager!;
    const bufferManager = this.bufferManager!;
    const pipelineManager = this.pipelineManager!;
    const renderPass = this.renderPass!;

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 600;

    // 1. Get swap chain texture views
    const canvasTextureView = context.getCurrentTexture().createView();
    const depthTextureView = textureManager.getOrCreateDepthTextureView(width, height);

    // 2. Map and populate Uniform Buffer parameters for Camera Projection & View Matrix
    // matrices are size 16 * 4 bytes each + position size 4 * 4 bytes = 144 bytes total
    const cameraUniformSize = (16 + 16 + 4) * 4; 
    const cameraBuffer = bufferManager.createUniformBuffer(cameraUniformSize);
    
    // Write view matrix
    bufferManager.writeBuffer(cameraBuffer, 0, camera.viewMatrix);
    // Write projection matrix
    bufferManager.writeBuffer(cameraBuffer, 64, camera.projectionMatrix);
    // Write camera positions
    bufferManager.writeBuffer(cameraBuffer, 128, camera.position);

    // 3. Compile/Retrieve PSO Render Pipeline
    const pipeline = pipelineManager.getOrCreateRenderPipeline(this.wgslShaderCode, 'bgra8unorm', true);

    // 4. Record draw calls inside the GPU Render Pass
    renderPass.execute(canvasTextureView, depthTextureView, { r: 0.03, g: 0.04, b: 0.07, a: 1.0 }, (passEncoder) => {
      passEncoder.setPipeline(pipeline);

      // Create BindGroup matching our auto layout
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: cameraBuffer,
            },
          },
        ],
      });
      passEncoder.setBindGroup(0, bindGroup);

      // Iterate through renderable B-Rep mesh segments
      for (const mesh of meshes) {
        if (mesh.vertices.length === 0 || mesh.indices.length === 0) continue;

        // Allocate temporary draw vertex buffers
        const vBuffer = bufferManager.createVertexBuffer(mesh.vertices);
        const nBuffer = bufferManager.createVertexBuffer(mesh.normals || new Float32Array(mesh.vertices.length));
        const iBuffer = bufferManager.createIndexBuffer(mesh.indices);

        passEncoder.setVertexBuffer(0, vBuffer);
        passEncoder.setVertexBuffer(1, nBuffer);
        passEncoder.setIndexBuffer(iBuffer, 'uint16');
        
        passEncoder.drawIndexed(mesh.indices.length);

        // Schedule cleanup after draw commands are safely recorded
        // Actual release occurs on subsequent GPU device loop to avoid buffer thrashing
        setTimeout(() => {
          bufferManager.destroyBuffer(vBuffer);
          bufferManager.destroyBuffer(nBuffer);
          bufferManager.destroyBuffer(iBuffer);
        }, 100);
      }
    });

    // Clean up temporary uniform buffers
    setTimeout(() => {
      bufferManager.destroyBuffer(cameraBuffer);
    }, 100);
  }

  public getBackendType(): 'WebGPU' | 'WebGL' {
    return 'WebGPU';
  }

  public isReady(): boolean {
    return (
      this.deviceManager.isReady() &&
      this.pipelineManager !== null &&
      this.bufferManager !== null &&
      this.textureManager !== null &&
      this.renderPass !== null
    );
  }

  public destroy(): void {
    if (this.bufferManager) {
      this.bufferManager.destroyAll();
    }
    if (this.textureManager) {
      this.textureManager.destroy();
    }
    if (this.pipelineManager) {
      this.pipelineManager.clearCache();
    }
    this.deviceManager.destroy();
    this.context = null;
  }
}
