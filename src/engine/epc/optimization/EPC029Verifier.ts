/**
 * SECP Engineering Core — EPC-029 Verifier
 * Validates the Engineering Optimization Workflow for the Industrial Drone.
 */

import { EngineeringOptimizationEngine272 } from '../../materials/EngineeringOptimizationEngine272';
import { DesignVariableRegistry272 } from '../../materials/DesignVariableRegistry272';
import { EngineeringConstraintRegistry272, OptimizationObjectiveRegistry272 } from '../../materials/EngineeringConstraintRegistry272';
import { OptimizationConfiguration, OptimizationStudy, DesignVariable, ParameterBinding } from '../../materials/OptimizationTypes272';
import { DroneOptimizationSolver } from './DroneOptimizationSolver';

export class EPC029Verifier {
  public static async runDroneOptimization(): Promise<OptimizationStudy> {
    // 1. Initialize Optimization Registries with Drone-Specific Variables
    DesignVariableRegistry272.initializeDefaultVariables(); // Clear defaults
    // Actually we need to manually register drone variables
    this.registerDroneVariables();
    this.registerDroneObjectives();
    this.registerDroneConstraints();

    // 2. Configure Optimization Engine
    const config: Partial<OptimizationConfiguration> = {
      algorithm: 'DIRECT_PATTERN_SEARCH',
      maxEvaluations: 10, // Small number for proof case performance
      convergenceCriteria: {
        maxConsecutiveNoImprovement: 3
      },
      customSolver: DroneOptimizationSolver.evaluateDrone
    };

    // 3. Run Optimization Study
    console.log('--- STARTING EPC-029 DRONE OPTIMIZATION STUDY ---');
    const study = await EngineeringOptimizationEngine272.runOptimizationStudy(
      'STUDY-DRONE-EPC029',
      'MAT-CFRP-001',
      2.0, // Required Thrust Margin (Safety Factor)
      config
    );

    console.log('--- EPC-029 STUDY COMPLETE ---');
    console.log(`Baseline Mass: ${study.baselineCandidate.analysisResults.massKg.toFixed(3)} kg`);
    console.log(`Optimized Mass: ${study.bestCandidate.analysisResults.massKg.toFixed(3)} kg`);
    console.log(`Baseline Endurance: ${study.baselineCandidate.analysisResults.missionEnduranceS?.toFixed(1)} s`);
    console.log(`Optimized Endurance: ${study.bestCandidate.analysisResults.missionEnduranceS?.toFixed(1)} s`);
    console.log(`Status: ${study.status}`);

    return study;
  }

  private static registerDroneVariables(): void {
    const mockBinding: ParameterBinding = {
      variableId: 'MOCK',
      cadParameterName: 'MOCK',
      featureId: 'MOCK',
      geometryId: 'MOCK',
      meshRegionId: 'MOCK'
    };

    // Clear and register
    DesignVariableRegistry272.registerVariable({
      variableId: 'VAR-DRONE-ARM-LENGTH',
      name: 'Drone Arm Length',
      category: 'GEOMETRIC_PARAMETER',
      defaultValue: 0.45,
      minValue: 0.3,
      maxValue: 0.6,
      stepSize: 0.05,
      unit: 'm',
      binding: { ...mockBinding, variableId: 'VAR-DRONE-ARM-LENGTH' }
    });

    DesignVariableRegistry272.registerVariable({
      variableId: 'VAR-DRONE-PROPELLER-DIAMETER',
      name: 'Propeller Diameter',
      category: 'PROPULSION_PARAMETER',
      defaultValue: 0.4572,
      minValue: 0.4,
      maxValue: 0.55,
      stepSize: 0.02,
      unit: 'm',
      binding: { ...mockBinding, variableId: 'VAR-DRONE-PROPELLER-DIAMETER' }
    });

    DesignVariableRegistry272.registerVariable({
      variableId: 'VAR-DRONE-BATTERY-CAPACITY',
      name: 'Battery Capacity',
      category: 'ENERGY_CAPACITY',
      defaultValue: 200,
      minValue: 100,
      maxValue: 500,
      stepSize: 50,
      unit: 'Wh',
      binding: { ...mockBinding, variableId: 'VAR-DRONE-BATTERY-CAPACITY' }
    });
  }

  private static registerDroneObjectives(): void {
    // We want to Maximize Endurance and Minimize Mass
    OptimizationObjectiveRegistry272.registerObjective({
      objectiveId: 'OBJ-MAX-ENDURANCE',
      type: 'MAXIMIZE_MISSION_ENDURANCE',
      name: 'Maximize Flight Endurance',
      direction: 'MAXIMIZE',
      unit: 's',
      weight: 0.7,
      rawBaselineValue: 1000,
      rawCurrentValue: 1000,
      normalizedValue: 1.0
    });

    OptimizationObjectiveRegistry272.registerObjective({
      objectiveId: 'OBJ-MIN-MASS',
      type: 'MINIMIZE_MASS',
      name: 'Minimize Takeoff Mass',
      direction: 'MINIMIZE',
      unit: 'kg',
      weight: 0.3,
      rawBaselineValue: 15,
      rawCurrentValue: 15,
      normalizedValue: 1.0
    });
  }

  private static registerDroneConstraints(): void {
    // Constraint: Thrust Margin must be >= 2.0
    EngineeringConstraintRegistry272.registerConstraint({
      constraintId: 'CONST-THRUST-MARGIN',
      type: 'PROPULSION_THRUST_MARGIN',
      name: 'Minimum Thrust-to-Weight Ratio',
      limitValue: 2.0,
      operator: 'GE',
      achievedValue: 0,
      unit: '',
      severity: 'HARD_CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'DRONE-DESIGN-STANDARD-V1'
    });

    // Constraint: Minimum Endurance 15 minutes (900s)
    EngineeringConstraintRegistry272.registerConstraint({
      constraintId: 'CONST-MIN-ENDURANCE',
      type: 'MISSION_ENDURANCE_LIMIT',
      name: 'Minimum Required Endurance',
      limitValue: 900,
      operator: 'GE',
      achievedValue: 0,
      unit: 's',
      severity: 'CONSTRAINT',
      isSatisfied: true,
      violationAmount: 0,
      sourceRule: 'MISSION-REQ-ENDURANCE-001'
    });
  }
}
