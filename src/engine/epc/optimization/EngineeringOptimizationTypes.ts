import {
  OptimizationStudy,
  DesignVariable,
  ParameterDependency,
  EngineeringConstraint,
  OptimizationObjective,
  DesignCandidate,
  OptimizationConfiguration,
  OptimizationStudyStatus,
  OptimizationEvidence,
  OptimizationImprovementMetrics,
  AnalysisResultsSummary
} from '../../materials/OptimizationTypes272';

export interface DroneOptimizationProblem {
  problemId: string;
  productId: string;
  configurationId: string;
  revision: string;
  designVariables: DesignVariable[];
  objectives: OptimizationObjective[];
  constraints: EngineeringConstraint[];
  evaluationWorkflow: string; // e.g., 'MISSION_SIMULATION_V1'
  solverConfiguration: OptimizationConfiguration;
  stoppingCriteria: {
    maxEvaluations: number;
    maxIterations: number;
    objectiveTolerance: number;
    parameterTolerance: number;
  };
  acceptanceCriteria: {
    minImprovementPct: number;
    mustBeFeasible: boolean;
  };
}

export interface DroneAnalysisResults extends AnalysisResultsSummary {
  missionEnduranceS: number;
  totalEnergyConsumedJ: number;
  thrustMargin: number;
  maxAltitudeM: number;
  payloadMassKg: number;
}

export interface DroneOptimizationResult extends OptimizationStudy {
  problemId: string;
  productId: string;
  configurationId: string;
  baselineReference: string; // e.g., 'EVID-BASE-001'
  selectedSolution: DesignCandidate;
  candidateResults: DesignCandidate[];
  convergenceHistory: { iteration: number; bestObjective: number; maxConstraintViolation: number }[];
  terminationReason: string;
  solverMetadata: Record<string, any>;
  reproducibilityMetadata: {
    randomSeed: number;
    inputFingerprint: string;
  };
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}
