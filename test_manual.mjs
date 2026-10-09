
import fs from 'fs';
import initOpenCascade from './node_modules/opencascade.js/dist/opencascade.wasm.js';

async function test() {
  console.log('Attempting manual WASM load...');
  try {
    const wasmBuffer = fs.readFileSync('./node_modules/opencascade.js/dist/opencascade.wasm.wasm');
    const oc = await initOpenCascade({
      wasmBinary: wasmBuffer
    });
    console.log('Success! OCCT Loaded manually.');
    process.exit(0);
  } catch (err) {
    console.error('Failed manual load:', err);
    process.exit(1);
  }
}

test();
