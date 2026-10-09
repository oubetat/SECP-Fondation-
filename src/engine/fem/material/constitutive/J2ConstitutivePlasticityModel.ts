/**
 * SECP CAD/CAE Platform - PATCH-233: J2 Constitutive Plasticity Model
 *
 * Implements non-linear J2 / von Mises Elastoplasticity with Radial Return Mapping:
 * - Yield stress sigma_y(bar_eps_p)
 * - Isotropic, Kinematic (Prager/Ziegler), Combined, and Perfect Plasticity
 * - Multi-point hardening curve interpolation (bar_eps_p -> yieldStress)
 * - Exact Algorithmic Consistent Tangent C_ep = d(sigma)/d(epsilon)
 * - Elastic predictor -> Yield function -> Return mapping pipeline
 */

import { ConstitutiveResponse, HardeningCurvePoint, MaterialConstitutiveDefinition, MaterialPointState } from './ConstitutiveTypes';
import { MaterialConstitutiveValidator } from './MaterialConstitutiveValidator';

export class J2ConstitutivePlasticityModel {
  public readonly E: number;
  public readonly nu: number;
  public readonly G: number;
  public readonly K: number;
  public readonly lambda: number;
  public readonly initialYieldStress: number;
  public readonly hardeningType: 'PERFECT' | 'ISOTROPIC' | 'KINEMATIC' | 'COMBINED';
  public readonly H_iso: number;
  public readonly C_kin: number;
  public readonly gamma_kin: number;
  public readonly hardeningCurve?: HardeningCurvePoint[];
  public readonly C_el: number[][];

  constructor(definition: MaterialConstitutiveDefinition) {
    const val = MaterialConstitutiveValidator.validate(definition);
    if (!val.isValid) {
      throw new Error(`Invalid J2 Plasticity Material definition: ${val.errors.map(e => e.reason).join('; ')}`);
    }

    this.E = definition.elastic.E!;
    this.nu = definition.elastic.nu!;
    this.G = this.E / (2.0 * (1.0 + this.nu));
    this.K = this.E / (3.0 * (1.0 - 2.0 * this.nu));
    this.lambda = (this.E * this.nu) / ((1.0 + this.nu) * (1.0 - 2.0 * this.nu));

    const p = definition.plastic!;
    this.initialYieldStress = p.initialYieldStress;
    this.hardeningType = p.hardeningType;
    this.H_iso = p.isotropicHardeningModulus || 0.0;
    this.C_kin = p.kinematicHardeningModulus || 0.0;
    this.gamma_kin = p.kinematicRecallGamma || 0.0;
    this.hardeningCurve = p.hardeningCurve;

    // Isotropic elasticity matrix
    const c1 = this.lambda + 2.0 * this.G;
    const c2 = this.lambda;
    const c3 = this.G;

    this.C_el = [
      [c1, c2, c2, 0, 0, 0],
      [c2, c1, c2, 0, 0, 0],
      [c2, c2, c1, 0, 0, 0],
      [0, 0, 0, c3, 0, 0],
      [0, 0, 0, 0, c3, 0],
      [0, 0, 0, 0, 0, c3]
    ];
  }

  /**
   * Returns current yield stress sigma_y at equivalent plastic strain bar_eps_p
   */
  public getYieldStress(barEpsP: number): number {
    if (this.hardeningCurve && this.hardeningCurve.length > 0) {
      return this.interpolateHardeningCurve(barEpsP);
    }
    if (this.hardeningType === 'PERFECT') {
      return this.initialYieldStress;
    }
    return this.initialYieldStress + this.H_iso * Math.max(0, barEpsP);
  }

  /**
   * Returns current hardening slope H = d(sigma_y)/d(bar_eps_p)
   */
  public getHardeningModulus(barEpsP: number): number {
    if (this.hardeningCurve && this.hardeningCurve.length > 0) {
      return this.interpolateHardeningSlope(barEpsP);
    }
    if (this.hardeningType === 'PERFECT') {
      return 0.0;
    }
    return this.H_iso;
  }

