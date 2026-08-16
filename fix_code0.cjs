const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');
content = content.replace(
  /0x01, 0x02, 0x7c, \/\/ 2 local f64s \(sum, i\)/,
  '0x02, 0x01, 0x7c, 0x01, 0x7f, // 1 f64 (sum), 1 i32 (i)'
);
fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
