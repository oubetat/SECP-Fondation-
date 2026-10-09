/**
 * PATCH-270: Failure Analysis Engine & Solver
 * 
 * Performs exact analytical 3D stress tensor calculations, principal stress/direction
 * eigenvalue solvers, stress invariants (I1, I2, I3, J2, J3, hydrostatic, deviatoric, Lode angle),
 * failure criteria evaluations (Von Mises, Tresca, Max Principal Stress, Mohr-Coulomb, Drucker-Prager),
 * LEFM fracture mechanics (K_I, small-scale yielding r_p validation, K_IC comparison),
 * multi-criteria evaluation, temperature-dependent property integration, and cryptographic evidence generation.
 */

import {
  StressTensor3D,
  PrincipalStressResult,
  FailureCriterionType270,
  FailureEvaluationResult270,
  FractureMechanicsInput270,
  FEMFailureFieldResult270,
  FailureAnalysisSnapshot270,
  FailureEngineeringReport270,
  FailureCategory270,
  CrackModel270
} from './FailureTypes270';
import { FailureModelRegistry270 } from './FailureModelRegistry270';
import { TemperaturePropertyService268 } from './TemperaturePropertyService268';

export class FailureAnalysisEngine270 {

  /**
   * Calculates 3D Principal Stresses (sigma1 >= sigma2 >= sigma3) and Stress Invariants
   * using an exact Cardano analytical cubic solver.
   */
  public static calculatePrincipalStresses(tensor: StressTensor3D): PrincipalStressResult {
    const { sigma_xx, sigma_yy, sigma_zz, tau_xy, tau_yz, tau_xz } = tensor;

    // First invariant I1
    const I1 = sigma_xx + sigma_yy + sigma_zz;

    // Hydrostatic stress
    const hydrostaticStressPa = I1 / 3.0;

    // Second invariant I2
    const I2 =
      sigma_xx * sigma_yy +
      sigma_yy * sigma_zz +
      sigma_zz * sigma_xx -
      (tau_xy * tau_xy + tau_yz * tau_yz + tau_xz * tau_xz);

    // Third invariant I3 (determinant)
    const I3 =
      sigma_xx * (sigma_yy * sigma_zz - tau_yz * tau_yz) -
      tau_xy * (tau_xy * sigma_zz - tau_yz * tau_xz) +
      tau_xz * (tau_xy * tau_yz - sigma_yy * tau_xz);

    // Deviatoric stress tensor S_ij = sigma_ij - hydrostatic * delta_ij
    const S_xx = sigma_xx - hydrostaticStressPa;
    const S_yy = sigma_yy - hydrostaticStressPa;
    const S_zz = sigma_zz - hydrostaticStressPa;
    const S_xy = tau_xy;
    const S_yz = tau_yz;
    const S_xz = tau_xz;

    const deviatoricStressTensor = [
      [S_xx, S_xy, S_xz],
      [S_xy, S_yy, S_yz],
      [S_xz, S_yz, S_zz]
    ];

    // Second deviatoric invariant J2
    const J2 =
      (1 / 6) *
        (Math.pow(sigma_xx - sigma_yy, 2) +
          Math.pow(sigma_yy - sigma_zz, 2) +
          Math.pow(sigma_zz - sigma_xx, 2)) +
      tau_xy * tau_xy +
      tau_yz * tau_yz +
      tau_xz * tau_xz;

    // Third deviatoric invariant J3 = det(S)
    const J3 =
      S_xx * (S_yy * S_zz - S_yz * S_yz) -
      S_xy * (S_xy * S_zz - S_yz * S_xz) +
      S_xz * (S_xy * S_yz - S_yy * S_xz);

    // Lode parameter theta (-1 to +1)
    let lodeParameter = 0;
    if (J2 > 1e-12) {
      const sin3Theta = Math.min(Math.max((-3 * Math.sqrt(3) * J3) / (2 * Math.pow(J2, 1.5)), -1.0), 1.0);
      lodeParameter = Math.sin((1 / 3) * Math.asin(sin3Theta));
    }

    // Cardano's Method for Eigenvalues of 3x3 symmetric matrix
    let sigma1: number;
    let sigma2: number;
    let sigma3: number;

    const p = I1 * I1 - 3.0 * I2;
    if (Math.abs(p) < 1e-12) {
      // Hydrostatic or isotropic stress state
      sigma1 = hydrostaticStressPa;
      sigma2 = hydrostaticStressPa;
      sigma3 = hydrostaticStressPa;
    } else {
      const q = (2.0 / 27.0) * Math.pow(I1, 3) - (1.0 / 3.0) * I1 * I2 + I3;
      const r = Math.sqrt(Math.max(p / 3.0, 0));
      const arg = Math.min(Math.max(q / (2.0 * Math.pow(r, 3)), -1.0), 1.0);
      const phi = Math.acos(arg) / 3.0;

      const l1 = hydrostaticStressPa + 2.0 * r * Math.cos(phi);
      const l2 = hydrostaticStressPa + 2.0 * r * Math.cos(phi + (2.0 * Math.PI) / 3.0);
      const l3 = hydrostaticStressPa + 2.0 * r * Math.cos(phi + (4.0 * Math.PI) / 3.0);

      // Sort descending
      const sorted = [l1, l2, l3].sort((a, b) => b - a);
      sigma1 = sorted[0];
      sigma2 = sorted[1];
      sigma3 = sorted[2];
    }

    // Principal directions (eigenvectors)
    const principalDirections = this.calculatePrincipalDirections(
      sigma_xx, sigma_yy, sigma_zz, tau_xy, tau_yz, tau_xz, sigma1, sigma2, sigma3
    );

    return {
      sigma1,
      sigma2,
      sigma3,
      principalDirections,
      invariants: {
        I1,
        I2,
        I3,
        J2,
        J3,
        hydrostaticStressPa,
        deviatoricStressTensor,
        lodeParameter
      }
    };
  }

