/**
 * SECP Industrial OS — EPC-042: Robot DOF Validator
 * Validates robotic degree of freedom definitions, joint-to-DOF mapping,
 * axis geometry, reference frames, kinematic joint limits, state boundaries,
 * assembly constraint consistency, and transmission bindings.
 */

import {
  DOFDefinition,
  DOFValidationIssue,
  DOFValidationReport,
  JointDOFMapping,
  TransmissionDOFBinding
} from './RobotDOFTypes';

export class RobotDOFValidator {
  /**
   * Validates a list of DOF definitions against all engineering constraints
   */
  public static validateDOFs(
    dofs: DOFDefinition[],
    transmissionBindings: TransmissionDOFBinding[] = [],
    overrideTimestamp?: string
  ): DOFValidationReport {
    const timestamp = overrideTimestamp || new Date().toISOString();
    const issues: DOFValidationIssue[] = [];

    if (!dofs || dofs.length === 0) {
      issues.push({
        field: 'dofs',
        severity: 'ERROR',
        message: 'No DOF definitions provided for validation',
        value: dofs
      });
      return {
        valid: false,
        issues,
        timestamp
      };
    }

    // Validate each individual DOF definition
    for (const dof of dofs) {
      this.validateDOFDefinition(dof, issues);
    }

    // Validate Transmission Bindings
    for (const binding of transmissionBindings) {
      this.validateTransmissionBinding(binding, issues);
    }

    const hasErrors = issues.some(i => i.severity === 'ERROR');

    return {
      valid: !hasErrors,
      issues,
      timestamp
    };
  }

