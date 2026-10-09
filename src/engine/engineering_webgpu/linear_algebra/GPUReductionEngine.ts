/**
 * GPUReductionEngine.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Multi-Stage Parallel Reduction Engine for Sums, Dot Products, L2 & Infinity Norms, Min & Max
 */

import { ReductionOpType } from './GPULinearAlgebraTypes';
import { WebGPUComputeBackend, CPUBackend, computeDataHash } from '../ComputeBackend';
import { LinearAlgebraComparisonEngine } from './LinearAlgebraComparisonEngine';

export interface ReductionExecutionResult {
  scalarResult: number;
  stages: number;
  intermediateCounts: number[];
  durationMs: number;
  backendUsed: 'WEBGPU' | 'CPU';
  dataHash: string;
}

export class GPUReductionEngine {
  /**
   * Executes a multi-stage reduction (Sum, Dot, L2-Norm, Inf-Norm, Min, Max)
   */
  public static async executeReduction(
    op: ReductionOpType,
    inputX: Float32Array,
    inputY?: Float32Array,
    webgpuBackend?: WebGPUComputeBackend
  ): Promise<ReductionExecutionResult> {
    const startTime = performance.now();
    const count = inputX.length;
    const dataHash = computeDataHash(inputX);

    if (count === 0) {
      return {
        scalarResult: 0,
        stages: 0,
        intermediateCounts: [],
        durationMs: performance.now() - startTime,
        backendUsed: 'CPU',
        dataHash,
      };
    }

    // Determine target initial kernel ID
    let initialKernelId = 'PARALLEL_REDUCTION';
    switch (op) {
      case 'SUM':
        initialKernelId = 'PARALLEL_REDUCTION';
        break;
      case 'DOT':
        initialKernelId = 'DOT_PRODUCT';
        break;
      case 'L2_NORM':
        initialKernelId = 'NORM_L2';
        break;
      case 'INF_NORM':
        initialKernelId = 'NORM_INF';
        break;
      case 'MIN':
        initialKernelId = 'REDUCE_MIN';
        break;
      case 'MAX':
        initialKernelId = 'REDUCE_MAX';
        break;
    }

    const gpu = webgpuBackend || new WebGPUComputeBackend();
    const isGPUReady = gpu.getTruthState() === 'READY';

    // If GPU is not available, execute fast reference CPU reduction
    if (!isGPUReady) {
      let cpuVal = 0;
      switch (op) {
        case 'SUM':
          cpuVal = LinearAlgebraComparisonEngine.cpuReduceSum(inputX);
          break;
        case 'DOT':
          cpuVal = LinearAlgebraComparisonEngine.cpuDotProduct(inputX, inputY || inputX);
          break;
        case 'L2_NORM':
          cpuVal = LinearAlgebraComparisonEngine.cpuL2Norm(inputX);
          break;
        case 'INF_NORM':
          cpuVal = LinearAlgebraComparisonEngine.cpuInfinityNorm(inputX);
          break;
        case 'MIN':
          cpuVal = LinearAlgebraComparisonEngine.cpuReduceMin(inputX);
          break;
        case 'MAX':
          cpuVal = LinearAlgebraComparisonEngine.cpuReduceMax(inputX);
          break;
      }
      return {
        scalarResult: cpuVal,
        stages: 1,
        intermediateCounts: [count, 1],
        durationMs: performance.now() - startTime,
        backendUsed: 'CPU',
        dataHash,
      };
    }

    // GPU Multi-Stage Reduction
    let currentInputs: Record<string, Float32Array> = {
      inputData: inputX,
      inputX: inputX,
    };
    if (op === 'DOT') {
      currentInputs['inputY'] = inputY || inputX;
    }

    let currentLength = count;
    let currentKernel = initialKernelId;
    let stages = 0;
    const intermediateCounts: number[] = [count];
    let currentData = inputX;

    while (currentLength > 1) {
      stages++;
      const numWorkgroups = Math.ceil(currentLength / 64);
      const isFirstStage = stages === 1;

      const stageInputs: Record<string, Float32Array> = isFirstStage
        ? currentInputs
        : {
            inputData: currentData,
            inputX: currentData,
          };

      const stageRes = await gpu.executeKernel({
        jobId: `reduc-${op}-${stages}-${Date.now()}`,
        kernelId: isFirstStage ? currentKernel : (op === 'MIN' ? 'REDUCE_MIN' : op === 'MAX' ? 'REDUCE_MAX' : op === 'INF_NORM' ? 'NORM_INF' : 'PARALLEL_REDUCTION'),
        requestedBackend: 'WEBGPU',
        inputs: stageInputs,
        uniforms: { count: currentLength },
        elementCount: currentLength,
        validateAgainstCPU: false,
        fallbackAllowed: true,
      });

      currentData = stageRes.outputData.slice(0, numWorkgroups);
      currentLength = numWorkgroups;
      intermediateCounts.push(currentLength);

      // If length is small enough, resolve final workgroup reduction
      if (currentLength === 1) {
        break;
      }
      if (currentLength <= 64) {
        // One final stage
        stages++;
        let finalVal = 0.0;
        if (op === 'MIN') {
          finalVal = LinearAlgebraComparisonEngine.cpuReduceMin(currentData);
        } else if (op === 'MAX') {
          finalVal = LinearAlgebraComparisonEngine.cpuReduceMax(currentData);
        } else if (op === 'INF_NORM') {
          finalVal = LinearAlgebraComparisonEngine.cpuInfinityNorm(currentData);
        } else {
          finalVal = LinearAlgebraComparisonEngine.cpuReduceSum(currentData);
        }

        if (op === 'L2_NORM') {
          finalVal = Math.sqrt(Math.max(0, finalVal));
        }

        intermediateCounts.push(1);
        return {
          scalarResult: finalVal,
          stages,
          intermediateCounts,
          durationMs: performance.now() - startTime,
          backendUsed: 'WEBGPU',
          dataHash,
        };
      }
    }

    let finalScalar = currentData[0];
    if (op === 'L2_NORM') {
      finalScalar = Math.sqrt(Math.max(0, finalScalar));
    }

    return {
      scalarResult: finalScalar,
      stages,
      intermediateCounts,
      durationMs: performance.now() - startTime,
      backendUsed: 'WEBGPU',
      dataHash,
    };
  }
}
