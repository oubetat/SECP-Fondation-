/**
 * SECP-102.4: Production Assembly Renderer & Hierarchical Scene Graph Engine
 * Implements GPU instancing, hierarchical matrix graph propagation,
 * deterministic tree traversal, multi-level bounding box aggregation,
 * and strict geometric integrity validation.
 */

import { VisualizationMesh } from './GpuGeometryPipeline';

export interface PartDefinition {
  partId: string;
  name: string;
  mesh: VisualizationMesh;
  materialColor: { r: number; g: number; b: number };
}

export interface PartInstance {
  instanceId: string;
  partId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
  scale: { x: number; y: number; z: number };
}

export interface CADAssembly {
  id: string;
  assemblyName: string;
  parts: Map<string, PartDefinition>;
  instances: PartInstance[];
}

export interface BoundingBox3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface AssemblyGraphNode {
  id: string;
  name: string;
  parentId: string | null;
  partId?: string;
  localTransform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number }; // Euler XYZ in radians
    scale: { x: number; y: number; z: number };
  };
  localMatrix: Float64Array; // 4x4 column-major
  worldMatrix: Float64Array; // 4x4 column-major
  localBoundingBox?: BoundingBox3D;
  worldBoundingBox?: BoundingBox3D;
  children: string[];
}

export interface RenderBatch {
  partId: string;
  partName: string;
  instanceCount: number;
  triangleCount: number;
  drawCallsUsingStandardRenderer: number;
  drawCallsUsingGpuInstancing: number;
  instancedBufferBytes: number;
}

export interface AssemblyBatchResult {
  batches: RenderBatch[];
  totalInstances: number;
  totalTriangles: number;
  nonInstancedDrawCalls: number;
  instancedDrawCalls: number;
  vramSavingsPercentage: number;
}

export class AssemblyRenderer {
  /**
   * Creates a 4x4 identity matrix (Float64Array, 16 elements column-major)
   */
  public static createIdentityMatrix(): Float64Array {
    const m = new Float64Array(16);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    return m;
  }

  /**
   * Multiplies two 4x4 column-major matrices: Out = A * B
   */
  public static multiplyMatrices(a: Float64Array, b: Float64Array): Float64Array {
    const out = new Float64Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
    return out;
  }

