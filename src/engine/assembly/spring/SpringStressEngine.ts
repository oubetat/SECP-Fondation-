/**
 * PATCH-225 — Spring Mechanical Analysis & ISO/DIN Stress Engine
 * Rigorous analytical calculations for Spring Rate (k = dF/dx), Wahl Stress Correction (Kw),
 * Torsional Shear Stress (tau), Bending Stress (sigma), Dynamic Preload, Mechanical Stops,
 * Stored Elastic Strain Energy, Natural Frequency (fn), and Goodman Fatigue Margins.
 */

import {
  SpringType,
  SpringMaterialProperties,
  SpringMechanicalAnalysis,
  SpringEndConfiguration
} from './SpringTypes';

export interface MechanicalEvaluationInput {
  type: SpringType;
  wireDiameterMm: number;
  meanDiameterMm: number;
  activeCoils: number;
  totalCoils: number;
  freeLengthMm: number;
  material: SpringMaterialProperties;
  endConfig: SpringEndConfiguration;
  appliedDeflectionMm?: number;
  appliedForceN?: number;
  appliedTorqueNm?: number;
  appliedAngleDeg?: number;
  initialTensionN?: number;
  effectiveMassKg?: number;
}

export class SpringStressEngine {
  /**
   * Calculate the Wahl stress concentration and curvature correction factor
   * Kw = (4C - 1) / (4C - 4) + 0.615 / C
   */
  public static calculateWahlFactor(springIndexC: number): number {
    const C = Math.max(springIndexC, 1.5);
    const directCurvature = (4 * C - 1) / (4 * C - 4);
    const directShear = 0.615 / C;
    return directCurvature + directShear;
  }

  /**
   * Calculate the inner curvature stress correction factor for torsion springs
   * Ki = (4C^2 - C - 1) / (4C * (C - 1))
   */
  public static calculateTorsionCurvatureFactor(springIndexC: number): number {
    const C = Math.max(springIndexC, 1.5);
    return (4 * C * C - C - 1) / (4 * C * (C - 1));
  }

  /**
   * Calculate theoretical solid height based on end configuration
   */
  public static calculateSolidHeight(
    wireDiameterMm: number,
    totalCoils: number,
    endConfig: SpringEndConfiguration
  ): number {
    const d = wireDiameterMm;
    const isGround =
      endConfig.startEndType === 'CLOSED_AND_GROUND' ||
      endConfig.startEndType === 'PLAIN_AND_GROUND' ||
      endConfig.endEndType === 'CLOSED_AND_GROUND';

    if (isGround) {
      return totalCoils * d;
    } else {
      return (totalCoils + 1) * d;
    }
  }

