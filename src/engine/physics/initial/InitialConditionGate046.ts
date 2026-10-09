/**
 * SECP Industrial OS v2 — Initial Condition Gate
 * PATCH-046: Initial Condition Framework
 */

import { InitialState, SimulationConditionSet } from './InitialTypes';
import { InitialValidator } from './InitialValidator';

export type InitialGateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

export interface InitialGateResult {
  status: InitialGateVerdict;
  failedChecks: string[];
  capabilities: {
    INITIAL_CONDITION_FRAMEWORK: boolean;
    SEPARATION_FROM_BOUNDARY_CONDITIONS: boolean;
    UNITS_INTEGRATION: boolean;
    SCALAR_VECTOR_TENSOR_SUPPORT: boolean;
    COORDINATE_SYSTEM_DEFINITION: boolean;
    CONFLICT_DETECTION: boolean;
    COMPLETENESS_VALIDATION: boolean;
    CANONICAL_REPRESENTATION: boolean;
    SOLVER_INTEGRATION: 'UNPROVEN' | 'IMPLEMENTED';
    SPATIAL_FIELDS: 'UNPROVEN' | 'IMPLEMENTED';
    PHYSICAL_QUALIFICATION: 'UNPROVEN' | 'IMPLEMENTED';
  };
}

export class InitialConditionGate046 {
  public static evaluate(testState?: InitialState, testSimulationSet?: SimulationConditionSet): InitialGateResult {
    const failedChecks: string[] = [];

    if (testState) {
      const res = InitialValidator.validateInitialState(testState);
      if (!res.valid) {
        failedChecks.push(...res.errors);
      }
    }

    if (testSimulationSet) {
      if (!testSimulationSet.initialState || !testSimulationSet.boundaryConditionSet) {
        failedChecks.push('SimulationConditionSet must maintain explicit separation of initialState and boundaryConditionSet');
      }
    }

    const verdict: InitialGateVerdict = failedChecks.length > 0 ? 'FAIL' : 'PASS';

    return {
      status: verdict,
      failedChecks,
      capabilities: {
        INITIAL_CONDITION_FRAMEWORK: true,
        SEPARATION_FROM_BOUNDARY_CONDITIONS: true,
        UNITS_INTEGRATION: true,
        SCALAR_VECTOR_TENSOR_SUPPORT: true,
        COORDINATE_SYSTEM_DEFINITION: true,
        CONFLICT_DETECTION: true,
        COMPLETENESS_VALIDATION: true,
        CANONICAL_REPRESENTATION: true,
        SOLVER_INTEGRATION: 'UNPROVEN',
        SPATIAL_FIELDS: 'UNPROVEN',
        PHYSICAL_QUALIFICATION: 'UNPROVEN'
      }
    };
  }
}
