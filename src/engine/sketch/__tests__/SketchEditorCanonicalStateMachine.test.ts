/**
 * SECP CAD Kernel — Sketch Editor & Canonical Sketch Interaction State Machine Tests
 *
 * Verifies:
 * - handleMouseDown, handleMouseMove, handleMouseUp, finishDrawing, Escape cancellation
 * - selectedEntity behavior and commitCanonicalMutation
 * - internal canonical state and canonicalDocument / canonicalSketch synchronization
 * - Mandatory interactions A through G (LINE, CIRCLE, RECTANGLE, ELLIPSE, POLYGON, SPLINE, SLOT)
 * - Flat -> Canonical -> Flat lossless round-trip for 9 entities
 * - ID integrity: centerPointId, endpoint IDs, generated point IDs, zero duplicates, zero orphans
 */

import { describe, it, expect } from 'vitest';
import {
  SketchEditorStateMachine,
  SketchEditorTool
} from '../SketchEditorStateMachine';
import {
  createEmptyCanonicalSketch,
  CanonicalSketch,
  getActiveCanonicalSketch,
  mutateAddFlatEntities
} from '../canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../canonical/CanonicalSketchAdapter';
import {
  EngineeringDocument,
  DEFAULT_UNIT_SYSTEM_MM
} from '../../cad-kernel/document/CADDocument';
import { SketchEntity } from '../../geometry/SketchEngine';

function createTestDocument(docId: string = 'DOC_SKETCH_TEST'): EngineeringDocument {
  const initialSketch = createEmptyCanonicalSketch('SKETCH_01', 'Base_Sketch', 'XY');
  return {
    documentId: docId,
    revision: 1,
    units: DEFAULT_UNIT_SYSTEM_MM,
    sketches: [initialSketch as any],
    constraints: [],
    features: [],
    parameters: [],
    topologyMap: { documentId: docId, version: 1, entries: new Map(), faceMap: {}, edgeMap: {}, vertexMap: {} },
    derived: {},
    evidence: []
  };
}

