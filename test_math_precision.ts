
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
            abort: () => { throw new Error('Abort'); }
        }
    });

    const exports = result.instance.exports as any;
    
    function benchmark(name: string, nativeFunc: (x: number) => number, refFunc: (x: number) => number, range: [number, number], points: number) {
        console.log(`\n--- Benchmarking ${name} ---`);
        let maxAbsErr = 0;
        let totalSqErr = 0;
        let worstInput = 0;
        const errors: number[] = [];

        for (let i = 0; i < points; i++) {
            const x = range[0] + (range[1] - range[0]) * (i / (points - 1));
            const actual = nativeFunc(x);
            const expected = refFunc(x);
            
            if (isNaN(actual) && isNaN(expected)) continue;
            
            const err = Math.abs(actual - expected);
            errors.push(err);
            totalSqErr += err * err;
            if (err > maxAbsErr) {
                maxAbsErr = err;
                worstInput = x;
            }
        }

        errors.sort((a, b) => a - b);
        const rms = Math.sqrt(totalSqErr / points);
        console.log(`Points: ${points}`);
        console.log(`Max Abs Error: ${maxAbsErr.toExponential(10)} at x=${worstInput}`);
        console.log(`RMS Error:     ${rms.toExponential(10)}`);
        console.log(`P95:           ${errors[Math.floor(0.95 * points)].toExponential(10)}`);
        console.log(`P99:           ${errors[Math.floor(0.99 * points)].toExponential(10)}`);
    }

    benchmark('native_sin', exports.test_native_sin, Math.sin, [-Math.PI, Math.PI], 100000);
    benchmark('native_acos', exports.test_native_acos, Math.acos, [-1, 1], 100000);
    
    // For atan2, we test with x=1 and varying y
    benchmark('native_atan2(y, 1)', (y) => exports.test_native_atan2(y, 1.0), (y) => Math.atan2(y, 1.0), [-10, 10], 100000);
}

run().catch(console.error);
