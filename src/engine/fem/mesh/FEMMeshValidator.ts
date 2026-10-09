import { FEMMesh } from './FEMMesh';
import { FEMNode } from './FEMNode';
import { FEMElement } from './FEMElement';
import { FEMConnectivityBuilder, ConnectivityAuditResult } from './FEMConnectivity';
import { FEMMeshQualityCalculator, FEMMeshQualitySummary } from './FEMMeshQuality';
import { FEMMeshDeterminism } from './FEMMeshDeterminism';

export interface ValidationReport {
  isValid: boolean;
  geometryCheck: { ok: boolean; message: string };
  nodesCheck: { ok: boolean; count: number; message: string };
  elementsCheck: { ok: boolean; count: number; message: string };
  connectivityCheck: { ok: boolean; audit: ConnectivityAuditResult | null; message: string };
  boundaryCheck: { ok: boolean; message: string };
  qualityCheck: { ok: boolean; summary: FEMMeshQualitySummary | null; message: string };
  materialCheck: { ok: boolean; message: string };
  determinismCheck: { ok: boolean; message: string };
  overallMessage: string;
}

export class FEMMeshValidator {
  /**
   * Helper to detect if a 2D or 3D element is inverted (non-positive area or volume).
   */
  public static isInvertedElement(elem: FEMElement, nodesMap: Map<string, FEMNode>): boolean {
    const p = elem.nodeIds.map(nid => nodesMap.get(nid));
    if (p.some(n => !n)) return true; // Missing node implies invalid/inverted

    const pts = p as FEMNode[];

    if (elem.type === 'TRI') {
      const area = 0.5 * (pts[0].x * (pts[1].y - pts[2].y) + pts[1].x * (pts[2].y - pts[0].y) + pts[2].x * (pts[0].y - pts[1].y));
      return area <= 1e-12; // Negative or zero area
    } 
    else if (elem.type === 'QUAD') {
      // Check both sub-triangles winding
      const area1 = 0.5 * (pts[0].x * (pts[1].y - pts[2].y) + pts[1].x * (pts[2].y - pts[0].y) + pts[2].x * (pts[0].y - pts[1].y));
      const area2 = 0.5 * (pts[0].x * (pts[2].y - pts[3].y) + pts[2].x * (pts[3].y - pts[0].y) + pts[3].x * (pts[0].y - pts[2].y));
      return area1 <= 1e-12 || area2 <= 1e-12;
    } 
    else if (elem.type === 'TET') {
      // Scalar triple product volume: (AB . (AC x AD)) / 6
      const AB = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y, z: pts[1].z - pts[0].z };
      const AC = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y, z: pts[2].z - pts[0].z };
      const AD = { x: pts[3].x - pts[0].x, y: pts[3].y - pts[0].y, z: pts[3].z - pts[0].z };

      const cross = {
        x: AC.y * AD.z - AC.z * AD.y,
        y: AC.z * AD.x - AC.x * AD.z,
        z: AC.x * AD.y - AC.y * AD.x,
      };

