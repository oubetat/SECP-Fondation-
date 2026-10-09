/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — Tool Assembly & Holder Interface Engine
 * 
 * Manages the tool assembly stack: Cutter -> Shank -> Collet/Holder -> Spindle Interface.
 * Enforces gauge length calculations, clamping checks, multi-step collision profiles,
 * and deterministic assembly fingerprints.
 */

import {
  ToolAssembly,
  ToolHolderDefinition,
  HolderInterfaceType,
  ClampingType,
  CAMTool,
  ToolDimensions
} from './ToolTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export class ToolAssemblyEngine {
  /**
   * Standard library of industrial tool holders
   */
  public static getStandardHolders(): ToolHolderDefinition[] {
    return [
      {
        holderId: 'HOLDER_BT40_ER32_70',
        name: 'BT40 ER32 Collet Chuck 70mm',
        interfaceType: 'BT40',
        clampingType: 'ER_COLLET',
        gaugeLengthMm: 70,
        upperDiameterMm: 63,
        lowerDiameterMm: 50,
        noseDiameterMm: 50,
        clampingDiameterMinMm: 2,
        clampingDiameterMaxMm: 20,
        maxRpm: 15000,
        balanceGrade: 'G2.5 @ 15000 RPM',
        coolantThrough: true,
        profileSteps: [
          { diameterMm: 50, lengthMm: 35 },
          { diameterMm: 56, lengthMm: 20 },
          { diameterMm: 63, lengthMm: 15 }
        ],
        sha256Hash: 'BT40_ER32_70_PRESET_HASH'
      },
      {
        holderId: 'HOLDER_HSK_A63_ER20_80',
        name: 'HSK-A63 ER20 Precision Chuck 80mm',
        interfaceType: 'HSK_A63',
        clampingType: 'ER_COLLET',
        gaugeLengthMm: 80,
        upperDiameterMm: 63,
        lowerDiameterMm: 34,
        noseDiameterMm: 34,
        clampingDiameterMinMm: 1,
        clampingDiameterMaxMm: 13,
        maxRpm: 24000,
        balanceGrade: 'G2.5 @ 24000 RPM',
        coolantThrough: true,
        profileSteps: [
          { diameterMm: 34, lengthMm: 40 },
          { diameterMm: 45, lengthMm: 25 },
          { diameterMm: 63, lengthMm: 15 }
        ],
        sha256Hash: 'HSK_A63_ER20_80_PRESET_HASH'
      },
      {
        holderId: 'HOLDER_HSK_A63_SHRINK_65',
        name: 'HSK-A63 ThermoGrip Shrink Fit 65mm',
        interfaceType: 'HSK_A63',
        clampingType: 'SHRINK_FIT',
        gaugeLengthMm: 65,
        upperDiameterMm: 63,
        lowerDiameterMm: 24,
        noseDiameterMm: 24,
        clampingDiameterMinMm: 6,
        clampingDiameterMaxMm: 16,
        maxRpm: 30000,
        balanceGrade: 'G1.0 @ 30000 RPM',
        coolantThrough: true,
        profileSteps: [
          { diameterMm: 24, lengthMm: 30 },
          { diameterMm: 32, lengthMm: 20 },
          { diameterMm: 63, lengthMm: 15 }
        ],
        sha256Hash: 'HSK_A63_SHRINK_65_PRESET_HASH'
      },
      {
        holderId: 'HOLDER_BT40_FACEMILL_50',
        name: 'BT40 Face Mill Shell Arbor 50mm (22mm Pilot)',
        interfaceType: 'BT40',
        clampingType: 'FACE_MILL_ARBOR',
        gaugeLengthMm: 50,
        upperDiameterMm: 63,
        lowerDiameterMm: 48,
        noseDiameterMm: 22,
        clampingDiameterMinMm: 22,
        clampingDiameterMaxMm: 22,
        maxRpm: 12000,
        balanceGrade: 'G2.5 @ 12000 RPM',
        coolantThrough: true,
        profileSteps: [
          { diameterMm: 48, lengthMm: 25 },
          { diameterMm: 63, lengthMm: 25 }
        ],
        sha256Hash: 'BT40_FACEMILL_50_PRESET_HASH'
      },
      {
        holderId: 'HOLDER_CAPTO_C6_HYDRAULIC_90',
        name: 'Coromant Capto C6 Hydro-Grip Chuck 90mm',
        interfaceType: 'CAPTO_C6',
        clampingType: 'HYDRAULIC_CHUCK',
        gaugeLengthMm: 90,
        upperDiameterMm: 63,
        lowerDiameterMm: 42,
        noseDiameterMm: 42,
        clampingDiameterMinMm: 6,
        clampingDiameterMaxMm: 25,
        maxRpm: 20000,
        balanceGrade: 'G2.5 @ 20000 RPM',
        coolantThrough: true,
        profileSteps: [
          { diameterMm: 42, lengthMm: 45 },
          { diameterMm: 54, lengthMm: 30 },
          { diameterMm: 63, lengthMm: 15 }
        ],
        sha256Hash: 'CAPTO_C6_HYDRAULIC_90_PRESET_HASH'
      }
    ];
  }

  /**
   * Creates a deterministic Tool Assembly combining tool and holder
   */
  public static async createAssembly(
    tool: CAMTool,
    holder: ToolHolderDefinition,
    stickOutMm?: number
  ): Promise<ToolAssembly> {
    // Validate clamping capability
    const shankD = tool.geometry.dimensions.shankDiameterMm;
    if (shankD < holder.clampingDiameterMinMm || shankD > holder.clampingDiameterMaxMm) {
      throw new Error(
        `Tool shank diameter ${shankD} mm cannot be clamped in holder ${holder.name} (Bore range: ${holder.clampingDiameterMinMm} - ${holder.clampingDiameterMaxMm} mm).`
      );
    }

    // Determine stickout
    const minStickout = tool.geometry.dimensions.cuttingLengthMm + 5; // Flute + clearance margin
    const maxStickout = tool.geometry.dimensions.overallLengthMm - 15; // Minimum clamping depth of 15mm
    
    let resolvedStickout = stickOutMm ?? Math.min(Math.max(minStickout, 35), maxStickout);
    if (resolvedStickout > maxStickout) {
      resolvedStickout = maxStickout;
    }

    const gaugeLengthMm = Number((holder.gaugeLengthMm + resolvedStickout).toFixed(3));
    const effectiveLengthMm = Number((resolvedStickout).toFixed(3));
    const runoutTirMm = holder.clampingType === 'SHRINK_FIT' ? 0.003 : holder.clampingType === 'HYDRAULIC_CHUCK' ? 0.004 : 0.008;
    const weightKg = Number((0.85 + (tool.geometry.dimensions.overallLengthMm * 0.002)).toFixed(3));

    const assemblyData = {
      toolUUID: tool.toolUUID,
      toolVersion: tool.version.versionString,
      geometryHash: tool.geometry.geometryHash,
      holderId: holder.holderId,
      holderInterface: holder.interfaceType,
      stickOutMm: resolvedStickout,
      gaugeLengthMm,
      effectiveLengthMm
    };

    const assemblyHash = await generateDeterministicHash(assemblyData);

    return {
      assemblyId: `ASM_${tool.toolId}_${holder.holderId.replace('HOLDER_', '')}`,
      name: `${tool.name} + ${holder.name}`,
      toolUUID: tool.toolUUID,
      toolVersion: tool.version.versionString,
      holder,
      stickOutMm: resolvedStickout,
      gaugeLengthMm,
      effectiveLengthMm,
      runoutTirMm,
      weightKg,
      assemblyHash
    };
  }

  /**
   * Validates interface compatibility between tool and machine spindle
   */
  public static validateMachineSpindleCompatibility(
    holder: ToolHolderDefinition,
    machineSpindleInterface: HolderInterfaceType,
    machineMaxRpm: number
  ): { compatible: boolean; reason?: string } {
    if (holder.interfaceType !== machineSpindleInterface) {
      return {
        compatible: false,
        reason: `Holder taper interface (${holder.interfaceType}) does not match machine spindle taper (${machineSpindleInterface}).`
      };
    }
    if (holder.maxRpm < machineMaxRpm) {
      return {
        compatible: true,
        reason: `Warning: Holder max balanced RPM (${holder.maxRpm}) is lower than machine spindle max RPM (${machineMaxRpm}).`
      };
    }
    return { compatible: true };
  }
}