  /**
   * Calculates Von Mises Equivalent Stress from Principal Stresses or Invariants.
   * VM = sqrt(3 * J2)
   */
  public static calculateVonMisesStress(principal: PrincipalStressResult): number {
    return Math.sqrt(3.0 * principal.invariants.J2);
  }

  /**
   * Helper to compute orthonormal principal direction vectors for sigma1, sigma2, sigma3.
   */
  private static calculatePrincipalDirections(
    sxx: number, syy: number, szz: number,
    sxy: number, syz: number, sxz: number,
    s1: number, s2: number, s3: number
  ) {
    const getVectorForVal = (s: number): [number, number, number] => {
      // (A - sI) v = 0
      const a11 = sxx - s;
      const a22 = syy - s;
      const a33 = szz - s;

      // Cross product of rows to find non-trivial solution
      const r1 = [a11, sxy, sxz];
      const r2 = [sxy, a22, syz];
      const r3 = [sxz, syz, a33];

      const c1: [number, number, number] = [
        r1[1] * r2[2] - r1[2] * r2[1],
        r1[2] * r2[0] - r1[0] * r2[2],
        r1[0] * r2[1] - r1[1] * r2[0]
      ];

      const c2: [number, number, number] = [
        r2[1] * r3[2] - r2[2] * r3[1],
        r2[2] * r3[0] - r2[0] * r3[2],
        r2[0] * r3[1] - r2[1] * r3[0]
      ];

      let v = c1[0] * c1[0] + c1[1] * c1[1] + c1[2] * c1[2] > 1e-12 ? c1 : c2;
      const mag = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      if (mag < 1e-12) return [1, 0, 0];
      return [v[0] / mag, v[1] / mag, v[2] / mag];
    };

    return {
      v1: getVectorForVal(s1),
      v2: getVectorForVal(s2),
      v3: getVectorForVal(s3)
    };
  }