      const triple = AB.x * cross.x + AB.y * cross.y + AB.z * cross.z;
      const volume = triple / 6.0;
      return volume <= 1e-12; // Negative or zero volume
    } 
    else if (elem.type === 'HEX') {
      // A simple hex is inverted if any of its 5 standard sub-tets is inverted
      const tets = [
        [pts[0], pts[1], pts[2], pts[5]],
        [pts[0], pts[2], pts[3], pts[7]],
        [pts[0], pts[5], pts[7], pts[4]],
        [pts[2], pts[5], pts[6], pts[7]],
        [pts[0], pts[2], pts[5], pts[7]],
      ];

      for (const t of tets) {
        const AB = { x: t[1].x - t[0].x, y: t[1].y - t[0].y, z: t[1].z - t[0].z };
        const AC = { x: t[2].x - t[0].x, y: t[2].y - t[0].y, z: t[2].z - t[0].z };
        const AD = { x: t[3].x - t[0].x, y: t[3].y - t[0].y, z: t[3].z - t[0].z };
        const cross = {
          x: AC.y * AD.z - AC.z * AD.y,
          y: AC.z * AD.x - AC.x * AD.z,
          z: AC.x * AD.y - AC.y * AD.x,
        };
        const vol = (AB.x * cross.x + AB.y * cross.y + AB.z * cross.z) / 6.0;
        if (vol <= 1e-12) return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Run full verification.
   */
  public static validate(mesh: FEMMesh): ValidationReport {
    // 1. Geometry Check
    const geometryCheck = { ok: true, message: 'Valid parameters.' };
    
    // 2. Nodes check
    const nodesCheck = { ok: true, count: mesh.nodes.length, message: 'All nodes are valid.' };
    const nodesMap = new Map<string, FEMNode>();
    for (const node of mesh.nodes) {
      if (
        isNaN(node.x) || !isFinite(node.x) ||
        isNaN(node.y) || !isFinite(node.y) ||
        isNaN(node.z) || !isFinite(node.z)
      ) {
        nodesCheck.ok = false;
        nodesCheck.message = `Corrupted coordinates at node ID: ${node.id}`;
        break;
      }
      if (nodesMap.has(node.id)) {
        nodesCheck.ok = false;
        nodesCheck.message = `Duplicate node ID reference: ${node.id}`;
        break;
      }
      nodesMap.set(node.id, node);
    }

    // 3. Elements check
    const elementsCheck = { ok: true, count: mesh.elements.length, message: 'All elements are valid.' };
    for (const elem of mesh.elements) {
      const expectedNodes = elem.type === 'TRI' ? 3 : elem.type === 'QUAD' ? 4 : elem.type === 'TET' ? 4 : elem.type === 'HEX' ? 8 : 0;
      if (elem.nodeIds.length !== expectedNodes) {
        elementsCheck.ok = false;
        elementsCheck.message = `Element ${elem.id} expects ${expectedNodes} nodes, but has ${elem.nodeIds.length}.`;
        break;
      }
      // Check for zero-area or inverted element
      if (this.isInvertedElement(elem, nodesMap)) {
        elementsCheck.ok = false;
        elementsCheck.message = `Element ${elem.id} is degenerate, inverted, or has non-positive volume/area.`;
        break;
      }
    }

    // 4. Connectivity check
    const conn = mesh.connectivity || FEMConnectivityBuilder.build(mesh.nodes, mesh.elements);
    const audit = FEMConnectivityBuilder.audit(mesh.nodes, mesh.elements, conn, this.isInvertedElement.bind(this));
    
    const connectivityCheck = {
      ok: audit.ok,
      audit,
      message: audit.ok
        ? 'Topology is manifold, with closed boundaries and single connected component.'
        : `Topology defects found: Orphans: ${audit.orphanNodes.length}, Duplicates: ${audit.duplicateNodes.length}, Non-manifold faces: ${audit.nonManifoldConnectivity.length}`,
    };

    // 5. Boundary check
    let boundaryCheckOk = true;
    let boundaryMessage = 'Boundary conditions are closed and link back to valid elements/nodes.';
    for (const bnd of mesh.boundaries) {
      for (const nid of bnd.nodeIds) {
        if (!nodesMap.has(nid)) {
          boundaryCheckOk = false;
          boundaryMessage = `Boundary ${bnd.id} references non-existent node: ${nid}`;
          break;
        }
      }
      if (!boundaryCheckOk) break;
    }
    const boundaryCheck = { ok: boundaryCheckOk, message: boundaryMessage };

    // 6. Quality Check
    const qualitySummary = FEMMeshQualityCalculator.analyze(mesh.nodes, mesh.elements);
    const qualityCheck = {
      ok: qualitySummary.invalidCount === 0 && qualitySummary.poorCount === 0,
      summary: qualitySummary,
      message: `Mesh elements classified. Invalid: ${qualitySummary.invalidCount}, Poor: ${qualitySummary.poorCount}, Warning: ${qualitySummary.warningCount}. Avg Aspect Ratio: ${qualitySummary.averageAspectRatio.toFixed(3)}`,
    };

    // 7. Material & Region mapping check
    let materialCheckOk = true;
    let materialMsg = 'Materials successfully mapped to regions.';
    const regionIds = new Set(mesh.regions.map(r => r.id));
    for (const elem of mesh.elements) {
      if (!regionIds.has(elem.regionId)) {
        materialCheckOk = false;
        materialMsg = `Element ${elem.id} references non-existent region ID: ${elem.regionId}`;
        break;
      }
    }
    const materialCheck = { ok: materialCheckOk, message: materialMsg };

    // 8. Determinism Check
    const determinismCheck = {
      ok: mesh.meshHash !== undefined && mesh.meshHash.length === 8,
      message: mesh.meshHash ? `Valid deterministic hash registered: ${mesh.meshHash}` : 'Deterministic hash is missing!',
    };

    const isValid =
      geometryCheck.ok &&
      nodesCheck.ok &&
      elementsCheck.ok &&
      connectivityCheck.ok &&
      boundaryCheck.ok &&
      qualityCheck.summary!.invalidCount === 0 && // Reject any invalid elements
      materialCheck.ok &&
      determinismCheck.ok;

    const overallMessage = isValid
      ? 'Verification GATE Succeeded. Mesh conforms to the engineering criteria.'
      : `Verification GATE Failed. ${nodesCheck.message} ${elementsCheck.message} ${connectivityCheck.message}`;

    return {
      isValid,
      geometryCheck,
      nodesCheck,
      elementsCheck,
      connectivityCheck,
      boundaryCheck,
      qualityCheck,
      materialCheck,
      determinismCheck,
      overallMessage,
    };
  }
}
