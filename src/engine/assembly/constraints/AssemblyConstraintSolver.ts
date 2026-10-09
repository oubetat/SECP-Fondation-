import * as crypto from 'crypto';
import { Vector3D } from '../../cadKernel';
import { AssemblyComponentPose, AssemblyConstraint } from './AssemblyConstraintModel';
import { AssemblyConstraintGraph } from './AssemblyConstraintGraph';
import { AssemblyConstraintState } from './AssemblyConstraintState';
import { AssemblySolveResult, SolverConvergenceStatus } from './AssemblySolveResult';
import { AssemblySolverDiagnostics } from './AssemblySolverDiagnostics';
import { AssemblyConstraintValidator } from './AssemblyConstraintValidator';
import {
  vecSubtract,
  vecAdd,
  vecDot,
  vecCross,
  vecLength,
  vecNormalize,
  vecScale,
  computeEulerRotationMatrix,
  transformPoint,
  transformDirection,
} from './AssemblyConstraint';

export class AssemblyConstraintSolver {
  private static readonly MAX_ITERATIONS = 10000;
  private static readonly CONVERGENCE_TOLERANCE = 1e-7;

  /**
   * Deterministically solves the spatial relationship between components under active constraints.
   */
  public static solve(state: AssemblyConstraintState): AssemblySolveResult {
    const solvedTimestamp = new Date().toISOString();
    const activeConstraints = state.getAllConstraints().filter(c => !c.suppressed && c.enabled);
    const rawComponents = state.getAllComponents();

    // 1. Guard for empty assembly or empty constraints
    if (rawComponents.length === 0) {
      return {
        status: 'CONVERGED',
        solvedPoses: {},
        convergence: {
          iterations: 0,
          initialResidual: 0,
          finalResidual: 0,
          maximumResidual: 0,
          tolerance: this.CONVERGENCE_TOLERANCE,
          activeConstraints: [],
          failedConstraints: [],
        },
        residualDiagnostics: [],
        totalAssemblyDOF: 0,
        solvedTimestamp,
      };
    }

    // Deep clone components and synchronize transforms from initial position/orientation
    const components: AssemblyComponentPose[] = JSON.parse(JSON.stringify(rawComponents));
    for (const comp of components) {
      const rotMat = computeEulerRotationMatrix(comp.orientation);
      comp.transform = [
        [rotMat[0][0], rotMat[0][1], rotMat[0][2], comp.position.x],
        [rotMat[1][0], rotMat[1][1], rotMat[1][2], comp.position.y],
        [rotMat[2][0], rotMat[2][1], rotMat[2][2], comp.position.z],
        [0, 0, 0, 1],
      ];
    }

    // 2. Validate Geometry References (Section 7 & 20)
    const componentIds = new Set(components.map(c => c.instanceId));
    const refValidation = AssemblyConstraintValidator.validateGeometryReferences(activeConstraints, componentIds);
    if (!refValidation.valid) {
      // Create error diagnostics with INVALID status
      return {
        status: 'INVALID',
        solvedPoses: this.posesToRecord(components),
        convergence: {
          iterations: 0,
          initialResidual: 1.0,
          finalResidual: 1.0,
          maximumResidual: 1.0,
          tolerance: this.CONVERGENCE_TOLERANCE,
          activeConstraints: activeConstraints.map(c => c.constraintId),
          failedConstraints: activeConstraints.map(c => c.constraintId),
        },
        residualDiagnostics: activeConstraints.map(c => ({
          constraintId: c.constraintId,
          residual: NaN,
          tolerance: c.tolerance,
          satisfied: false,
          diagnostic: `INVALID_REFERENCE: ${refValidation.reason}`,
        })),
        totalAssemblyDOF: components.length * 6,
        solvedTimestamp,
      };
    }

    // 3. Build Constraint Graph (Section 6 & 7)
    const graph = new AssemblyConstraintGraph();
    for (const comp of components) {
      graph.addComponent(comp.instanceId);
    }
    for (const c of activeConstraints) {
      graph.addConstraint(c);
    }

    // 4. Grounded Component and Conflict Detection (Section 11 & 14)
    const groundedId = state.getGroundedComponent();
    const graphConflict = graph.detectConflicts();
    if (graphConflict) {
      return {
        status: 'CONFLICT',
        solvedPoses: this.posesToRecord(components),
        convergence: {
          iterations: 0,
          initialResidual: 1.0,
          finalResidual: 1.0,
          maximumResidual: 1.0,
          tolerance: this.CONVERGENCE_TOLERANCE,
          activeConstraints: activeConstraints.map(c => c.constraintId),
          failedConstraints: [graphConflict.c1.constraintId, graphConflict.c2.constraintId],
        },
        residualDiagnostics: activeConstraints.map(c => ({
          constraintId: c.constraintId,
          residual: NaN,
          tolerance: c.tolerance,
          satisfied: false,
          diagnostic: `CONFLICT: ${graphConflict.reason}`,
        })),
        totalAssemblyDOF: components.length * 6,
        solvedTimestamp,
      };
    }

    // 5. Check redundancy beforehand
    const redundancies = graph.detectRedundancies();

    // 6. Calculate initial residuals
    let initialMaxResidual = 0;
    const initialResiduals = AssemblyConstraintValidator.verifyConstraints(activeConstraints, this.posesToRecord(components));
    for (const res of initialResiduals) {
      if (!isNaN(res.residual)) {
        initialMaxResidual = Math.max(initialMaxResidual, res.residual);
      }
    }

    // 7. Solve ordering (Topological/Grounded sorting)
    const solveOrder = graph.determineSolveOrdering(groundedId);

    // 8. Numerical relaxation loop (Section 7, 8, & 9)
    let iterations = 0;
    let finalMaxResidual = 0;
    const learningRate = 0.2;
    const MAX_ROTATION_STEP_DEG = 10.0;

    // Helper to apply rotation to component in its local Euler space using exact Jacobian inverse
    const applyRotation = (comp: any, worldRotVec: Vector3D, factor: number) => {
      const rx = (comp.orientation.x * Math.PI) / 180;
      const ry = (comp.orientation.y * Math.PI) / 180;
      const rz = (comp.orientation.z * Math.PI) / 180;

      const cy = Math.cos(ry);
      const sy = Math.sin(ry);
      const cz = Math.cos(rz);
      const sz = Math.sin(rz);

      // Guard against gimbal lock (ry near +/- 90 deg)
      const safeCy = Math.abs(cy) < 1e-4 ? (cy >= 0 ? 1e-4 : -1e-4) : cy;

      const drxRad = (cz * worldRotVec.x + sz * worldRotVec.y) / safeCy;
      const dryRad = -sz * worldRotVec.x + cz * worldRotVec.y;
      const drzRad = ((cz * sy * worldRotVec.x + sz * sy * worldRotVec.y) / safeCy) + worldRotVec.z;

      const drxDeg = (drxRad * 180) / Math.PI;
      const dryDeg = (dryRad * 180) / Math.PI;
      const drzDeg = (drzRad * 180) / Math.PI;

      const stepX = Math.max(-MAX_ROTATION_STEP_DEG, Math.min(MAX_ROTATION_STEP_DEG, drxDeg * factor));
      const stepY = Math.max(-MAX_ROTATION_STEP_DEG, Math.min(MAX_ROTATION_STEP_DEG, dryDeg * factor));
      const stepZ = Math.max(-MAX_ROTATION_STEP_DEG, Math.min(MAX_ROTATION_STEP_DEG, drzDeg * factor));

      comp.orientation.x += stepX;
      comp.orientation.y += stepY;
      comp.orientation.z += stepZ;
    };

    while (iterations < this.MAX_ITERATIONS) {
      iterations++;
      let currentIterationMaxResidual = 0;

      // Numerical relaxations over each active constraint
      for (const constraint of activeConstraints) {
        const compA = components.find(c => c.instanceId === constraint.componentA)!;
        const compB = components.find(c => c.instanceId === constraint.componentB)!;

        const isGroundedA = compA.instanceId === groundedId;
        const isGroundedB = compB.instanceId === groundedId;

        const rotMatA = computeEulerRotationMatrix(compA.orientation);
        const rotMatB = computeEulerRotationMatrix(compB.orientation);

        // Guard against NaN parameters
        if (
          isNaN(constraint.parameters.offsetMm ?? 0) || !isFinite(constraint.parameters.offsetMm ?? 0) ||
          isNaN(constraint.parameters.angleDeg ?? 0) || !isFinite(constraint.parameters.angleDeg ?? 0)
        ) {
          return {
            status: 'INVALID',
            solvedPoses: this.posesToRecord(components),
            convergence: {
              iterations,
              initialResidual: initialMaxResidual,
              finalResidual: NaN,
              maximumResidual: NaN,
              tolerance: this.CONVERGENCE_TOLERANCE,
              activeConstraints: activeConstraints.map(c => c.constraintId),
              failedConstraints: [constraint.constraintId],
            },
            residualDiagnostics: [],
            totalAssemblyDOF: components.length * 6,
            solvedTimestamp,
          };
        }

        const refA = constraint.geometryReferenceA;
        const refB = constraint.geometryReferenceB;

        const pA = transformPoint(refA.cachedPoint || { x: 0, y: 0, z: 0 }, compA);
        const pB = transformPoint(refB.cachedPoint || { x: 0, y: 0, z: 0 }, compB);

        const nA = vecNormalize(transformDirection(refA.cachedNormal || { x: 0, y: 0, z: 1 }, compA));
        const nB = vecNormalize(transformDirection(refB.cachedNormal || { x: 0, y: 0, z: 1 }, compB));

        let residual = 0;

        switch (constraint.constraintType) {
          case 'FIXED': {
            // Force component B's pose to match component A's pose within tolerance
            const posDiff = vecSubtract(compA.position, compB.position);
            residual = vecLength(posDiff);

            if (residual > constraint.tolerance) {
              if (!isGroundedB) {
                compB.position = { ...compA.position };
                compB.orientation = { ...compA.orientation };
              } else if (!isGroundedA) {
                compA.position = { ...compB.position };
                compA.orientation = { ...compB.orientation };
              }
            }
            break;
          }

          case 'COINCIDENT': {
            if (refA.topologyType === 'FACE' && refB.topologyType === 'FACE') {
              // Planar mate contact along normal direction nA: dot(nA, pA - pB) = 0
              const pA_pB = vecSubtract(pA, pB);
              const distAlongNormal = vecDot(nA, pA_pB);
              residual = Math.abs(distAlongNormal);

              if (residual > constraint.tolerance) {
                const shift = vecScale(nA, distAlongNormal * learningRate);
                if (!isGroundedA && isGroundedB) {
                  compA.position = vecSubtract(compA.position, vecScale(shift, 2.0));
                } else if (isGroundedA && !isGroundedB) {
                  compB.position = vecAdd(compB.position, vecScale(shift, 2.0));
                } else if (!isGroundedA && !isGroundedB) {
                  compA.position = vecSubtract(compA.position, shift);
                  compB.position = vecAdd(compB.position, shift);
                }
              }

              // Normal alignment (opposing normals: nA + nB ≈ 0)
              const normDot = vecDot(nA, nB);
              const normResidual = Math.abs(normDot + 1.0);
              residual += normResidual;

              if (normResidual > constraint.tolerance) {
                // Rotate compB to align nB with -nA
                const rotVecRad = vecCross(nB, vecScale(nA, -1));
                if (!isGroundedA && isGroundedB) {
                  applyRotation(compA, vecScale(rotVecRad, -1), learningRate * 2.0);
                } else if (isGroundedA && !isGroundedB) {
                  applyRotation(compB, rotVecRad, learningRate * 2.0);
                } else if (!isGroundedA && !isGroundedB) {
                  applyRotation(compA, vecScale(rotVecRad, -1), learningRate);
                  applyRotation(compB, rotVecRad, learningRate);
                }
              }
            } else {
              // Point-point contact: pA = pB
              const diff = vecSubtract(pA, pB);
              residual = vecLength(diff);

              if (residual > constraint.tolerance) {
                const shift = vecScale(diff, learningRate);
                if (!isGroundedA && isGroundedB) {
                  compA.position = vecSubtract(compA.position, vecScale(shift, 2.0));
                } else if (isGroundedA && !isGroundedB) {
                  compB.position = vecAdd(compB.position, vecScale(shift, 2.0));
                } else if (!isGroundedA && !isGroundedB) {
                  compA.position = vecSubtract(compA.position, shift);
                  compB.position = vecAdd(compB.position, shift);
                }
              }
            }
            break;
          }

          case 'CONCENTRIC': {
            // Axial alignment: nA x nB = 0
            // Axial offset: rejection(pB - pA, nA) = 0
            const crossDir = vecCross(nA, nB);
            const angRes = vecLength(crossDir);

            const pB_pA = vecSubtract(pB, pA);
            const proj = vecScale(nA, vecDot(pB_pA, nA));
            const rejection = vecSubtract(pB_pA, proj);
            const linRes = vecLength(rejection);

            residual = angRes + linRes;

            if (linRes > constraint.tolerance) {
              const shift = vecScale(rejection, learningRate);
              if (!isGroundedA && isGroundedB) {
                compA.position = vecAdd(compA.position, vecScale(shift, 2.0));
              } else if (isGroundedA && !isGroundedB) {
                compB.position = vecSubtract(compB.position, vecScale(shift, 2.0));
              } else if (!isGroundedA && !isGroundedB) {
                compA.position = vecAdd(compA.position, shift);
                compB.position = vecSubtract(compB.position, shift);
              }
            }

            if (angRes > constraint.tolerance) {
              // Adjust orientation to align nB with nA
              const rotVecRad = vecCross(nB, nA);
              if (!isGroundedA && isGroundedB) {
                applyRotation(compA, vecScale(rotVecRad, -1), learningRate * 2.0);
              } else if (isGroundedA && !isGroundedB) {
                applyRotation(compB, rotVecRad, learningRate * 2.0);
              } else if (!isGroundedA && !isGroundedB) {
                applyRotation(compA, vecScale(rotVecRad, -1), learningRate);
                applyRotation(compB, rotVecRad, learningRate);
              }
            }
            break;
          }

          case 'DISTANCE': {
            const targetDist = constraint.parameters.offsetMm ?? 0;
            const diff = vecSubtract(pA, pB);
            const currentDist = vecLength(diff);

            if (refA.topologyType === 'FACE' && refB.topologyType === 'FACE') {
              const distAlongNormal = vecDot(nA, diff);
              residual = Math.abs(Math.abs(distAlongNormal) - targetDist);

              if (residual > constraint.tolerance) {
                const currentError = distAlongNormal - (distAlongNormal < 0 ? -targetDist : targetDist);
                const shift = vecScale(nA, currentError * learningRate);

                if (!isGroundedA && isGroundedB) {
                  compA.position = vecSubtract(compA.position, vecScale(shift, 2.0));
                } else if (isGroundedA && !isGroundedB) {
                  compB.position = vecAdd(compB.position, vecScale(shift, 2.0));
                } else if (!isGroundedA && !isGroundedB) {
                  compA.position = vecSubtract(compA.position, shift);
                  compB.position = vecAdd(compB.position, shift);
                }
              }
            } else {
              residual = Math.abs(currentDist - targetDist);

              if (residual > constraint.tolerance) {
                const u = currentDist > 1e-9 ? vecNormalize(diff) : { x: 0, y: 0, z: 1 };
                const currentError = currentDist - targetDist;
                const shift = vecScale(u, currentError * learningRate);

                if (!isGroundedA && isGroundedB) {
                  compA.position = vecSubtract(compA.position, vecScale(shift, 2.0));
                } else if (isGroundedA && !isGroundedB) {
                  compB.position = vecAdd(compB.position, vecScale(shift, 2.0));
                } else if (!isGroundedA && !isGroundedB) {
                  compA.position = vecSubtract(compA.position, shift);
                  compB.position = vecAdd(compB.position, shift);
                }
              }
            }
            break;
          }

          case 'ANGLE':
          case 'PARALLEL':
          case 'PERPENDICULAR': {
            const nA_curr = vecNormalize(transformDirection(refA.cachedNormal || { x: 0, y: 0, z: 1 }, compA));
            const nB_curr = vecNormalize(transformDirection(refB.cachedNormal || { x: 0, y: 0, z: 1 }, compB));

            const cosTheta = Math.max(-1, Math.min(1, vecDot(nA_curr, nB_curr)));
            const angleRad = Math.acos(cosTheta);
            const angleDeg = (angleRad * 180) / Math.PI;

            let errorRad = 0;

            if (constraint.constraintType === 'PARALLEL') {
              residual = vecLength(vecCross(nA_curr, nB_curr));
              const targetAngleRad = angleRad <= Math.PI / 2 ? 0 : Math.PI;
              errorRad = targetAngleRad - angleRad;
            } else if (constraint.constraintType === 'PERPENDICULAR') {
              residual = Math.abs(vecDot(nA_curr, nB_curr));
              const targetAngleRad = Math.PI / 2;
              errorRad = targetAngleRad - angleRad;
            } else {
              const targetAngle = constraint.parameters.angleDeg ?? 0;
              residual = Math.abs(angleDeg - targetAngle);
              const targetAngleRad = (targetAngle * Math.PI) / 180;
              errorRad = targetAngleRad - angleRad;
            }

            if (residual > constraint.tolerance || Math.abs(errorRad) > 1e-7) {
              let rotAxis = vecCross(nA_curr, nB_curr);
              if (vecLength(rotAxis) < 1e-6) {
                const ortho = Math.abs(nA_curr.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
                rotAxis = vecNormalize(vecCross(nA_curr, ortho));
              } else {
                rotAxis = vecNormalize(rotAxis);
              }

              // Rotate nB to reach target angle with nA
              // Rotating nB around unit(nA x nB) by +errorRad increases the angle between nA and nB.
              const rotVecRad = vecScale(rotAxis, errorRad);

              if (!isGroundedA && isGroundedB) {
                applyRotation(compA, vecScale(rotVecRad, -1), learningRate * 2.0);
              } else if (isGroundedA && !isGroundedB) {
                applyRotation(compB, rotVecRad, learningRate * 2.0);
              } else if (!isGroundedA && !isGroundedB) {
                applyRotation(compA, vecScale(rotVecRad, -1), learningRate);
                applyRotation(compB, rotVecRad, learningRate);
              }
            }
            break;
          }

          default:
            break;
        }

        // Keep rotation parameters bound in [-360, 360]
        compA.orientation.x %= 360; compA.orientation.y %= 360; compA.orientation.z %= 360;
        compB.orientation.x %= 360; compB.orientation.y %= 360; compB.orientation.z %= 360;

        // Recompute world transform matrix [ R t ; 0 1 ] (Section 4)
        const rotMatA_new = computeEulerRotationMatrix(compA.orientation);
        compA.transform = [
          [rotMatA_new[0][0], rotMatA_new[0][1], rotMatA_new[0][2], compA.position.x],
          [rotMatA_new[1][0], rotMatA_new[1][1], rotMatA_new[1][2], compA.position.y],
          [rotMatA_new[2][0], rotMatA_new[2][1], rotMatA_new[2][2], compA.position.z],
          [0, 0, 0, 1],
        ];

        const rotMatB_new = computeEulerRotationMatrix(compB.orientation);
        compB.transform = [
          [rotMatB_new[0][0], rotMatB_new[0][1], rotMatB_new[0][2], compB.position.x],
          [rotMatB_new[1][0], rotMatB_new[1][1], rotMatB_new[1][2], compB.position.y],
          [rotMatB_new[2][0], rotMatB_new[2][1], rotMatB_new[2][2], compB.position.z],
          [0, 0, 0, 1],
        ];

        currentIterationMaxResidual = Math.max(currentIterationMaxResidual, residual);
      }

      finalMaxResidual = currentIterationMaxResidual;
      if (currentIterationMaxResidual <= this.CONVERGENCE_TOLERANCE) {
        break; // Met convergence criteria!
      }
    }

    // 9. Numerical Safety & Transform Integrity Validations (Section 18, 19, & 20)
    const numericalValidation = AssemblyConstraintValidator.validatePoses(components, 1e-4);
    if (!numericalValidation.valid) {
      return {
        status: 'INVALID',
        solvedPoses: this.posesToRecord(components),
        convergence: {
          iterations,
          initialResidual: initialMaxResidual,
          finalResidual: NaN,
          maximumResidual: NaN,
          tolerance: this.CONVERGENCE_TOLERANCE,
          activeConstraints: activeConstraints.map(c => c.constraintId),
          failedConstraints: activeConstraints.map(c => c.constraintId),
        },
        residualDiagnostics: activeConstraints.map(c => ({
          constraintId: c.constraintId,
          residual: NaN,
          tolerance: c.tolerance,
          satisfied: false,
          diagnostic: `NUMERICAL_FAILURE: ${numericalValidation.reason}`,
        })),
        totalAssemblyDOF: components.length * 6,
        solvedTimestamp,
      };
    }

    // 10. Perform post-solve Geometric Verification & DOF Analyze (Section 5, 9, & 20)
    const finalResiduals = AssemblyConstraintValidator.verifyConstraints(activeConstraints, this.posesToRecord(components));
    const allSatisfied = finalResiduals.every(r => r.satisfied);
    const failedConstraints = finalResiduals.filter(r => !r.satisfied).map(r => r.constraintId);

    const { componentDOFs, totalAssemblyDOF } = AssemblySolverDiagnostics.analyzeDegreesOfFreedom(
      components,
      activeConstraints,
      groundedId
    );

    // Apply DOF properties to components
    for (const comp of components) {
      const cdof = componentDOFs[comp.instanceId];
      if (cdof) {
        comp.degreesOfFreedom = {
          initialDOF: cdof.initialDOF,
          remainingDOF: cdof.remainingDOF,
          constrainedDOF: cdof.constrainedDOF,
          redundantDOF: cdof.redundantDOF,
          conflictingDOF: cdof.conflictingDOF,
          unconstrainedDirections: cdof.unconstrainedDirections,
        };
      }
    }

    let status: SolverConvergenceStatus = 'CONVERGED';

    if (!allSatisfied) {
      status = 'NOT_CONVERGED';
    } else if (redundancies.length > 0) {
      status = 'REDUNDANT';
    } else if (totalAssemblyDOF > 0) {
      status = 'CONVERGED_WITH_REMAINING_DOF';
    }

    return {
      status,
      solvedPoses: this.posesToRecord(components),
      convergence: {
        iterations,
        initialResidual: initialMaxResidual,
        finalResidual: finalMaxResidual,
        maximumResidual: Math.max(initialMaxResidual, finalMaxResidual),
        tolerance: this.CONVERGENCE_TOLERANCE,
        activeConstraints: activeConstraints.map(c => c.constraintId),
        failedConstraints,
      },
      residualDiagnostics: finalResiduals,
      totalAssemblyDOF,
      solvedTimestamp,
    };
  }

  /**
   * Computes a deterministic hash of a component's poses and constraints (Section 17)
   */
  public static computeDeterministicHashes(
    components: AssemblyComponentPose[],
    constraints: AssemblyConstraint[]
  ): { constraintSetHash: string; componentPoseHash: string } {
    // Sort components by instanceId for deterministic hash
    const sortedComps = [...components].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
    const poseString = sortedComps
      .map(
        c =>
          `${c.instanceId}:${c.position.x.toFixed(4)},${c.position.y.toFixed(4)},${c.position.z.toFixed(4)}:${c.orientation.x.toFixed(4)},${c.orientation.y.toFixed(4)},${c.orientation.z.toFixed(4)}`
      )
      .join('|');

    // Sort constraints by constraintId for deterministic hash
    const sortedConstraints = [...constraints].sort((a, b) => a.constraintId.localeCompare(b.constraintId));
    const constraintString = sortedConstraints
      .map(
        c =>
          `${c.constraintId}:${c.componentA}:${c.componentB}:${c.constraintType}:${c.parameters.offsetMm ?? 0}:${c.parameters.angleDeg ?? 0}:${c.suppressed}:${c.enabled}`
      )
      .join('|');

    const componentPoseHash = crypto.createHash('sha256').update(poseString).digest('hex');
    const constraintSetHash = crypto.createHash('sha256').update(constraintString).digest('hex');

    return { constraintSetHash, componentPoseHash };
  }

  private static posesToRecord(components: AssemblyComponentPose[]): Record<string, AssemblyComponentPose> {
    const record: Record<string, AssemblyComponentPose> = {};
    for (const c of components) {
      record[c.instanceId] = c;
    }
    return record;
  }
}
