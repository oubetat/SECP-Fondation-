/**
 * SECP-094-R1.4: Worst-Case Numeric Trace & Continuity Proof - Hard Acceptance Gate
 * 
 * Strict forensic validation of native CAM kinematics including 17-digit numeric precision tracing,
 * recalculable invariants, and mathematically sound continuity analysis with angular difference mapping.
 */

import { HpcWorker } from '../hpc/runtime/HpcWorker';
import { WasmKernelsEngine } from '../hpc/runtime/WasmKernels';

export interface ContinuityEvidence {
  baseVector: number[];
  perturbedVector: number[];
  perturbationMagnitude: number;
  baseA: number;
  baseC: number;
  perturbedA: number;
  perturbedC: number;
  wrappedDeltaA: number;
  wrappedDeltaC: number;
  measuredDiscontinuity: number;
}

export interface GateReport {
  success: boolean;
  checks: AcceptanceCheck[];
  metrics: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    maxAbsError: number;
    maxRelError: number;
    rmsError: number;
    worstCase: {
      worstCaseIndex: number;
      inputVector: number[];
      expectedA: number;
      expectedC: number;
      actualA: number;
      actualC: number;
      deltaA: number;
      deltaC: number;
    };
    tolerance: number;
    benchmarks: {
      size: number;
      wallTimeMs: number;
      throughput: number;
      min: number;
      median: number;
      p95: number;
      max: number;
    }[];
    maxAngularDiscontinuity: number;
    worstContinuityCaseIndex: number;
    perturbationMagnitude: number;
    continuityEvidence: ContinuityEvidence;
  };
  decision: 'PASS' | 'CONDITIONAL_PASS' | 'FAIL';
  artifactHash: string;
}

export interface AcceptanceCheck {
  criterion: string;
  passed: boolean;
  details?: string;
}

export class HardAcceptanceGate094R1 {
  private static RAD_TO_DEG = 180.0 / Math.PI;
  private static TOLERANCE = 1e-3;
  private static EXPECTED_HASH = '6f76a3a22f22b6e3051f6d10fbff43c0b15204d210848eb64a86eab8e00a5684';

