/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — Tool Cutting Parameters & Machining Physics Engine
 * 
 * Computes deterministic speeds, feeds, power, torque, MRR, radial chip thinning,
 * and tracks parameter provenance across materials and tooling categories.
 */

import {
  ToolCuttingParameters,
  WorkpieceMaterialClass,
  WorkpieceMaterialDefinition,
  ParameterRange,
  ParameterProvenance,
  CoolantMethod,
  ToolMaterial,
  ToolType
} from './ToolTypes';

export interface MachiningPhysicsResult {
  cuttingSpeedVcMMin: number;
  spindleRpm: number;
  feedPerToothFzMm: number;
  feedRateVfMmMin: number;
  axialDepthApMm: number;
  radialDepthAeMm: number;
  mrrCm3Min: number; // Material Removal Rate in cm³/min
  averageChipThicknessHm: number; // mm
  adjustedFzMm: number; // Chip thinning compensated feed
  cuttingForceFcNewtons: number; // N
  cuttingPowerPcKw: number; // kW
  spindleTorqueNm: number; // N·m
  chipThinningFactor: number;
}

export class ToolCuttingCalculator {
  /**
   * Standard Material Database with specific cutting force parameters
   */
  public static getMaterialDefinitions(): WorkpieceMaterialDefinition[] {
    return [
      {
        materialId: 'MAT_ISO_N_AL6061',
        materialName: 'Aluminum 6061-T6',
        materialClass: 'ISO_N_NON_FERROUS',
        densityGPerCm3: 2.70,
        hardnessHB: 95,
        tensileStrengthMPa: 310,
        machinabilityRatingPercent: 280,
        specificCuttingForceKc1_1: 750, // N/mm²
        cuttingForceSlopeZ: 0.25
      },
      {
        materialId: 'MAT_ISO_P_AISI4140',
        materialName: 'Alloy Steel AISI 4140 (Annealed)',
        materialClass: 'ISO_P_STEEL',
        densityGPerCm3: 7.85,
        hardnessHB: 210,
        tensileStrengthMPa: 700,
        machinabilityRatingPercent: 65,
        specificCuttingForceKc1_1: 1800,
        cuttingForceSlopeZ: 0.26
      },
      {
        materialId: 'MAT_ISO_M_SS316L',
        materialName: 'Stainless Steel 316L (Austenitic)',
        materialClass: 'ISO_M_STAINLESS',
        densityGPerCm3: 8.00,
        hardnessHB: 185,
        tensileStrengthMPa: 580,
        machinabilityRatingPercent: 45,
        specificCuttingForceKc1_1: 2200,
        cuttingForceSlopeZ: 0.28
      },
      {
        materialId: 'MAT_ISO_K_GG25',
        materialName: 'Cast Iron Gray Iron GG25',
        materialClass: 'ISO_K_CAST_IRON',
        densityGPerCm3: 7.20,
        hardnessHB: 220,
        tensileStrengthMPa: 250,
        machinabilityRatingPercent: 110,
        specificCuttingForceKc1_1: 1150,
        cuttingForceSlopeZ: 0.22
      },
      {
        materialId: 'MAT_ISO_S_TI6AL4V',
        materialName: 'Titanium Grade 5 Ti-6Al-4V',
        materialClass: 'ISO_S_HIGH_TEMP_ALLOY',
        densityGPerCm3: 4.43,
        hardnessHRC: 36,
        tensileStrengthMPa: 950,
        machinabilityRatingPercent: 22,
        specificCuttingForceKc1_1: 2800,
        cuttingForceSlopeZ: 0.23
      },
      {
        materialId: 'MAT_ISO_H_D2_58HRC',
        materialName: 'Tool Steel D2 (Hardened 58 HRC)',
        materialClass: 'ISO_H_HARDENED_STEEL',
        densityGPerCm3: 7.70,
        hardnessHRC: 58,
        tensileStrengthMPa: 2000,
        machinabilityRatingPercent: 18,
        specificCuttingForceKc1_1: 3400,
        cuttingForceSlopeZ: 0.30
      }
    ];
  }

  /**
   * Calculates Spindle RPM from Cutting Speed (Vc) and Diameter (d)
   * Formula: n = (Vc * 1000) / (pi * d)
   */
  public static calculateRpm(cuttingSpeedVcMMin: number, diameterMm: number): number {
    if (diameterMm <= 0) return 0;
    const rpm = (cuttingSpeedVcMMin * 1000) / (Math.PI * diameterMm);
    return Math.round(rpm);
  }

  /**
   * Calculates Cutting Speed (Vc) from Spindle RPM (n) and Diameter (d)
   * Formula: Vc = (pi * d * n) / 1000
   */
  public static calculateCuttingSpeed(rpm: number, diameterMm: number): number {
    if (diameterMm <= 0) return 0;
    const vc = (Math.PI * diameterMm * rpm) / 1000;
    return Number(vc.toFixed(1));
  }

