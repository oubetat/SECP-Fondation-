
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECP-094-R3 Provenance Record
const EXPECTED_HASH = 'db72d52a95130bc58a4a23da48a1ae0ec85e769f114112d7b6e582049cc8766d';
const RAD_TO_DEG = 180.0 / Math.PI;
const ACCEPTABLE_RMS_ERROR = 1e-6;

async function runClosureGate() {
  console.log('=== SECP-094-R3 PROVENANCE & CLOSURE GATE ===\n');

  const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
  if (!fs.existsSync(wasmPath)) {
    console.error('FAIL: Artifact not found at', wasmPath);
    process.exit(1);
  }

  // 1. Provenance Verification
  const buffer = fs.readFileSync(wasmPath);
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const hashMatch = actualHash === EXPECTED_HASH;
  
  console.log(`[1] SHA-256 Provenance Check:`);
  console.log(`    Expected: ${EXPECTED_HASH}`);
  console.log(`    Actual:   ${actualHash}`);
  console.log(`    Status:   ${hashMatch ? 'PASS' : 'FAIL'}\n`);

  if (!hashMatch) {
    console.error('CRITICAL FAILURE: Artifact hash mismatch. Closure aborted.');
    process.exit(1);
  }

  // Instantiate WASM for testing
  const result = await WebAssembly.instantiate(buffer, {
    env: {
      memory: new WebAssembly.Memory({ initial: 64 }),
      abort: () => { throw new Error('WASM Aborted'); }
    }
  });
  const exports = result.instance.exports as any;
  const wasmMemory = exports.memory as WebAssembly.Memory;
  const memF64 = new Float64Array(wasmMemory.buffer);

  // 2. Forensic R1 (Cardinal/Regression)
  console.log(`[2] Forensic R1 Regression Gate:`);
  const v1 = [0, 1, 1]; // Normal vector
  const len1 = Math.sqrt(v1[0]**2 + v1[1]**2 + v1[2]**2);
  const inPtr = 10240;
  const outPtr = 20480;
  
  const inputR1 = new Float64Array(6);
  inputR1[3] = 0; inputR1[4] = 1.0/len1; inputR1[5] = 1.0/len1;
  memF64.set(inputR1, inPtr / 8);
  exports.native_cam_5axis_bulk(1, inPtr, outPtr);
  const outR1 = memF64.slice(outPtr / 8, outPtr / 8 + 6);
  
  const errA1 = Math.abs(outR1[3] - 45.0);
  const errC1 = Math.abs(outR1[4] - 90.0);
  const r1Passed = errA1 < 1e-4 && errC1 < 1e-4;
  console.log(`    Vector [0, 1, 1] -> A: ${outR1[3].toFixed(8)}, C: ${outR1[4].toFixed(8)}`);
  console.log(`    Status:   ${r1Passed ? 'PASS' : 'FAIL'}\n`);

  // 3. Forensic R2 (Mathematical Accuracy)
  console.log(`[3] Forensic R2 Mathematical Accuracy Gate (N=10,000):`);
  const randomPoints = 10000;
  const randInput = new Float64Array(randomPoints * 6);
  let seed = 1337;
  const mulberry32 = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < randomPoints; i++) {
    let dx = mulberry32() * 2 - 1;
    let dy = mulberry32() * 2 - 1;
    let dz = mulberry32() * 2 - 1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    randInput[i * 6 + 3] = dx / len;
    randInput[i * 6 + 4] = dy / len;
    randInput[i * 6 + 5] = dz / len;
  }

  // Grow memory if needed for bulk test
  const bulkOutPtr = inPtr + (randomPoints * 6 * 8) + 1024;
  const requiredPages = Math.ceil((bulkOutPtr + (randomPoints * 6 * 8)) / (64 * 1024)) + 2;
  const currentPages = wasmMemory.buffer.byteLength / (64 * 1024);
  if (currentPages < requiredPages) wasmMemory.grow(requiredPages - currentPages);
  
  const freshMemF64 = new Float64Array(wasmMemory.buffer);
  freshMemF64.set(randInput, inPtr / 8);
  exports.native_cam_5axis_bulk(randomPoints, inPtr, bulkOutPtr);
  const outputs = freshMemF64.slice(bulkOutPtr / 8, (bulkOutPtr / 8) + (randomPoints * 6));

  let totalSqErr = 0;
  let maxAbsErr = 0;
  const errors: number[] = [];

  for (let i = 0; i < randomPoints; i++) {
    const vk = randInput[i * 6 + 5];
    const vi = randInput[i * 6 + 3];
    const vj = randInput[i * 6 + 4];
    const expectedA = Math.acos(Math.max(-1, Math.min(1, vk))) * RAD_TO_DEG;
    const expectedC = Math.atan2(vj, vi) * RAD_TO_DEG;
    const err = Math.max(Math.abs(outputs[i*6+3] - expectedA), Math.abs(outputs[i*6+4] - expectedC));
    errors.push(err);
    totalSqErr += err * err;
    if (err > maxAbsErr) maxAbsErr = err;
  }
  const rms = Math.sqrt(totalSqErr / randomPoints);
  const r2Passed = rms < ACCEPTABLE_RMS_ERROR;
  console.log(`    RMS Error: ${rms.toExponential(10)}`);
  console.log(`    Max Error: ${maxAbsErr.toExponential(10)}`);
  console.log(`    Status:    ${r2Passed ? 'PASS' : 'FAIL'}\n`);

  // 4. Singularity Contract
  console.log(`[4] Singularity & Validation Regression:`);
  const singCases = [
    { i: 0, j: 0, k: 1, expS: 1, expC: 0, name: '+Z' },
    { i: Infinity, j: 0, k: 1, expS: 2, name: 'INF' }
  ];
  let singAllPass = true;
  for (const c of singCases) {
    const input = new Float64Array(6);
    input[3] = c.i; input[4] = c.j; input[5] = c.k;
    freshMemF64.set(input, inPtr / 8);
    exports.native_cam_5axis_bulk(1, inPtr, outPtr);
    const out = freshMemF64.slice(outPtr / 8, outPtr / 8 + 6);
    const pass = out[5] === c.expS && (isNaN(c.expC!) ? isNaN(out[4]) : (c.expC === undefined || out[4] === c.expC));
    console.log(`    Case ${c.name.padEnd(4)}: Status=${out[5]}, C=${out[4].toFixed(1)} -> ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) singAllPass = false;
  }
  console.log(`    Overall:   ${singAllPass ? 'PASS' : 'FAIL'}\n`);

  const finalDecision = hashMatch && r1Passed && r2Passed && singAllPass ? 'PASS' : 'FAIL';
  console.log('-------------------------------------------');
  console.log(`FINAL SECP-094-R3 CLOSURE DECISION: ${finalDecision}`);
  console.log('-------------------------------------------');

  if (finalDecision !== 'PASS') process.exit(1);
}

runClosureGate().catch(e => { console.error(e); process.exit(1); });
