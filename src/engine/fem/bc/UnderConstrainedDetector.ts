/**
 * SECP CAD/CAE Platform - Under-Constrained & Rigid Body Mode Detector
 * PATCH-235 — Boundary Condition Engine
 *
 * Pre-solve kinematic stability auditor. Analyzes active Dirichlet constraints
 * to detect unconstrained rigid body translation (TX, TY, TZ) and rotation (RX, RY, RZ)
 * mechanisms prior to global matrix assembly.
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { BCDiagnosticIssue } from './BoundaryConditionTypes';
import { ResolvedNodeConstraint } from './DOFResolver';

export interface RigidBodyModeAnalysis {
  isSufficientlyConstrained: boolean;
  unconstrainedModes: ('TX' | 'TY' | 'TZ' | 'RX' | 'RY' | 'RZ')[];
  constrainedDOFsCount: number;
  totalDOFsCount: number;
  issues: BCDiagnosticIssue[];
}

export class UnderConstrainedDetector {
  /**
   * Analyzes rigid body stability for a 3D mesh given a map of resolved node constraints.
   */
  public static analyzeRigidBodyModes(
    constrainedMap: Map<string, ResolvedNodeConstraint>,
    mesh: FEMMesh
  ): RigidBodyModeAnalysis {
    const issues: BCDiagnosticIssue[] = [];
    const unconstrainedModes: ('TX' | 'TY' | 'TZ' | 'RX' | 'RY' | 'RZ')[] = [];

    if (!mesh || mesh.nodes.length === 0) {
      return {
        isSufficientlyConstrained: false,
        unconstrainedModes: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ'],
        constrainedDOFsCount: 0,
        totalDOFsCount: 0,
        issues: [
          {
            code: 'BOUNDARY_CONDITION_INSUFFICIENT',
            severity: 'ERROR',
            message: 'Mesh is empty. Cannot evaluate rigid body stability.'
          }
        ]
      };
    }

    const totalNodes = mesh.nodes.length;
    const totalDOFsCount = totalNodes * 3; // 3D structural translation DOFs

    // Track constrained translation DOFs
    let hasConstrainedX = false;
    let hasConstrainedY = false;
    let hasConstrainedZ = false;

    // Track coordinates of constrained nodes for rotational stability check
    const constrainedXNodes: { x: number; y: number; z: number }[] = [];
    const constrainedYNodes: { x: number; y: number; z: number }[] = [];
    const constrainedZNodes: { x: number; y: number; z: number }[] = [];

    const nodeMap = new Map(mesh.nodes.map((n) => [n.id, n]));

    for (const [key, c] of constrainedMap.entries()) {
      const node = nodeMap.get(c.nodeId);
      if (!node) continue;

      if (c.field === 'UX') {
        hasConstrainedX = true;
        constrainedXNodes.push({ x: node.x, y: node.y, z: node.z });
      }
      if (c.field === 'UY') {
        hasConstrainedY = true;
        constrainedYNodes.push({ x: node.x, y: node.y, z: node.z });
      }
      if (c.field === 'UZ') {
        hasConstrainedZ = true;
        constrainedZNodes.push({ x: node.x, y: node.y, z: node.z });
      }
    }

    // 1. Translational Rigid Body Check
    if (!hasConstrainedX) unconstrainedModes.push('TX');
    if (!hasConstrainedY) unconstrainedModes.push('TY');
    if (!hasConstrainedZ) unconstrainedModes.push('TZ');

    // 2. Rotational Rigid Body Check (Check spatial span of constraints)
    // RX: Rotation around X axis requires Y or Z displacement constraints spanning different positions
    let hasRxConstraint = false;
    if (constrainedYNodes.length >= 2) {
      const zMin = Math.min(...constrainedYNodes.map((n) => n.z));
      const zMax = Math.max(...constrainedYNodes.map((n) => n.z));
      if (zMax - zMin > 1e-5) hasRxConstraint = true;
    }
    if (!hasRxConstraint && constrainedZNodes.length >= 2) {
      const yMin = Math.min(...constrainedZNodes.map((n) => n.y));
      const yMax = Math.max(...constrainedZNodes.map((n) => n.y));
      if (yMax - yMin > 1e-5) hasRxConstraint = true;
    }
    if (!hasRxConstraint) unconstrainedModes.push('RX');

    // RY: Rotation around Y axis requires X or Z displacement constraints spanning different positions
    let hasRyConstraint = false;
    if (constrainedXNodes.length >= 2) {
      const zMin = Math.min(...constrainedXNodes.map((n) => n.z));
      const zMax = Math.max(...constrainedXNodes.map((n) => n.z));
      if (zMax - zMin > 1e-5) hasRyConstraint = true;
    }
    if (!hasRyConstraint && constrainedZNodes.length >= 2) {
      const xMin = Math.min(...constrainedZNodes.map((n) => n.x));
      const xMax = Math.max(...constrainedZNodes.map((n) => n.x));
      if (xMax - xMin > 1e-5) hasRyConstraint = true;
    }
    if (!hasRyConstraint) unconstrainedModes.push('RY');

    // RZ: Rotation around Z axis requires X or Y displacement constraints spanning different positions
    let hasRzConstraint = false;
    if (constrainedXNodes.length >= 2) {
      const yMin = Math.min(...constrainedXNodes.map((n) => n.y));
      const yMax = Math.max(...constrainedXNodes.map((n) => n.y));
      if (yMax - yMin > 1e-5) hasRzConstraint = true;
    }
    if (!hasRzConstraint && constrainedYNodes.length >= 2) {
      const xMin = Math.min(...constrainedYNodes.map((n) => n.x));
      const xMax = Math.max(...constrainedYNodes.map((n) => n.x));
      if (xMax - xMin > 1e-5) hasRzConstraint = true;
    }
    if (!hasRzConstraint) unconstrainedModes.push('RZ');

    const isSufficientlyConstrained = unconstrainedModes.length === 0;

    if (!isSufficientlyConstrained) {
      issues.push({
        code: 'BOUNDARY_CONDITION_INSUFFICIENT',
        severity: 'ERROR',
        unconstrainedModes,
        message: `Model is under-constrained. Detected unconstrained rigid body mode(s): [${unconstrainedModes.join(', ')}]. Matrix solve would fail due to singularity.`
      });
    }

    return {
      isSufficientlyConstrained,
      unconstrainedModes,
      constrainedDOFsCount: constrainedMap.size,
      totalDOFsCount,
      issues
    };
  }
}
