/**
 * SECP Industrial OS — EPC-008: Simulation Scenario Validator
 */

import { 
  SimulationScenario, 
  SimulationScenarioError, 
  ScenarioValidationResult,
  ScenarioLifecycle
} from './SimulationScenarioTypes';

export class SimulationScenarioValidator {
  /**
   * Performs full validation of a simulation scenario.
   */
  public static validate(scenario: Partial<SimulationScenario>): ScenarioValidationResult {
    const errors: SimulationScenarioError[] = [];

    if (!scenario.id) errors.push(SimulationScenarioError.SCENARIO_INVALID);
    
    if (!scenario.geometry || !scenario.geometry.modelId) {
      errors.push(SimulationScenarioError.MISSING_GEOMETRY);
    }
    
    if (!scenario.material || !scenario.material.materialId) {
      errors.push(SimulationScenarioError.MISSING_MATERIAL);
    }
    
    if (!scenario.solver || !scenario.solver.solverId) {
      errors.push(SimulationScenarioError.MISSING_SOLVER);
    }
    
    if (!scenario.mesh || !scenario.mesh.meshId) {
      errors.push(SimulationScenarioError.MISSING_MESH);
    }
    
    if (!scenario.boundaryConditions || scenario.boundaryConditions.length === 0) {
      errors.push(SimulationScenarioError.MISSING_BOUNDARY_CONDITION);
    }
    
    if (!scenario.loads || scenario.loads.length === 0) {
      errors.push(SimulationScenarioError.MISSING_LOAD);
    }
    
    if (!scenario.parameters || scenario.parameters.length === 0) {
      errors.push(SimulationScenarioError.MISSING_PARAMETER);
    }
    
    if (!scenario.revision) {
      errors.push(SimulationScenarioError.INVALID_REVISION);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Checks if a scenario can be modified based on its lifecycle.
   */
  public static canModify(scenario: SimulationScenario): boolean {
    return scenario.status === ScenarioLifecycle.DRAFT || scenario.status === ScenarioLifecycle.VALIDATED;
  }
}
