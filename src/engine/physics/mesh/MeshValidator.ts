/**
 * SECP Industrial OS v2 — Mesh Validator
 * PATCH-047: Mesh Abstraction
 */

import { 
  MeshSet, 
  MeshNode, 
  MeshElement, 
  MeshRegion, 
  MeshTopologySummary, 
  MeshQualityReport,
  MeshElementType
} from './MeshTypes';
import { MeshQualityEngine } from './MeshQualityEngine';
import * as crypto from 'crypto';

export type MeshValidationStatus = 
  | 'VALID' 
  | 'INVALID' 
  | 'MISSING_DATA' 
  | 'TOPOLOGY_ERROR' 
  | 'GEOMETRY_DEGENERATE' 
  | 'DIMENSION_MISMATCH'
  | 'UNPROVEN';

export interface MeshValidationResult {
  valid: boolean;
  status: MeshValidationStatus;
  errors: string[];
  warnings: string[];
  topologySummary?: MeshTopologySummary;
  quality?: MeshQualityReport;
}

export class MeshValidator {

  private static readonly EXPECTED_NODE_COUNT: Record<MeshElementType, number> = {
    'LINE': 2,
    'TRIANGLE': 3,
    'QUADRILATERAL': 4,
    'TETRAHEDRON': 4,
    'HEXAHEDRON': 8,
    'PRISM': 6,
    'PYRAMID': 5
  };

  private static readonly EXPECTED_DIMENSION: Record<MeshElementType, number> = {
    'LINE': 1,
    'TRIANGLE': 2,
    'QUADRILATERAL': 2,
    'TETRAHEDRON': 3,
    'HEXAHEDRON': 3,
    'PRISM': 3,
    'PYRAMID': 3
  };

  public static validateMesh(mesh: MeshSet): MeshValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let status: MeshValidationStatus = 'VALID';

    // 1. Missing Data
    if (!mesh) {
      return { valid: false, status: 'MISSING_DATA', errors: ['MeshSet is null or undefined'], warnings };
    }
    if (!mesh.meshId || mesh.meshId.trim() === '') errors.push('Missing meshId');
    if (!mesh.modelId || mesh.modelId.trim() === '') errors.push('Missing modelId');
    if (!mesh.dimension) errors.push('Missing mesh dimension');
    if (!mesh.nodes || !Array.isArray(mesh.nodes)) errors.push('Missing nodes array');
    if (!mesh.elements || !Array.isArray(mesh.elements)) errors.push('Missing elements array');

    if (errors.length > 0) {
      return { valid: false, status: 'MISSING_DATA', errors, warnings };
    }

    // 2. Node Validation
    const nodeMap = new Map<string, MeshNode>();
    const nodeCoordSet = new Set<string>();

    for (const node of mesh.nodes) {
      if (!node.nodeId || node.nodeId.trim() === '') {
        errors.push('Found node with missing or empty nodeId');
        continue;
      }
      if (nodeMap.has(node.nodeId)) {
        errors.push(`Duplicate nodeId detected: ${node.nodeId}`);
      }
      nodeMap.set(node.nodeId, node);

      if (!node.coordinates || !Array.isArray(node.coordinates)) {
        errors.push(`Node ${node.nodeId} has invalid or missing coordinates`);
        continue;
      }

      for (let i = 0; i < node.coordinates.length; i++) {
        const c = node.coordinates[i];
        if (isNaN(c) || !isFinite(c)) {
          errors.push(`Node ${node.nodeId} coordinate at index ${i} is invalid (NaN or Infinity): ${c}`);
        }
      }

      // Check dimension alignment
      if (mesh.dimension === '1D' && node.coordinates.length < 1) {
        errors.push(`Node ${node.nodeId} coordinate count does not match 1D mesh`);
      } else if (mesh.dimension === '2D' && (node.coordinates.length < 2 || node.coordinates.length > 3)) {
        errors.push(`Node ${node.nodeId} coordinate count does not match 2D mesh`);
      } else if (mesh.dimension === '3D' && node.coordinates.length !== 3) {
        errors.push(`Node ${node.nodeId} coordinate count does not match 3D mesh (requires exactly 3)`);
      }

      // Coincident node check (heuristic tolerance: 1e-9)
      const coordKey = node.coordinates.map(n => n.toFixed(9)).join(':');
      if (nodeCoordSet.has(coordKey)) {
        warnings.push(`Possible coincident node at coordinate [${node.coordinates.join(', ')}]`);
      }
      nodeCoordSet.add(coordKey);
    }

    // 3. Element Validation
    const elementMap = new Map<string, MeshElement>();
    const elementSignatures = new Set<string>();
    const usedNodeIds = new Set<string>();

