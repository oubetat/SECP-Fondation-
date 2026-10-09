/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Machine Envelope Checker: Soft & Hard Axis Stroke and Envelope Limits
 */

import { MachineDefinition, AxisPositionState, MachineLimitViolation } from './MachineSimulationTypes';

export class MachineEnvelopeChecker {
  private definition: MachineDefinition;

  constructor(definition: MachineDefinition) {
    this.definition = definition;
  }

  public checkAxisLimits(
    axes: AxisPositionState,
    blockIndex: number,
    timestampSec: number,
    rawGCodeLine: string
  ): MachineLimitViolation[] {
    const violations: MachineLimitViolation[] = [];

    for (const axisDef of this.definition.axes) {
      const axisName = axisDef.name;
      const key = axisName.toLowerCase() as keyof AxisPositionState;
      const val = axes[key];
      const limits = axisDef.limits;

      // Soft Limits Check
      if (limits.softMin !== undefined && val < limits.softMin) {
        violations.push({
          id: `SOFT_MIN_${axisName}_${blockIndex}`,
          timestampSec,
          blockIndex,
          rawGCodeLine,
          axis: axisName,
          currentValue: val,
          limitMin: limits.softMin,
          limitMax: limits.softMax ?? limits.max,
          limitType: 'SOFT_LIMIT',
          description: `Soft limit underflow on axis ${axisName}: position ${val.toFixed(3)}mm < soft min ${limits.softMin.toFixed(3)}mm`,
        });
      }
      if (limits.softMax !== undefined && val > limits.softMax) {
        violations.push({
          id: `SOFT_MAX_${axisName}_${blockIndex}`,
          timestampSec,
          blockIndex,
          rawGCodeLine,
          axis: axisName,
          currentValue: val,
          limitMin: limits.softMin ?? limits.min,
          limitMax: limits.softMax,
          limitType: 'SOFT_LIMIT',
          description: `Soft limit overflow on axis ${axisName}: position ${val.toFixed(3)}mm > soft max ${limits.softMax.toFixed(3)}mm`,
        });
      }

      // Hard Limits Check (Physical stroke boundary)
      if (val < limits.min - 1e-4) {
        violations.push({
          id: `HARD_MIN_${axisName}_${blockIndex}`,
          timestampSec,
          blockIndex,
          rawGCodeLine,
          axis: axisName,
          currentValue: val,
          limitMin: limits.min,
          limitMax: limits.max,
          limitType: axisDef.type === 'ROTARY' ? 'ROTARY_LIMIT' : 'HARD_LIMIT',
          description: `Hard stroke limit breach on axis ${axisName}: position ${val.toFixed(3)} exceeds physical lower stroke [${limits.min}, ${limits.max}]`,
        });
      } else if (val > limits.max + 1e-4) {
        violations.push({
          id: `HARD_MAX_${axisName}_${blockIndex}`,
          timestampSec,
          blockIndex,
          rawGCodeLine,
          axis: axisName,
          currentValue: val,
          limitMin: limits.min,
          limitMax: limits.max,
          limitType: axisDef.type === 'ROTARY' ? 'ROTARY_LIMIT' : 'HARD_LIMIT',
          description: `Hard stroke limit breach on axis ${axisName}: position ${val.toFixed(3)} exceeds physical upper stroke [${limits.min}, ${limits.max}]`,
        });
      }
    }

    return violations;
  }

  public checkFeedLimit(
    feedMmMin: number,
    blockIndex: number,
    timestampSec: number,
    rawGCodeLine: string
  ): MachineLimitViolation | null {
    let maxMachineFeed = 30000;
    for (const axis of this.definition.axes) {
      if (axis.limits.maxVelocity) {
        maxMachineFeed = Math.min(maxMachineFeed, axis.limits.maxVelocity);
      }
    }

    if (feedMmMin > maxMachineFeed) {
      return {
        id: `FEED_LIMIT_${blockIndex}`,
        timestampSec,
        blockIndex,
        rawGCodeLine,
        axis: 'FEED',
        currentValue: feedMmMin,
        limitMin: 1,
        limitMax: maxMachineFeed,
        limitType: 'FEED_LIMIT',
        description: `Programmed feed ${feedMmMin} mm/min exceeds maximum axis feedrate capacity ${maxMachineFeed} mm/min`,
      };
    }
    return null;
  }

  public checkSpindleLimit(
    rpm: number,
    blockIndex: number,
    timestampSec: number,
    rawGCodeLine: string
  ): MachineLimitViolation | null {
    const spindle = this.definition.spindle;
    if (rpm > spindle.maxRpm) {
      return {
        id: `SPINDLE_LIMIT_${blockIndex}`,
        timestampSec,
        blockIndex,
        rawGCodeLine,
        axis: 'SPINDLE',
        currentValue: rpm,
        limitMin: spindle.minRpm,
        limitMax: spindle.maxRpm,
        limitType: 'SPINDLE_LIMIT',
        description: `Programmed spindle speed ${rpm} RPM exceeds machine spindle ceiling of ${spindle.maxRpm} RPM`,
      };
    }
    return null;
  }
}
