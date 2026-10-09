/**
 * SECP Industrial OS v2 — Boolean Adversarial Solid Factory
 * Deterministic B-Rep Solid Generator for Adversarial Testing
 */

import {
  Solid, Shell, Face, Loop, Edge, Vertex, OrientedEdge, OrientedFace, TopoShapeEnum, Orientation
} from '../../cad-kernel/topology/TopologyContracts';
import { Point, Surface, Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BoxFactory } from '../../cad-kernel/boolean/BoxFactory';

export class AdversarialSolidFactory {
  private static dummyCurve: Curve = {
    evaluate: (t: number) => ({ x: t, y: 0, z: 0 }),
    domain: () => ({ uMin: 0, uMax: 1 })
  };

  private static dummySurface: Surface = {
    evaluate: (u: number, v: number) => ({ x: u, y: v, z: 0 }),
    domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 })
  };

  /**
   * Deterministic Linear Congruential Generator for reproducible pseudo-random testing
   */
  public static createPRNG(seed: number) {
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;
    return () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    };
  }

  /**
   * Creates a standard axis-aligned box solid
   */
  public static createBox(
    id: string,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number
  ): Solid {
    return BoxFactory.createBox(id, minX, minY, minZ, maxX, maxY, maxZ);
  }

  /**
   * Creates a polyhedral (faceted) cylinder solid with planar boundary faces
   */
  public static createFacetedCylinder(
    id: string,
    centerX: number,
    centerY: number,
    baseZ: number,
    radius: number,
    height: number,
    segments: number = 16
  ): Solid {
    const createPt = (x: number, y: number, z: number): Point => ({ x, y, z });
    const topZ = baseZ + height;

    const bottomVerts: Vertex[] = [];
    const topVerts: Vertex[] = [];

    // Generate circle vertices
    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      bottomVerts.push({
        id: `${id}_v_bot_${i}`,
        shapeType: TopoShapeEnum.VERTEX,
        geometry: createPt(x, y, baseZ),
        tolerance: 1e-7
      });
      topVerts.push({
        id: `${id}_v_top_${i}`,
        shapeType: TopoShapeEnum.VERTEX,
        geometry: createPt(x, y, topZ),
        tolerance: 1e-7
      });
    }

    // Shared Edges arrays
    const botEdgesArray: Edge[] = [];
    const topEdgesArray: Edge[] = [];
    const verticalEdgesArray: Edge[] = [];

    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      botEdgesArray.push({
        id: `${id}_e_bot_${i}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: this.dummyCurve,
        startVertex: bottomVerts[i],
        endVertex: bottomVerts[next],
        tolerance: 1e-7
      });
      topEdgesArray.push({
        id: `${id}_e_top_${i}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: this.dummyCurve,
        startVertex: topVerts[i],
        endVertex: topVerts[next],
        tolerance: 1e-7
      });
      verticalEdgesArray.push({
        id: `${id}_e_vert_${i}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: this.dummyCurve,
        startVertex: bottomVerts[i],
        endVertex: topVerts[i],
        tolerance: 1e-7
      });
    }

    const orientedFaces: OrientedFace[] = [];

    // Bottom polygon face (clockwise when viewed from below -> outward normal -Z)
    const botOrientedEdges: OrientedEdge[] = [];
    for (let i = 0; i < segments; i++) {
      // Loop in reverse for outward normal -Z
      const idx = (segments - 1 - i);
      botOrientedEdges.push({ edge: botEdgesArray[idx], orientation: Orientation.REVERSED });
    }
    const bottomFace: Face = {
      id: `${id}_f_bottom`,
      shapeType: TopoShapeEnum.FACE,
      geometry: { type: 'PLANE', origin: { x: centerX, y: centerY, z: baseZ }, normal: { x: 0, y: 0, z: -1 } } as any,
      outerLoop: {
        id: `${id}_loop_bot`,
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: botOrientedEdges
      },
      innerLoops: []
    };
    orientedFaces.push({ face: bottomFace, orientation: Orientation.FORWARD });

    // Top polygon face (counter-clockwise when viewed from above -> outward normal +Z)
    const topOrientedEdges: OrientedEdge[] = [];
    for (let i = 0; i < segments; i++) {
      topOrientedEdges.push({ edge: topEdgesArray[i], orientation: Orientation.FORWARD });
    }
    const topFace: Face = {
      id: `${id}_f_top`,
      shapeType: TopoShapeEnum.FACE,
      geometry: { type: 'PLANE', origin: { x: centerX, y: centerY, z: topZ }, normal: { x: 0, y: 0, z: 1 } } as any,
      outerLoop: {
        id: `${id}_loop_top`,
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: topOrientedEdges
      },
      innerLoops: []
    };
    orientedFaces.push({ face: topFace, orientation: Orientation.FORWARD });

    // Side quad faces
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const e_bot = botEdgesArray[i];
      const e_right = verticalEdgesArray[next];
      const e_top = topEdgesArray[i];
      const e_left = verticalEdgesArray[i];

      const sideFace: Face = {
        id: `${id}_f_side_${i}`,
        shapeType: TopoShapeEnum.FACE,
        geometry: this.dummySurface,
        outerLoop: {
          id: `${id}_loop_side_${i}`,
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [
            { edge: e_bot, orientation: Orientation.FORWARD },
            { edge: e_right, orientation: Orientation.FORWARD },
            { edge: e_top, orientation: Orientation.REVERSED },
            { edge: e_left, orientation: Orientation.REVERSED }
          ]
        },
        innerLoops: []
      };
      orientedFaces.push({ face: sideFace, orientation: Orientation.FORWARD });
    }

    const outerShell: Shell = {
      id: `${id}_shell`,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces
    };

    return {
      id,
      shapeType: TopoShapeEnum.SOLID,
      outerShell,
      innerShells: []
    };
  }

  /**
   * Creates a faceted/geodesic sphere solid
   */
  public static createFacetedSphere(
    id: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    latSegments: number = 8,
    lonSegments: number = 12
  ): Solid {
    const createPt = (x: number, y: number, z: number): Point => ({ x, y, z });

    // North & South Pole Vertices
    const vNorth: Vertex = {
      id: `${id}_v_north`,
      shapeType: TopoShapeEnum.VERTEX,
      geometry: createPt(centerX, centerY, centerZ + radius),
      tolerance: 1e-7
    };
    const vSouth: Vertex = {
      id: `${id}_v_south`,
      shapeType: TopoShapeEnum.VERTEX,
      geometry: createPt(centerX, centerY, centerZ - radius),
      tolerance: 1e-7
    };

    // Intermediate ring vertices: latSegments - 1 rings
    const numRings = latSegments - 1;
    const grid: Vertex[][] = [];

    for (let r = 0; r < numRings; r++) {
      const theta = (Math.PI * (r + 1)) / latSegments;
      const ring: Vertex[] = [];
      for (let c = 0; c < lonSegments; c++) {
        const phi = (2 * Math.PI * c) / lonSegments;
        const x = centerX + radius * Math.sin(theta) * Math.cos(phi);
        const y = centerY + radius * Math.sin(theta) * Math.sin(phi);
        const z = centerZ + radius * Math.cos(theta);

        ring.push({
          id: `${id}_v_${r}_${c}`,
          shapeType: TopoShapeEnum.VERTEX,
          geometry: createPt(x, y, z),
          tolerance: 1e-7
        });
      }
      grid.push(ring);
    }

    // Shared Edges
    const hEdges: Edge[][] = []; // [ring][c]
    for (let r = 0; r < numRings; r++) {
      const ringEdges: Edge[] = [];
      for (let c = 0; c < lonSegments; c++) {
        const nextC = (c + 1) % lonSegments;
        ringEdges.push({
          id: `${id}_e_h_${r}_${c}`,
          shapeType: TopoShapeEnum.EDGE,
          geometry: this.dummyCurve,
          startVertex: grid[r][c],
          endVertex: grid[r][nextC],
          tolerance: 1e-7
        });
      }
      hEdges.push(ringEdges);
    }

    const vTopEdges: Edge[] = []; // north to ring 0
    for (let c = 0; c < lonSegments; c++) {
      vTopEdges.push({
        id: `${id}_e_top_${c}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: this.dummyCurve,
        startVertex: vNorth,
        endVertex: grid[0][c],
        tolerance: 1e-7
      });
    }

    const vMidEdges: Edge[][] = []; // [r][c] between ring r and r+1
    for (let r = 0; r < numRings - 1; r++) {
      const mEdges: Edge[] = [];
      for (let c = 0; c < lonSegments; c++) {
        mEdges.push({
          id: `${id}_e_mid_${r}_${c}`,
          shapeType: TopoShapeEnum.EDGE,
          geometry: this.dummyCurve,
          startVertex: grid[r][c],
          endVertex: grid[r + 1][c],
          tolerance: 1e-7
        });
      }
      vMidEdges.push(mEdges);
    }

    const vBotEdges: Edge[] = []; // ring (numRings-1) to south
    for (let c = 0; c < lonSegments; c++) {
      vBotEdges.push({
        id: `${id}_e_bot_${c}`,
        shapeType: TopoShapeEnum.EDGE,
        geometry: this.dummyCurve,
        startVertex: grid[numRings - 1][c],
        endVertex: vSouth,
        tolerance: 1e-7
      });
    }

    const orientedFaces: OrientedFace[] = [];

    // 1. Top Cap Triangles (North Pole)
    for (let c = 0; c < lonSegments; c++) {
      const nextC = (c + 1) % lonSegments;
      const triFace: Face = {
        id: `${id}_f_top_${c}`,
        shapeType: TopoShapeEnum.FACE,
        geometry: this.dummySurface,
        outerLoop: {
          id: `${id}_loop_top_${c}`,
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [
            { edge: vTopEdges[c], orientation: Orientation.FORWARD },
            { edge: hEdges[0][c], orientation: Orientation.FORWARD },
            { edge: vTopEdges[nextC], orientation: Orientation.REVERSED }
          ]
        },
        innerLoops: []
      };
      orientedFaces.push({ face: triFace, orientation: Orientation.REVERSED });
    }

    // 2. Intermediate Quads
    for (let r = 0; r < numRings - 1; r++) {
      for (let c = 0; c < lonSegments; c++) {
        const nextC = (c + 1) % lonSegments;
        const quadFace: Face = {
          id: `${id}_f_mid_${r}_${c}`,
          shapeType: TopoShapeEnum.FACE,
          geometry: this.dummySurface,
          outerLoop: {
            id: `${id}_loop_mid_${r}_${c}`,
            shapeType: TopoShapeEnum.LOOP,
            orientedEdges: [
              { edge: hEdges[r][c], orientation: Orientation.FORWARD },
              { edge: vMidEdges[r][nextC], orientation: Orientation.FORWARD },
              { edge: hEdges[r + 1][c], orientation: Orientation.REVERSED },
              { edge: vMidEdges[r][c], orientation: Orientation.REVERSED }
            ]
          },
          innerLoops: []
        };
        orientedFaces.push({ face: quadFace, orientation: Orientation.REVERSED });
      }
    }

    // 3. Bottom Cap Triangles (South Pole)
    for (let c = 0; c < lonSegments; c++) {
      const nextC = (c + 1) % lonSegments;
      const triFace: Face = {
        id: `${id}_f_bot_${c}`,
        shapeType: TopoShapeEnum.FACE,
        geometry: this.dummySurface,
        outerLoop: {
          id: `${id}_loop_bot_${c}`,
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [
            { edge: hEdges[numRings - 1][c], orientation: Orientation.FORWARD },
            { edge: vBotEdges[nextC], orientation: Orientation.FORWARD },
            { edge: vBotEdges[c], orientation: Orientation.REVERSED }
          ]
        },
        innerLoops: []
      };
      orientedFaces.push({ face: triFace, orientation: Orientation.REVERSED });
    }

    const outerShell: Shell = {
      id: `${id}_shell`,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces
    };

    return {
      id,
      shapeType: TopoShapeEnum.SOLID,
      outerShell,
      innerShells: []
    };
  }

  /**
   * Creates a solid with an internal cavity (inner shell)
   */
  public static createNestedSolidWithCavity(
    id: string,
    outerMin: number,
    outerMax: number,
    innerMin: number,
    innerMax: number
  ): Solid {
    const outerBox = BoxFactory.createBox(`${id}_outer`, outerMin, outerMin, outerMin, outerMax, outerMax, outerMax);
    const innerBox = BoxFactory.createBox(`${id}_inner`, innerMin, innerMin, innerMin, innerMax, innerMax, innerMax);

    // Reverse orientation of inner shell faces for cavity representation
    const cavityFaces = innerBox.outerShell.orientedFaces.map(of => ({
      face: of.face,
      orientation: of.orientation === Orientation.FORWARD ? Orientation.REVERSED : Orientation.FORWARD
    }));

    const cavityShell: Shell = {
      id: `${id}_cavity_shell`,
      shapeType: TopoShapeEnum.SHELL,
      orientedFaces: cavityFaces
    };

    return {
      id,
      shapeType: TopoShapeEnum.SOLID,
      outerShell: outerBox.outerShell,
      innerShells: [cavityShell]
    };
  }
}
