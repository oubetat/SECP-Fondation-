/**
 * SECP Shared Rendering Interface & Types
 * Defines the cross-compatible contract between WebGPU and WebGL fallback pipelines.
 */

export interface RenderableMesh {
  id: string;
  vertices: Float32Array;
  indices: Uint16Array | Uint32Array;
  normals?: Float32Array;
  colorHex?: string;
  transformMatrix?: Float32Array; // 4x4 transform
}

export interface CameraUniforms {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  position: Float32Array; // x, y, z
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  powerPreference?: 'high-performance' | 'low-power';
}

export interface IRenderer {
  initialize(): Promise<boolean>;
  resize(width: number, height: number): void;
  render(meshes: RenderableMesh[], camera: CameraUniforms): void;
  destroy(): void;
  getBackendType(): 'WebGPU' | 'WebGL';
}
