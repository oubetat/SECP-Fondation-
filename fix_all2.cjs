const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

// Replace code0, 1, 2
let idx = content.indexOf('const code0Body');
let idxNext = content.indexOf('const code3Body');
if (idx !== -1 && idxNext !== -1) {
  content = content.substring(0, idx) +
    'const code0Body = [0x00, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b];\n' +
    '    const code1Body = [0x00, 0x0b];\n' +
    '    const code2Body = [0x00, 0x0b];\n\n    ' +
    content.substring(idxNext);
}

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
