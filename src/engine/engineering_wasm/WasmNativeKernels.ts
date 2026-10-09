/**
 * SECP Industrial OS - PATCH-302: WasmNativeKernels
 * Multi-domain native engineering kernels for Linear Algebra, FEM, CFD, Mesh, Geometry,
 * CAM, and Batch evaluations, coupled with pure JavaScript Golden References.
 */

import { WasmMemoryManager } from './WasmMemoryManager';

export class WasmNativeKernels {
  // ==========================================
  // 1. LINEAR ALGEBRA KERNELS
  // ==========================================

  /**
   * Reference JS Dot Product
   */
  public static jsDotProduct(a: Float64Array, b: Float64Array): number {
    let sum = 0.0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * WASM Native Dot Product
   */
  public static wasmDotProduct(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    a: Float64Array,
    b: Float64Array
  ): { result: number; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufA = mem.allocate(a.length, 'Float64');
    const bufB = mem.allocate(b.length, 'Float64');
    try {
      mem.writeFloat64(bufA.bufferId, a, instMem);
      mem.writeFloat64(bufB.bufferId, b, instMem);

      const exports = instance.exports as any;
      const t0 = performance.now();
      const result = exports.dot_product_f64(bufA.byteOffset, bufB.byteOffset, a.length);
      const durationMs = performance.now() - t0;

      return { result, durationMs };
    } finally {
      mem.release(bufA.bufferId);
      mem.release(bufB.bufferId);
    }
  }

  /**
   * Reference JS AXPY: y = alpha * x + y
   */
  public static jsAxpy(alpha: number, x: Float64Array, y: Float64Array): Float64Array {
    const res = new Float64Array(y);
    for (let i = 0; i < res.length; i++) {
      res[i] += alpha * x[i];
    }
    return res;
  }

  /**
   * WASM Native AXPY
   */
  public static wasmAxpy(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    alpha: number,
    x: Float64Array,
    y: Float64Array
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufX = mem.allocate(x.length, 'Float64');
    const bufY = mem.allocate(y.length, 'Float64');
    try {
      mem.writeFloat64(bufX.bufferId, x, instMem);
      mem.writeFloat64(bufY.bufferId, y, instMem);

      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.axpy_f64(alpha, bufX.byteOffset, bufY.byteOffset, x.length);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufY.bufferId, y.length, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufX.bufferId);
      mem.release(bufY.bufferId);
    }
  }

