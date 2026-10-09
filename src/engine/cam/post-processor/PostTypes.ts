export interface PostProcessorDefinition { controllerDialect: string; postId: string; version: string; }
export interface PostConfiguration { units: string; selectedWorkOffset: string; configHash: string; }
export interface MachineDefinition { machineId: string; toolChanger: { toolChangeTimeSec: number; }; }
export interface NCProgram {
  programId: string; programName: string; postProcessorId: string; postProcessorVersion: string;
  controllerDialect: string; machineId: string; units: string; blocks: any[]; rawGCodeText: string;
  totalLines: number; totalBlocks: number; estimatedCycleTimeSec: number; sourceMap: any;
  validationStatus: string; validationErrors: any[]; validationWarnings: any[]; ncProgramHash: string;
  configHash: string; timestamp: number; origin: string;
}
export interface NCBlock {}
export interface NCSourceMap { programId: string; entries: any[]; operationBlockRanges: any; mappingHash: string; }
export interface NCSourceMapEntry {
  ncLineIndex: number; blockSequence: number; gcodeLine: string; sourceOperationId: string;
  sourceOperationName: string; sourceToolpathSegmentId: string; toolSnapshotId: string; machinePose: any;
}
export interface PostProcessingEvidence {}
