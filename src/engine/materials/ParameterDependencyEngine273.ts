/**
 * PATCH-273: Parameter Dependency Engine
 * Validates CAD parameter bounds, discrete step snapping, locked parameters, and propagates dependency graph rules.
 */

import {
  CADParameter,
  ParameterDependencyRule,
  CADRegenerationStatus,
} from './ParameterOptimizationTypes273';

export class ParameterDependencyEngine273 {
  /**
   * Validate parameters against bounds, locked status, and discrete steps.
   */
  public static validateParameterValues(
    parameters: CADParameter[],
    newValues: Record<string, number>
  ): { isValid: boolean; adjustedValues: Record<string, number>; errors: string[] } {
    const errors: string[] = [];
    const adjustedValues: Record<string, number> = { ...newValues };

    for (const param of parameters) {
      const val = newValues[param.parameterId];

      if (val === undefined) {
        adjustedValues[param.parameterId] = param.currentValue;
        continue;
      }

      // Check locked status
      if (param.isLocked && Math.abs(val - param.defaultValue) > 1e-6) {
        errors.push(`Parameter ${param.name} (${param.parameterId}) is LOCKED and cannot be modified.`);
        adjustedValues[param.parameterId] = param.defaultValue;
        continue;
      }

      // Check geometric validity
      if (val <= 0 && (param.category === 'THICKNESS' || param.category === 'DIAMETER' || param.category === 'RADIUS' || param.category === 'LENGTH')) {
        errors.push(`Parameter ${param.name} has invalid negative or zero dimension: ${val}`);
        return { isValid: false, adjustedValues, errors };
      }

      // Snap to bounds
      let clamped = Math.max(param.minValue, Math.min(param.maxValue, val));

      // Domain snapping
      if (param.domain === 'INTEGER') {
        clamped = Math.round(clamped);
      } else if (param.domain === 'DISCRETE' && param.discreteValues && param.discreteValues.length > 0) {
        // Find nearest discrete value
        clamped = param.discreteValues.reduce((prev, curr) =>
          Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
        );
      } else if (param.stepSize && param.stepSize > 0) {
        const steps = Math.round((clamped - param.minValue) / param.stepSize);
        clamped = param.minValue + steps * param.stepSize;
      }

      // Precision rounding
      const precisionFactor = Math.pow(10, param.precision);
      clamped = Math.round(clamped * precisionFactor) / precisionFactor;

      adjustedValues[param.parameterId] = clamped;
    }

    return { isValid: errors.length === 0, adjustedValues, errors };
  }

  /**
   * Propagate dependencies across the parameter graph and validate engineering constraints.
   */
  public static propagateDependencies(
    parameters: CADParameter[],
    dependencies: ParameterDependencyRule[],
    parameterValues: Record<string, number>
  ): { status: CADRegenerationStatus; updatedValues: Record<string, number>; violationDetails?: string } {
    const updatedValues = { ...parameterValues };

    for (const dep of dependencies) {
      const sourceVal = updatedValues[dep.sourceParameterId];
      const targetVal = updatedValues[dep.targetParameterId];

      if (sourceVal === undefined || targetVal === undefined) continue;

      const sourceParam = parameters.find((p) => p.parameterId === dep.sourceParameterId);
      const targetParam = parameters.find((p) => p.parameterId === dep.targetParameterId);

      const sourceName = sourceParam ? sourceParam.name : dep.sourceParameterId;
      const targetName = targetParam ? targetParam.name : dep.targetParameterId;

      switch (dep.ruleType) {
        case 'LESS_THAN':
          if (!(sourceVal < targetVal * dep.ratioOrValue)) {
            return {
              status: 'PARAMETER_DEPENDENCY_ERROR',
              updatedValues,
              violationDetails: `Dependency Violation (${dep.dependencyId}): ${sourceName} (${sourceVal}) must be < ${targetName} * ${dep.ratioOrValue} (${targetVal * dep.ratioOrValue})`,
            };
          }
          break;

        case 'GREATER_THAN':
          if (!(sourceVal > targetVal * dep.ratioOrValue)) {
            return {
              status: 'PARAMETER_DEPENDENCY_ERROR',
              updatedValues,
              violationDetails: `Dependency Violation (${dep.dependencyId}): ${sourceName} (${sourceVal}) must be > ${targetName} * ${dep.ratioOrValue}`,
            };
          }
          break;

        case 'RATIO':
          // Enforce ratio: sourceVal = targetVal * ratio
          const expectedSource = targetVal * dep.ratioOrValue;
          if (Math.abs(sourceVal - expectedSource) > 1e-3) {
            updatedValues[dep.sourceParameterId] = Math.round(expectedSource * 100) / 100;
          }
          break;

        case 'MINIMUM_WALL_THICKNESS':
          // Minimum wall thickness rule: WallThickness >= MinWall
          if (sourceVal < dep.ratioOrValue) {
            return {
              status: 'ZERO_THICKNESS',
              updatedValues,
              violationDetails: `Wall thickness ${sourceName} (${sourceVal} mm) is less than minimum allowed ${dep.ratioOrValue} mm.`,
            };
          }
          break;

        case 'HOLE_CLEARANCE':
          // Hole diameter must be less than mounting pad size
          if (sourceVal >= targetVal - dep.ratioOrValue) {
            return {
              status: 'INVALID_GEOMETRY',
              updatedValues,
              violationDetails: `Hole diameter ${sourceName} (${sourceVal}) exceeds mounting edge clearance.`,
            };
          }
          break;
      }
    }

    return { status: 'SUCCESS', updatedValues };
  }
}
