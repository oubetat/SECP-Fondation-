import { WorkflowStage } from '../workflow/RealEngineerWorkflowTypes';

export type CamOperationType = 
  | 'FACING' 
  | 'POCKETING' 
  | 'DRILLING' 
  | 'CONTOUR' 
  | 'ADAPTIVE' 
  | '5AXIS_MILLING';

export interface CamToolMetadata {
  toolId: string;
  diameterMm: number;
  lengthMm: number;
  type: string;
  material: string;
}

export interface CamMachineMetadata {
  machineId: string;
  type: string;
  axisCount: number;
  kinematicConfig: string;
}

export interface ToolpathMetrics {
  totalPathLengthMm: number;
  cuttingLengthMm: number;
  rapidLengthMm: number;
  estimatedCycleTimeMin: number;
  moveCount: number;
}

export interface CamValidationMetrics {
  pathDeviationMaxMm: number;
  cycleTimeDifferencePct: number;
  collisionCount: number;
  gougeCount: number;
  materialRemovalEquivalencePct: number;
}

export interface CamComparisonRecord {
  comparisonId: string;
  secpCamRunId: string;
  externalCamRunId: string;
  operationType: CamOperationType;
  metrics: CamValidationMetrics;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}

export interface MachiningTrialRecord {
  trialId: string;
  camRunId: string;
  actualCycleTimeMin: number;
  actualFeedDeviationPct: number;
  actualSpindleDeviationPct: number;
  inspectionPassed: boolean;
}
