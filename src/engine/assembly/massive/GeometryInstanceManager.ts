/**
 * SECP Industrial OS v3 — PATCH-180: Geometry Instance Manager
 * Manages unique Component Definitions, shared mesh LODs (0 to 4), and proxy representations.
 * Ensures 1 Geometry Definition + N Transforms on GPU instead of N duplicates.
 */

import { Vector3D } from '../../cadKernel';
import { 
  ComponentDefinitionID, 
  ComponentDefinition, 
  ComponentMeshLODData, 
  LODLevel, 
  ProxyRepresentationType, 
  BoundingBox3D 
} from './MassiveAssemblyTypes';
import { AssemblyMath } from './AssemblyMath';

export class GeometryInstanceManager {
  private definitions: Map<ComponentDefinitionID, ComponentDefinition> = new Map();

  /**
   * Registers a standard or custom component definition in the repository
   */
  public registerDefinition(definition: ComponentDefinition): void {
    this.definitions.set(definition.definitionId, definition);
  }

  public getDefinition(definitionId: ComponentDefinitionID): ComponentDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  public hasDefinition(definitionId: ComponentDefinitionID): boolean {
    return this.definitions.has(definitionId);
  }

  public getAllDefinitions(): ComponentDefinition[] {
    return Array.from(this.definitions.values());
  }

  public getDefinitionsCount(): number {
    return this.definitions.size;
  }

  /**
   * Creates standard parameterized CAD component definitions (Fasteners, Turbines, Flanges, Structural Ribs, Motors)
   */
  public static createStandardDefinition(
    id: string,
    name: string,
    category: ComponentDefinition['category'],
    size: Vector3D,
    baseTriangles: number = 2400
  ): ComponentDefinition {
    const min: Vector3D = { x: -size.x * 0.5, y: -size.y * 0.5, z: -size.z * 0.5 };
    const max: Vector3D = { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 };
    const nominalBounds = AssemblyMath.createAABB(min, max);
    const nominalSphere = AssemblyMath.aabbToSphere(nominalBounds);

    // Multi-tier LOD mesh profiles
    const lods: Record<LODLevel, ComponentMeshLODData> = {
      LOD0_FULL: {
        lodLevel: 'LOD0_FULL',
        triangleCount: baseTriangles,
        vertexCount: Math.round(baseTriangles * 0.55),
        byteSize: baseTriangles * 48 // 48 bytes per triangle (positions, normals, uvs)
      },
      LOD1_REDUCED: {
        lodLevel: 'LOD1_REDUCED',
        triangleCount: Math.round(baseTriangles * 0.4),
        vertexCount: Math.round(baseTriangles * 0.25),
        byteSize: Math.round(baseTriangles * 0.4) * 48
      },
      LOD2_SIMPLIFIED: {
        lodLevel: 'LOD2_SIMPLIFIED',
        triangleCount: Math.round(baseTriangles * 0.12),
        vertexCount: Math.round(baseTriangles * 0.08),
        byteSize: Math.round(baseTriangles * 0.12) * 48
      },
      LOD3_PROXY: {
        lodLevel: 'LOD3_PROXY',
        triangleCount: 48, // Convex hull / cylindrical proxy
        vertexCount: 26,
        byteSize: 48 * 48
      },
      LOD4_BOUNDS: {
        lodLevel: 'LOD4_BOUNDS',
        triangleCount: 12, // Pure bounding cube
        vertexCount: 8,
        byteSize: 12 * 48
      }
    };

    return {
      definitionId: id,
      partNumber: `PN-${id.toUpperCase()}`,
      name,
      category,
      materialId: 'MAT_TI_6AL4V',
      massKg: Math.max(0.01, size.x * size.y * size.z * 0.0000045), // approx density
      nominalBounds,
      nominalSphere,
      lods,
      proxyType: 'PROXY',
      bRepFaceCount: Math.round(baseTriangles / 60) + 6,
      totalInstancesCount: 0,
      isStandardPart: category === 'FASTENER' || category === 'STANDARD_HARDWARE'
    };
  }

  /**
   * Computes total GPU memory that would be required if full duplicates were created vs shared instanced geometry
   */
  public computeMemorySavings(instancesByDef: Map<ComponentDefinitionID, number>): {
    instancedMemoryBytes: number;
    uninstancedRawMemoryBytes: number;
    savingsRatio: number;
  } {
    let instancedMemoryBytes = 0;
    let uninstancedRawMemoryBytes = 0;

    for (const [defId, count] of instancesByDef.entries()) {
      const def = this.definitions.get(defId);
      if (!def) continue;

      const baseGeometryBytes = def.lods.LOD0_FULL.byteSize;
      const instanceTransformBytes = count * 64; // 16 floats * 4 bytes
      
      instancedMemoryBytes += baseGeometryBytes + instanceTransformBytes;
      uninstancedRawMemoryBytes += baseGeometryBytes * count;
    }

    const savingsRatio = instancedMemoryBytes > 0 
      ? Number((uninstancedRawMemoryBytes / instancedMemoryBytes).toFixed(1)) 
      : 1.0;

    return {
      instancedMemoryBytes,
      uninstancedRawMemoryBytes,
      savingsRatio
    };
  }
}
