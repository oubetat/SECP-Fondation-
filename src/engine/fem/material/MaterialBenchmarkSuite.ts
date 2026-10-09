import { J2PlasticityModel } from "./J2PlasticityModel";
import { MaterialState } from "./MaterialState";
import { IndependentPlasticityReference } from "./IndependentPlasticityReference";
import { MaterialSubstepController } from "./MaterialSubstepController";
import { MaterialTolerancePolicy } from "./MaterialTolerancePolicy";
import { IndependentPlasticWorkAudit } from "./IndependentPlasticWorkAudit";

export interface BenchmarkReport {
  name: string;
  passed: boolean;
  maxError: number;
  tolerance: number;
  details: string;
}

export interface MaterialBenchmarkSummary {
  allPassed: boolean;
  totalBenchmarks: number;
  passedCount: number;
  failedCount: number;
  reports: BenchmarkReport[];
  executionTimeMs: number;
}

export class MaterialBenchmarkSuite {
  /**
   * 1. Uniaxial Tension Benchmark (Analytical Reference Comparison)
   */
  static runUniaxialTensionBenchmark(): BenchmarkReport {
    const E = 200e9;
    const nu = 0.3;
    const yieldStress = 250e6;
    const H = 20e9;

    const model = new J2PlasticityModel({
      E,
      nu,
      yieldStress,
      hardeningModulus: H,
      planeState: '3D'
    });

    const strainLevels = [0.0005, 0.0010, 0.00125, 0.0020, 0.0050, 0.0100];
    let maxError = 0.0;
    let state = MaterialState.createInitial(6);

    for (let k = 0; k < strainLevels.length; k++) {
      const epsX = strainLevels[k];
      const prevEpsX = state.totalStrain[0];
      const dEpsX = epsX - prevEpsX;

      // In 3D uniaxial tension, lateral strains occur due to Poisson: dEpsY = dEpsZ = -nu * dEpsX (elastic) or -0.5 (plastic)
      // We apply uniaxial stress update via 1D sub-model or directly test 1D
      const model1D = new J2PlasticityModel({
        E,
        nu,
        yieldStress,
        hardeningModulus: H,
        planeState: '1D'
      });

      const state1D = MaterialState.createInitial(1);
      const res = model1D.updateConstitutive([epsX], state1D);
      const ref = IndependentPlasticityReference.solveUniaxialTension(epsX, E, yieldStress, H);

      const stressError = Math.abs(res.stress[0] - ref.stress) / ref.stress;
      const plasticStrainError = Math.abs(res.plasticStrain[0] - ref.plasticStrain);

      maxError = Math.max(maxError, stressError, plasticStrainError);
    }

    const tol = 1e-6;
    return {
      name: "UNIAXIAL_TENSION_ANALYTICAL",
      passed: maxError <= tol,
      maxError,
      tolerance: tol,
      details: `Max relative error against analytical closed-form: ${maxError.toExponential(4)}`
    };
  }

  /**
   * 2. Uniaxial Compression Benchmark
   */
  static runUniaxialCompressionBenchmark(): BenchmarkReport {
    const E = 210e9;
    const nu = 0.28;
    const yieldStress = 300e6;
    const H = 15e9;

    const model = new J2PlasticityModel({
      E,
      nu,
      yieldStress,
      hardeningModulus: H,
      planeState: '1D'
    });

    const epsC = -0.005; // Compression
    const state = MaterialState.createInitial(1);
    const res = model.updateConstitutive([epsC], state);
    const ref = IndependentPlasticityReference.solveUniaxialTension(epsC, E, yieldStress, H);

    const stressError = Math.abs(res.stress[0] - ref.stress) / Math.abs(ref.stress);
    const plasticStrainError = Math.abs(res.plasticStrain[0] - ref.plasticStrain);
    const maxError = Math.max(stressError, plasticStrainError);

    const tol = 1e-6;
    return {
      name: "UNIAXIAL_COMPRESSION_ANALYTICAL",
      passed: maxError <= tol && res.stress[0] < 0,
      maxError,
      tolerance: tol,
      details: `Symmetric compressive yield stress verified. Rel error: ${maxError.toExponential(4)}`
    };
  }