  /**
   * Constitutive Update via Radial Return Mapping
   */
  public updateStress(
    strainIncrement: number[],
    state: MaterialPointState
  ): ConstitutiveResponse {
    if (strainIncrement.length !== 6) {
      return {
        stress: [...state.stress],
        tangent: this.C_el,
        plasticStrain: [...state.plasticStrain],
        equivalentPlasticStrain: state.equivalentPlasticStrain,
        backStress: [...state.backStress],
        elasticEnergyDensity: state.elasticEnergyDensity,
        plasticDissipationIncrement: 0,
        updatedState: state,
        converged: false,
        failure: {
          code: 'ERR_INVALID_PARAMETERS',
          location: 'J2ConstitutivePlasticityModel.updateStress',
          reason: 'Strain increment must have 6 Voigt components'
        }
      };
    }

    // 1. Elastic Predictor
    const dSigmaTrial = this.multiplyMatrixVector(this.C_el, strainIncrement);
    const stressTrial = state.stress.map((s, i) => s + dSigmaTrial[i]);
    const totalStrainTrial = state.totalStrain.map((e, i) => e + strainIncrement[i]);

    // Relative stress xi_trial = stress_trial - backStress_n
    const xiTrial = stressTrial.map((s, i) => s - state.backStress[i]);

    // Compute deviatoric relative stress s_rel
    const p_rel = (xiTrial[0] + xiTrial[1] + xiTrial[2]) / 3.0;
    const s_rel = [
      xiTrial[0] - p_rel,
      xiTrial[1] - p_rel,
      xiTrial[2] - p_rel,
      xiTrial[3],
      xiTrial[4],
      xiTrial[5]
    ];

    // Equivalent von Mises relative stress
    const J2_trial = 0.5 * (
      s_rel[0] * s_rel[0] + s_rel[1] * s_rel[1] + s_rel[2] * s_rel[2] +
      2.0 * (s_rel[3] * s_rel[3] + s_rel[4] * s_rel[4] + s_rel[5] * s_rel[5])
    );
    const vmTrial = Math.sqrt(Math.max(0, 3.0 * J2_trial));

    const currentYield = this.getYieldStress(state.equivalentPlasticStrain);
    const fTrial = vmTrial - currentYield;

    // 2. Elastic Decision
    if (fTrial <= 1e-7 * currentYield) {
      let energyDensity = 0;
      const elasticStrain = totalStrainTrial.map((e, i) => e - state.plasticStrain[i]);
      for (let i = 0; i < 6; i++) energyDensity += 0.5 * stressTrial[i] * elasticStrain[i];

      const isUnloading = state.equivalentPlasticStrain > 0 && fTrial < -1e-6;

      const updatedState: MaterialPointState = {
        ...state,
        totalStrain: totalStrainTrial,
        stress: stressTrial,
        elasticEnergyDensity: Math.max(0, energyDensity),
        status: isUnloading ? 'UNLOADING' : 'ELASTIC'
      };

      return {
        stress: stressTrial,
        tangent: this.C_el,
        plasticStrain: [...state.plasticStrain],
        equivalentPlasticStrain: state.equivalentPlasticStrain,
        backStress: [...state.backStress],
        elasticEnergyDensity: Math.max(0, energyDensity),
        plasticDissipationIncrement: 0,
        updatedState,
        converged: true
      };
    }

    // 3. Plastic Decision - Radial Return Mapping
    const H_eff = this.getHardeningModulus(state.equivalentPlasticStrain);
    let H_kin_eff = 0.0;
    if (this.hardeningType === 'KINEMATIC' || this.hardeningType === 'COMBINED') {
      H_kin_eff = (2.0 / 3.0) * this.C_kin;
    }

    const denominator = 3.0 * this.G + H_eff + H_kin_eff;
    const deltaGamma = fTrial / denominator;

    if (deltaGamma <= 0 || Number.isNaN(deltaGamma) || !Number.isFinite(deltaGamma)) {
      return {
        stress: [...state.stress],
        tangent: this.C_el,
        plasticStrain: [...state.plasticStrain],
        equivalentPlasticStrain: state.equivalentPlasticStrain,
        backStress: [...state.backStress],
        elasticEnergyDensity: state.elasticEnergyDensity,
        plasticDissipationIncrement: 0,
        updatedState: state,
        converged: false,
        failure: {
          code: 'ERR_PLASTIC_CONVERGENCE_FAILED',
          location: 'J2ConstitutivePlasticityModel.updateStress',
          reason: `Invalid plastic multiplier deltaGamma = ${deltaGamma}`
        }
      };
    }

    // Unit flow normal tensor n = (3 / 2 / vmTrial) * s_rel
    const normalCoeff = (3.0 * deltaGamma) / (2.0 * vmTrial);
    const dEpsP = [
      normalCoeff * s_rel[0],
      normalCoeff * s_rel[1],
      normalCoeff * s_rel[2],
      2.0 * normalCoeff * s_rel[3], // Voigt engineering shear
      2.0 * normalCoeff * s_rel[4],
      2.0 * normalCoeff * s_rel[5]
    ];

    const newPlasticStrain = state.plasticStrain.map((p_i, i) => p_i + dEpsP[i]);
    const newBarEpsP = state.equivalentPlasticStrain + deltaGamma;

    // Back-stress update (Prager/Ziegler kinematic hardening)
    let newBackStress = [...state.backStress];
    if (this.hardeningType === 'KINEMATIC' || this.hardeningType === 'COMBINED') {
      const dBackStress = [
        (2.0 / 3.0) * this.C_kin * dEpsP[0],
        (2.0 / 3.0) * this.C_kin * dEpsP[1],
        (2.0 / 3.0) * this.C_kin * dEpsP[2],
        (2.0 / 3.0) * this.C_kin * dEpsP[3] * 0.5,
        (2.0 / 3.0) * this.C_kin * dEpsP[4] * 0.5,
        (2.0 / 3.0) * this.C_kin * dEpsP[5] * 0.5
      ];
      newBackStress = state.backStress.map((b, i) => b + dBackStress[i]);
    }

    // Corrected stress: s_new = (1 - 3G * deltaGamma / vmTrial) * s_rel + p_rel * I + backStress_new
    const factor = 1.0 - (3.0 * this.G * deltaGamma) / vmTrial;
    const sNewDev = s_rel.map(s_i => s_i * factor);

    const newStress = [
      sNewDev[0] + p_rel + newBackStress[0],
      sNewDev[1] + p_rel + newBackStress[1],
      sNewDev[2] + p_rel + newBackStress[2],
      sNewDev[3] + newBackStress[3],
      sNewDev[4] + newBackStress[4],
      sNewDev[5] + newBackStress[5]
    ];

    // Plastic dissipation increment dW_p = (sigma_avg - alpha_avg) : dEpsP
    let dDissipation = 0;
    for (let i = 0; i < 6; i++) {
      const avgS = 0.5 * (state.stress[i] + newStress[i]) - 0.5 * (state.backStress[i] + newBackStress[i]);
      dDissipation += avgS * dEpsP[i];
    }

    // Elastic strain energy
    const newElasticStrain = totalStrainTrial.map((e, i) => e - newPlasticStrain[i]);
    let energyDensity = 0;
    for (let i = 0; i < 6; i++) energyDensity += 0.5 * newStress[i] * newElasticStrain[i];

    // Compute exact Algorithmic Consistent Elastoplastic Tangent Matrix C_ep
    const C_ep = this.computeConsistentTangent(s_rel, vmTrial, deltaGamma, H_eff + H_kin_eff);

    const updatedState: MaterialPointState = {
      ...state,
      totalStrain: totalStrainTrial,
      stress: newStress,
      plasticStrain: newPlasticStrain,
      equivalentPlasticStrain: newBarEpsP,
      backStress: newBackStress,
      elasticEnergyDensity: Math.max(0, energyDensity),
      plasticDissipation: state.plasticDissipation + Math.max(0, dDissipation),
      status: 'PLASTIC'
    };

    return {
      stress: newStress,
      tangent: C_ep,
      plasticStrain: newPlasticStrain,
      equivalentPlasticStrain: newBarEpsP,
      backStress: newBackStress,
      elasticEnergyDensity: Math.max(0, energyDensity),
      plasticDissipationIncrement: Math.max(0, dDissipation),
      updatedState,
      converged: true
    };
  }

