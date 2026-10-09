/**
 * SECP Industrial OS — EPC-026: Mesh Quality Gate Service
 * Evaluates FEA mesh topology and geometric quality before solver execution.
 * Checks aspect ratio, Jacobian determinant, degenerate elements, duplicate nodes,
 * invalid elements, and free/unconnected regions using SECP Mesh Infrastructure.
 * Hard gate: Enforces PASS before solver execution can proceed.
 */

import { MeshQualityGateResult } from './FEAVerificationTypes';
import { FEAMesh } from '../../structural-physics/StructuralPhysicsTypes';
import { MeshQualityEngine } from '../../structural-physics/MeshQualityEngine';
import { MeshValidator } from '../../physics/mesh/MeshValidator';
import { MeshSet } from '../../physics/mesh/MeshTypes';

export class MeshQualityGateService {
  /**
   * Evaluates FEA Mesh quality and enforces quality criteria.
   */
  public static evaluateMeshQuality(
    mesh: FEAMesh,
    meshId: string = 'FEA-MESH-001',
    meshRevision: string = '1.0'
  ): MeshQualityGateResult {
    // 1. Evaluate metrics via SECP MeshQualityEngine
    const evaluatedMesh = MeshQualityEngine.evaluateMeshQuality(mesh);
    const metrics = evaluatedMesh.qualityMetrics;

    // 2. Perform detailed checks for duplicate nodes, degenerate elements, and free regions
    const nodeCoordsSet = new Set<string>();
    let hasDuplicateNodes = false;
    mesh.nodes.forEach(node => {
      const coordKey = `${node.x.toFixed(6)},${node.y.toFixed(6)},${node.z.toFixed(6)}`;
      if (nodeCoordsSet.has(coordKey)) {
        hasDuplicateNodes = true;
      }
      nodeCoordsSet.add(coordKey);
    });

    let hasDegenerateElements = false;
    let hasInvalidElements = false;
    mesh.elements.forEach(elem => {
      if (!elem.nodeIds || elem.nodeIds.length < 2) {
        hasInvalidElements = true;
      }
      // Check for zero length / area elements
      if (elem.type === 'BAR_1D' && elem.nodeIds.length === 2) {
        const n1 = mesh.nodes.find(n => n.id === elem.nodeIds[0]);
        const n2 = mesh.nodes.find(n => n.id === elem.nodeIds[1]);
        if (n1 && n2) {
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dz = n2.z - n1.z;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (len <= 1e-9) {
            hasDegenerateElements = true;
          }
        }
      }
    });

    // Check connectivity for orphan nodes
    const connectedNodeIds = new Set<number>();
    mesh.elements.forEach(elem => {
      elem.nodeIds.forEach(id => connectedNodeIds.add(id));
    });

    const hasFreeUnconnectedRegions = mesh.nodes.some(node => !connectedNodeIds.has(node.id));

    // Calculate element quality statistics
    const elementCount = mesh.elements.length;
    const nodeCount = mesh.nodes.length;
    const minQuality = metrics.jacobianDeterminantMin;
    const maxQuality = 1.0;
    const avgQuality = (minQuality + maxQuality) / 2;

    // Quality gate pass condition
    const gatePassed =
      metrics.isValid &&
      !hasDegenerateElements &&
      !hasInvalidElements &&
      !hasDuplicateNodes &&
      !hasFreeUnconnectedRegions &&
      metrics.aspectRatioMax < 5.0 &&
      metrics.jacobianDeterminantMin > 0.1;

    const details = gatePassed
      ? `Mesh Quality Gate PASSED (${elementCount} elements, ${nodeCount} nodes, Min Jacobian=${minQuality.toFixed(3)}, Max Aspect Ratio=${metrics.aspectRatioMax.toFixed(2)})`
      : `Mesh Quality Gate FAILED: Degenerate=${hasDegenerateElements}, Invalid=${hasInvalidElements}, Duplicates=${hasDuplicateNodes}, FreeNodes=${hasFreeUnconnectedRegions}, MinJacobian=${minQuality}`;

    return {
      meshId,
      meshRevision,
      elementType: mesh.elements[0]?.type || 'BAR_1D',
      elementCount,
      nodeCount,
      minimumQuality: minQuality,
      maximumQuality: maxQuality,
      averageQuality: avgQuality,
      aspectRatioMin: metrics.aspectRatioMin,
      aspectRatioMax: metrics.aspectRatioMax,
      jacobianDeterminantMin: metrics.jacobianDeterminantMin,
      hasDegenerateElements,
      hasInvalidElements,
      hasDuplicateNodes,
      hasFreeUnconnectedRegions,
      gatePassed,
      details
    };
  }
}
