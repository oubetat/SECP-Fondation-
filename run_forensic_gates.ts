import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Mock fetch and Worker for Node environment
class MockWorker {
  onmessage: ((e: any) => void) | null = null;
  onerror: ((err: any) => void) | null = null;

  async postMessage(message: any) {
    const { commandId, operation, kernelId, wasmUrl, wasmHash, inputs } = message;

    try {
      const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
      if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found at ${wasmPath}`);
      }
      const buffer = fs.readFileSync(wasmPath);
      
      const module = await WebAssembly.compile(buffer);
      const tempMemory = new WebAssembly.Memory({ initial: 64, maximum: 512 });
      const instance = await WebAssembly.instantiate(module, {
        env: {
          memory: tempMemory,
          abort: () => { throw new Error('WASM Aborted'); }
        }
      });

      const exports = instance.exports as any;
      const memory = (exports.memory as WebAssembly.Memory) || tempMemory;
      const targetPages = 512;
      const currentPages = Math.ceil(memory.buffer.byteLength / (64 * 1024));
      if (currentPages < targetPages) {
        memory.grow(targetPages - currentPages);
      }

      const startTime = performance.now();

      let result: any;
      if (kernelId === 'native_add') {
        result = exports.native_add(inputs.a, inputs.b);
      } else if (kernelId === 'native_multiply') {
        result = exports.native_multiply(inputs.a, inputs.b);
      } else if (kernelId === 'native_cam_5axis_bulk') {
        const { nPoints, cartesianPts } = inputs;
        const memF64 = new Float64Array(memory.buffer);
        let currentPtr = 1024;

        const inPtr = currentPtr;
        memF64.set(cartesianPts, inPtr / 8);
        currentPtr += cartesianPts.byteLength;

        const outPtr = currentPtr;
        currentPtr += nPoints * 6 * 8;

        exports.native_cam_5axis_bulk(nPoints, inPtr, outPtr);

        const machinePoints = new Float64Array(memory.buffer, outPtr, nPoints * 6).slice();
        result = {
          machinePoints,
          pointCount: nPoints
        };
      } else if (kernelId === 'native_geom_bulk_execute') {
        const { nOps, opTypes, inputs: packedInputs, inputOffsets, outputOffsets } = inputs;
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
        memF64.fill(0, outputsPtr / 8, (outputsPtr / 8) + (nOps * 3));
        currentPtr += nOps * 3 * 8;

        const statusesPtr = currentPtr;
        mem32.fill(0, statusesPtr / 4, (statusesPtr / 4) + nOps);
        currentPtr += nOps * 4;

        exports.native_geom_bulk_execute(
          nOps, opTypesPtr, inputsPtr, inputOffsetsPtr, outputsPtr, outputOffsetsPtr, statusesPtr
        );

        const outputs = new Float64Array(memory.buffer, outputsPtr, nOps * 3).slice();
        const statuses = new Int32Array(memory.buffer, statusesPtr, nOps).slice();

        const resultOutputs = outputs as any;
        resultOutputs.statuses = statuses;

        result = {
          outputs: resultOutputs,
          statuses,
          opCount: nOps
        };
      } else {
        throw new Error(`Unsupported kernelId in MockWorker: ${kernelId}`);
      }

      const endTime = performance.now();

      if (this.onmessage) {
        this.onmessage({
          data: {
            status: 'COMPLETED',
            result,
            metadata: {
              executionTimeMs: endTime - startTime,
              wasmHash,
              kernelId,
              thread: 'MockWorker-Native'
            }
          }
        });
      }
    } catch (err: any) {
      console.error("[MockWorker Error]:", err.stack);
      if (this.onerror) {
        this.onerror(err);
      } else if (this.onmessage) {
        this.onmessage({
          data: {
            status: 'FAILED',
            error: err.message,
            metadata: {
              wasmHash,
              kernelId
            }
          }
        });
      }
    }
  }

  terminate() {
    // No-op
  }
}

global.Worker = MockWorker as any;

global.fetch = (async (url: string) => {
  if (url.endsWith('engineering_kernels.wasm')) {
    const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
    const buffer = fs.readFileSync(wasmPath);
    return {
      ok: true,
      arrayBuffer: async () => {
        const ab = new ArrayBuffer(buffer.length);
        const view = new Uint8Array(ab);
        view.set(buffer);
        return ab;
      }
    };
  }
  throw new Error(`Fetch not mocked for URL: ${url}`);
}) as any;

// Import the gates to execute
import { HardAcceptanceGate095 } from './src/engine/validation/HardAcceptanceGate095.js';
import { HardAcceptanceGate094R1 } from './src/engine/validation/HardAcceptanceGate094R1.js';

async function run() {
  console.log("=========================================");
  console.log("SECP-095-R1 Live Forensic Execution Tool");
  console.log("=========================================");

  console.log("\nExecuting HardAcceptanceGate095...");
  const gate095Result = await HardAcceptanceGate095.executeGate();
  console.log(`Gate 095 Decision: ${gate095Result.decision}`);

  console.log("\nExecuting HardAcceptanceGate094R1 (Regression)...");
  const gate094Result = await HardAcceptanceGate094R1.executeGate();
  console.log(`Gate 094 Decision: ${gate094Result.decision}`);

  // Save the raw reports to disk for evidence closure
  const evidence = {
    gate095: gate095Result,
    gate094R1: gate094Result,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.resolve(__dirname, './secp_evidence_report.json'),
    JSON.stringify(evidence, null, 2)
  );
  console.log("\nForensic reports successfully saved to ./secp_evidence_report.json");
}

run().catch(err => {
  console.error("Forensic execution failed:", err);
  process.exit(1);
});
