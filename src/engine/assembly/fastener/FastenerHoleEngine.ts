/**
 * SECP FASTENER HOLE PREPARATION & AUTO-ASSIST ENGINE (PATCH-226)
 * 
 * Generates and auto-recommends hole features for fasteners:
 * - ISO 273 Clearance Holes (Fine, Medium, Coarse)
 * - Counterbore holes for Socket Head Cap Screws (ISO 4762)
 * - Countersink holes for Flat Head Screws (ISO 10642, 90°/82°)
 * - Tap Drill & Thread Depth for blind/through tapped holes (ISO 68-1)
 * - Fastener Assist Engine (reads hole parameters & suggests compatible fasteners)
 */

import {
  ClearanceFitClass,
  FastenerCategory,
  FastenerDimensions,
  FastenerSpecification,
  HoleConfiguration,
  HoleType
} from './FastenerTypes';
import { FastenerStandardRegistry } from './FastenerStandardRegistry';

export class FastenerHoleEngine {
  /**
   * Generates standard hole configuration for a given fastener
   */
  public static generateHoleConfigForFastener(
    category: FastenerCategory,
    dims: FastenerDimensions,
    pitch: number,
    fitClass: ClearanceFitClass = 'MEDIUM',
    holeType: HoleType = 'CLEARANCE_HOLE'
  ): HoleConfiguration {
    const d = dims.nominalDiameter_d_mm;
    const clearance = FastenerStandardRegistry.getClearanceHole(d, fitClass);
    const tapDrill = FastenerStandardRegistry.getTapDrillSize(d, pitch);

    if (category === 'SOCKET_HEAD_CAP_SCREW' || holeType === 'COUNTERBORE') {
      // Standard ISO Counterbore dimensions
      const dk = dims.headDiameter_dk_mm;
      const k = dims.headHeight_k_mm;
      const dcb = Math.ceil(dk + 1.5); // counterbore diameter with clearance
      const tcb = Math.ceil(k + 0.5); // counterbore depth

      return {
        holeType: 'COUNTERBORE',
        nominalBoltDiameter_mm: d,
        fitClass,
        holeDiameter_dh_mm: clearance.holeDiameter,
        holeDepth_mm: dims.overallLength_L_mm + 5.0,
        counterboreDiameter_dcb_mm: dcb,
        counterboreDepth_tcb_mm: tcb,
        standardReference: `ISO Counterbore for M${d} SHCS: Ø${clearance.holeDiameter} / C-Bore Ø${dcb} × ${tcb}mm`
      };
    } else if (category === 'COUNTERSUNK_SCREW' || holeType === 'COUNTERSINK') {
      const dcs = dims.headDiameter_dk_mm + 0.5;
      const csAngle = dims.countersinkAngle_deg || 90;

      return {
        holeType: 'COUNTERSINK',
        nominalBoltDiameter_mm: d,
        fitClass,
        holeDiameter_dh_mm: clearance.holeDiameter,
        holeDepth_mm: dims.overallLength_L_mm + 5.0,
        countersinkDiameter_dcs_mm: dcs,
        countersinkAngle_deg: csAngle,
        standardReference: `ISO Countersink for M${d}: Ø${clearance.holeDiameter} / C-Sink Ø${dcs} × ${csAngle}°`
      };
    } else if (holeType === 'TAPPED_HOLE') {
      const tapDepth = Math.ceil(dims.threadLength_b_mm + 3 * pitch);
      const drillDepth = tapDepth + Math.ceil(3 * pitch); // extra blind tap drill relief

      return {
        holeType: 'TAPPED_HOLE',
        nominalBoltDiameter_mm: d,
        fitClass,
        holeDiameter_dh_mm: tapDrill.drillDiameter,
        holeDepth_mm: drillDepth,
        tapDrillDiameter_dt_mm: tapDrill.drillDiameter,
        tapThreadDepth_mm: tapDepth,
        standardReference: `ISO Metric Thread M${d}×${pitch} (Tap Drill Ø${tapDrill.drillDiameter}mm)`
      };
    } else {
      // Standard Clearance Through Hole
      return {
        holeType: 'CLEARANCE_HOLE',
        nominalBoltDiameter_mm: d,
        fitClass,
        holeDiameter_dh_mm: clearance.holeDiameter,
        holeDepth_mm: dims.overallLength_L_mm + 5.0,
        standardReference: clearance.description
      };
    }
  }

  /**
   * Fastener Assist: Reads existing hole geometry and thickness, and auto-suggests compatible fasteners
   */
  public static autoSuggestFasteners(
    holeDiameter_mm: number,
    stackThickness_mm: number,
    isBlindTapped: boolean = false
  ): {
    suggestedFasteners: Array<{
      partNumber: string;
      nominalSize: string;
      length: number;
      category: FastenerCategory;
      reason: string;
    }>;
    diagnostic: string;
  } {
    // 1. Identify closest nominal diameter
    const nominalSizes = [3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
    let bestNominal = 6;
    let minDiff = 999;

    for (const nom of nominalSizes) {
      const clearance = nom * 1.1;
      const diff = Math.abs(holeDiameter_mm - clearance);
      if (diff < minDiff) {
        minDiff = diff;
        bestNominal = nom;
      }
    }

    // 2. Determine ideal length
    // Ideal length = stackThickness + washer (2mm) + nut (0.8*d) + 2*P (3mm)
    const pitch = FastenerStandardRegistry.STANDARD_METRIC_COARSE_PITCHES[bestNominal] || 1.0;
    const nutHeight = bestNominal * 0.8;
    const idealLength = stackThickness_mm + 3.0 + nutHeight + 2 * pitch;

    // Pick closest standard available length
    const standardLengths = [10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];
    const bestLength = standardLengths.reduce((prev, curr) =>
      Math.abs(curr - idealLength) < Math.abs(prev - idealLength) ? curr : prev
    );

    const suggestions = [
      {
        partNumber: `ISO-4017-M${bestNominal}x${bestLength}`,
        nominalSize: `M${bestNominal} × ${bestLength}`,
        length: bestLength,
        category: 'HEX_BOLT' as FastenerCategory,
        reason: `Standard Hex Bolt for Ø${holeDiameter_mm}mm hole through ${stackThickness_mm}mm stack.`
      },
      {
        partNumber: `ISO-4762-M${bestNominal}x${bestLength}`,
        nominalSize: `M${bestNominal} × ${bestLength}`,
        length: bestLength,
        category: 'SOCKET_HEAD_CAP_SCREW' as FastenerCategory,
        reason: `Socket Head Cap Screw for compact counterbored or recessed assemblies.`
      }
    ];

    return {
      suggestedFasteners: suggestions,
      diagnostic: `Fastener Assist detected Ø${holeDiameter_mm}mm hole with ${stackThickness_mm}mm stack. Suggested M${bestNominal} fasteners with nominal length ${bestLength}mm.`
    };
  }
}
