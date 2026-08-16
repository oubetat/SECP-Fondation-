const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

// Force loadRealWasm to return null
content = content.replace(
  /private static async loadRealWasm\(\): Promise<Uint8Array \| null> \{[\s\S]*?\}/,
  `private static async loadRealWasm(): Promise<Uint8Array | null> { return null; }`
);

// Replace code0, code1, code2 with valid dummies
content = content.replace(
  /const code0Body = \[[\s\S]*?\/\/\/ 2 local f64s[\s\S]*?0x0b\s*\];/,
  `const code0Body = [0x00, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0b];`
);

content = content.replace(
  /const code1Body = \[[\s\S]*?0x0b\s*\];/,
  `const code1Body = [0x00, 0x0b];`
);

content = content.replace(
  /const code2Body = \[[\s\S]*?0x0b\s*\];/,
  `const code2Body = [0x00, 0x0b];`
);

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
