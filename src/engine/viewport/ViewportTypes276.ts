export type DisplayMode = 'SHADED' | 'WIREFRAME' | 'SHADED_WITH_EDGES' | 'X_RAY' | 'CAE_ANALYSIS';
export type ProjectionMode = 'PERSPECTIVE' | 'ORTHOGRAPHIC';
export type CameraPreset = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'FRONT' | 'BACK' | 'ISO';
export type CaeFieldType = 'NONE' | 'VON_MISES' | 'VON_MISES_STRESS' | 'DISPLACEMENT' | 'TEMPERATURE' | 'PRESSURE' | 'VELOCITY' | 'PRINCIPAL_STRESS' | 'STRAIN' | 'DISPLACEMENT_MAGNITUDE' | 'FACTOR_OF_SAFETY' | 'CFD_PRESSURE' | 'CFD_VELOCITY_MAGNITUDE' | 'CFD_TEMPERATURE' | 'CFD_STREAMLINES';

export interface PersistentEntityId {
  entityId: string;
  entityType: SelectionType;
  parentPartId?: string;
  parentBodyId?: string;
  translation?: [number, number, number];
  scale?: [number, number, number];
}

export type SelectionType = 'FACE' | 'EDGE' | 'BODY' | 'PART' | 'VERTEX' | 'ASSEMBLY_COMPONENT';

export interface ContourScale {
  minVal: number;
  maxVal: number;
  unit: string;
  colorPalette: 'RAINBOW' | 'JET' | 'VIRIDIS' | 'COOL_WARM';
  numBins: number;
  noData: boolean;
}

export interface EvidenceSnapshot {
  snapshotId: string;
  timestamp: string;
  viewportState?: any;
  cameraMatrix?: number[];
  imageHash?: string;
  modelRevision?: string;
  cameraState?: any;
  displayMode?: DisplayMode;
  resultOverlay?: SimulationResultOverlay;
  digitalSignatureSHA256?: string;
}

export type SceneNode = any;
export type RenderingBackendType = 'WEBGL' | 'WEBGPU' | 'WebGL' | 'WebGPU' | 'Canvas2DFallback';
export type SectionPlaneState = any;
export type SimulationResultOverlay = any;
export type CAMToolpathOverlay = any;
export type NamedView = any;
export type ViewportPerformanceStats = any;
export type ViewportState = any;
export type GeometryRenderBinding = any;
