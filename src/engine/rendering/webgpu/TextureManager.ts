/// <reference types="@webgpu/types" />

/**
 * WebGPU Texture & Depth Stencil Manager
 * Manages frame attachments, depth-stencil views, and hardware sampling.
 */

export class TextureManager {
  private device: GPUDevice;
  private depthTexture: GPUTexture | null = null;
  private depthTextureView: GPUTextureView | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Generates or scales depth texture view based on viewport dimensions
   */
  public getOrCreateDepthTextureView(width: number, height: number): GPUTextureView {
    const roundedW = Math.max(1, Math.floor(width));
    const roundedH = Math.max(1, Math.floor(height));

    if (
      this.depthTexture &&
      this.depthTexture.width === roundedW &&
      this.depthTexture.height === roundedH
    ) {
      return this.depthTextureView!;
    }

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size: [roundedW, roundedH, 1],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.depthTextureView = this.depthTexture.createView();
    return this.depthTextureView;
  }

  public destroy(): void {
    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = null;
      this.depthTextureView = null;
    }
  }
}