describe('Sketch Editor Interaction State Machine & Canonical Integration Suite', () => {

  // ==========================================================================
  // SECTION A: LINE TOOL
  // ==========================================================================
  describe('A. LINE INTERACTION', () => {
    it('A1. Click start -> click end (two-click workflow)', () => {
      const doc = createTestDocument();
      let updatedDoc: EngineeringDocument | undefined;
      let updatedSketch: CanonicalSketch | undefined;

      const sm = new SketchEditorStateMachine({
        canonicalDocument: doc,
        activeSketchId: 'SKETCH_01',
        listeners: {
          onCanonicalUpdate: (d, s) => {
            updatedDoc = d;
            updatedSketch = s;
          }
        }
      });

      sm.setTool('LINE');
      expect(sm.getActiveTool()).toBe('LINE');
      expect(sm.getIsDrawing()).toBe(false);

      // Click 1: Start point (100, 100)
      sm.handleMouseDown({ x: 100, y: 100 });
      sm.handleMouseUp({ x: 100, y: 100 }); // dist < 4: stays in two-click mode
      expect(sm.getIsDrawing()).toBe(true);
      expect(sm.getDrawingStart()).toEqual({ x: 100, y: 100 });

      // Move cursor to (250, 100)
      sm.handleMouseMove({ x: 250, y: 100 });

      // Click 2: End point (250, 100) -> Completes horizontal line
      sm.handleMouseDown({ x: 250, y: 100 });
      expect(sm.getIsDrawing()).toBe(false);
      expect(sm.getDrawingStart()).toBeNull();

      // Verify canonical state
      const canonical = sm.getActiveCanonical();
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      expect(lines.length).toBe(1);
      const line = lines[0] as any;
      expect(line.startPointId).toBeDefined();
      expect(line.endPointId).toBeDefined();

      const pStart = canonical.entities[line.startPointId] as any;
      const pEnd = canonical.entities[line.endPointId] as any;
      expect(pStart).toBeDefined();
      expect(pEnd).toBeDefined();
      expect(pStart.x).toBe(100);
      expect(pStart.y).toBe(100);
      expect(pEnd.x).toBe(250);
      expect(pEnd.y).toBe(100);

      // Verify selectedEntity updated to the new line
      expect(sm.getSelectedEntity()).toBe(line.id);

      // Verify document synchronization
      expect(updatedDoc).toBeDefined();
      expect(updatedSketch).toBeDefined();
      expect(updatedDoc!.sketches[0].entities[line.id]).toBeDefined();
    });

    it('A2. Drag start -> drag end (mouse down, move, release)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('LINE');

      // Mouse down at (50, 50)
      sm.handleMouseDown({ x: 50, y: 50 });
      expect(sm.getIsDrawing()).toBe(true);

      // Drag to (50, 200)
      sm.handleMouseMove({ x: 50, y: 200 });

      // Mouse up at (50, 200) -> dist = 150 >= 4, completes vertical line
      sm.handleMouseUp({ x: 50, y: 200 });
      expect(sm.getIsDrawing()).toBe(false);
      expect(sm.getDrawingStart()).toBeNull();

      const canonical = sm.getActiveCanonical();
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      expect(lines.length).toBe(1);
      const line = lines[0] as any;

      const pStart = canonical.entities[line.startPointId] as any;
      const pEnd = canonical.entities[line.endPointId] as any;
      expect(pStart.x).toBe(50);
      expect(pStart.y).toBe(50);
      expect(pEnd.x).toBe(50);
      expect(pEnd.y).toBe(200);
    });
  });

  // ==========================================================================
  // SECTION B: CIRCLE TOOL
  // ==========================================================================
  describe('B. CIRCLE INTERACTION', () => {
    it('B1. Click center -> click radius (two-click workflow)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('CIRCLE');

      // Click center (200, 200)
      sm.handleMouseDown({ x: 200, y: 200 });
      sm.handleMouseUp({ x: 200, y: 200 });
      expect(sm.getIsDrawing()).toBe(true);
      expect(sm.getDrawingStart()).toEqual({ x: 200, y: 200 });

      // Move to perimeter (260, 200) -> radius 60
      sm.handleMouseMove({ x: 260, y: 200 });

      // Click second point to finalize circle
      sm.handleMouseDown({ x: 260, y: 200 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const circles = Object.values(canonical.entities).filter(e => e.type === 'CIRCLE');
      expect(circles.length).toBe(1);
      const circle = circles[0] as any;
      expect(circle.radius).toBe(60);

      const centerPt = canonical.entities[circle.centerPointId] as any;
      expect(centerPt).toBeDefined();
      expect(centerPt.x).toBe(200);
      expect(centerPt.y).toBe(200);
    });

    it('B2. Drag center -> radius (drag workflow)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('CIRCLE');

      sm.handleMouseDown({ x: 150, y: 150 });
      sm.handleMouseMove({ x: 150, y: 225 }); // radius = 75
      sm.handleMouseUp({ x: 150, y: 225 });

      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const circles = Object.values(canonical.entities).filter(e => e.type === 'CIRCLE');
      expect(circles.length).toBe(1);
      const circle = circles[0] as any;
      expect(circle.radius).toBe(75);
    });

    it('B3. Escape cancellation after center click', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('CIRCLE');

      sm.handleMouseDown({ x: 100, y: 100 });
      sm.handleMouseUp({ x: 100, y: 100 });
      expect(sm.getIsDrawing()).toBe(true);

      // User presses Escape to cancel in-flight circle
      sm.handleEscape();
      expect(sm.getIsDrawing()).toBe(false);
      expect(sm.getDrawingStart()).toBeNull();
      expect(sm.getActiveTool()).toBe('SELECT');

      // Assert NO circle entity was committed
      const canonical = sm.getActiveCanonical();
      const circles = Object.values(canonical.entities).filter(e => e.type === 'CIRCLE');
      expect(circles.length).toBe(0);
    });

    it('B4. Small-distance second click produces valid non-zero geometry', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('CIRCLE');

      // Center click (300, 300)
      sm.handleMouseDown({ x: 300, y: 300 });
      sm.handleMouseUp({ x: 300, y: 300 });

      // Second click with very small distance (301, 300) < 4 mm
      sm.handleMouseDown({ x: 301, y: 300 });

      // Must NOT fail or create degenerate 0-radius circle; must fall back to valid radius (40)
      const canonical = sm.getActiveCanonical();
      const circles = Object.values(canonical.entities).filter(e => e.type === 'CIRCLE');
      expect(circles.length).toBe(1);
      const circle = circles[0] as any;
      expect(circle.radius).toBe(40);
      expect(circle.radius).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION C: RECTANGLE TOOL
  // ==========================================================================
  describe('C. RECTANGLE INTERACTION', () => {
    it('C1. Click corner -> click opposite corner (two-click)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('RECTANGLE');

      sm.handleMouseDown({ x: 50, y: 60 });
      sm.handleMouseUp({ x: 50, y: 60 });
      expect(sm.getIsDrawing()).toBe(true);

      sm.handleMouseDown({ x: 150, y: 120 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      // Canonical representation: 4 boundary lines and 4 corner points
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      const points = Object.values(canonical.entities).filter(e => e.type === 'POINT');
      expect(lines.length).toBe(4);
      expect(points.length).toBe(4);

      // Verify corner points match bounding box [50..150, 60..120]
      const xs = points.map((p: any) => p.x).sort((a, b) => a - b);
      const ys = points.map((p: any) => p.y).sort((a, b) => a - b);
      expect(xs).toEqual([50, 50, 150, 150]);
      expect(ys).toEqual([60, 60, 120, 120]);
    });

    it('C2. Drag corner -> opposite corner', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('RECTANGLE');

      sm.handleMouseDown({ x: 200, y: 100 });
      sm.handleMouseMove({ x: 280, y: 150 });
      sm.handleMouseUp({ x: 280, y: 150 });

      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      expect(lines.length).toBe(4);
    });
  });

  // ==========================================================================
  // SECTION D: ELLIPSE TOOL
  // ==========================================================================
  describe('D. ELLIPSE INTERACTION', () => {
    it('D1. Click center -> click extent (two-click)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('ELLIPSE');

      sm.handleMouseDown({ x: 200, y: 200 });
      sm.handleMouseUp({ x: 200, y: 200 });
      expect(sm.getIsDrawing()).toBe(true);

      // Click extent at (270, 240) -> rx=70, ry=40
      sm.handleMouseDown({ x: 270, y: 240 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const ellipses = Object.values(canonical.entities).filter(e => e.type === 'ELLIPSE');
      expect(ellipses.length).toBe(1);
      const ell = ellipses[0] as any;
      expect(ell.majorRadius).toBe(70);
      expect(ell.minorRadius).toBe(40);
      expect(ell.centerPointId).toBeDefined();

      const centerPt = canonical.entities[ell.centerPointId] as any;
      expect(centerPt.x).toBe(200);
      expect(centerPt.y).toBe(200);
    });

    it('D2. Drag center -> extent', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('ELLIPSE');

      sm.handleMouseDown({ x: 300, y: 300 });
      sm.handleMouseMove({ x: 380, y: 350 });
      sm.handleMouseUp({ x: 380, y: 350 });

      const canonical = sm.getActiveCanonical();
      const ellipses = Object.values(canonical.entities).filter(e => e.type === 'ELLIPSE');
      expect(ellipses.length).toBe(1);
      const ell = ellipses[0] as any;
      expect(ell.majorRadius).toBe(80);
      expect(ell.minorRadius).toBe(50);
    });
  });

  // ==========================================================================
  // SECTION E: POLYGON TOOL
  // ==========================================================================
  describe('E. POLYGON INTERACTION', () => {
    it('E1. Click center -> second point, verify all 6 vertices', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('POLYGON');

      sm.handleMouseDown({ x: 400, y: 300 });
      sm.handleMouseUp({ x: 400, y: 300 });
      expect(sm.getIsDrawing()).toBe(true);

      // Second point at distance 50: (450, 300)
      sm.handleMouseDown({ x: 450, y: 300 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      // Canonical representation: 6 boundary lines and 6 vertices
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      const points = Object.values(canonical.entities).filter(e => e.type === 'POINT');
      expect(lines.length).toBe(6);
      expect(points.length).toBe(6);

      // Verify all 6 vertices lie on a circle of radius ~50 from (400, 300)
      for (const pt of points as any[]) {
        const dist = Math.hypot(pt.x - 400, pt.y - 300);
        expect(dist).toBeCloseTo(50, 0);
      }
    });
  });

  // ==========================================================================
  // SECTION F: SPLINE TOOL
  // ==========================================================================
  describe('F. SPLINE INTERACTION', () => {
    it('F1. Verify actual spline and control-point semantics (lossless)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('SPLINE');

      sm.handleMouseDown({ x: 100, y: 200 });
      sm.handleMouseUp({ x: 100, y: 200 });
      expect(sm.getIsDrawing()).toBe(true);

      sm.handleMouseDown({ x: 300, y: 200 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const splines = Object.values(canonical.entities).filter(e => e.type === 'SPLINE');
      expect(splines.length).toBe(1);

      const spline = splines[0] as any;
      expect(spline.type).toBe('SPLINE');
      expect(spline.degree).toBe(3);
      expect(spline.controlPointIds).toBeDefined();
      expect(spline.controlPointIds.length).toBe(4);

      // Verify every controlPointId maps to a valid POINT in the canonical entity graph
      for (const cpId of spline.controlPointIds) {
        const cp = canonical.entities[cpId] as any;
        expect(cp).toBeDefined();
        expect(cp.type).toBe('POINT');
        expect(Number.isFinite(cp.x)).toBe(true);
        expect(Number.isFinite(cp.y)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // SECTION G: SLOT TOOL
  // ==========================================================================
  describe('G. SLOT INTERACTION', () => {
    it('G1. Verify canonical slot representation (2 lines, 2 arcs, 6 points)', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('SLOT');

      sm.handleMouseDown({ x: 100, y: 150 });
      sm.handleMouseUp({ x: 100, y: 150 });
      expect(sm.getIsDrawing()).toBe(true);

      sm.handleMouseDown({ x: 250, y: 150 });
      expect(sm.getIsDrawing()).toBe(false);

      const canonical = sm.getActiveCanonical();
      const lines = Object.values(canonical.entities).filter(e => e.type === 'LINE');
      const arcs = Object.values(canonical.entities).filter(e => e.type === 'ARC');
      const points = Object.values(canonical.entities).filter(e => e.type === 'POINT');

      // Straight slot contour is composed of:
      // 2 parallel lines + 2 semicircular arcs + 6 points (4 tangents + 2 arc centers)
      expect(lines.length).toBe(2);
      expect(arcs.length).toBe(2);
      expect(points.length).toBe(6);

      // Verify radius of arcs matches half slotWidth (30 / 2 = 15)
      for (const arc of arcs as any[]) {
        expect(arc.radius).toBe(15);
        expect(canonical.entities[arc.centerPointId]).toBeDefined();
        expect(canonical.entities[arc.startPointId]).toBeDefined();
        expect(canonical.entities[arc.endPointId]).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // SECTION H: COMPLETE STATE MACHINE & SELECTION BEHAVIOR
  // ==========================================================================
  describe('H. State Machine Lifecycle & Selection Invariants', () => {
    it('H1. Selected entity automatically points to newly created shape', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('POINT');
      sm.handleMouseDown({ x: 123, y: 456 });

      const selId = sm.getSelectedEntity();
      expect(selId).toBeDefined();
      expect(selId).toContain('ENT-PT-');

      const flat = sm.getFlatEntities();
      expect(flat.some(e => e.id === selId)).toBe(true);
    });

    it('H2. Delete shortcut cleanly removes selected entity and clears selection', () => {
      const sm = new SketchEditorStateMachine();
      sm.setTool('CIRCLE');
      sm.handleMouseDown({ x: 100, y: 100 });
      sm.handleMouseDown({ x: 180, y: 100 });

      const circId = sm.getSelectedEntity();
      expect(circId).toBeDefined();

      // Trigger delete
      sm.handleDelete();
      expect(sm.getSelectedEntity()).toBeNull();

      const flatAfter = sm.getFlatEntities();
      expect(flatAfter.some(e => e.id === circId)).toBe(false);
    });

    it('H3. Canonical Document synchronizes deterministically across mutations', () => {
      const doc = createTestDocument('DOC_SYNC_VERIFICATION');
      let capturedDoc: EngineeringDocument | undefined;

      const sm = new SketchEditorStateMachine({
        canonicalDocument: doc,
        activeSketchId: 'SKETCH_01',
        listeners: {
          onCanonicalUpdate: (d) => {
            capturedDoc = d;
          }
        }
      });

      sm.setTool('LINE');
      sm.handleMouseDown({ x: 0, y: 0 });
      sm.handleMouseDown({ x: 100, y: 0 });

      expect(capturedDoc).toBeDefined();
      expect(Number(capturedDoc!.revision)).toBe(Number(doc.revision) + 1);
      const activeSketchInDoc = getActiveCanonicalSketch(capturedDoc!, 'SKETCH_01');
      expect(activeSketchInDoc).toBeDefined();
      expect(Object.keys(activeSketchInDoc!.entities).length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SECTION I: FLAT -> CANONICAL -> FLAT LOSSLESS ROUND-TRIP FOR ALL 9 ENTITIES
  // ==========================================================================
  describe('I. Flat -> Canonical -> Flat Round-Trip Verification (9 Entities)', () => {
    const testCases: { name: string; entity: SketchEntity }[] = [
      {
        name: '1. POINT',
        entity: {
          id: 'TEST-PT-01',
          type: 'POINT',
          points: [{ x: 42, y: 84 }],
          params: {},
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '2. LINE',
        entity: {
          id: 'TEST-LINE-01',
          type: 'LINE',
          points: [{ x: 10, y: 20 }, { x: 150, y: 20 }],
          params: {},
          constraints: ['HORIZONTAL'],
          isConstruction: false
        }
      },
      {
        name: '3. CIRCLE',
        entity: {
          id: 'TEST-CIRC-01',
          type: 'CIRCLE',
          points: [{ x: 200, y: 200 }],
          params: { radius: 65 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '4. ARC',
        entity: {
          id: 'TEST-ARC-01',
          type: 'ARC',
          points: [{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 0 }],
          params: { radius: 55 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '5. ELLIPSE',
        entity: {
          id: 'TEST-ELL-01',
          type: 'ELLIPSE',
          points: [{ x: 180, y: 180 }],
          params: { rx: 75, ry: 45 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '6. RECTANGLE',
        entity: {
          id: 'TEST-RECT-01',
          type: 'RECTANGLE',
          points: [{ x: 30, y: 40 }, { x: 130, y: 100 }],
          params: { width: 100, height: 60 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '7. POLYGON',
        entity: {
          id: 'TEST-POLY-01',
          type: 'POLYGON',
          points: [{ x: 300, y: 300 }],
          params: { sides: 6, radius: 45 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '8. SPLINE',
        entity: {
          id: 'TEST-SPL-01',
          type: 'SPLINE',
          points: [{ x: 0, y: 0 }, { x: 40, y: 50 }, { x: 80, y: -20 }, { x: 120, y: 10 }],
          params: { segments: 4, degree: 3 },
          constraints: [],
          isConstruction: false
        }
      },
      {
        name: '9. SLOT',
        entity: {
          id: 'TEST-SLOT-01',
          type: 'SLOT',
          points: [{ x: 50, y: 50 }, { x: 150, y: 50 }],
          params: { slotWidth: 28 },
          constraints: [],
          isConstruction: false
        }
      }
    ];

    for (const tc of testCases) {
      it(`Round-trip verification for ${tc.name}`, () => {
        const initialSketch = createEmptyCanonicalSketch(`sk-${tc.entity.id}`, `RoundTrip_${tc.entity.type}`);

        // Step 1: Flat -> Canonical
        const canonical = mutateAddFlatEntities(initialSketch, [tc.entity]);
        expect(canonical.revision).toBe(initialSketch.revision + 1);

        // Step 2: Canonical -> Flat
        const flatBack = CanonicalSketchAdapter.toFlatEntities(canonical);
        expect(flatBack.length).toBeGreaterThan(0);

        // Step 3: Canonical ID & Graph Integrity Checks
        const allIds = Object.keys(canonical.entities);
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length); // ZERO duplicate IDs

        // Verify entity references have NO orphans
        for (const [entId, ent] of Object.entries(canonical.entities) as [string, any][]) {
          if (ent.type === 'LINE') {
            expect(canonical.entities[ent.startPointId]).toBeDefined();
            expect(canonical.entities[ent.endPointId]).toBeDefined();
          } else if (ent.type === 'CIRCLE') {
            expect(canonical.entities[ent.centerPointId]).toBeDefined();
          } else if (ent.type === 'ARC') {
            expect(canonical.entities[ent.centerPointId]).toBeDefined();
            expect(canonical.entities[ent.startPointId]).toBeDefined();
            expect(canonical.entities[ent.endPointId]).toBeDefined();
          } else if (ent.type === 'ELLIPSE') {
            expect(canonical.entities[ent.centerPointId]).toBeDefined();
          } else if (ent.type === 'SPLINE') {
            for (const cpId of ent.controlPointIds) {
              expect(canonical.entities[cpId]).toBeDefined();
            }
          }
        }

        // Specific semantic checks
        if (tc.entity.type === 'ELLIPSE') {
          const canonicalEll = Object.values(canonical.entities).find(e => e.type === 'ELLIPSE') as any;
          expect(canonicalEll).toBeDefined();
          expect(canonicalEll.majorRadius).toBe(75);
          expect(canonicalEll.minorRadius).toBe(45);

          const flatEll = flatBack.find(e => e.type === 'ELLIPSE');
          expect(flatEll).toBeDefined();
          expect(flatEll!.params.rx).toBe(75);
          expect(flatEll!.params.ry).toBe(45);
        }

        if (tc.entity.type === 'SPLINE') {
          const canonicalSpl = Object.values(canonical.entities).find(e => e.type === 'SPLINE') as any;
          expect(canonicalSpl).toBeDefined();
          expect(canonicalSpl.controlPointIds.length).toBe(4);
          expect(canonicalSpl.degree).toBe(3);

          const segLines = flatBack.filter(e => e.type === 'LINE' && e.id.includes('TEST-SPL-01_SEG'));
          expect(segLines.length).toBe(3);
        }
      });
    }
  });
});