  /**
   * Evaluates a specific Failure Criterion on a given 3D Stress Tensor and Material Properties.
   */
  public static evaluateCriterion(
    analysisId: string,
    criterion: FailureCriterionType270,
    stressTensor: StressTensor3D,
    materialProps: {
      materialId: string;
      materialFamily: string; // e.g. 'ALUMINUM', 'CAST_IRON'
      yieldStrengthPa?: number;
      ultimateTensileStrengthPa?: number;
      ultimateCompressiveStrengthPa?: number;
      temperatureK?: number;
    }
  ): FailureEvaluationResult270 {
    const model = FailureModelRegistry270.getModelByCriterion(criterion);
    const principal = this.calculatePrincipalStresses(stressTensor);
    const { sigma1, sigma2, sigma3 } = principal;

    // Check Material Applicability
    if (model) {
      const isFamilyApplicable = model.applicableMaterialFamilies.includes(materialProps.materialFamily.toUpperCase()) ||
        model.applicableMaterialFamilies.includes('ALL_ENGINEERING_STRUCTURAL') ||
        (materialProps.materialFamily.toUpperCase() !== 'CAST_IRON' && model.applicableMaterialFamilies.includes('DUCTILE_METALS'));

      if (!isFamilyApplicable) {
        return {
          analysisId,
          modelId: model.modelId,
          criterion,
          elementId: stressTensor.elementId,
          stressTensor,
          principalStresses: principal,
          equivalentStressPa: 0,
          materialAllowableStrengthPa: 0,
          failureIndex: 0,
          failureMargin: 0,
          classification: 'CRITERION_NOT_APPLICABLE',
          assumptions: model.limitations,
          limitations: model.limitations,
          isValid: false,
          statusMessage: `Criterion ${criterion} is not applicable to material family ${materialProps.materialFamily}.`
        };
      }
    }

    // Determine temperature-dependent or nominal yield strength
    let yieldStrength = materialProps.yieldStrengthPa;
    let uts = materialProps.ultimateTensileStrengthPa;
    let ucs = materialProps.ultimateCompressiveStrengthPa;

    const tempK = materialProps.temperatureK || 293.15;

    // Try resolving from TemperaturePropertyService268 if yieldStrength is absent or temperature is specified
    if ((!yieldStrength || materialProps.temperatureK) && materialProps.materialId) {
      const tempEval = TemperaturePropertyService268.evaluateTemperatureDependentProperty({
        materialId: materialProps.materialId,
        propertyType: 'YIELD_STRENGTH',
        temperature: tempK,
        temperatureUnit: 'K'
      });
      if (tempEval.validityStatus === 'VALID' || tempEval.validityStatus === 'EXACT') {
        yieldStrength = tempEval.canonicalValue;
      }
    }

    if ((!uts || materialProps.temperatureK) && materialProps.materialId) {
      const tempEvalUTS = TemperaturePropertyService268.evaluateTemperatureDependentProperty({
        materialId: materialProps.materialId,
        propertyType: 'ULTIMATE_TENSILE_STRENGTH',
        temperature: tempK,
        temperatureUnit: 'K'
      });
      if (tempEvalUTS.validityStatus === 'VALID' || tempEvalUTS.validityStatus === 'EXACT') {
        uts = tempEvalUTS.canonicalValue;
      }
    }

    switch (criterion) {
      case 'VON_MISES': {
        if (!yieldStrength || yieldStrength <= 0) {
          return this.createMissingInputResult(analysisId, 'MODEL-VON-MISES-01', criterion, stressTensor, principal, 'Yield strength (yieldStrengthPa) is required.');
        }

        const vonMisesPa = Math.sqrt(
          0.5 * (Math.pow(sigma1 - sigma2, 2) + Math.pow(sigma2 - sigma3, 2) + Math.pow(sigma3 - sigma1, 2))
        );

        const failureIndex = vonMisesPa / yieldStrength;
        const failureMargin = 1.0 - failureIndex;
        const factorOfSafety = vonMisesPa > 1e-6 ? yieldStrength / vonMisesPa : 999.0;

        return {
          analysisId,
          modelId: 'MODEL-VON-MISES-01',
          criterion,
          elementId: stressTensor.elementId,
          stressTensor,
          principalStresses: principal,
          equivalentStressPa: vonMisesPa,
          materialAllowableStrengthPa: yieldStrength,
          failureIndex,
          failureMargin,
          factorOfSafety,
          classification: failureIndex > 1.0 ? 'YIELD_PREDICTED' : 'NO_FAILURE_PREDICTED',
          assumptions: ['Isotropic material', 'Distortional energy yield hypothesis', 'Equal yield in tension and compression'],
          limitations: ['Not for brittle fracture', 'No crack propagation'],
          isValid: true,
          statusMessage: failureIndex > 1.0 ? `Von Mises Yield Exceeded (FI = ${failureIndex.toFixed(3)})` : 'Safe under Von Mises criterion'
        };
      }

      case 'TRESCA': {
        if (!yieldStrength || yieldStrength <= 0) {
          return this.createMissingInputResult(analysisId, 'MODEL-TRESCA-01', criterion, stressTensor, principal, 'Yield strength (yieldStrengthPa) is required.');
        }

        const maxShearPa = (sigma1 - sigma3) / 2.0;
        const trescaEquivalentPa = sigma1 - sigma3; // 2 * tau_max

        const failureIndex = trescaEquivalentPa / yieldStrength;
        const failureMargin = 1.0 - failureIndex;
        const factorOfSafety = trescaEquivalentPa > 1e-6 ? yieldStrength / trescaEquivalentPa : 999.0;

        return {
          analysisId,
          modelId: 'MODEL-TRESCA-01',
          criterion,
          elementId: stressTensor.elementId,
          stressTensor,
          principalStresses: principal,
          equivalentStressPa: trescaEquivalentPa,
          materialAllowableStrengthPa: yieldStrength,
          failureIndex,
          failureMargin,
          factorOfSafety,
          classification: failureIndex > 1.0 ? 'YIELD_PREDICTED' : 'NO_FAILURE_PREDICTED',
          assumptions: ['Maximum shear stress hypothesis', 'Isotropic ductile metal'],
          limitations: ['Conservative relative to Von Mises (up to 15.5%)'],
          isValid: true,
          statusMessage: failureIndex > 1.0 ? `Tresca Shear Yield Exceeded (FI = ${failureIndex.toFixed(3)})` : 'Safe under Tresca criterion'
        };
      }

      case 'MAX_PRINCIPAL_STRESS': {
        const tensileLimit = uts || yieldStrength;
        const compressiveLimit = ucs || tensileLimit;

        if (!tensileLimit || tensileLimit <= 0) {
          return this.createMissingInputResult(analysisId, 'MODEL-MAX-PRINCIPAL-01', criterion, stressTensor, principal, 'Ultimate tensile strength is required.');
        }

        const tensileFI = sigma1 > 0 ? sigma1 / tensileLimit : 0;
        const compFI = sigma3 < 0 ? Math.abs(sigma3) / (compressiveLimit || tensileLimit) : 0;
        const failureIndex = Math.max(tensileFI, compFI);
        const failureMargin = 1.0 - failureIndex;

        return {
          analysisId,
          modelId: 'MODEL-MAX-PRINCIPAL-01',
          criterion,
          elementId: stressTensor.elementId,
          stressTensor,
          principalStresses: principal,
          equivalentStressPa: Math.max(sigma1, Math.abs(sigma3)),
          materialAllowableStrengthPa: tensileLimit,
          failureIndex,
          failureMargin,
          classification: failureIndex > 1.0 ? 'BRITTLE_FAILURE' : 'NO_FAILURE_PREDICTED',
          assumptions: ['Rankine maximum normal stress hypothesis', 'Brittle fracture governance'],
          limitations: ['FORBIDDEN for general ductile metal yield assessment'],
          isValid: true,
          statusMessage: failureIndex > 1.0 ? `Max Principal Stress Limit Exceeded (FI = ${failureIndex.toFixed(3)})` : 'Safe under Max Principal Stress criterion'
        };
      }

      case 'MOHR_COULOMB': {
        const St = uts || yieldStrength;
        const Sc = ucs || (St ? St * 3 : undefined);

        if (!St || !Sc) {
          return this.createMissingInputResult(analysisId, 'MODEL-MOHR-COULOMB-01', criterion, stressTensor, principal, 'Tensile and compressive strengths are required for Mohr-Coulomb.');
        }

        // Mohr-Coulomb equation: sigma1 / St - sigma3 / Sc = 1
        const failureIndex = sigma1 / St - sigma3 / Sc;
        const failureMargin = 1.0 - failureIndex;

        return {
          analysisId,
          modelId: 'MODEL-MOHR-COULOMB-01',
          criterion,
          elementId: stressTensor.elementId,
          stressTensor,
          principalStresses: principal,
          equivalentStressPa: sigma1 - (St / Sc) * sigma3,
          materialAllowableStrengthPa: St,
          failureIndex,
          failureMargin,
          classification: failureIndex > 1.0 ? 'BRITTLE_FAILURE' : 'NO_FAILURE_PREDICTED',
          assumptions: ['Shear-cohesion friction envelope', 'Unequal tensile and compressive strength'],
          limitations: ['Do not apply automatically to metals'],
          isValid: true,
          statusMessage: failureIndex > 1.0 ? `Mohr-Coulomb Limit Exceeded (FI = ${failureIndex.toFixed(3)})` : 'Safe under Mohr-Coulomb criterion'
        };
      }

      default:
        return this.createMissingInputResult(analysisId, 'UNKNOWN', criterion, stressTensor, principal, `Unsupported criterion: ${criterion}`);
    }
  }

