/**
 * PATCH-SECP-085: WebAssembly Module Loader & Memory Manager
 *
 * Manages allocation of TypedArrays within WebAssembly Memory buffers,
 * ownership boundaries, low-copy array transfers, and WASM/TS fallback switches.
 */

import { WasmKernelsEngine, WasmInstanceExports } from './WasmKernels';
import { HpcRuntimeMode, SparseMatrixCSR } from '../contracts/HpcContracts';

export interface WasmMemoryPointers {
  rowPtrByteOffset: number;
  colIndByteOffset: number;
  valuesByteOffset: number;
  xByteOffset: number;
  yByteOffset: number;
  outByteOffset: number;
}

export class WasmModuleLoader {
  private static wasmExports: WasmInstanceExports | null = null;
  private static wasmMemory: WebAssembly.Memory | null = null;
  private static isInitialized = false;
  private static initError: string | null = null;

  /**
   * Initialize WebAssembly module safely
   */
  public static async initialize(): Promise<HpcRuntimeMode> {
    if (this.isInitialized && this.wasmExports) {
      return 'WASM_NATIVE';
    }

    try {
      const res = await WasmKernelsEngine.getInstance();
      this.wasmExports = res.exports;
      this.wasmMemory = res.memory;
      this.isInitialized = true;
      this.initError = null;
      return 'WASM_NATIVE';
    } catch (err: any) {
      this.isInitialized = false;
      this.initError = err?.message || 'Failed to initialize WebAssembly module';
      console.warn('[WasmModuleLoader] WASM Initialization failed, falling back to TS Reference:', err);
      return 'TS_FALLBACK';
    }
  }

  /**
   * Synchronous initialization check
   */
  public static initializeSync(): HpcRuntimeMode {
    if (this.isInitialized && this.wasmExports) {
      return 'WASM_NATIVE';
    }

    try {
      const res = WasmKernelsEngine.getInstanceSync();
      this.wasmExports = res.exports;
      this.wasmMemory = res.memory;
      this.isInitialized = true;
      this.initError = null;
      return 'WASM_NATIVE';
    } catch (err: any) {
      this.isInitialized = false;
      this.initError = err?.message || 'Failed to initialize WebAssembly module';
      return 'TS_FALLBACK';
    }
  }

  public static getExports(): WasmInstanceExports | null {
    return this.wasmExports;
  }

  public static getMemory(): WebAssembly.Memory | null {
    return this.wasmMemory;
  }

  public static getInitializationError(): string | null {
    return this.initError;
  }

  /**
   * Allocate low-copy CSR Sparse Matrix structure into WASM memory space
   */
  public static allocateCsrInWasm(csr: SparseMatrixCSR, vectorX: Float64Array): WasmMemoryPointers {
    if (!this.wasmMemory) {
      throw new Error('WebAssembly memory is not initialized');
    }

    const memoryBuffer = this.wasmMemory.buffer;
    
    // We allocate at fixed byte offsets within the 4MB - 32MB linear memory
    const rowPtrOffset = 1024; // 1KB start offset
    const colIndOffset = rowPtrOffset + csr.rowPtr.byteLength;
    const valuesOffset = colIndOffset + csr.colInd.byteLength;
    const xOffset = valuesOffset + csr.values.byteLength;
    const yOffset = xOffset + vectorX.byteLength;
    const outOffset = yOffset + csr.numRows * 8;

    // Ensure memory capacity
    const requiredBytes = outOffset + csr.numRows * 8;
    if (requiredBytes > memoryBuffer.byteLength) {
      const pagesNeeded = Math.ceil((requiredBytes - memoryBuffer.byteLength) / 65536);
      this.wasmMemory.grow(pagesNeeded);
    }

    // Write input data into WASM memory view
    const i32View = new Int32Array(this.wasmMemory.buffer);
    const f64View = new Float64Array(this.wasmMemory.buffer);

    i32View.set(csr.rowPtr, rowPtrOffset / 4);
    i32View.set(csr.colInd, colIndOffset / 4);
    f64View.set(csr.values, valuesOffset / 8);
    f64View.set(vectorX, xOffset / 8);

    return {
      rowPtrByteOffset: rowPtrOffset,
      colIndByteOffset: colIndOffset,
      valuesByteOffset: valuesOffset,
      xByteOffset: xOffset,
      yByteOffset: yOffset,
      outByteOffset: outOffset
    };
  }

  /**
   * Read Float64Array result vector out of WASM memory
   */
  public static readFloat64FromWasm(byteOffset: number, count: number): Float64Array {
    if (!this.wasmMemory) {
      throw new Error('WebAssembly memory is not initialized');
    }
    const f64View = new Float64Array(this.wasmMemory.buffer, byteOffset, count);
    // Return a copy to ensure immutability and memory ownership
    return new Float64Array(f64View);
  }
}
