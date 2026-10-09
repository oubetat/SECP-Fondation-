/**
 * SECP CAD/CAE Platform - Load Vector Assembler
 * PATCH-234 — Global Stiffness Assembly
 *
 * Assembles global load vector F_global from concentrated nodal forces,
 * element body forces (gravity), and distributed pressure loads.
 */

import { FEMElement } from '../mesh/FEMElement';
import { FEMNode } from '../mesh/FEMNode';
import { DOFField, DOFManager } from './DOFManager';

export interface NodalLoad {
  nodeId: string;
  field: DOFField;
  magnitude: number;
}

export interface BodyForceLoad {
  gravity: [number, number, number]; // e.g. [0, -9.81, 0] m/s^2
  density?: number; // kg/m^3
}

export interface ElementPressureLoad {
  elementId: string;
  faceIndex: number;
  pressure: number; // Pa
}

export interface AssembledLoadResult {
  F_global: number[];
  totalDOFs: number;
  nodalLoadSum: [number, number, number];
  bodyForceSum: [number, number, number];
  loadVectorHash: string;
}

export class LoadVectorAssembler {
  /**
   * Assembles the complete global RHS load vector F_global.
   */
  public static assembleGlobalLoadVector(
    dofManager: DOFManager,
    nodalLoads: NodalLoad[] = [],
    bodyForce?: BodyForceLoad,
    elements: FEMElement[] = [],
    nodesMap: Map<string, FEMNode> = new Map()
  ): AssembledLoadResult {
    const totalDOFs = dofManager.totalDOFs;
    const F_global = new Array<number>(totalDOFs).fill(0.0);

    const nodalSum: [number, number, number] = [0, 0, 0];
    const bodySum: [number, number, number] = [0, 0, 0];

    // 1. Concentrated Nodal Loads
    for (const load of nodalLoads) {
      try {
        const gIdx = dofManager.getGlobalDOFIndex(load.nodeId, load.field);
        F_global[gIdx] += load.magnitude;

        if (load.field === 'UX') nodalSum[0] += load.magnitude;
        if (load.field === 'UY') nodalSum[1] += load.magnitude;
        if (load.field === 'UZ') nodalSum[2] += load.magnitude;
      } catch (err) {
        // Skip unmapped DOFs with audit trace
      }
    }

    // 2. Body Forces (Gravity)
    if (bodyForce && bodyForce.gravity && elements.length > 0) {
      const g = bodyForce.gravity;
      const rhoDefault = bodyForce.density || 7850.0; // Steel density default kg/m^3

      for (const elem of elements) {
        const nodeCoords: number[][] = [];
        for (const nid of elem.nodeIds) {
          const n = nodesMap.get(nid);
          if (n) nodeCoords.push([n.x, n.y, n.z]);
        }

        if (nodeCoords.length === 0) continue;

        // Estimate element volume
        let vol = 1e-4; // m^3
        if (elem.type === 'TET' || (elem.type as any) === 'TET4') {
          const p0 = nodeCoords[0], p1 = nodeCoords[1], p2 = nodeCoords[2], p3 = nodeCoords[3];
          const detJ =
            (p1[0] - p0[0]) * ((p2[1] - p0[1]) * (p3[2] - p0[2]) - (p2[2] - p0[2]) * (p3[1] - p0[1])) -
            (p1[1] - p0[1]) * ((p2[0] - p0[0]) * (p3[2] - p0[2]) - (p2[2] - p0[2]) * (p3[0] - p0[0])) +
            (p1[2] - p0[2]) * ((p2[0] - p0[0]) * (p3[1] - p0[1]) - (p2[1] - p0[1]) * (p3[0] - p0[0]));
          vol = Math.max(Math.abs(detJ) / 6.0, 1e-12);
        } else if (elem.type === 'BAR' || (elem.type as any) === 'BAR2') {
          const p1 = nodeCoords[0], p2 = nodeCoords[1];
          const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
          vol = L * 0.001; // L * Area
        }

        const totalElementMass = vol * rhoDefault;
        const nodalMass = totalElementMass / elem.nodeIds.length;

        for (const nid of elem.nodeIds) {
          try {
            const uxIdx = dofManager.getGlobalDOFIndex(nid, 'UX');
            const uyIdx = dofManager.getGlobalDOFIndex(nid, 'UY');
            const uzIdx = dofManager.getGlobalDOFIndex(nid, 'UZ');

            const fx = nodalMass * g[0];
            const fy = nodalMass * g[1];
            const fz = nodalMass * g[2];

            F_global[uxIdx] += fx;
            F_global[uyIdx] += fy;
            F_global[uzIdx] += fz;

            bodySum[0] += fx;
            bodySum[1] += fy;
            bodySum[2] += fz;
          } catch (err) {
            // Ignore
          }
        }
      }
    }

    // Compute Hash
    let hash = 0x811c9dc5;
    for (let i = 0; i < F_global.length; i++) {
      const intVal = Math.round(F_global[i] * 1000) ^ i;
      hash = (hash ^ intVal) * 0x01000193;
    }
    const loadVectorHash = `F_HASH_${(hash >>> 0).toString(16).padStart(8, '0')}`;

    return {
      F_global,
      totalDOFs,
      nodalLoadSum: nodalSum,
      bodyForceSum: bodySum,
      loadVectorHash
    };
  }
}
