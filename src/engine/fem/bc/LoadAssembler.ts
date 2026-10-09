/**
 * SECP CAD/CAE Platform - Load Vector Assembler Engine
 * PATCH-235 — Boundary Condition Engine
 *
 * Integrates concentrated nodal forces, surface pressure numerical face integrals,
 * and gravity body forces (using material density rho from PATCH-233) into the
 * global load vector F_global.
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { FEMElement } from '../mesh/FEMElement';
import { DOFManager } from '../assembly/DOFManager';
import {
  BoundaryConditionDefinition,
  BCDiagnosticIssue,
  Vector3D
} from './BoundaryConditionTypes';

export interface LoadAssemblyContribution {
  bcId: string;
  bcName: string;
  type: string;
  targetNodeCount: number;
  totalForceVector: Vector3D;
}

export interface LoadAssemblyResult {
  F_global: number[];
  contributions: LoadAssemblyContribution[];
  issues: BCDiagnosticIssue[];
}

export class LoadAssembler {
  /**
   * Assembles the global load vector F_global for a given mesh, DOFManager, and list of BC definitions.
   */
  public static assembleLoadVector(
    bcs: BoundaryConditionDefinition[],
    dofManager: DOFManager,
    mesh: FEMMesh,
    materialDensityMap?: Map<string, number> // materialId -> rho (kg/m^3)
  ): LoadAssemblyResult {
    const totalDOFs = dofManager.totalDOFs;
    const F_global = new Array<number>(totalDOFs).fill(0.0);
    const contributions: LoadAssemblyContribution[] = [];
    const issues: BCDiagnosticIssue[] = [];

    const nodeMap = new Map(mesh.nodes.map((n) => [n.id, n]));
    const elemMap = new Map(mesh.elements.map((e) => [e.id, e]));

    for (const bc of bcs) {
      if (!bc.enabled) continue;

      switch (bc.type) {
        case 'NODAL_FORCE': {
          if (!bc.forceValue || !bc.target.nodeIds) continue;
          const nodeIds = bc.target.nodeIds;
          if (nodeIds.length === 0) continue;

          let fx = bc.forceValue.fx ?? 0;
          let fy = bc.forceValue.fy ?? 0;
          let fz = bc.forceValue.fz ?? 0;

          if (bc.forceValue.magnitude > 0 && fx === 0 && fy === 0 && fz === 0) {
            fx = bc.forceValue.direction.x * bc.forceValue.magnitude;
            fy = bc.forceValue.direction.y * bc.forceValue.magnitude;
            fz = bc.forceValue.direction.z * bc.forceValue.magnitude;
          }

          const perNodeFx = fx / nodeIds.length;
          const perNodeFy = fy / nodeIds.length;
          const perNodeFz = fz / nodeIds.length;

          let appliedNodes = 0;
          for (const nid of nodeIds) {
            const dofX = dofManager.getGlobalDOFIndex(nid, 'UX');
            const dofY = dofManager.getGlobalDOFIndex(nid, 'UY');
            const dofZ = dofManager.getGlobalDOFIndex(nid, 'UZ');

            if (dofX !== undefined) { F_global[dofX] += perNodeFx; appliedNodes++; }
            if (dofY !== undefined) { F_global[dofY] += perNodeFy; }
            if (dofZ !== undefined) { F_global[dofZ] += perNodeFz; }
          }

          contributions.push({
            bcId: bc.id,
            bcName: bc.name,
            type: 'NODAL_FORCE',
            targetNodeCount: appliedNodes,
            totalForceVector: { x: fx, y: fy, z: fz }
          });
          break;
        }

        case 'PRESSURE':
        case 'DISTRIBUTED_LOAD': {
          if (!bc.pressureValue) continue;
          const pressurePa = bc.pressureValue.magnitude;
          if (Math.abs(pressurePa) < 1e-12) continue;

          // Perform surface area integration over target elements/faces
          let totalPressureFx = 0;
          let totalPressureFy = 0;
          let totalPressureFz = 0;
          let affectedFaceCount = 0;

          // Process target element face keys or elements
          const targetElements = bc.target.elementIds || [];
          const targetNodes = bc.target.nodeIds || [];

          if (targetElements.length > 0) {
            for (const eid of targetElements) {
              const elem = elemMap.get(eid);
              if (!elem) continue;

              // Surface element (TRI/QUAD) or 3D element face
              const faceAreaAndNormal = LoadAssembler.computeElementFaceNormalAndArea(elem, mesh);
              const { area, normal } = faceAreaAndNormal;

              // Pressure is inward normal force: F_surf = -p * Area * normal
              const F_surf_x = -pressurePa * area * normal.x;
              const F_surf_y = -pressurePa * area * normal.y;
              const F_surf_z = -pressurePa * area * normal.z;

              totalPressureFx += F_surf_x;
              totalPressureFy += F_surf_y;
              totalPressureFz += F_surf_z;
              affectedFaceCount++;

              const nodeCount = elem.nodeIds.length;
              for (const nid of elem.nodeIds) {
                const dofX = dofManager.getGlobalDOFIndex(nid, 'UX');
                const dofY = dofManager.getGlobalDOFIndex(nid, 'UY');
                const dofZ = dofManager.getGlobalDOFIndex(nid, 'UZ');

                if (dofX !== undefined) F_global[dofX] += F_surf_x / nodeCount;
                if (dofY !== undefined) F_global[dofY] += F_surf_y / nodeCount;
                if (dofZ !== undefined) F_global[dofZ] += F_surf_z / nodeCount;
              }
            }
          } else if (targetNodes.length > 0) {
            // Fallback: distribute total pressure * estimated area over target nodes
            const estimatedAreaPerNode = 1e-4; // 1 cm^2 default
            const perNodeForceMag = pressurePa * estimatedAreaPerNode;
            const norm = bc.pressureValue.direction || { x: 0, y: 0, z: -1 };

            for (const nid of targetNodes) {
              const dofX = dofManager.getGlobalDOFIndex(nid, 'UX');
              const dofY = dofManager.getGlobalDOFIndex(nid, 'UY');
              const dofZ = dofManager.getGlobalDOFIndex(nid, 'UZ');

              const fx = -perNodeForceMag * norm.x;
              const fy = -perNodeForceMag * norm.y;
              const fz = -perNodeForceMag * norm.z;

              totalPressureFx += fx;
              totalPressureFy += fy;
              totalPressureFz += fz;

              if (dofX !== undefined) F_global[dofX] += fx;
              if (dofY !== undefined) F_global[dofY] += fy;
              if (dofZ !== undefined) F_global[dofZ] += fz;
            }
            affectedFaceCount = targetNodes.length;
          }

          contributions.push({
            bcId: bc.id,
            bcName: bc.name,
            type: 'PRESSURE',
            targetNodeCount: affectedFaceCount,
            totalForceVector: { x: totalPressureFx, y: totalPressureFy, z: totalPressureFz }
          });
          break;
        }

        case 'GRAVITY_BODY_FORCE': {
          if (!bc.gravityValue) continue;
          const g = bc.gravityValue;
          let totalGravFx = 0;
          let totalGravFy = 0;
          let totalGravFz = 0;
          let elemCount = 0;

          const defaultRho = g.defaultDensity ?? 7850; // Steel density default (kg/m^3)

          for (const elem of mesh.elements) {
            const rho = materialDensityMap?.get(elem.materialId) ?? defaultRho;
            const vol = LoadAssembler.computeElementVolume(elem, mesh);
            const mass = rho * vol;

            const F_body_x = mass * g.gx;
            const F_body_y = mass * g.gy;
            const F_body_z = mass * g.gz;

            totalGravFx += F_body_x;
            totalGravFy += F_body_y;
            totalGravFz += F_body_z;
            elemCount++;

            const nNodes = elem.nodeIds.length;
            for (const nid of elem.nodeIds) {
              const dofX = dofManager.getGlobalDOFIndex(nid, 'UX');
              const dofY = dofManager.getGlobalDOFIndex(nid, 'UY');
              const dofZ = dofManager.getGlobalDOFIndex(nid, 'UZ');

              if (dofX !== undefined) F_global[dofX] += F_body_x / nNodes;
              if (dofY !== undefined) F_global[dofY] += F_body_y / nNodes;
              if (dofZ !== undefined) F_global[dofZ] += F_body_z / nNodes;
            }
          }

          contributions.push({
            bcId: bc.id,
            bcName: bc.name,
            type: 'GRAVITY_BODY_FORCE',
            targetNodeCount: elemCount,
            totalForceVector: { x: totalGravFx, y: totalGravFy, z: totalGravFz }
          });
          break;
        }

        case 'THERMAL_STUB': {
          issues.push({
            code: 'UNIMPLEMENTED_CAPABILITY',
            severity: 'INFO',
            bcId: bc.id,
            message: `Thermal BC '${bc.name}' marked as UNIMPLEMENTED in current structural solver.`
          });
          break;
        }
      }
    }

    return { F_global, contributions, issues };
  }

  /**
   * Calculates element surface area and outward normal vector.
   */
  private static computeElementFaceNormalAndArea(
    elem: FEMElement,
    mesh: FEMMesh
  ): { area: number; normal: Vector3D } {
    const nodeMap = new Map(mesh.nodes.map((n) => [n.id, n]));
    const nodes = elem.nodeIds.map((id) => nodeMap.get(id)).filter((n) => n !== undefined)!;

    if (nodes.length < 3) {
      return { area: 1.0, normal: { x: 0, y: 0, z: 1 } };
    }

    const n0 = nodes[0]!;
    const n1 = nodes[1]!;
    const n2 = nodes[2]!;

    const v1 = { x: n1.x - n0.x, y: n1.y - n0.y, z: n1.z - n0.z };
    const v2 = { x: n2.x - n0.x, y: n2.y - n0.y, z: n2.z - n0.z };

    const cross = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };

    const mag = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
    if (mag < 1e-12) {
      return { area: 1.0, normal: { x: 0, y: 0, z: 1 } };
    }

    const area = 0.5 * mag;
    const normal = { x: cross.x / mag, y: cross.y / mag, z: cross.z / mag };
    return { area, normal };
  }

  /**
   * Calculates element volume for 3D TET/HEX elements or area*thickness for 2D elements.
   */
  private static computeElementVolume(elem: FEMElement, mesh: FEMMesh): number {
    const nodeMap = new Map(mesh.nodes.map((n) => [n.id, n]));
    const nodes = elem.nodeIds.map((id) => nodeMap.get(id)).filter((n) => n !== undefined)!;

    if (elem.type === 'TET' && nodes.length >= 4) {
      const n0 = nodes[0]!, n1 = nodes[1]!, n2 = nodes[2]!, n3 = nodes[3]!;
      const v01 = [n1.x - n0.x, n1.y - n0.y, n1.z - n0.z];
      const v02 = [n2.x - n0.x, n2.y - n0.y, n2.z - n0.z];
      const v03 = [n3.x - n0.x, n3.y - n0.y, n3.z - n0.z];

      const det =
        v01[0] * (v02[1] * v03[2] - v02[2] * v03[1]) -
        v01[1] * (v02[0] * v03[2] - v02[2] * v03[0]) +
        v01[2] * (v02[0] * v03[1] - v02[1] * v03[0]);

      return Math.abs(det) / 6.0;
    }

    // Default element volume
    return 1e-6; // 1 cm^3 default
  }
}
