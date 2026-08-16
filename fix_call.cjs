const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

// Find code4Body and replace 0x10, 0x00 with 0x10, 0x04
let start = content.indexOf('const code4Body = [');
let end = content.indexOf('];', start);
if (start !== -1 && end !== -1) {
  let bodyStr = content.substring(start, end + 2);
  let newBodyStr = bodyStr.replace(/0x10, 0x00/g, '0x10, 0x04');
  content = content.substring(0, start) + newBodyStr + content.substring(end + 2);
}

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
