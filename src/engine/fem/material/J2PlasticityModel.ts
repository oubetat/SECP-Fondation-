import { Matrix } from "../core/MathUtils";
import { MaterialTolerancePolicy } from "./MaterialTolerancePolicy";
import { MaterialState } from "./MaterialState";
import {
  ConstitutiveUpdateResult,
  J2MaterialParameters,
  MaterialConvergenceVerdict,
  MaterialIncrement,
  MaterialParameters,
  MaterialStatus,
  ParameterValidationResult,
  StressTensorType
} from "./types";

export class J2PlasticityModel {
  readonly modelId: string;
  readonly modelType = 'J2_ISOTROPIC_ELASTOPLASTIC';
  readonly params: J2MaterialParameters;
  readonly planeState: StressTensorType;

  readonly E: number;
  readonly nu: number;
  readonly yieldStress: number;
  readonly hardeningModulus: number;
  readonly G: number;
  readonly K: number;
  readonly lambda: number;

  private tolerancePolicy: MaterialTolerancePolicy;

  constructor(params: J2MaterialParameters, modelId: string = 'J2_MODEL_01', tolerancePolicy?: MaterialTolerancePolicy) {
    const val = J2PlasticityModel.validateParameters(params);
    if (!val.isValid) {
      throw new Error(`Invalid J2 material parameters: ${val.errors.join("; ")}`);
    }

    this.modelId = modelId;
    this.params = { ...params };
    this.planeState = params.planeState || '3D';
    this.tolerancePolicy = tolerancePolicy || MaterialTolerancePolicy.getDefault();

    this.E = params.E;
    this.nu = params.nu;
    this.yieldStress = params.yieldStress;
    this.hardeningModulus = params.hardeningModulus;

    this.G = this.E / (2.0 * (1.0 + this.nu));
    this.K = this.E / (3.0 * (1.0 - 2.0 * this.nu));
    this.lambda = this.K - (2.0 / 3.0) * this.G;
  }