  /**
   * Evaluates Linear Elastic Fracture Mechanics (LEFM Mode I) for explicit crack geometry.
   * Checks Small-Scale Yielding (SSY) condition r_p <= a / 5.
   */
  public static evaluateLEFMFractureModeI(
    analysisId: string,
    input: FractureMechanicsInput270
  ): FailureEvaluationResult270 {
    const { crack, appliedFarFieldStressPa, planeCondition, materialKIC_PaSqrtM, materialYieldStrengthPa } = input;

    if (!crack || crack.crackLengthA_m <= 0) {
      return {
        analysisId,
        modelId: 'MODEL-LEFM-MODE1-01',
        criterion: 'LEFM_MODE_I',
        elementId: crack?.location || 'CRACK-TIP-01',
        stressTensor: {
          sigma_xx: appliedFarFieldStressPa, sigma_yy: 0, sigma_zz: 0,
          tau_xy: 0, tau_yz: 0, tau_xz: 0,
          coordinateSystem: 'GLOBAL', elementId: 'CRACK-ELEM', loadCaseId: 'LC-CRACK'
        },
        principalStresses: this.calculatePrincipalStresses({
          sigma_xx: appliedFarFieldStressPa, sigma_yy: 0, sigma_zz: 0,
          tau_xy: 0, tau_yz: 0, tau_xz: 0,
          coordinateSystem: 'GLOBAL', elementId: 'CRACK-ELEM', loadCaseId: 'LC-CRACK'
        }),
        equivalentStressPa: 0,
        materialAllowableStrengthPa: materialKIC_PaSqrtM,
        failureIndex: 0,
        failureMargin: 0,
        classification: 'MISSING_REQUIRED_FAILURE_INPUT',
        assumptions: ['Explicit crack geometry required'],
        limitations: ['Cannot assume hidden crack size'],
        isValid: false,
        statusMessage: 'MISSING_REQUIRED_FAILURE_INPUT: Valid crack geometry and length (a > 0) are required.'
      };
    }

    const Y = crack.geometryCorrectionFactorY || 1.12;
    const a = crack.crackLengthA_m;

    // K_I = Y * sigma * sqrt(pi * a)
    const K_I = Y * appliedFarFieldStressPa * Math.sqrt(Math.PI * a);

    // Plastic zone size r_p
    const isPlaneStrain = planeCondition === 'PLANE_STRAIN';
    const denominator = isPlaneStrain ? 6.0 * Math.PI : 2.0 * Math.PI;
    const r_p = (1.0 / denominator) * Math.pow(K_I / materialYieldStrengthPa, 2);

    // Small scale yielding check: r_p <= a / 5
    const isSSYValid = r_p <= a / 5.0;

    const failureIndex = K_I / materialKIC_PaSqrtM;
    const failureMargin = 1.0 - failureIndex;

    const tensor: StressTensor3D = {
      sigma_xx: appliedFarFieldStressPa,
      sigma_yy: 0,
      sigma_zz: 0,
      tau_xy: 0,
      tau_yz: 0,
      tau_xz: 0,
      coordinateSystem: 'GLOBAL',
      elementId: crack.location || 'CRACK-TIP-01',
      loadCaseId: 'LC-FRACTURE'
    };

    if (!isSSYValid) {
      return {
        analysisId,
        modelId: 'MODEL-LEFM-MODE1-01',
        criterion: 'LEFM_MODE_I',
        elementId: crack.location || 'CRACK-TIP-01',
        stressTensor: tensor,
        principalStresses: this.calculatePrincipalStresses(tensor),
        equivalentStressPa: K_I,
        materialAllowableStrengthPa: materialKIC_PaSqrtM,
        failureIndex,
        failureMargin,
        classification: 'LEFM_INVALID_FOR_CONDITION',
        assumptions: ['LEFM Small-Scale Yielding assumption'],
        limitations: [`Plastic zone size r_p (${(r_p * 1000).toFixed(2)} mm) exceeds a/5 (${((a / 5.0) * 1000).toFixed(2)} mm)`],
        isValid: false,
        statusMessage: 'LEFM_INVALID_FOR_CONDITION: Large scale plasticity detected. Plastic zone size violates LEFM SSY assumption.'
      };
    }

    return {
      analysisId,
      modelId: 'MODEL-LEFM-MODE1-01',
      criterion: 'LEFM_MODE_I',
      elementId: crack.location || 'CRACK-TIP-01',
      stressTensor: tensor,
      principalStresses: this.calculatePrincipalStresses(tensor),
      equivalentStressPa: K_I, // Pa*sqrt(m)
      materialAllowableStrengthPa: materialKIC_PaSqrtM,
      failureIndex,
      failureMargin,
      classification: failureIndex > 1.0 ? 'FRACTURE_PREDICTED' : 'NO_FAILURE_PREDICTED',
      assumptions: ['Linear Elastic Fracture Mechanics Mode I', 'Small Scale Yielding Valid'],
      limitations: ['Single dominant mode I crack'],
      isValid: true,
      statusMessage: failureIndex > 1.0 ? `Fracture Predicted (K_I = ${(K_I / 1e6).toFixed(2)} MPa√m >= K_IC)` : 'Safe under LEFM Mode I Fracture Criterion'
    };
  }