  /**
   * Calculates Table Feed Rate (Vf) from Feed Per Tooth (fz), Flutes (z), and RPM (n)
   * Formula: Vf = fz * z * n
   */
  public static calculateFeedRate(feedPerToothMm: number, fluteCount: number, rpm: number): number {
    if (fluteCount < 1) return 0;
    const vf = feedPerToothMm * fluteCount * rpm;
    return Math.round(vf);
  }

  /**
   * Calculates Feed Per Tooth (fz) from Feed Rate (Vf), Flutes (z), and RPM (n)
   * Formula: fz = Vf / (z * n)
   */
  public static calculateFeedPerTooth(feedRateMmMin: number, fluteCount: number, rpm: number): number {
    if (fluteCount < 1 || rpm <= 0) return 0;
    const fz = feedRateMmMin / (fluteCount * rpm);
    return Number(fz.toFixed(4));
  }

  /**
   * Calculates Material Removal Rate (MRR) in cm³/min
   * Formula: Q = (ap * ae * Vf) / 1000
   */
  public static calculateMrr(axialDepthApMm: number, radialDepthAeMm: number, feedRateVfMmMin: number): number {
    const mrr = (axialDepthApMm * radialDepthAeMm * feedRateVfMmMin) / 1000;
    return Number(mrr.toFixed(2));
  }

  /**
   * Computes Radial Chip Thinning Factor
   * When ae < d/2, chip thickness is less than nominal fz.
   * Formula: factor = 1 / (2 * sqrt( (ae/d) * (1 - ae/d) ))
   */
  public static calculateChipThinningFactor(radialDepthAeMm: number, diameterMm: number): number {
    if (diameterMm <= 0 || radialDepthAeMm <= 0) return 1.0;
    const ratio = Math.min(1.0, radialDepthAeMm / diameterMm);
    if (ratio >= 0.5) return 1.0; // Full engagement or slotting
    const factor = Math.sqrt(diameterMm / (4 * radialDepthAeMm));
    return Number(Math.max(1.0, Math.min(factor, 3.5)).toFixed(2));
  }

  /**
   * Complete Machining Physics Calculation
   */
  public static calculateMachiningPhysics(
    diameterMm: number,
    fluteCount: number,
    cuttingSpeedVc: number,
    feedPerToothFz: number,
    axialDepthAp: number,
    radialDepthAe: number,
    material: WorkpieceMaterialDefinition,
    applyChipThinning: boolean = true
  ): MachiningPhysicsResult {
    const spindleRpm = this.calculateRpm(cuttingSpeedVc, diameterMm);
    const chipThinningFactor = applyChipThinning ? this.calculateChipThinningFactor(radialDepthAe, diameterMm) : 1.0;
    const adjustedFzMm = Number((feedPerToothFz * chipThinningFactor).toFixed(4));
    const feedRateVfMmMin = this.calculateFeedRate(adjustedFzMm, fluteCount, spindleRpm);
    const mrrCm3Min = this.calculateMrr(axialDepthAp, radialDepthAe, feedRateVfMmMin);

    // Kienzle specific cutting force computation
    const engagementRatio = Math.min(1.0, radialDepthAe / diameterMm);
    const averageChipThicknessHm = feedPerToothFz * Math.sqrt(engagementRatio);
    const kc = material.specificCuttingForceKc1_1 * Math.pow(Math.max(0.01, averageChipThicknessHm), -material.cuttingForceSlopeZ);
    
    // Main Tangential Cutting Force Fc (N)
    const cuttingForceFcNewtons = Number((kc * axialDepthAp * averageChipThicknessHm).toFixed(1));
    
    // Power (kW) = (Fc * Vc) / 60000
    const cuttingPowerPcKw = Number(((cuttingForceFcNewtons * cuttingSpeedVc) / 60000).toFixed(2));
    
    // Torque (N·m) = (Pc * 9550) / n
    const spindleTorqueNm = spindleRpm > 0 ? Number(((cuttingPowerPcKw * 9550) / spindleRpm).toFixed(2)) : 0;

    return {
      cuttingSpeedVcMMin: cuttingSpeedVc,
      spindleRpm,
      feedPerToothFzMm: feedPerToothFz,
      feedRateVfMmMin,
      axialDepthApMm: axialDepthAp,
      radialDepthAeMm: radialDepthAe,
      mrrCm3Min,
      averageChipThicknessHm: Number(averageChipThicknessHm.toFixed(4)),
      adjustedFzMm,
      cuttingForceFcNewtons,
      cuttingPowerPcKw,
      spindleTorqueNm,
      chipThinningFactor
    };
  }

