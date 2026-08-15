import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Native approximations from engineering_kernels.c
const PI_C = 3.14159265358979323846;
const HALF_PI_C = 1.57079632679489661923;
const RAD_TO_DEG_C = 180.0 / PI_C;

function native_sin(x: number): number {
    let val = x;
    if (val > PI_C) {
        while (val > PI_C) val -= 2.0 * PI_C;
    } else if (val < -PI_C) {
        while (val < -PI_C) val += 2.0 * PI_C;
    }
    
    if (val > HALF_PI_C) val = PI_C - val;
    else if (val < -HALF_PI_C) val = -PI_C - val;

    const x2 = val * val;
    return val * (1.0 - x2/6.0 + (x2*x2)/120.0 - (x2*x2*x2)/5040.0 + (x2*x2*x2*x2)/362880.0);
}

function native_atan(x: number): number {
    const absX = Math.abs(x);
    if (absX < 0.1) {
        const x2 = x * x;
        return x * (1.0 - x2/3.0 + (x2*x2)/5.0 - (x2*x2*x2)/7.0);
    }
    return x / (1.0 + 0.28086 * x * x);
}

function native_atan2(y: number, x: number): number {
    if (x === 0.0) {
        if (y > 0.0) return HALF_PI_C;
        if (y < 0.0) return -HALF_PI_C;
        return 0.0;
    }
    
    let atanVal: number;
    if (Math.abs(x) >= Math.abs(y)) {
        atanVal = native_atan(y / x);
        if (x < 0.0) {
            if (y >= 0.0) return atanVal + PI_C;
            return atanVal - PI_C;
        }
        return atanVal;
    } else {
        atanVal = native_atan(x / y);
        if (y > 0.0) return HALF_PI_C - atanVal;
        return -HALF_PI_C - atanVal;
    }
}

function native_acos(x: number): number {
    if (x > 1.0 || x < -1.0) return NaN;
    if (x === 1.0) return 0.0;
    if (x === -1.0) return PI_C;
    return native_atan2(Math.sqrt(1.0 - x * x), x);
}

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
  const wasmMemory = (exports.memory as WebAssembly.Memory);
  const memF64 = new Float64Array(wasmMemory.buffer);

  async function compareCase(name: string, x: number, y: number, z: number, vi: number, vj: number, vk: number) {
    console.log(`\n================================================================`);
    console.log(`FORENSIC ANALYSIS: ${name}`);
    console.log(`================================================================`);
    
    const inputs = new Float64Array([x, y, z, vi, vj, vk]);
    const nPoints = 1; // Explicitly set to 1
    const inPtr = 10240;
    const outPtr = 20480;

    memF64.set(inputs, inPtr / 8);
    exports.native_cam_5axis_bulk(nPoints, inPtr, outPtr);
    const rawOutput = memF64.slice(outPtr / 8, (outPtr / 8) + 6);

    const norm = Math.sqrt(vi*vi + vj*vj + vk*vk);
    const k_val = vk;
    const acos_in = Math.max(-1, Math.min(1, vk));
    
    // TS Implementation
    const tsA_rad = Math.acos(acos_in);
    const tsA_deg = tsA_rad * (180.0 / Math.PI);
    const tsC_rad = Math.atan2(vj, vi);
    const tsC_deg = tsC_rad * (180.0 / Math.PI);

    // Native SIMULATION Implementation
    const simA_rad = native_acos(acos_in);
    const simA_deg = simA_rad * RAD_TO_DEG_C;
    const simC_rad = native_atan2(vj, vi);
    const simC_deg = simC_rad * RAD_TO_DEG_C;

    // Actual WASM results
    const wasmA = rawOutput[3];
    const wasmC = rawOutput[4];
    const wasmStatus = rawOutput[5];

    console.log(`1. Vector Norm:            ${norm.toPrecision(17)}`);
    console.log(`2. k (input):              ${k_val.toPrecision(17)}`);
    console.log(`3. acos input:             ${acos_in.toPrecision(17)}`);
    console.log(`4. acos result (rad):`);
    console.log(`   - TS (Math.acos):       ${tsA_rad.toPrecision(17)}`);
    console.log(`   - Native (SIM):         ${simA_rad.toPrecision(17)}`);
    console.log(`   - WASM (Actual):        (See degrees)`);
    console.log(`5. A degrees:`);
    console.log(`   - TS Reference:         ${tsA_deg.toPrecision(17)}`);
    console.log(`   - Native SIM:           ${simA_deg.toPrecision(17)}`);
    console.log(`   - WASM Actual:          ${wasmA.toPrecision(17)}`);
    console.log(`6. atan2 numerator (vj):   ${vj.toPrecision(17)}`);
    console.log(`7. atan2 denominator (vi): ${vi.toPrecision(17)}`);
    console.log(`8. atan2 result (rad):`);
    console.log(`   - TS (Math.atan2):      ${tsC_rad.toPrecision(17)}`);
    console.log(`   - Native (SIM):         ${simC_rad.toPrecision(17)}`);
    console.log(`9. C degrees:`);
    console.log(`   - TS Reference:         ${tsC_deg.toPrecision(17)}`);
    console.log(`   - Native SIM:           ${simC_deg.toPrecision(17)}`);
    console.log(`   - WASM Actual:          ${wasmC.toPrecision(17)}`);
    console.log(`10. Constants:`);
    console.log(`    - TS Math.PI:          ${Math.PI.toPrecision(17)}`);
    console.log(`    - C PI:                ${PI_C.toPrecision(17)}`);
    console.log(`    - C RAD_TO_DEG:        ${RAD_TO_DEG_C.toPrecision(17)}`);
    
    console.log(`11. Native status (idx 5): ${wasmStatus.toPrecision(17)}`);
    console.log(`12. Delta A (WASM - TS):   ${Math.abs(wasmA - tsA_deg).toPrecision(17)}`);
    console.log(`13. Delta C (WASM - TS):   ${Math.abs(wasmC - tsC_deg).toPrecision(17)}`);
    
    // Policy check for Singularity
    const singularity_threshold = 1e-12;
    const is_singular = Math.abs(vi) < singularity_threshold && Math.abs(vj) < singularity_threshold;
    console.log(`14. Singularity Policy:`);
    console.log(`    - Threshold:           ${singularity_threshold.toExponential(1)}`);
    console.log(`    - Is Singular:         ${is_singular}`);
    console.log(`    - C status:            ${wasmStatus}`);
  }

  // Case 1: Normal
  await compareCase("Case 1: Normal", 10, 20, 30, 0.7305844244039971, 0.4023051201726789, -0.5517218403336295);

  // Case 2: Near -Z
  await compareCase("Case 2: Near -Z Orient", 0, 0, 0, 1e-15, 1e-15, -1.0);
}

run().catch(console.error);
