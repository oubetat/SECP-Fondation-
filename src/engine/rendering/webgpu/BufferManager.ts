/// <reference types="@webgpu/types" />

/**
 * WebGPU Buffer Manager
 * Handles GPUBuffer allocations, writes, uniform buffers, and alignments.
 */

export class BufferManager {
  private device: GPUDevice;
  private activeBuffers: Set<GPUBuffer> = new Set();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Allocates static or dynamic array buffers for geometry streaming
   */
  public createVertexBuffer(data: Float32Array): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    // Write to memory mapped on CPU
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();

    this.activeBuffers.add(buffer);
    return buffer;
  }

  /**
   * Allocates hardware index buffers for fast indexed face rendering
   */
  public createIndexBuffer(data: Uint16Array | Uint32Array): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    if (data instanceof Uint16Array) {
      new Uint16Array(buffer.getMappedRange()).set(data);
    } else {
      new Uint32Array(buffer.getMappedRange()).set(data);
    }
    buffer.unmap();

    this.activeBuffers.add(buffer);
    return buffer;
  }

  /**
   * Creates a uniform alignment-friendly model matrix and camera buffer
   */
  public createUniformBuffer(size: number): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.activeBuffers.add(buffer);
    return buffer;
  }

  /**
   * Writes uniform updates cleanly using GPUDevice.queue
   */
  public writeBuffer(buffer: GPUBuffer, offset: number, data: BufferSource): void {
    this.device.queue.writeBuffer(buffer, offset, data);
  }

  public destroyBuffer(buffer: GPUBuffer): void {
    buffer.destroy();
    this.activeBuffers.delete(buffer);
  }

  public destroyAll(): void {
    for (const buffer of this.activeBuffers) {
      buffer.destroy();
    }
    this.activeBuffers.clear();
  }
}
