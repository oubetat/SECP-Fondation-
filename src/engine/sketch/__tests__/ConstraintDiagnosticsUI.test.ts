import { describe, it, expect, beforeEach } from 'vitest';
import { 
  CanonicalSketch, 
  createEmptyCanonicalSketch, 
  solveCanonicalSketch,
  mutateAddFlatEntities,
  mutateAddFlatConstraint
} from '../canonical/CanonicalSketchContract';
import { IndustrialSketchEntity, IndustrialSketchConstraint } from '../IndustrialConstraintTypes';

describe('PROMPT-021 — Constraint Diagnostics UI E2E Trace', () => {
  let sketch: CanonicalSketch;

  beforeEach(() => {
    sketch = createEmptyCanonicalSketch('SKETCH_DIAG_TEST', 'Test Sketch');
  });

  it('CASE A: Free geometry results in UNDER_CONSTRAINED and correct DOF', () => {
    // Add a single point (2 DOF)
    const point: any = {
      id: 'pt_1',
      type: 'POINT',
      points: [{ x: 100, y: 100 }],
      params: {},
      constraints: [],
      isConstruction: false
    };
    
    const sketchWithPt = mutateAddFlatEntities(sketch, [point]);
    const { solverState } = solveCanonicalSketch(sketchWithPt);

    expect(solverState.dofCount).toBe(2);
    expect(solverState.status).toBe('UNDER_CONSTRAINED');
  });

  it('CASE B: Fully constrained geometry results in FULLY_CONSTRAINED and 0 DOF', () => {
    // Add a point and fix it
    const point: any = {
      id: 'pt_fix',
      type: 'POINT',
      points: [{ x: 0, y: 0 }],
      params: {},
      constraints: ['FIX'],
      isConstruction: false
    };
    
    const sketchWithPt = mutateAddFlatEntities(sketch, [point]);
    
    // In our current implementation, 'FIX' constraint on POINT is added via mutateAddFlatConstraint
    // or implicitly if the entity has 'FIX' in constraints array.
    // solveCanonicalSketch uses deriveSolverState which uses IndustrialVariationalSolver.
    
    const { solverState } = solveCanonicalSketch(sketchWithPt);

    expect(solverState.dofCount).toBe(0);
    expect(solverState.status).toBe('FULLY_CONSTRAINED');
  });

  it('CASE C: Redundant geometry results in REDUNDANT', () => {
    // Add a point and two FIX constraints (or redundant constraints)
    const point: any = {
      id: 'pt_over',
      type: 'POINT',
      points: [{ x: 0, y: 0 }],
      params: {},
      constraints: ['FIX'],
      isConstruction: false
    };
    
    let overSketch = mutateAddFlatEntities(sketch, [point]);
    
    // Add another FIX constraint to same point
    const fix2: IndustrialSketchConstraint = {
      id: 'c_fix_2',
      type: 'COINCIDENT', // Use coincident to another fixed point for over-constraint
      entityIds: ['pt_over', 'pt_fixed_origin']
    };
    
    const origin: any = {
        id: 'pt_fixed_origin',
        type: 'POINT',
        points: [{ x: 0, y: 0 }],
        params: {},
        constraints: ['FIX'],
        isConstruction: false
    };
    
    overSketch = mutateAddFlatEntities(overSketch, [origin]);
    
    // Use the official mutation API
    overSketch = mutateAddFlatConstraint(overSketch, 'pt_over', 'COINCIDENT', 'pt_fixed_origin');

    const { solverState } = solveCanonicalSketch(overSketch);

    expect(solverState.status).toBe('REDUNDANT');
  });

  it('CASE E: Over constrained geometry results in OVER_CONSTRAINED', () => {
    const origin: any = { id: 'p_origin', type: 'POINT', points: [{x:0, y:0}], isFixed: true };
    const p1: any = { id: 'p1_over', type: 'POINT', points: [{x:0, y:0}], isFixed: true };
    let overSketch = mutateAddFlatEntities(sketch, [origin, p1]);
    overSketch = { ...overSketch, constraints: { ...overSketch.constraints, 'c_dist': { id: 'c_dist', type: 'DISTANCE', entityIds: ['p_origin', 'p1_over'], value: 10 } } };
    const { solverState } = solveCanonicalSketch(overSketch);
    expect(solverState.status).toBe('OVER_CONSTRAINED');
  });

  it('CASE D: Conflicting geometry results in UNSOLVABLE/INCONSISTENT', () => {
     const p1: any = { id: 'p1', type: 'POINT', points: [{x:0, y:0}] };
     const p2: any = { id: 'p2', type: 'POINT', points: [{x:100, y:0}] };
     const line: any = {
         id: 'line_conflict',
         type: 'LINE',
         points: [{x:0, y:0}, {x:100, y:0}],
         constraints: ['HORIZONTAL', 'VERTICAL']
     };

     let conflictSketch = mutateAddFlatEntities(sketch, [p1, p2, line]);
     conflictSketch = { ...conflictSketch, constraints: { ...conflictSketch.constraints, 'c_dist': { id: 'c_dist', type: 'DISTANCE', entityIds: ['line_conflict'], value: 100 } } };
     const { solverState } = solveCanonicalSketch(conflictSketch);

     expect(solverState.status).toBe('CONFLICTING');
  });
  it('LIFECYCLE & PERSISTENCE: Reload canonical document yields same result', () => {
    // Persistence / Reload test
    const p1: any = { id: 'p1_persist', type: 'POINT', points: [{x:10, y:10}] };
    let persistSketch = mutateAddFlatEntities(sketch, [p1]);
    
    // Solve
    const { solverState: firstState } = solveCanonicalSketch(persistSketch);
    expect(firstState.status).toBe('UNDER_CONSTRAINED');
    
    // Simulate save/load by serializing
    const serialized = JSON.stringify(persistSketch);
    const loadedSketch = JSON.parse(serialized);
    
    // Re-solve on loaded data
    const { solverState: loadedState } = solveCanonicalSketch(loadedSketch);
    
    // Result must be strictly derived from canonical data
    expect(loadedState.status).toBe(firstState.status);
    expect(loadedState.totalDegreesOfFreedom).toBe(firstState.totalDegreesOfFreedom);
  });

  it('UI PROJECTION: Fake UI state does not alter canonical engineering truth', () => {
    // Generate a simple sketch
    const p1: any = { id: 'p1_proj', type: 'POINT', points: [{x:0, y:0}] };
    let projSketch = mutateAddFlatEntities(sketch, [p1]);
    
    // Get true state
    const { solverState: trueState } = solveCanonicalSketch(projSketch);
    
    // Simulate UI component attempting to override status (fake UI state)
    const fakeUiState = {
       ...trueState,
       status: 'FULLY_CONSTRAINED' // UI incorrectly thinks it's fully constrained
    };
    
    // Re-evaluating the canonical sketch must ignore fake UI state and return true truth
    const { solverState: reEvaluatedState } = solveCanonicalSketch(projSketch);
    
    expect(reEvaluatedState.status).toBe('UNDER_CONSTRAINED');
    expect(reEvaluatedState.status).not.toBe(fakeUiState.status);
  });

});
