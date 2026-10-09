/**
 * LinearAlgebraComparisonEngine.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Independent CPU Reference Implementation & Rigorous Numerical Equivalence Engine
 */

import {
  CSRMatrixData,
  LinearAlgebraComparisonResult,
  LinearAlgebraOpType,
} from './GPULinearAlgebraTypes';
import { NumericalTolerancePolicy } from '../WebGPUComputeTypes';

export class LinearAlgebraComparisonEngine {
  /**
   * Operation-specific standard numerical tolerance policies
   */
  public static getTolerancePolicy(op: LinearAlgebraOpType): NumericalTolerancePolicy {
    switch (op) {
      case 'VECTOR_ADD':
      case 'VECTOR_SCALE':
      case 'AXPY':
      case 'MATRIX_ADD':
      case 'MATRIX_SCALE':
      case 'MATRIX_TRANSPOSE':
      case 'SPARSE_SCALE':
        return {
          absoluteTolerance: 1e-6,
          relativeTolerance: 1e-5,
          description: 'Standard IEEE-754 single precision float arithmetic tolerance',
        };

      case 'ELEMENT_WISE_MUL':
      case 'ELEMENT_WISE_DIV':
      case 'DIAGONAL_SCALE':
        return {
          absoluteTolerance: 1e-5,
          relativeTolerance: 1e-4,
          description: 'Multiplication and division float tolerance with condition guarding',
        };

      case 'DOT_PRODUCT':
      case 'L2_NORM':
      case 'INFINITY_NORM':
      case 'REDUCE_SUM':
      case 'REDUCE_MIN':
      case 'REDUCE_MAX':
        return {
          absoluteTolerance: 5e-4,
          relativeTolerance: 1e-4,
          allowReductionOrderDrift: true,
          description: 'Parallel tree reduction associativity drift allowance',
        };

      case 'MATVEC':
      case 'SPMV_CSR':
        return {
          absoluteTolerance: 1e-4,
          relativeTolerance: 1e-4,
          description: 'Accumulated dot product inner loop tolerance for sparse/dense matrix-vector',
        };

      case 'MATMUL':
        return {
          absoluteTolerance: 2e-4,
          relativeTolerance: 2e-4,
          description: 'Dense matrix multiplication inner product accumulation tolerance',
        };

      case 'SPARSE_ADD':
      case 'EXTRACT_DIAGONAL':
      case 'GATHER':
      case 'SCATTER':
      default:
        return {
          absoluteTolerance: 1e-6,
          relativeTolerance: 1e-5,
          description: 'Standard structural memory/index operation tolerance',
        };
    }
  }

  // ==========================================
  // CPU INDEPENDENT REFERENCE IMPLEMENTATIONS
  // ==========================================

  public static cpuVectorAdd(a: Float32Array, b: Float32Array): Float32Array {
    const len = Math.min(a.length, b.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = a[i] + b[i];
    }
    return out;
  }