  /**
   * Perform comprehensive analytical mechanical evaluation
   */
  public static evaluate(input: MechanicalEvaluationInput): SpringMechanicalAnalysis {
    const {
      type,
      wireDiameterMm: d,
      meanDiameterMm: D,
      activeCoils: na,
      totalCoils: nt,
      freeLengthMm: L0,
      material,
      endConfig
    } = input;

    const C = D / Math.max(d, 0.01);
    const Kw = this.calculateWahlFactor(C);
    const Ki = this.calculateTorsionCurvatureFactor(C);

    const solidHeight = this.calculateSolidHeight(d, nt, endConfig);
    const maxDeflectionAllowed = Math.max(L0 - solidHeight, 0);

    // 1. Calculate Spring Rate k (N/mm) or Angular Rate k_theta (N*mm/deg)
    let springRate_K = 0;
    let angularSpringRate_K_theta = 0;

    const G_Mpa = material.shearModulusG_Gpa * 1000;
    const E_Mpa = material.youngsModulusE_Gpa * 1000;

    if (type === 'COMPRESSION' || type === 'EXTENSION' || type === 'CONICAL' || type === 'BARREL') {
      // Standard Helical Wire Formula: k = (G * d^4) / (8 * D^3 * n_a)
      const numerator = G_Mpa * Math.pow(d, 4);
      const denominator = 8 * Math.pow(D, 3) * Math.max(na, 0.5);
      springRate_K = numerator / denominator;
    } else if (type === 'TORSION') {
      // Torsion Spring Formula: k_rad = (E * d^4) / (64 * D * n_a)
      const kRad = (E_Mpa * Math.pow(d, 4)) / (64 * D * Math.max(na, 0.5));
      // Convert to N*mm/deg
      angularSpringRate_K_theta = (kRad * Math.PI) / 180;
      springRate_K = angularSpringRate_K_theta;
    } else if (type === 'BELLEVILLE') {
      // Belleville washer approximate linear stiffness near flat
      springRate_K = (4 * E_Mpa * Math.pow(d, 3)) / (Math.pow(D, 2) * (1 - Math.pow(material.poissonsRatio, 2)));
    } else if (type === 'WAVE') {
      // Flat wire single/multi turn wave spring
      const b = d * 1.5; // typical flat wire width
      const t = d * 0.6; // flat wire thickness
      const Nw = 3.5;
      springRate_K = (E_Mpa * b * Math.pow(t, 3) * Math.pow(Nw, 4)) / (2.4 * Math.pow(D, 3) * Math.max(na, 1));
    }

    // 2. Compute Load, Deflection & Operating State
    let appliedDeflection = 0;
    let appliedForce = 0;
    let appliedTorqueNm = 0;
    let initialTensionN = 0;

    if (type === 'EXTENSION') {
      initialTensionN = input.initialTensionN || 0.15 * (Math.PI * Math.pow(d, 3) * material.torsionalYieldStrengthSysMpa) / (8 * D * Kw);
    }

    if (input.appliedDeflectionMm !== undefined) {
      appliedDeflection = input.appliedDeflectionMm;
      appliedForce = initialTensionN + appliedDeflection * springRate_K;
    } else if (input.appliedForceN !== undefined) {
      appliedForce = input.appliedForceN;
      appliedDeflection = Math.max((appliedForce - initialTensionN) / Math.max(springRate_K, 1e-4), 0);
    } else if (input.appliedTorqueNm !== undefined && type === 'TORSION') {
      appliedTorqueNm = input.appliedTorqueNm;
      const torqueNmm = appliedTorqueNm * 1000;
      appliedDeflection = torqueNmm / Math.max(angularSpringRate_K_theta, 1e-4); // in degrees
      appliedForce = appliedDeflection;
    } else {
      // Default operating point: 40% of max deflection
      appliedDeflection = maxDeflectionAllowed * 0.4;
      appliedForce = initialTensionN + appliedDeflection * springRate_K;
    }

    // Operating length
    const operatingLengthMm =
      type === 'COMPRESSION'
        ? Math.max(L0 - appliedDeflection, solidHeight)
        : type === 'EXTENSION'
        ? L0 + appliedDeflection
        : L0;

    // 3. Shear Stress tau and Bending Stress sigma
    let shearStressTau = 0;
    let bendingStressSigma = 0;

    if (type === 'TORSION') {
      const torqueNmm = appliedTorqueNm ? appliedTorqueNm * 1000 : appliedDeflection * angularSpringRate_K_theta;
      bendingStressSigma = (Ki * 32 * torqueNmm) / (Math.PI * Math.pow(d, 3));
      shearStressTau = bendingStressSigma * 0.577; // von Mises equivalent
    } else {
      // Torsional shear stress: tau = Kw * (8 * F * D) / (pi * d^3)
      shearStressTau = (Kw * 8 * appliedForce * D) / (Math.PI * Math.pow(d, 3));
    }

    // 4. Safety Factors
    const safetyFactorYield =
      type === 'TORSION'
        ? material.bendingYieldStrengthSyMpa / Math.max(bendingStressSigma, 1e-3)
        : material.torsionalYieldStrengthSysMpa / Math.max(shearStressTau, 1e-3);

    const safetyFactorFatigue =
      material.torsionalEnduranceLimitTauEMpa / Math.max(shearStressTau * 0.65, 1e-3);

    // 5. Stored Elastic Strain Energy: U = 0.5 * k * x^2
    const storedStrainEnergyJoules =
      type === 'TORSION'
        ? (0.5 * (appliedTorqueNm || 0) * (appliedDeflection * Math.PI / 180))
        : (0.5 * springRate_K * Math.pow(appliedDeflection, 2)) / 1000;

    // 6. Natural Frequency: fn = 0.5 * sqrt(k / m_eff) in Hz
    const mEffKg = input.effectiveMassKg || 0.05;
    const k_N_m = springRate_K * 1000; // convert N/mm to N/m
    const naturalFrequencyHz = (1 / (2 * Math.PI)) * Math.sqrt(Math.max(k_N_m / Math.max(mEffKg, 1e-5), 0));

    // 7. Buckling & Slenderness Criterion
    const slenderness = L0 / Math.max(D, 0.1);
    let bucklingRisk: 'STABLE_NO_BUCKLING' | 'GUIDE_ROD_RECOMMENDED' | 'CRITICAL_BUCKLING_HAZARD' =
      'STABLE_NO_BUCKLING';
    if (type === 'COMPRESSION') {
      if (slenderness > 5.5) {
        bucklingRisk = 'CRITICAL_BUCKLING_HAZARD';
      } else if (slenderness > 4.0) {
        bucklingRisk = 'GUIDE_ROD_RECOMMENDED';
      }
    }

    // 8. Operating Status & Coil Clearance
    let operatingStatus: 'FREE' | 'PRELOADED' | 'OPERATING' | 'SOLID_HEIGHT_LIMIT' | 'OVER_DEFLECTED' = 'OPERATING';
    if (appliedDeflection <= 0.001) {
      operatingStatus = 'FREE';
    } else if (appliedDeflection < maxDeflectionAllowed * 0.15) {
      operatingStatus = 'PRELOADED';
    } else if (appliedDeflection >= maxDeflectionAllowed * 0.999) {
      operatingStatus = 'SOLID_HEIGHT_LIMIT';
    } else if (operatingLengthMm < solidHeight) {
      operatingStatus = 'OVER_DEFLECTED';
    }

    const coilClearanceAtOperatingMm =
      type === 'COMPRESSION'
        ? Math.max((operatingLengthMm - solidHeight) / Math.max(na, 1), 0)
        : (L0 - nt * d) / Math.max(na, 1);

    return {
      springRate_K_N_mm: Math.round(springRate_K * 1000) / 1000,
      angularSpringRate_K_theta_N_mm_deg:
        type === 'TORSION' ? Math.round(angularSpringRate_K_theta * 1000) / 1000 : undefined,
      freeLengthL0Mm: L0,
      solidHeightHsMm: Math.round(solidHeight * 100) / 100,
      maxDeflectionAllowedDeltaMaxMm: Math.round(maxDeflectionAllowed * 100) / 100,
      springIndexC: Math.round(C * 100) / 100,
      wahlStressCorrectionFactorKw: Math.round(Kw * 1000) / 1000,
      torsionStressCorrectionFactorKi: type === 'TORSION' ? Math.round(Ki * 1000) / 1000 : undefined,
      initialTensionF0N: type === 'EXTENSION' ? Math.round(initialTensionN * 10) / 10 : undefined,
      appliedDeflectionMm: Math.round(appliedDeflection * 100) / 100,
      operatingLengthMm: Math.round(operatingLengthMm * 100) / 100,
      appliedForceN: Math.round(appliedForce * 10) / 10,
      appliedTorqueNm: type === 'TORSION' ? appliedTorqueNm : undefined,
      shearStressTauMpa: Math.round(shearStressTau * 10) / 10,
      bendingStressSigmaMpa: type === 'TORSION' ? Math.round(bendingStressSigma * 10) / 10 : undefined,
      safetyFactorYield: Math.round(safetyFactorYield * 100) / 100,
      safetyFactorFatigue: Math.round(safetyFactorFatigue * 100) / 100,
      storedStrainEnergyJoules: Math.round(storedStrainEnergyJoules * 1000) / 1000,
      naturalFrequencyHz: Math.round(naturalFrequencyHz * 10) / 10,
      slendernessRatio: Math.round(slenderness * 100) / 100,
      bucklingRisk,
      operatingStatus,
      coilClearanceAtOperatingMm: Math.round(coilClearanceAtOperatingMm * 100) / 100
    };
  }
}