  /**
   * 3. Pure Shear Benchmark
   */
  static runPureShearBenchmark(): BenchmarkReport {
    const E = 200e9;
    const nu = 0.3;
    const G = E / (2.0 * (1.0 + nu));
    const yieldStress = 250e6;
    const H = 10e9;

    const model = new J2PlasticityModel({
      E,
      nu,
      yieldStress,
      hardeningModulus: H,
      planeState: '3D'
    });

    const shearGammas = [0.001, 0.002, 0.005, 0.01];
    let maxError = 0.0;

    for (const gamma of shearGammas) {
      // Pure shear in xy plane: strain = [0, 0, 0, 0, 0, gamma]
      const state = MaterialState.createInitial(6);
      const res = model.updateConstitutive([0, 0, 0, 0, 0, gamma], state);
      const ref = IndependentPlasticityReference.solvePureShear(gamma, G, yieldStress, H);

      const tauComputed = res.stress[5];
      const tauError = Math.abs(tauComputed - ref.tau) / Math.abs(ref.tau);
      maxError = Math.max(maxError, tauError);
    }

    const tol = 1e-5;
    return {
      name: "PURE_SHEAR_ANALYTICAL",
      passed: maxError <= tol,
      maxError,
      tolerance: tol,
      details: `Pure shear yield at tau_y = sigma_y / sqrt(3). Max error: ${maxError.toExponential(4)}`
    };
  }