    for (const el of mesh.elements) {
      if (!el.elementId || el.elementId.trim() === '') {
        errors.push('Found element with missing or empty elementId');
        continue;
      }
      if (elementMap.has(el.elementId)) {
        errors.push(`Duplicate elementId detected: ${el.elementId}`);
      }
      elementMap.set(el.elementId, el);

      const expectedCount = this.EXPECTED_NODE_COUNT[el.type];
      if (expectedCount === undefined) {
        errors.push(`Element ${el.elementId} has unsupported or invalid elementType: ${el.type}`);
        continue;
      }

      if (!el.nodeIds || el.nodeIds.length !== expectedCount) {
        errors.push(`Element ${el.elementId} of type ${el.type} must have ${expectedCount} nodes, got ${el.nodeIds ? el.nodeIds.length : 0}`);
        continue;
      }

      // Check duplicate node references in element
      const uniqueElNodes = new Set(el.nodeIds);
      if (uniqueElNodes.size !== el.nodeIds.length) {
        errors.push(`Element ${el.elementId} contains duplicate node references: [${el.nodeIds.join(', ')}]`);
      }

      // Check node existence
      for (const nid of el.nodeIds) {
        if (!nodeMap.has(nid)) {
          errors.push(`Element ${el.elementId} references non-existent node: ${nid}`);
        } else {
          usedNodeIds.add(nid);
        }
      }

      // Duplicate element check (same set of nodes)
      const sortedNodeSig = [...el.nodeIds].sort().join(':');
      if (elementSignatures.has(sortedNodeSig)) {
        errors.push(`Duplicate element connectivity detected for element ${el.elementId}`);
      }
      elementSignatures.add(sortedNodeSig);
    }

    // 4. Topology Checks
    const orphanNodes = mesh.nodes.filter(n => !usedNodeIds.has(n.nodeId)).map(n => n.nodeId);
    if (orphanNodes.length > 0) {
      warnings.push(`Mesh contains ${orphanNodes.length} orphan nodes not connected to any element: [${orphanNodes.slice(0, 5).join(', ')}${orphanNodes.length > 5 ? '...' : ''}]`);
    }

    const nodeToElementMap: Record<string, string[]> = {};
    for (const el of mesh.elements) {
      if (el.nodeIds) {
        for (const nid of el.nodeIds) {
          if (!nodeToElementMap[nid]) nodeToElementMap[nid] = [];
          nodeToElementMap[nid].push(el.elementId);
        }
      }
    }

    const topologySummary: MeshTopologySummary = {
      nodeCount: mesh.nodes.length,
      elementCount: mesh.elements.length,
      orphanNodeIds: orphanNodes,
      orphanElementIds: [],
      duplicateElementIds: [],
      nodeToElementMap,
      isManifold: 'UNPROVEN'
    };

    // 5. Region Validation
    if (mesh.regions && Array.isArray(mesh.regions)) {
      for (const reg of mesh.regions) {
        if (!reg.regionId) errors.push('Mesh region missing regionId');
        if (!reg.entityIds || reg.entityIds.length === 0) {
          warnings.push(`Mesh region ${reg.regionId} has no associated entity IDs`);
        } else {
          for (const entId of reg.entityIds) {
            if (!nodeMap.has(entId) && !elementMap.has(entId)) {
              errors.push(`Region ${reg.regionId} references non-existent node or element: ${entId}`);
            }
          }
        }
      }
    }

    // 6. Geometry & Quality Computation
    let qualityReport: MeshQualityReport | undefined;
    if (errors.length === 0 && mesh.elements.length > 0) {
      qualityReport = MeshQualityEngine.computeMeshQuality(mesh.nodes, mesh.elements);
      if (qualityReport.nonPositiveElements.length > 0) {
        errors.push(`Mesh contains ${qualityReport.nonPositiveElements.length} degenerate/inverted non-positive elements: [${qualityReport.nonPositiveElements.join(', ')}]`);
        status = 'GEOMETRY_DEGENERATE';
      }
    }

    if (errors.length > 0 && status === 'VALID') {
      status = 'INVALID';
    }

    return {
      valid: errors.length === 0,
      status,
      errors,
      warnings,
      topologySummary,
      quality: qualityReport
    };
  }

  public static calculateCanonicalHash(mesh: MeshSet): string {
    const canonicalObject = this.toCanonicalForm(mesh);
    const serialized = JSON.stringify(canonicalObject);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private static toCanonicalForm(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (isNaN(obj)) return '__NAN__';
        if (obj === Infinity) return '__INF__';
        if (obj === -Infinity) return '__NEG_INF__';
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      const sortedArray = [...obj].map(item => this.toCanonicalForm(item));
      if (sortedArray.length > 0 && typeof sortedArray[0] === 'object' && sortedArray[0] !== null) {
        const idField = ['nodeId', 'elementId', 'regionId', 'meshId'].find(f => sortedArray[0][f] !== undefined);
        if (idField) {
          sortedArray.sort((a, b) => String(a[idField]).localeCompare(String(b[idField])));
        }
      }
      return sortedArray;
    }

    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (key === 'metadata' || key === 'canonicalHash' || key === 'quality') continue;
      sortedObj[key] = this.toCanonicalForm(obj[key]);
    }
    return sortedObj;
  }
}
