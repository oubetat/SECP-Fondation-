
const fs = require('fs');
const initOpenCascade = require('./node_modules/opencascade.js/dist/opencascade.wasm.js');

async function test() {
  console.log('Attempting manual WASM load (CJS)...');
  try {
    const wasmBuffer = fs.readFileSync('./node_modules/opencascade.js/dist/opencascade.wasm.wasm');
    const oc = await initOpenCascade({
      wasmBinary: wasmBuffer
    });
    console.log('Success! OCCT Loaded manually (CJS).');
    
    // Test Box
    console.log('Testing Box creation...');
    const box = new oc.BRepPrimAPI_MakeBox_2(100, 100, 100);
    const shape = box.Shape();
    console.log('Shape is valid:', !shape.IsNull());
    
    process.exit(0);
  } catch (err) {
    console.error('Failed manual load (CJS):', err);
    process.exit(1);
  }
}

test();