  /**
   * Generates Engineering Recommended Cutting Parameters for a Tool + Material Class combination
   */
  public static generateRecommendedParameters(
    toolType: ToolType,
    diameterMm: number,
    fluteCount: number,
    toolMaterial: ToolMaterial,
    materialClass: WorkpieceMaterialClass,
    provenance: ParameterProvenance = 'ENGINEERING_DATABASE'
  ): ToolCuttingParameters {
    // Determine baseline cutting speeds (m/min)
    let baseVc = 120;
    let baseFz = 0.05;
    let baseApFactor = 1.0; // as fraction of diameter
    let baseAeFactor = 0.5;

    switch (materialClass) {
      case 'ISO_N_NON_FERROUS':
        baseVc = toolMaterial === 'CARBIDE' ? 380 : 120;
        baseFz = diameterMm <= 6 ? 0.04 : diameterMm <= 12 ? 0.08 : 0.14;
        baseApFactor = 1.5;
        baseAeFactor = 0.6;
        break;
      case 'ISO_P_STEEL':
        baseVc = toolMaterial === 'CARBIDE' ? 180 : 35;
        baseFz = diameterMm <= 6 ? 0.03 : diameterMm <= 12 ? 0.06 : 0.10;
        baseApFactor = 1.0;
        baseAeFactor = 0.4;
        break;
      case 'ISO_M_STAINLESS':
        baseVc = toolMaterial === 'CARBIDE' ? 110 : 20;
        baseFz = diameterMm <= 6 ? 0.025 : diameterMm <= 12 ? 0.045 : 0.08;
        baseApFactor = 0.8;
        baseAeFactor = 0.35;
        break;
      case 'ISO_K_CAST_IRON':
        baseVc = toolMaterial === 'CARBIDE' ? 220 : 30;
        baseFz = diameterMm <= 6 ? 0.035 : diameterMm <= 12 ? 0.07 : 0.12;
        baseApFactor = 1.2;
        baseAeFactor = 0.5;
        break;
      case 'ISO_S_HIGH_TEMP_ALLOY':
        baseVc = toolMaterial === 'CARBIDE' ? 45 : 12;
        baseFz = diameterMm <= 6 ? 0.02 : diameterMm <= 12 ? 0.035 : 0.06;
        baseApFactor = 0.5;
        baseAeFactor = 0.25;
        break;
      case 'ISO_H_HARDENED_STEEL':
        baseVc = toolMaterial === 'CARBIDE' ? 70 : 10;
        baseFz = diameterMm <= 6 ? 0.015 : diameterMm <= 12 ? 0.025 : 0.04;
        baseApFactor = 0.3;
        baseAeFactor = 0.2;
        break;
    }

    if (toolType === 'DRILL') {
      baseVc *= 0.75;
      baseFz = diameterMm * 0.018;
      baseApFactor = 3.0;
      baseAeFactor = 1.0;
    } else if (toolType === 'BALL_END_MILL') {
      baseApFactor = 0.2;
      baseAeFactor = 0.2;
    } else if (toolType === 'FACE_MILL') {
      baseVc *= 1.2;
      baseApFactor = 0.15;
      baseAeFactor = 0.75;
    }

    const minVc = Number((baseVc * 0.7).toFixed(1));
    const recVc = Number(baseVc.toFixed(1));
    const maxVc = Number((baseVc * 1.35).toFixed(1));

    const minFz = Number((baseFz * 0.6).toFixed(4));
    const recFz = Number(baseFz.toFixed(4));
    const maxFz = Number((baseFz * 1.4).toFixed(4));

    const minAp = Number((diameterMm * baseApFactor * 0.4).toFixed(2));
    const recAp = Number((diameterMm * baseApFactor).toFixed(2));
    const maxAp = Number((diameterMm * baseApFactor * 1.5).toFixed(2));

    const minAe = Number((diameterMm * baseAeFactor * 0.3).toFixed(2));
    const recAe = Number((diameterMm * baseAeFactor).toFixed(2));
    const maxAe = Number((diameterMm * (toolType === 'DRILL' ? 1.0 : 0.95)).toFixed(2));

    const minRpm = this.calculateRpm(minVc, diameterMm);
    const recRpm = this.calculateRpm(recVc, diameterMm);
    const maxRpm = this.calculateRpm(maxVc, diameterMm);

    const minVf = this.calculateFeedRate(minFz, fluteCount, minRpm);
    const recVf = this.calculateFeedRate(recFz, fluteCount, recRpm);
    const maxVf = this.calculateFeedRate(maxFz, fluteCount, maxRpm);

    const coolant: CoolantMethod = 
      materialClass === 'ISO_N_NON_FERROUS' ? 'MIST' :
      materialClass === 'ISO_S_HIGH_TEMP_ALLOY' ? 'THROUGH_SPINDLE' :
      materialClass === 'ISO_H_HARDENED_STEEL' ? 'AIR_BLAST' : 'FLOOD';

    return {
      materialClass,
      cuttingSpeedVcMMin: { min: minVc, recommended: recVc, max: maxVc },
      spindleSpeedRpm: { min: minRpm, recommended: recRpm, max: maxRpm },
      feedPerToothFzMm: { min: minFz, recommended: recFz, max: maxFz },
      feedRateVfMmMin: { min: minVf, recommended: recVf, max: maxVf },
      axialDepthApMm: { min: minAp, recommended: recAp, max: maxAp },
      radialDepthAeMm: { min: minAe, recommended: recAe, max: maxAe },
      coolantRecommendation: coolant,
      provenance,
      provenanceSource: 'SECP Engineering Machining Database v3.0 (ISO 13399)',
      validated: provenance === 'MANUFACTURER_DATA' || provenance === 'ENGINEERING_DATABASE',
      chipThinningEnabled: true
    };
  }
}
