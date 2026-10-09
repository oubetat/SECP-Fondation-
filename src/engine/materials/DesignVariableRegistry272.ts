/**
 * PATCH-272: Design Variable & Parameter Binding Registry
 * Enforces explicit CAD Parameter -> Feature -> Geometry -> Mesh bindings and parameter bounds.
 */

import {
  DesignVariable,
  ParameterBinding,
  ParameterDependency,
  VariableCategory
} from './OptimizationTypes272';

export class DesignVariableRegistry272 {
  private static variables: Map<string, DesignVariable> = new Map();
  private static dependencies: Map<string, ParameterDependency> = new Map();

  public static initializeDefaultVariables(): void {
    this.variables.clear();
    this.dependencies.clear();

    // Default CAD Part variables with explicit bindings
    this.registerVariable({
      variableId: 'VAR-WALL-THICKNESS',
      name: 'Plate Wall Thickness',
      category: 'THICKNESS',
      binding: {
        variableId: 'VAR-WALL-THICKNESS',
        cadParameterName: 't_wall',
        featureId: 'FEAT-EXTRUDE-01',
        geometryId: 'FACE-FRONT-01',
        meshRegionId: 'MESH-ZONE-WALL'
      },
      minValue: 2.0, // mm
      maxValue: 15.0, // mm
      defaultValue: 8.0,
      currentValue: 8.0,
      unit: 'mm',
      isLocked: false,
      isValid: true,
      source: 'CAD_PARAMETRIC_FEATURE_TREE'
    });

    this.registerVariable({
      variableId: 'VAR-HOLE-DIAMETER',
      name: 'Center Hole Diameter',
      category: 'HOLE_DIAMETER',
      binding: {
        variableId: 'VAR-HOLE-DIAMETER',
        cadParameterName: 'd_hole',
        featureId: 'FEAT-HOLE-CUT-01',
        geometryId: 'CYLINDER-BORE-01',
        meshRegionId: 'MESH-ZONE-HOLE-EDGE'
      },
      minValue: 4.0, // mm
      maxValue: 25.0, // mm
      defaultValue: 10.0,
      currentValue: 10.0,
      unit: 'mm',
      isLocked: false,
      isValid: true,
      source: 'CAD_PARAMETRIC_FEATURE_TREE'
    });

    this.registerVariable({
      variableId: 'VAR-FILLET-RADIUS',
      name: 'Root Fillet Radius',
      category: 'FILLET_RADIUS',
      binding: {
        variableId: 'VAR-FILLET-RADIUS',
        cadParameterName: 'r_fillet',
        featureId: 'FEAT-FILLET-02',
        geometryId: 'EDGE-CORNER-BLEND',
        meshRegionId: 'MESH-ZONE-FILLET-ROOT'
      },
      minValue: 1.0, // mm
      maxValue: 8.0, // mm
      defaultValue: 3.0,
      currentValue: 3.0,
      unit: 'mm',
      isLocked: false,
      isValid: true,
      source: 'CAD_PARAMETRIC_FEATURE_TREE'
    });

    this.registerVariable({
      variableId: 'VAR-PART-WIDTH',
      name: 'Overall Part Width',
      category: 'WIDTH',
      binding: {
        variableId: 'VAR-PART-WIDTH',
        cadParameterName: 'w_total',
        featureId: 'FEAT-SKETCH-BASE',
        geometryId: 'BOUNDARY-OUTER',
        meshRegionId: 'MESH-ZONE-GLOBAL'
      },
      minValue: 50.0, // mm
      maxValue: 200.0, // mm
      defaultValue: 100.0,
      currentValue: 100.0,
      unit: 'mm',
      isLocked: true, // Protected parameter
      isValid: true,
      source: 'INTERFACE_CONSTRAINT_SPEC'
    });

    // Dependency: Hole diameter must be less than 40% of part width
    this.registerDependency({
      dependencyId: 'DEP-HOLE-VS-WIDTH',
      sourceVariableId: 'VAR-HOLE-DIAMETER',
      targetVariableId: 'VAR-PART-WIDTH',
      operator: 'LESS_THAN',
      ratioOrValue: 0.4,
      description: 'Hole diameter cannot exceed 40% of overall part width'
    });
  }

  public static registerVariable(variable: DesignVariable): void {
    // Check bounds
    if (variable.minValue >= variable.maxValue) {
      variable.isValid = false;
    }
    this.variables.set(variable.variableId, variable);
  }

  public static getVariable(id: string): DesignVariable | undefined {
    return this.variables.get(id);
  }

  public static getAllVariables(): DesignVariable[] {
    return Array.from(this.variables.values());
  }

  public static registerDependency(dep: ParameterDependency): void {
    this.dependencies.set(dep.dependencyId, dep);
  }

  public static getAllDependencies(): ParameterDependency[] {
    return Array.from(this.dependencies.values());
  }

  public static validateVariableValues(params: Record<string, number>): {
    valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    for (const [varId, val] of Object.entries(params)) {
      const variable = this.variables.get(varId);
      if (!variable) continue;

      if (variable.isLocked && Math.abs(val - variable.defaultValue) > 1e-6) {
        violations.push(`Variable ${variable.name} (${varId}) is LOCKED and cannot be modified.`);
      }

      if (val < variable.minValue || val > variable.maxValue) {
        violations.push(
          `Variable ${variable.name} value ${val} ${variable.unit} is outside bounds [${variable.minValue}, ${variable.maxValue}].`
        );
      }
    }

    // Check parameter dependencies
    for (const dep of this.dependencies.values()) {
      const srcVal = params[dep.sourceVariableId];
      const tgtVal = params[dep.targetVariableId];
      if (srcVal === undefined || tgtVal === undefined) continue;

      if (dep.operator === 'LESS_THAN' && srcVal >= tgtVal * dep.ratioOrValue) {
        violations.push(
          `Dependency violation (${dep.dependencyId}): ${dep.description}. Source=${srcVal}, TargetLimit=${tgtVal * dep.ratioOrValue}`
        );
      }
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }
}
