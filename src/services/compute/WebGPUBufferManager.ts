export type BufferState =
  | 'INITIALIZED'
  | 'UPLOADING'
  | 'READY'
  | 'IN_USE'
  | 'COPYING'
  | 'READBACK'
  | 'RELEASED'
  | 'INVALIDATED';

export interface WebGPUBuffer {
  bufferId: string;
  sizeBytes: number;
  usage: 'STORAGE' | 'UNIFORM' | 'MAP_READ' | 'MAP_WRITE';
  state: BufferState;
  inputHash: string;
}

export class WebGPUBufferManager {
  private maxMemoryBytes: number;
  private allocatedMemoryBytes: number;
  private buffers = new Map<string, WebGPUBuffer>();

  constructor(maxMemoryMB: number = 1024) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
    this.allocatedMemoryBytes = 0;
  }

  public allocateBuffer(
    bufferId: string,
    sizeBytes: number,
    usage: 'STORAGE' | 'UNIFORM' | 'MAP_READ' | 'MAP_WRITE',
    inputHash: string
  ): { success: boolean; buffer?: WebGPUBuffer; error?: string } {
    if (this.allocatedMemoryBytes + sizeBytes > this.maxMemoryBytes) {
      return {
        success: false,
        error: 'WEBGPU_MEMORY_LIMIT: WebGPU memory allocation exceeded budget limits'
      };
    }

    const buf: WebGPUBuffer = {
      bufferId,
      sizeBytes,
      usage,
      state: 'INITIALIZED',
      inputHash
    };

    this.buffers.set(bufferId, buf);
    this.allocatedMemoryBytes += sizeBytes;

    return { success: true, buffer: buf };
  }

  public updateBufferState(bufferId: string, newState: BufferState): boolean {
    const buf = this.buffers.get(bufferId);
    if (!buf) return false;
    buf.state = newState;
    return true;
  }

  public freeBuffer(bufferId: string): void {
    const buf = this.buffers.get(bufferId);
    if (buf) {
      this.allocatedMemoryBytes = Math.max(0, this.allocatedMemoryBytes - buf.sizeBytes);
      buf.state = 'RELEASED';
      this.buffers.delete(bufferId);
    }
  }

  public getMemoryBudget(): { allocatedMB: number; maxMB: number; freeMB: number } {
    return {
      allocatedMB: this.allocatedMemoryBytes / (1024 * 1024),
      maxMB: this.maxMemoryBytes / (1024 * 1024),
      freeMB: (this.maxMemoryBytes - this.allocatedMemoryBytes) / (1024 * 1024)
    };
  }
}
