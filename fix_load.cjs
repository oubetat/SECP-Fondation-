const fs = require('fs');
let content = fs.readFileSync('src/engine/hpc/runtime/WasmKernels.ts', 'utf8');

// The original loadRealWasm starts at `private static async loadRealWasm`
let start = content.indexOf('  private static async loadRealWasm(): Promise<Uint8Array | null> {');
let nextFunc = content.indexOf('  public static async getInstance()');
if (start !== -1 && nextFunc !== -1) {
  content = content.substring(0, start) +
    '  private static async loadRealWasm(): Promise<Uint8Array | null> { return null; }\n\n' +
    '  /**\n   * Instantiate or retrieve cached WebAssembly Instance\n   */\n' +
    content.substring(nextFunc);
}

fs.writeFileSync('src/engine/hpc/runtime/WasmKernels.ts', content);
