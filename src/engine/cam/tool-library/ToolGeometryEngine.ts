/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — Deterministic Tool Geometry Engine
 * 
 * Generates exact revolved silhouette coordinates r(z), parametric swept volume
 * representations, 3D boundary meshes, and deterministic geometry hashes (SHA-256).
 * Bridges seamlessly to Collision Engine (PATCH-259) and Stock Simulation (PATCH-260).
 */

import {
  ToolType,
  ToolDimensions,
  CornerGeometryType,
  ToolGeometryModel,
  CustomToolDefinition,
  Vector2D,
  Vector3D
} from './ToolTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export class ToolGeometryEngine {
  /**
   * Generates a complete, validated ToolGeometryModel from parametric dimensions
   */
  public static async createGeometryModel(
    type: ToolType,
    dimensions: ToolDimensions,
    cornerType?: CornerGeometryType,
    customProfile?: CustomToolDefinition
  ): Promise<ToolGeometryModel> {
    const inferredCornerType = cornerType || this.inferCornerType(type, dimensions);
    const silhouettePoints = this.calculateSilhouette(type, dimensions, inferredCornerType, customProfile);
    
    const boundingRadiusMm = Math.max(
      dimensions.cuttingDiameterMm / 2,
      dimensions.shankDiameterMm / 2,
      dimensions.shoulderDiameterMm ? dimensions.shoulderDiameterMm / 2 : 0
    );

    // Compute deterministic canonical hash over the geometry definition
    const canonicalPayload = {
      type,
      cornerType: inferredCornerType,
      cuttingDiameterMm: Number(dimensions.cuttingDiameterMm.toFixed(4)),
      shankDiameterMm: Number(dimensions.shankDiameterMm.toFixed(4)),
      overallLengthMm: Number(dimensions.overallLengthMm.toFixed(4)),
      cuttingLengthMm: Number(dimensions.cuttingLengthMm.toFixed(4)),
      shoulderLengthMm: Number(dimensions.shoulderLengthMm.toFixed(4)),
      cornerRadiusMm: dimensions.cornerRadiusMm ? Number(dimensions.cornerRadiusMm.toFixed(4)) : 0,
      tipAngleDeg: dimensions.tipAngleDeg ? Number(dimensions.tipAngleDeg.toFixed(2)) : 0,
      fluteCount: dimensions.fluteCount,
      helixAngleDeg: dimensions.helixAngleDeg || 0,
      taperAngleDeg: dimensions.taperAngleDeg || 0,
      customProfileHash: customProfile ? customProfile.revolvedProfile.map(p => `${p.radiusMm.toFixed(3)},${p.heightMm.toFixed(3)}`).join(';') : 'NONE'
    };

    const geometryHash = await generateDeterministicHash(canonicalPayload);

    // Calculate approximate mesh elements
    const cadMeshVertexCount = silhouettePoints.length * 24; // 24 radial segments
    const cadMeshTriangleCount = (silhouettePoints.length - 1) * 24 * 2;

    return {
      geometryHash,
      type,
      dimensions,
      cornerType: inferredCornerType,
      customProfile,
      boundingRadiusMm,
      totalLengthMm: dimensions.overallLengthMm,
      fluteLengthMm: dimensions.cuttingLengthMm,
      shankDiameterMm: dimensions.shankDiameterMm,
      silhouettePoints,
      cadMeshVertexCount,
      cadMeshTriangleCount
    };
  }

  /**
   * Infers corner geometry type based on tool category and dimensions
   */
  public static inferCornerType(type: ToolType, dimensions: ToolDimensions): CornerGeometryType {
    if (type === 'BALL_END_MILL') return 'FULL_BALL';
    if (type === 'BULL_NOSE' || (dimensions.cornerRadiusMm && dimensions.cornerRadiusMm > 0)) return 'RADIUS';
    if (type === 'DRILL') return 'CONICAL_POINT';
    if (type === 'CHAMFER_TOOL') return 'CHAMFER_CORNER';
    if (type === 'CUSTOM_TOOL') return 'CUSTOM_TIP';
    return 'SHARP';
  }

  /**
   * Generates exact 2D revolved silhouette coordinates [r(z), z] starting from Z=0 (tip) to Z=overallLength
   */
  public static calculateSilhouette(
    type: ToolType,
    dims: ToolDimensions,
    cornerType: CornerGeometryType,
    customProfile?: CustomToolDefinition
  ): Vector2D[] {
    const points: Vector2D[] = [];
    const rCutter = Math.max(0.01, dims.cuttingDiameterMm / 2);
    const rShank = Math.max(0.01, dims.shankDiameterMm / 2);
    const LCut = Math.min(dims.cuttingLengthMm, dims.overallLengthMm);
    const LOverall = dims.overallLengthMm;
    const LShoulder = Math.min(dims.shoulderLengthMm || LCut, LOverall);

    if (type === 'CUSTOM_TOOL' && customProfile && customProfile.revolvedProfile.length > 0) {
      // Revolve custom profile
      return customProfile.revolvedProfile.map(p => ({ x: p.radiusMm, y: p.heightMm }));
    }

    switch (type) {
      case 'BALL_END_MILL': {
        // Full ball tip from Z=0 to Z=rCutter
        const arcSteps = 12;
        for (let i = 0; i <= arcSteps; i++) {
          const theta = (Math.PI / 2) * (i / arcSteps); // 0 (tip) to pi/2 (equator)
          const z = rCutter - rCutter * Math.cos(theta);
          const r = rCutter * Math.sin(theta);
          points.push({ x: r, y: z });
        }
        // Cylindrical flute up to LCut
        if (LCut > rCutter) {
          points.push({ x: rCutter, y: LCut });
        }
        // Transition to shoulder/shank
        if (LShoulder > LCut && rShank !== rCutter) {
          points.push({ x: rCutter, y: LShoulder });
          points.push({ x: rShank, y: LShoulder });
        } else if (rShank !== rCutter) {
          points.push({ x: rShank, y: LCut });
        }
        // Shank to overall length
        points.push({ x: rShank, y: LOverall });
        break;
      }

      case 'BULL_NOSE': {
        const cr = Math.min(dims.cornerRadiusMm || 0.5, rCutter - 0.05);
        if (cr > 0) {
          // Flat bottom center
          points.push({ x: 0, y: 0 });
          points.push({ x: rCutter - cr, y: 0 });
          // Corner radius arc
          const arcSteps = 8;
          for (let i = 1; i <= arcSteps; i++) {
            const angle = (Math.PI / 2) * (i / arcSteps);
            const r = (rCutter - cr) + cr * Math.sin(angle);
            const z = cr - cr * Math.cos(angle);
            points.push({ x: r, y: z });
          }
        } else {
          points.push({ x: 0, y: 0 });
          points.push({ x: rCutter, y: 0 });
        }
        // Cylindrical flute
        points.push({ x: rCutter, y: LCut });
        if (LShoulder > LCut && rShank !== rCutter) {
          points.push({ x: rCutter, y: LShoulder });
          points.push({ x: rShank, y: LShoulder });
        } else if (rShank !== rCutter) {
          points.push({ x: rShank, y: LCut });
        }
        points.push({ x: rShank, y: LOverall });
        break;
      }

      case 'DRILL': {
        const tipAngle = dims.tipAngleDeg || 118;
        const halfAngleRad = ((180 - tipAngle) / 2) * (Math.PI / 180);
        const tipHeight = rCutter * Math.tan(halfAngleRad); // Height of conical point
        
        // Point apex
        points.push({ x: 0, y: 0 });
        // Cone edge
        points.push({ x: rCutter, y: tipHeight });
        // Flute
        points.push({ x: rCutter, y: LCut });
        // Shank
        if (rShank !== rCutter) {
          points.push({ x: rShank, y: LCut });
        }
        points.push({ x: rShank, y: LOverall });
        break;
      }

      case 'CHAMFER_TOOL': {
        const incAngle = dims.tipAngleDeg || 90;
        const halfAngleRad = (incAngle / 2) * (Math.PI / 180);
        const pilotD = dims.pilotDiameterMm || 0;
        const pilotR = pilotD / 2;
        const tipHeight = (rCutter - pilotR) / Math.tan(halfAngleRad);
        
        if (pilotR > 0) {
          points.push({ x: 0, y: 0 });
          points.push({ x: pilotR, y: 0 });
          const pilotL = dims.pilotLengthMm || 1.0;
          points.push({ x: pilotR, y: pilotL });
          points.push({ x: rCutter, y: pilotL + tipHeight });
        } else {
          points.push({ x: 0, y: 0 });
          points.push({ x: rCutter, y: tipHeight });
        }
        points.push({ x: rCutter, y: Math.max(LCut, tipHeight + 2) });
        if (rShank !== rCutter) {
          points.push({ x: rShank, y: Math.max(LCut, tipHeight + 2) });
        }
        points.push({ x: rShank, y: LOverall });
        break;
      }

      case 'FACE_MILL': {
        // Face mill with arbor recess and insert cutting zone
        points.push({ x: rCutter * 0.4, y: 0 }); // Center recess
        points.push({ x: rCutter, y: 0 });
        points.push({ x: rCutter, y: LCut });
        const arborR = rShank;
        points.push({ x: arborR, y: LCut });
        points.push({ x: arborR, y: LOverall });
        break;
      }

      case 'REAMER':
      case 'THREAD_MILL':
      case 'END_MILL':
      default: {
        // Flat standard end mill
        points.push({ x: 0, y: 0 });
        points.push({ x: rCutter, y: 0 });
        points.push({ x: rCutter, y: LCut });
        if (LShoulder > LCut && rShank !== rCutter) {
          points.push({ x: rCutter, y: LShoulder });
          points.push({ x: rShank, y: LShoulder });
        } else if (rShank !== rCutter) {
          points.push({ x: rShank, y: LCut });
        }
        points.push({ x: rShank, y: LOverall });
        break;
      }
    }

    return points;
  }

  /**
   * Generates 3D Triangulated Mesh representation for visual CAD canvas & collision
   */
  public static generateMeshTriangles(silhouette: Vector2D[], radialSegments: number = 24): { vertices: Float32Array; normals: Float32Array; indices: Uint32Array } {
    const numZ = silhouette.length;
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Build vertices by rotating silhouette around Z axis
    for (let i = 0; i < numZ; i++) {
      const { x: r, y: z } = silhouette[i];
      for (let j = 0; j < radialSegments; j++) {
        const phi = (2 * Math.PI * j) / radialSegments;
        const vx = r * Math.cos(phi);
        const vy = r * Math.sin(phi);
        const vz = z;

        vertices.push(vx, vy, vz);

        // Approximate outward normal
        if (r < 0.001) {
          normals.push(0, 0, z === 0 ? -1 : 1);
        } else {
          normals.push(Math.cos(phi), Math.sin(phi), 0);
        }
      }
    }

    // Build quad triangles between adjacent Z rings
    for (let i = 0; i < numZ - 1; i++) {
      const ring0 = i * radialSegments;
      const ring1 = (i + 1) * radialSegments;
      for (let j = 0; j < radialSegments; j++) {
        const nextJ = (j + 1) % radialSegments;
        const p0 = ring0 + j;
        const p1 = ring0 + nextJ;
        const p2 = ring1 + j;
        const p3 = ring1 + nextJ;

        // Triangle 1
        indices.push(p0, p1, p2);
        // Triangle 2
        indices.push(p1, p3, p2);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices)
    };
  }

  /**
   * Bridges to PATCH-260 (Stock Simulation ToolGeometry)
   */
  public static toStockSimulationTool(tool: { toolId: string; name: string; type: ToolType; geometry: ToolGeometryModel; dimensions: ToolDimensions }): any {
    let cutterType: string = 'FLAT_ENDMILL';
    if (tool.type === 'BALL_END_MILL') cutterType = 'BALL_ENDMILL';
    else if (tool.type === 'BULL_NOSE') cutterType = 'BULLNOSE';
    else if (tool.type === 'DRILL') cutterType = 'DRILL';
    else if (tool.type === 'REAMER') cutterType = 'REAMER';
    else if (tool.type === 'CHAMFER_TOOL') cutterType = 'CHAMFER';

    return {
      toolId: tool.toolId,
      name: tool.name,
      cutterType,
      diameterMm: tool.dimensions.cuttingDiameterMm,
      cornerRadMm: tool.dimensions.cornerRadiusMm || (tool.type === 'BALL_END_MILL' ? tool.dimensions.cuttingDiameterMm / 2 : 0),
      fluteLengthMm: tool.dimensions.cuttingLengthMm,
      overallLengthMm: tool.dimensions.overallLengthMm,
      shankDiameterMm: tool.dimensions.shankDiameterMm,
      tipAngleDeg: tool.dimensions.tipAngleDeg,
      fluteCount: tool.dimensions.fluteCount,
      sha256Hash: tool.geometry.geometryHash
    };
  }

  /**
   * Bridges to PATCH-259 (Collision Engine ToolGeometry & HolderGeometry)
   */
  public static toCollisionTool(tool: { toolId: string; name: string; type: ToolType; dimensions: ToolDimensions; geometry: ToolGeometryModel }, stickOutMm: number = 45): { toolGeom: any; defaultHolderGeom: any } {
    let collisionType: 'ENDMILL' | 'BALL_ENDMILL' | 'BULLNOSE_TOROIDAL' | 'DRILL' | 'CHAMFER' = 'ENDMILL';
    if (tool.type === 'BALL_END_MILL') collisionType = 'BALL_ENDMILL';
    else if (tool.type === 'BULL_NOSE') collisionType = 'BULLNOSE_TOROIDAL';
    else if (tool.type === 'DRILL') collisionType = 'DRILL';
    else if (tool.type === 'CHAMFER_TOOL') collisionType = 'CHAMFER';

    const toolGeom = {
      toolId: tool.toolId,
      toolType: collisionType,
      cutterDiameterMm: tool.dimensions.cuttingDiameterMm,
      cornerRadiusMm: tool.dimensions.cornerRadiusMm || 0,
      fluteLengthMm: tool.dimensions.cuttingLengthMm,
      shoulderLengthMm: tool.dimensions.shoulderLengthMm || tool.dimensions.cuttingLengthMm,
      shankDiameterMm: tool.dimensions.shankDiameterMm,
      totalLengthMm: tool.dimensions.overallLengthMm,
      stickoutMm: stickOutMm
    };

    const defaultHolderGeom = {
      holderId: `HOLDER_${tool.toolId}`,
      holderType: 'STEPPED' as const,
      gaugeLengthMm: 70,
      lowerDiameterMm: Math.max(tool.dimensions.shankDiameterMm * 2.2, 32),
      upperDiameterMm: 63,
      collarDiameterMm: 70,
      profileSteps: [
        { diameterMm: Math.max(tool.dimensions.shankDiameterMm * 2.2, 32), lengthMm: 30 },
        { diameterMm: 48, lengthMm: 25 },
        { diameterMm: 63, lengthMm: 15 }
      ]
    };

    return { toolGeom, defaultHolderGeom };
  }
}
