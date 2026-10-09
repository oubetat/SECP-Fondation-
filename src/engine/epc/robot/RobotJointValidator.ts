/**
 * SECP Industrial OS — EPC-039: Robot Joint Validator
 * Deterministic engineering validation for robotic joint definitions,
 * parametric dimensions, axis normalization, kinematic limits, materials,
 * and parent/child assembly topology.
 */

import {
  RobotJointDefinition,
  JointValidationReport,
  JointValidationIssue,
  JointGeometryParameters
} from './RobotJointTypes';

export class RobotJointValidator {
  /**
   * Recognized material densities (g/cm^3) for material validity checks
   */
  public static readonly MATERIAL_DENSITY_TABLE: Record<string, number> = {
    'AL7075-T6': 2.81,
    'AL6061-T6': 2.70,
    'AISI_4140_STEEL': 7.85,
    'STAINLESS_STEEL_316L': 8.00,
    'TITANIUM_TI6AL4V': 4.43,
    'CARBON_FIBER_COMPOSITE': 1.55,
    'BRONZE_SAE660': 8.80
  };

  /**
   * Validate a robot joint definition comprehensively
   */
  public static validateJoint(joint: RobotJointDefinition): JointValidationReport {
    const issues: JointValidationIssue[] = [];

    // 1. Schema Validation
    if (!joint.jointId || joint.jointId.trim() === '') {
      issues.push({
        field: 'jointId',
        severity: 'ERROR',
        message: 'Joint ID is required and cannot be empty.',
        value: joint.jointId
      });
    }

    if (!joint.jointType || joint.jointType.trim() === '') {
      issues.push({
        field: 'jointType',
        severity: 'ERROR',
        message: 'Joint type is required.',
        value: joint.jointType
      });
    }

    if (!joint.parentLinkId || joint.parentLinkId.trim() === '') {
      issues.push({
        field: 'parentLinkId',
        severity: 'ERROR',
        message: 'Parent Link ID is required.',
        value: joint.parentLinkId
      });
    }

    if (!joint.childLinkId || joint.childLinkId.trim() === '') {
      issues.push({
        field: 'childLinkId',
        severity: 'ERROR',
        message: 'Child Link ID is required.',
        value: joint.childLinkId
      });
    }

    if (joint.parentLinkId && joint.childLinkId && joint.parentLinkId === joint.childLinkId) {
      issues.push({
        field: 'childLinkId',
        severity: 'ERROR',
        message: 'Parent Link ID and Child Link ID cannot be identical.',
        value: joint.childLinkId
      });
    }

    // 2. Joint Axis Vector Validation
    const axis = joint.axis;
    if (!axis || typeof axis.x !== 'number' || typeof axis.y !== 'number' || typeof axis.z !== 'number') {
      issues.push({
        field: 'axis',
        severity: 'ERROR',
        message: 'Axis vector must contain numeric x, y, and z coordinates.',
        value: axis
      });
    } else {
      if (!Number.isFinite(axis.x) || !Number.isFinite(axis.y) || !Number.isFinite(axis.z)) {
        issues.push({
          field: 'axis',
          severity: 'ERROR',
          message: 'Axis vector contains non-finite values (NaN or Infinity).',
          value: axis
        });
      } else {
        const norm = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
        if (norm < 1e-6) {
          issues.push({
            field: 'axis',
            severity: 'ERROR',
            message: 'Zero-length or degenerate joint axis vector is invalid.',
            value: axis
          });
        }
      }
    }

    // 3. Joint Origin Validation
    const origin = joint.origin;
    if (!origin || typeof origin.x !== 'number' || typeof origin.y !== 'number' || typeof origin.z !== 'number') {
      issues.push({
        field: 'origin',
        severity: 'ERROR',
        message: 'Origin vector must contain numeric x, y, and z coordinates.',
        value: origin
      });
    } else if (!Number.isFinite(origin.x) || !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) {
      issues.push({
        field: 'origin',
        severity: 'ERROR',
        message: 'Origin vector contains non-finite values.',
        value: origin
      });
    }

    // 4. Joint Limits Validation
    const limits = joint.limits;
    if (!limits) {
      issues.push({
        field: 'limits',
        severity: 'ERROR',
        message: 'Joint limits definition is required.',
        value: limits
      });
    } else {
      if (limits.minimumPosition > limits.maximumPosition) {
        issues.push({
          field: 'limits.minimumPosition',
          severity: 'ERROR',
          message: `Minimum position (${limits.minimumPosition}) cannot be greater than maximum position (${limits.maximumPosition}).`,
          value: limits.minimumPosition,
          limit: limits.maximumPosition
        });
      }

      if (limits.maxVelocity <= 0) {
        issues.push({
          field: 'limits.maxVelocity',
          severity: 'ERROR',
          message: `Maximum velocity must be strictly positive (got ${limits.maxVelocity}).`,
          value: limits.maxVelocity
        });
      }

      if (limits.maxAcceleration <= 0) {
        issues.push({
          field: 'limits.maxAcceleration',
          severity: 'ERROR',
          message: `Maximum acceleration must be strictly positive (got ${limits.maxAcceleration}).`,
          value: limits.maxAcceleration
        });
      }

      if (limits.maxTorque <= 0) {
        issues.push({
          field: 'limits.maxTorque',
          severity: 'ERROR',
          message: `Maximum torque must be strictly positive (got ${limits.maxTorque}).`,
          value: limits.maxTorque
        });
      }

      if (limits.ratedTorque > limits.maxTorque) {
        issues.push({
          field: 'limits.ratedTorque',
          severity: 'ERROR',
          message: `Rated torque (${limits.ratedTorque}) cannot exceed maximum torque (${limits.maxTorque}).`,
          value: limits.ratedTorque,
          limit: limits.maxTorque
        });
      }

      if (joint.position < limits.minimumPosition || joint.position > limits.maximumPosition) {
        issues.push({
          field: 'position',
          severity: 'WARNING',
          message: `Joint current position (${joint.position}) is outside defined limits [${limits.minimumPosition}, ${limits.maximumPosition}].`,
          value: joint.position
        });
      }
    }

    // 5. Parametric Geometry Validation
    if (joint.geometryParams) {
      this.validateGeometryParameters(joint.geometryParams, issues);
    } else {
      issues.push({
        field: 'geometryParams',
        severity: 'ERROR',
        message: 'Parametric geometry parameters are missing.',
        value: joint.geometryParams
      });
    }

    // 6. Material Validation
    if (!joint.material || joint.material.trim() === '') {
      issues.push({
        field: 'material',
        severity: 'ERROR',
        message: 'Joint material must be specified.',
        value: joint.material
      });
    } else if (!this.MATERIAL_DENSITY_TABLE[joint.material]) {
      issues.push({
        field: 'material',
        severity: 'WARNING',
        message: `Material '${joint.material}' is not in standard database, defaulting to aluminum alloy density.`,
        value: joint.material
      });
    }

    const hasError = issues.some((issue) => issue.severity === 'ERROR');

    return {
      valid: !hasError,
      issues,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate individual geometric parameter limits and physical constraints
   */
  public static validateGeometryParameters(
    params: JointGeometryParameters,
    issues: JointValidationIssue[]
  ): void {
    const checkPositive = (field: keyof JointGeometryParameters, label: string) => {
      const val = params[field];
      if (typeof val !== 'number' || val <= 0 || !Number.isFinite(val)) {
        issues.push({
          field: `geometryParams.${field}`,
          severity: 'ERROR',
          message: `${label} must be a strictly positive number (got ${val}).`,
          value: val
        });
      }
    };

    checkPositive('jointDiameter', 'Joint diameter');
    checkPositive('shaftDiameter', 'Shaft diameter');
    checkPositive('housingDiameter', 'Housing diameter');
    checkPositive('housingLength', 'Housing length');
    checkPositive('shaftLength', 'Shaft length');
    checkPositive('flangeDiameter', 'Flange diameter');
    checkPositive('flangeThickness', 'Flange thickness');
    checkPositive('wallThickness', 'Wall thickness');

    if (params.bearingClearance < 0) {
      issues.push({
        field: 'geometryParams.bearingClearance',
        severity: 'ERROR',
        message: 'Bearing clearance cannot be negative.',
        value: params.bearingClearance
      });
    }

    // Physical nesting relationships
    if (params.shaftDiameter >= params.housingDiameter) {
      issues.push({
        field: 'geometryParams.shaftDiameter',
        severity: 'ERROR',
        message: `Shaft diameter (${params.shaftDiameter} mm) must be strictly smaller than housing diameter (${params.housingDiameter} mm).`,
        value: params.shaftDiameter,
        limit: params.housingDiameter
      });
    }

    if (params.bearingSeatDiameter >= params.housingDiameter) {
      issues.push({
        field: 'geometryParams.bearingSeatDiameter',
        severity: 'ERROR',
        message: `Bearing seat diameter (${params.bearingSeatDiameter} mm) cannot exceed or equal housing outer diameter (${params.housingDiameter} mm).`,
        value: params.bearingSeatDiameter
      });
    }

    if (params.flangeDiameter < params.housingDiameter) {
      issues.push({
        field: 'geometryParams.flangeDiameter',
        severity: 'WARNING',
        message: `Flange diameter (${params.flangeDiameter} mm) is smaller than housing diameter (${params.housingDiameter} mm).`,
        value: params.flangeDiameter
      });
    }
  }
}
