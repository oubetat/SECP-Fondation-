/**
 * GPUBufferManager: Abstraction for buffer lifecycle bookkeeping.
 * NOTE: This class manages the 'metadata' and 'identifiers' of buffers.
 * Real GPU memory allocation occurs via device.createBuffer() in the execution backend.
 */
export class GPUBufferManager {
  private buffers: Map<string, { id: string, size: number, realBuffer?: any }> = new Map();

  public registerBuffer(id: string, size: number, realBuffer?: any): void {
    this.buffers.set(id, { id, size, realBuffer });
  }

  public releaseBuffer(id: string): void {
    const buf = this.buffers.get(id);
    if (buf?.realBuffer && typeof buf.realBuffer.destroy === 'function') {
      buf.realBuffer.destroy();
    }
    this.buffers.delete(id);
  }

  public getStats(): { totalAllocatedBytes: number; count: number } {
    let totalAllocatedBytes = 0;
    this.buffers.forEach(b => totalAllocatedBytes += b.size);
    return { totalAllocatedBytes, count: this.buffers.size };
  }
}

