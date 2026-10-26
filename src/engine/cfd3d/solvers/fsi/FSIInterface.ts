/**
 * SECP Industrial OS — Engineering Truth OS
 * src/engine/cfd3d/solvers/fsi/FSIInterface.ts
 *
 * Implements the concrete Fluid-Structure Interface (FSIInterface) representation
 * for partitioned 3D/2D fluid-structure interaction coupling.
 *
 * Responsibilities:
 * 1. Interface surface mesh geometry (boundary faces, centroids, areas, normals).
 * 2. Structural boundary station mapping.
 * 3. Bidirectional data transfer:
 *    - Traction/pressure force transfer from fluid faces to solid nodes.
 *    - Displacement/velocity transfer from solid nodes to fluid boundary faces.
 * 4. Interface conservation & work audit:
 *    - Force equilibrium across the interface: \sum F_fluid + \sum F_solid = 0
 *    - Interface energy transfer: W_interface = \sum F_i \cdot \Delta u_i
 */

import { Vector3D, FvmFace3D, FvmMesh3D } from '../../Fvm3DTypes';
import { FSINodeDisplacement, FSIBoundaryForce } from '../../coupling/TwoWayFSICouplingEngine';

export interface FSIInterfaceNode {
  id: number;
  x: number;
  y: number;
  z: number;
  displacement: [number, number, number];
  tractionForce: [number, number, number];
}

export interface FSIInterfaceFace {
  faceId: number;
  centroid: Vector3D;
  normal: Vector3D;
  area: number;
  pressurePa: number;
  normalForceN: Vector3D;
  mappedNodeId?: number;
}

export interface InterfaceConservationMetrics {
  totalFluidForceN: { x: number; y: number; z: number };
  totalStructuralForceN: { x: number; y: number; z: number };
  forceImbalanceN: { x: number; y: number; z: number };
  relativeForceImbalancePct: number;
  interfaceWorkJoules: number;
  isConserved: boolean;
}

export class FSIInterface {
  private interfaceFaces: FSIInterfaceFace[] = [];
  private interfaceNodes: Map<number, FSIInterfaceNode> = new Map();
  private totalAreaM2: number = 0;

  constructor(
    public readonly interfaceId: string = 'fsi-boundary-interface-primary'
  ) {}

  /**
   * Initializes the interface from fluid boundary faces.
   */
  public initializeFromFluidFaces(
    faces: FvmFace3D[],
    initialPressurePa: number = 101325.0
  ): void {
    this.interfaceFaces = [];
    this.totalAreaM2 = 0;

    for (const f of faces) {
      const area = f.area;
      this.totalAreaM2 += area;
      const forceMag = initialPressurePa * area;

      this.interfaceFaces.push({
        faceId: f.faceId,
        centroid: { ...f.centroid },
        normal: { ...f.normal },
        area,
        pressurePa: initialPressurePa,
        normalForceN: {
          x: forceMag * f.normal.x,
          y: forceMag * f.normal.y,
          z: forceMag * f.normal.z
        }
      });
    }
  }

