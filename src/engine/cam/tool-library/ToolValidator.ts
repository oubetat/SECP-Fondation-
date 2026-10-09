/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — Comprehensive Tool Validator & Integrity Engine
 * 
 * Enforces rigorous dimensional, geometric, assembly, parameter provenance,
 * and interface compatibility constraints. Categorizes invalid states deterministically.
 */

import {
  CAMTool,
  ToolAssembly,
  ToolValidationStatus,
  ToolValidationResult,
  ToolDimensions,
  ToolType
} from './ToolTypes';

export class ToolValidator {
  /**
   * Performs full engineering validation on a CAMTool entity
   */
  public static validateTool(tool: CAMTool): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedFields: string[] = [];

    // 1. Tool Identity & Basic Attributes
    if (!tool.toolUUID || tool.toolUUID.trim() === '') {
      errors.push('ToolUUID is missing or empty.');
    } else {
      validatedFields.push('toolUUID');
    }

    if (!tool.toolId || tool.toolId.trim() === '') {
      errors.push('Tool ID is missing or empty.');
    } else {
      validatedFields.push('toolId');
    }

    if (!tool.name || tool.name.trim() === '') {
      errors.push('Tool name is missing.');
    } else {
      validatedFields.push('name');
    }

    if (!tool.version || !tool.version.versionString) {
      errors.push('Tool version string is missing.');
    } else {
      validatedFields.push('version');
    }

    // 2. Geometric & Dimensional Validation
    const dims = tool.geometry.dimensions;
    const geomValidation = this.validateDimensions(tool.type, dims);
    errors.push(...geomValidation.errors);
    warnings.push(...geomValidation.warnings);
    validatedFields.push(...geomValidation.validatedFields);

    // 3. Geometry Hash Integrity
    if (!tool.geometry.geometryHash || tool.geometry.geometryHash.length < 8) {
      errors.push('ToolGeometryHash is missing or invalid.');
    } else {
      validatedFields.push('geometryHash');
    }

    // 4. Cutting Parameters Validation
    if (!tool.cuttingParameters || tool.cuttingParameters.length === 0) {
      warnings.push('Tool has no predefined cutting parameters for workpiece materials.');
    } else {
      for (const cp of tool.cuttingParameters) {
        const paramValidation = this.validateCuttingParameters(dims, cp);
        errors.push(...paramValidation.errors);
        warnings.push(...paramValidation.warnings);
      }
      validatedFields.push('cuttingParameters');
    }

    // 5. Categorize Status
    let status: ToolValidationStatus = 'TOOL_VALID';
    if (errors.length > 0) {
      if (geomValidation.errors.length > 0) {
        status = 'TOOL_GEOMETRY_INVALID';
      } else if (errors.some(e => e.toLowerCase().includes('parameter') || e.toLowerCase().includes('speed') || e.toLowerCase().includes('feed'))) {
        status = 'TOOL_PARAMETER_INVALID';
      } else if (errors.some(e => e.toLowerCase().includes('missing') || e.toLowerCase().includes('empty'))) {
        status = 'TOOL_DATA_INCOMPLETE';
      } else {
        status = 'TOOL_INVALID';
      }
    }

