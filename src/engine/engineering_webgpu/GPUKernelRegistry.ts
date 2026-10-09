/**
 * GPUKernelRegistry.ts
 * Canonical Kernel Registry with WGSL Specifications, CPU Reference Paths, and Numerical Tolerance Policies
 */

import {
  KernelDefinition,
  NumericalVerificationResult,
  NumericalTolerancePolicy,
} from './WebGPUComputeTypes';
import { ComputeShaderManager } from './ComputeShaderManager';

export class GPUKernelRegistry {
  private static kernels: Map<string, KernelDefinition> = new Map();

  static {
    this.registerStandardKernels();
  }

  private static registerStandardKernels() {
    // 1. Vector Addition
    this.registerKernel({
      kernelId: 'VECTOR_ADD',
      name: 'Vector Addition Kernel (A + B)',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('VECTOR_ADD')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('VECTOR_ADD'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Standard IEEE-754 single precision float addition tolerance',
      },
      description: 'Computes C[i] = A[i] + B[i] for arbitrary length vector buffers.',
      cpuReference: (inputs, uniforms) => {
        const a = inputs['inputA'];
        const b = inputs['inputB'];
        const count = uniforms?.['count'] ?? a.length;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = a[i] + b[i];
        }
        return out;
      },
    });

    // 2. Vector Scale
    this.registerKernel({
      kernelId: 'VECTOR_SCALE',
      name: 'Vector Scale Kernel (A * scalar)',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('VECTOR_SCALE')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('VECTOR_SCALE'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Single precision float scaling tolerance',
      },
      description: 'Computes C[i] = A[i] * scaleFactor with scalar uniform.',
      cpuReference: (inputs, uniforms) => {
        const a = inputs['inputA'];
        const scale = uniforms?.['scaleFactor'] ?? 1.0;
        const count = uniforms?.['count'] ?? a.length;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = a[i] * scale;
        }
        return out;
      },
    });

    // 3. Element-wise Multiplication
    this.registerKernel({
      kernelId: 'ELEMENT_WISE_MUL',
      name: 'Element-wise Multiplication Kernel (A * B)',
      version: '1.0.0',
      category: 'ELEMENT_WISE',
      wgslSource: ComputeShaderManager.getShaderSpec('ELEMENT_WISE_MUL')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('ELEMENT_WISE_MUL'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Element-wise multiplication float tolerance',
      },
      description: 'Computes C[i] = A[i] * B[i] for vectors.',
      cpuReference: (inputs, uniforms) => {
        const a = inputs['inputA'];
        const b = inputs['inputB'];
        const count = uniforms?.['count'] ?? a.length;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = a[i] * b[i];
        }
        return out;
      },
    });

    // 4. Parallel Reduction
    this.registerKernel({
      kernelId: 'PARALLEL_REDUCTION',
      name: 'Parallel Tree Reduction (Sum)',
      version: '1.1.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('PARALLEL_REDUCTION')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('PARALLEL_REDUCTION'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 5e-4, // Reduction tree floating point associativity tolerance
        relativeTolerance: 1e-4,
        allowReductionOrderDrift: true,
        description: 'Tree reduction order tolerance allowing non-associative float addition drift',
      },
      description: 'Computes block partial sums using workgroup shared memory trees.',
      cpuReference: (inputs, uniforms) => {
        const data = inputs['inputData'];
        const count = uniforms?.['count'] ?? data.length;
        const numWorkgroups = Math.ceil(count / 64);
        const workgroupSums = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let sum = 0.0;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              sum += data[idx];
            }
          }
          workgroupSums[g] = sum;
        }
        return workgroupSums;
      },
    });

    // 5. Matrix Multiplication
    this.registerKernel({
      kernelId: 'MATRIX_MUL',
      name: 'Dense Matrix Multiplication (A * B)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('MATRIX_MUL')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('MATRIX_MUL'),
      entryPoint: 'main',
      workgroupSize: [8, 8, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-4,
        relativeTolerance: 1e-4,
        description: 'Dot product accumulation float tolerance',
      },
      description: 'Computes C[M x N] = A[M x K] * B[K x N].',
      cpuReference: (inputs, uniforms) => {
        const matA = inputs['matrixA'];
        const matB = inputs['matrixB'];
        const M = uniforms?.['dimM'] ?? 8;
        const K = uniforms?.['dimK'] ?? 8;
        const N = uniforms?.['dimN'] ?? 8;
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
      },
    });

    // 6. Nonlinear Transformation
    this.registerKernel({
      kernelId: 'TRANSFORM_NONLINEAR',
      name: 'Nonlinear Math Transform (Stress Computation)',
      version: '1.0.0',
      category: 'TRANSFORMATION',
      wgslSource: ComputeShaderManager.getShaderSpec('TRANSFORM_NONLINEAR')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('TRANSFORM_NONLINEAR'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-4,
        relativeTolerance: 1e-4,
        description: 'Trigonometric and square-root mathematical approximation tolerance',
      },
      description: 'Computes y = x * scale + sin(x) - cos(x/2) + sqrt(|x| + 1).',
      cpuReference: (inputs, uniforms) => {
        const data = inputs['inputData'];
        const multiplier = uniforms?.['multiplier'] ?? 1.5;
        const count = uniforms?.['count'] ?? data.length;
        const out = new Float32Array(count);

        for (let i = 0; i < count; i++) {
          const x = data[i];
          out[i] = x * multiplier + Math.sin(x) - Math.cos(x * 0.5) + Math.sqrt(Math.abs(x) + 1.0);
        }
        return out;
      },
    });

    // 7. AXPY Kernel (y = alpha * x + y)
    this.registerKernel({
      kernelId: 'AXPY',
      name: 'AXPY Vector Kernel (y = alpha*x + y)',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('AXPY')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('AXPY'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Standard single precision AXPY arithmetic tolerance',
      },
      description: 'Computes y[i] = alpha * x[i] + y[i].',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const y = inputs['inputY'];
        const alpha = uniforms?.['alpha'] ?? 1.0;
        const count = uniforms?.['count'] ?? x.length;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = alpha * x[i] + y[i];
        }
        return out;
      },
    });

    // 8. Element-wise Division Kernel
    this.registerKernel({
      kernelId: 'ELEMENT_WISE_DIV',
      name: 'Element-wise Division Kernel (A / B)',
      version: '1.0.0',
      category: 'ELEMENT_WISE',
      wgslSource: ComputeShaderManager.getShaderSpec('ELEMENT_WISE_DIV')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('ELEMENT_WISE_DIV'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-5,
        relativeTolerance: 1e-4,
        description: 'Guarded float division tolerance',
      },
      description: 'Computes C[i] = A[i] / B[i] with zero-denominator safety.',
      cpuReference: (inputs, uniforms) => {
        const a = inputs['inputA'];
        const b = inputs['inputB'];
        const count = uniforms?.['count'] ?? a.length;
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const denom = b[i];
          out[i] = Math.abs(denom) < 1e-30 ? 0.0 : a[i] / denom;
        }
        return out;
      },
    });

    // 9. Dense Matrix-Vector Product (y = Ax)
    this.registerKernel({
      kernelId: 'MATVEC',
      name: 'Dense Matrix-Vector Product (y = Ax)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('MATVEC')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('MATVEC'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-4,
        relativeTolerance: 1e-4,
        description: 'Dense matrix-vector dot product float tolerance',
      },
      description: 'Computes y[rows] = A[rows x cols] * x[cols].',
      cpuReference: (inputs, uniforms) => {
        const matA = inputs['matrixA'];
        const vecX = inputs['vectorX'];
        const rows = uniforms?.['rows'] ?? 8;
        const cols = uniforms?.['cols'] ?? 8;
        const out = new Float32Array(rows);
        for (let r = 0; r < rows; r++) {
          let sum = 0.0;
          for (let c = 0; c < cols; c++) {
            sum += matA[r * cols + c] * vecX[c];
          }
          out[r] = sum;
        }
        return out;
      },
    });

    // 10. Matrix Transpose (A^T)
    this.registerKernel({
      kernelId: 'MATRIX_TRANSPOSE',
      name: 'Dense Matrix Transpose (A^T)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('MATRIX_TRANSPOSE')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('MATRIX_TRANSPOSE'),
      entryPoint: 'main',
      workgroupSize: [8, 8, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Exact float transposition memory layout tolerance',
      },
      description: 'Computes B[cols x rows] = A[rows x cols]^T.',
      cpuReference: (inputs, uniforms) => {
        const matA = inputs['inputMatrix'];
        const rows = uniforms?.['rows'] ?? 8;
        const cols = uniforms?.['cols'] ?? 8;
        const out = new Float32Array(rows * cols);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            out[c * rows + r] = matA[r * cols + c];
          }
        }
        return out;
      },
    });

    // 11. Sparse CSR Matrix-Vector Product (SpMV: y = Ax)
    this.registerKernel({
      kernelId: 'SPMV_CSR',
      name: 'Sparse CSR Matrix-Vector Product (SpMV: y = Ax)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('SPMV_CSR')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('SPMV_CSR'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-4,
        relativeTolerance: 1e-4,
        description: 'Sparse matrix-vector floating point accumulation tolerance',
      },
      description: 'Computes y[rows] = A_csr[rows x cols] * x[cols].',
      cpuReference: (inputs, uniforms) => {
        const values = inputs['values'];
        const rawColIndices = inputs['columnIndices'];
        const colIndices = new Uint32Array(rawColIndices.buffer, rawColIndices.byteOffset, rawColIndices.length);
        const rawRowPointers = inputs['rowPointers'];
        const rowPointers = new Uint32Array(rawRowPointers.buffer, rawRowPointers.byteOffset, rawRowPointers.length);
        const vecX = inputs['vectorX'];
        const rows = uniforms?.['rows'] ?? (rowPointers.length - 1);
        const cols = uniforms?.['cols'] ?? vecX.length;

        const y = new Float32Array(rows);
        for (let r = 0; r < rows; r++) {
          const start = rowPointers[r];
          const end = rowPointers[r + 1];
          let sum = 0.0;
          for (let idx = start; idx < end; idx++) {
            const c = colIndices[idx];
            if (c < cols) {
              sum += values[idx] * vecX[c];
            }
          }
          y[r] = sum;
        }
        return y;
      },
    });

    // 12. Dot Product
    this.registerKernel({
      kernelId: 'DOT_PRODUCT',
      name: 'Dot Product Reduction Block Kernel',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('DOT_PRODUCT')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('DOT_PRODUCT'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 5e-4,
        relativeTolerance: 1e-4,
        allowReductionOrderDrift: true,
        description: 'Dot product tree reduction float tolerance',
      },
      description: 'Computes workgroup partial sums for x . y.',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const y = inputs['inputY'];
        const count = uniforms?.['count'] ?? Math.min(x.length, y.length);
        const numWorkgroups = Math.ceil(count / 64);
        const blockSums = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let sum = 0.0;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              sum += x[idx] * y[idx];
            }
          }
          blockSums[g] = sum;
        }
        return blockSums;
      },
    });

    // 13. L2 Norm Block Reduction
    this.registerKernel({
      kernelId: 'NORM_L2',
      name: 'L2 Norm Squared Sum Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('NORM_L2')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('NORM_L2'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 5e-4,
        relativeTolerance: 1e-4,
        allowReductionOrderDrift: true,
        description: 'L2 sum squared reduction tree tolerance',
      },
      description: 'Computes workgroup partial sums for sum(x_i^2).',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const count = uniforms?.['count'] ?? x.length;
        const numWorkgroups = Math.ceil(count / 64);
        const blockSums = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let sum = 0.0;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              sum += x[idx] * x[idx];
            }
          }
          blockSums[g] = sum;
        }
        return blockSums;
      },
    });

    // 14. Infinity Norm Block Reduction
    this.registerKernel({
      kernelId: 'NORM_INF',
      name: 'Infinity Norm Max Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('NORM_INF')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('NORM_INF'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Exact float max element tolerance',
      },
      description: 'Computes workgroup maximum of |x_i|.',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const count = uniforms?.['count'] ?? x.length;
        const numWorkgroups = Math.ceil(count / 64);
        const blockMax = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let maxVal = 0.0;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              const absVal = Math.abs(x[idx]);
              if (absVal > maxVal) maxVal = absVal;
            }
          }
          blockMax[g] = maxVal;
        }
        return blockMax;
      },
    });

    // 15. Reduce Min Block
    this.registerKernel({
      kernelId: 'REDUCE_MIN',
      name: 'Minimum Value Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('REDUCE_MIN')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('REDUCE_MIN'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Float minimum element reduction tolerance',
      },
      description: 'Computes workgroup minimum value.',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const count = uniforms?.['count'] ?? x.length;
        const numWorkgroups = Math.ceil(count / 64);
        const blockMin = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let minVal = 1e38;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              if (x[idx] < minVal) minVal = x[idx];
            }
          }
          blockMin[g] = minVal;
        }
        return blockMin;
      },
    });

    // 16. Reduce Max Block
    this.registerKernel({
      kernelId: 'REDUCE_MAX',
      name: 'Maximum Value Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      wgslSource: ComputeShaderManager.getShaderSpec('REDUCE_MAX')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('REDUCE_MAX'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Float maximum element reduction tolerance',
      },
      description: 'Computes workgroup maximum value.',
      cpuReference: (inputs, uniforms) => {
        const x = inputs['inputX'];
        const count = uniforms?.['count'] ?? x.length;
        const numWorkgroups = Math.ceil(count / 64);
        const blockMax = new Float32Array(numWorkgroups);

        for (let g = 0; g < numWorkgroups; g++) {
          let maxVal = -1e38;
          for (let tid = 0; tid < 64; tid++) {
            const idx = g * 64 + tid;
            if (idx < count) {
              if (x[idx] > maxVal) maxVal = x[idx];
            }
          }
          blockMax[g] = maxVal;
        }
        return blockMax;
      },
    });

    // 17. Diagonal Scaling Preconditioner (y = x / diag)
    this.registerKernel({
      kernelId: 'DIAGONAL_SCALE',
      name: 'Diagonal Scaling Preconditioner Kernel',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      wgslSource: ComputeShaderManager.getShaderSpec('DIAGONAL_SCALE')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('DIAGONAL_SCALE'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-5,
        relativeTolerance: 1e-4,
        description: 'Diagonal scaling preconditioner tolerance',
      },
      description: 'Computes y[i] = x[i] / diagonal[i].',
      cpuReference: (inputs, uniforms) => {
        const vecX = inputs['vectorX'];
        const diag = inputs['diagonal'];
        const count = uniforms?.['count'] ?? Math.min(vecX.length, diag.length);
        const out = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const d = diag[i];
          out[i] = Math.abs(d) < 1e-30 ? 0.0 : vecX[i] / d;
        }
        return out;
      },
    });

    // 18. Gather Memory Primitive
    this.registerKernel({
      kernelId: 'GATHER',
      name: 'Gather Memory Primitive Kernel',
      version: '1.0.0',
      category: 'TRANSFORMATION',
      wgslSource: ComputeShaderManager.getShaderSpec('GATHER')?.source || '',
      shaderHash: ComputeShaderManager.getShaderHash('GATHER'),
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
      tolerancePolicy: {
        absoluteTolerance: 1e-6,
        relativeTolerance: 1e-5,
        description: 'Exact memory indexing tolerance',
      },
      description: 'Computes output[i] = sourceData[indices[i]].',
      cpuReference: (inputs, uniforms) => {
        const src = inputs['sourceData'];
        const rawIndices = inputs['indices'];
        const indices = new Uint32Array(rawIndices.buffer, rawIndices.byteOffset, rawIndices.length);
        const indicesCount = uniforms?.['indicesCount'] ?? indices.length;
        const out = new Float32Array(indicesCount);
        for (let i = 0; i < indicesCount; i++) {
          const idx = indices[i];
          out[i] = idx < src.length ? src[idx] : 0.0;
        }
        return out;
      },
    });
  }

  public static registerKernel(kernel: KernelDefinition): void {
    this.kernels.set(kernel.kernelId, kernel);
  }

  public static getKernel(kernelId: string): KernelDefinition | undefined {
    return this.kernels.get(kernelId);
  }

  public static getAllKernels(): KernelDefinition[] {
    return Array.from(this.kernels.values());
  }

  /**
   * Compares GPU results against the CPU reference implementation and tolerance policy
   */
  public static verifyNumericalEquivalence(
    kernelId: string,
    actualOutput: Float32Array,
    inputs: Record<string, Float32Array>,
    uniforms?: Record<string, number>,
    customTolerance?: NumericalTolerancePolicy
  ): NumericalVerificationResult {
    const kernel = this.getKernel(kernelId);
    if (!kernel) {
      return {
        verified: false,
        maxAbsoluteError: 0,
        maxRelativeError: 0,
        meanSquaredError: 0,
        elementsChecked: 0,
        passedTolerance: false,
        cpuReferenceAvailable: false,
        driftSamples: [],
      };
    }

    const cpuRefOutput = kernel.cpuReference(inputs, uniforms);
    const policy = customTolerance || kernel.tolerancePolicy;
    const len = Math.min(actualOutput.length, cpuRefOutput.length);

    let maxAbsErr = 0;
    let maxRelErr = 0;
    let sumSqErr = 0;
    const driftSamples: Array<{ index: number; gpuVal: number; cpuVal: number; absDiff: number }> = [];

    for (let i = 0; i < len; i++) {
      const g = actualOutput[i];
      const c = cpuRefOutput[i];

      // Handle NaN and Infs gracefully
      if (Number.isNaN(g) && Number.isNaN(c)) {
        continue;
      }
      if (!Number.isFinite(g) && !Number.isFinite(c) && Math.sign(g) === Math.sign(c)) {
        continue;
      }

      const absDiff = Math.abs(g - c);
      if (absDiff > maxAbsErr) {
        maxAbsErr = absDiff;
      }

      const denom = Math.max(Math.abs(c), 1e-12);
      const relDiff = absDiff / denom;
      if (relDiff > maxRelErr) {
        maxRelErr = relDiff;
      }

      sumSqErr += absDiff * absDiff;

      if (absDiff > policy.absoluteTolerance && driftSamples.length < 10) {
        driftSamples.push({ index: i, gpuVal: g, cpuVal: c, absDiff });
      }
    }

    const mse = len > 0 ? sumSqErr / len : 0;
    const passedTolerance =
      maxAbsErr <= policy.absoluteTolerance ||
      maxRelErr <= policy.relativeTolerance;

    return {
      verified: true,
      maxAbsoluteError: maxAbsErr,
      maxRelativeError: maxRelErr,
      meanSquaredError: mse,
      elementsChecked: len,
      passedTolerance,
      cpuReferenceAvailable: true,
      driftSamples,
    };
  }
}
