import initOpenCascade from 'opencascade.js/dist/opencascade.wasm.js';

export async function loadOcct() {
  // Browser detection
  if (typeof window !== 'undefined') {
    return initOpenCascade({
      locateFile: (file: string) => `https://unpkg.com/opencascade.js@1.1.1/dist/${file}`
    });
  }

  // Node.js detection
  const fs = await import('fs');
  const path = await import('path');
  
  // Polyfill for Emscripten Node.js compatibility
  if (typeof global !== 'undefined' && !global.__dirname) {
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    global.__dirname = __dirname;
    global.__filename = __filename;
  }

  const wasmPath = path.resolve(process.cwd(), 'node_modules/opencascade.js/dist/opencascade.wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  
  return initOpenCascade({
    wasmBinary
  });
}