    return {
      status,
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedFields,
      checkedAt: Date.now()
    };
  }

  /**
   * Validates Tool Dimensions
   */
  public static validateDimensions(type: ToolType, dims: ToolDimensions): { errors: string[]; warnings: string[]; validatedFields: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedFields: string[] = [];

    // Diameter checks
    if (dims.cuttingDiameterMm === undefined || isNaN(dims.cuttingDiameterMm) || dims.cuttingDiameterMm <= 0) {
      errors.push(`Cutting diameter must be strictly positive (got ${dims.cuttingDiameterMm} mm).`);
    } else {
      validatedFields.push('cuttingDiameterMm');
    }

    if (dims.shankDiameterMm === undefined || isNaN(dims.shankDiameterMm) || dims.shankDiameterMm <= 0) {
      errors.push(`Shank diameter must be strictly positive (got ${dims.shankDiameterMm} mm).`);
    } else {
      validatedFields.push('shankDiameterMm');
    }

    // Length checks
    if (dims.overallLengthMm === undefined || isNaN(dims.overallLengthMm) || dims.overallLengthMm <= 0) {
      errors.push(`Overall length must be strictly positive (got ${dims.overallLengthMm} mm).`);
    } else {
      validatedFields.push('overallLengthMm');
    }

    if (dims.cuttingLengthMm === undefined || isNaN(dims.cuttingLengthMm) || dims.cuttingLengthMm <= 0) {
      errors.push(`Cutting length must be strictly positive (got ${dims.cuttingLengthMm} mm).`);
    } else {
      validatedFields.push('cuttingLengthMm');
    }

    if (dims.cuttingLengthMm > dims.overallLengthMm) {
      errors.push(`Cutting length (${dims.cuttingLengthMm} mm) cannot exceed overall length (${dims.overallLengthMm} mm).`);
    }

    // Flute count
    if (!Number.isInteger(dims.fluteCount) || dims.fluteCount < 1) {
      errors.push(`Flute count must be an integer >= 1 (got ${dims.fluteCount}).`);
    } else {
      validatedFields.push('fluteCount');
    }

    // Type-specific dimensional checks
    switch (type) {
      case 'BALL_END_MILL':
        if (dims.cuttingLengthMm < dims.cuttingDiameterMm / 2) {
          warnings.push('Cutting length is shorter than the full hemispherical ball radius.');
        }
        break;

      case 'BULL_NOSE':
        if (dims.cornerRadiusMm === undefined || dims.cornerRadiusMm <= 0) {
          errors.push('Bullnose tool must have a positive corner radius (cornerRadiusMm > 0).');
        } else if (dims.cornerRadiusMm > dims.cuttingDiameterMm / 2) {
          errors.push(`Corner radius (${dims.cornerRadiusMm} mm) cannot exceed cutter radius (${dims.cuttingDiameterMm / 2} mm).`);
        } else {
          validatedFields.push('cornerRadiusMm');
        }
        break;

      case 'DRILL':
        if (!dims.tipAngleDeg || dims.tipAngleDeg <= 0 || dims.tipAngleDeg >= 180) {
          errors.push(`Drill tip angle must be between 0° and 180° (got ${dims.tipAngleDeg}°).`);
        } else {
          validatedFields.push('tipAngleDeg');
        }
        break;

      case 'CHAMFER_TOOL':
        if (!dims.tipAngleDeg || dims.tipAngleDeg <= 0 || dims.tipAngleDeg >= 180) {
          errors.push(`Chamfer included angle must be between 0° and 180° (got ${dims.tipAngleDeg}°).`);
        } else {
          validatedFields.push('tipAngleDeg');
        }
        break;

      case 'FACE_MILL':
        if (dims.insertCount !== undefined && dims.insertCount < 1) {
          errors.push(`Indexable face mill insert count must be >= 1 (got ${dims.insertCount}).`);
        }
        break;

      case 'THREAD_MILL':
        if (!dims.threadPitchMm || dims.threadPitchMm <= 0) {
          errors.push(`Thread mill pitch must be positive (got ${dims.threadPitchMm} mm).`);
        }
        break;
    }

    return { errors, warnings, validatedFields };
  }

  /**
   * Validates Cutting Parameters
   */
  public static validateCuttingParameters(dims: ToolDimensions, cp: any): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!cp.cuttingSpeedVcMMin || cp.cuttingSpeedVcMMin.recommended <= 0) {
      errors.push(`Invalid cutting speed Vc for material ${cp.materialClass}.`);
    }
    if (!cp.spindleSpeedRpm || cp.spindleSpeedRpm.recommended <= 0) {
      errors.push(`Invalid spindle speed RPM for material ${cp.materialClass}.`);
    }
    if (!cp.feedPerToothFzMm || cp.feedPerToothFzMm.recommended <= 0) {
      errors.push(`Invalid feed per tooth fz for material ${cp.materialClass}.`);
    }
    if (!cp.feedRateVfMmMin || cp.feedRateVfMmMin.recommended <= 0) {
      errors.push(`Invalid table feed rate Vf for material ${cp.materialClass}.`);
    }

    // Check relationship Vc vs RPM: Vc = (pi * d * n) / 1000
    if (dims.cuttingDiameterMm > 0 && cp.cuttingSpeedVcMMin && cp.spindleSpeedRpm) {
      const expectedRpm = (cp.cuttingSpeedVcMMin.recommended * 1000) / (Math.PI * dims.cuttingDiameterMm);
      const rpmRatio = cp.spindleSpeedRpm.recommended / expectedRpm;
      if (rpmRatio < 0.85 || rpmRatio > 1.15) {
        warnings.push(
          `Spindle RPM (${cp.spindleSpeedRpm.recommended}) differs significantly from theoretical RPM (${Math.round(expectedRpm)}) calculated from Vc=${cp.cuttingSpeedVcMMin.recommended} m/min and D=${dims.cuttingDiameterMm} mm.`
        );
      }
    }

    return { errors, warnings };
  }

  /**
   * Validates Tool Assembly
   */
  public static validateAssembly(assembly: ToolAssembly, tool: CAMTool): ToolValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedFields: string[] = ['assemblyId', 'toolUUID', 'holderId'];

    if (!assembly.holder) {
      errors.push('Assembly has no holder definition.');
      return {
        status: 'TOOL_INCOMPATIBLE',
        isValid: false,
        errors,
        warnings,
        validatedFields,
        checkedAt: Date.now()
      };
    }

    const shankD = tool.geometry.dimensions.shankDiameterMm;
    const holder = assembly.holder;

    if (shankD < holder.clampingDiameterMinMm || shankD > holder.clampingDiameterMaxMm) {
      errors.push(
        `Holder ${holder.name} clamping bore (${holder.clampingDiameterMinMm}-${holder.clampingDiameterMaxMm}mm) cannot accept tool shank diameter (${shankD}mm).`
      );
    }

    const maxStickout = tool.geometry.dimensions.overallLengthMm - 10;
    if (assembly.stickOutMm > maxStickout) {
      errors.push(
        `Tool stickout (${assembly.stickOutMm}mm) exceeds maximum safe clamping length (${maxStickout}mm). Minimum 10mm shank insertion required.`
      );
    }

    if (assembly.stickOutMm < tool.geometry.dimensions.cuttingLengthMm) {
      warnings.push(
        `Tool stickout (${assembly.stickOutMm}mm) is less than cutting flute length (${tool.geometry.dimensions.cuttingLengthMm}mm). Holder may collide with unmachined walls.`
      );
    }

    return {
      status: errors.length === 0 ? 'TOOL_VALID' : 'TOOL_INCOMPATIBLE',
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedFields,
      checkedAt: Date.now()
    };
  }
}
