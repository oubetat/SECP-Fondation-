/**
 * PATCH-SECP-043 — Assembly Constraint Solver
 * Handles:
 *  - Constraint Graph Construction
 *  - Degrees of Freedom (DOF) Analysis (Tx, Ty, Tz, Rx, Ry, Rz)
 *  - Constraint Resolution via Numerical Relaxation & Geometric Projections
 *  - Transform Matrix Updates
 *  - Status Differentiation: SOLVED, UNDER_CONSTRAINED, OVER_CONSTRAINED, CONFLICTING, INVALID
 *  - Real Geometric References & Signature Verification
 */

import { Vector3D } from '../cadKernel';
import {
  AssemblyComponent,
  AssemblyConstraint,
  AssemblyConstraintType,
  ComponentDOF,
  AssemblySolverReport,
  SolverOutcomeStatus,
  computeTransformMatrix,
  GeometryReference
} from './AssemblyConstraintTypes';
import { AssemblyDOFAnalyzer } from './AssemblyDOFAnalyzer';

export class AssemblyConstraintSolver {
  private static readonly MAX_ITERATIONS = 60;
  private static readonly DEFAULT_TOLERANCE = 1e-4;

  /**
   * Evaluates the Degrees of Freedom (DOF) for every component in the assembly
   */
  public static calculateDegreesOfFreedom(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[]
  ): {
    componentDofs: Record<string, ComponentDOF>;
    totalAssemblyDof: number;
    diagnostics: string[];
  } {
    const report = AssemblyDOFAnalyzer.analyze(components, constraints);
    
    const componentDofs: Record<string, ComponentDOF> = {};
    components.forEach(comp => {
      const state = report.componentDOFStates.find(s => s.occurrenceId === comp.instanceId);
      if (!state) return;
      
      componentDofs[comp.instanceId] = {
        instanceId: comp.instanceId,
        isFixed: comp.fixed,
        translation: {
          tx: state.translational.x,
          ty: state.translational.y,
          tz: state.translational.z
        },
        rotation: {
          rx: state.rotational.x,
          ry: state.rotational.y,
          rz: state.rotational.z
        },
        remainingDofCount: state.remainingDOF,
        activeConstraintIds: constraints
          .filter(c => c.componentA === comp.instanceId || c.componentB === comp.instanceId)
          .map(c => c.constraintId),
        statusMessage: state.status === 'FULLY_CONSTRAINED'
          ? 'Fully Constrained (0 DOF)'
          : `Partially Constrained (${state.remainingDOF} DOF remaining: ${state.freeAxes.join(', ')})`
      };
    });

    return {
      componentDofs,
      totalAssemblyDof: report.freeDOF,
      diagnostics: report.diagnostics
    };
  }

