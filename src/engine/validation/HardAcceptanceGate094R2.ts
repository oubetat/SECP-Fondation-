import { HpcWorker } from '../hpc/runtime/HpcWorker';
import { WasmKernelsEngine } from '../hpc/runtime/WasmKernels';

export interface AccuracyMetrics {
  totalCases: number;
  maxAbsError: number;
  rmsError: number;
  p95: number;
  p99: number;
  p999: number;
  worstCase: {
    input: number[];
    expected: [number, number];
    actual: [number, number];
    error: number;
  };
}

export interface SingularityContract {
  threshold: number;
  expectedStatus: number;
  expectedC: number;
  passed: boolean;
  details: string;
}

export interface GateReportR2 {
  success: boolean;
  accuracy: AccuracyMetrics;
  singularity: SingularityContract;
  decision: 'PASS' | 'FAIL';
  timestamp: string;
}

export class HardAcceptanceGate094R2 {
  private static RAD_TO_DEG = 180.0 / Math.PI;
  private static SINGULARITY_THRESHOLD = 1e-12;
  private static ACCEPTABLE_RMS_ERROR = 1e-6; // Strict engineering goal

  private static calculatePercentile(sortedData: number[], percentile: number): number {
    if (sortedData.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedData.length) - 1;
    return sortedData[index];
  }

  public static async executeGate(): Promise<GateReportR2> {
    const randomPoints = 10000;
    const randInput = new Float64Array(randomPoints * 6);
    let seed = 1337; // Different seed for independent verification
    
    const mulberry32 = () => {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let i = 0; i < randomPoints; i++) {
      randInput[i * 6 + 0] = mulberry32() * 100 - 50;
      randInput[i * 6 + 1] = mulberry32() * 100 - 50;
      randInput[i * 6 + 2] = mulberry32() * 100 - 50;
      let dx = mulberry32() * 2 - 1;
      let dy = mulberry32() * 2 - 1;
      let dz = mulberry32() * 2 - 1;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      randInput[i * 6 + 3] = dx / len;
      randInput[i * 6 + 4] = dy / len;
      randInput[i * 6 + 5] = dz / len;
    }

    const result = await HpcWorker.executeTask({
      taskId: 'GATE-094R2-ACCURACY',
      kernelName: 'CAM_5AXIS_KINEMATICS',
      workloadSize: 'MEDIUM',
      inputBufferData: randInput
    });

    if (result.status !== 'COMPLETED') {
      throw new Error('Accuracy task failed to complete');
    }

    const outputs = result.outputBufferData;
    const errors: number[] = [];
    let totalSqErr = 0;
    let maxAbsErr = 0;
    let worstIdx = 0;

    for (let i = 0; i < randomPoints; i++) {
      const vi = randInput[i * 6 + 3];
      const vj = randInput[i * 6 + 4];
      const vk = randInput[i * 6 + 5];

      const actualA = outputs[i * 6 + 3];
      const actualC = outputs[i * 6 + 4];

      const expectedA = Math.acos(Math.max(-1, Math.min(1, vk))) * this.RAD_TO_DEG;
      const expectedC = Math.atan2(vj, vi) * this.RAD_TO_DEG;

      const errA = Math.abs(actualA - expectedA);
      const errC = Math.abs(actualC - expectedC);
      const pointErr = Math.max(errA, errC);

      errors.push(pointErr);
      totalSqErr += pointErr * pointErr;

      if (pointErr > maxAbsErr) {
        maxAbsErr = pointErr;
        worstIdx = i;
      }
    }

    errors.sort((a, b) => a - b);
    const rmsError = Math.sqrt(totalSqErr / randomPoints);

    const accuracy: AccuracyMetrics = {
      totalCases: randomPoints,
      maxAbsError: maxAbsErr,
      rmsError: rmsError,
      p95: this.calculatePercentile(errors, 95),
      p99: this.calculatePercentile(errors, 99),
      p999: this.calculatePercentile(errors, 99.9),
      worstCase: {
        input: [randInput[worstIdx * 6 + 3], randInput[worstIdx * 6 + 4], randInput[worstIdx * 6 + 5]],
        expected: [
            Math.acos(Math.max(-1, Math.min(1, randInput[worstIdx * 6 + 5]))) * this.RAD_TO_DEG,
            Math.atan2(randInput[worstIdx * 6 + 4], randInput[worstIdx * 6 + 3]) * this.RAD_TO_DEG
        ],
        actual: [outputs[worstIdx * 6 + 3], outputs[worstIdx * 6 + 4]],
        error: maxAbsErr
      }
    };

    // Singularity Contract Verification
    const singInput = new Float64Array(6);
    singInput[3] = 1e-15;
    singInput[4] = 1e-15;
    singInput[5] = -1.0;

    const singResult = await HpcWorker.executeTask({
      taskId: 'GATE-094R2-SINGULARITY',
      kernelName: 'CAM_5AXIS_KINEMATICS',
      workloadSize: 'SMALL',
      inputBufferData: singInput
    });

    let singularity: SingularityContract;
    if (singResult.status === 'COMPLETED') {
      const sOut = singResult.outputBufferData;
      const status = sOut[5];
      const actualC = sOut[4];
      const passed = status === 1 && actualC === 0;
      singularity = {
        threshold: this.SINGULARITY_THRESHOLD,
        expectedStatus: 1,
        expectedC: 0,
        passed,
        details: passed 
          ? 'Contract Met: Kernel identified singularity and returned C=0' 
          : `Contract Failed: Status=${status} (exp 1), C=${actualC} (exp 0)`
      };
    } else {
      singularity = {
        threshold: this.SINGULARITY_THRESHOLD,
        expectedStatus: 1,
        expectedC: 0,
        passed: false,
        details: 'Singularity task failed'
      };
    }

    const decision = (accuracy.rmsError < this.ACCEPTABLE_RMS_ERROR && singularity.passed) ? 'PASS' : 'FAIL';

    return {
      success: decision === 'PASS',
      accuracy,
      singularity,
      decision,
      timestamp: new Date().toISOString()
    };
  }
}
