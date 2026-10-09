/**
 * GPULinearAlgebraBenchmark.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Transfer-Aware Benchmarking Suite for Dense GEMV, GEMM, Sparse CSR SpMV,
 * Parallel Reductions, Vector Math and Preconditioning.
 */

import { GPULinearAlgebraBackend } from './GPULinearAlgebraBackend';
import { LinearAlgebraBenchmarkMetric, LinearAlgebraOpType } from './GPULinearAlgebraTypes';
import { GPUSparseMatrixHelper } from './GPUSparseMatrix';

export interface LinearAlgebraBenchmarkReport {
  timestamp: string;
  hardwareDevice: string;
  totalBenchmarks: number;
  results: LinearAlgebraBenchmarkMetric[];
  summary: {
    maxGFLOPS: number;
    highestSpeedup: number;
    averageTransferOverheadPercent: number;
    allNumericallyEquivalent: boolean;
  };
}

export class GPULinearAlgebraBenchmark {
  /**
   * Executes full suite of linear algebra benchmarks across vector, dense and sparse operations
   */
  public static async runBenchmarkSuite(): Promise<LinearAlgebraBenchmarkReport> {
    const backend = new GPULinearAlgebraBackend('AUTO');
    const results: LinearAlgebraBenchmarkMetric[] = [];

    // Helper to generate deterministic vectors
    const createVector = (len: number, scale = 1.0): Float32Array => {
      const v = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        v[i] = Math.sin(i * 0.1) * scale + 0.5;
      }
      return v;
    };