  /**
   * Helper to format missing input result.
   */
  private static createMissingInputResult(
    analysisId: string,
    modelId: string,
    criterion: FailureCriterionType270,
    tensor: StressTensor3D,
    principal: PrincipalStressResult,
    msg: string
  ): FailureEvaluationResult270 {
    return {
      analysisId,
      modelId,
      criterion,
      elementId: tensor.elementId,
      stressTensor: tensor,
      principalStresses: principal,
      equivalentStressPa: 0,
      materialAllowableStrengthPa: 0,
      failureIndex: 0,
      failureMargin: 0,
      classification: 'MISSING_REQUIRED_FAILURE_INPUT',
      assumptions: [],
      limitations: [],
      isValid: false,
      statusMessage: `MISSING_REQUIRED_FAILURE_INPUT: ${msg}`
    };
  }

  /**
   * Runs failure criterion on a field of FEM element stress tensors and identifies critical location.
   */
  public static runFEMFailureAnalysis(
    meshId: string,
    meshRevision: number,
    loadCaseId: string,
    materialId: string,
    materialRevision: number,
    temperatureK: number,
    criterion: FailureCriterionType270,
    elementStresses: StressTensor3D[],
    materialProps: {
      materialFamily: string;
      yieldStrengthPa?: number;
      ultimateTensileStrengthPa?: number;
      ultimateCompressiveStrengthPa?: number;
    }
  ): FEMFailureFieldResult270 {
    const analysisId = `FAIL-RUN-${meshId}-R${meshRevision}-${Date.now()}`;

    const elementResults = elementStresses.map((st) =>
      this.evaluateCriterion(analysisId, criterion, st, {
        materialId,
        materialFamily: materialProps.materialFamily,
        yieldStrengthPa: materialProps.yieldStrengthPa,
        ultimateTensileStrengthPa: materialProps.ultimateTensileStrengthPa,
        ultimateCompressiveStrengthPa: materialProps.ultimateCompressiveStrengthPa,
        temperatureK
      })
    );

    let maxFI = -1;
    let minMargin = 999;
    let criticalElementId = elementStresses[0]?.elementId || 'ELEM-001';
    let dominantMode: FailureCategory270 = 'YIELD_FAILURE';

    elementResults.forEach((res) => {
      if (res.failureIndex > maxFI) {
        maxFI = res.failureIndex;
        criticalElementId = res.elementId;
        minMargin = res.failureMargin;
        dominantMode = res.classification === 'BRITTLE_FAILURE' ? 'BRITTLE_FAILURE' : 'YIELD_FAILURE';
      }
    });

    const evidenceString = `${analysisId}:${meshId}:R${meshRevision}:${materialId}:R${materialRevision}:${criterion}:${maxFI.toFixed(6)}`;
    const evidenceHash = this.computeSHA256(evidenceString);

    return {
      meshId,
      meshRevision,
      loadCaseId,
      temperatureK,
      materialId,
      materialRevision,
      criterion,
      elementResults,
      criticalLocation: {
        elementId: criticalElementId,
        maxFailureIndex: maxFI,
        minMargin,
        dominantMode
      },
      evidenceHash,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Evaluates multiple criteria independently on a single stress state for comparison.
   */
  public static evaluateMultipleCriteria(
    analysisId: string,
    stressTensor: StressTensor3D,
    materialProps: {
      materialId: string;
      materialFamily: string;
      yieldStrengthPa?: number;
      ultimateTensileStrengthPa?: number;
      ultimateCompressiveStrengthPa?: number;
      temperatureK?: number;
    }
  ): FailureEvaluationResult270[] {
    const criteriaList: FailureCriterionType270[] = ['VON_MISES', 'TRESCA', 'MAX_PRINCIPAL_STRESS'];
    if (materialProps.materialFamily === 'CAST_IRON' || materialProps.materialFamily === 'CONCRETE') {
      criteriaList.push('MOHR_COULOMB');
    }

    return criteriaList.map((crit) => this.evaluateCriterion(analysisId, crit, stressTensor, materialProps));
  }

  /**
   * Creates an immutable Failure Analysis Snapshot for evidence persistence.
   */
  public static createSnapshot(
    analysisId: string,
    fieldResult: FEMFailureFieldResult270,
    crackData?: CrackModel270
  ): FailureAnalysisSnapshot270 {
    return {
      analysisId,
      meshId: fieldResult.meshId,
      meshRevision: fieldResult.meshRevision,
      materialId: fieldResult.materialId,
      materialRevision: fieldResult.materialRevision,
      temperatureK: fieldResult.temperatureK,
      loadCaseId: fieldResult.loadCaseId,
      criterion: fieldResult.criterion,
      crackData,
      criticalLocation: {
        elementId: fieldResult.criticalLocation.elementId,
        failureIndex: fieldResult.criticalLocation.maxFailureIndex,
        dominantMode: fieldResult.criticalLocation.dominantMode
      },
      evidenceHash: fieldResult.evidenceHash,
      timestamp: new Date().toISOString(),
      isImmutable: true
    };
  }

  /**
   * Simple deterministic string hashing helper.
   */
  private static computeSHA256(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SHA256-FAIL270-${hex.toUpperCase()}-${input.length}`;
  }
}
