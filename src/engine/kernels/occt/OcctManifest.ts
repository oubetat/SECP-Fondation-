import { KernelManifest } from '../../geometry/GeometryTypes';

export const OCCT_MANIFEST: KernelManifest = {
  kernel: 'OCCT',
  binding: 'opencascade.js',
  version: '1.1.1',
  buildId: 'occt-7.6.0-wasm-simd',
  wasmChecksum: 'sha256-42d48074bf83321bf2ab86f78bc6ebc4', // Example valid checksum format
  runtimeMode: 'WASM',
  mockFallback: false,
  capabilities: ['BRep', 'STEP', 'IGES', 'Boolean', 'Fillet', 'Chamfer', 'Sketch']
};
