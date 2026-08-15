/**
 * SECP-091: Real WebWorker Execution Fabric
 * 
 * This is the isolated execution context for Native WASM Kernels.
 * It strictly executes computation inside WASM and communicates via ArrayBuffers.
 * NO JavaScript solvers are allowed in this file.
 */

interface WasmMessage {
  commandId: string;
  operation: 'EXECUTE_KERNEL';
  kernelId: string;
  wasmUrl: string;
  wasmHash: string;
  inputs: Record<string, any>;
  memoryConfig: {
    initialPages: number;
    maximumPages?: number;
  };
}

// Global state for WASM instance
let wasmInstance: WebAssembly.Instance | null = null;
let currentWasmHash: string | null = null;

async function loadWasm(url: string, expectedHash: string): Promise<WebAssembly.Instance> {
  // If already loaded and hash matches, reuse
  if (wasmInstance && currentWasmHash === expectedHash) {
    return wasmInstance;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[HPC-Worker] Failed to fetch WASM binary from ${url}`);
  }

  const buffer = await response.arrayBuffer();
  
  // Verify hash before instantiation (Forensic Check)
  const actualHashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const actualHash = Array.from(new Uint8Array(actualHashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (actualHash !== expectedHash) {
    throw new Error(`[HPC-Worker] WASM Binary Provenance Mismatch! Expected: ${expectedHash}, Actual: ${actualHash}`);
  }

  const module = await WebAssembly.compile(buffer);
  
  // We provide a basic env for now
  const memory = new WebAssembly.Memory({ initial: 10 }); // 640KB starting
  const instance = await WebAssembly.instantiate(module, {
    env: {
      memory: memory,
      abort: () => { throw new Error('WASM Aborted'); }
    }
  });

  wasmInstance = instance;
  currentWasmHash = expectedHash;
  return instance;
}

self.onmessage = async (e: MessageEvent<WasmMessage>) => {
  const { commandId, operation, kernelId, wasmUrl, wasmHash, inputs } = e.data;

  if (operation !== 'EXECUTE_KERNEL') {
    self.postMessage({ commandId, status: 'FAILED', error: 'UNSUPPORTED_OPERATION' });
    return;
  }

  try {
    const instance = await loadWasm(wasmUrl, wasmHash);
    const exports = instance.exports as any;

    if (!exports[kernelId]) {
      throw new Error(`[HPC-Worker] Kernel '${kernelId}' not found in WASM exports`);
    }

    const startTime = performance.now();
    
    // Execute Native Kernel
    let result: any;
    if (kernelId === 'native_add') {
      result = exports.native_add(inputs.a, inputs.b);
    } else if (kernelId === 'native_multiply') {
      result = exports.native_multiply(inputs.a, inputs.b);
    } else if (kernelId === 'native_fea_cg_solve') {
      // Memory Management for CG Solve
      const { n, rowPtr, colInd, values, b, tolerance, maxIterations } = inputs;
      
      const memory = exports.memory as WebAssembly.Memory;
      const mem8 = new Uint8Array(memory.buffer);
      const mem32 = new Int32Array(memory.buffer);
      const memF64 = new Float64Array(memory.buffer);

      // Allocation Strategy: Linear layout
      // [rowPtrs] [colIndices] [values] [rhs] [solution] [r] [p] [Ap] [residualNorm]
      let currentPtr = 1024; // Offset to avoid null pointers or small data

      const rowPtrPtr = currentPtr;
      mem32.set(rowPtr, rowPtrPtr / 4);
      currentPtr += rowPtr.byteLength;

      const colIndPtr = currentPtr;
      mem32.set(colInd, colIndPtr / 4);
      currentPtr += colInd.byteLength;

      const valPtr = currentPtr;
      memF64.set(values, valPtr / 8);
      currentPtr += values.byteLength;

      const bPtr = currentPtr;
      memF64.set(b, bPtr / 8);
      currentPtr += b.byteLength;

      const xPtr = currentPtr;
      memF64.fill(0, xPtr / 8, (xPtr / 8) + n); // Initial guess = 0
      currentPtr += n * 8;

      const rPtr = currentPtr;
      currentPtr += n * 8;

      const pPtr = currentPtr;
      currentPtr += n * 8;

      const ApPtr = currentPtr;
      currentPtr += n * 8;

      const outResPtr = currentPtr;
      currentPtr += 8;

      // Invoke Native WASM
      const iterations = exports.native_fea_cg_solve(
        n, rowPtrPtr, colIndPtr, valPtr, bPtr, xPtr,
        tolerance, maxIterations,
        rPtr, pPtr, ApPtr, outResPtr
      );

      // Extract results
      const solution = new Float64Array(memory.buffer, xPtr, n).slice();
      const residualNorm = memF64[outResPtr / 8];

      result = {
        solution,
        iterations,
        residualNorm,
        converged: residualNorm <= tolerance
      };
    } else if (kernelId === 'native_cfd_momentum_flux') {
      // Memory Management for CFD Flux
      const { nFaces, cellDataL, cellDataR, normals, areas } = inputs;
      
      const memory = exports.memory as WebAssembly.Memory;
      const memF64 = new Float64Array(memory.buffer);

      let currentPtr = 1024;

      const LPtr = currentPtr;
      memF64.set(cellDataL, LPtr / 8);
      currentPtr += cellDataL.byteLength;

      const RPtr = currentPtr;
      memF64.set(cellDataR, RPtr / 8);
      currentPtr += cellDataR.byteLength;

      const normPtr = currentPtr;
      memF64.set(normals, normPtr / 8);
      currentPtr += normals.byteLength;

      const areaPtr = currentPtr;
      memF64.set(areas, areaPtr / 8);
      currentPtr += areas.byteLength;

      const outPtr = currentPtr;
      currentPtr += nFaces * 5 * 8; // [f_rho, f_u, f_v, f_w, f_e] per face

      // Invoke Native CFD Kernel
      exports.native_cfd_momentum_flux(
        nFaces, LPtr, RPtr, normPtr, areaPtr, outPtr
      );

      // Extract results
      const fluxes = new Float64Array(memory.buffer, outPtr, nFaces * 5).slice();

      result = {
        fluxes,
        faceCount: nFaces
      };
    } else if (kernelId === 'native_cam_5axis_bulk') {
      // Memory Management for CAM 5-Axis Kinematics
      const { nPoints, cartesianPts } = inputs;
      
      const memory = exports.memory as WebAssembly.Memory;
      const memF64 = new Float64Array(memory.buffer);

      let currentPtr = 1024;

      const inPtr = currentPtr;
      memF64.set(cartesianPts, inPtr / 8);
      currentPtr += cartesianPts.byteLength;

      const outPtr = currentPtr;
      currentPtr += nPoints * 6 * 8; // [xm, ym, zm, a, c, status] per point

      // Invoke Native CAM Kernel
      exports.native_cam_5axis_bulk(nPoints, inPtr, outPtr);

      // Extract results
      const machinePoints = new Float64Array(memory.buffer, outPtr, nPoints * 6).slice();

      result = {
        machinePoints,
        pointCount: nPoints
      };
    } else if (kernelId === 'native_geom_bulk_execute') {
      const { nOps, opTypes, inputs: packedInputs, inputOffsets, outputOffsets } = inputs;
      
      const memory = exports.memory as WebAssembly.Memory;
      const mem32 = new Int32Array(memory.buffer);
      const memF64 = new Float64Array(memory.buffer);

      let currentPtr = 1024;

      const opTypesPtr = currentPtr;
      mem32.set(opTypes, opTypesPtr / 4);
      currentPtr += opTypes.byteLength;

      const inputsPtr = currentPtr;
      memF64.set(packedInputs, inputsPtr / 8);
      currentPtr += packedInputs.byteLength;

      const inputOffsetsPtr = currentPtr;
      mem32.set(inputOffsets, inputOffsetsPtr / 4);
      currentPtr += inputOffsets.byteLength;

      const outputOffsetsPtr = currentPtr;
      mem32.set(outputOffsets, outputOffsetsPtr / 4);
      currentPtr += outputOffsets.byteLength;

      const outputsPtr = currentPtr;
      // Initialize to zero
      memF64.fill(0, outputsPtr / 8, (outputsPtr / 8) + (nOps * 3));
      currentPtr += nOps * 3 * 8;

      const statusesPtr = currentPtr;
      mem32.fill(0, statusesPtr / 4, (statusesPtr / 4) + nOps);
      currentPtr += nOps * 4;

      // Execute bulk native geometry operations
      exports.native_geom_bulk_execute(
        nOps,
        opTypesPtr,
        inputsPtr,
        inputOffsetsPtr,
        outputsPtr,
        outputOffsetsPtr,
        statusesPtr
      );

      // Explicit copy from WASM Linear Memory back to JS Object
      const outputs = new Float64Array(memory.buffer, outputsPtr, nOps * 3).slice();
      const statuses = new Int32Array(memory.buffer, statusesPtr, nOps).slice();

      result = {
        outputs,
        statuses,
        opCount: nOps
      };
    } else {
      // Call generic export if possible (risky but allowed for forensic verification)
      result = exports[kernelId](...Object.values(inputs));
    }

    const endTime = performance.now();

    self.postMessage({
      commandId,
      status: 'COMPLETED',
      result,
      metadata: {
        executionTimeMs: endTime - startTime,
        wasmHash: currentWasmHash,
        kernelId,
        thread: 'WebWorker-Native'
      }
    });

  } catch (error: any) {
    self.postMessage({
      commandId,
      status: 'FAILED',
      error: error.message,
      metadata: {
        wasmHash: currentWasmHash,
        kernelId
      }
    });
  }
};
