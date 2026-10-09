/**
 * SECP Industrial OS — EPC-040: Transmission Validator
 * Validates transmission geometry, kinematics, power conservation, materials,
 * stage configuration, and parameter consistency.
 */

import {
  TransmissionDefinition,
  TransmissionValidationIssue,
  TransmissionValidationReport
} from './RobotTransmissionTypes';

export class RobotTransmissionValidator {
  /**
   * Validates a complete TransmissionDefinition for engineering consistency and physical validity.
   */
  public static validateTransmission(
    transmission: TransmissionDefinition
  ): TransmissionValidationReport {
    const issues: TransmissionValidationIssue[] = [];

    // 1. Configuration Validation
    if (!transmission.transmissionId || transmission.transmissionId.trim() === '') {
      issues.push({
        field: 'transmissionId',
        severity: 'ERROR',
        message: 'Transmission ID is required and cannot be empty.',
        value: transmission.transmissionId
      });
    }

    if (!transmission.revision || transmission.revision.trim() === '') {
      issues.push({
        field: 'revision',
        severity: 'ERROR',
        message: 'Configuration revision is required for traceability.',
        value: transmission.revision
      });
    }

    if (!transmission.material || transmission.material.trim() === '') {
      issues.push({
        field: 'material',
        severity: 'ERROR',
        message: 'Transmission material definition is required.',
        value: transmission.material
      });
    }

    if (transmission.stageCount <= 0) {
      issues.push({
        field: 'stageCount',
        severity: 'ERROR',
        message: `Invalid stage count: ${transmission.stageCount}. Transmission must have at least 1 stage.`,
        value: transmission.stageCount
      });
    }

    if (!transmission.gearStages || transmission.gearStages.length !== transmission.stageCount) {
      issues.push({
        field: 'gearStages',
        severity: 'ERROR',
        message: `Stage count mismatch: expected ${transmission.stageCount} stages, but found ${
          transmission.gearStages?.length ?? 0
        }.`,
        value: transmission.gearStages?.length
      });
    }

    // 2. Efficiency Validation
    if (transmission.efficiency <= 0 || transmission.efficiency > 1.0) {
      issues.push({
        field: 'efficiency',
        severity: 'ERROR',
        message: `Physically impossible efficiency (${transmission.efficiency}). Efficiency must be in range (0, 1.0].`,
        value: transmission.efficiency
      });
    }

    // 3. Ratio & Zero-Ratio Validation
    if (transmission.ratio <= 0) {
      issues.push({
        field: 'ratio',
        severity: 'ERROR',
        message: `Invalid transmission ratio (${transmission.ratio}). Ratio must be strictly positive.`,
        value: transmission.ratio
      });
    }

    // 4. Power & Energy Conservation Validation
    if (transmission.inputPower < 0 || transmission.outputPower < 0) {
      issues.push({
        field: 'power',
        severity: 'ERROR',
        message: 'Negative physical power without explicitly defined direction is invalid.',
        value: { inputPower: transmission.inputPower, outputPower: transmission.outputPower }
      });
    }

    if (transmission.outputPower > transmission.inputPower + 1e-6) {
      issues.push({
        field: 'outputPower',
        severity: 'ERROR',
        message: `Power conservation violation: Output Power (${transmission.outputPower.toFixed(
          2
        )} W) exceeds Input Power (${transmission.inputPower.toFixed(2)} W).`,
        value: { inputPower: transmission.inputPower, outputPower: transmission.outputPower }
      });
    }

    // Expected power relation: OutputPower ≈ InputPower * Efficiency
    const expectedOutputPower = transmission.inputPower * transmission.efficiency;
    if (Math.abs(transmission.outputPower - expectedOutputPower) > 1e-2) {
      issues.push({
        field: 'outputPower',
        severity: 'ERROR',
        message: `Power inconsistency: Output Power (${transmission.outputPower.toFixed(
          2
        )} W) does not match InputPower * Efficiency (${expectedOutputPower.toFixed(2)} W).`,
        value: transmission.outputPower,
        limit: expectedOutputPower
      });
    }

    // 5. Kinematics Consistency
    if (transmission.ratio > 0) {
      const expectedOutputSpeed = transmission.inputSpeed / transmission.ratio;
      if (Math.abs(transmission.outputSpeed - expectedOutputSpeed) > 1e-2) {
        issues.push({
          field: 'outputSpeed',
          severity: 'ERROR',
          message: `Speed transformation inconsistency: Output speed (${transmission.outputSpeed.toFixed(
            2
          )} RPM) != InputSpeed / Ratio (${expectedOutputSpeed.toFixed(2)} RPM).`,
          value: transmission.outputSpeed,
          limit: expectedOutputSpeed
        });
      }

      const expectedOutputTorque =
        transmission.inputTorque * transmission.ratio * transmission.efficiency;
      if (Math.abs(transmission.outputTorque - expectedOutputTorque) > 1e-2) {
        issues.push({
          field: 'outputTorque',
          severity: 'ERROR',
          message: `Torque transformation inconsistency: Output torque (${transmission.outputTorque.toFixed(
            2
          )} Nm) != InputTorque * Ratio * Efficiency (${expectedOutputTorque.toFixed(2)} Nm).`,
          value: transmission.outputTorque,
          limit: expectedOutputTorque
        });
      }
    }

    // 6. Stages & Gear Geometry Validation
    let calculatedTotalRatio = 1.0;
    let calculatedTotalEfficiency = 1.0;

    if (transmission.gearStages) {
      for (const stage of transmission.gearStages) {
        // Stage efficiency check
        if (stage.stageEfficiency <= 0 || stage.stageEfficiency > 1.0) {
          issues.push({
            field: `stage[${stage.stageIndex}].stageEfficiency`,
            severity: 'ERROR',
            message: `Stage ${stage.stageIndex} efficiency (${stage.stageEfficiency}) is out of range (0, 1.0].`,
            value: stage.stageEfficiency
          });
        }

        // Driver Gear Validation
        const driver = stage.driverGear;
        if (!driver) {
          issues.push({
            field: `stage[${stage.stageIndex}].driverGear`,
            severity: 'ERROR',
            message: `Stage ${stage.stageIndex} missing driver gear.`,
            value: null
          });
        } else {
          if (driver.teethCount <= 0 || !Number.isInteger(driver.teethCount)) {
            issues.push({
              field: `driverGear[${driver.gearId}].teethCount`,
              severity: 'ERROR',
              message: `Driver gear ${driver.gearId} has invalid teeth count (${driver.teethCount}).`,
              value: driver.teethCount
            });
          }
          if (driver.module <= 0) {
            issues.push({
              field: `driverGear[${driver.gearId}].module`,
              severity: 'ERROR',
              message: `Driver gear ${driver.gearId} has non-positive module (${driver.module}).`,
              value: driver.module
            });
          }
          if (driver.faceWidth <= 0) {
            issues.push({
              field: `driverGear[${driver.gearId}].faceWidth`,
              severity: 'ERROR',
              message: `Driver gear ${driver.gearId} has non-positive face width (${driver.faceWidth}).`,
              value: driver.faceWidth
            });
          }
          if (driver.pitchDiameter <= 0 || driver.outsideDiameter <= 0 || driver.rootDiameter <= 0) {
            issues.push({
              field: `driverGear[${driver.gearId}].diameters`,
              severity: 'ERROR',
              message: `Driver gear ${driver.gearId} has non-positive diameter parameters.`,
              value: {
                pitch: driver.pitchDiameter,
                outside: driver.outsideDiameter,
                root: driver.rootDiameter
              }
            });
          }
          if (driver.pressureAngle <= 0 || driver.pressureAngle >= 90) {
            issues.push({
              field: `driverGear[${driver.gearId}].pressureAngle`,
              severity: 'ERROR',
              message: `Driver gear ${driver.gearId} has invalid pressure angle (${driver.pressureAngle}°).`,
              value: driver.pressureAngle
            });
          }
        }

        // Driven Gear Validation
        const driven = stage.drivenGear;
        if (!driven) {
          issues.push({
            field: `stage[${stage.stageIndex}].drivenGear`,
            severity: 'ERROR',
            message: `Stage ${stage.stageIndex} missing driven gear.`,
            value: null
          });
        } else {
          if (driven.teethCount <= 0 || !Number.isInteger(driven.teethCount)) {
            issues.push({
              field: `drivenGear[${driven.gearId}].teethCount`,
              severity: 'ERROR',
              message: `Driven gear ${driven.gearId} has invalid teeth count (${driven.teethCount}).`,
              value: driven.teethCount
            });
          }
          if (driven.module <= 0) {
            issues.push({
              field: `drivenGear[${driven.gearId}].module`,
              severity: 'ERROR',
              message: `Driven gear ${driven.gearId} has non-positive module (${driven.module}).`,
              value: driven.module
            });
          }
          if (driven.faceWidth <= 0) {
            issues.push({
              field: `drivenGear[${driven.gearId}].faceWidth`,
              severity: 'ERROR',
              message: `Driven gear ${driven.gearId} has non-positive face width (${driven.faceWidth}).`,
              value: driven.faceWidth
            });
          }
          if (driven.pitchDiameter <= 0 || driven.outsideDiameter <= 0 || driven.rootDiameter <= 0) {
            issues.push({
              field: `drivenGear[${driven.gearId}].diameters`,
              severity: 'ERROR',
              message: `Driven gear ${driven.gearId} has non-positive diameter parameters.`,
              value: {
                pitch: driven.pitchDiameter,
                outside: driven.outsideDiameter,
                root: driven.rootDiameter
              }
            });
          }
          if (driven.pressureAngle <= 0 || driven.pressureAngle >= 90) {
            issues.push({
              field: `drivenGear[${driven.gearId}].pressureAngle`,
              severity: 'ERROR',
              message: `Driven gear ${driven.gearId} has invalid pressure angle (${driven.pressureAngle}°).`,
              value: driven.pressureAngle
            });
          }
        }

        // Module Matching
        if (driver && driven && Math.abs(driver.module - driven.module) > 1e-4) {
          issues.push({
            field: `stage[${stage.stageIndex}].moduleMismatch`,
            severity: 'ERROR',
            message: `Module mismatch in stage ${stage.stageIndex}: driver module (${driver.module}mm) != driven module (${driven.module}mm).`,
            value: { driverModule: driver.module, drivenModule: driven.module }
          });
        }

        // Ratio consistency in stage
        if (driver && driven && driver.teethCount > 0 && driven.teethCount > 0) {
          const expectedStageRatio = driven.teethCount / driver.teethCount;
          if (Math.abs(stage.stageRatio - expectedStageRatio) > 1e-4) {
            issues.push({
              field: `stage[${stage.stageIndex}].stageRatio`,
              severity: 'ERROR',
              message: `Stage ${stage.stageIndex} ratio (${
                stage.stageRatio
              }) does not match driven/driver teeth ratio (${expectedStageRatio.toFixed(4)}).`,
              value: stage.stageRatio,
              limit: expectedStageRatio
            });
          }
          calculatedTotalRatio *= expectedStageRatio;
          calculatedTotalEfficiency *= stage.stageEfficiency;
        }
      }

      // Check total calculated ratio against overall transmission ratio
      if (Math.abs(transmission.ratio - calculatedTotalRatio) > 1e-4) {
        issues.push({
          field: 'ratio',
          severity: 'ERROR',
          message: `Total transmission ratio (${
            transmission.ratio
          }) does not match product of stage ratios (${calculatedTotalRatio.toFixed(4)}).`,
          value: transmission.ratio,
          limit: calculatedTotalRatio
        });
      }

      // Check total calculated efficiency
      if (Math.abs(transmission.efficiency - calculatedTotalEfficiency) > 1e-4) {
        issues.push({
          field: 'efficiency',
          severity: 'ERROR',
          message: `Total transmission efficiency (${
            transmission.efficiency
          }) does not match product of stage efficiencies (${calculatedTotalEfficiency.toFixed(4)}).`,
          value: transmission.efficiency,
          limit: calculatedTotalEfficiency
        });
      }
    }

    const valid = issues.filter((i) => i.severity === 'ERROR').length === 0;

    return {
      valid,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}
