export interface SPCObservation {
  observationId: string;
  partSerial: string;
  jobId: string;
  operationId: string;
  machineId: string;
  toolId: string;
  materialLotId: string;
  measurementSessionId: string;
  measurementFeatureId: string;
  nominal: number;
  measured: number;
  deviation: number;
  toleranceUpper: number;
  toleranceLower: number;
  timestamp: string;
  toolHoursUsed: number;
  coolantTemperatureC: number;
}

export interface ProcessBaseline {
  baselineId: string;
  mean: number;
  median: number;
  standardDeviation: number;
  movingRange: number;
  movingAverage: number;
  controlLimits: {
    lcl: number;
    ucl: number;
    cl: number;
  };
  baselineWindowStart: string;
  baselineWindowEnd: string;
  sampleCount: number;
}

export interface ProcessCapability {
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  overallVariation: number;
  withinVariation: number;
  status: 'CAPABLE' | 'INCAPABLE';
  interpretation: string;
}

export interface OutOfControlSignal {
  ruleId: 'RULE_1' | 'RULE_2' | 'RULE_3' | 'RULE_4' | 'RULE_5';
  severity: 'CRITICAL' | 'WARNING';
  pointIndices: number[];
}

export interface DriftState {
  slopeMmPerSample: number;
  confidenceScore: number;
  estimatedSamplesToBoundary: number;
  state: 'STABLE' | 'DEGRADING';
}
