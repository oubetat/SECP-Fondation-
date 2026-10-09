
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
  const buffer = fs.readFileSync(wasmPath);
  const result = await WebAssembly.instantiate(buffer, {
    env: { memory: new WebAssembly.Memory({ initial: 64 }), abort: () => {} }
  });
  const exports = result.instance.exports as any;
  const memF64 = new Float64Array((exports.memory as WebAssembly.Memory).buffer);

  const testCases = [
    { name: 'Exact +Z', i: 0, j: 0, k: 1, expS: 1, expC: 0 },
    { name: 'Exact -Z', i: 0, j: 0, k: -1, expS: 1, expC: 0 },
    { name: 'Near Singularity', i: 1e-15, j: 1e-15, k: 1, expS: 1, expC: 0 },
    { name: 'Infinity Input', i: Infinity, j: 0, k: 1, expS: 2, expC: NaN },
    { name: 'NaN Input', i: NaN, j: 0, k: 1, expS: 2, expC: NaN }
  ];

  console.log('--- Singularity & Validation Regression ---');
  for (const t of testCases) {
    const input = new Float64Array(6);
    input[3] = t.i; input[4] = t.j; input[5] = t.k;
    memF64.set(input, 10240 / 8);
    exports.native_cam_5axis_bulk(1, 10240, 20480);
    const out = memF64.slice(20480 / 8, 20480 / 8 + 6);
    const status = out[5];
    const c = out[4];

    const pass = (status === t.expS) && (isNaN(t.expC) ? isNaN(c) : c === t.expC);
    console.log(`${t.name.padEnd(20)}: Status=${status}, C=${c} -> ${pass ? 'PASS' : 'FAIL'}`);
  }
}

run().catch(console.error);
