/**
 * SECP CAD Kernel — Sketch Solver Diagnostics Engine
 * PATCH-193: Parametric Sketch Editing & Dimensioning
 */

import {
  IndustrialSketchDefinition,
  SolverSolutionState,
  SketchPoint2D,
  Vector2D
} from '../IndustrialConstraintTypes';
import { SolveResult } from '../IndustrialVariationalSolver';

export interface DiagnosticMarker {
  id: string;
  type: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  position: Vector2D;
  entityId?: string;
  constraintId?: string;
}

export interface SolverDiagnosticReport {
  solverStatus: SolverSolutionState;
  convergenceStatus: boolean;
  iterationCount: number;
  residual: number;
  degreesOfFreedom: number;
  totalDOF: number;
  freeDOF: number;
  fixedDOF: number;
  constraintCount: number;
  activeConstraints: string[];
  failedConstraints: string[];
  conflictingConstraints: string[];
  redundantConstraints: string[];
  solveTimeMs: number;
  numericalWarnings: string[];
  explanation: string;
  diagnosticMarkers: DiagnosticMarker[];
  highlightedEntities: string[];
  highlightedConstraints: string[];
}

export class SketchSolverDiagnostics {
  public static evaluate(
    sketch: IndustrialSketchDefinition,
    solveResult?: SolveResult
  ): SolverDiagnosticReport {
    const entities = sketch.entities;
    const constraints = sketch.constraints;

    let totalDOF = 0;
    let fixedDOF = 0;

    for (const ent of Object.values(entities)) {
      if (ent.type === 'POINT') {
        const pt = ent as SketchPoint2D;
        totalDOF += 2;
        if (pt.isFixed) {
          fixedDOF += 2;
        }
      } else if (ent.type === 'LINE') {
        // Line has 2 points referenced, internal geometry degree is 4 if points not shared
        totalDOF += 0; // Points already account for DOF
      } else if (ent.type === 'CIRCLE') {
        totalDOF += 1; // Radius
      } else if (ent.type === 'ARC') {
        totalDOF += 1; // Radius
      }
    }

    const activeConstraints = Object.keys(constraints).filter(
      id => constraints[id].suppressionState !== 'SUPPRESSED'
    );

    const solverStatus: SolverSolutionState = solveResult
      ? solveResult.solutionState
      : 'UNDER_CONSTRAINED';
    const convergenceStatus = solveResult
      ? (solverStatus === 'FULLY_CONSTRAINED' || solverStatus === 'UNDER_CONSTRAINED' || solverStatus === 'SOLVED') && solveResult.maxResidual < 1e-2
      : true;
    const iterationCount = solveResult ? solveResult.iterations : 0;
    const residual = solveResult ? solveResult.maxResidual : 0;
    const solveTimeMs = solveResult ? solveResult.incrementalStats.solveTimeMs : 0;

    const conflictingConstraints = solveResult ? solveResult.dofReport.conflictingConstraintIds : [];
    const redundantConstraints = solveResult ? solveResult.dofReport.redundantConstraintIds : [];
    const failedConstraints: string[] = [];

    if (!convergenceStatus && solverStatus !== 'UNDER_CONSTRAINED') {
      failedConstraints.push(...conflictingConstraints);
      if (failedConstraints.length === 0 && activeConstraints.length > 0) {
        failedConstraints.push(activeConstraints[activeConstraints.length - 1]);
      }
    }

    const remainingDOF = solveResult
      ? solveResult.dofReport.remainingDegreesOfFreedom
      : Math.max(0, totalDOF - fixedDOF - activeConstraints.length);
    const freeDOF = remainingDOF;

    const numericalWarnings: string[] = [];
    if (residual > 1e-3 && convergenceStatus) {
      numericalWarnings.push(`Residual ${residual.toExponential(2)} is near numerical tolerance boundary.`);
    }
    if (iterationCount > 40) {
      numericalWarnings.push(`Solver took ${iterationCount} iterations to converge, approaching max limit.`);
    }

    // Determine Explanation
    let explanation = '';
    if (solverStatus === 'FULLY_CONSTRAINED') {
      explanation = 'System is fully constrained (0 DOF). Geometric solution is unique and deterministic.';
    } else if (solverStatus === 'UNDER_CONSTRAINED') {
      explanation = `System has ${remainingDOF} degrees of freedom remaining. Free entities can be dragged or dimensioned.`;
    } else if (solverStatus === 'OVER_CONSTRAINED') {
      explanation = `System is over-constrained. Redundant or conflicting constraints detected: [${[...conflictingConstraints, ...redundantConstraints].join(', ')}].`;
    } else if (solverStatus === 'INCONSISTENT') {
      explanation = `System is mathematically inconsistent or unsolvable. Constraints [${conflictingConstraints.join(', ')}] cannot be satisfied simultaneously.`;
    } else {
      explanation = `Solver status: ${solverStatus}.`;
    }

    // Generate Diagnostic Markers & Highlighting
    const diagnosticMarkers: DiagnosticMarker[] = [];
    const highlightedEntities = new Set<string>();
    const highlightedConstraints = new Set<string>();

    // Mark Conflicting Constraints
    for (const cId of conflictingConstraints) {
      highlightedConstraints.add(cId);
      const c = constraints[cId];
      if (c) {
        c.entityIds.forEach(eId => highlightedEntities.add(eId));
        // Find position of marker
        let markerPos: Vector2D = { x: 50, y: 50 };
        for (const eId of c.entityIds) {
          const ent = entities[eId];
          if (ent && ent.type === 'POINT') {
            markerPos = { x: (ent as SketchPoint2D).x, y: (ent as SketchPoint2D).y };
            break;
          }
        }
        diagnosticMarkers.push({
          id: `marker-${cId}`,
          type: 'ERROR',
          message: `Conflicting constraint (${c.type}): ${cId}`,
          position: markerPos,
          constraintId: cId
        });
      }
    }

    // Mark Redundant Constraints
    for (const rId of redundantConstraints) {
      highlightedConstraints.add(rId);
      const c = constraints[rId];
      if (c) {
        c.entityIds.forEach(eId => highlightedEntities.add(eId));
        diagnosticMarkers.push({
          id: `marker-red-${rId}`,
          type: 'WARNING',
          message: `Redundant constraint (${c.type}): ${rId}`,
          position: { x: 0, y: 0 },
          constraintId: rId
        });
      }
    }

    return {
      solverStatus,
      convergenceStatus,
      iterationCount,
      residual,
      degreesOfFreedom: remainingDOF,
      totalDOF,
      freeDOF,
      fixedDOF,
      constraintCount: activeConstraints.length,
      activeConstraints,
      failedConstraints,
      conflictingConstraints,
      redundantConstraints,
      solveTimeMs,
      numericalWarnings,
      explanation,
      diagnosticMarkers,
      highlightedEntities: Array.from(highlightedEntities),
      highlightedConstraints: Array.from(highlightedConstraints)
    };
  }
}
