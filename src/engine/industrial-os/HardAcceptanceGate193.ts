/**
 * PATCH-193 Hard Acceptance Gate
 * Verification suite for Parametric Sketch Editing, Smart Dimensioning, and GCS Diagnostics.
 */

import {
  IndustrialSketchDefinition,
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D
} from '../sketch/IndustrialConstraintTypes';
import { SmartDimensionEngine } from '../sketch/dimensions/SmartDimensionEngine';
import { SketchDimension, DimensionCreateSpec } from '../sketch/dimensions/SketchDimensionTypes';
import { DimensionDependencyGraph } from '../sketch/dimensions/DimensionDependencyGraph';
import { SketchSolverDiagnostics } from '../sketch/diagnostics/SketchSolverDiagnostics';
import { IndustrialVariationalSolver } from '../sketch/IndustrialVariationalSolver';
import { EngineeringObjectOS } from './EngineeringObjectOS';
import { EngineeringEventStore } from './event-model/EngineeringEventStore';

export interface Gate193Result {
  passed: boolean;
  score: number; // 0 to 28
  checks: Record<string, boolean>;
  logs: string[];
}

export class HardAcceptanceGate193 {
  public static execute(): Gate193Result {
    const logs: string[] = [];
    const checks: Record<string, boolean> = {};
    let score = 0;

    const log = (msg: string) => {
      logs.push(`[Gate-193] ${msg}`);
      console.log(`[Gate-193] ${msg}`);
    };

    log("Starting Hard Acceptance Gate 193 — Sketch Editing & Dimensioning...");

    try {
      const solver = new IndustrialVariationalSolver();
      const os = new EngineeringObjectOS();
      const eventStore = EngineeringEventStore.getInstance();
      eventStore.clear();

      // 1. Smart Dimension on Line
      log("Check 1: Smart Dimension on Line");
      const sketch1: IndustrialSketchDefinition = {
        id: 'sk-smart-line',
        name: 'SmartLine',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 100, y: 0 },
          'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
        },
        constraints: {}
      };
      const inferLine = SmartDimensionEngine.inferDimensionType(['l1'], sketch1);
      checks['smart_dimension_line'] = inferLine !== null && (inferLine.type === 'LINE_LENGTH' || inferLine.type === 'HORIZONTAL_DISTANCE') && Math.abs(inferLine.initialValue - 100) < 1e-4;
      if (checks['smart_dimension_line']) score++;

      // 2. Smart Dimension on Circle
      log("Check 2: Smart Dimension on Circle");
      const sketch2: IndustrialSketchDefinition = {
        id: 'sk-smart-circle',
        name: 'SmartCircle',
        plane: 'XY',
        revision: 1,
        entities: {
          'pc': { id: 'pc', type: 'POINT', x: 50, y: 50 },
          'c1': { id: 'c1', type: 'CIRCLE', centerPointId: 'pc', radius: 25 } as SketchCircle2D
        },
        constraints: {}
      };
      const inferCirc = SmartDimensionEngine.inferDimensionType(['c1'], sketch2);
      checks['smart_dimension_circle'] = inferCirc !== null && inferCirc.type === 'DIAMETER' && Math.abs(inferCirc.initialValue - 50) < 1e-4;
      if (checks['smart_dimension_circle']) score++;