  static validateParameters(params: Partial<J2MaterialParameters>): ParameterValidationResult {
    const errors: string[] = [];

    if (params.E === undefined || Number.isNaN(params.E) || !Number.isFinite(params.E) || params.E <= 0) {
      errors.push(`Young's modulus E must be finite and positive (got ${params.E})`);
    }

    if (params.nu === undefined || Number.isNaN(params.nu) || !Number.isFinite(params.nu) || params.nu <= -1.0 || params.nu >= 0.5) {
      errors.push(`Poisson's ratio nu must be in (-1.0, 0.5) for positive definite elasticity (got ${params.nu})`);
    }

    if (params.yieldStress === undefined || Number.isNaN(params.yieldStress) || !Number.isFinite(params.yieldStress) || params.yieldStress <= 0) {
      errors.push(`Initial yield stress yieldStress must be finite and positive (got ${params.yieldStress})`);
    }

    if (params.hardeningModulus === undefined || Number.isNaN(params.hardeningModulus) || !Number.isFinite(params.hardeningModulus) || params.hardeningModulus < 0) {
      errors.push(`Hardening modulus H must be non-negative (got ${params.hardeningModulus})`);
    }

    let bulkModulus: number | undefined;
    let shearModulus: number | undefined;
    let lameFirstParam: number | undefined;

    if (errors.length === 0 && params.E !== undefined && params.nu !== undefined) {
      shearModulus = params.E / (2.0 * (1.0 + params.nu));
      bulkModulus = params.E / (3.0 * (1.0 - 2.0 * params.nu));
      lameFirstParam = bulkModulus - (2.0 / 3.0) * shearModulus;

      if (shearModulus <= 0 || bulkModulus <= 0) {
        errors.push("Derived shear or bulk modulus is non-positive");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      bulkModulus,
      shearModulus,
      lameFirstParam
    };
  }

  /**
   * Returns dimension of stress/strain Voigt representation:
   * 1D = 1
   * 2D = 3 [xx, yy, xy]
   * 3D = 6 [xx, yy, zz, yz, xz, xy]
   */
  getDimension(): number {
    if (this.planeState === '1D') return 1;
    if (this.planeState === '2D_PLANE_STRESS' || this.planeState === '2D_PLANE_STRAIN') return 3;
    return 6;
  }

  /**
   * Elastic stiffness matrix C_e
   */
  getElasticMatrix(): Matrix {
    if (this.planeState === '1D') {
      return new Matrix(1, 1, [[this.E]]);
    }

    if (this.planeState === '2D_PLANE_STRESS') {
      const factor = this.E / (1.0 - this.nu * this.nu);
      return new Matrix(3, 3, [
        [factor, factor * this.nu, 0.0],
        [factor * this.nu, factor, 0.0],
        [0.0, 0.0, factor * 0.5 * (1.0 - this.nu)]
      ]);
    }

    if (this.planeState === '2D_PLANE_STRAIN') {
      const factor = this.E / ((1.0 + this.nu) * (1.0 - 2.0 * this.nu));
      return new Matrix(3, 3, [
        [factor * (1.0 - this.nu), factor * this.nu, 0.0],
        [factor * this.nu, factor * (1.0 - this.nu), 0.0],
        [0.0, 0.0, factor * 0.5 * (1.0 - 2.0 * this.nu)]
      ]);
    }

    // 3D isotropic constitutive
    const D = Matrix.zeros(6, 6);
    const c1 = this.lambda + 2.0 * this.G;
    const c2 = this.lambda;
    const c3 = this.G;

    D.set(0, 0, c1); D.set(0, 1, c2); D.set(0, 2, c2);
    D.set(1, 0, c2); D.set(1, 1, c1); D.set(1, 2, c2);
    D.set(2, 0, c2); D.set(2, 1, c2); D.set(2, 2, c1);
    D.set(3, 3, c3); // G_yz
    D.set(4, 4, c3); // G_xz
    D.set(5, 5, c3); // G_xy

    return D;
  }

  /**
   * Evaluates the deviatoric split of a 3D stress vector.
   * stress = [sxx, syy, szz, tyz, txz, txy]
   * returns { p, s, trace, isDeviatoricTraceZero }
   */
  computeDeviatoricStress(stress: number[]): { p: number; s: number[]; trace: number; isDeviatoricTraceZero: boolean } {
    if (stress.length === 1) {
      const p = stress[0] / 3.0;
      const s = [(2.0 / 3.0) * stress[0]];
      return { p, s, trace: s[0], isDeviatoricTraceZero: true };
    }

    const sxx = stress[0];
    const syy = stress[1];
    const szz = stress.length > 2 ? stress[2] : 0.0;
    const tyz = stress.length > 3 ? stress[3] : 0.0;
    const txz = stress.length > 4 ? stress[4] : 0.0;
    const txy = stress.length === 3 ? stress[2] : (stress.length > 5 ? stress[5] : 0.0);

    const p = (sxx + syy + szz) / 3.0;
    const s = [
      sxx - p,
      syy - p,
      szz - p,
      tyz,
      txz,
      txy
    ];

    const trace = s[0] + s[1] + s[2];
    const stressMag = Math.sqrt(sxx * sxx + syy * syy + szz * szz + tyz * tyz + txz * txz + txy * txy) + 1.0;
    const isDeviatoricTraceZero = Math.abs(trace) / stressMag <= this.tolerancePolicy.traceTolerance || Math.abs(trace) <= 1e-6;

    return { p, s, trace, isDeviatoricTraceZero };
  }

  /**
   * Computes von Mises equivalent stress from 3D stress vector or deviatoric stress.
   * Hydrostatic invariance: sigma -> sigma + p_hydro * I yields identical von Mises stress.
   */
  computeVonMisesStress(stress: number[]): number {
    if (stress.length === 1) {
      return Math.abs(stress[0]);
    }

    const { s } = this.computeDeviatoricStress(stress);
    // J2 = 0.5 * (s_xx^2 + s_yy^2 + s_zz^2 + 2*s_yz^2 + 2*s_xz^2 + 2*s_xy^2)
    const J2 = 0.5 * (
      s[0] * s[0] +
      s[1] * s[1] +
      s[2] * s[2] +
      2.0 * (s[3] * s[3] + s[4] * s[4] + s[5] * s[5])
    );

    const vm = Math.sqrt(Math.max(0.0, 3.0 * J2));
    return vm;
  }

  /**
   * Evaluates yield function: f(sigma, kappa) = sigma_vm - (sigma_y0 + H * kappa)
   */
  evaluateYieldFunction(stress: number[], equivalentPlasticStrain: number): number {
    const vm = this.computeVonMisesStress(stress);
    const currentYieldStress = this.yieldStress + this.hardeningModulus * Math.max(0.0, equivalentPlasticStrain);
    return vm - currentYieldStress;
  }

  /**
   * Radial Return Mapping Constitutive Update (3D / 1D / Plane Strain).
   */
  updateConstitutive(
    strainIncrement: number[],
    previousState: MaterialState
  ): ConstitutiveUpdateResult {
    // 1. Validate inputs
    const dim = this.getDimension();
    if (strainIncrement.length !== dim) {
      return this.createFailureResult(
        previousState,
        'INVALID_STATE',
        `Strain increment dimension mismatch: expected ${dim}, got ${strainIncrement.length}`
      );
    }

    for (let i = 0; i < dim; i++) {
      if (Number.isNaN(strainIncrement[i]) || !Number.isFinite(strainIncrement[i])) {
        return this.createFailureResult(previousState, 'INVALID_PARAMETERS', `NaN or Inf in strainIncrement at ${i}`);
      }
    }

    // 2. Elastic Predictor
    const Ce = this.getElasticMatrix();
    const totalStrainTrial = previousState.totalStrain.map((v, i) => v + strainIncrement[i]);
    const elasticStrainTrial = previousState.elasticStrain.map((v, i) => v + strainIncrement[i]);
    const dSigmaTrial = Ce.multiplyVector(strainIncrement);
    const stressTrial = previousState.stress.map((v, i) => v + dSigmaTrial[i]);

    const kappaN = previousState.equivalentPlasticStrain;
    const fTrial = this.evaluateYieldFunction(stressTrial, kappaN);

    // Check if step is Elastic
    if (fTrial <= this.tolerancePolicy.yieldTolerance * this.yieldStress) {
      // Elastic step
      const elasticEnergy = 0.5 * stressTrial.reduce((sum, s_i, idx) => sum + s_i * elasticStrainTrial[idx], 0.0);
      const isUnloading = kappaN > 0.0 && fTrial < -1e-6;

      return {
        stress: stressTrial,
        elasticStrain: elasticStrainTrial,
        plasticStrain: [...previousState.plasticStrain],
        equivalentPlasticStrain: kappaN,
        plasticMultiplier: 0.0,
        yieldFunctionValue: fTrial,
        materialStatus: isUnloading ? 'UNLOADING' : 'ELASTIC',
        tangent: Ce,
        plasticDissipationIncrement: 0.0,
        elasticEnergy: Math.max(0.0, elasticEnergy),
        iterations: 1,
        initialResidual: fTrial,
        finalResidual: fTrial,
        converged: true,
        verdict: 'CONVERGED'
      };
    }

    // 3. Plastic Step — Radial Return Mapping
    if (this.planeState === '1D') {
      return this.returnMapping1D(stressTrial[0], elasticStrainTrial[0], previousState, strainIncrement[0], totalStrainTrial[0]);
    }

    return this.returnMapping3D(stressTrial, elasticStrainTrial, previousState, strainIncrement, totalStrainTrial, Ce, fTrial);
  }

  private returnMapping1D(
    stressTrial: number,
    elasticStrainTrial: number,
    previousState: MaterialState,
    dEps: number,
    totalStrain: number
  ): ConstitutiveUpdateResult {
    const sgn = stressTrial >= 0 ? 1.0 : -1.0;
    const kappaN = previousState.equivalentPlasticStrain;
    const currentYield = this.yieldStress + this.hardeningModulus * kappaN;
    const fTrial = Math.abs(stressTrial) - currentYield;

    const denominator = this.E + this.hardeningModulus;
    const deltaGamma = fTrial / denominator;

    const kappaNew = kappaN + deltaGamma;
    const deltaPlasticStrain = deltaGamma * sgn;
    const plasticStrainNew = previousState.plasticStrain[0] + deltaPlasticStrain;
    const elasticStrainNew = totalStrain - plasticStrainNew;
    const stressNew = (currentYield + this.hardeningModulus * deltaGamma) * sgn;

    // Consistent tangent
    const Et = (this.E * this.hardeningModulus) / (this.E + this.hardeningModulus);
    const tangent = new Matrix(1, 1, [[Et]]);

    // Dissipation increment: average stress * delta eps_p
    const avgStress = 0.5 * (previousState.stress[0] + stressNew);
    const dDissipation = avgStress * deltaPlasticStrain;
    if (dDissipation < -this.tolerancePolicy.energyTolerance) {
      return this.createFailureResult(previousState, 'PHYSICS_FAILURE', `Negative plastic dissipation in 1D: ${dDissipation}`);
    }

    const elasticEnergy = 0.5 * stressNew * elasticStrainNew;
    const finalResidual = Math.abs(stressNew) - (this.yieldStress + this.hardeningModulus * kappaNew);
    const converged = Math.abs(finalResidual) / (currentYield + 1.0) <= this.tolerancePolicy.returnMappingTolerance || Math.abs(finalResidual) <= 1e-4;

    return {
      stress: [stressNew],
      elasticStrain: [elasticStrainNew],
      plasticStrain: [plasticStrainNew],
      equivalentPlasticStrain: kappaNew,
      plasticMultiplier: deltaGamma,
      yieldFunctionValue: finalResidual,
      materialStatus: 'PLASTIC',
      tangent,
      plasticDissipationIncrement: Math.max(0.0, dDissipation),
      elasticEnergy: Math.max(0.0, elasticEnergy),
      iterations: 1,
      initialResidual: fTrial,
      finalResidual,
      converged,
      verdict: converged ? 'CONVERGED' : 'NOT_CONVERGED'
    };
  }

  private returnMapping3D(
    stressTrial: number[],
    elasticStrainTrial: number[],
    previousState: MaterialState,
    strainIncrement: number[],
    totalStrainTrial: number[],
    Ce: Matrix,
    fTrial: number
  ): ConstitutiveUpdateResult {
    const { p: pTrial, s: sTrial } = this.computeDeviatoricStress(stressTrial);
    const vmTrial = this.computeVonMisesStress(stressTrial);

    if (vmTrial < 1e-12) {
      // Hydrostatic state — no plastic deviatoric flow
      return {
        stress: stressTrial,
        elasticStrain: elasticStrainTrial,
        plasticStrain: [...previousState.plasticStrain],
        equivalentPlasticStrain: previousState.equivalentPlasticStrain,
        plasticMultiplier: 0.0,
        yieldFunctionValue: fTrial,
        materialStatus: 'ELASTIC',
        tangent: Ce,
        plasticDissipationIncrement: 0.0,
        elasticEnergy: 0.5 * stressTrial.reduce((a, b, idx) => a + b * elasticStrainTrial[idx], 0.0),
        iterations: 1,
        initialResidual: fTrial,
        finalResidual: fTrial,
        converged: true,
        verdict: 'CONVERGED'
      };
    }

    const kappaN = previousState.equivalentPlasticStrain;
    // Closed-form exact delta gamma for linear isotropic hardening J2 plasticity:
    // f_trial - (3G + H) * deltaGamma = 0
    const denominator = 3.0 * this.G + this.hardeningModulus;
    const deltaGamma = fTrial / denominator;

    if (deltaGamma < 0 || Number.isNaN(deltaGamma) || !Number.isFinite(deltaGamma)) {
      return this.createFailureResult(previousState, 'NUMERICAL_FAILURE', `Invalid plastic multiplier deltaGamma = ${deltaGamma}`);
    }

    // Radial scaling of deviatoric stress
    const factor = 1.0 - (3.0 * this.G * deltaGamma) / vmTrial;
    const sNew = sTrial.map(v => v * factor);

    // Corrected 3D stress = sNew + pTrial * I
    const stressNew = [
      sNew[0] + pTrial,
      sNew[1] + pTrial,
      sNew[2] + pTrial,
      sNew[3],
      sNew[4],
      sNew[5]
    ];

    // Plastic strain increment (engineering Voigt format)
    const normalCoeff = (3.0 * deltaGamma) / (2.0 * vmTrial);
    const dEpsPlastic = [
      normalCoeff * sTrial[0],
      normalCoeff * sTrial[1],
      normalCoeff * sTrial[2],
      2.0 * normalCoeff * sTrial[3], // Voigt engineering shear
      2.0 * normalCoeff * sTrial[4],
      2.0 * normalCoeff * sTrial[5]
    ];

    const plasticStrainNew = previousState.plasticStrain.map((v, i) => v + dEpsPlastic[i]);
    const elasticStrainNew = totalStrainTrial.map((v, i) => v - plasticStrainNew[i]);
    const kappaNew = kappaN + deltaGamma;

    // Consistency check: f(sigma_new, kappa_new) approx 0
    const vmNew = this.computeVonMisesStress(stressNew);
    const finalYield = this.yieldStress + this.hardeningModulus * kappaNew;
    const finalResidual = vmNew - finalYield;

    // Plastic dissipation increment: sigma_avg : dEpsPlastic
    let dDissipation = 0.0;
    for (let i = 0; i < 3; i++) {
      const avgS = 0.5 * (previousState.stress[i] + stressNew[i]);
      dDissipation += avgS * dEpsPlastic[i];
    }
    for (let i = 3; i < 6; i++) {
      const avgS = 0.5 * (previousState.stress[i] + stressNew[i]);
      dDissipation += avgS * dEpsPlastic[i]; // engineering shear work is tau * gamma
    }

    if (dDissipation < -this.tolerancePolicy.energyTolerance) {
      return this.createFailureResult(previousState, 'PHYSICS_FAILURE', `Negative plastic work dissipation: ${dDissipation}`);
    }

    // Elastic strain energy
    const elasticEnergy = 0.5 * (
      stressNew[0] * elasticStrainNew[0] +
      stressNew[1] * elasticStrainNew[1] +
      stressNew[2] * elasticStrainNew[2] +
      stressNew[3] * elasticStrainNew[3] +
      stressNew[4] * elasticStrainNew[4] +
      stressNew[5] * elasticStrainNew[5]
    );

    // Compute algorithmic consistent elastoplastic tangent Cep
    const Cep = this.computeConsistentTangent3D(sTrial, vmTrial, deltaGamma);

    const converged = Math.abs(finalResidual) / finalYield <= this.tolerancePolicy.returnMappingTolerance || Math.abs(finalResidual) <= 1e-4;

    return {
      stress: stressNew,
      elasticStrain: elasticStrainNew,
      plasticStrain: plasticStrainNew,
      equivalentPlasticStrain: kappaNew,
      plasticMultiplier: deltaGamma,
      yieldFunctionValue: finalResidual,
      materialStatus: 'PLASTIC',
      tangent: Cep,
      plasticDissipationIncrement: Math.max(0.0, dDissipation),
      elasticEnergy: Math.max(0.0, elasticEnergy),
      iterations: 1,
      initialResidual: fTrial,
      finalResidual,
      converged,
      verdict: converged ? 'CONVERGED' : 'NOT_CONVERGED'
    };
  }

  /**
   * Computes the algorithmic consistent tangent matrix Cep in Voigt form.
   * Simo & Hughes formulation.
   */
  computeConsistentTangent3D(sTrial: number[], vmTrial: number, deltaGamma: number): Matrix {
    const Cep = Matrix.zeros(6, 6);

    const beta = 1.0 - (3.0 * this.G * deltaGamma) / vmTrial;
    const gammaBar = (3.0 * this.G) / (3.0 * this.G + this.hardeningModulus) - (1.0 - beta);

    const K = this.K;
    const twoG_beta = 2.0 * this.G * beta;
    const plasticScale = (3.0 * this.G * gammaBar) / (vmTrial * vmTrial);

    // Elastic matrix with G*beta
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let val = K - (twoG_beta / 3.0);
        if (i === j) val += twoG_beta;
        Cep.set(i, j, val);
      }
    }

