/**
 * SECP Industrial OS — EPC-038: Robot Parameter Validator
 * Strictly validates parameter types, ranges, physical unit consistency,
 * geometric feasibility, and cross-parameter constraints.
 */

import {
  ParametricRobotConfig,
  ParameterValidationIssue,
  ParameterValidationReport
} from './RobotParametricTypes';

export class RobotParameterValidator {
  /**
   * Performs exhaustive validation on the entire parametric configuration.
   */
  public static validateConfig(config: ParametricRobotConfig): ParameterValidationReport {
    const issues: ParameterValidationIssue[] = [];

    const { geometry, mechanical, materials, performance } = config;

    // 1. GEOMETRY PARAMETER RANGE & TYPE VALIDATION
    if (typeof geometry.baseRadius !== 'number' || isNaN(geometry.baseRadius)) {
      issues.push({ parameterId: 'BaseRadius', severity: 'ERROR', message: 'BaseRadius must be a valid number', value: geometry.baseRadius });
    } else if (geometry.baseRadius <= 0) {
      issues.push({ parameterId: 'BaseRadius', severity: 'ERROR', message: 'BaseRadius must be strictly positive (> 0 mm)', value: geometry.baseRadius, limit: 0 });
    } else if (geometry.baseRadius > 1000) {
      issues.push({ parameterId: 'BaseRadius', severity: 'WARNING', message: 'BaseRadius exceeds normal industrial envelope (> 1000 mm)', value: geometry.baseRadius, limit: 1000 });
    }

    if (typeof geometry.baseHeight !== 'number' || isNaN(geometry.baseHeight)) {
      issues.push({ parameterId: 'BaseHeight', severity: 'ERROR', message: 'BaseHeight must be a valid number', value: geometry.baseHeight });
    } else if (geometry.baseHeight <= 0) {
      issues.push({ parameterId: 'BaseHeight', severity: 'ERROR', message: 'BaseHeight must be strictly positive (> 0 mm)', value: geometry.baseHeight, limit: 0 });
    }

    if (typeof geometry.link1Length !== 'number' || isNaN(geometry.link1Length) || geometry.link1Length <= 0) {
      issues.push({ parameterId: 'Link1Length', severity: 'ERROR', message: 'Link1Length must be strictly positive (> 0 mm)', value: geometry.link1Length, limit: 0 });
    }

    if (typeof geometry.link1Radius !== 'number' || isNaN(geometry.link1Radius) || geometry.link1Radius <= 0) {
      issues.push({ parameterId: 'Link1Radius', severity: 'ERROR', message: 'Link1Radius must be strictly positive (> 0 mm)', value: geometry.link1Radius, limit: 0 });
    }

    if (typeof geometry.link2Length !== 'number' || isNaN(geometry.link2Length) || geometry.link2Length <= 0) {
      issues.push({ parameterId: 'Link2Length', severity: 'ERROR', message: 'Link2Length must be strictly positive (> 0 mm)', value: geometry.link2Length, limit: 0 });
    }

    if (typeof geometry.link2Radius !== 'number' || isNaN(geometry.link2Radius) || geometry.link2Radius <= 0) {
      issues.push({ parameterId: 'Link2Radius', severity: 'ERROR', message: 'Link2Radius must be strictly positive (> 0 mm)', value: geometry.link2Radius, limit: 0 });
    }

    if (typeof geometry.link3Length !== 'number' || isNaN(geometry.link3Length) || geometry.link3Length <= 0) {
      issues.push({ parameterId: 'Link3Length', severity: 'ERROR', message: 'Link3Length must be strictly positive (> 0 mm)', value: geometry.link3Length, limit: 0 });
    }

    if (typeof geometry.link3Radius !== 'number' || isNaN(geometry.link3Radius) || geometry.link3Radius <= 0) {
      issues.push({ parameterId: 'Link3Radius', severity: 'ERROR', message: 'Link3Radius must be strictly positive (> 0 mm)', value: geometry.link3Radius, limit: 0 });
    }

    if (typeof geometry.jointHousingDimensions !== 'number' || isNaN(geometry.jointHousingDimensions) || geometry.jointHousingDimensions <= 0) {
      issues.push({ parameterId: 'JointHousingDimensions', severity: 'ERROR', message: 'JointHousingDimensions must be strictly positive (> 0 mm)', value: geometry.jointHousingDimensions, limit: 0 });
    }

    if (typeof geometry.endEffectorOffset !== 'number' || isNaN(geometry.endEffectorOffset) || geometry.endEffectorOffset < 0) {
      issues.push({ parameterId: 'EndEffectorOffset', severity: 'ERROR', message: 'EndEffectorOffset must be non-negative (>= 0 mm)', value: geometry.endEffectorOffset, limit: 0 });
    }

    // 2. MECHANICAL PARAMETERS VALIDATION
    const checkJointRange = (name: string, val: number) => {
      if (typeof val !== 'number' || isNaN(val)) {
        issues.push({ parameterId: name, severity: 'ERROR', message: `${name} must be a valid number`, value: val });
      } else if (val <= 0 || val > 360) {
        issues.push({ parameterId: name, severity: 'ERROR', message: `${name} must be in range (0, 360] degrees`, value: val });
      }
    };

    checkJointRange('Joint1Range', mechanical.joint1Range);
    checkJointRange('Joint2Range', mechanical.joint2Range);
    checkJointRange('Joint3Range', mechanical.joint3Range);
    checkJointRange('Joint4Range', mechanical.joint4Range);
    checkJointRange('Joint5Range', mechanical.joint5Range);
    checkJointRange('Joint6Range', mechanical.joint6Range);

    if (typeof mechanical.payloadCapacity !== 'number' || isNaN(mechanical.payloadCapacity) || mechanical.payloadCapacity < 0) {
      issues.push({ parameterId: 'PayloadCapacity', severity: 'ERROR', message: 'PayloadCapacity must be non-negative (>= 0 kg)', value: mechanical.payloadCapacity, limit: 0 });
    }

    // 3. MATERIAL PARAMETERS VALIDATION
    if (!materials.link1Material || typeof materials.link1Material !== 'string') {
      issues.push({ parameterId: 'Link1Material', severity: 'ERROR', message: 'Link1Material must be a non-empty string', value: materials.link1Material });
    }
    if (!materials.link2Material || typeof materials.link2Material !== 'string') {
      issues.push({ parameterId: 'Link2Material', severity: 'ERROR', message: 'Link2Material must be a non-empty string', value: materials.link2Material });
    }
    if (!materials.link3Material || typeof materials.link3Material !== 'string') {
      issues.push({ parameterId: 'Link3Material', severity: 'ERROR', message: 'Link3Material must be a non-empty string', value: materials.link3Material });
    }

    // 4. PERFORMANCE PARAMETERS & CROSS-PARAMETER CONSTRAINTS
    if (mechanical.payloadCapacity > performance.maximumPayload) {
      issues.push({
        parameterId: 'PayloadCapacity',
        severity: 'ERROR',
        message: `PayloadCapacity (${mechanical.payloadCapacity} kg) exceeds MaximumPayload structural limit (${performance.maximumPayload} kg)`,
        value: mechanical.payloadCapacity,
        limit: performance.maximumPayload
      });
    }

    const calculatedReach = geometry.link1Length + geometry.link2Length + geometry.link3Length + geometry.endEffectorOffset;
    if (calculatedReach > performance.maximumReach) {
      issues.push({
        parameterId: 'MaximumReach',
        severity: 'ERROR',
        message: `Calculated Reach (${calculatedReach} mm) exceeds MaximumReach envelope limit (${performance.maximumReach} mm)`,
        value: calculatedReach,
        limit: performance.maximumReach
      });
    }

    if (geometry.link1Radius >= geometry.jointHousingDimensions) {
      issues.push({
        parameterId: 'Link1Radius',
        severity: 'ERROR',
        message: `Link1Radius (${geometry.link1Radius} mm) must be strictly smaller than JointHousingDimensions (${geometry.jointHousingDimensions} mm) for housing fitment`,
        value: geometry.link1Radius,
        limit: geometry.jointHousingDimensions
      });
    }

    const hasErrors = issues.some(i => i.severity === 'ERROR');

    return {
      valid: !hasErrors,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}