  private static isRenderable(val: any): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === 'number' && !Number.isFinite(val)) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    return true;
  }

  private static angularDiff(a: number, b: number): number {
    let diff = (a - b) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff);
  }

  public static async executeGate(): Promise<GateReport> {
    const checks: AcceptanceCheck[] = [];
    const metrics: GateReport['metrics'] = {
      totalCases: 0,
      passedCases: 0,
      failedCases: 0,
      maxAbsError: 0,
      maxRelError: 0,
      rmsError: 0,
      worstCase: { 
        worstCaseIndex: -1,
        inputVector: [], 
        expectedA: 0, 
        expectedC: 0, 
        actualA: 0, 
        actualC: 0, 
        deltaA: 0, 
        deltaC: 0 
      },
      tolerance: this.TOLERANCE,
      benchmarks: [],
      maxAngularDiscontinuity: 0,
      worstContinuityCaseIndex: -1,
      perturbationMagnitude: 1e-6,
      continuityEvidence: {
        baseVector: [],
        perturbedVector: [],
        perturbationMagnitude: 0,
        baseA: 0,
        baseC: 0,
        perturbedA: 0,
        perturbedC: 0,
        wrappedDeltaA: 0,
        wrappedDeltaC: 0,
        measuredDiscontinuity: 0
      }
    };

    let actualHash = 'UNKNOWN';

    try {
      // 1. Artifact Integrity & Export Verification
      const hash = WasmKernelsEngine.getWasmModuleHash();
      const response = await fetch('/wasm/engineering_kernels.wasm');
      const binary = await response.arrayBuffer();
      const actualHashBuffer = await crypto.subtle.digest('SHA-256', binary);
      actualHash = Array.from(new Uint8Array(actualHashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const hashMatch = actualHash === this.EXPECTED_HASH;
      
      const wasmModule = await WebAssembly.compile(binary);
      const exports = WebAssembly.Module.exports(wasmModule);
      const hasBulkExport = exports.some(e => e.name === 'native_cam_5axis_bulk');
      const hasIkExport = exports.some(e => e.name === 'native_cam_5axis_ik');

      checks.push({
        criterion: 'Artifact Integrity & Export Audit',
        passed: hashMatch && hasBulkExport && hasIkExport,
        details: `Hash: ${actualHash.substring(0, 8)}... (${hashMatch ? 'MATCH' : 'MISMATCH'}), Bulk Export: ${hasBulkExport ? 'FOUND' : 'MISSING'}`
      });
      
      // 2. Trigonometric & Kinematic Accuracy (10,000 Deterministic Random Vectors)
      const randomPoints = 10000;
      const randInput = new Float64Array(randomPoints * 6);
      let seed = 42;
      const mulberry32 = () => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      for (let i = 0; i < randomPoints; i++) {
        randInput[i * 6 + 0] = mulberry32() * 1000 - 500; // x
        randInput[i * 6 + 1] = mulberry32() * 1000 - 500; // y
        randInput[i * 6 + 2] = mulberry32() * 1000 - 500; // z
        let dx = mulberry32() * 2 - 1;
        let dy = mulberry32() * 2 - 1;
        let dz = mulberry32() * 2 - 1;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        randInput[i * 6 + 3] = dx / len;
        randInput[i * 6 + 4] = dy / len;
        randInput[i * 6 + 5] = dz / len;
      }

      const randResult = await HpcWorker.executeTask({
        taskId: 'GATE-094R1.4-10K',
        kernelName: 'CAM_5AXIS_KINEMATICS',
        workloadSize: 'MEDIUM',
        inputBufferData: randInput
      });

      if (randResult.status === 'COMPLETED') {
        const outputs = randResult.outputBufferData;
        let totalSqErr = 0;
        metrics.totalCases = randomPoints;

        let trackingMaxAbsError = 0;

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
          const maxPointErr = Math.max(errA, errC);

          if (maxPointErr > trackingMaxAbsError) {
            trackingMaxAbsError = maxPointErr;
            metrics.maxAbsError = maxPointErr;
            metrics.worstCase = {
              worstCaseIndex: i,
              inputVector: [randInput[i * 6 + 3], randInput[i * 6 + 4], randInput[i * 6 + 5]],
              expectedA,
              expectedC,
              actualA,
              actualC,
              deltaA: errA,
              deltaC: errC
            };
          }

          totalSqErr += maxPointErr * maxPointErr;
          
          if (maxPointErr <= this.TOLERANCE) {
            metrics.passedCases++;
          } else {
            metrics.failedCases++;
          }
        }
        metrics.rmsError = Math.sqrt(totalSqErr / randomPoints);
        
        const accuracyPassed = metrics.failedCases === 0 && Number.isFinite(metrics.maxAbsError) && Number.isFinite(metrics.rmsError);
        checks.push({
          criterion: `Accuracy Audit (${randomPoints} cases)`,
          passed: accuracyPassed,
          details: `total=${metrics.totalCases}, passed=${metrics.passedCases}, failed=${metrics.failedCases}, maxAbsError=${metrics.maxAbsError.toExponential(17)}, rmsError=${metrics.rmsError.toExponential(17)}, tolerance=${metrics.tolerance}`
        });

        // Invariant: total = passed + failed
        const totalIntegrity = (metrics.passedCases + metrics.failedCases) === metrics.totalCases;
        checks.push({
          criterion: 'Numerical Evidence Integrity (total integrity)',
          passed: totalIntegrity,
          details: `Integrity Check: ${totalIntegrity ? 'OK' : 'FAIL (total mismatch)'}`
        });
      }

      // 3. Edge Cases & Boundary Handling
      const edgeCases = [
        { name: 'Near +Z Singularity', vec: [0, 0, 0, 1e-15, 1e-15, 1.0], expectStatus: 1.0 },
        { name: 'Near -Z Orient', vec: [0, 0, 0, 1e-15, 1e-15, -1.0], expectStatus: 0.0 },
        { name: 'Zero Length Vector', vec: [10, 10, 10, 0, 0, 0], expectStatus: 1.0 },
        { name: 'NaN Input', vec: [0, 0, 0, NaN, 0, 1], expectStatus: 2.0 },
        { name: 'Inf Input', vec: [0, 0, 0, Infinity, 0, 1], expectStatus: 2.0 }
      ];

      for (const ec of edgeCases) {
        const result = await this.runSinglePoint(ec.vec);
        const statusMatch = isNaN(ec.expectStatus) ? isNaN(result.status) : result.status === ec.expectStatus;
        checks.push({
          criterion: `Boundary Logic: ${ec.name}`,
          passed: statusMatch,
          details: `Status: ${result.status} (Expected: ${ec.expectStatus})`
        });
      }

      // 4. Mathematically explicit Continuity Proof
      // We will perform a sweep across 100 representative points in the test inputs to measure true kinematic discontinuity
      let maxDiscontinuity = 0;
      let worstContCaseIdx = -1;
      let bestContinuityEvidence: ContinuityEvidence | null = null;

      for (let i = 0; i < 100; i++) {
        const idx = Math.floor(i * (10000 / 100));
        const baseVec = [
          randInput[idx * 6 + 0],
          randInput[idx * 6 + 1],
          randInput[idx * 6 + 2],
          randInput[idx * 6 + 3],
          randInput[idx * 6 + 4],
          randInput[idx * 6 + 5]
        ];
        const resBase = await this.runSinglePoint(baseVec);

        // Perturb direction slightly by perturbation magnitude
        const pertMagnitude = 1e-6;
        const perturbedVec = [...baseVec];
        perturbedVec[3] += pertMagnitude;
        // re-normalize unit vector
        const len = Math.sqrt(perturbedVec[3]*perturbedVec[3] + perturbedVec[4]*perturbedVec[4] + perturbedVec[5]*perturbedVec[5]);
        perturbedVec[3] /= len;
        perturbedVec[4] /= len;
        perturbedVec[5] /= len;

        const resPert = await this.runSinglePoint(perturbedVec);

        // Measure continuity using wrapped angular delta to ignore +/-180 wrapping jumps
        const wrappedDeltaA = this.angularDiff(resBase.a, resPert.a);
        const wrappedDeltaC = this.angularDiff(resBase.c, resPert.c);
        const measuredDiscontinuity = Math.max(wrappedDeltaA, wrappedDeltaC);

        if (measuredDiscontinuity > maxDiscontinuity) {
          maxDiscontinuity = measuredDiscontinuity;
          worstContCaseIdx = idx;
          bestContinuityEvidence = {
            baseVector: [baseVec[3], baseVec[4], baseVec[5]],
            perturbedVector: [perturbedVec[3], perturbedVec[4], perturbedVec[5]],
            perturbationMagnitude: pertMagnitude,
            baseA: resBase.a,
            baseC: resBase.c,
            perturbedA: resPert.a,
            perturbedC: resPert.c,
            wrappedDeltaA,
            wrappedDeltaC,
            measuredDiscontinuity
          };
        }
      }

      metrics.maxAngularDiscontinuity = maxDiscontinuity;
      metrics.worstContinuityCaseIndex = worstContCaseIdx;
      if (bestContinuityEvidence) {
        metrics.continuityEvidence = bestContinuityEvidence;
      }

      checks.push({
        criterion: 'Kinematic Continuity Enforcement',
        passed: maxDiscontinuity < 1e-3 && Number.isFinite(maxDiscontinuity),
        details: `Max Delta: ${maxDiscontinuity.toExponential(17)} deg (Worst Case Index: ${worstContCaseIdx})`
      });

      // 5. Benchmarking
      const sizes = [1000, 10000, 100000];
      for (const size of sizes) {
        const input = new Float64Array(size * 6).fill(0.5);
        const times: number[] = [];
        const iterations = 5;
        
        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          await HpcWorker.executeTask({
            taskId: `BENCH-${size}-${i}`,
            kernelName: 'CAM_5AXIS_KINEMATICS',
            workloadSize: 'LARGE',
            inputBufferData: input
          });
          times.push(performance.now() - start);
        }
        
        times.sort((a, b) => a - b);
        const wallTime = times.reduce((a, b) => a + b, 0) / iterations;
        metrics.benchmarks.push({
          size,
          wallTimeMs: wallTime,
          throughput: size / (wallTime / 1000),
          min: times[0],
          median: times[2],
          p95: times[4],
          max: times[4]
        });
      }
      
      checks.push({
        criterion: 'Throughput Audit (MEASURED)',
        passed: metrics.benchmarks[2].throughput > 0,
        details: `${Math.round(metrics.benchmarks[2].throughput).toLocaleString()} pts/sec`
      });

    } catch (err: any) {
      checks.push({
        criterion: 'Gate Audit Interrupt',
        passed: false,
        details: err?.message
      });
    }

    // FINAL VALIDATION & SERIALIZATION
    const allChecksPassed = checks.every(c => c.passed);
    let decision: 'PASS' | 'CONDITIONAL_PASS' | 'FAIL' = allChecksPassed ? 'PASS' : 'FAIL';

    // Verify worst-case error invariants are perfectly satisfied
    const worstCaseRecalculatedDeltaA = Math.abs(metrics.worstCase.actualA - metrics.worstCase.expectedA);
    const worstCaseRecalculatedDeltaC = Math.abs(metrics.worstCase.actualC - metrics.worstCase.expectedC);
    
    const deltaAMatch = Math.abs(worstCaseRecalculatedDeltaA - metrics.worstCase.deltaA) < 1e-13;
    const deltaCMatch = Math.abs(worstCaseRecalculatedDeltaC - metrics.worstCase.deltaC) < 1e-13;
    
    const reportedMaxMatchesWorstCase = Math.abs(metrics.maxAbsError - Math.max(metrics.worstCase.deltaA, metrics.worstCase.deltaC)) < 1e-13;

    checks.push({
      criterion: 'Worst-Case Consistency & Invariant Verification',
      passed: deltaAMatch && deltaCMatch && reportedMaxMatchesWorstCase,
      details: `ΔA Match: ${deltaAMatch ? 'YES' : 'NO'}, ΔC Match: ${deltaCMatch ? 'YES' : 'NO'}, Max Error Match: ${reportedMaxMatchesWorstCase ? 'YES' : 'NO'}`
    });

    // Anti-False-PASS: Verify all metrics are present, renderable, and finite
    const metricsComplete = 
      Number.isFinite(metrics.maxAbsError) && 
      Number.isFinite(metrics.rmsError) && 
      Number.isFinite(metrics.maxAngularDiscontinuity) &&
      metrics.totalCases === 10000 &&
      metrics.failedCases === 0 &&
      metrics.maxAbsError <= metrics.tolerance &&
      metrics.worstCase.inputVector.length === 3 &&
      metrics.worstCase.worstCaseIndex >= 0 &&
      metrics.worstContinuityCaseIndex >= 0 &&
      this.isRenderable(metrics.totalCases) &&
      this.isRenderable(metrics.passedCases) &&
      this.isRenderable(metrics.failedCases) &&
      this.isRenderable(metrics.maxAbsError) &&
      this.isRenderable(metrics.rmsError) &&
      this.isRenderable(metrics.tolerance) &&
      this.isRenderable(metrics.maxAngularDiscontinuity) &&
      deltaAMatch && 
      deltaCMatch && 
      reportedMaxMatchesWorstCase;

    if (!metricsComplete) {
      decision = 'FAIL';
      checks.push({
        criterion: 'Numerical Evidence Integrity (serialization check)',
        passed: false,
        details: 'Missing, non-finite, or inconsistent numerical evidence detected in metrics.'
      });
    }

    // Serialization Test
    try {
      const serialized = JSON.stringify(metrics);
      const deserialized = JSON.parse(serialized);
      if (
        deserialized.maxAbsError !== metrics.maxAbsError || 
        deserialized.totalCases !== metrics.totalCases ||
        deserialized.worstCase.worstCaseIndex !== metrics.worstCase.worstCaseIndex ||
        deserialized.maxAngularDiscontinuity !== metrics.maxAngularDiscontinuity
      ) {
        throw new Error('Serialization mismatch');
      }
      checks.push({
        criterion: 'Evidence Serialization Verification',
        passed: true,
        details: 'JSON round-trip integrity confirmed.'
      });
    } catch (err: any) {
      decision = 'FAIL';
      checks.push({
        criterion: 'Evidence Serialization Verification',
        passed: false,
        details: err?.message
      });
    }

    return { 
      success: decision === 'PASS', 
      checks, 
      metrics, 
      decision,
      artifactHash: actualHash
    };
  }

  private static async runSinglePoint(vec: number[]): Promise<{ a: number, c: number, status: number }> {
    const result = await HpcWorker.executeTask({
      taskId: `SINGLE-${Date.now()}`,
      kernelName: 'CAM_5AXIS_KINEMATICS',
      workloadSize: 'SMALL',
      inputBufferData: new Float64Array(vec)
    });
    if (result.status === 'COMPLETED') {
      return { 
        a: result.outputBufferData[3], 
        c: result.outputBufferData[4],
        status: result.outputBufferData[5] 
      };
    }
    return { a: NaN, c: NaN, status: -1 };
  }
}