  /**
   * Solves all assembly constraints iteratively with numerical relaxation
   */
  public static solve(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[]
  ): AssemblySolverReport {
    const diagnostics: string[] = [];
    diagnostics.push('[Solver] Initializing Assembly Constraint Solver...');

    const activeComponents = components.filter(c => !c.suppressed);
    const activeConstraints = constraints.filter(c => {
      const compA = components.find(cmp => cmp.instanceId === c.componentA);
      const compB = components.find(cmp => cmp.instanceId === c.componentB);
      return compA && compB && !compA.suppressed && !compB.suppressed;
    });

    // 1. Validation check for missing components or empty assembly
    if (activeComponents.length === 0) {
      return {
        status: 'SOLVED',
        satisfiedConstraintsCount: 0,
        totalActiveConstraintsCount: 0,
        iterationsTaken: 0,
        convergenceResidual: 0,
        totalAssemblyDof: 0,
        componentDofs: {},
        diagnostics: ['[Solver] Empty assembly, zero constraints.'],
        solvedTimestamp: new Date().toISOString(),
        isDeterministic: true
      };
    }

    // Check for invalid references
    for (const c of activeConstraints) {
      const compA = activeComponents.find(cmp => cmp.instanceId === c.componentA);
      const compB = activeComponents.find(cmp => cmp.instanceId === c.componentB);
      if (!compA || !compB) {
        diagnostics.push(`[Solver-Error] Constraint ${c.constraintId} references invalid component.`);
        return {
          status: 'INVALID',
          satisfiedConstraintsCount: 0,
          totalActiveConstraintsCount: activeConstraints.length,
          iterationsTaken: 0,
          convergenceResidual: 1.0,
          totalAssemblyDof: activeComponents.length * 6,
          componentDofs: {},
          diagnostics,
          solvedTimestamp: new Date().toISOString(),
          isDeterministic: true
        };
      }
    }

    // 2. Conflict detection (pairwise analysis)
    for (let i = 0; i < activeConstraints.length; i++) {
      const c1 = activeConstraints[i];
      for (let j = i + 1; j < activeConstraints.length; j++) {
        const c2 = activeConstraints[j];
        const samePair = (c1.componentA === c2.componentA && c1.componentB === c2.componentB) ||
                         (c1.componentA === c2.componentB && c1.componentB === c2.componentA);

        if (samePair) {
          // Direct contradiction of distance offsets
          if (c1.type === 'DISTANCE' && c2.type === 'DISTANCE') {
            const off1 = c1.parameters.offsetMm ?? 0;
            const off2 = c2.parameters.offsetMm ?? 0;
            if (Math.abs(off1 - off2) > 1e-4) {
              c1.status = 'CONFLICTING';
              c2.status = 'CONFLICTING';
              diagnostics.push(`[Solver-Conflict] Conflicting distance constraints between ${c1.componentA} and ${c1.componentB}: ${off1}mm vs ${off2}mm.`);
              return this.createReport('CONFLICTING', activeConstraints, 0, 1.0, components, diagnostics);
            }
          }

          // Coincident (Mate with 0 offset) vs Distance with non-zero offset
          if ((c1.type === 'MATE' && c2.type === 'DISTANCE' && (c2.parameters.offsetMm ?? 0) !== 0) ||
              (c2.type === 'MATE' && c1.type === 'DISTANCE' && (c1.parameters.offsetMm ?? 0) !== 0)) {
            c1.status = 'CONFLICTING';
            c2.status = 'CONFLICTING';
            diagnostics.push(`[Solver-Conflict] Coincident Mate conflicts with non-zero Distance offset.`);
            return this.createReport('CONFLICTING', activeConstraints, 0, 1.0, components, diagnostics);
          }

          // Parallel vs Perpendicular on same feature pair
          if ((c1.type === 'PARALLEL' && c2.type === 'PERPENDICULAR') ||
              (c2.type === 'PARALLEL' && c1.type === 'PERPENDICULAR')) {
            c1.status = 'CONFLICTING';
            c2.status = 'CONFLICTING';
            diagnostics.push(`[Solver-Conflict] Parallel and Perpendicular constraints mutually exclusive on same pair.`);
            return this.createReport('CONFLICTING', activeConstraints, 0, 1.0, components, diagnostics);
          }
        }
      }
    }

    // 3. Grounding & Connectivity graph check
    const groundedComponents = activeComponents.filter(c => c.fixed);
    if (activeComponents.length > 1 && groundedComponents.length === 0) {
      diagnostics.push('[Solver-Warning] No grounded/fixed component found. Assembly may float freely.');
    }

    // 4. Reset/Initialize worldTransforms from placementTransforms before solving
    for (const comp of activeComponents) {
      comp.worldTransform = {
        position: { ...comp.placementTransform.position },
        rotation: { ...comp.placementTransform.rotation },
        scale: comp.placementTransform.scale ? { ...comp.placementTransform.scale } : { x: 1, y: 1, z: 1 },
        matrix: computeTransformMatrix(
          comp.placementTransform.position,
          comp.placementTransform.rotation,
          comp.placementTransform.scale
        )
      };
    }

    // 5. Iterative Numerical Relaxation Loop
    let iteration = 0;
    let maxResidual = Infinity;
    const tolerance = AssemblyConstraintSolver.DEFAULT_TOLERANCE;

    while (iteration < AssemblyConstraintSolver.MAX_ITERATIONS && maxResidual > tolerance) {
      iteration++;
      maxResidual = 0;

      for (const constraint of activeConstraints) {
        const compA = activeComponents.find(c => c.instanceId === constraint.componentA)!;
        const compB = activeComponents.find(c => c.instanceId === constraint.componentB)!;

        const isFixedA = compA.fixed;
        const isFixedB = compB.fixed;

        let error = 0;

        switch (constraint.type) {
          case 'MATE':
          case 'DISTANCE': {
            const targetOffset = constraint.type === 'MATE' ? 0 : (constraint.parameters.offsetMm ?? 0);
            
            const dx = compA.worldTransform.position.x - compB.worldTransform.position.x;
            const dy = compA.worldTransform.position.y - compB.worldTransform.position.y;
            const dz = compA.worldTransform.position.z - compB.worldTransform.position.z;
            const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            error = currentDist - targetOffset;
            maxResidual = Math.max(maxResidual, Math.abs(error));

            if (Math.abs(error) > tolerance) {
              const factor = 0.5;
              const ux = currentDist > 1e-9 ? dx / currentDist : 0;
              const uy = currentDist > 1e-9 ? dy / currentDist : 0;
              const uz = currentDist > 1e-9 ? dz / currentDist : 1;

              const cx = ux * error * factor;
              const cy = uy * error * factor;
              const cz = uz * error * factor;

              if (!isFixedA && isFixedB) {
                compA.worldTransform.position.x -= cx * 2;
                compA.worldTransform.position.y -= cy * 2;
                compA.worldTransform.position.z -= cz * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.position.x += cx * 2;
                compB.worldTransform.position.y += cy * 2;
                compB.worldTransform.position.z += cz * 2;
              } else if (!isFixedA && !isFixedB) {
                compA.worldTransform.position.x -= cx;
                compA.worldTransform.position.y -= cy;
                compA.worldTransform.position.z -= cz;
                compB.worldTransform.position.x += cx;
                compB.worldTransform.position.y += cy;
                compB.worldTransform.position.z += cz;
              }
            }
            break;
          }

          case 'CONCENTRIC': {
            // Align along Z axis, match X and Y positions
            const dx = compA.worldTransform.position.x - compB.worldTransform.position.x;
            const dy = compA.worldTransform.position.y - compB.worldTransform.position.y;
            const radialError = Math.sqrt(dx * dx + dy * dy);
            
            error = radialError;
            maxResidual = Math.max(maxResidual, Math.abs(error));

            if (radialError > tolerance) {
              const factor = 0.5;
              const cx = dx * factor;
              const cy = dy * factor;

              if (!isFixedA && isFixedB) {
                compA.worldTransform.position.x -= cx * 2;
                compA.worldTransform.position.y -= cy * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.position.x += cx * 2;
                compB.worldTransform.position.y += cy * 2;
              } else if (!isFixedA && !isFixedB) {
                compA.worldTransform.position.x -= cx;
                compA.worldTransform.position.y -= cy;
                compB.worldTransform.position.x += cx;
                compB.worldTransform.position.y += cy;
              }
            }
            break;
          }

          case 'ALIGN':
          case 'PARALLEL':
          case 'ANGLE': {
            const targetAngle = constraint.type === 'ANGLE' ? (constraint.parameters.angleDeg ?? 0) : 0;
            const diffRx = compA.worldTransform.rotation.x - compB.worldTransform.rotation.x - targetAngle;
            const diffRy = compA.worldTransform.rotation.y - compB.worldTransform.rotation.y;
            const diffRz = compA.worldTransform.rotation.z - compB.worldTransform.rotation.z;

            const angMag = Math.sqrt(diffRx * diffRx + diffRy * diffRy + diffRz * diffRz);
            error = angMag;
            maxResidual = Math.max(maxResidual, Math.abs(error));

            if (angMag > tolerance) {
              const factor = 0.5;
              const cx = diffRx * factor;
              const cy = diffRy * factor;
              const cz = diffRz * factor;

              if (!isFixedA && isFixedB) {
                compA.worldTransform.rotation.x -= cx * 2;
                compA.worldTransform.rotation.y -= cy * 2;
                compA.worldTransform.rotation.z -= cz * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.rotation.x += cx * 2;
                compB.worldTransform.rotation.y += cy * 2;
                compB.worldTransform.rotation.z += cz * 2;
              } else if (!isFixedA && !isFixedB) {
                compA.worldTransform.rotation.x -= cx;
                compA.worldTransform.rotation.y -= cy;
                compA.worldTransform.rotation.z -= cz;
                compB.worldTransform.rotation.x += cx;
                compB.worldTransform.rotation.y += cy;
                compB.worldTransform.rotation.z += cz;
              }
            }
            break;
          }

          case 'PERPENDICULAR': {
            // Target angle 90 degrees on Z
            const diffRz = Math.abs(compA.worldTransform.rotation.z - compB.worldTransform.rotation.z) - 90;
            error = Math.abs(diffRz);
            maxResidual = Math.max(maxResidual, error);

            if (error > tolerance) {
              const factor = 0.5;
              const cz = diffRz * factor;
              if (!isFixedA && isFixedB) {
                compA.worldTransform.rotation.z -= cz * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.rotation.z += cz * 2;
              } else if (!isFixedA && !isFixedB) {
                compA.worldTransform.rotation.z -= cz;
                compB.worldTransform.rotation.z += cz;
              }
            }
            break;
          }

          case 'LOCK': {
            const dx = compA.worldTransform.position.x - compB.worldTransform.position.x;
            const dy = compA.worldTransform.position.y - compB.worldTransform.position.y;
            const dz = compA.worldTransform.position.z - compB.worldTransform.position.z;
            error = Math.sqrt(dx * dx + dy * dy + dz * dz);
            maxResidual = Math.max(maxResidual, error);

            if (error > tolerance) {
              if (!isFixedA && isFixedB) {
                compA.worldTransform.position = { ...compB.worldTransform.position };
                compA.worldTransform.rotation = { ...compB.worldTransform.rotation };
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.position = { ...compA.worldTransform.position };
                compB.worldTransform.rotation = { ...compA.worldTransform.rotation };
              }
            }
            break;
          }

          case 'INSERT': {
            // INSERT = CONCENTRIC + MATE (simplified)
            const dx = compA.worldTransform.position.x - compB.worldTransform.position.x;
            const dy = compA.worldTransform.position.y - compB.worldTransform.position.y;
            const dz = compA.worldTransform.position.z - compB.worldTransform.position.z;
            error = Math.sqrt(dx * dx + dy * dy + dz * dz);
            maxResidual = Math.max(maxResidual, error);

            if (error > tolerance) {
              const factor = 0.5;
              if (!isFixedA && isFixedB) {
                compA.worldTransform.position.x -= dx * factor * 2;
                compA.worldTransform.position.y -= dy * factor * 2;
                compA.worldTransform.position.z -= dz * factor * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.position.x += dx * factor * 2;
                compB.worldTransform.position.y += dy * factor * 2;
                compB.worldTransform.position.z += dz * factor * 2;
              }
            }
            break;
          }

          case 'TANGENT': {
            // Simplified tangent: distance equal to radius sum (simplified for sim)
            const dx = compA.worldTransform.position.x - compB.worldTransform.position.x;
            const dy = compA.worldTransform.position.y - compB.worldTransform.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const targetDist = 20; // Assume 20mm radius sum for sim
            error = Math.abs(dist - targetDist);
            maxResidual = Math.max(maxResidual, error);

            if (error > tolerance) {
              const factor = 0.5;
              const ux = dx / dist;
              const uy = dy / dist;
              const move = (dist - targetDist) * factor;

              if (!isFixedA && isFixedB) {
                compA.worldTransform.position.x -= ux * move * 2;
                compA.worldTransform.position.y -= uy * move * 2;
              } else if (isFixedA && !isFixedB) {
                compB.worldTransform.position.x += ux * move * 2;
                compB.worldTransform.position.y += uy * move * 2;
              }
            }
            break;
          }
        }

        constraint.solverError = error;
        constraint.status = error <= tolerance ? 'SATISFIED' : 'VIOLATED';

        // Recompute 4x4 matrix for both components
        compA.worldTransform.matrix = computeTransformMatrix(compA.worldTransform.position, compA.worldTransform.rotation, compA.worldTransform.scale);
        compB.worldTransform.matrix = computeTransformMatrix(compB.worldTransform.position, compB.worldTransform.rotation, compB.worldTransform.scale);
      }
    }

    // 6. DOF calculation and status evaluation
    const { componentDofs, totalAssemblyDof, diagnostics: dofDiag } = this.calculateDegreesOfFreedom(activeComponents, activeConstraints);
    diagnostics.push(...dofDiag);

    // Over-constrained check
    let isOverConstrained = false;
    for (const comp of activeComponents) {
      if (comp.fixed) continue;
      const compConstraints = activeConstraints.filter(c => c.componentA === comp.instanceId || c.componentB === comp.instanceId);
      let totalConstrainedDof = 0;
      for (const c of compConstraints) {
        if (c.type === 'LOCK') totalConstrainedDof += 6;
        else if (c.type === 'CONCENTRIC') totalConstrainedDof += 4;
        else if (c.type === 'MATE') totalConstrainedDof += 3;
        else if (c.type === 'PARALLEL' || c.type === 'ALIGN') totalConstrainedDof += 2;
        else if (c.type === 'DISTANCE' || c.type === 'ANGLE' || c.type === 'PERPENDICULAR') totalConstrainedDof += 1;
      }
      if (totalConstrainedDof > 6) {
        isOverConstrained = true;
      }
    }

    // Determine final status
    const allSatisfied = activeConstraints.every(c => c.status === 'SATISFIED');

    let status: SolverOutcomeStatus = 'SOLVED';
    if (!allSatisfied) {
      status = 'CONFLICTING';
    } else if (isOverConstrained) {
      status = 'OVER_CONSTRAINED';
      diagnostics.push('[Solver] Assembly is OVER_CONSTRAINED: Redundant constraints detected but geometrically consistent.');
    } else if (totalAssemblyDof > 0 && activeComponents.length > 1) {
      status = 'UNDER_CONSTRAINED';
      diagnostics.push(`[Solver] Assembly is UNDER_CONSTRAINED: ${totalAssemblyDof} total DOFs remaining.`);
    } else {
      status = 'SOLVED';
      diagnostics.push(`[Solver] Assembly SOLVED successfully in ${iteration} iterations. Residual: ${maxResidual.toExponential(4)}.`);
    }

    return {
      status,
      satisfiedConstraintsCount: activeConstraints.filter(c => c.status === 'SATISFIED').length,
      totalActiveConstraintsCount: activeConstraints.length,
      iterationsTaken: iteration,
      convergenceResidual: maxResidual,
      totalAssemblyDof,
      componentDofs,
      diagnostics,
      solvedTimestamp: new Date().toISOString(),
      isDeterministic: true
    };
  }