  /**
   * Computes exact algorithmic consistent elastoplastic tangent matrix C_ep (6x6 Voigt)
   */
  public computeConsistentTangent(
    sRel: number[],
    vmTrial: number,
    deltaGamma: number,
    H_total: number
  ): number[][] {
    const C_ep: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

    const beta = 1.0 - (3.0 * this.G * deltaGamma) / vmTrial;
    const gammaBar = (3.0 * this.G) / (3.0 * this.G + H_total) - (1.0 - beta);

    const K = this.K;
    const twoG_beta = 2.0 * this.G * beta;
    const plasticScale = (3.0 * this.G * gammaBar) / (vmTrial * vmTrial);

    // Isotropic part with G * beta
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let val = K - (twoG_beta / 3.0);
        if (i === j) val += twoG_beta;
        C_ep[i][j] = val;
      }
    }

    C_ep[3][3] = this.G * beta;
    C_ep[4][4] = this.G * beta;
    C_ep[5][5] = this.G * beta;

    // Plastic term: plasticScale * sRel_i * sRel_j
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        C_ep[i][j] -= plasticScale * sRel[i] * sRel[j];
      }
    }

    return C_ep;
  }

  private interpolateHardeningCurve(barEpsP: number): number {
    const pts = this.hardeningCurve!;
    if (barEpsP <= pts[0].plasticStrain) return pts[0].yieldStress;
    if (barEpsP >= pts[pts.length - 1].plasticStrain) return pts[pts.length - 1].yieldStress;

    for (let i = 0; i < pts.length - 1; i++) {
      if (barEpsP >= pts[i].plasticStrain && barEpsP <= pts[i + 1].plasticStrain) {
        const t = (barEpsP - pts[i].plasticStrain) / (pts[i + 1].plasticStrain - pts[i].plasticStrain);
        return pts[i].yieldStress + t * (pts[i + 1].yieldStress - pts[i].yieldStress);
      }
    }
    return pts[pts.length - 1].yieldStress;
  }

  private interpolateHardeningSlope(barEpsP: number): number {
    const pts = this.hardeningCurve!;
    if (barEpsP <= pts[0].plasticStrain) {
      return (pts[1].yieldStress - pts[0].yieldStress) / (pts[1].plasticStrain - pts[0].plasticStrain);
    }
    if (barEpsP >= pts[pts.length - 1].plasticStrain) {
      const last = pts.length - 1;
      return (pts[last].yieldStress - pts[last - 1].yieldStress) / (pts[last].plasticStrain - pts[last - 1].plasticStrain);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (barEpsP >= pts[i].plasticStrain && barEpsP <= pts[i + 1].plasticStrain) {
        return (pts[i + 1].yieldStress - pts[i].yieldStress) / (pts[i + 1].plasticStrain - pts[i].plasticStrain);
      }
    }
    return 0.0;
  }

  private multiplyMatrixVector(A: number[][], v: number[]): number[] {
    const res = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) sum += A[i][j] * v[j];
      res[i] = sum;
    }
    return res;
  }
}