    Cep.set(3, 3, this.G * beta);
    Cep.set(4, 4, this.G * beta);
    Cep.set(5, 5, this.G * beta);

    // Subtract plastic return mapping term: (3G * gammaBar / vmTrial^2) * sTrial_i * sTrial_j
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        const current = Cep.get(i, j);
        const plasticTerm = plasticScale * sTrial[i] * sTrial[j];
        Cep.set(i, j, current - plasticTerm);
      }
    }

    return Cep;
  }

  /**
   * Finite difference numerical tangent validation:
   * [sigma(eps + dEps) - sigma(eps)] / dEps vs Cep * dEps
   */
  validateTangentByFiniteDifference(
    previousState: MaterialState,
    baseIncrement: number[],
    perturbation: number = 1e-7
  ): {
    isValid: boolean;
    relativeError: number;
    numericalTangent: Matrix;
    analyticalTangent: Matrix;
    symmetryError: number;
  } {
    const baseResult = this.updateConstitutive(baseIncrement, previousState);
    const analyticalTangent = baseResult.tangent;
    const dim = this.getDimension();

    const numericalTangent = Matrix.zeros(dim, dim);

    for (let j = 0; j < dim; j++) {
      const perturbedIncrement = [...baseIncrement];
      perturbedIncrement[j] += perturbation;

      const perturbedResult = this.updateConstitutive(perturbedIncrement, previousState);

      for (let i = 0; i < dim; i++) {
        const dSigma = (perturbedResult.stress[i] - baseResult.stress[i]) / perturbation;
        numericalTangent.set(i, j, dSigma);
      }
    }

    // Compute relative Frobenius norm error
    let diffNormSq = 0.0;
    let analNormSq = 0.0;
    let symDiffNormSq = 0.0;

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const diff = numericalTangent.get(i, j) - analyticalTangent.get(i, j);
        diffNormSq += diff * diff;
        analNormSq += analyticalTangent.get(i, j) * analyticalTangent.get(i, j);

        const symDiff = analyticalTangent.get(i, j) - analyticalTangent.get(j, i);
        symDiffNormSq += symDiff * symDiff;
      }
    }

    const relativeError = Math.sqrt(diffNormSq) / (Math.sqrt(analNormSq) + 1e-12);
    const symmetryError = Math.sqrt(symDiffNormSq) / (Math.sqrt(analNormSq) + 1e-12);

    return {
      isValid: relativeError <= this.tolerancePolicy.tangentTolerance,
      relativeError,
      numericalTangent,
      analyticalTangent,
      symmetryError
    };
  }

  private createFailureResult(
    previousState: MaterialState,
    verdict: MaterialConvergenceVerdict,
    diagnostics: string
  ): ConstitutiveUpdateResult {
    return {
      stress: [...previousState.stress],
      elasticStrain: [...previousState.elasticStrain],
      plasticStrain: [...previousState.plasticStrain],
      equivalentPlasticStrain: previousState.equivalentPlasticStrain,
      plasticMultiplier: 0.0,
      yieldFunctionValue: NaN,
      materialStatus: 'FAILED',
      tangent: this.getElasticMatrix(),
      plasticDissipationIncrement: 0.0,
      elasticEnergy: previousState.elasticEnergy,
      iterations: 0,
      initialResidual: NaN,
      finalResidual: NaN,
      converged: false,
      verdict,
      diagnostics
    };
  }
}