    // 1. Vector AXPY (N = 65,536)
    {
      const N = 65536;
      const x = createVector(N, 2.0);
      const y = createVector(N, 1.5);
      const alpha = 2.718;

      const res = await backend.axpy(alpha, x, y);
      const flopCount = 2 * N; // 1 mult + 1 add per element
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = N * 4 * 3; // 2 reads + 1 write
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-axpy-64k',
        operation: 'AXPY',
        datasetName: 'Vector AXPY (y = alpha*x + y)',
        sizeDescription: '65,536 Elements',
        dimensions: { length: N },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 2. Parallel Dot Product Reduction (N = 100,000)
    {
      const N = 100000;
      const x = createVector(N, 1.0);
      const y = createVector(N, 0.8);

      const res = await backend.dotProduct(x, y);
      const flopCount = 2 * N;
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = N * 4 * 2;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-dot-100k',
        operation: 'DOT_PRODUCT',
        datasetName: 'Parallel Dot Product Tree Reduction',
        sizeDescription: '100,000 Elements',
        dimensions: { length: N },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 3. Dense Matrix-Vector GEMV (Rows = 512, Cols = 512)
    {
      const M = 512;
      const K = 512;
      const mat = createVector(M * K, 0.5);
      const x = createVector(K, 1.2);

      const res = await backend.matVec(mat, x, M, K);
      const flopCount = 2 * M * K;
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = (M * K + K + M) * 4;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-gemv-512',
        operation: 'MATVEC',
        datasetName: 'Dense Matrix-Vector Product (GEMV)',
        sizeDescription: `${M}x${K} Matrix (${(M * K).toLocaleString()} elements)`,
        dimensions: { rows: M, cols: K },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 4. Dense Matrix-Matrix Multiplication GEMM (128 x 128 x 128)
    {
      const M = 128;
      const K = 128;
      const N = 128;
      const matA = createVector(M * K, 0.4);
      const matB = createVector(K * N, 0.6);

      const res = await backend.matMul(matA, matB, M, K, N);
      const flopCount = 2 * M * K * N;
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = (M * K + K * N + M * N) * 4;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-gemm-128',
        operation: 'MATMUL',
        datasetName: 'Dense Matrix Multiplication (GEMM)',
        sizeDescription: `${M}x${K} * ${K}x${N} Matrix (${flopCount.toLocaleString()} FLOPs)`,
        dimensions: { rows: M, cols: N },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 5. Sparse CSR SpMV on FEM Structural Stiffness Matrix (2000 DOF)
    {
      const numNodes = 1000;
      const femCSR = GPUSparseMatrixHelper.generateFEMStiffnessCSR(numNodes, 2);
      const x = createVector(femCSR.columns, 1.0);

      const res = await backend.spmv(femCSR, x);
      const flopCount = 2 * femCSR.nnz;
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = femCSR.nnz * (4 + 4) + (femCSR.rows + 1) * 4 + (femCSR.columns + femCSR.rows) * 4;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-fem-spmv-2k',
        operation: 'SPMV_CSR',
        datasetName: 'FEM Structural Stiffness CSR SpMV',
        sizeDescription: `${femCSR.rows}x${femCSR.columns} DOF, ${femCSR.nnz.toLocaleString()} NNZ (${((1 - femCSR.nnz / (femCSR.rows * femCSR.columns)) * 100).toFixed(2)}% sparse)`,
        dimensions: { rows: femCSR.rows, cols: femCSR.columns, nnz: femCSR.nnz },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 6. Sparse CSR SpMV on CFD 2D Poisson 5-point Laplacian (2500 Cells)
    {
      const gridSize = 50;
      const poissonCSR = GPUSparseMatrixHelper.generatePoisson2DCSR(gridSize);
      const x = createVector(poissonCSR.columns, 1.5);

      const res = await backend.spmv(poissonCSR, x);
      const flopCount = 2 * poissonCSR.nnz;
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = poissonCSR.nnz * (4 + 4) + (poissonCSR.rows + 1) * 4 + (poissonCSR.columns + poissonCSR.rows) * 4;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-cfd-spmv-2500',
        operation: 'SPMV_CSR',
        datasetName: 'CFD 2D Poisson 5-Point Laplacian CSR SpMV',
        sizeDescription: `${poissonCSR.rows}x${poissonCSR.columns} Cells, ${poissonCSR.nnz.toLocaleString()} NNZ`,
        dimensions: { rows: poissonCSR.rows, cols: poissonCSR.columns, nnz: poissonCSR.nnz },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // 7. Diagonal Scaling Preconditioner (N = 65,536)
    {
      const N = 65536;
      const x = createVector(N, 5.0);
      const diag = createVector(N, 2.0);
      for (let i = 0; i < N; i++) diag[i] += 1.0; // Ensure non-zero diagonal

      const res = await backend.diagonalScale(x, diag);
      const flopCount = N; // 1 division per element
      const gflops = res.timing.computeMs > 0 ? (flopCount / (res.timing.computeMs * 1e-3)) / 1e9 : 0;
      const totalBytes = N * 4 * 3;
      const bandwidthGBs = res.timing.totalMs > 0 ? (totalBytes / (res.timing.totalMs * 1e-3)) / 1e9 : 0;
      const cpuTime = Math.max(0.01, res.comparison.cpuReferenceDurationMs);
      const gpuTime = Math.max(0.01, res.timing.totalMs);

      results.push({
        benchmarkId: 'bench-diag-scale-64k',
        operation: 'DIAGONAL_SCALE',
        datasetName: 'Diagonal Scaling Preconditioner (Jacobi)',
        sizeDescription: '65,536 Elements',
        dimensions: { length: N },
        cpuTimeMs: cpuTime,
        gpuUploadMs: res.timing.uploadMs,
        gpuComputeMs: res.timing.computeMs,
        gpuReadbackMs: res.timing.readbackMs,
        gpuTotalMs: gpuTime,
        speedupTotal: cpuTime / gpuTime,
        speedupComputeOnly: cpuTime / Math.max(0.001, res.timing.computeMs),
        transferOverheadPercent: res.timing.transferOverheadPercent,
        gflops,
        bandwidthGBs,
        numericallyEquivalent: res.comparison.passedTolerance,
        maxAbsDiff: res.comparison.maxAbsoluteError,
      });
    }

    // Summary calculations
    let maxGFLOPS = 0;
    let maxSpeedup = 0;
    let sumOverhead = 0;
    let allEquivalent = true;

    for (const r of results) {
      if (r.gflops > maxGFLOPS) maxGFLOPS = r.gflops;
      if (r.speedupTotal > maxSpeedup) maxSpeedup = r.speedupTotal;
      sumOverhead += r.transferOverheadPercent;
      if (!r.numericallyEquivalent) allEquivalent = false;
    }

    return {
      timestamp: new Date().toISOString(),
      hardwareDevice: 'Hardware WebGPU / Host Math Core',
      totalBenchmarks: results.length,
      results,
      summary: {
        maxGFLOPS,
        highestSpeedup: maxSpeedup,
        averageTransferOverheadPercent: results.length > 0 ? sumOverhead / results.length : 0,
        allNumericallyEquivalent: allEquivalent,
      },
    };
  }
}
