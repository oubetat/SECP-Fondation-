
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAD_TO_DEG = 180.0 / Math.PI;
const SINGULARITY_THRESHOLD = 1e-12;
const ACCEPTABLE_RMS_ERROR = 1e-6;

async function run() {
  const wasmPath = path.resolve(__dirname, './public/wasm/engineering_kernels.wasm');
  const buffer = fs.readFileSync(wasmPath);
  
  const tempMemory = new WebAssembly.Memory({ initial: 64, maximum: 512 });
  const result = await WebAssembly.instantiate(buffer, {
    env: {
      memory: tempMemory,
      abort: () => { throw new Error('WASM Aborted'); }
    }
  });
  const instance = result.instance;
  const exports = instance.exports as any;
  // 1. Accuracy Benchmark
  const randomPoints = 10000;
  const inPtr = 10240;
  const outPtr = inPtr + (randomPoints * 6 * 8) + 1024;

  const wasmMemory = (exports.memory as WebAssembly.Memory) || tempMemory;
  
  const requiredBytes = outPtr + (randomPoints * 6 * 8) + 1024;
  const requiredPages = Math.ceil(requiredBytes / (64 * 1024)) + 2;
  const currentPages = wasmMemory.buffer.byteLength / (64 * 1024);
  if (currentPages < requiredPages) {
    wasmMemory.grow(requiredPages - currentPages);
  }
  
  const memF64 = new Float64Array(wasmMemory.buffer);

  const randInput = new Float64Array(randomPoints * 6);
  let seed = 1337;
  const mulberry32 = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < randomPoints; i++) {
    randInput[i * 6 + 0] = mulberry32() * 100 - 50;
    randInput[i * 6 + 1] = mulberry32() * 100 - 50;
    randInput[i * 6 + 2] = mulberry32() * 100 - 50;
    let dx = mulberry32() * 2 - 1;
    let dy = mulberry32() * 2 - 1;
    let dz = mulberry32() * 2 - 1;
    const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
    randInput[i * 6 + 3] = dx / len;
    randInput[i * 6 + 4] = dy / len;
    randInput[i * 6 + 5] = dz / len;
  }

  memF64.set(randInput, inPtr / 8);
  
  exports.native_cam_5axis_bulk(randomPoints, inPtr, outPtr);
  const outputs = memF64.slice(outPtr / 8, (outPtr / 8) + (randomPoints * 6));

  const errors: number[] = [];
  let totalSqErr = 0;
  let maxAbsErr = 0;
  let worstIdx = 0;

  for (let i = 0; i < randomPoints; i++) {
    const vi = randInput[i * 6 + 3];
    const vj = randInput[i * 6 + 4];
    const vk = randInput[i * 6 + 5];

    const actualA = outputs[i * 6 + 3];
    const actualC = outputs[i * 6 + 4];

    const expectedA = Math.acos(Math.max(-1, Math.min(1, vk))) * RAD_TO_DEG;
    const expectedC = Math.atan2(vj, vi) * RAD_TO_DEG;

    const errA = Math.abs(actualA - expectedA);
    const errC = Math.abs(actualC - expectedC);
    const pointErr = Math.max(errA, errC);

    errors.push(pointErr);
    totalSqErr += pointErr * pointErr;

    if (pointErr > maxAbsErr) {
      maxAbsErr = pointErr;
      worstIdx = i;
    }
  }

  errors.sort((a, b) => a - b);
  const rmsError = Math.sqrt(totalSqErr / randomPoints);
  const p95 = errors[Math.ceil(0.95 * randomPoints) - 1];
  const p99 = errors[Math.ceil(0.99 * randomPoints) - 1];
  const p999 = errors[Math.ceil(0.999 * randomPoints) - 1];

  // 2. Singularity Check
  const singInput = new Float64Array(6);
  singInput[3] = 1e-15;
  singInput[4] = 1e-15;
  singInput[5] = -1.0;
  
  memF64.set(singInput, inPtr / 8);
  exports.native_cam_5axis_bulk(1, inPtr, outPtr);
  const sOut = memF64.slice(outPtr / 8, (outPtr / 8) + 6);
  const status = sOut[5];
  const actualC = sOut[4];
  const singPassed = status === 1 && actualC === 0;

  const decision = (rmsError < ACCEPTABLE_RMS_ERROR && singPassed) ? 'PASS' : 'FAIL';

  console.log(`Gate 094-R2 Decision: ${decision}`);
  console.log(`RMS Error: ${rmsError.toExponential(10)}`);
  console.log(`Max Abs Error: ${maxAbsErr.toExponential(10)}`);
  console.log(`P95: ${p95.toExponential(10)}`);
  console.log(`P99: ${p99.toExponential(10)}`);
  console.log(`P99.9: ${p999.toExponential(10)}`);
  console.log(`Worst-Case Input: [${[randInput[worstIdx*6+3], randInput[worstIdx*6+4], randInput[worstIdx*6+5]].join(', ')}]`);
  console.log(`Normal Accuracy: ${rmsError < ACCEPTABLE_RMS_ERROR ? 'PASS' : 'FAIL'} (Threshold: ${ACCEPTABLE_RMS_ERROR})`);
  console.log(`Singularity Contract: ${singPassed ? 'PASS' : 'FAIL'} (Status=1, C=0)`);
  console.log(`Overall: ${decision}`);
}

run().catch(console.error);