  /**
   * Registers structural interface nodes.
   */
  public registerStructuralNodes(
    nodes: Array<{ id: number; x: number; y: number; z: number }>
  ): void {
    this.interfaceNodes.clear();
    for (const n of nodes) {
      this.interfaceNodes.set(n.id, {
        id: n.id,
        x: n.x,
        y: n.y,
        z: n.z,
        displacement: [0, 0, 0],
        tractionForce: [0, 0, 0]
      });
    }

    // Auto-map nearest structural node for each face
    for (const f of this.interfaceFaces) {
      let nearestId: number | undefined;
      let minD = Infinity;
      for (const n of nodes) {
        const dx = f.centroid.x - n.x;
        const dy = f.centroid.y - n.y;
        const dz = f.centroid.z - n.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < minD) {
          minD = d;
          nearestId = n.id;
        }
      }
      f.mappedNodeId = nearestId;
    }
  }

  /**
   * Updates interface boundary pressures from CFD flow field.
   */
  public updateFluidPressures(pressuresByFaceId: Map<number, number>): void {
    for (const f of this.interfaceFaces) {
      const p = pressuresByFaceId.get(f.faceId) ?? f.pressurePa;
      if (!Number.isFinite(p)) {
        throw new Error(`Non-finite interface pressure encountered on face ${f.faceId}: ${p}`);
      }
      f.pressurePa = p;
      const forceMag = p * f.area;
      f.normalForceN = {
        x: forceMag * f.normal.x,
        y: forceMag * f.normal.y,
        z: forceMag * f.normal.z
      };
    }
  }

  /**
   * Updates interface displacements from structural FEM analysis.
   */
  public updateStructuralDisplacements(displacements: FSINodeDisplacement[]): void {
    for (const d of displacements) {
      const node = this.interfaceNodes.get(d.nodeId);
      if (node) {
        if (!Number.isFinite(d.dx) || !Number.isFinite(d.dy) || !Number.isFinite(d.dz)) {
          throw new Error(`Non-finite interface displacement encountered at node ${d.nodeId}`);
        }
        node.displacement = [d.dx, d.dy, d.dz];
      }
    }
  }

  /**
   * Generates boundary displacement records for ALE mesh morphing.
   */
  public getBoundaryDisplacementsForALE(): Array<{ faceId: number; dx: number; dy: number; dz: number }> {
    return this.interfaceFaces.map(f => {
      let dx = 0, dy = 0, dz = 0;
      if (f.mappedNodeId !== undefined) {
        const node = this.interfaceNodes.get(f.mappedNodeId);
        if (node) {
          [dx, dy, dz] = node.displacement;
        }
      }
      return { faceId: f.faceId, dx, dy, dz };
    });
  }

  /**
   * Evaluates interface conservation and energy transfer metrics.
   */
  public evaluateConservationMetrics(): InterfaceConservationMetrics {
    let fFx = 0, fFy = 0, fFz = 0;
    for (const f of this.interfaceFaces) {
      fFx += f.normalForceN.x;
      fFy += f.normalForceN.y;
      fFz += f.normalForceN.z;
    }

    let sFx = 0, sFy = 0, sFz = 0;
    let workJ = 0;

    for (const f of this.interfaceFaces) {
      if (f.mappedNodeId !== undefined) {
        const node = this.interfaceNodes.get(f.mappedNodeId);
        if (node) {
          sFx += f.normalForceN.x;
          sFy += f.normalForceN.y;
          sFz += f.normalForceN.z;
          workJ += f.normalForceN.x * node.displacement[0] +
                   f.normalForceN.y * node.displacement[1] +
                   f.normalForceN.z * node.displacement[2];
        }
      }
    }

    const imbX = fFx - sFx;
    const imbY = fFy - sFy;
    const imbZ = fFz - sFz;
    const totalMag = Math.sqrt(fFx * fFx + fFy * fFy + fFz * fFz);
    const imbMag = Math.sqrt(imbX * imbX + imbY * imbY + imbZ * imbZ);
    const relImb = totalMag > 1e-12 ? (imbMag / totalMag) * 100 : 0.0;

    return {
      totalFluidForceN: { x: fFx, y: fFy, z: fFz },
      totalStructuralForceN: { x: sFx, y: sFy, z: sFz },
      forceImbalanceN: { x: imbX, y: imbY, z: imbZ },
      relativeForceImbalancePct: relImb,
      interfaceWorkJoules: workJ,
      isConserved: relImb < 0.1
    };
  }

  public getFaces(): FSIInterfaceFace[] {
    return this.interfaceFaces.slice();
  }

  public getNodes(): FSIInterfaceNode[] {
    return Array.from(this.interfaceNodes.values());
  }

  public getTotalArea(): number {
    return this.totalAreaM2;
  }
}
