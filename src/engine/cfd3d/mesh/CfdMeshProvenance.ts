/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-241 — General CFD Mesh Interface
 */

import { CfdMesh } from './CfdMesh';
import { CfdMeshMetrics } from './CfdMesh';
import { CfdConnectivity } from './CfdConnectivity';
import { CfdMeshQualityValidator } from './CfdMeshQuality';

/**
 * CfdMeshHasher: Generates a deterministic, canonical hash for mesh integrity.
 * - Sorts nodes canonically by ID.
 * - Encodes node coordinates with fixed precision (6 decimal places).
 * - Encodes cell topology and face connectivity canonically.
 * - Sensitive to coordinate perturbations.
 * - Invariant to node/face/cell insertion order.
 */
export class CfdMeshHasher {
  public static generateHash(mesh: CfdMesh): string {
    const nodeStrs: string[] = [];
    mesh.nodes.forEach(n => {
      nodeStrs.push(`${n.id}:${n.x.toFixed(6)},${n.y.toFixed(6)},${n.z.toFixed(6)}`);
    });
    nodeStrs.sort();

    const cellStrs: string[] = [];
    mesh.cells.forEach(c => {
      const sortedNodes = [...c.nodeIds].sort().join(',');
      cellStrs.push(`${c.id}:${c.type}:[${sortedNodes}]`);
    });
    cellStrs.sort();

    const faceStrs: string[] = [];
    mesh.faces.forEach(f => {
      const sortedNodes = [...f.nodeIds].sort().join(',');
      faceStrs.push(`${f.id}:[${sortedNodes}]:O=${f.ownerCellId}:N=${f.neighbourCellId ?? 'NONE'}:P=${f.boundaryPatchId ?? 'NONE'}`);
    });
    faceStrs.sort();

    const patchStrs: string[] = [];
    mesh.patches.forEach(p => {
      const sortedFaces = [...p.faceIds].sort().join(',');
      patchStrs.push(`${p.id}:${p.type}:[${sortedFaces}]`);
    });
    patchStrs.sort();

    const canonicalPayload = [
      `ID:${mesh.id}`,
      `N:${nodeStrs.join(';')}`,
      `C:${cellStrs.join(';')}`,
      `F:${faceStrs.join(';')}`,
      `P:${patchStrs.join(';')}`
    ].join('|');

    // Dual-prime 64-bit-like deterministic polynomial hash
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < canonicalPayload.length; i++) {
      const c = canonicalPayload.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    }

    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `CFD_MESH_HASH_${hex1}_${hex2}`;
  }
}

/**
 * CfdMeshProvenance: Tracks the source and history of the mesh.
 */
export interface CfdMeshProvenance {
  meshId: string;
  sourceCadHash: string;
  mesherVersion: string;
  hash: string;
  timestamp: string;
  valid: boolean;
}
