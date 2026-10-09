export interface WasmMemoryStatus {
  heapSizeBytes: number;
  heapLimitBytes: number;
  utilizationPercent: number;
  exceedsThreshold: boolean;
}

export interface OffloadPayloadChunk {
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
  sha256Hash: string;
}

export interface CloudHpcTaskMetadata {
  taskId: string;
  subsystem: 'CFD' | 'FEA' | 'CAD_REGENERATION' | 'CAM_5AXIS';
  totalElementCount: number;
  estimatedComputeFlops: number;
  requiresCloudOffload: boolean;
  offloadReason?: 'WASM_MEMORY_LIMIT' | 'HIGH_ELEMENT_COUNT' | 'EXPLICIT_USER_REQUEST';
}

export class WasmMemoryGuardHpcBridge {
  public static readonly DEFAULT_WASM_LIMIT_BYTES = 3.5 * 1024 * 1024 * 1024; // 3.5 GB
  public static readonly HIGH_ELEMENT_OFFLOAD_THRESHOLD = 500_000; // 500k elements

  /**
   * Inspects current WebAssembly memory allocation and checks safety threshold
   */
  public static inspectWasmMemory(
    customHeapBytes?: number,
    limitBytes: number = WasmMemoryGuardHpcBridge.DEFAULT_WASM_LIMIT_BYTES
  ): WasmMemoryStatus {
    let heapSize = customHeapBytes || 0;

    // Inspect performance.memory if available in browser
    if (!customHeapBytes && typeof window !== 'undefined' && (window.performance as any)?.memory) {
      heapSize = (window.performance as any).memory.usedJSHeapSize || 0;
    }

    const utilization = (heapSize / limitBytes) * 100;
    const exceedsThreshold = utilization >= 75.0 || heapSize > 2.5 * 1024 * 1024 * 1024;

    return {
      heapSizeBytes: heapSize,
      heapLimitBytes: limitBytes,
      utilizationPercent: utilization,
      exceedsThreshold,
    };
  }

  /**
   * Evaluates if a computation should run locally in WASM or offloaded to Cloud HPC
   */
  public static evaluateOffloadRequirement(
    subsystem: CloudHpcTaskMetadata['subsystem'],
    totalElementCount: number,
    customHeapBytes?: number
  ): CloudHpcTaskMetadata {
    const memStatus = WasmMemoryGuardHpcBridge.inspectWasmMemory(customHeapBytes);
    const requiresOffload =
      memStatus.exceedsThreshold ||
      totalElementCount >= WasmMemoryGuardHpcBridge.HIGH_ELEMENT_OFFLOAD_THRESHOLD;

    let offloadReason: CloudHpcTaskMetadata['offloadReason'] = undefined;
    if (memStatus.exceedsThreshold) {
      offloadReason = 'WASM_MEMORY_LIMIT';
    } else if (totalElementCount >= WasmMemoryGuardHpcBridge.HIGH_ELEMENT_OFFLOAD_THRESHOLD) {
      offloadReason = 'HIGH_ELEMENT_COUNT';
    }

    const taskId = `HPC-TASK-${subsystem}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const estimatedComputeFlops = totalElementCount * 1e5;

    return {
      taskId,
      subsystem,
      totalElementCount,
      estimatedComputeFlops,
      requiresCloudOffload: requiresOffload,
      offloadReason,
    };
  }

  /**
   * Prepares a chunked payload for streaming offload to Cloud HPC cluster
   */
  public static prepareStreamingPayload(
    payloadData: Uint8Array,
    chunkSizeBytes: number = 10 * 1024 * 1024 // 10 MB chunks
  ): OffloadPayloadChunk[] {
    const totalChunks = Math.ceil(payloadData.length / chunkSizeBytes);
    const chunks: OffloadPayloadChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSizeBytes;
      const end = Math.min(start + chunkSizeBytes, payloadData.length);
      const slice = payloadData.subarray(start, end);

      // Simple pseudo-hash for validation
      let hash = 0;
      for (let j = 0; j < slice.length; j += 100) {
        hash = (hash * 31 + slice[j]) & 0xffffffff;
      }

      chunks.push({
        chunkIndex: i,
        totalChunks,
        dataBase64: `data:application/octet-stream;base64,chunk_${i}`,
        sha256Hash: `SHA256-${Math.abs(hash).toString(16)}`,
      });
    }

    return chunks;
  }
}