  private static createReport(
    status: SolverOutcomeStatus,
    constraints: AssemblyConstraint[],
    iterations: number,
    residual: number,
    components: AssemblyComponent[],
    diagnostics: string[]
  ): AssemblySolverReport {
    const { componentDofs, totalAssemblyDof } = this.calculateDegreesOfFreedom(components, constraints);
    return {
      status,
      satisfiedConstraintsCount: constraints.filter(c => c.status === 'SATISFIED').length,
      totalActiveConstraintsCount: constraints.length,
      iterationsTaken: iterations,
      convergenceResidual: residual,
      totalAssemblyDof,
      componentDofs,
      diagnostics,
      solvedTimestamp: new Date().toISOString(),
      isDeterministic: true
    };
  }

  /**
   * Verifies that a GeometricReference still points to valid and unchanged geometry
   * Prevents Topological Naming Failure
   */
  public static verifyGeometricReference(
    ref: GeometryReference,
    currentTopologyCount: number,
    currentSignature: string
  ): { valid: boolean; reason?: string } {
    if (!ref) return { valid: false, reason: 'Reference is null or undefined' };
    if (ref.topologyIndex < 0 || ref.topologyIndex >= currentTopologyCount) {
      return { valid: false, reason: `Topology index ${ref.topologyIndex} out of bounds (current count: ${currentTopologyCount})` };
    }
    if (ref.geometricSignature && currentSignature && ref.geometricSignature !== currentSignature) {
      return { valid: false, reason: `Geometric signature mismatch. Expected ${ref.geometricSignature}, found ${currentSignature}` };
    }
    return { valid: true };
  }
}