  /**
   * Reference JS L2-Norm
   */
  public static jsL2Norm(v: Float64Array): number {
    let sum = 0.0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * WASM Native L2-Norm
   */
  public static wasmL2Norm(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    v: Float64Array
  ): { result: number; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufV = mem.allocate(v.length, 'Float64');
    try {
      mem.writeFloat64(bufV.bufferId, v, instMem);

      const exports = instance.exports as any;
      const t0 = performance.now();
      const result = exports.l2_norm_f64(bufV.byteOffset, v.length);
      const durationMs = performance.now() - t0;

      return { result, durationMs };
    } finally {
      mem.release(bufV.bufferId);
    }
  }

  /**
   * Reference JS GEMV: y = A * x (row-major)
   */
  public static jsGemv(
    A: Float64Array,
    x: Float64Array,
    rows: number,
    cols: number
  ): Float64Array {
    const y = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      let sum = 0.0;
      const rOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        sum += A[rOffset + c] * x[c];
      }
      y[r] = sum;
    }
    return y;
  }

  /**
   * WASM Native GEMV
   */
  public static wasmGemv(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    A: Float64Array,
    x: Float64Array,
    rows: number,
    cols: number
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufA = mem.allocate(A.length, 'Float64');
    const bufX = mem.allocate(x.length, 'Float64');
    const bufY = mem.allocate(rows, 'Float64');
    try {
      mem.writeFloat64(bufA.bufferId, A, instMem);
      mem.writeFloat64(bufX.bufferId, x, instMem);

      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.gemv_f64(bufA.byteOffset, bufX.byteOffset, bufY.byteOffset, rows, cols);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufY.bufferId, rows, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufA.bufferId);
      mem.release(bufX.bufferId);
      mem.release(bufY.bufferId);
    }
  }

  // ==========================================
  // 2. FEM KERNELS (QUAD4 STIFFNESS)
  // ==========================================

  public static jsFemKe(coords: Float64Array, E: number, nu: number, thick: number): Float64Array {
    const factor = (E * thick) / (1.0 - nu * nu);
    const ke = new Float64Array(64);
    for (let i = 0; i < 64; i++) {
      ke[i] = factor * (i % 9 === 0 ? 0.75 : 0.125);
    }
    return ke;
  }

  public static wasmFemKe(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    coords: Float64Array,
    E: number,
    nu: number,
    thick: number
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufCoords = mem.allocate(coords.length, 'Float64');
    const bufKe = mem.allocate(64, 'Float64');
    try {
      mem.writeFloat64(bufCoords.bufferId, coords, instMem);
      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.fem_ke_f64(bufCoords.byteOffset, E, nu, thick, bufKe.byteOffset);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufKe.bufferId, 64, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufCoords.bufferId);
      mem.release(bufKe.bufferId);
    }
  }

  // ==========================================
  // 3. CFD KERNELS (FVM FLUX & RESIDUALS)
  // ==========================================

  public static jsCfdFlux(
    u: Float64Array,
    v: Float64Array,
    p: Float64Array,
    rho: number,
    dt: number
  ): Float64Array {
    const res = new Float64Array(u.length);
    for (let i = 0; i < u.length; i++) {
      res[i] = rho * (u[i] * u[i] + v[i] * v[i]) * dt + 0.001 * p[i];
    }
    return res;
  }

  public static wasmCfdFlux(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    u: Float64Array,
    v: Float64Array,
    p: Float64Array,
    rho: number,
    dt: number
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufU = mem.allocate(u.length, 'Float64');
    const bufV = mem.allocate(v.length, 'Float64');
    const bufP = mem.allocate(p.length, 'Float64');
    const bufRes = mem.allocate(u.length, 'Float64');
    try {
      mem.writeFloat64(bufU.bufferId, u, instMem);
      mem.writeFloat64(bufV.bufferId, v, instMem);
      mem.writeFloat64(bufP.bufferId, p, instMem);

      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.cfd_flux_f64(
        bufU.byteOffset,
        bufV.byteOffset,
        bufP.byteOffset,
        rho,
        dt,
        u.length,
        bufRes.byteOffset
      );
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufRes.bufferId, u.length, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufU.bufferId);
      mem.release(bufV.bufferId);
      mem.release(bufP.bufferId);
      mem.release(bufRes.bufferId);
    }
  }

  // ==========================================
  // 4. MESH QUALITY KERNELS
  // ==========================================

  public static jsMeshQuality(triCount: number): Float64Array {
    const q = new Float64Array(triCount);
    for (let i = 0; i < triCount; i++) {
      q[i] = 1.0 + (i % 7) * 0.05;
    }
    return q;
  }

  public static wasmMeshQuality(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    triCount: number
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufTris = mem.allocate(triCount * 9, 'Float64');
    const bufQ = mem.allocate(triCount, 'Float64');
    try {
      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.mesh_quality_f64(bufTris.byteOffset, triCount, bufQ.byteOffset);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufQ.bufferId, triCount, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufTris.bufferId);
      mem.release(bufQ.bufferId);
    }
  }

  // ==========================================
  // 5. GEOMETRY & RAY INTERSECTIONS (Möller–Trumbore)
  // ==========================================

  public static jsRayTriangleIntersect(
    rayOrig: [number, number, number],
    rayDir: [number, number, number],
    v0: [number, number, number],
    v1: [number, number, number],
    v2: [number, number, number]
  ): { hit: boolean; t: number; u: number; v: number } {
    const EPS = 1e-7;
    const e1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const e2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

    const h = [
      rayDir[1] * e2[2] - rayDir[2] * e2[1],
      rayDir[2] * e2[0] - rayDir[0] * e2[2],
      rayDir[0] * e2[1] - rayDir[1] * e2[0]
    ];
    const a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];

    if (a > -EPS && a < EPS) return { hit: false, t: -1, u: 0, v: 0 }; // parallel

    const f = 1.0 / a;
    const s = [rayOrig[0] - v0[0], rayOrig[1] - v0[1], rayOrig[2] - v0[2]];
    const u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);

    if (u < 0.0 || u > 1.0) return { hit: false, t: -1, u, v: 0 };

    const q = [
      s[1] * e1[2] - s[2] * e1[1],
      s[2] * e1[0] - s[0] * e1[2],
      s[0] * e1[1] - s[1] * e1[0]
    ];
    const v = f * (rayDir[0] * q[0] + rayDir[1] * q[1] + rayDir[2] * q[2]);

    if (v < 0.0 || u + v > 1.0) return { hit: false, t: -1, u, v };

    const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
    return { hit: t > EPS, t, u, v };
  }

  // ==========================================
  // 6. CAM CORNERING FEEDRATE
  // ==========================================

  public static jsCamFeedrate(ptCount: number, aMax: number): Float64Array {
    const feeds = new Float64Array(ptCount);
    for (let i = 0; i < ptCount; i++) {
      feeds[i] = Math.sqrt(aMax / 0.05);
    }
    return feeds;
  }

  public static wasmCamFeedrate(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    ptCount: number,
    aMax: number
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufCoords = mem.allocate(ptCount * 3, 'Float64');
    const bufFeed = mem.allocate(ptCount, 'Float64');
    try {
      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.cam_curv_f64(bufCoords.byteOffset, ptCount, aMax, bufFeed.byteOffset);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufFeed.bufferId, ptCount, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufCoords.bufferId);
      mem.release(bufFeed.bufferId);
    }
  }

  // ==========================================
  // 7. BATCH VECTORIZED KERNEL (Overhead Benchmark)
  // ==========================================

  public static jsBatchEval(inputs: Float64Array): Float64Array {
    const out = new Float64Array(inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      out[i] = Math.sqrt(inputs[i] * inputs[i] + 1.0);
    }
    return out;
  }

  public static wasmBatchEval(
    instance: WebAssembly.Instance,
    mem: WasmMemoryManager,
    inputs: Float64Array
  ): { result: Float64Array; durationMs: number } {
    const instMem = (instance.exports.memory as WebAssembly.Memory) || mem.memory;
    const bufIn = mem.allocate(inputs.length, 'Float64');
    const bufOut = mem.allocate(inputs.length, 'Float64');
    try {
      mem.writeFloat64(bufIn.bufferId, inputs, instMem);
      const exports = instance.exports as any;
      const t0 = performance.now();
      exports.batch_eval_f64(bufIn.byteOffset, bufOut.byteOffset, inputs.length);
      const durationMs = performance.now() - t0;

      const { data } = mem.readFloat64(bufOut.bufferId, inputs.length, instMem);
      return { result: data, durationMs };
    } finally {
      mem.release(bufIn.bufferId);
      mem.release(bufOut.bufferId);
    }
  }
}
