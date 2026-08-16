const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

// Replace ...encodeLEB128Unsigned(256) // Max 256 pages
content = content.replace(
  /\.\.\.encodeLEB128Unsigned\(256\) \/\/ Max 256 pages/,
  '...encodeLEB128Unsigned(512) // Max 512 pages'
);

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