  public static cpuVectorScale(a: Float32Array, alpha: number): Float32Array {
    const len = a.length;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = a[i] * alpha;
    }
    return out;
  }

  public static cpuAXPY(alpha: number, x: Float32Array, y: Float32Array): Float32Array {
    const len = Math.min(x.length, y.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = alpha * x[i] + y[i];
    }
    return out;
  }

  public static cpuElementWiseMul(a: Float32Array, b: Float32Array): Float32Array {
    const len = Math.min(a.length, b.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = a[i] * b[i];
    }
    return out;
  }

  public static cpuElementWiseDiv(a: Float32Array, b: Float32Array): Float32Array {
    const len = Math.min(a.length, b.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const denom = b[i];
      out[i] = Math.abs(denom) < 1e-30 ? 0.0 : a[i] / denom;
    }
    return out;
  }

  public static cpuDotProduct(x: Float32Array, y: Float32Array): number {
    const len = Math.min(x.length, y.length);
    let dot = 0.0;
    for (let i = 0; i < len; i++) {
      dot += x[i] * y[i];
    }
    return dot;
  }

  public static cpuL2Norm(x: Float32Array): number {
    let sumSq = 0.0;
    for (let i = 0; i < x.length; i++) {
      sumSq += x[i] * x[i];
    }
    return Math.sqrt(sumSq);
  }

  public static cpuInfinityNorm(x: Float32Array): number {
    let maxVal = 0.0;
    for (let i = 0; i < x.length; i++) {
      const absVal = Math.abs(x[i]);
      if (absVal > maxVal) {
        maxVal = absVal;
      }
    }
    return maxVal;
  }

  public static cpuReduceSum(x: Float32Array): number {
    let sum = 0.0;
    for (let i = 0; i < x.length; i++) {
      sum += x[i];
    }
    return sum;
  }

  public static cpuReduceMin(x: Float32Array): number {
    if (x.length === 0) return 0;
    let minVal = x[0];
    for (let i = 1; i < x.length; i++) {
      if (x[i] < minVal) minVal = x[i];
    }
    return minVal;
  }

  public static cpuReduceMax(x: Float32Array): number {
    if (x.length === 0) return 0;
    let maxVal = x[0];
    for (let i = 1; i < x.length; i++) {
      if (x[i] > maxVal) maxVal = x[i];
    }
    return maxVal;
  }

  public static cpuDenseMatVec(
    matrixA: Float32Array,
    vectorX: Float32Array,
    rows: number,
    cols: number
  ): Float32Array {
    const out = new Float32Array(rows);
    for (let r = 0; r < rows; r++) {
      let sum = 0.0;
      for (let c = 0; c < cols; c++) {
        sum += matrixA[r * cols + c] * vectorX[c];
      }
      out[r] = sum;
    }
    return out;
  }

  public static cpuDenseMatMul(
    matA: Float32Array,
    matB: Float32Array,
    M: number,
    K: number,
    N: number
  ): Float32Array {
    const matC = new Float32Array(M * N);
    for (let r = 0; r < M; r++) {
      for (let c = 0; c < N; c++) {
        let sum = 0.0;
        for (let k = 0; k < K; k++) {
          sum += matA[r * K + k] * matB[k * N + c];
        }
        matC[r * N + c] = sum;
      }
    }
    return matC;
  }

  public static cpuDenseMatrixTranspose(matA: Float32Array, rows: number, cols: number): Float32Array {
    const out = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out[c * rows + r] = matA[r * cols + c];
      }
    }
    return out;
  }

  public static cpuCSRSpMV(csr: CSRMatrixData, vectorX: Float32Array): Float32Array {
    const { rows, values, columnIndices, rowPointers } = csr;
    const y = new Float32Array(rows);

    for (let r = 0; r < rows; r++) {
      const start = rowPointers[r];
      const end = rowPointers[r + 1];
      let sum = 0.0;
      for (let idx = start; idx < end; idx++) {
        const col = columnIndices[idx];
        sum += values[idx] * vectorX[col];
      }
      y[r] = sum;
    }

    return y;
  }

  public static cpuDiagonalScale(
    vectorX: Float32Array,
    diagonal: Float32Array
  ): Float32Array {
    const len = Math.min(vectorX.length, diagonal.length);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const d = diagonal[i];
      out[i] = Math.abs(d) < 1e-30 ? 0.0 : vectorX[i] / d;
    }
    return out;
  }

  public static cpuGather(source: Float32Array, indices: Uint32Array): Float32Array {
    const out = new Float32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      out[i] = idx < source.length ? source[idx] : 0.0;
    }
    return out;
  }

  public static cpuScatter(
    values: Float32Array,
    indices: Uint32Array,
    targetLength: number
  ): Float32Array {
    const out = new Float32Array(targetLength);
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx < targetLength) {
        out[idx] += values[i];
      }
    }
    return out;
  }

  // ==========================================
  // COMPARISON & VERIFICATION ENGINE
  // ==========================================

  public static compareVectors(
    op: LinearAlgebraOpType,
    actualGPU: Float32Array | number[],
    expectedCPU: Float32Array | number[],
    policy?: NumericalTolerancePolicy,
    cpuDurationMs = 0,
    gpuDurationMs = 0
  ): LinearAlgebraComparisonResult {
    const activePolicy = policy || this.getTolerancePolicy(op);
    const len = Math.min(actualGPU.length, expectedCPU.length);

    let maxAbsErr = 0;
    let maxRelErr = 0;
    let sumSqErr = 0;
    let cpuNormSq = 0;
    const driftSamples: Array<{ index: number; gpuVal: number; cpuVal: number; absDiff: number }> = [];

    for (let i = 0; i < len; i++) {
      const g = actualGPU[i];
      const c = expectedCPU[i];

      if (Number.isNaN(g) && Number.isNaN(c)) continue;
      if (!Number.isFinite(g) && !Number.isFinite(c) && Math.sign(g) === Math.sign(c)) continue;

      const diff = Math.abs(g - c);
      if (diff > maxAbsErr) maxAbsErr = diff;

      const denom = Math.max(Math.abs(c), 1e-12);
      const relDiff = diff / denom;
      if (relDiff > maxRelErr) maxRelErr = relDiff;

      sumSqErr += diff * diff;
      cpuNormSq += c * c;

      if (diff > activePolicy.absoluteTolerance && driftSamples.length < 8) {
        driftSamples.push({ index: i, gpuVal: g, cpuVal: c, absDiff: diff });
      }
    }

    const mse = len > 0 ? sumSqErr / len : 0;
    const l2RelErr = cpuNormSq > 1e-18 ? Math.sqrt(sumSqErr) / Math.sqrt(cpuNormSq) : Math.sqrt(sumSqErr);

    const passed =
      maxAbsErr <= activePolicy.absoluteTolerance ||
      maxRelErr <= activePolicy.relativeTolerance ||
      l2RelErr <= activePolicy.relativeTolerance;

    return {
      verified: true,
      operation: op,
      maxAbsoluteError: maxAbsErr,
      maxRelativeError: maxRelErr,
      l2RelativeError: l2RelErr,
      meanSquaredError: mse,
      elementsChecked: len,
      passedTolerance: passed,
      cpuReferenceDurationMs: cpuDurationMs,
      gpuExecutionDurationMs: gpuDurationMs,
      driftSamples,
    };
  }

  public static compareScalars(
    op: LinearAlgebraOpType,
    actualGPU: number,
    expectedCPU: number,
    policy?: NumericalTolerancePolicy,
    cpuDurationMs = 0,
    gpuDurationMs = 0
  ): LinearAlgebraComparisonResult {
    const activePolicy = policy || this.getTolerancePolicy(op);
    const diff = Math.abs(actualGPU - expectedCPU);
    const denom = Math.max(Math.abs(expectedCPU), 1e-12);
    const relDiff = diff / denom;

    const passed = diff <= activePolicy.absoluteTolerance || relDiff <= activePolicy.relativeTolerance;

    return {
      verified: true,
      operation: op,
      maxAbsoluteError: diff,
      maxRelativeError: relDiff,
      l2RelativeError: relDiff,
      meanSquaredError: diff * diff,
      elementsChecked: 1,
      passedTolerance: passed,
      cpuReferenceDurationMs: cpuDurationMs,
      gpuExecutionDurationMs: gpuDurationMs,
      driftSamples: diff > activePolicy.absoluteTolerance
        ? [{ index: 0, gpuVal: actualGPU, cpuVal: expectedCPU, absDiff: diff }]
        : [],
    };
  }
}
