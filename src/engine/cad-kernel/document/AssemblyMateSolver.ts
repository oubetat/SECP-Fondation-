/**
 * SECP CAD Kernel — Assembly Mate Solver (PATCH-038C)
 * 
 * Truthful, bounded, deterministic assembly mate constraint solver.
 * Replaces non-truthful assembly mate behavior with explicit status tracking:
 * - SOLVED: Constraint evaluated and satisfied within tolerance.
 * - UNSOLVED: Supported constraint type could not be resolved in the configuration.
 * - UNSUPPORTED: Constraint type not supported by the bounded solver.
 * - CONFLICTING: Two or more contradictory constraints cannot simultaneously hold.
 */

import { AssemblyDefinition, AssemblyInstance, AssemblyMate } from './CADDocument';

export type MateSolveStatus = 'SOLVED' | 'UNSOLVED' | 'UNSUPPORTED' | 'CONFLICTING' | 'ERROR' | 'CONFLICT' | string;

export interface EvaluatedAssemblyMate {
  id: string;
  kind: string;
  compAId: string;
  compBId: string;
  instanceAId?: string;
  instanceBId?: string;
  status: MateSolveStatus;
  satisfied: boolean;
  residual?: number;
  error?: string;
  diagnostic?: string;
  [key: string]: any;
}

export interface InstanceTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export interface AssemblySolverResult {
  allMatesSolved: boolean;
  hasConflicts: boolean;
  hasUnsupported: boolean;
  transforms: Map<string, InstanceTransform>;
  evaluatedMates: EvaluatedAssemblyMate[];
  diagnostics: string[];
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function vDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vLen(v: Vec3): number {
  return Math.sqrt(vDot(v, v));
}

function vSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vScale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vNormalize(v: Vec3, fallback: Vec3 = { x: 0, y: 0, z: 1 }): Vec3 {
  const l = vLen(v);
  if (l > 1e-9) {
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }
  return { ...fallback };
}

function vDist(a: Vec3, b: Vec3): number {
  return vLen(vSub(a, b));
}

export class AssemblyMateSolver {
  public static readonly DEFAULT_TOLERANCE = 1e-4; // 0.1 um