  /**
   * 4. Hydrostatic Invariance Benchmark
   */
  static runHydrostaticInvarianceBenchmark(): BenchmarkReport {
    const model = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 250e6,
      hardeningModulus: 10e9,
      planeState: '3D'
    });

    // Pure volumetric strain: eps_xx = eps_yy = eps_zz = 0.01 (huge hydrostatic pressure)
    const volumetricStrain = [0.01, 0.01, 0.01, 0, 0, 0];
    const state = MaterialState.createInitial(6);
    const res = model.updateConstitutive(volumetricStrain, state);

    const devSplit = model.computeDeviatoricStress(res.stress);
    const vm = model.computeVonMisesStress(res.stress);

    const passed = vm <= 1e-4 && res.equivalentPlasticStrain === 0.0 && res.materialStatus === 'ELASTIC';

    return {
      name: "HYDROSTATIC_INVARIANCE",
      passed,
      maxError: vm,
      tolerance: 1e-4,
      details: `Pure volumetric loading produced von Mises = ${vm.toExponential(4)} Pa (zero plastic yield).`
    };
  }

  /**
   * 5. Loading / Unloading / Reloading Cycle Benchmark
   */
  static runLoadingUnloadingBenchmark(): BenchmarkReport {
    const E = 200e9;
    const yieldStress = 200e6;
    const H = 20e9;

    const model = new J2PlasticityModel({
      E,
      nu: 0.3,
      yieldStress,
      hardeningModulus: H,
      planeState: '1D'
    });

    let state = MaterialState.createInitial(1);

    // 1. Load into plastic region (eps = 0.003)
    const res1 = model.updateConstitutive([0.003], state);
    state = new MaterialState({
      ...state,
      stress: res1.stress,
      totalStrain: [0.003],
      elasticStrain: res1.elasticStrain,
      plasticStrain: res1.plasticStrain,
      equivalentPlasticStrain: res1.equivalentPlasticStrain,
      plasticDissipation: res1.plasticDissipationIncrement,
      elasticEnergy: res1.elasticEnergy,
      materialStatus: res1.materialStatus
    });

    // 2. Unload elastically back to eps = 0.002
    const res2 = model.updateConstitutive([-0.001], state);
    const expectedUnloadedStress = res1.stress[0] - E * 0.001;
    const unloadSlopeError = Math.abs(res2.stress[0] - expectedUnloadedStress) / expectedUnloadedStress;

    const passed = unloadSlopeError <= 1e-6 && res2.materialStatus === 'UNLOADING' && res2.equivalentPlasticStrain === res1.equivalentPlasticStrain;

    return {
      name: "LOADING_UNLOADING_CYCLE",
      passed,
      maxError: unloadSlopeError,
      tolerance: 1e-6,
      details: `Elastic unloading slope E verified with zero additional plastic strain.`
    };
  }

  /**
   * 6. Path Dependence Benchmark (Path A vs Path B)
   */
  static runPathDependenceBenchmark(): BenchmarkReport {
    const model = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 250e6,
      hardeningModulus: 20e9,
      planeState: '3D'
    });

    const targetStrain = [0.004, 0.0, 0.0, 0.0, 0.0, 0.005];

    // Path A: Single straight step to target
    const stateA0 = MaterialState.createInitial(6);
    const resA = model.updateConstitutive(targetStrain, stateA0);

    // Path B: Step 1 = pure shear (0.005), Step 2 = axial strain (0.004)
    const stateB0 = MaterialState.createInitial(6);
    const resB1 = model.updateConstitutive([0, 0, 0, 0, 0, 0.005], stateB0);
    const stateB1 = new MaterialState({
      ...stateB0,
      stress: resB1.stress,
      totalStrain: [0, 0, 0, 0, 0, 0.005],
      elasticStrain: resB1.elasticStrain,
      plasticStrain: resB1.plasticStrain,
      equivalentPlasticStrain: resB1.equivalentPlasticStrain,
      plasticDissipation: resB1.plasticDissipationIncrement,
      elasticEnergy: resB1.elasticEnergy,
      materialStatus: resB1.materialStatus
    });

    const resB2 = model.updateConstitutive([0.004, 0, 0, 0, 0, 0], stateB1);

    // Difference in plastic dissipation / state
    const dissDiff = Math.abs(resA.plasticDissipationIncrement - (resB1.plasticDissipationIncrement + resB2.plasticDissipationIncrement));
    const stressDiff = Math.abs(resA.stress[0] - resB2.stress[0]) + Math.abs(resA.stress[5] - resB2.stress[5]);

    const isPathDependent = dissDiff > 1e-3 || stressDiff > 1e3;

    return {
      name: "PATH_DEPENDENCE_VERIFICATION",
      passed: isPathDependent,
      maxError: 0.0,
      tolerance: 0.0,
      details: `Path A vs Path B yielded distinct plastic history and dissipation (dissDiff=${dissDiff.toFixed(2)} J).`
    };
  }

  /**
   * 7. Algorithmic Consistent Tangent Finite Difference Benchmark
   */
  static runTangentFiniteDifferenceBenchmark(): BenchmarkReport {
    const model = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 250e6,
      hardeningModulus: 20e9,
      planeState: '3D'
    });

    const state = MaterialState.createInitial(6);
    const plasticStrainIncrement = [0.003, -0.0009, -0.0009, 0.001, 0.001, 0.002];

    const val = model.validateTangentByFiniteDifference(state, plasticStrainIncrement, 1e-7);

    return {
      name: "TANGENT_CONSISTENCY_FINITE_DIFFERENCE",
      passed: val.isValid && val.symmetryError <= 1e-8,
      maxError: val.relativeError,
      tolerance: 1e-4,
      details: `Finite-difference tangent relative error: ${val.relativeError.toExponential(4)}, symmetry error: ${val.symmetryError.toExponential(4)}`
    };
  }

  /**
   * 8. Perfect Plasticity (H = 0) Benchmark
   */
  static runPerfectPlasticityBenchmark(): BenchmarkReport {
    const yieldStress = 250e6;
    const model = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress,
      hardeningModulus: 0.0, // Perfect plasticity
      planeState: '1D'
    });

    const state = MaterialState.createInitial(1);
    const res = model.updateConstitutive([0.01], state); // 10x yield strain

    const stressError = Math.abs(res.stress[0] - yieldStress) / yieldStress;
    const tangentAtZeroH = res.tangent.get(0, 0);

    const passed = stressError <= 1e-8 && Math.abs(tangentAtZeroH) <= 1e-8;

    return {
      name: "PERFECT_PLASTICITY_H0",
      passed,
      maxError: stressError,
      tolerance: 1e-8,
      details: `With H=0, stress locked at yield stress (error=${stressError.toExponential(4)}) and Et = 0.`
    };
  }

  /**
   * 9. Pure Elastic Regression (High Yield Stress)
   */
  static runPureElasticRegression(): BenchmarkReport {
    const E = 200e9;
    const nu = 0.3;
    const model = new J2PlasticityModel({
      E,
      nu,
      yieldStress: 1e15, // Extremely high yield stress -> pure elastic
      hardeningModulus: 0.0,
      planeState: '3D'
    });

    const state = MaterialState.createInitial(6);
    const eps = [0.001, -0.0003, -0.0003, 0.0002, 0.0002, 0.0005];
    const res = model.updateConstitutive(eps, state);

    const Ce = model.getElasticMatrix();
    const expectedStress = Ce.multiplyVector(eps);

    let maxError = 0.0;
    for (let i = 0; i < 6; i++) {
      const err = Math.abs(res.stress[i] - expectedStress[i]) / (Math.abs(expectedStress[i]) + 1e-12);
      maxError = Math.max(maxError, err);
    }

    const passed = maxError <= 1e-10 && res.equivalentPlasticStrain === 0.0 && res.materialStatus === 'ELASTIC';

    return {
      name: "PURE_ELASTIC_REGRESSION",
      passed,
      maxError,
      tolerance: 1e-10,
      details: `Matches linear elastic Hookean response with zero plastic error: ${maxError.toExponential(4)}`
    };
  }

  /**
   * 10. Performance & Scaling Benchmark
   */
  static runScalingBenchmark(): BenchmarkReport {
    const model = new J2PlasticityModel({
      E: 200e9,
      nu: 0.3,
      yieldStress: 250e6,
      hardeningModulus: 20e9,
      planeState: '3D'
    });

    const pointCounts = [1, 10, 100, 1000, 5000];
    const t0 = performance.now();

    for (const count of pointCounts) {
      const state = MaterialState.createInitial(6);
      const dEps = [0.002, -0.0006, -0.0006, 0.0005, 0.0005, 0.001];
      for (let i = 0; i < count; i++) {
        model.updateConstitutive(dEps, state);
      }
    }

    const t1 = performance.now();
    const totalTimeMs = t1 - t0;
    const throughput = (6111 / (totalTimeMs / 1000)).toFixed(0);

    return {
      name: "PERFORMANCE_AND_SCALING",
      passed: totalTimeMs < 2000,
      maxError: 0.0,
      tolerance: 2000,
      details: `Evaluated 6,111 plastic constitutive points in ${totalTimeMs.toFixed(2)} ms (~${throughput} points/sec).`
    };
  }

  static runAllBenchmarks(): MaterialBenchmarkSummary {
    const t0 = performance.now();
    const reports: BenchmarkReport[] = [
      this.runUniaxialTensionBenchmark(),
      this.runUniaxialCompressionBenchmark(),
      this.runPureShearBenchmark(),
      this.runHydrostaticInvarianceBenchmark(),
      this.runLoadingUnloadingBenchmark(),
      this.runPathDependenceBenchmark(),
      this.runTangentFiniteDifferenceBenchmark(),
      this.runPerfectPlasticityBenchmark(),
      this.runPureElasticRegression(),
      this.runScalingBenchmark()
    ];
    const t1 = performance.now();

    const passedCount = reports.filter(r => r.passed).length;
    const failedCount = reports.length - passedCount;

    return {
      allPassed: failedCount === 0,
      totalBenchmarks: reports.length,
      passedCount,
      failedCount,
      reports,
      executionTimeMs: t1 - t0
    };
  }
}
