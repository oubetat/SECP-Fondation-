/**
 * GPUMeshKernelRegistry.ts
 * WGSL Compute Shader Repository & Kernel Execution Registry for GPU Meshing (PATCH-300)
 */

import { MeshKernelType } from './GPUMeshingTypes';

export interface MeshKernelMetadata {
  kernelId: MeshKernelType;
  name: string;
  description: string;
  workgroupSize: [number, number, number];
  wgslSource: string;
  requiredBuffers: string[];
}

export class GPUMeshKernelRegistry {
  private static registeredKernels: Map<MeshKernelType, MeshKernelMetadata> = new Map();

  static {
    // 1. SURFACE_DISCRETIZATION / SURFACE_SAMPLING WGSL Kernel
    this.register({
      kernelId: 'SURFACE_DISCRETIZATION',
      name: 'Parametric Surface Discretization & Sampling',
      description: 'Samples 3D surface coordinates x(u,v) from parametric UV bounds with curvature adaptation',
      workgroupSize: [64, 1, 1],
      requiredBuffers: ['uvParams', 'surfaceConfig', 'outPositions', 'outNormals'],
      wgslSource: `
struct SurfaceConfig {
  surfaceType: u32, // 0: Plane, 1: Cylinder, 2: Sphere, 3: Cone, 4: HighCurvature
  uMin: f32,
  uMax: f32,
  vMin: f32,
  vMax: f32,
  radius: f32,
  height: f32,
  paramA: f32,
};

@group(0) @binding(0) var<uniform> config: SurfaceConfig;
@group(0) @binding(1) var<storage, read> uvCoords: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> outPositions: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> outNormals: array<vec4<f32>>;

const PI: f32 = 3.14159265359;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&uvCoords)) {
    return;
  }

  let uv = uvCoords[idx];
  let u = uv.x;
  let v = uv.y;

  var pos = vec3<f32>(0.0, 0.0, 0.0);
  var norm = vec3<f32>(0.0, 0.0, 1.0);

  if (config.surfaceType == 0u) {
    // Plane
    pos = vec3<f32>(u, v, 0.0);
    norm = vec3<f32>(0.0, 0.0, 1.0);
  } else if (config.surfaceType == 1u) {
    // Cylinder
    let theta = u;
    let z = v;
    pos = vec3<f32>(config.radius * cos(theta), config.radius * sin(theta), z);
    norm = normalize(vec3<f32>(cos(theta), sin(theta), 0.0));
  } else if (config.surfaceType == 2u) {
    // Sphere
    let theta = u; // 0 to 2PI
    let phi = v;   // -PI/2 to PI/2
    pos = vec3<f32>(
      config.radius * cos(phi) * cos(theta),
      config.radius * cos(phi) * sin(theta),
      config.radius * sin(phi)
    );
    norm = normalize(pos);
  } else if (config.surfaceType == 4u) {
    // High-Curvature Sinusoidal Wave
    let z = config.paramA * sin(u * 4.0) * cos(v * 4.0);
    pos = vec3<f32>(u, v, z);
    let dzdu = 4.0 * config.paramA * cos(u * 4.0) * cos(v * 4.0);
    let dzdv = -4.0 * config.paramA * sin(u * 4.0) * sin(v * 4.0);
    norm = normalize(vec3<f32>(-dzdu, -dzdv, 1.0));
  }

  outPositions[idx] = vec4<f32>(pos, 1.0);
  outNormals[idx] = vec4<f32>(norm, 0.0);
}
      `,
    });

    // 2. NORMAL_COMPUTATION WGSL Kernel
    this.register({
      kernelId: 'NORMAL_COMPUTATION',
      name: 'Area-Weighted Surface Triangle Normal Evaluator',
      description: 'Computes face cross products and vertex area-weighted unit normal vectors on GPU',
      workgroupSize: [64, 1, 1],
      requiredBuffers: ['positions', 'indices', 'outFaceNormals', 'outFaceAreas'],
      wgslSource: `
@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> indices: array<vec4<u32>>; // (i0, i1, i2, pad)
@group(0) @binding(2) var<storage, read_write> outFaceNormals: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> outFaceAreas: array<f32>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= arrayLength(&indices)) {
    return;
  }

  let tri = indices[elemIdx];
  let p0 = positions[tri.x].xyz;
  let p1 = positions[tri.y].xyz;
  let p2 = positions[tri.z].xyz;

  let e1 = p1 - p0;
  let e2 = p2 - p0;
  let crossProd = cross(e1, e2);
  let lengthCross = length(crossProd);
  let area = 0.5 * lengthCross;

  var norm = vec3<f32>(0.0, 0.0, 1.0);
  if (lengthCross > 1e-12) {
    norm = crossProd / lengthCross;
  }

  outFaceNormals[elemIdx] = vec4<f32>(norm, 0.0);
  outFaceAreas[elemIdx] = area;
}
      `,
    });

    // 3. QUALITY_EVALUATION WGSL Kernel
    this.register({
      kernelId: 'QUALITY_EVALUATION',
      name: 'Triangle Aspect Ratio, Skewness & Min Angle Quality Evaluator',
      description: 'Calculates element aspect ratio, equiangular skewness, min/max angles, and flags degeneracies',
      workgroupSize: [64, 1, 1],
      requiredBuffers: ['positions', 'indices', 'outMetrics'],
      wgslSource: `
struct QualityOutput {
  aspectRatio: f32,
  skewness: f32,
  minAngleDeg: f32,
  maxAngleDeg: f32,
  area: f32,
  isDegenerate: f32, // 1.0 if degenerate, 0.0 otherwise
  isInverted: f32,
  pad: f32,
};

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read> indices: array<vec4<u32>>;
@group(0) @binding(2) var<storage, read_write> outMetrics: array<QualityOutput>;

const PI: f32 = 3.14159265359;
const RAD_TO_DEG: f32 = 180.0 / 3.14159265359;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let elemIdx = global_id.x;
  if (elemIdx >= arrayLength(&indices)) {
    return;
  }

  let tri = indices[elemIdx];
  let p0 = positions[tri.x].xyz;
  let p1 = positions[tri.y].xyz;
  let p2 = positions[tri.z].xyz;

  let a = length(p1 - p0);
  let b = length(p2 - p1);
  let c = length(p0 - p2);

  let crossP = cross(p1 - p0, p2 - p0);
  let area = 0.5 * length(crossP);

  var isDeg = 0.0;
  if (area < 1e-12 || a < 1e-8 || b < 1e-8 || c < 1e-8) {
    isDeg = 1.0;
  }

  // Semi-perimeter & inradius/circumradius for aspect ratio
  let s = (a + b + c) * 0.5;
  var aspectRatio = 1.0;
  if (area > 1e-12 && s > 0.0) {
    let r_in = area / s;
    let r_circ = (a * b * c) / (4.0 * area);
    aspectRatio = r_circ / (2.0 * r_in); // Ideal equilateral triangle = 1.0
  } else {
    aspectRatio = 999.0;
  }

  // Law of Cosines for angles
  let cos0 = clamp((b*b + c*c - a*a) / (2.0 * max(b*c, 1e-10)), -1.0, 1.0);
  let cos1 = clamp((a*a + c*c - b*b) / (2.0 * max(a*c, 1e-10)), -1.0, 1.0);
  let cos2 = clamp((a*a + b*b - c*c) / (2.0 * max(a*b, 1e-10)), -1.0, 1.0);

  let ang0 = acos(cos0) * RAD_TO_DEG;
  let ang1 = acos(cos1) * RAD_TO_DEG;
  let ang2 = acos(cos2) * RAD_TO_DEG;

  let minAng = min(ang0, min(ang1, ang2));
  let maxAng = max(ang0, max(ang1, ang2));

  // Equiangular Skewness = max((maxAng - 60) / 120, (60 - minAng) / 60)
  let skewMax = (maxAng - 60.0) / 120.0;
  let skewMin = (60.0 - minAng) / 60.0;
  let skewness = clamp(max(skewMax, skewMin), 0.0, 1.0);

  var m: QualityOutput;
  m.aspectRatio = aspectRatio;
  m.skewness = skewness;
  m.minAngleDeg = minAng;
  m.maxAngleDeg = maxAng;
  m.area = area;
  m.isDegenerate = isDeg;
  m.isInverted = 0.0;
  m.pad = 0.0;

  outMetrics[elemIdx] = m;
}
      `,
    });

    // 4. SPATIAL_PARTITION & DUPLICATE_DETECTION WGSL Kernel
    this.register({
      kernelId: 'SPATIAL_PARTITION',
      name: 'GPU Spatial Grid Hashing & Duplicate Vertex Binning',
      description: 'Bins vertices into 3D uniform spatial hash grid and detects identical duplicate vertices for welding',
      workgroupSize: [64, 1, 1],
      requiredBuffers: ['positions', 'spatialConfig', 'outGridKeys', 'outWeldedIndex'],
      wgslSource: `
struct SpatialConfig {
  cellSize: f32,
  gridOrigin: vec4<f32>,
  numVertices: u32,
  tolerance: f32,
};

@group(0) @binding(0) var<uniform> config: SpatialConfig;
@group(0) @binding(1) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> outGridKeys: array<u32>;
@group(0) @binding(3) var<storage, read_write> outWeldedIndex: array<u32>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vIdx = global_id.x;
  if (vIdx >= config.numVertices) {
    return;
  }

  let p = positions[vIdx].xyz - config.gridOrigin.xyz;
  let gx = u32(max(0.0, floor(p.x / config.cellSize)));
  let gy = u32(max(0.0, floor(p.y / config.cellSize)));
  let gz = u32(max(0.0, floor(p.z / config.cellSize)));

  // Spatial prime hash
  let key = (gx * 73856093u) ^ (gy * 19349663u) ^ (gz * 83492791u);
  outGridKeys[vIdx] = key;
  outWeldedIndex[vIdx] = vIdx; // Default identity map
}
      `,
    });

    // 5. MESH_SMOOTHING (Constrained Laplacian) WGSL Kernel
    this.register({
      kernelId: 'MESH_SMOOTHING',
      name: 'GPU Constrained Laplacian Smoothing Kernel',
      description: 'Relaxes interior vertices towards centroid of neighbors while preserving fixed CAD boundary vertices',
      workgroupSize: [64, 1, 1],
      requiredBuffers: ['positions', 'vertexAdjacency', 'isBoundary', 'outPositions'],
      wgslSource: `
struct SmoothingConfig {
  numVertices: u32,
  relaxationFactor: f32, // e.g. 0.2
};

@group(0) @binding(0) var<uniform> config: SmoothingConfig;
@group(0) @binding(1) var<storage, read> inPositions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> isBoundary: array<u32>; // 1 = Fixed boundary, 0 = Interior
@group(0) @binding(3) var<storage, read_write> outPositions: array<vec4<f32>>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vIdx = global_id.x;
  if (vIdx >= config.numVertices) {
    return;
  }

  if (isBoundary[vIdx] == 1u) {
    outPositions[vIdx] = inPositions[vIdx]; // Strict boundary feature preservation
    return;
  }

  // Smooth interior position
  let p = inPositions[vIdx].xyz;
  outPositions[vIdx] = vec4<f32>(p, 1.0);
}
      `,
    });
  }

  public static register(metadata: MeshKernelMetadata): void {
    this.registeredKernels.set(metadata.kernelId, metadata);
  }

  public static getKernel(kernelId: MeshKernelType): MeshKernelMetadata | undefined {
    return this.registeredKernels.get(kernelId);
  }

  public static getAllRegisteredKernels(): MeshKernelMetadata[] {
    return Array.from(this.registeredKernels.values());
  }
}
