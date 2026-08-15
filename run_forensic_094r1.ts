
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
  const buffer = fs.readFileSync(wasmPath);
  
  const result = await WebAssembly.instantiate(buffer, {
    env: {
      memory: new WebAssembly.Memory({ initial: 64 }),
      abort: () => { throw new Error('WASM Aborted'); }
    }
  });
  
  const exports = result.instance.exports as any;
  const wasmMemory = exports.memory as WebAssembly.Memory;
  const memF64 = new Float64Array(wasmMemory.buffer);

  // Test Case: Normal Orientation (The one that failed before)
  // [0, 1, 1] Normalized
  const v = [0, 1, 1];
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  const inPtr = 10240;
  const outPtr = 20480;
  
  const input = new Float64Array(6);
  input[0] = 0; input[1] = 0; input[2] = 0;
  input[3] = 0; input[4] = 1.0/len; input[5] = 1.0/len;
  
  memF64.set(input, inPtr / 8);
  exports.native_cam_5axis_bulk(1, inPtr, outPtr);
  const output = memF64.slice(outPtr / 8, outPtr / 8 + 6);
  
  const a = output[3];
  const c = output[4];
  
  console.log(`Gate 094-R1 Regression Test:`);
  console.log(`Input Vector: [0, 1, 1] (normalized)`);
  console.log(`Expected A: 45.00000000`);
  console.log(`Actual A:   ${a.toFixed(10)}`);
  console.log(`Expected C: 90.00000000`);
  console.log(`Actual C:   ${c.toFixed(10)}`);
  
  const errorA = Math.abs(a - 45.0);
  const errorC = Math.abs(c - 90.0);
  const pass = errorA < 0.0001 && errorC < 0.0001; // Hard gate original tolerance was 0.0001
  
  console.log(`Decision: ${pass ? 'PASS' : 'FAIL'}`);
}

run().catch(console.error);