  /**
   * Validates a single DOF definition
   */
  public static validateDOFDefinition(
    dof: DOFDefinition,
    issues: DOFValidationIssue[]
  ): void {
    const prefix = `DOF [${dof.dofId || 'UNNAMED'}]`;

    // 1. Mandatory IDs & References
    if (!dof.dofId) {
      issues.push({ field: 'dofId', severity: 'ERROR', message: `${prefix}: Missing dofId`, value: dof.dofId });
    }
    if (!dof.jointId) {
      issues.push({ field: 'jointId', severity: 'ERROR', message: `${prefix}: Missing jointId`, value: dof.jointId });
    }
    if (!dof.parentLinkId) {
      issues.push({ field: 'parentLinkId', severity: 'ERROR', message: `${prefix}: Missing parentLinkId`, value: dof.parentLinkId });
    }
    if (!dof.childLinkId) {
      issues.push({ field: 'childLinkId', severity: 'ERROR', message: `${prefix}: Missing childLinkId`, value: dof.childLinkId });
    }

    // 2. Axis Geometry Validation (SECTION 5)
    if (!dof.axis) {
      issues.push({ field: 'axis', severity: 'ERROR', message: `${prefix}: Axis vector is null or undefined`, value: dof.axis });
    } else {
      const { x, y, z } = dof.axis;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        issues.push({ field: 'axis', severity: 'ERROR', message: `${prefix}: Axis components must be finite numbers`, value: dof.axis });
      } else {
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len < 1e-6) {
          issues.push({ field: 'axis', severity: 'ERROR', message: `${prefix}: Axis vector is zero or near-zero length`, value: len });
        }
      }
    }

    // 3. Reference Frame Validation (SECTION 6)
    const validFrames = ['GLOBAL', 'PARENT_LINK', 'JOINT'];
    if (!dof.referenceFrame || !validFrames.includes(dof.referenceFrame)) {
      issues.push({
        field: 'referenceFrame',
        severity: 'ERROR',
        message: `${prefix}: Invalid reference frame '${dof.referenceFrame}'. Must be one of: ${validFrames.join(', ')}`,
        value: dof.referenceFrame
      });
    }

    // 4. Limits Validation (SECTION 8)
    if (!dof.limits) {
      issues.push({ field: 'limits', severity: 'ERROR', message: `${prefix}: Missing DOFLimits object`, value: dof.limits });
    } else {
      const { minPosition, maxPosition, maxVelocity, maxAcceleration } = dof.limits;

      if (!Number.isFinite(minPosition) || !Number.isFinite(maxPosition)) {
        issues.push({ field: 'limits', severity: 'ERROR', message: `${prefix}: Position limits must be finite numbers`, value: { minPosition, maxPosition } });
      } else if (minPosition > maxPosition) {
        issues.push({
          field: 'limits.minPosition',
          severity: 'ERROR',
          message: `${prefix}: Minimum position (${minPosition}) cannot be greater than maximum position (${maxPosition})`,
          value: { minPosition, maxPosition }
        });
      }

      if (maxVelocity !== undefined && maxVelocity < 0) {
        issues.push({ field: 'limits.maxVelocity', severity: 'ERROR', message: `${prefix}: Max velocity cannot be negative`, value: maxVelocity });
      }

      if (maxAcceleration !== undefined && maxAcceleration < 0) {
        issues.push({ field: 'limits.maxAcceleration', severity: 'ERROR', message: `${prefix}: Max acceleration cannot be negative`, value: maxAcceleration });
      }
    }

    // 5. State Validation against Limits (SECTION 7 & 8)
    if (dof.state) {
      const { position, velocity, acceleration } = dof.state;

      if (!Number.isFinite(position) || !Number.isFinite(velocity) || !Number.isFinite(acceleration)) {
        issues.push({ field: 'state', severity: 'ERROR', message: `${prefix}: State components must be finite numbers`, value: dof.state });
      }

      // Check position limits if enabled and not suppressed
      if (dof.enabled && !dof.suppressed && dof.limits) {
        if (position < dof.limits.minPosition || position > dof.limits.maxPosition) {
          issues.push({
            field: 'state.position',
            severity: 'ERROR',
            message: `${prefix}: Current position (${position}) violates limits [${dof.limits.minPosition}, ${dof.limits.maxPosition}]`,
            value: position,
            limit: dof.limits.minPosition
          });
        }

        if (dof.limits.maxVelocity !== undefined && Math.abs(velocity) > dof.limits.maxVelocity + 1e-4) {
          issues.push({
            field: 'state.velocity',
            severity: 'ERROR',
            message: `${prefix}: Current velocity (${Math.abs(velocity)}) exceeds max velocity (${dof.limits.maxVelocity})`,
            value: velocity,
            limit: dof.limits.maxVelocity
          });
        }

        if (dof.limits.maxAcceleration !== undefined && Math.abs(acceleration) > dof.limits.maxAcceleration + 1e-4) {
          issues.push({
            field: 'state.acceleration',
            severity: 'ERROR',
            message: `${prefix}: Current acceleration (${Math.abs(acceleration)}) exceeds max acceleration (${dof.limits.maxAcceleration})`,
            value: acceleration,
            limit: dof.limits.maxAcceleration
          });
        }
      }
    } else {
      issues.push({ field: 'state', severity: 'ERROR', message: `${prefix}: Missing state object`, value: dof.state });
    }
  }

  /**
   * Validates transmission to DOF kinematic and kinetic consistency
   */
  public static validateTransmissionBinding(
    binding: TransmissionDOFBinding,
    issues: DOFValidationIssue[]
  ): void {
    const prefix = `TransmissionBinding [Joint: ${binding.jointId}]`;

    const expectedJointSpeedRpm = binding.motorSpeedRpm / binding.transmissionRatio;
    const speedError = Math.abs(binding.jointSpeedRpm - expectedJointSpeedRpm);

    if (speedError > 1e-3) {
      issues.push({
        field: 'jointSpeedRpm',
        severity: 'ERROR',
        message: `${prefix}: Joint speed (${binding.jointSpeedRpm} RPM) inconsistent with Motor speed (${binding.motorSpeedRpm} RPM) / Ratio (${binding.transmissionRatio}). Expected ${expectedJointSpeedRpm.toFixed(3)} RPM`,
        value: binding.jointSpeedRpm
      });
    }

    const expectedJointTorqueNm = binding.motorTorqueNm * binding.transmissionRatio * binding.transmissionEfficiency;
    const torqueError = Math.abs(binding.jointTorqueNm - expectedJointTorqueNm);

    if (torqueError > 1e-2) {
      issues.push({
        field: 'jointTorqueNm',
        severity: 'ERROR',
        message: `${prefix}: Joint torque (${binding.jointTorqueNm} Nm) inconsistent with Motor torque (${binding.motorTorqueNm} Nm) * Ratio (${binding.transmissionRatio}) * Eff (${binding.transmissionEfficiency}). Expected ${expectedJointTorqueNm.toFixed(3)} Nm`,
        value: binding.jointTorqueNm
      });
    }
  }

  /**
   * Validates explicit Joint -> DOF Mapping
   */
  public static validateJointDOFMapping(mapping: JointDOFMapping): boolean {
    const type = mapping.jointType.toUpperCase();

    let expectedDeclared = 1;
    if (type === 'FIXED') expectedDeclared = 0;
    else if (type === 'REVOLUTE' || type === 'PRISMATIC') expectedDeclared = 1;
    else if (type === 'CYLINDRICAL') expectedDeclared = 2;
    else if (type === 'SPHERICAL' || type === 'PLANAR') expectedDeclared = 3;

    return mapping.declaredDOF === expectedDeclared;
  }
}
