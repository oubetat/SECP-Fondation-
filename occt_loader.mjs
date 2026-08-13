
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initOpenCascade from './node_modules/opencascade.js/dist/opencascade.wasm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadOcct() {
  const wasmPath = path.resolve(__dirname, 'node_modules/opencascade.js/dist/opencascade.wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  return initOpenCascade({
    wasmBinary
  });
}
