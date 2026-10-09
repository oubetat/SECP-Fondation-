/**
 * SECP Industrial OS v3 — PATCH-180: Massive Assembly Engine Types
 * Pure TypeScript types for 1,000 to 50,000+ component assemblies.
 * Decoupled from DOM/WebGL, supporting Instance Graphs, Spatial Hierarchies,
 * LOD Hysteresis, Hierarchical Culling, and GPU Instanced Buffering.
 */

import { Vector3D } from '../../cadKernel';

export type ComponentDefinitionID = string;
export type InstanceID = string;
export type NodeID = string;
export type AssemblyPath = string; // e.g. "Root/Airframe/Wing_LH/Rib_04/Fastener_012"
export type MaterialID = string;

export type LODLevel = 
  | 'LOD0_FULL'
  | 'LOD1_REDUCED'
  | 'LOD2_SIMPLIFIED'
  | 'LOD3_PROXY'
  | 'LOD4_BOUNDS';

export type ProxyRepresentationType = 
  | 'FULL_BREP'
  | 'TESSELLATED'
  | 'SIMPLIFIED'
  | 'PROXY'
  | 'BOUNDING_BOX'
  | 'BOUNDING_SPHERE';

export type LifecycleState = 
  | 'UNLOADED'
  | 'LOADING'
  | 'PROXY'
  | 'SIMPLIFIED'
  | 'FULL'
  | 'SUPPRESSED';

export type VisibilityLogicalState = 
  | 'VISIBLE'
  | 'HIDDEN'
  | 'SUPPRESSED'
  | 'ISOLATED'
  | 'SELECTED'
  | 'HIGHLIGHTED';

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
  center: Vector3D;
  extents: Vector3D;
}

export interface BoundingSphere3D {
  center: Vector3D;
  radius: number;
}

export interface Matrix4x4 {
  elements: Float32Array; // 16 elements column-major
}

export interface Plane3D {
  normal: Vector3D;
  distance: number;
}

export interface CameraFrustum {
  planes: {
    near: Plane3D;
    far: Plane3D;
    left: Plane3D;
    right: Plane3D;
    top: Plane3D;
    bottom: Plane3D;
  };
  position: Vector3D;
  target: Vector3D;
  fovDeg: number;
  aspect: number;
  near: number;
  far: number;
  viewportHeightPx: number;
}

export interface ComponentMeshLODData {
  lodLevel: LODLevel;
  vertexCount: number;
  triangleCount: number;
  byteSize: number;
  vertices?: Float32Array;
  normals?: Float32Array;
  indices?: Uint32Array;
}

export interface ComponentDefinition {
  definitionId: ComponentDefinitionID;
  partNumber: string;
  name: string;
  category: 'FASTENER' | 'STRUCTURAL' | 'ROTATING' | 'ELECTRONIC' | 'HOUSING' | 'MECHANISM' | 'STANDARD_HARDWARE';
  materialId: MaterialID;
  massKg: number;
  nominalBounds: BoundingBox3D;
  nominalSphere: BoundingSphere3D;
  lods: Record<LODLevel, ComponentMeshLODData>;
  proxyType: ProxyRepresentationType;
  bRepFaceCount: number;
  totalInstancesCount: number;
  isStandardPart: boolean;
}

export interface ComponentInstance {
  instanceId: InstanceID;
  definitionId: ComponentDefinitionID;
  parentNodeId: NodeID;
  path: AssemblyPath;
  persistentId: string;
  
  // Transforms
  localTransform: Matrix4x4;
  worldTransform: Matrix4x4;
  
  // World space bounding volumes
  worldBounds: BoundingBox3D;
  worldSphere: BoundingSphere3D;
  
  // State
  lifecycleState: LifecycleState;
  visibilityState: VisibilityLogicalState;
  currentLOD: LODLevel;
  targetLOD: LODLevel;
  
  // Flags
  isSuppressed: boolean;
  isSelected: boolean;
  isIsolated: boolean;
  isHighlighted: boolean;
  importanceWeight: number; // 0.1 to 2.0 (e.g. main fuselage = 2.0, washer = 0.2)
  
  // Telemetry / Caching
  lastVisibleDistance: number;
  lastScreenPixelSize: number;
}

export interface AssemblyNode {
  nodeId: NodeID;
  name: string;
  type: 'ROOT' | 'SUBASSEMBLY' | 'COMPONENT_INSTANCE';
  parentId: NodeID | null;
  childrenIds: NodeID[];
  instanceId?: InstanceID; // populated if type === 'COMPONENT_INSTANCE'
  
  localTransform: Matrix4x4;
  worldTransform: Matrix4x4;
  worldBounds: BoundingBox3D;
  
  isDirty: boolean;
  isSuppressed: boolean;
  isHidden: boolean;
}

export enum DirtyFlags {
  CLEAN = 0,
  TRANSFORM_DIRTY = 1 << 0,
  GEOMETRY_DIRTY = 1 << 1,
  VISIBILITY_DIRTY = 1 << 2,
  LOD_DIRTY = 1 << 3,
  SPATIAL_DIRTY = 1 << 4,
  METADATA_DIRTY = 1 << 5
}

export interface Ray3D {
  origin: Vector3D;
  direction: Vector3D;
}

export interface RaycastHit {
  instanceId: InstanceID;
  definitionId: ComponentDefinitionID;
  path: AssemblyPath;
  point: Vector3D;
  distance: number;
  normal: Vector3D;
  triangleIndex?: number;
}

export interface OccluderVolume {
  id: string;
  name: string;
  bounds: BoundingBox3D;
  opacity: number;
}

export interface GPUInstanceBatch {
  definitionId: ComponentDefinitionID;
  materialId: MaterialID;
  lodLevel: LODLevel;
  instanceCount: number;
  // Packed Float32 array containing 16 floats for transform, 4 floats for material/LOD/flags per instance
  instanceBuffer: Float32Array;
}

export interface AssemblyPerformanceMetrics {
  totalComponentsCount: number;
  activeInstancesCount: number;
  uniqueDefinitionsCount: number;
  
  visibleComponentsCount: number;
  frustumCulledCount: number;
  occlusionCulledCount: number;
  suppressedCount: number;
  
  lodDistribution: {
    lod0Full: number;
    lod1Reduced: number;
    lod2Simplified: number;
    lod3Proxy: number;
    lod4Bounds: number;
  };
  
  drawCallsCount: number;
  totalTrianglesRendered: number;
  totalTrianglesCulled: number;
  
  gpuMemoryUsedBytes: number;
  gpuMemoryBudgetBytes: number;
  memoryReductionRatio: number; // e.g. 18.5x vs raw full geometry loading
  
  cpuUpdateTimeMs: number;
  gpuUploadTimeMs: number;
  spatialQueryTimeMs: number;
  cullingTimeMs: number;
  selectionQueryTimeMs: number;
  
  estimatedFPS: number;
  frameTimeMs: number;
}

export interface MassiveAssemblyConfig {
  massiveModeEnabled: boolean;
  massiveThresholdCount: number; // e.g. 1000
  enableHierarchicalFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
  enableLODHysteresis: boolean;
  enableGeometryStreaming: boolean;
  maxGPUMemoryMB: number;
  lodHysteresisBandPct: number; // e.g. 15% band to avoid thrashing
  screenSpaceErrorThresholdPx: number; // e.g. 2.0 px
  targetFrameRate: number; // 60 fps
}
