/// <reference types="@webgpu/types" />

/**
 * WebGPU Render Pass Utility
 * Creates CommandEncoders, structures attachment descriptors, and submits work.
 */

export class RenderPass {
  private device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Encapsulates the recording of draw calls into a command list submitted to the queue
   */
  public execute(
    colorAttachmentView: GPUTextureView,
    depthAttachmentView: GPUTextureView,
    clearColor: { r: number; g: number; b: number; a: number } = { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
    callback: (passEncoder: GPURenderPassEncoder) => void
  ): void {
    const commandEncoder = this.device.createCommandEncoder({
      label: 'SECP Render Queue Command Encoder',
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: colorAttachmentView,
          clearValue: clearColor,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthAttachmentView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    // Invoke custom drawing commands recorded in callback
    callback(passEncoder);

    passEncoder.end();

    // Submit instructions asynchronously to GPU hardware queue
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