  /**
   * Composes a 4x4 transform matrix from Translation * Rotation(XYZ) * Scale
   */
  public static composeTransformMatrix(
    pos: { x: number; y: number; z: number },
    rot: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number }
  ): Float64Array {
    if (
      !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z) ||
      !Number.isFinite(rot.x) || !Number.isFinite(rot.y) || !Number.isFinite(rot.z) ||
      !Number.isFinite(scale.x) || !Number.isFinite(scale.y) || !Number.isFinite(scale.z)
    ) {
      throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Non-finite transform parameter.');
    }

    const cx = Math.cos(rot.x);
    const sx = Math.sin(rot.x);
    const cy = Math.cos(rot.y);
    const sy = Math.sin(rot.y);
    const cz = Math.cos(rot.z);
    const sz = Math.sin(rot.z);

    const m = new Float64Array(16);

    // Column 0
    m[0] = (cy * cz) * scale.x;
    m[1] = (sx * sy * cz + cx * sz) * scale.x;
    m[2] = (-cx * sy * cz + sx * sz) * scale.x;
    m[3] = 0;

    // Column 1
    m[4] = (-cy * sz) * scale.y;
    m[5] = (-sx * sy * sz + cx * cz) * scale.y;
    m[6] = (cx * sy * sz + sx * cz) * scale.y;
    m[7] = 0;

    // Column 2
    m[8] = sy * scale.z;
    m[9] = (-sx * cy) * scale.z;
    m[10] = (cx * cy) * scale.z;
    m[11] = 0;

    // Column 3 (Translation)
    m[12] = pos.x;
    m[13] = pos.y;
    m[14] = pos.z;
    m[15] = 1;

    return m;
  }

  /**
   * Transforms a 3D point by a 4x4 matrix
   */
  public static transformPoint(m: Float64Array, p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
    const y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
    const z = m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14];
    const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];

    if (Math.abs(w - 1.0) > 1e-7 && Math.abs(w) > 1e-12) {
      return { x: x / w, y: y / w, z: z / w };
    }
    return { x, y, z };
  }

  /**
   * Computes the local bounding box of a mesh
   */
  public static computeMeshBoundingBox(mesh: VisualizationMesh): BoundingBox3D {
    if (!mesh || !mesh.vertices || mesh.vertices.length === 0) {
      throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Empty or invalid mesh vertices.');
    }
    if (mesh.vertices.length % 3 !== 0) {
      throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Vertices buffer not aligned to 3 coordinates.');
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Non-finite vertex coordinate.');
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Transforms an Axis-Aligned Bounding Box by a 4x4 matrix
   */
  public static transformBoundingBox(box: BoundingBox3D, matrix: Float64Array): BoundingBox3D {
    const corners = [
      { x: box.min.x, y: box.min.y, z: box.min.z },
      { x: box.max.x, y: box.min.y, z: box.min.z },
      { x: box.min.x, y: box.max.y, z: box.min.z },
      { x: box.max.x, y: box.max.y, z: box.min.z },
      { x: box.min.x, y: box.min.y, z: box.max.z },
      { x: box.max.x, y: box.min.y, z: box.max.z },
      { x: box.min.x, y: box.max.y, z: box.max.z },
      { x: box.max.x, y: box.max.y, z: box.max.z }
    ];

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const c of corners) {
      const tc = this.transformPoint(matrix, c);
      if (tc.x < minX) minX = tc.x;
      if (tc.y < minY) minY = tc.y;
      if (tc.z < minZ) minZ = tc.z;
      if (tc.x > maxX) maxX = tc.x;
      if (tc.y > maxY) maxY = tc.y;
      if (tc.z > maxZ) maxZ = tc.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Evaluates a multi-level scene graph with strict cycle detection and matrix propagation
   */
  public static evaluateAssemblyGraph(
    nodes: Map<string, AssemblyGraphNode>,
    parts: Map<string, PartDefinition>
  ): {
    rootId: string;
    evaluatedCount: number;
    assemblyBoundingBox: BoundingBox3D;
  } {
    // 1. Detect Root and build adjacency
    const roots: string[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [id, node] of nodes.entries()) {
      if (node.parentId === null) {
        roots.push(id);
      }
    }

    if (roots.length === 0) {
      throw new Error('RENDER_REJECTED_CYCLIC_HIERARCHY: Assembly scene graph has no root node.');
    }
    if (roots.length > 1) {
      throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Multiple root nodes detected.');
    }

    const rootId = roots[0];

    // 2. Cycle Detection DFS
    const checkCycles = (nodeId: string) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = nodes.get(nodeId);
      if (!node) {
        throw new Error(`RENDER_REJECTED_INVALID_GEOMETRY: Node reference '${nodeId}' not found.`);
      }

      for (const childId of node.children) {
        if (!visited.has(childId)) {
          checkCycles(childId);
        } else if (recursionStack.has(childId)) {
          throw new Error(`RENDER_REJECTED_CYCLIC_HIERARCHY: Cycle detected between '${nodeId}' and '${childId}'.`);
        }
      }

      recursionStack.delete(nodeId);
    };

    checkCycles(rootId);

    // 3. Matrix & Bounding Box Propagation (Top-Down DFS)
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    const propagate = (nodeId: string, parentWorldMatrix: Float64Array) => {
      const node = nodes.get(nodeId)!;

      // Local matrix calculation
      node.localMatrix = this.composeTransformMatrix(
        node.localTransform.position,
        node.localTransform.rotation,
        node.localTransform.scale
      );

      // World matrix = ParentWorld * Local
      node.worldMatrix = this.multiplyMatrices(parentWorldMatrix, node.localMatrix);

      // If this node represents a part mesh, compute its bounding boxes
      if (node.partId) {
        const part = parts.get(node.partId);
        if (!part) {
          throw new Error(`RENDER_REJECTED_INVALID_GEOMETRY: Part definition '${node.partId}' not found.`);
        }
        node.localBoundingBox = this.computeMeshBoundingBox(part.mesh);
        node.worldBoundingBox = this.transformBoundingBox(node.localBoundingBox, node.worldMatrix);

        if (node.worldBoundingBox.min.x < minX) minX = node.worldBoundingBox.min.x;
        if (node.worldBoundingBox.min.y < minY) minY = node.worldBoundingBox.min.y;
        if (node.worldBoundingBox.min.z < minZ) minZ = node.worldBoundingBox.min.z;
        if (node.worldBoundingBox.max.x > maxX) maxX = node.worldBoundingBox.max.x;
        if (node.worldBoundingBox.max.y > maxY) maxY = node.worldBoundingBox.max.y;
        if (node.worldBoundingBox.max.z > maxZ) maxZ = node.worldBoundingBox.max.z;
      }

      // Propagate to children in deterministic sorted order
      const sortedChildren = [...node.children].sort();
      for (const childId of sortedChildren) {
        propagate(childId, node.worldMatrix);
      }
    };

    propagate(rootId, this.createIdentityMatrix());

    const assemblyBoundingBox: BoundingBox3D = {
      min: { x: Number.isFinite(minX) ? minX : 0, y: Number.isFinite(minY) ? minY : 0, z: Number.isFinite(minZ) ? minZ : 0 },
      max: { x: Number.isFinite(maxX) ? maxX : 0, y: Number.isFinite(maxY) ? maxY : 0, z: Number.isFinite(maxZ) ? maxZ : 0 }
    };

    return {
      rootId,
      evaluatedCount: visited.size,
      assemblyBoundingBox
    };
  }

  /**
   * Compiles CAD repetition numbers into high-performance GPU batches
   */
  public static compileAssemblyBatches(assembly: CADAssembly): AssemblyBatchResult {
    if (!assembly || !assembly.parts || !assembly.instances) {
      throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Null assembly structure.');
    }

    const batches: RenderBatch[] = [];
    let totalInstances = 0;
    let totalTriangles = 0;

    const counts = new Map<string, number>();
    for (const inst of assembly.instances) {
      if (!inst.partId || !inst.instanceId) {
        throw new Error('RENDER_REJECTED_INVALID_GEOMETRY: Malformed part instance record.');
      }
      counts.set(inst.partId, (counts.get(inst.partId) || 0) + 1);
    }

    // Sort keys deterministically
    const sortedPartIds = Array.from(counts.keys()).sort();

    for (const partId of sortedPartIds) {
      const count = counts.get(partId)!;
      const part = assembly.parts.get(partId);
      if (!part) {
        throw new Error(`RENDER_REJECTED_INVALID_GEOMETRY: Referenced part '${partId}' is missing from assembly.`);
      }

      const singleTriangles = part.mesh.triangleCount;
      const batchTriangles = singleTriangles * count;
      totalInstances += count;
      totalTriangles += batchTriangles;

      // Each instance requires a 4x4 matrix (16 floats * 4 bytes = 64 bytes)
      const instancedBufferBytes = count * 64;

      batches.push({
        partId,
        partName: part.name,
        instanceCount: count,
        triangleCount: batchTriangles,
        drawCallsUsingStandardRenderer: count,
        drawCallsUsingGpuInstancing: 1,
        instancedBufferBytes
      });
    }

    const nonInstancedDrawCalls = totalInstances;
    const instancedDrawCalls = batches.length;
    const vramSavingsPercentage = nonInstancedDrawCalls > 0
      ? Number((((nonInstancedDrawCalls - instancedDrawCalls) / nonInstancedDrawCalls) * 100).toFixed(2))
      : 0;

    return {
      batches,
      totalInstances,
      totalTriangles,
      nonInstancedDrawCalls,
      instancedDrawCalls,
      vramSavingsPercentage
    };
  }

  /**
   * Deterministic generation of a massive industrial assembly
   * (Quantities: 100, 500, 2000, 10000) using strict mathematical geometric arrangements.
   */
  public static generateIndustrialAssembly(): CADAssembly {
    const parts = new Map<string, PartDefinition>();

    // Standard CAD Geometry definitions
    const cylinderMesh: VisualizationMesh = {
      id: 'vis-part-a',
      vertices: new Float32Array(36 * 3),
      normals: new Float32Array(36 * 3),
      indices: new Uint32Array(34 * 3),
      triangleCount: 34,
      memoryBytes: 3000
    };

    const boltMesh: VisualizationMesh = {
      id: 'vis-part-b',
      vertices: new Float32Array(72 * 3),
      normals: new Float32Array(72 * 3),
      indices: new Uint32Array(68 * 3),
      triangleCount: 68,
      memoryBytes: 6000
    };

    const rivetMesh: VisualizationMesh = {
      id: 'vis-part-c',
      vertices: new Float32Array(16 * 3),
      normals: new Float32Array(16 * 3),
      indices: new Uint32Array(12 * 3),
      triangleCount: 12,
      memoryBytes: 1100
    };

    const washerMesh: VisualizationMesh = {
      id: 'vis-part-d',
      vertices: new Float32Array(24 * 3),
      normals: new Float32Array(24 * 3),
      indices: new Uint32Array(20 * 3),
      triangleCount: 20,
      memoryBytes: 1800
    };

    // Populate valid geometry vertices to ensure bounding box calculations succeed
    for (let i = 0; i < cylinderMesh.vertices.length; i += 3) {
      cylinderMesh.vertices[i] = Math.cos(i) * 10;
      cylinderMesh.vertices[i + 1] = Math.sin(i) * 10;
      cylinderMesh.vertices[i + 2] = (i / 3) * 0.5;
    }
    for (let i = 0; i < boltMesh.vertices.length; i += 3) {
      boltMesh.vertices[i] = Math.cos(i) * 5;
      boltMesh.vertices[i + 1] = Math.sin(i) * 5;
      boltMesh.vertices[i + 2] = (i / 3) * 0.2;
    }
    for (let i = 0; i < rivetMesh.vertices.length; i += 3) {
      rivetMesh.vertices[i] = Math.cos(i) * 3;
      rivetMesh.vertices[i + 1] = Math.sin(i) * 3;
      rivetMesh.vertices[i + 2] = (i / 3) * 0.1;
    }
    for (let i = 0; i < washerMesh.vertices.length; i += 3) {
      washerMesh.vertices[i] = Math.cos(i) * 4;
      washerMesh.vertices[i + 1] = Math.sin(i) * 4;
      washerMesh.vertices[i + 2] = (i / 3) * 0.1;
    }

    parts.set('part-a', {
      partId: 'part-a',
      name: 'Flange Joint Connector A',
      mesh: cylinderMesh,
      materialColor: { r: 0.38, g: 0.40, b: 0.94 }
    });

    parts.set('part-b', {
      partId: 'part-b',
      name: 'High-Tensile Steel Hex Bolt B',
      mesh: boltMesh,
      materialColor: { r: 0.94, g: 0.38, b: 0.40 }
    });

    parts.set('part-c', {
      partId: 'part-c',
      name: 'Threaded Anchor Rivet C',
      mesh: rivetMesh,
      materialColor: { r: 0.38, g: 0.94, b: 0.40 }
    });

    parts.set('part-d', {
      partId: 'part-d',
      name: 'Anti-Vibration Sealing Washer D',
      mesh: washerMesh,
      materialColor: { r: 0.94, g: 0.94, b: 0.38 }
    });

    const instances: PartInstance[] = [];

    // Part A: 100 instances on a cylindrical spiral
    for (let i = 0; i < 100; i++) {
      instances.push({
        instanceId: `inst-a-${i}`,
        partId: 'part-a',
        position: { x: Math.cos(i * 0.1) * 15, y: Math.sin(i * 0.1) * 15, z: i * 0.1 },
        rotation: { x: 0, y: 0, z: i * 0.05 },
        scale: { x: 1, y: 1, z: 1 }
      });
    }

    // Part B: 500 instances on concentric rings
    for (let i = 0; i < 500; i++) {
      const ring = Math.floor(i / 50);
      const angle = (i % 50) * (Math.PI * 2 / 50);
      const radius = 25 + ring * 2;
      instances.push({
        instanceId: `inst-b-${i}`,
        partId: 'part-b',
        position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: ring * 1.5 },
        rotation: { x: 0, y: 0, z: angle },
        scale: { x: 0.8, y: 0.8, z: 0.8 }
      });
    }

    // Part C: 2000 instances on a toroidal manifold lattice
    for (let i = 0; i < 2000; i++) {
      const u = (i * Math.PI * 2) / 200;
      const v = (i * Math.PI * 2) / 10;
      const rMajor = 35;
      const rMinor = 5;
      instances.push({
        instanceId: `inst-c-${i}`,
        partId: 'part-c',
        position: {
          x: (rMajor + rMinor * Math.cos(v)) * Math.cos(u),
          y: (rMajor + rMinor * Math.cos(v)) * Math.sin(u),
          z: rMinor * Math.sin(v)
        },
        rotation: { x: 0, y: u, z: v },
        scale: { x: 0.5, y: 0.5, z: 0.5 }
      });
    }

    // Part D: 10000 instances on a 3D Cartesian volumetric grid
    const dim = 22; // 22 x 22 x 21 ~ 10164, we take first 10000
    for (let i = 0; i < 10000; i++) {
      const gx = i % dim;
      const gy = Math.floor(i / dim) % dim;
      const gz = Math.floor(i / (dim * dim));
      instances.push({
        instanceId: `inst-d-${i}`,
        partId: 'part-d',
        position: { x: (gx - 11) * 4.5, y: (gy - 11) * 4.5, z: (gz - 10) * 4.5 },
        rotation: { x: (gx * 0.1) % Math.PI, y: (gy * 0.1) % Math.PI, z: (gz * 0.1) % Math.PI },
        scale: { x: 0.4, y: 0.4, z: 0.4 }
      });
    }

    return {
      id: 'assembly-industrial-boiler-031',
      assemblyName: 'Industrial Boiler Fluid-Manifold Assembly',
      parts,
      instances
    };
  }
}
