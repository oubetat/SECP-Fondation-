/**
 * ComputeShaderManager.ts
 * Real WGSL Compute Shaders, Compilation, Validation, Pipeline Caching & Versioning
 */

import { KernelCategory, PrecisionMode, WebGPUErrorCode } from './WebGPUComputeTypes';
import { pureSha256 } from '../../polyfills/crypto';

export interface WGSLShaderSpec {
  shaderId: string;
  name: string;
  version: string;
  category: KernelCategory;
  source: string;
  entryPoint: string;
  workgroupSize: [number, number, number];
  precision: PrecisionMode;
}

export class ComputeShaderManager {
  private static shaderSourceRegistry: Map<string, WGSLShaderSpec> = new Map();
  private static shaderHashMap: Map<string, string> = new Map();
  private static pipelineCache: Map<string, any> = new Map();

  static {
    this.registerDefaultShaders();
  }

  /**
   * Deterministic SHA-256 string hash for WGSL source tracking
   */
  public static computeShaderHash(source: string, version: string): string {
    const str = `${version}::${source.trim()}`;
    const hash = pureSha256(str);
    return `wgsl-sha256-${hash.substring(0, 16)}`;
  }

  private static registerDefaultShaders() {
    // 1. Vector Addition
    const vectorAddSource = `
@group(0) @binding(0) var<storage, read> inputA: array<f32>;
@group(0) @binding(1) var<storage, read> inputB: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

struct Uniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    outputData[index] = inputA[index] + inputB[index];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'VECTOR_ADD',
      name: 'Vector Addition Kernel',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      source: vectorAddSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 2. Vector Scale
    const vectorScaleSource = `
@group(0) @binding(0) var<storage, read> inputA: array<f32>;
@group(0) @binding(1) var<storage, read_write> outputData: array<f32>;

struct ScaleUniforms {
  count: u32,
  scaleFactor: f32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(2) var<uniform> uniforms: ScaleUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    outputData[index] = inputA[index] * uniforms.scaleFactor;
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'VECTOR_SCALE',
      name: 'Vector Scale Kernel',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      source: vectorScaleSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 3. Element-wise Multiplication
    const elemWiseMulSource = `
@group(0) @binding(0) var<storage, read> inputA: array<f32>;
@group(0) @binding(1) var<storage, read> inputB: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

struct Uniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    outputData[index] = inputA[index] * inputB[index];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'ELEMENT_WISE_MUL',
      name: 'Element-wise Multiplication Kernel',
      version: '1.0.0',
      category: 'ELEMENT_WISE',
      source: elemWiseMulSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 4. Parallel Tree Reduction (Sum / Workgroup Shared Memory)
    const reductionSource = `
@group(0) @binding(0) var<storage, read> inputData: array<f32>;
@group(0) @binding(1) var<storage, read_write> workgroupSums: array<f32>;

struct RedUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(2) var<uniform> uniforms: RedUniforms;

var<workgroup> sdata: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    sdata[tid] = inputData[i];
  } else {
    sdata[tid] = 0.0;
  }

  workgroupBarrier();

  // Parallel reduction tree in shared memory
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdata[tid] = sdata[tid] + sdata[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    workgroupSums[group_id.x] = sdata[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'PARALLEL_REDUCTION',
      name: 'Parallel Workgroup Tree Reduction',
      version: '1.1.0',
      category: 'PARALLEL_REDUCTION',
      source: reductionSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 5. Matrix Multiplication
    const matMulSource = `
@group(0) @binding(0) var<storage, read> matrixA: array<f32>;
@group(0) @binding(1) var<storage, read> matrixB: array<f32>;
@group(0) @binding(2) var<storage, read_write> matrixC: array<f32>;

struct MatUniforms {
  dimM: u32,
  dimK: u32,
  dimN: u32,
  pad0: u32,
};
@group(0) @binding(3) var<uniform> uniforms: MatUniforms;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.y;
  let col = global_id.x;

  if (row < uniforms.dimM && col < uniforms.dimN) {
    var sum: f32 = 0.0;
    for (var k = 0u; k < uniforms.dimK; k = k + 1u) {
      let a = matrixA[row * uniforms.dimK + k];
      let b = matrixB[k * uniforms.dimN + col];
      sum = sum + a * b;
    }
    matrixC[row * uniforms.dimN + col] = sum;
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'MATRIX_MUL',
      name: 'Dense Matrix Multiplication Kernel',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      source: matMulSource,
      entryPoint: 'main',
      workgroupSize: [8, 8, 1],
      precision: 'FP32',
    });

    // 6. Nonlinear Transformation (Heavy Compute Stress)
    const transformSource = `
@group(0) @binding(0) var<storage, read> inputData: array<f32>;
@group(0) @binding(1) var<storage, read_write> outputData: array<f32>;

struct TransUniforms {
  count: u32,
  multiplier: f32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(2) var<uniform> uniforms: TransUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    let x = inputData[index];
    let val = x * uniforms.multiplier + sin(x) - cos(x * 0.5) + sqrt(abs(x) + 1.0);
    outputData[index] = val;
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'TRANSFORM_NONLINEAR',
      name: 'Nonlinear Stress Transformation Kernel',
      version: '1.0.0',
      category: 'TRANSFORMATION',
      source: transformSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 7. AXPY Kernel: y = alpha * x + y
    const axpySource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read> inputY: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

struct AxpyUniforms {
  count: u32,
  alpha: f32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(3) var<uniform> uniforms: AxpyUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    outputData[index] = uniforms.alpha * inputX[index] + inputY[index];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'AXPY',
      name: 'AXPY Vector Kernel (y = alpha*x + y)',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      source: axpySource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 8. Element-wise Division Kernel
    const elemDivSource = `
@group(0) @binding(0) var<storage, read> inputA: array<f32>;
@group(0) @binding(1) var<storage, read> inputB: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

struct DivUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(3) var<uniform> uniforms: DivUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index < uniforms.count) {
    let denom = inputB[index];
    if (abs(denom) < 1e-30) {
      outputData[index] = 0.0;
    } else {
      outputData[index] = inputA[index] / denom;
    }
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'ELEMENT_WISE_DIV',
      name: 'Element-wise Division Kernel',
      version: '1.0.0',
      category: 'ELEMENT_WISE',
      source: elemDivSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 9. Dense Matrix-Vector Product (y = Ax)
    const matVecSource = `
@group(0) @binding(0) var<storage, read> matrixA: array<f32>;
@group(0) @binding(1) var<storage, read> vectorX: array<f32>;
@group(0) @binding(2) var<storage, read_write> vectorY: array<f32>;

struct MatVecUniforms {
  rows: u32,
  cols: u32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(3) var<uniform> uniforms: MatVecUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row < uniforms.rows) {
    var sum: f32 = 0.0;
    let rowOffset = row * uniforms.cols;
    for (var c = 0u; c < uniforms.cols; c = c + 1u) {
      sum = sum + matrixA[rowOffset + c] * vectorX[c];
    }
    vectorY[row] = sum;
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'MATVEC',
      name: 'Dense Matrix-Vector Product (y = Ax)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      source: matVecSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 10. Matrix Transpose Kernel
    const matTransposeSource = `
@group(0) @binding(0) var<storage, read> inputMatrix: array<f32>;
@group(0) @binding(1) var<storage, read_write> outputMatrix: array<f32>;

struct TransposeUniforms {
  rows: u32,
  cols: u32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(2) var<uniform> uniforms: TransposeUniforms;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let col = global_id.x;
  let row = global_id.y;
  if (row < uniforms.rows && col < uniforms.cols) {
    outputMatrix[col * uniforms.rows + row] = inputMatrix[row * uniforms.cols + col];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'MATRIX_TRANSPOSE',
      name: 'Dense Matrix Transpose (A^T)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      source: matTransposeSource,
      entryPoint: 'main',
      workgroupSize: [8, 8, 1],
      precision: 'FP32',
    });

    // 11. Sparse Matrix-Vector Product (CSR SpMV: y = Ax)
    const spmvCSRSource = `
@group(0) @binding(0) var<storage, read> values: array<f32>;
@group(0) @binding(1) var<storage, read> columnIndices: array<u32>;
@group(0) @binding(2) var<storage, read> rowPointers: array<u32>;
@group(0) @binding(3) var<storage, read> vectorX: array<f32>;
@group(0) @binding(4) var<storage, read_write> vectorY: array<f32>;

struct SpmvUniforms {
  rows: u32,
  cols: u32,
  nnz: u32,
  pad0: u32,
};
@group(0) @binding(5) var<uniform> uniforms: SpmvUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  if (row < uniforms.rows) {
    let start = rowPointers[row];
    let end = rowPointers[row + 1u];
    var sum: f32 = 0.0;
    for (var idx = start; idx < end; idx = idx + 1u) {
      let col = columnIndices[idx];
      if (col < uniforms.cols) {
        sum = sum + values[idx] * vectorX[col];
      }
    }
    vectorY[row] = sum;
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'SPMV_CSR',
      name: 'Sparse Matrix-Vector Product (CSR SpMV)',
      version: '1.0.0',
      category: 'MATRIX_MATH',
      source: spmvCSRSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 12. Dot Product Block Reduction Kernel (x . y)
    const dotProductSource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read> inputY: array<f32>;
@group(0) @binding(2) var<storage, read_write> blockSums: array<f32>;

struct DotUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(3) var<uniform> uniforms: DotUniforms;

var<workgroup> sdataDot: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    sdataDot[tid] = inputX[i] * inputY[i];
  } else {
    sdataDot[tid] = 0.0;
  }

  workgroupBarrier();

  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataDot[tid] = sdataDot[tid] + sdataDot[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    blockSums[group_id.x] = sdataDot[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'DOT_PRODUCT',
      name: 'Dot Product Reduction Block Kernel',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      source: dotProductSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 13. L2 Norm Block Reduction Kernel (sum(x_i^2))
    const l2NormSource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read_write> blockSums: array<f32>;

struct L2Uniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(2) var<uniform> uniforms: L2Uniforms;

var<workgroup> sdataL2: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    let val = inputX[i];
    sdataL2[tid] = val * val;
  } else {
    sdataL2[tid] = 0.0;
  }

  workgroupBarrier();

  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataL2[tid] = sdataL2[tid] + sdataL2[tid + s];
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    blockSums[group_id.x] = sdataL2[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'NORM_L2',
      name: 'L2 Norm Squared Sum Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      source: l2NormSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 14. Infinity Norm Block Reduction Kernel (max(|x_i|))
    const infNormSource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read_write> blockMax: array<f32>;

struct InfUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(2) var<uniform> uniforms: InfUniforms;

var<workgroup> sdataInf: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    sdataInf[tid] = abs(inputX[i]);
  } else {
    sdataInf[tid] = 0.0;
  }

  workgroupBarrier();

  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataInf[tid] = max(sdataInf[tid], sdataInf[tid + s]);
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    blockMax[group_id.x] = sdataInf[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'NORM_INF',
      name: 'Infinity Norm Max Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      source: infNormSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 15. Reduce Min Block
    const reduceMinSource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read_write> blockMin: array<f32>;

struct MinUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(2) var<uniform> uniforms: MinUniforms;

var<workgroup> sdataMin: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    sdataMin[tid] = inputX[i];
  } else {
    sdataMin[tid] = 1e38; // Max float
  }

  workgroupBarrier();

  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataMin[tid] = min(sdataMin[tid], sdataMin[tid + s]);
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    blockMin[group_id.x] = sdataMin[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'REDUCE_MIN',
      name: 'Minimum Value Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      source: reduceMinSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 16. Reduce Max Block
    const reduceMaxSource = `
@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read_write> blockMax: array<f32>;

struct MaxUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(2) var<uniform> uniforms: MaxUniforms;

var<workgroup> sdataMax: array<f32, 64>;

@compute @workgroup_size(64, 1, 1)
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) group_id: vec3<u32>
) {
  let tid = local_id.x;
  let i = global_id.x;

  if (i < uniforms.count) {
    sdataMax[tid] = inputX[i];
  } else {
    sdataMax[tid] = -1e38; // Min float
  }

  workgroupBarrier();

  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (tid < s) {
      sdataMax[tid] = max(sdataMax[tid], sdataMax[tid + s]);
    }
    workgroupBarrier();
  }

  if (tid == 0u) {
    blockMax[group_id.x] = sdataMax[0];
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'REDUCE_MAX',
      name: 'Maximum Value Reduction Block',
      version: '1.0.0',
      category: 'PARALLEL_REDUCTION',
      source: reduceMaxSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 17. Diagonal Scaling Kernel (y = x / diag)
    const diagScaleSource = `
@group(0) @binding(0) var<storage, read> vectorX: array<f32>;
@group(0) @binding(1) var<storage, read> diagonal: array<f32>;
@group(0) @binding(2) var<storage, read_write> vectorY: array<f32>;

struct DiagUniforms {
  count: u32,
  pad0: u32,
  pad1: u32,
  pad2: u32,
};
@group(0) @binding(3) var<uniform> uniforms: DiagUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i < uniforms.count) {
    let d = diagonal[i];
    if (abs(d) < 1e-30) {
      vectorY[i] = 0.0;
    } else {
      vectorY[i] = vectorX[i] / d;
    }
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'DIAGONAL_SCALE',
      name: 'Diagonal Scaling Preconditioner Kernel',
      version: '1.0.0',
      category: 'VECTOR_MATH',
      source: diagScaleSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });

    // 18. Gather Kernel (y_i = x[indices[i]])
    const gatherSource = `
@group(0) @binding(0) var<storage, read> sourceData: array<f32>;
@group(0) @binding(1) var<storage, read> indices: array<u32>;
@group(0) @binding(2) var<storage, read_write> outputData: array<f32>;

struct GatherUniforms {
  sourceCount: u32,
  indicesCount: u32,
  pad0: u32,
  pad1: u32,
};
@group(0) @binding(3) var<uniform> uniforms: GatherUniforms;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  if (i < uniforms.indicesCount) {
    let idx = indices[i];
    if (idx < uniforms.sourceCount) {
      outputData[i] = sourceData[idx];
    } else {
      outputData[i] = 0.0;
    }
  }
}
    `.trim();

    this.registerShader({
      shaderId: 'GATHER',
      name: 'Gather Memory Primitive Kernel',
      version: '1.0.0',
      category: 'TRANSFORMATION',
      source: gatherSource,
      entryPoint: 'main',
      workgroupSize: [64, 1, 1],
      precision: 'FP32',
    });
  }

  public static registerShader(spec: WGSLShaderSpec): string {
    const hash = this.computeShaderHash(spec.source, spec.version);
    this.shaderSourceRegistry.set(spec.shaderId, spec);
    this.shaderHashMap.set(spec.shaderId, hash);
    return hash;
  }

  public static getShaderSpec(shaderId: string): WGSLShaderSpec | undefined {
    return this.shaderSourceRegistry.get(shaderId);
  }

  public static getShaderHash(shaderId: string): string {
    return this.shaderHashMap.get(shaderId) || 'unknown-shader-hash';
  }

  public static getAllShaders(): WGSLShaderSpec[] {
    return Array.from(this.shaderSourceRegistry.values());
  }

  /**
   * Validates WGSL syntax basics (entry point existence, workgroup size declaration, bindings)
   */
  public static validateShaderCode(source: string, entryPoint: string): { valid: boolean; error?: string } {
    if (!source || source.trim().length === 0) {
      return { valid: false, error: 'Empty shader source' };
    }
    if (!source.includes(entryPoint)) {
      return { valid: false, error: `Entry point '${entryPoint}' not found in WGSL source` };
    }
    if (!source.includes('@compute')) {
      return { valid: false, error: 'Missing @compute attribute in WGSL source' };
    }
    if (!source.includes('@workgroup_size')) {
      return { valid: false, error: 'Missing @workgroup_size attribute in WGSL source' };
    }
    return { valid: true };
  }

  /**
   * Compiles or retrieves cached WebGPU compute pipeline
   */
  public static async getOrCreateComputePipeline(
    device: any,
    shaderId: string
  ): Promise<{ pipeline: any; shaderHash: string; spec: WGSLShaderSpec }> {
    const spec = this.getShaderSpec(shaderId);
    if (!spec) {
      throw new Error(`[ComputeShaderManager] Shader with id '${shaderId}' not registered.`);
    }

    const shaderHash = this.getShaderHash(shaderId);
    const cacheKey = `${shaderId}::${shaderHash}`;

    if (this.pipelineCache.has(cacheKey)) {
      return {
        pipeline: this.pipelineCache.get(cacheKey),
        shaderHash,
        spec,
      };
    }

    // Validate shader syntax before submitting to GPU
    const validation = this.validateShaderCode(spec.source, spec.entryPoint);
    if (!validation.valid) {
      const err = new Error(`[ComputeShaderManager] Shader compilation failed: ${validation.error}`);
      (err as any).code = 'SHADER_COMPILATION_FAILURE' as WebGPUErrorCode;
      throw err;
    }

    if (!device) {
      throw new Error('[ComputeShaderManager] Cannot compile pipeline without valid GPU device');
    }

    try {
      const shaderModule = device.createShaderModule({
        label: `${spec.name} Module`,
        code: spec.source,
      });

      // Check compilation info if supported
      if (shaderModule.getCompilationInfo) {
        const info = await shaderModule.getCompilationInfo();
        const errors = info.messages.filter((m: any) => m.type === 'error');
        if (errors.length > 0) {
          const errMsg = errors.map((e: any) => `${e.message} line ${e.lineNum}`).join(', ');
          throw new Error(`WGSL Compilation Error: ${errMsg}`);
        }
      }

      const pipeline = await device.createComputePipelineAsync({
        label: `${spec.name} Pipeline`,
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: spec.entryPoint,
        },
      });

      this.pipelineCache.set(cacheKey, pipeline);

      return {
        pipeline,
        shaderHash,
        spec,
      };
    } catch (err: any) {
      const compilationError = new Error(`[ComputeShaderManager] Pipeline creation failed: ${err?.message || err}`);
      (compilationError as any).code = 'SHADER_COMPILATION_FAILURE' as WebGPUErrorCode;
      throw compilationError;
    }
  }

  public static clearCache() {
    this.pipelineCache.clear();
  }
}