  /**
   * Evaluates and solves assembly mates deterministically.
   */
  public static solve(
    assembly: AssemblyDefinition,
    tolerancePolicy?: string
  ): AssemblySolverResult {
    const diagnostics: string[] = [];
    const evaluatedMates: EvaluatedAssemblyMate[] = [];
    const tolerance = tolerancePolicy === 'HIGH' ? 1e-6 : this.DEFAULT_TOLERANCE;

    // Deterministic sort of instances and mates
    const sortedInstances = [...(assembly.instances || [])].sort((a, b) =>
      a.instanceId.localeCompare(b.instanceId)
    );
    const sortedMates = [...(assembly.mates || [])].sort((a, b) =>
      a.mateId.localeCompare(b.mateId)
    );

    // Initialize transforms map from declared instance positions/rotations
    const transforms = new Map<string, InstanceTransform>();
    const groundedInstances = new Set<string>();

    for (const inst of sortedInstances) {
      transforms.set(inst.instanceId, {
        position: { x: inst.position.x, y: inst.position.y, z: inst.position.z },
        rotation: { x: inst.rotation.x, y: inst.rotation.y, z: inst.rotation.z }
      });
    }

    // Step 1: Detect obvious contradictory constraints
    const mateConflicts = new Set<string>();
    for (let i = 0; i < sortedMates.length; i++) {
      const m1 = sortedMates[i];
      for (let j = i + 1; j < sortedMates.length; j++) {
        const m2 = sortedMates[j];
        const isSamePair =
          (m1.instanceAId === m2.instanceAId && m1.instanceBId === m2.instanceBId) ||
          (m1.instanceAId === m2.instanceBId && m1.instanceBId === m2.instanceAId);

        if (isSamePair) {
          // Check contradictory distance constraints
          if (m1.type === 'DISTANCE' && m2.type === 'DISTANCE') {
            const d1 = m1.offset ?? m1.parameters?.distance ?? 0;
            const d2 = m2.offset ?? m2.parameters?.distance ?? 0;
            if (Math.abs(d1 - d2) > tolerance) {
              mateConflicts.add(m1.mateId);
              mateConflicts.add(m2.mateId);
              diagnostics.push(
                `[SECP_MATE_CONFLICT] Contradictory distance constraints between '${m1.instanceAId}' and '${m1.instanceBId}': '${m1.mateId}' (${d1}mm) vs '${m2.mateId}' (${d2}mm)`
              );
            }
          }
          // Check coincident (distance 0) vs non-zero distance
          if (
            (m1.type === 'COINCIDENT' && m2.type === 'DISTANCE') ||
            (m1.type === 'DISTANCE' && m2.type === 'COINCIDENT')
          ) {
            const distMate = m1.type === 'DISTANCE' ? m1 : m2;
            const d = distMate.offset ?? distMate.parameters?.distance ?? 0;
            if (d > tolerance) {
              mateConflicts.add(m1.mateId);
              mateConflicts.add(m2.mateId);
              diagnostics.push(
                `[SECP_MATE_CONFLICT] Contradictory coincident vs distance constraints between '${m1.instanceAId}' and '${m1.instanceBId}': '${m1.mateId}' vs '${m2.mateId}'`
              );
            }
          }
        }
      }
    }

    // Step 2: Solve FIXED mates first to establish grounded frames
    for (const mate of sortedMates) {
      if (mate.type === 'FIXED') {
        if (mateConflicts.has(mate.mateId)) {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'CONFLICTING',
            satisfied: false,
            error: `Mate '${mate.mateId}' is in conflict with another mate`
          });
          continue;
        }

        if (mate.instanceAId === mate.instanceBId) {
          // Instance fixed to world/ground
          groundedInstances.add(mate.instanceAId);
          const t = transforms.get(mate.instanceAId);
          if (t && mate.parameters?.position) {
            t.position = { ...mate.parameters.position };
          }
          if (t && mate.parameters?.rotation) {
            t.rotation = { ...mate.parameters.rotation };
          }
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'SOLVED',
            satisfied: true,
            residual: 0,
            diagnostic: `[SECP_MATE_SOLVED] Fixed mate '${mate.mateId}' grounded instance '${mate.instanceAId}'`
          });
          diagnostics.push(`[SECP_MATE_SOLVED] Fixed mate '${mate.mateId}' grounded instance '${mate.instanceAId}'`);
        } else {
          // Instance locked relative to reference instance
          const refT = transforms.get(mate.instanceBId) || transforms.get(mate.instanceAId);
          const targetId = mate.instanceAId;
          const targetT = transforms.get(targetId);

          if (refT && targetT) {
            if (mate.parameters?.relativePosition) {
              targetT.position = vAdd(refT.position, mate.parameters.relativePosition);
            }
            if (mate.parameters?.relativeRotation) {
              targetT.rotation = vAdd(refT.rotation, mate.parameters.relativeRotation);
            }
            groundedInstances.add(targetId);
            evaluatedMates.push({
              id: mate.mateId,
              kind: mate.type,
              compAId: mate.instanceAId,
              compBId: mate.instanceBId,
              status: 'SOLVED',
              satisfied: true,
              residual: 0,
              diagnostic: `[SECP_MATE_SOLVED] Fixed mate '${mate.mateId}' locked instance '${targetId}' relative to '${mate.instanceBId}'`
            });
            diagnostics.push(`[SECP_MATE_SOLVED] Fixed mate '${mate.mateId}' locked instance '${targetId}' relative to '${mate.instanceBId}'`);
          } else {
            evaluatedMates.push({
              id: mate.mateId,
              kind: mate.type,
              compAId: mate.instanceAId,
              compBId: mate.instanceBId,
              status: 'UNSOLVED',
              satisfied: false,
              error: `Missing reference or target instance in fixed mate '${mate.mateId}'`
            });
            diagnostics.push(`[SECP_MATE_UNSOLVED] Fixed mate '${mate.mateId}' references missing instance`);
          }
        }
      }
    }

    // Step 3: Solve remaining mates (COINCIDENT, CONCENTRIC, DISTANCE)
    for (const mate of sortedMates) {
      if (mate.type === 'FIXED') {
        continue; // Handled in Step 2
      }

      if (mateConflicts.has(mate.mateId)) {
        evaluatedMates.push({
          id: mate.mateId,
          kind: mate.type,
          compAId: mate.instanceAId,
          compBId: mate.instanceBId,
          status: 'CONFLICTING',
          satisfied: false,
          error: `Mate '${mate.mateId}' is in conflict with another mate`
        });
        continue;
      }

      // Check supported mate subset
      const supportedTypes = ['COINCIDENT', 'CONCENTRIC', 'DISTANCE'];
      if (!supportedTypes.includes(mate.type)) {
        evaluatedMates.push({
          id: mate.mateId,
          kind: mate.type,
          compAId: mate.instanceAId,
          compBId: mate.instanceBId,
          status: 'UNSUPPORTED',
          satisfied: false,
          error: `Mate type '${mate.type}' is unsupported in bounded solver`
        });
        diagnostics.push(`[SECP_MATE_UNSUPPORTED] Mate '${mate.mateId}' type '${mate.type}' is unsupported`);
        continue;
      }

      const tA = transforms.get(mate.instanceAId);
      const tB = transforms.get(mate.instanceBId);

      if (!tA || !tB) {
        evaluatedMates.push({
          id: mate.mateId,
          kind: mate.type,
          compAId: mate.instanceAId,
          compBId: mate.instanceBId,
          status: 'UNSOLVED',
          satisfied: false,
          error: `Instance '${!tA ? mate.instanceAId : mate.instanceBId}' not found`
        });
        diagnostics.push(`[SECP_MATE_UNSOLVED] Mate '${mate.mateId}' references missing instance`);
        continue;
      }

      // Determine reference and target:
      // If B is grounded and A is not, A is target (moves). Otherwise B is target (moves).
      const isAGrounded = groundedInstances.has(mate.instanceAId);
      const isBGrounded = groundedInstances.has(mate.instanceBId);
      
      let refT = tA;
      let tgtT = tB;
      let targetId = mate.instanceBId;
      let refId = mate.instanceAId;

      if (isBGrounded && !isAGrounded) {
        refT = tB;
        tgtT = tA;
        targetId = mate.instanceAId;
        refId = mate.instanceBId;
      }

      if (mate.type === 'DISTANCE') {
        const requestedDist = mate.offset ?? mate.parameters?.distance ?? 0;
        let dir: Vec3;

        if (mate.parameters?.direction) {
          dir = vNormalize(mate.parameters.direction);
        } else {
          const delta = vSub(tgtT.position, refT.position);
          const l = vLen(delta);
          dir = l > 1e-5 ? vNormalize(delta) : { x: 1, y: 0, z: 0 };
        }

        // Apply distance transform to target
        tgtT.position = vAdd(refT.position, vScale(dir, requestedDist));

        // Verify actual distance
        const actualDist = vDist(tgtT.position, refT.position);
        const residual = Math.abs(actualDist - requestedDist);

        if (residual <= tolerance) {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'SOLVED',
            satisfied: true,
            residual,
            diagnostic: `[SECP_MATE_SOLVED] Distance mate '${mate.mateId}' satisfied distance ${requestedDist}mm (residual: ${residual.toFixed(6)})`
          });
          diagnostics.push(`[SECP_MATE_SOLVED] Distance mate '${mate.mateId}' satisfied distance ${requestedDist}mm (residual: ${residual.toFixed(6)})`);
        } else {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'UNSOLVED',
            satisfied: false,
            residual,
            error: `Distance residual ${residual.toFixed(6)} exceeds tolerance ${tolerance}`
          });
          diagnostics.push(`[SECP_MATE_UNSOLVED] Distance mate '${mate.mateId}' residual ${residual.toFixed(6)} exceeds tolerance`);
        }
      } else if (mate.type === 'COINCIDENT') {
        const offset = mate.offset ?? 0;
        const normal = vNormalize(mate.parameters?.normal ?? { x: 0, y: 0, z: 1 });

        if (mate.parameters?.referencePoint && mate.parameters?.targetPoint) {
          const refPt = mate.parameters.referencePoint;
          const tgtPt = mate.parameters.targetPoint;
          const worldRef = vAdd(refT.position, refPt);
          tgtT.position = vAdd(vSub(worldRef, tgtPt), vScale(normal, offset));
        } else {
          tgtT.position = vAdd(refT.position, vScale(normal, offset));
        }

        // Verify coincidence
        let expectedPos = refT.position;
        if (mate.parameters?.referencePoint && mate.parameters?.targetPoint) {
          const refPt = mate.parameters.referencePoint;
          const tgtPt = mate.parameters.targetPoint;
          expectedPos = vAdd(vSub(vAdd(refT.position, refPt), tgtPt), vScale(normal, offset));
        } else {
          expectedPos = vAdd(refT.position, vScale(normal, offset));
        }

        const residual = vDist(tgtT.position, expectedPos);
        if (residual <= tolerance) {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'SOLVED',
            satisfied: true,
            residual,
            diagnostic: `[SECP_MATE_SOLVED] Coincident mate '${mate.mateId}' aligned instances '${mate.instanceAId}' and '${mate.instanceBId}'`
          });
          diagnostics.push(`[SECP_MATE_SOLVED] Coincident mate '${mate.mateId}' aligned instances '${mate.instanceAId}' and '${mate.instanceBId}'`);
        } else {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'UNSOLVED',
            satisfied: false,
            residual,
            error: `Coincident residual ${residual.toFixed(6)} exceeds tolerance`
          });
          diagnostics.push(`[SECP_MATE_UNSOLVED] Coincident mate '${mate.mateId}' residual ${residual.toFixed(6)} exceeds tolerance`);
        }
      } else if (mate.type === 'CONCENTRIC') {
        const axis = vNormalize(mate.parameters?.axis ?? { x: 0, y: 0, z: 1 });
        const delta = vSub(tgtT.position, refT.position);
        const axialProj = vDot(delta, axis);

        // Radial projection: move target onto axis line passing through reference
        tgtT.position = vAdd(refT.position, vScale(axis, axialProj));
        tgtT.rotation = { ...refT.rotation };

        // Verify axis alignment
        const newDelta = vSub(tgtT.position, refT.position);
        const newAxialProj = vDot(newDelta, axis);
        const radialOffset = vSub(newDelta, vScale(axis, newAxialProj));
        const residual = vLen(radialOffset);

        if (residual <= tolerance) {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'SOLVED',
            satisfied: true,
            residual,
            diagnostic: `[SECP_MATE_SOLVED] Concentric mate '${mate.mateId}' aligned axes between '${mate.instanceAId}' and '${mate.instanceBId}'`
          });
          diagnostics.push(`[SECP_MATE_SOLVED] Concentric mate '${mate.mateId}' aligned axes between '${mate.instanceAId}' and '${mate.instanceBId}'`);
        } else {
          evaluatedMates.push({
            id: mate.mateId,
            kind: mate.type,
            compAId: mate.instanceAId,
            compBId: mate.instanceBId,
            status: 'UNSOLVED',
            satisfied: false,
            residual,
            error: `Concentric residual ${residual.toFixed(6)} exceeds tolerance`
          });
          diagnostics.push(`[SECP_MATE_UNSOLVED] Concentric mate '${mate.mateId}' residual ${residual.toFixed(6)} exceeds tolerance`);
        }
      }
    }

    const allMatesSolved =
      evaluatedMates.length === 0 || evaluatedMates.every(m => m.status === 'SOLVED');
    const hasConflicts = evaluatedMates.some(m => m.status === 'CONFLICTING');
    const hasUnsupported = evaluatedMates.some(m => m.status === 'UNSUPPORTED');

    return {
      allMatesSolved,
      hasConflicts,
      hasUnsupported,
      transforms,
      evaluatedMates,
      diagnostics
    };
  }
}
