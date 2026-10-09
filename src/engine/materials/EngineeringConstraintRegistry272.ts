/**
 * PATCH-272: Engineering Constraint & Objective Registries
 * Evaluates geometric, structural, safety (PATCH-271), failure (PATCH-270), fatigue (PATCH-269), thermal, and CFD constraints.
 */

import {
  EngineeringConstraint,
  OptimizationObjective,
  AnalysisResultsSummary,
  ConstraintType,
  ConstraintOperator,
  ConstraintSeverity,
  ObjectiveType,
  ObjectiveDirection
} from './OptimizationTypes272';

export class EngineeringConstraintRegistry272 {
  private static constraints: Map<string, EngineeringConstraint> = new Map();

  public static initializeDefaultConstraints(requiredFoS: number = 1.5): void {
    this.constraints.clear();

    // 1. Structural Stress Constraint
    this.registerConstraint({
      constraintId: 'CONST-MAX-STRESS',
      type: 'STRUCTURAL_STRESS',
      name: 'Maximum Von Mises Stress Limit',
      limitValue: 200e6, // 200 MPa
      operator: 'LE',
      achievedValue: 0,
      unit: 'Pa',
      severity: 'HARD_CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'ASME_SECTION_VIII_DIV_2'
    });

    // 2. Safety Factor Constraint (PATCH-271 Integration)
    this.registerConstraint({
      constraintId: 'CONST-SAFETY-FACTOR',
      type: 'SAFETY_FACTOR',
      name: 'Minimum Required Safety Factor (PATCH-271)',
      limitValue: requiredFoS,
      operator: 'GE',
      achievedValue: 0,
      unit: '',
      severity: 'HARD_CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'ASME-NUM-1-SAFETY-GATE'
    });

    // 3. Structural Displacement Limit
    this.registerConstraint({
      constraintId: 'CONST-DISPLACEMENT',
      type: 'STRUCTURAL_DISPLACEMENT',
      name: 'Maximum Allowable Deflection',
      limitValue: 1.5, // 1.5 mm
      operator: 'LE',
      achievedValue: 0,
      unit: 'mm',
      severity: 'CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'SERVICEABILITY_CRITERIA'
    });

    // 4. Failure Index Constraint (PATCH-270 Integration)
    this.registerConstraint({
      constraintId: 'CONST-FAILURE-INDEX',
      type: 'FAILURE_INDEX',
      name: 'Failure Index Limit (PATCH-270)',
      limitValue: 1.0,
      operator: 'LE',
      achievedValue: 0,
      unit: '',
      severity: 'HARD_CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'CARDANO_DUCTILE_BRITTLE_CRITERION'
    });
  }

  public static registerConstraint(c: EngineeringConstraint): void {
    this.constraints.set(c.constraintId, c);
  }

  public static getAllConstraints(): EngineeringConstraint[] {
    return Array.from(this.constraints.values());
  }

  public static evaluateConstraints(results: AnalysisResultsSummary): {
    evaluatedConstraints: EngineeringConstraint[];
    isFeasible: boolean;
    maxViolation: number;
  } {
    const evaluated: EngineeringConstraint[] = [];
    let isFeasible = true;
    let maxViolation = 0;

    for (const template of this.constraints.values()) {
      const c: EngineeringConstraint = { ...template };

      if (c.type === 'STRUCTURAL_STRESS') {
        c.achievedValue = results.maxVonMisesStressPa;
      } else if (c.type === 'SAFETY_FACTOR') {
        c.achievedValue = results.safetyFactorFoS;
      } else if (c.type === 'STRUCTURAL_DISPLACEMENT') {
        c.achievedValue = results.maxDisplacementMm;
      } else if (c.type === 'FAILURE_INDEX') {
        c.achievedValue = results.failureIndex;
      } else if (c.type === 'FATIGUE_LIFE') {
        c.achievedValue = results.fatigueDamageRatio;
      } else if (c.type === 'THERMAL_TEMPERATURE') {
        c.achievedValue = results.maxTempC;
      } else if (c.type === 'CFD_PRESSURE_DROP') {
        c.achievedValue = results.pressureDropPa;
      } else if (c.type === 'PROPULSION_THRUST_MARGIN') {
        c.achievedValue = (results as any).thrustMargin || 0;
      } else if (c.type === 'MISSION_ENERGY_LIMIT') {
        c.achievedValue = (results as any).totalEnergyConsumedJ || 0;
      } else if (c.type === 'MISSION_ENDURANCE_LIMIT') {
        c.achievedValue = (results as any).missionEnduranceS || 0;
      }

      // Check satisfaction
      let satisfied = true;
      let violation = 0;

      if (c.operator === 'LE') {
        if (c.achievedValue > c.limitValue) {
          satisfied = false;
          violation = c.achievedValue - c.limitValue;
        }
      } else if (c.operator === 'GE') {
        if (c.achievedValue < c.limitValue) {
          satisfied = false;
          violation = c.limitValue - c.achievedValue;
        }
      } else if (c.operator === 'EQ') {
        violation = Math.abs(c.achievedValue - c.limitValue);
        if (violation > 1e-4) {
          satisfied = false;
        }
      }

      c.isSatisfied = satisfied;
      c.violationAmount = violation;

      if (!satisfied && c.severity === 'HARD_CONSTRAINT') {
        isFeasible = false;
      }

      if (violation > maxViolation) {
        maxViolation = violation;
      }

      evaluated.push(c);
    }

    return {
      evaluatedConstraints: evaluated,
      isFeasible,
      maxViolation
    };
  }
}

