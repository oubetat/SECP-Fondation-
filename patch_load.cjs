const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

content = content.replace(
  /const response = await fetch\('\/wasm\/engineering_kernels.wasm'\);/,
  `
      let buffer;
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        buffer = require('fs').readFileSync('public/wasm/engineering_kernels.wasm');
      } else {
        const response = await fetch('/wasm/engineering_kernels.wasm');
        if (!response.ok) return null;
        buffer = await response.arrayBuffer();
      }
  `
);

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
