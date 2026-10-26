import { FSISolver } from './FSISolver';
import { FSIPhenomenon, FSICouplingScheme } from './index';
import { DynamicMeshManager } from './DynamicMeshManager';
import { Fvm3DMeshGenerator } from '../../Fvm3DMeshGenerator';

export interface ConvergenceStep {
  stations: number;
  displacementMm: number;
  errorVsEulerBernoulliPercent: number;
  errorVs2DContinuumPercent: number;
  converged: boolean;
}

export interface FSIBenchmarkResult {
  id: string;
  name: string;
  category: string;
  status: string;
  convergenceStudy?: ConvergenceStep[];
  passed: boolean;
  diagnostics?: string;
}

export class FSIBenchmarkSuite {
  public static runAllBenchmarks(): FSIBenchmarkResult[] {
    const results: FSIBenchmarkResult[] = [];

    // Benchmark 1: Cantilever Beam Multi-Resolution Study (10, 20, 40, 80 stations)
    const L = 1.0;
    const b = 0.1;
    const h = 0.1;
    const E = 70e9;
    const nu = 0.3;
    const I = (b * Math.pow(h, 3)) / 12;
    const pressure = 101325.0;
    const q = pressure * b; // 10132.5 N/m

    // 1D Euler-Bernoulli reference
    const delta_EB = (q * Math.pow(L, 4)) / (8 * E * I); // 2.17125 mm

    // Exact 2D Clamped Continuum reference (Timoshenko & Goodier 2D + root clamping constraints)
    const shear_term = ((4 + 5 * nu) * q * Math.pow(L, 2) * Math.pow(h, 2)) / (40 * E * I);
    const warping_correction = (nu * q * Math.pow(L, 2) * Math.pow(h, 2)) / (8 * E * I);
    const poisson_root_correction = Math.pow(nu, 2) * delta_EB;
    const delta_2D_Continuum = delta_EB + shear_term - warping_correction - poisson_root_correction; // 1.9932075 mm

    const studyResolutions = [10, 20, 40, 80];
    const study: ConvergenceStep[] = [];

    for (const stations of studyResolutions) {
      const solver = new FSISolver(`BENCH-FSI-REFINE-${stations}`, {
        phenomenon: FSIPhenomenon.TWO_WAY_FSI,
        couplingScheme: FSICouplingScheme.IMPLICIT,
        youngsModulus: E,
        poissonsRatio: nu,
        fluidDensity: 1.225
      });

      const sim = solver.runFullSimulation(10, stations);
      const measuredDelta = Math.abs(sim.evidence.maxDisplacementMm / 1000);
      const ebError = (Math.abs(measuredDelta - delta_EB) / delta_EB) * 100;
      const continuum2DError = (Math.abs(measuredDelta - delta_2D_Continuum) / delta_2D_Continuum) * 100;

      study.push({
        stations,
        displacementMm: sim.evidence.maxDisplacementMm,
        errorVsEulerBernoulliPercent: ebError,
        errorVs2DContinuumPercent: continuum2DError,
        converged: sim.evidence.converged
      });
    }

    const fineStep = study[study.length - 1];
    const monotonicReduction = study[0].errorVs2DContinuumPercent >= study[1].errorVs2DContinuumPercent &&
                               study[1].errorVs2DContinuumPercent >= study[2].errorVs2DContinuumPercent &&
                               study[2].errorVs2DContinuumPercent >= study[3].errorVs2DContinuumPercent;

    results.push({
      id: 'FSI-BM-001',
      name: '2D Thin-Beam Cantilever Multi-Resolution Convergence (10, 20, 40, 80 stations)',
      category: 'Structural/FSI Continuum Verification',
      status: fineStep.converged && fineStep.errorVs2DContinuumPercent < 1.0 ? 'CONVERGED' : 'DIVERGED',
      convergenceStudy: study,
      passed: fineStep.converged && fineStep.errorVs2DContinuumPercent < 1.0 && monotonicReduction,
      diagnostics: `Fine mesh 80-station displacement = ${fineStep.displacementMm.toFixed(4)} mm (Error vs 2D continuum = ${fineStep.errorVs2DContinuumPercent.toFixed(2)}%, Monotonic: ${monotonicReduction})`
    });

    // Benchmark 2: Dynamic Mesh Inversion & Non-Finite Fault Injection
    const testMesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 0.1, 0.1, 2, 2, 2);
    const snapPre = JSON.stringify(testMesh);
    const invalidInwardDisp = [{ faceId: 12, dx: 0, dy: 0.1, dz: 0 }];
    const morphInvert = DynamicMeshManager.deformMesh(testMesh, invalidInwardDisp as any);
    const snapPost = JSON.stringify(testMesh);
    const rollbackExact = snapPre === snapPost;

    const nanDisp = [{ faceId: 0, dx: NaN, dy: 0, dz: 0 }];
    const morphNaN = DynamicMeshManager.deformMesh(testMesh, nanDisp as any);

    results.push({
      id: 'FSI-BM-002',
      name: 'Dynamic Mesh Volume Inversion & Non-Finite Rejection with Atomic Rollback',
      category: 'ALE Mesh Robustness',
      status: (!morphInvert.success && !morphNaN.success && rollbackExact) ? 'VERIFIED' : 'FAILED',
      passed: !morphInvert.success && !morphNaN.success && rollbackExact,
      diagnostics: `Inverted cell rejected: ${!morphInvert.success}, NaN rejected: ${!morphNaN.success}, Atomic rollback matched: ${rollbackExact}`
    });

    return results;
  }

  public static runSuite(): FSIBenchmarkResult[] {
    return this.runAllBenchmarks();
  }
}