export class OptimizationObjectiveRegistry272 {
  private static objectives: Map<string, OptimizationObjective> = new Map();

  public static initializeDefaultObjectives(): void {
    this.objectives.clear();

    // 1. Minimize Mass Objective
    this.registerObjective({
      objectiveId: 'OBJ-MIN-MASS',
      type: 'MINIMIZE_MASS',
      name: 'Minimize Component Mass',
      direction: 'MINIMIZE',
      unit: 'kg',
      weight: 0.6,
      rawBaselineValue: 1.5,
      rawCurrentValue: 1.5,
      normalizedValue: 1.0
    });

    // 2. Minimize Displacement Objective
    this.registerObjective({
      objectiveId: 'OBJ-MIN-DISPLACEMENT',
      type: 'MINIMIZE_DISPLACEMENT',
      name: 'Minimize Structural Deflection',
      direction: 'MINIMIZE',
      unit: 'mm',
      weight: 0.4,
      rawBaselineValue: 1.2,
      rawCurrentValue: 1.2,
      normalizedValue: 1.0
    });
  }

  public static registerObjective(obj: OptimizationObjective): void {
    this.objectives.set(obj.objectiveId, obj);
  }

  public static getAllObjectives(): OptimizationObjective[] {
    return Array.from(this.objectives.values());
  }

  public static evaluateObjectives(
    results: AnalysisResultsSummary,
    baselineResults: AnalysisResultsSummary
  ): {
    evaluatedObjectives: OptimizationObjective[];
    compositeScore: number;
  } {
    const evaluated: OptimizationObjective[] = [];
    let compositeScore = 0;

    for (const template of this.objectives.values()) {
      const obj: OptimizationObjective = { ...template };

      let currentVal = 0;
      let baseVal = 1.0;

      if (obj.type === 'MINIMIZE_MASS') {
        currentVal = results.massKg;
        baseVal = Math.max(0.001, baselineResults.massKg);
      } else if (obj.type === 'MINIMIZE_VOLUME') {
        currentVal = results.volumeM3;
        baseVal = Math.max(1e-6, baselineResults.volumeM3);
      } else if (obj.type === 'MINIMIZE_COST') {
        currentVal = results.manufacturingCostUSD;
        baseVal = Math.max(1.0, baselineResults.manufacturingCostUSD);
      } else if (obj.type === 'MINIMIZE_DISPLACEMENT') {
        currentVal = results.maxDisplacementMm;
        baseVal = Math.max(0.01, baselineResults.maxDisplacementMm);
      } else if (obj.type === 'MAXIMIZE_STIFFNESS') {
        // Stiffness proportional to 1 / displacement
        currentVal = 1.0 / Math.max(0.01, results.maxDisplacementMm);
        baseVal = 1.0 / Math.max(0.01, baselineResults.maxDisplacementMm);
      } else if (obj.type === 'MINIMIZE_PRESSURE_DROP') {
        currentVal = results.pressureDropPa;
        baseVal = Math.max(1.0, baselineResults.pressureDropPa);
      } else if (obj.type === 'MAXIMIZE_MISSION_ENDURANCE') {
        currentVal = (results as any).missionEnduranceS || 0;
        baseVal = Math.max(1.0, (baselineResults as any).missionEnduranceS || 1.0);
      } else if (obj.type === 'MINIMIZE_ENERGY_CONSUMPTION') {
        currentVal = (results as any).totalEnergyConsumedJ || 0;
        baseVal = Math.max(1.0, (baselineResults as any).totalEnergyConsumedJ || 1.0);
      } else if (obj.type === 'MAXIMIZE_THRUST_MARGIN') {
        currentVal = (results as any).thrustMargin || 0;
        baseVal = Math.max(0.01, (baselineResults as any).thrustMargin || 0.01);
      }

      obj.rawBaselineValue = baseVal;
      obj.rawCurrentValue = currentVal;

      // Normalization relative to baseline
      let normVal = 1.0;
      if (obj.direction === 'MINIMIZE') {
        normVal = currentVal / baseVal;
      } else if (obj.direction === 'MAXIMIZE') {
        normVal = baseVal / Math.max(1e-6, currentVal);
      }

      obj.normalizedValue = normVal;
      compositeScore += normVal * obj.weight;

      evaluated.push(obj);
    }

    return {
      evaluatedObjectives: evaluated,
      compositeScore
    };
  }
}
