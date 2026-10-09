export interface WasmBufferDescriptor {
  bufferId: string;
  byteOffset: number;
  byteLength: number;
  elementType: 'Float32' | 'Float64' | 'Int32' | 'Uint8';
  elementCount: number;
  elementSize: number;
}

export interface WasmTransferMetrics {
  jsToWasmBytes: number;
  jsToWasmMs: number;
}

export interface WasmReadMetrics {
  data: Float64Array;
  metrics: { wasmToJsBytes: number; wasmToJsMs: number };
}

export class WasmMemoryManager {
  private static bufferSeq: number = 0;
  private allocated: Map<string, WasmBufferDescriptor> = new Map();
  private nextOffset: number = 0;
  private peakMemoryBytes: number = 0;

  constructor(public memory: WebAssembly.Memory, public maxPages: number = 256) {}

  public allocate(elementCount: number, type: 'Float32' | 'Float64' | 'Int32' | 'Uint8'): WasmBufferDescriptor {
    const bytesPerElement = type === 'Float64' ? 8 : (type === 'Uint8' ? 1 : 4);
    const byteLength = elementCount * bytesPerElement;

    // Align to 8 bytes
    if (this.nextOffset % 8 !== 0) {
      this.nextOffset += 8 - (this.nextOffset % 8);
    }

    if (this.nextOffset + byteLength > this.memory.buffer.byteLength) {
      // Simulate OOM
      if (this.nextOffset + byteLength > this.maxPages * 65536) {
        throw new Error('WASM_OUT_OF_MEMORY');
      }
      const newPages = Math.ceil((this.nextOffset + byteLength - this.memory.buffer.byteLength) / 65536);
      this.memory.grow(newPages);
    }

    WasmMemoryManager.bufferSeq++;
    const desc: WasmBufferDescriptor = {
      bufferId: `buf_wasm_${WasmMemoryManager.bufferSeq}_${this.nextOffset}`,
      byteOffset: this.nextOffset,
      byteLength,
      elementType: type,
      elementCount,
      elementSize: bytesPerElement
    };

    this.allocated.set(desc.bufferId, desc);
    this.nextOffset += byteLength;
    if (this.nextOffset > this.peakMemoryBytes) {
      this.peakMemoryBytes = this.nextOffset;
    }
    return desc;
  }

  public writeFloat64(bufferId: string, data: Float64Array, targetMemory?: WebAssembly.Memory): WasmTransferMetrics {
    const desc = this.allocated.get(bufferId);
    if (!desc) throw new Error(`Buffer not found: ${bufferId}`);
    if (data.byteLength > desc.byteLength) throw new Error('Buffer overflow');
    
    const mem = targetMemory || this.memory;
    const t0 = performance.now();
    const view = new Float64Array(mem.buffer, desc.byteOffset, data.length);
    view.set(data);
    
    return {
      jsToWasmBytes: data.byteLength,
      jsToWasmMs: performance.now() - t0
    };
  }

  public readFloat64(bufferId: string, elementCount?: number, targetMemory?: WebAssembly.Memory): WasmReadMetrics {
    const desc = this.allocated.get(bufferId);
    if (!desc) throw new Error(`Buffer not found: ${bufferId}`);
    
    const count = elementCount !== undefined ? elementCount : desc.elementCount;
    const mem = targetMemory || this.memory;
    const t0 = performance.now();
    const view = new Float64Array(mem.buffer, desc.byteOffset, count);
    const data = new Float64Array(view); // copy
    
    return {
      data,
      metrics: {
        wasmToJsBytes: data.byteLength,
        wasmToJsMs: performance.now() - t0
      }
    };
  }

  public getDirectFloat64View(bufferId: string, targetMemory?: WebAssembly.Memory): Float64Array {
    const desc = this.allocated.get(bufferId);
    if (!desc) throw new Error(`Buffer not found: ${bufferId}`);
    const mem = targetMemory || this.memory;
    return new Float64Array(mem.buffer, desc.byteOffset, desc.elementCount);
  }

  public release(bufferId: string): void {
    this.allocated.delete(bufferId);
    if (this.allocated.size === 0) {
      this.nextOffset = 0;
    }
  }

  public reset(): void {
    this.allocated.clear();
    this.nextOffset = 0;
  }

  public getTotalAllocatedBytes(): number {
    let total = 0;
    for (const b of this.allocated.values()) {
      total += b.byteLength;
    }
    return total;
  }

  public getPeakMemoryBytes(): number {
    return this.peakMemoryBytes;
  }
}
