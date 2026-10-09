/**
 * SECP Engineering Core — EPC-028: Mission Simulation Types
 * Defines the execution model for deterministic mission simulation.
 */

import { Vector3 } from '../../geometry/GeometryTypes';
import { RigidBodyState } from '../../physics/dynamics/RigidBodyTypes';

export type MissionSegmentType = 
  | 'TAKEOFF' 
  | 'CLIMB' 
  | 'CRUISE' 
  | 'PAYLOAD_OPERATION' 
  | 'RETURN' 
  | 'LANDING' 
  | 'HOVER';

export interface MissionSegmentDefinition {
  segmentId: string;
  type: MissionSegmentType;
  durationS?: number;
  targetAltitudeM?: number;
  targetVelocityMS?: Vector3;
  terminationCondition?: 'ALTITUDE_REACHED' | 'DURATION_EXPIRED' | 'TARGET_REACHED' | 'ENERGY_CRITICAL';
  acceptanceCriteria: {
    maxAllowableEnergyConsumptionJ?: number;
    requiredPrecisionM?: number;
  };
}

export interface MissionEnvironment {
  airDensityKgM3: number;
  temperatureK: number;
  pressurePa: number;
  gravityMS2: number;
  windVectorMS: Vector3;
}

export interface MissionSimulationDefinition {
  missionId: string;
  productId: string;
  configurationId: string;
  revision: string;
  requirements: string[]; // IDs from EPC-017
  initialState: RigidBodyState & { initialEnergyJ: number };
  environment: MissionEnvironment;
  segments: MissionSegmentDefinition[];
  timeStepS: number;
  solverConfiguration: {
    tolerance: number;
    integrationMethod: 'EULER' | 'RK4';
  };
}

export interface RequirementEvaluationResult {
  requirementId: string;
  input: any;
  actual: any;
  expected: any;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

export interface MissionSimulationResult {
  simulationId: string;
  executionTimestamp: string;
  trajectory: (RigidBodyState & { timeS: number; energyJ: number; activeSegmentId: string })[];
  segmentResults: {
    segmentId: string;
    verdict: 'PASS' | 'FAIL';
    energyConsumedJ: number;
    durationS: number;
  }[];
  requirementResults: RequirementEvaluationResult[];
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  evidenceHash: string;
}