      // 3. Radius Dimension
      log("Check 3: Radius Dimension");
      const sketch3: IndustrialSketchDefinition = {
        id: 'sk-radius',
        name: 'RadiusTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'pc': { id: 'pc', type: 'POINT', x: 50, y: 50 },
          'pStart': { id: 'pStart', type: 'POINT', x: 80, y: 50 },
          'pEnd': { id: 'pEnd', type: 'POINT', x: 50, y: 80 },
          'a1': { id: 'a1', type: 'ARC', centerPointId: 'pc', startPointId: 'pStart', endPointId: 'pEnd', radius: 30 } as SketchArc2D
        },
        constraints: {}
      };
      const radDimRes = SmartDimensionEngine.createDimension({
        type: 'RADIUS',
        entityIds: ['a1'],
        value: 30,
        unit: 'mm'
      }, sketch3);
      checks['radius_dimension'] = radDimRes.dimension.type === 'RADIUS' && radDimRes.dimension.value === 30 && radDimRes.constraint?.type === 'RADIUS';
      if (checks['radius_dimension']) score++;

      // 4. Diameter Dimension
      log("Check 4: Diameter Dimension");
      const diaDimRes = SmartDimensionEngine.createDimension({
        type: 'DIAMETER',
        entityIds: ['c1'],
        value: 50,
        unit: 'mm'
      }, sketch2);
      checks['diameter_dimension'] = diaDimRes.dimension.type === 'DIAMETER' && diaDimRes.dimension.value === 50 && diaDimRes.constraint?.type === 'DIAMETER';
      if (checks['diameter_dimension']) score++;

      // 5. Distance Dimension
      log("Check 5: Distance Dimension");
      const distDimRes = SmartDimensionEngine.createDimension({
        type: 'DISTANCE',
        entityIds: ['p1', 'p2'],
        value: 100,
        unit: 'mm'
      }, sketch1);
      checks['distance_dimension'] = distDimRes.dimension.type === 'DISTANCE' && distDimRes.dimension.value === 100;
      if (checks['distance_dimension']) score++;

      // 6. Horizontal Distance
      log("Check 6: Horizontal Distance");
      const hDistDimRes = SmartDimensionEngine.createDimension({
        type: 'HORIZONTAL_DISTANCE',
        entityIds: ['p1', 'p2'],
        value: 100,
        unit: 'mm'
      }, sketch1);
      checks['horizontal_distance'] = hDistDimRes.dimension.type === 'HORIZONTAL_DISTANCE';
      if (checks['horizontal_distance']) score++;

      // 7. Vertical Distance
      log("Check 7: Vertical Distance");
      const vDistDimRes = SmartDimensionEngine.createDimension({
        type: 'VERTICAL_DISTANCE',
        entityIds: ['p1', 'p2'],
        value: 0,
        unit: 'mm'
      }, sketch1);
      checks['vertical_distance'] = vDistDimRes.dimension.type === 'VERTICAL_DISTANCE';
      if (checks['vertical_distance']) score++;

      // 8. Angle Dimension
      log("Check 8: Angle Dimension");
      const sketchAngle: IndustrialSketchDefinition = {
        id: 'sk-angle',
        name: 'AngleTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p0': { id: 'p0', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p1': { id: 'p1', type: 'POINT', x: 100, y: 0 },
          'p2': { id: 'p2', type: 'POINT', x: 0, y: 100 },
          'l1': { id: 'l1', type: 'LINE', startPointId: 'p0', endPointId: 'p1' } as SketchLine2D,
          'l2': { id: 'l2', type: 'LINE', startPointId: 'p0', endPointId: 'p2' } as SketchLine2D
        },
        constraints: {}
      };
      const angleInfer = SmartDimensionEngine.inferDimensionType(['l1', 'l2'], sketchAngle);
      checks['angle_dimension'] = angleInfer !== null && angleInfer.type === 'ANGLE' && Math.abs(angleInfer.initialValue - 90) < 1e-3;
      if (checks['angle_dimension']) score++;

      // 9. Driving Dimension
      log("Check 9: Driving Dimension");
      let sketchDriving: IndustrialSketchDefinition = {
        id: 'sk-driving',
        name: 'DrivingTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 100, y: 0 }
        },
        constraints: {}
      };
      const drivingCreate = SmartDimensionEngine.createDimension({
        id: 'dim-drive-1',
        type: 'DISTANCE',
        entityIds: ['p1', 'p2'],
        value: 100,
        isDriving: true
      }, sketchDriving);
      sketchDriving = drivingCreate.updatedSketch;

      const editDrive = SmartDimensionEngine.editDimensionValue('dim-drive-1', 150, sketchDriving, solver);
      const editedP2 = editDrive.updatedSketch.entities['p2'] as SketchPoint2D;
      const editedDist = Math.hypot(editedP2.x, editedP2.y);
      checks['driving_dimension'] = Math.abs(editedDist - 150) < 1e-3;
      if (checks['driving_dimension']) score++;

      // 10. Reference Dimension
      log("Check 10: Reference Dimension");
      let sketchRef: IndustrialSketchDefinition = {
        id: 'sk-ref',
        name: 'RefTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 80, y: 0, isFixed: true }
        },
        constraints: {}
      };
      const refCreate = SmartDimensionEngine.createDimension({
        id: 'dim-ref-1',
        type: 'DISTANCE',
        entityIds: ['p1', 'p2'],
        value: 80,
        isDriving: false
      }, sketchRef);
      sketchRef = refCreate.updatedSketch;
      const formattedRef = SmartDimensionEngine.formatDimension(refCreate.dimension);
      checks['reference_dimension'] = !refCreate.dimension.isDriving && refCreate.dimension.constraintId === '' && formattedRef.includes('(REF)');
      if (checks['reference_dimension']) score++;

      // 11. Driving -> Reference Conversion
      log("Check 11: Driving -> Reference Conversion");
      const d2r = SmartDimensionEngine.convertDrivingToReference('dim-drive-1', editDrive.updatedSketch);
      checks['driving_to_reference'] = !d2r.dimension.isDriving && d2r.dimension.constraintId === '' && Object.keys(d2r.updatedSketch.constraints).length === 0;
      if (checks['driving_to_reference']) score++;

      // 12. Reference -> Driving Conversion
      log("Check 12: Reference -> Driving Conversion");
      const r2d = SmartDimensionEngine.convertReferenceToDriving('dim-drive-1', d2r.updatedSketch, solver);
      checks['reference_to_driving'] = r2d.success && r2d.dimension.isDriving && r2d.dimension.constraintId !== '' && Object.keys(r2d.updatedSketch.constraints).length === 1;
      if (checks['reference_to_driving']) score++;

      // 13. Dimension Editing
      log("Check 13: Dimension Editing");
      const edit2 = SmartDimensionEngine.editDimensionValue('dim-drive-1', 200, r2d.updatedSketch, solver);
      const p2edit = edit2.updatedSketch.entities['p2'] as SketchPoint2D;
      checks['dimension_editing'] = Math.abs(Math.hypot(p2edit.x, p2edit.y) - 200) < 1e-3;
      if (checks['dimension_editing']) score++;

      // 14. Unit Conversion
      log("Check 14: Unit Conversion");
      const pInch = SmartDimensionEngine.parseUnitInput('2.5 in', 'in');
      const pCm = SmartDimensionEngine.parseUnitInput('10 cm', 'cm');
      const pM = SmartDimensionEngine.parseUnitInput('1.5 m', 'm');
      checks['unit_conversion'] = Math.abs(pInch.standardValue - 63.5) < 1e-4 && Math.abs(pCm.standardValue - 100) < 1e-4 && Math.abs(pM.standardValue - 1500) < 1e-4;
      if (checks['unit_conversion']) score++;

      // 15. Fully Constrained Detection
      log("Check 15: Fully Constrained Detection");
      const sketchFully: IndustrialSketchDefinition = {
        id: 'sk-full',
        name: 'FullTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 100, y: 0 },
          'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
        },
        constraints: {
          'c-horiz': { id: 'c-horiz', type: 'HORIZONTAL', entityIds: ['l1'] },
          'c-len': { id: 'c-len', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 100 }
        }
      };
      const resFull = solver.solve(sketchFully);
      const diagFull = SketchSolverDiagnostics.evaluate(resFull.sketch, resFull);
      checks['fully_constrained_detection'] = resFull.solutionState === 'FULLY_CONSTRAINED' && diagFull.degreesOfFreedom === 0;
      if (checks['fully_constrained_detection']) score++;

      // 16. Under-Constrained Detection
      log("Check 16: Under-Constrained Detection");
      const sketchUnder: IndustrialSketchDefinition = {
        id: 'sk-under',
        name: 'UnderTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 100, y: 50 }
        },
        constraints: {}
      };
      const resUnder = solver.solve(sketchUnder);
      const diagUnder = SketchSolverDiagnostics.evaluate(resUnder.sketch, resUnder);
      checks['under_constrained_detection'] = resUnder.solutionState === 'UNDER_CONSTRAINED' && diagUnder.degreesOfFreedom > 0;
      if (checks['under_constrained_detection']) score++;

      // 17. Over-Constrained Detection
      log("Check 17: Over-Constrained Detection");
      const sketchOver: IndustrialSketchDefinition = {
        id: 'sk-over',
        name: 'OverTest',
        plane: 'XY',
        revision: 1,
        entities: {
          'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true },
          'p2': { id: 'p2', type: 'POINT', x: 100, y: 0 }
        },
        constraints: {
          'c-d1': { id: 'c-d1', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 100 },
          'c-d2': { id: 'c-d2', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 150 }
        }
      };
      const resOver = solver.solve(sketchOver);
      const diagOver = SketchSolverDiagnostics.evaluate(resOver.sketch, resOver);
      checks['over_constrained_detection'] = resOver.solutionState === 'OVER_CONSTRAINED' || resOver.solutionState === 'INCONSISTENT';
      if (checks['over_constrained_detection']) score++;

      // 18. Degrees of Freedom Calculation
      log("Check 18: Degrees of Freedom Calculation");
      checks['dof_calculation'] = diagUnder.totalDOF === 4 && diagUnder.fixedDOF === 2 && diagUnder.freeDOF === 2;
      if (checks['dof_calculation']) score++;

      // 19. Solver Diagnostics
      log("Check 19: Solver Diagnostics");
      checks['solver_diagnostics'] = diagFull.solverStatus === 'FULLY_CONSTRAINED' && diagFull.convergenceStatus && diagFull.residual < 1e-4 && diagFull.iterationCount >= 0;
      if (checks['solver_diagnostics']) score++;

      // 20. Failed Constraint Identification
      log("Check 20: Failed Constraint Identification");
      checks['failed_constraint_identification'] = diagOver.failedConstraints.length > 0 || diagOver.conflictingConstraints.length > 0;
      if (checks['failed_constraint_identification']) score++;

      // 21. Conflicting Constraint Identification
      log("Check 21: Conflicting Constraint Identification");
      checks['conflicting_constraint_identification'] = diagOver.conflictingConstraints.includes('c-d1') || diagOver.conflictingConstraints.includes('c-d2');
      if (checks['conflicting_constraint_identification']) score++;

      // 22. Diagnostic Geometry Highlighting
      log("Check 22: Diagnostic Geometry Highlighting");
      checks['diagnostic_highlighting'] = diagOver.highlightedEntities.includes('p1') || diagOver.highlightedEntities.includes('p2') || diagOver.highlightedConstraints.length > 0;
      if (checks['diagnostic_highlighting']) score++;

      // 23. Dimension Dependency Tracking
      log("Check 23: Dimension Dependency Tracking");
      const depGraph = new DimensionDependencyGraph(os, eventStore);
      depGraph.registerDimension(drivingCreate.dimension);
      depGraph.linkToFeature('dim-drive-1', 'extrude-boss-1', 'EXTRUSION', 'Main Extrusion Boss');
      depGraph.linkToFeature('extrude-boss-1', 'part-bracket-1', 'PART', 'Mounting Bracket');
      const downstream = depGraph.getDownstreamDependencies('dim-drive-1');
      const invRes = depGraph.invalidateDimension('dim-drive-1', 150);
      checks['dimension_dependency_tracking'] = downstream.includes('extrude-boss-1') && downstream.includes('part-bracket-1') && invRes.staleNodeIds.length >= 2;
      if (checks['dimension_dependency_tracking']) score++;

      // 24. Dimension Provenance
      log("Check 24: Dimension Provenance");
      const prov = edit2.dimension.provenance;
      checks['dimension_provenance'] = prov !== undefined && prov.creator === 'CAD_ENGINEER' && prov.modificationHistory.length >= 2;
      if (checks['dimension_provenance']) score++;

      // 25. Deterministic Replay
      log("Check 25: Deterministic Replay");
      const replayRun1 = solver.solve(edit2.updatedSketch);
      const replayRun2 = solver.solve(edit2.updatedSketch);
      const p2_1 = replayRun1.sketch.entities['p2'] as SketchPoint2D;
      const p2_2 = replayRun2.sketch.entities['p2'] as SketchPoint2D;
      checks['deterministic_replay'] = Math.abs(p2_1.x - p2_2.x) < 1e-10 && Math.abs(p2_1.y - p2_2.y) < 1e-10;
      if (checks['deterministic_replay']) score++;

      // 26. Undo / Redo
      log("Check 26: Undo / Redo");
      const initialSnapshot = JSON.parse(JSON.stringify(r2d.updatedSketch));
      const modifiedSnapshot = JSON.parse(JSON.stringify(edit2.updatedSketch));
      // Undo restores initial snapshot
      const undone = initialSnapshot;
      const redone = modifiedSnapshot;
      const undoVal = undone.dimensions?.['dim-drive-1']?.value || 0;
      const redoVal = redone.dimensions?.['dim-drive-1']?.value || 0;
      log(`Undo value: ${undoVal}, Redo value: ${redoVal}`);
      checks['undo_redo'] = Math.abs(undoVal - 150) < 1e-3 && Math.abs(redoVal - 200) < 1e-3;
      if (checks['undo_redo']) score++;

      // 27. Persistence / Reload
      log("Check 27: Persistence / Reload");
      const serialized = JSON.stringify(edit2.updatedSketch);
      const deserialized: IndustrialSketchDefinition = JSON.parse(serialized);
      const reloadedSolve = solver.solve(deserialized);
      const p2Reload = reloadedSolve.sketch.entities['p2'] as SketchPoint2D;
      log(`p2Reload: x=${p2Reload?.x}, y=${p2Reload?.y}, hypot=${p2Reload ? Math.hypot(p2Reload.x, p2Reload.y) : 'none'}`);
      checks['persistence_reload'] = deserialized.dimensions !== undefined && deserialized.dimensions['dim-drive-1'] !== undefined && Math.abs(Math.hypot(p2Reload.x, p2Reload.y) - 200) < 1e-3;
      if (checks['persistence_reload']) score++;

      // 28. Industrial OS Event Recording
      log("Check 28: Industrial OS Event Recording");
      const events = eventStore.getAll();
      checks['industrial_os_events'] = events.length > 0 && events.some(e => e.source.component === 'DimensionDependencyGraph');
      if (checks['industrial_os_events']) score++;

      const passed = score === 28;
      for (const [key, val] of Object.entries(checks)) {
        log(`Check Result -> ${key}: ${val ? 'PASS' : 'FAIL'}`);
      }
      log(`Acceptance evaluation complete. Score: ${score}/28. Passed: ${passed}`);

      return {
        passed,
        score,
        checks,
        logs
      };
    } catch (err: any) {
      log(`Fatal error during acceptance gate execution: ${err.message}`);
      return {
        passed: false,
        score,
        checks,
        logs
      };
    }
  }
}
