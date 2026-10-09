export class WasmModuleLoader {
  static initializeSync() { return 'WASM_NATIVE'; }
  static getMemory(): any { return { buffer: new ArrayBuffer(1024*1024) }; }
}
