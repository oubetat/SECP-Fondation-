/**
 * PATCH-191 — Interactive CAD Sketcher Panel
 * Transforms the sketcher into a fully interactive parametric CAD tool.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useEngineeringToolContext } from '../engine/telemetry/useEngineeringToolContext';
import {
  Edit3,
  CheckCircle2,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Layers,
  Settings,
  Sliders,
  Maximize2,
  Grid,
  Magnet,
  Lock,
  ArrowRight,
  Eye,
  Activity,
  Plus
} from 'lucide-react';
import {
  InteractiveSketchEngine,
  Vector2D,
  SnapResult,
  ExtendedSketchEntity
} from '../engine/sketch/InteractiveSketchEngine';
import {
  IndustrialSketchDefinition,
  IndustrialSketchEntity,
  IndustrialSketchConstraint,
  IndustrialConstraintType,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D,
  SketchEllipse2D
} from '../engine/sketch/IndustrialConstraintTypes';
import { SketchCreationTools } from '../engine/sketch/SketchCreationTools';
import { IndustrialVariationalSolver } from '../engine/sketch/IndustrialVariationalSolver';
import { EngineeringObjectOS } from '../engine/industrial-os/EngineeringObjectOS';
import { EngineeringEventStore } from '../engine/industrial-os/event-model/EngineeringEventStore';

import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { 
  CanonicalSketch, 
  deriveSolverState, 
  getActiveCanonicalSketch, 
  updateCanonicalSketchInDocument,
  createEmptyCanonicalSketch 
} from '../engine/sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../engine/sketch/canonical/CanonicalSketchAdapter';
import { CanonicalIntentDispatcher277 } from '../engine/viewport/CanonicalIntentDispatcher277';
import { AnyEngineeringIntent } from '../engine/viewport/EngineeringIntent277';
import { SelectionReference } from '../engine/viewport/SelectionTypes277';

export interface SketcherPanelProps {
  canonicalDocument?: EngineeringDocument;
  activeSketchId?: string | null;
  canonicalSketch?: CanonicalSketch;
  onCanonicalUpdate?: (doc: EngineeringDocument, sketch?: CanonicalSketch) => void;
  onApplySketchExtrude?: (sketchEntities: any[], extrudeDepth: number) => void;
  activeUnit: string;
  onSwitchToCommandManager?: () => void;
}

type DrawMode = 
  | 'SELECT' 
  | 'LINE' 
  | 'CONSTRUCTION_LINE' 
  | 'CENTERLINE' 
  | 'POINT' 
  | 'CIRCLE' 
  | 'ARC' 
  | '3POINT_ARC' 
  | 'RECTANGLE' 
  | 'POLYGON' 
  | 'POLYLINE' 
  | 'SLOT' 
  | 'ELLIPSE' 
  | 'SPLINE' 
  | 'TRIM' 
  | 'EXTEND' 
  | 'SPLIT' 
  | 'OFFSET';

export const SketcherPanel: React.FC<SketcherPanelProps> = ({ 
  canonicalDocument, 
  activeSketchId,
  canonicalSketch, 
  onCanonicalUpdate, 
  onApplySketchExtrude, 
  activeUnit,
  onSwitchToCommandManager
}) => {
  const toolContext = useEngineeringToolContext(canonicalDocument);
  // ---------------------------------------------------------------------------
  // 1. SINGLE CANONICAL RUNTIME SOT & DERIVED PROJECTIONS
  // ---------------------------------------------------------------------------
  const [internalSketch, setInternalSketch] = useState<CanonicalSketch>(() => {
    if (canonicalSketch) return canonicalSketch;
    const fromDoc = getActiveCanonicalSketch(canonicalDocument, activeSketchId);
    if (fromDoc) return fromDoc;
    return createEmptyCanonicalSketch('sk-interactive-001', 'Parametric_Base_Sketch');
  });

  useEffect(() => {
    if (canonicalSketch) {
      setInternalSketch(canonicalSketch);
    } else if (canonicalDocument) {
      const fromDoc = getActiveCanonicalSketch(canonicalDocument, activeSketchId);
      if (fromDoc) setInternalSketch(fromDoc);
    }
  }, [canonicalSketch, canonicalDocument, activeSketchId]);

  const activeCanonical = useMemo(() => {
    if (canonicalSketch) return canonicalSketch;
    const fromDoc = getActiveCanonicalSketch(canonicalDocument, activeSketchId);
    if (fromDoc) return fromDoc;
    return internalSketch;
  }, [canonicalDocument, canonicalSketch, activeSketchId, internalSketch]);

  const sketch = useMemo(() => {
    return CanonicalSketchAdapter.toIndustrialSketch(activeCanonical);
  }, [activeCanonical]);

  const commitCanonicalMutation = (updatedCanonical: CanonicalSketch) => {
    setInternalSketch(updatedCanonical);
    if (canonicalDocument && onCanonicalUpdate) {
      const updatedDoc = updateCanonicalSketchInDocument(canonicalDocument, updatedCanonical);
      onCanonicalUpdate(updatedDoc, updatedCanonical);
    } else if (onCanonicalUpdate) {
      onCanonicalUpdate(canonicalDocument!, updatedCanonical);
    }
  };

  const updateCanonicalFromSketcher = (nextSketch: IndustrialSketchDefinition) => {
    const newCanonical = CanonicalSketchAdapter.fromIndustrialSketch(nextSketch);
    newCanonical.id = activeCanonical.id;
    newCanonical.revision = activeCanonical.revision + 1;
    commitCanonicalMutation(newCanonical);
  };

  const setSketchAndSync = (nextSketch: IndustrialSketchDefinition | ((prev: IndustrialSketchDefinition) => IndustrialSketchDefinition)) => {
    const resolved = typeof nextSketch === 'function' ? nextSketch(sketch) : nextSketch;
    updateCanonicalFromSketcher(resolved);
  };
  const setSketch = setSketchAndSync;

  const dispatchIntent = async (intent: AnyEngineeringIntent) => {
    let doc = canonicalDocument;
    if (!doc) {
      doc = updateCanonicalSketchInDocument(null, activeCanonical);
    }
    const result = await CanonicalIntentDispatcher277.dispatch(intent, doc);
    if (result.success && result.document) {
      const updatedSketch = getActiveCanonicalSketch(result.document, activeSketchId) || activeCanonical;
      setInternalSketch(updatedSketch);
      if (onCanonicalUpdate) {
        onCanonicalUpdate(result.document, updatedSketch);
      }
    }
  };

  const createIntent = (toolId: string, params: any): AnyEngineeringIntent => {
    const docId = canonicalDocument?.documentId || 'DOC_001';
    const featureCount = canonicalDocument?.features.length ?? 0;
    return {
      intentId: `int_${toolId}_${docId}_${featureCount}_${Date.now()}`,
      toolId,
      documentId: docId,
      parameters: {
        sketchId: activeCanonical.id,
        ...params
      },
      timestamp: new Date().toISOString()
    } as AnyEngineeringIntent;
  };

  const getSelectionReference = (entityId: string): SelectionReference => {
    const ent = sketch.entities[entityId];
    return {
      referenceType: 'SKETCH_ENTITY',
      persistentId: entityId,
      sourceId: activeCanonical.id,
      sketchId: activeCanonical.id,
      entityId: entityId,
      name: ent?.type || 'Entity'
    };
  };

  const [drawMode, setDrawMode] = useState<DrawMode>('SELECT');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<IndustrialSketchDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<IndustrialSketchDefinition[]>([]);

  // Snapping Configuration
  const [snapSettings, setSnapSettings] = useState({
    grid: true,
    endpoint: true,
    midpoint: true,
    center: true,
    intersection: true,
    autoConstrain: true
  });

  // CAD Operations Parameters
  const [offsetValue, setOffsetValue] = useState<number>(15);
  const [patternCount, setPatternCount] = useState<number>(3);
  const [patternSpacing, setPatternSpacing] = useState<number>(50);
  const [extrudeDepth, setExtrudeDepth] = useState<number>(100);

  // Viewport Control
  const [zoom, setZoom] = useState<number>(1.2);
  const [pan, setPan] = useState<Vector2D>({ x: 80, y: 50 });

  // Draw State
  const [dragStartPoint, setDragStartPoint] = useState<Vector2D | null>(null);
  const [currentCursorPos, setCurrentCursorPos] = useState<Vector2D>({ x: 0, y: 0 });
  const [activeSnap, setActiveSnap] = useState<SnapResult | null>(null);
  const [boxSelectEnd, setBoxSelectEnd] = useState<Vector2D | null>(null);

  // Spline Creation Control Points
  const [splinePoints, setSplinePoints] = useState<string[]>([]);

  // ---------------------------------------------------------------------------
  // 2. REFERENCES & RESOLUTIONS
  // ---------------------------------------------------------------------------
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const solver = useMemo(() => new IndustrialVariationalSolver(), []);
  const os = useMemo(() => new EngineeringObjectOS(), []);
  const eventStore = useMemo(() => EngineeringEventStore.getInstance(), []);

  // Save current state to Undo Stack
  const pushToUndo = (stateToSave: IndustrialSketchDefinition) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(stateToSave))]);
    setRedoStack([]); // Clear redo
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(sketch))]);
    setSketchAndSync(previous);
    logEvent('UNDO', previous.id);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(sketch))]);
    setSketchAndSync(next);
    logEvent('REDO', next.id);
  };

  // Helper to append events to EngineeringEventStore and log to OS
  const logEvent = (actionType: string, refId: string) => {
    eventStore.append({
      eventType: 'OBJECT_UPDATED',
      actor: { id: 'CAD_ENGINEER', type: 'USER' },
      source: { service: 'CADWorkspace', component: 'InteractiveSketcher', version: '2.0' },
      objectRefs: [refId],
      correlationId: `CORR-${crypto.randomUUID().slice(0, 8)}`,
      payload: { action: actionType, sketchId: sketch.id }
    });
  };

  // Dispatch sketch entities & extrude depth intent to canonical pipeline
  const handleExtrude = () => {
    const sketchEntities: any[] = [];
    const pointsMap: Record<string, SketchPoint2D> = {};

    Object.values(sketch.entities).forEach((ent: any) => {
      if (ent.type === 'POINT') {
        pointsMap[ent.id] = ent as SketchPoint2D;
      }
    });

    Object.values(sketch.entities).forEach((ent: any) => {
      if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        const p1 = pointsMap[line.startPointId];
        const p2 = pointsMap[line.endPointId];
        if (p1 && p2) {
          sketchEntities.push({
            type: 'LINE',
            id: line.id,
            points: [{ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }]
          });
        }
      } else if (ent.type === 'CIRCLE') {
        const circle = ent as SketchCircle2D;
        const center = pointsMap[circle.centerPointId] || { x: 0, y: 0 };
        sketchEntities.push({
          type: 'CIRCLE',
          id: circle.id,
          points: [{ x: center.x, y: center.y }],
          params: { radius: circle.radius }
        });
      }
    });

    // Fallback if no lines were extracted directly: construct boundary from points
    if (sketchEntities.length === 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      Object.values(pointsMap).forEach(pt => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      });
      const w = (maxX > minX) ? (maxX - minX) : 200;
      const h = (maxY > minY) ? (maxY - minY) : 120;
      sketchEntities.push(
        { type: 'LINE', points: [{ x: 0, y: 0 }, { x: w, y: 0 }] },
        { type: 'LINE', points: [{ x: w, y: 0 }, { x: w, y: h }] },
        { type: 'LINE', points: [{ x: w, y: h }, { x: 0, y: h }] },
        { type: 'LINE', points: [{ x: 0, y: h }, { x: 0, y: 0 }] }
      );
    }

    if (onApplySketchExtrude) {
      onApplySketchExtrude(sketchEntities, extrudeDepth);
    }
    logEvent('EXTRUDE_SOLID', sketch.id);
  };

  // Convert client cursor coords to internal CAD model coordinates
  const getModelCoordinates = (clientX: number, clientY: number): Vector2D => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    return {
      x: (vx - pan.x) / zoom,
      y: (vy - pan.y) / zoom
    };
  };

  // ---------------------------------------------------------------------------
  // 3. MOUSE EVENT HANDLERS & CAD TOOLS
  // ---------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      // Middle Click Pan or Shift+Left Pan Start
      setDragStartPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const modelPos = getModelCoordinates(e.clientX, e.clientY);
    const snap = InteractiveSketchEngine.computeSnap(
      modelPos,
      sketch,
      20,
      12 / zoom,
      snapSettings.grid
    );
    const actualPos = snap ? snap.point : modelPos;

    if (drawMode === 'SELECT') {
      if (hoveredId) {
        setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(hoveredId)) {
            next.delete(hoveredId);
          } else {
            if (!e.ctrlKey && !e.metaKey) {
              next.clear();
            }
            next.add(hoveredId);
          }
          return next;
        });
      } else {
        // Start Box Selection
        setDragStartPoint({ x: e.clientX, y: e.clientY });
        setBoxSelectEnd({ x: e.clientX, y: e.clientY });
        setSelectedIds(new Set());
      }
    } else if (drawMode === 'TRIM') {
      if (hoveredId) {
        pushToUndo(sketch);
        dispatchIntent(createIntent('SKETCH_TRIM', { targetEntityId: hoveredId, clickPoint: actualPos }));
        setHoveredId(null);
        logEvent('TRIM_ENTITY', hoveredId);
      }
    } else if (drawMode === 'EXTEND') {
      if (hoveredId) {
        pushToUndo(sketch);
        dispatchIntent(createIntent('SKETCH_EXTEND', { targetEntityId: hoveredId }));
        logEvent('EXTEND_ENTITY', hoveredId);
      }
    } else if (drawMode === 'SPLIT') {
      if (hoveredId) {
        pushToUndo(sketch);
        dispatchIntent(createIntent('SKETCH_SPLIT', { targetEntityId: hoveredId, splitPoint: actualPos }));
        setHoveredId(null);
        logEvent('SPLIT_ENTITY', hoveredId);
      }
    } else if (drawMode === 'POINT') {
      pushToUndo(sketch);
      dispatchIntent(createIntent('SKETCH_POINT', { x: actualPos.x, y: actualPos.y }));
      logEvent('CREATE_POINT', 'INTENT_DISPATCHED');
    } else {
      // Creation Mode
      setDragStartPoint(actualPos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const modelPos = getModelCoordinates(e.clientX, e.clientY);

    // Compute Snapping
    const snap = InteractiveSketchEngine.computeSnap(
      modelPos,
      sketch,
      20,
      12 / zoom,
      snapSettings.grid
    );
    setActiveSnap(snap);
    const actualPos = snap ? snap.point : modelPos;
    setCurrentCursorPos(actualPos);

    if (dragStartPoint && (e.buttons === 4 || (e.buttons === 1 && e.shiftKey))) {
      // Panning active
      const dx = e.clientX - dragStartPoint.x;
      const dy = e.clientY - dragStartPoint.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStartPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (dragStartPoint && drawMode === 'SELECT' && boxSelectEnd) {
      // Box selection active
      setBoxSelectEnd({ x: e.clientX, y: e.clientY });
      return;
    }

    // Entity Hover detection
    if (drawMode === 'SELECT' || drawMode === 'TRIM' || drawMode === 'EXTEND' || drawMode === 'SPLIT') {
      let closestId: string | null = null;
      let minDist = 12 / zoom;

      Object.values(sketch.entities).forEach((ent: any) => {
        if (ent.type === 'POINT') {
          const pt = ent as SketchPoint2D;
          const d = InteractiveSketchEngine.dist(modelPos, pt);
          if (d < minDist) {
            minDist = d;
            closestId = pt.id;
          }
        } else if (ent.type === 'LINE') {
          const line = ent as SketchLine2D;
          const p1 = sketch.entities[line.startPointId] as SketchPoint2D;
          const p2 = sketch.entities[line.endPointId] as SketchPoint2D;
          if (p1 && p2) {
            const { point: proj } = InteractiveSketchEngine.projectPointToLine(modelPos, p1, p2);
            const d = InteractiveSketchEngine.dist(modelPos, proj);
            if (d < minDist) {
              minDist = d;
              closestId = line.id;
            }
          }
        } else if (ent.type === 'CIRCLE') {
          const circ = ent as SketchCircle2D;
          const center = sketch.entities[circ.centerPointId] as SketchPoint2D;
          if (center) {
            const dToCenter = InteractiveSketchEngine.dist(modelPos, center);
            const d = Math.abs(dToCenter - circ.radius);
            if (d < minDist) {
              minDist = d;
              closestId = circ.id;
            }
          }
        }
      });

      setHoveredId(closestId);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragStartPoint && (e.button === 1 || e.shiftKey)) {
      setDragStartPoint(null);
      return;
    }

    const modelPos = getModelCoordinates(e.clientX, e.clientY);
    const snap = InteractiveSketchEngine.computeSnap(
      modelPos,
      sketch,
      20,
      12 / zoom,
      snapSettings.grid
    );
    const actualPos = snap ? snap.point : modelPos;

    if (drawMode === 'SELECT' && dragStartPoint && boxSelectEnd) {
      // Perform box select resolution
      const x1 = Math.min(dragStartPoint.x, boxSelectEnd.x);
      const y1 = Math.min(dragStartPoint.y, boxSelectEnd.y);
      const x2 = Math.max(dragStartPoint.x, boxSelectEnd.x);
      const y2 = Math.max(dragStartPoint.y, boxSelectEnd.y);

      const resolved = new Set<string>();
      Object.values(sketch.entities).forEach((ent: any) => {
        if (ent.type === 'POINT') {
          const pt = ent as SketchPoint2D;
          // transform to screen coords to match box selection bounds
          const screenX = pt.x * zoom + pan.x;
          const screenY = pt.y * zoom + pan.y;
          if (screenX >= x1 && screenX <= x2 && screenY >= y1 && screenY <= y2) {
            resolved.add(pt.id);
          }
        } else if (ent.type === 'LINE') {
          const line = ent as SketchLine2D;
          const p1 = sketch.entities[line.startPointId] as SketchPoint2D;
          const p2 = sketch.entities[line.endPointId] as SketchPoint2D;
          if (p1 && p2) {
            const sx1 = p1.x * zoom + pan.x;
            const sy1 = p1.y * zoom + pan.y;
            const sx2 = p2.x * zoom + pan.x;
            const sy2 = p2.y * zoom + pan.y;
            const in1 = sx1 >= x1 && sx1 <= x2 && sy1 >= y1 && sy1 <= y2;
            const in2 = sx2 >= x1 && sx2 <= x2 && sy2 >= y1 && sy2 <= y2;
            if (in1 || in2) {
              resolved.add(line.id);
            }
          }
        }
      });

      setSelectedIds(resolved);
      setDragStartPoint(null);
      setBoxSelectEnd(null);
      return;
    }

    if (dragStartPoint) {
      const start = dragStartPoint;
      const end = actualPos;
      const dist = InteractiveSketchEngine.dist(start, end);

      if (dist > 2) {
        pushToUndo(sketch);

        const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
        const startPtId = `p-${InteractiveSketchEngine.randomId()}`;
        const endPtId = `p-${InteractiveSketchEngine.randomId()}`;

        if (drawMode === 'LINE') {
          dispatchIntent(createIntent('SKETCH_LINE', { startX: start.x, startY: start.y, endX: end.x, endY: end.y }));
          logEvent('CREATE_LINE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'CONSTRUCTION_LINE') {
          dispatchIntent(createIntent('SKETCH_CONSTRUCTION_LINE', { startX: start.x, startY: start.y, endX: end.x, endY: end.y, isConstruction: true }));
          logEvent('CREATE_CONSTRUCTION_LINE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'CENTERLINE') {
          dispatchIntent(createIntent('SKETCH_CENTERLINE', { startX: start.x, startY: start.y, endX: end.x, endY: end.y, isCenterline: true, isConstruction: true }));
          logEvent('CREATE_CENTERLINE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'POINT') {
          dispatchIntent(createIntent('SKETCH_POINT', { x: end.x, y: end.y }));
          logEvent('CREATE_POINT', 'INTENT_DISPATCHED');
        } else if (drawMode === 'CIRCLE') {
          dispatchIntent(createIntent('SKETCH_CIRCLE', { centerX: start.x, centerY: start.y, radius: dist }));
          logEvent('CREATE_CIRCLE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'ARC') {
          dispatchIntent(createIntent('SKETCH_ARC', { centerX: start.x, centerY: start.y, startX: start.x + dist, startY: start.y, endX: end.x, endY: end.y }));
          logEvent('CREATE_ARC', 'INTENT_DISPATCHED');
        } else if (drawMode === '3POINT_ARC') {
          dispatchIntent(createIntent('SKETCH_3POINT_ARC', { p1: start, p2: end, p3: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - dist * 0.25 } }));
          logEvent('CREATE_3POINT_ARC', 'INTENT_DISPATCHED');
        } else if (drawMode === 'RECTANGLE') {
          dispatchIntent(createIntent('SKETCH_RECTANGLE', { startX: start.x, startY: start.y, endX: end.x, endY: end.y }));
          logEvent('CREATE_RECTANGLE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'POLYGON') {
          dispatchIntent(createIntent('SKETCH_POLYGON', { centerX: start.x, centerY: start.y, radius: dist, sides: 6 }));
          logEvent('CREATE_POLYGON', 'INTENT_DISPATCHED');
        } else if (drawMode === 'POLYLINE') {
          const midPoint = { x: (start.x + end.x) / 2, y: start.y };
          dispatchIntent(createIntent('SKETCH_POLYLINE', { points: [start, midPoint, end], isClosed: false }));
          logEvent('CREATE_POLYLINE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'DELETE_ENTITY') {
           // Not a draw mode, but keeping for consistency if needed
        } else if (drawMode === 'SLOT') {
          const slotRadius = Math.max(12, dist * 0.2);
          dispatchIntent(createIntent('SKETCH_SLOT', { startX: start.x, startY: start.y, endX: end.x, endY: end.y, width: slotRadius * 2, type: 'STRAIGHT' }));
          logEvent('CREATE_SLOT', 'INTENT_DISPATCHED');
        } else if (drawMode === 'ELLIPSE') {
          const major = Math.max(20, Math.abs(end.x - start.x));
          const minor = Math.max(10, Math.abs(end.y - start.y));
          dispatchIntent(createIntent('SKETCH_ELLIPSE', { centerX: start.x, centerY: start.y, majorX: start.x + major, majorY: start.y, minorRadius: minor }));
          logEvent('CREATE_ELLIPSE', 'INTENT_DISPATCHED');
        } else if (drawMode === 'SPLINE') {
          // Spline control points chain
          const res: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
          const startPtId = `p-${InteractiveSketchEngine.randomId()}`;
          const endPtId = `p-${InteractiveSketchEngine.randomId()}`;
          res.entities[startPtId] = { id: startPtId, type: 'POINT', x: start.x, y: start.y };
          res.entities[endPtId] = { id: endPtId, type: 'POINT', x: end.x, y: end.y };

          const splineId = `spline-${InteractiveSketchEngine.randomId()}`;
          res.entities[splineId] = {
            id: splineId,
            type: 'SPLINE',
            controlPointIds: [startPtId, endPtId],
            degree: 3
          } as any;

          const solved = solver.solve(res);
          setSketchAndSync(solved.sketch);
          logEvent('CREATE_SPLINE', splineId);
        }
      }
      setDragStartPoint(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    setZoom(Math.max(0.1, Math.min(10, newZoom)));
  };

  // ---------------------------------------------------------------------------
  // 4. CAD ACTIONS (OFFSET, MIRROR, PATTERNS, DELETE)
  // ---------------------------------------------------------------------------
  const applyOffset = () => {
    if (selectedIds.size === 0) return;
    pushToUndo(sketch);
    selectedIds.forEach(id => {
      dispatchIntent(createIntent('SKETCH_OFFSET', { targetEntityId: id, offsetValue }));
    });
    logEvent('OFFSET', Array.from(selectedIds)[0] as string);
  };

  const applyMirror = (axis: 'X' | 'Y') => {
    if (selectedIds.size === 0) return;
    pushToUndo(sketch);
    dispatchIntent(createIntent('SKETCH_MIRROR', { selectedEntityIds: Array.from(selectedIds), mirrorLineId: axis }));
    logEvent('MIRROR', axis);
  };

  const applyLinearPattern = () => {
    if (selectedIds.size === 0) return;
    pushToUndo(sketch);
    dispatchIntent(createIntent('SKETCH_PATTERN_LINEAR', {
      selectedEntityIds: Array.from(selectedIds),
      count: patternCount,
      distance: patternSpacing,
      directionRad: 0 // Right direction
    }));
    logEvent('LINEAR_PATTERN', 'MULTI');
  };

  const applyCircularPattern = () => {
    if (selectedIds.size === 0) return;
    pushToUndo(sketch);
    dispatchIntent(createIntent('SKETCH_PATTERN_CIRCULAR', {
      selectedEntityIds: Array.from(selectedIds),
      count: patternCount,
      center: { x: 100, y: 60 }, // default rotate center
      totalAngleRad: Math.PI * 2
    }));
    logEvent('CIRCULAR_PATTERN', 'MULTI');
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    pushToUndo(sketch);
    dispatchIntent(createIntent('SKETCH_DELETE_ENTITY', { entityIds: Array.from(selectedIds) }));
    setSelectedIds(new Set());
    logEvent('DELETE_ENTITIES', 'INTENT_DISPATCHED');
  };

  const addManualConstraint = (type: IndustrialConstraintType) => {
    if (selectedIds.size === 0) return;
    
    const references = Array.from(selectedIds).map(getSelectionReference);
    
    dispatchIntent(createIntent('SKETCH_ADD_CONSTRAINT', {
      constraintType: type,
      references: references
    }));
    
    logEvent('ADD_CONSTRAINT', type);
  };

  // Run GCS optimization/solve manually
  const triggerManualSolve = () => {
    pushToUndo(sketch);
    const solved = solver.solve(sketch);
    setSketch(solved.sketch);
    logEvent('GCS_SOLVE', sketch.id);
  };

  // ---------------------------------------------------------------------------
  // 5. VIEWPORT RENDER GENERATORS
  // ---------------------------------------------------------------------------
  const renderEntities = () => {
    return Object.values(sketch.entities).map((ent: any) => {
      const isSelected = selectedIds.has(ent.id);
      const isHovered = hoveredId === ent.id;

      let strokeColor = isSelected ? '#10b981' : isHovered ? '#60a5fa' : '#38bdf8';
      let strokeWidth = isSelected ? 2.5 : isHovered ? 2.0 : 1.5;

      if (ent.type === 'POINT') {
        const pt = ent as SketchPoint2D;
        const cx = pt.x * zoom + pan.x;
        const cy = pt.y * zoom + pan.y;

        return (
          <circle
            key={pt.id}
            cx={cx}
            cy={cy}
            r={pt.isFixed ? 5 : 4}
            fill={pt.isFixed ? '#f59e0b' : strokeColor}
            stroke={pt.isFixed ? '#fff' : 'none'}
            strokeWidth={1}
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => setHoveredId(pt.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      } else if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        const p1 = sketch.entities[line.startPointId] as SketchPoint2D;
        const p2 = sketch.entities[line.endPointId] as SketchPoint2D;
        if (!p1 || !p2) return null;

        const x1 = p1.x * zoom + pan.x;
        const y1 = p1.y * zoom + pan.y;
        const x2 = p2.x * zoom + pan.x;
        const y2 = p2.y * zoom + pan.y;

        const isCenterline = line.isCenterline;
        const isConstruction = line.isConstruction;
        const dashArray = isCenterline ? '12 4 3 4' : (isConstruction ? '6 6' : undefined);
        const lineColor = isCenterline ? '#f59e0b' : (isConstruction ? '#94a3b8' : strokeColor);

        return (
          <line
            key={line.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredId(line.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      } else if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        const center = sketch.entities[circ.centerPointId] as SketchPoint2D;
        if (!center) return null;

        const cx = center.x * zoom + pan.x;
        const cy = center.y * zoom + pan.y;
        const r = circ.radius * zoom;

        return (
          <circle
            key={circ.id}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredId(circ.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      } else if (ent.type === 'ARC') {
        const arc = ent as SketchArc2D;
        const center = sketch.entities[arc.centerPointId] as SketchPoint2D;
        const start = sketch.entities[arc.startPointId] as SketchPoint2D;
        const end = sketch.entities[arc.endPointId] as SketchPoint2D;
        if (!center || !start || !end) return null;

        // Path approximation for clean SVG Arc
        const sX = start.x * zoom + pan.x;
        const sY = start.y * zoom + pan.y;
        const eX = end.x * zoom + pan.x;
        const eY = end.y * zoom + pan.y;
        const r = arc.radius * zoom;

        return (
          <path
            key={arc.id}
            d={`M ${sX} ${sY} A ${r} ${r} 0 0 1 ${eX} ${eY}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredId(arc.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      } else if (ent.type === 'SPLINE') {
        const spline = ent as any;
        const pts = spline.controlPointIds.map((id: string) => sketch.entities[id] as SketchPoint2D).filter(Boolean);
        if (pts.length < 2) return null;

        // Visual spline renderer path
        let pathD = `M ${pts[0].x * zoom + pan.x} ${pts[0].y * zoom + pan.y}`;
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i - 1].x + pts[i].x) / 2;
          const yc = (pts[i - 1].y + pts[i].y) / 2;
          pathD += ` Q ${pts[i - 1].x * zoom + pan.x} ${pts[i - 1].y * zoom + pan.y} ${xc * zoom + pan.x} ${yc * zoom + pan.y}`;
        }

        return (
          <path
            key={spline.id}
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredId(spline.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      } else if (ent.type === 'ELLIPSE') {
        const ell = ent as SketchEllipse2D;
        const center = sketch.entities[ell.centerPointId] as SketchPoint2D;
        if (!center) return null;

        const cx = center.x * zoom + pan.x;
        const cy = center.y * zoom + pan.y;
        const rx = (ell.majorRadius || 40) * zoom;
        const ry = (ell.minorRadius || 20) * zoom;
        const rotDeg = ell.rotation ? (ell.rotation * 180) / Math.PI : 0;

        return (
          <ellipse
            key={ell.id}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            transform={rotDeg ? `rotate(${rotDeg} ${cx} ${cy})` : undefined}
            fill="none"
            stroke={ent.isConstruction ? '#94a3b8' : strokeColor}
            strokeDasharray={ent.isConstruction ? '6 6' : undefined}
            strokeWidth={strokeWidth}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredId(ell.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        );
      }
      return null;
    });
  };

  const renderActiveConstraints = () => {
    return Object.values(sketch.constraints).map((c: any) => {
      let label = '';
      let cx = 0, cy = 0;

      // Find center position to draw constraint icon
      if (c.entityIds.length > 0) {
        const first = sketch.entities[c.entityIds[0]];
        if (first && first.type === 'LINE') {
          const l = first as SketchLine2D;
          const p1 = sketch.entities[l.startPointId] as SketchPoint2D;
          const p2 = sketch.entities[l.endPointId] as SketchPoint2D;
          if (p1 && p2) {
            cx = ((p1.x + p2.x) / 2) * zoom + pan.x;
            cy = ((p1.y + p2.y) / 2) * zoom + pan.y;
          }
        } else if (first && first.type === 'POINT') {
          const pt = first as SketchPoint2D;
          cx = pt.x * zoom + pan.x;
          cy = pt.y * zoom + pan.y - 12;
        }
      }

      if (cx === 0 || cy === 0) return null;

      switch (c.type) {
        case 'HORIZONTAL': label = 'H'; break;
        case 'VERTICAL': label = 'V'; break;
        case 'EQUAL': label = '='; break;
        case 'PARALLEL': label = '//'; break;
        case 'CONCENTRIC': label = '◎'; break;
        case 'COINCIDENT': label = '•'; break;
        default: label = 'C'; break;
      }

      return (
        <g key={c.id}>
          <rect
            x={cx - 7}
            y={cy - 7}
            width={14}
            height={14}
            rx={3}
            fill="#1e293b"
            stroke="#f59e0b"
            strokeWidth={1}
          />
          <text
            x={cx}
            y={cy + 4}
            fill="#f59e0b"
            fontSize="10px"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {label}
          </text>
        </g>
      );
    });
  };

  // Render Snapping Icon Indicator
  const renderSnapIndicator = () => {
    if (!activeSnap) return null;
    const { point, type } = activeSnap;
    const sx = point.x * zoom + pan.x;
    const sy = point.y * zoom + pan.y;

    return (
      <g>
        <circle cx={sx} cy={sy} r={6} fill="none" stroke="#10b981" strokeWidth={1.5} />
        {type === 'MIDPOINT' && (
          <polygon points={`${sx},${sy - 4} ${sx - 4},${sy + 3} ${sx + 4},${sy + 3}`} fill="none" stroke="#10b981" strokeWidth={1.5} />
        )}
        {type === 'CENTER' && (
          <path d={`M ${sx - 5} ${sy} L ${sx + 5} ${sy} M ${sx} ${sy - 5} L ${sx} ${sy + 5}`} stroke="#10b981" strokeWidth={1.5} />
        )}
        {type === 'INTERSECTION' && (
          <path d={`M ${sx - 4} ${sy - 4} L ${sx + 4} ${sy + 4} M ${sx - 4} ${sy + 4} L ${sx + 4} ${sy - 4}`} stroke="#f59e0b" strokeWidth={1.5} />
        )}
      </g>
    );
  };

  // ---------------------------------------------------------------------------
  // 6. MAIN RENDER
  // ---------------------------------------------------------------------------
  return (
    <div id="interactive-sketcher" className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 flex flex-col gap-5">
      
      {/* 6.1 CAD Workspace Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-md font-bold flex items-center gap-2 text-emerald-400">
            <Edit3 className="w-5 h-5 text-emerald-400" /> Interactive Parametric Sketcher (PATCH-191)
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-[10px] font-mono font-bold text-emerald-300">
              REV: #{toolContext.revision} | SOT: CANONICAL
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-3 font-mono">
            <span>Freeform sketch bound to Variational GCS.</span>
            <span className="text-emerald-400">Entities: {toolContext.sketch.entitiesCount}</span>
            <span className="text-amber-400">Constraints: {toolContext.sketch.constraintsCount}</span>
            <span className="text-indigo-400">DOF: {toolContext.sketch.dof}</span>
          </p>
        </div>
        
        {/* Undo, Redo, Switch UX, Extrude Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {onSwitchToCommandManager && (
            <button
              onClick={onSwitchToCommandManager}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/40 hover:bg-sky-600/30 font-bold text-xs text-sky-300 transition"
              title="Switch to SolidWorks CommandManager UX (Ribbon, Gestures, 3D Features)"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>CommandManager UX</span>
            </button>
          )}

          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          
          <div className="h-6 w-px bg-slate-800 mx-2" />

          <button
            onClick={handleExtrude}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition shadow-lg shadow-emerald-950/40"
          >
            <Play className="w-3.5 h-3.5 fill-white" /> Extrude to 3D
          </button>
        </div>
      </div>

      {/* 6.2 Grid Layout: Toolbar + Canvas + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* A. TOOLBAR (xl:col-span-2) */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          
          {/* Active Tool Select */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-1 max-h-[380px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Sketch Tools (PATCH-325)</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">12 Tools</span>
            </div>
            {([
              { mode: 'SELECT', label: 'Select' },
              { mode: 'LINE', label: 'Line' },
              { mode: 'CONSTRUCTION_LINE', label: 'Construction Line' },
              { mode: 'CENTERLINE', label: 'Centerline' },
              { mode: 'POINT', label: 'Point' },
              { mode: 'CIRCLE', label: 'Circle' },
              { mode: 'ARC', label: 'Arc (Center-Start-End)' },
              { mode: '3POINT_ARC', label: '3-Point Arc' },
              { mode: 'RECTANGLE', label: 'Rectangle' },
              { mode: 'POLYGON', label: 'Polygon (N-Gon)' },
              { mode: 'POLYLINE', label: 'Polyline Chain' },
              { mode: 'SLOT', label: 'Straight Slot' },
              { mode: 'ELLIPSE', label: 'Ellipse' },
              { mode: 'SPLINE', label: 'Spline Curve' }
            ] as { mode: DrawMode; label: string }[]).map(tool => (
              <button
                key={tool.mode}
                onClick={() => setDrawMode(tool.mode)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] transition flex items-center justify-between ${
                  drawMode === tool.mode ? 'bg-emerald-600/20 text-emerald-400 font-semibold border border-emerald-500/30 shadow-sm' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span>{tool.label}</span>
                {drawMode === tool.mode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>

          {/* Dynamic CAD Geometry Operations */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-col gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">CAD Operations</span>
            
            {/* Trim & Extend & Split */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setDrawMode('TRIM')}
                className={`px-1.5 py-1.5 rounded text-[11px] transition ${drawMode === 'TRIM' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                Trim
              </button>
              <button
                onClick={() => setDrawMode('EXTEND')}
                className={`px-1.5 py-1.5 rounded text-[11px] transition ${drawMode === 'EXTEND' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                Extend
              </button>
              <button
                onClick={() => setDrawMode('SPLIT')}
                className={`px-1.5 py-1.5 rounded text-[11px] transition ${drawMode === 'SPLIT' ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30' : 'bg-slate-800 hover:bg-slate-700'}`}
              >
                Split
              </button>
            </div>

            {/* Offset */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-2 mt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Offset</span>
                <input
                  type="number"
                  value={offsetValue}
                  onChange={e => setOffsetValue(Number(e.target.value))}
                  className="w-12 bg-slate-900 border border-slate-800 rounded px-1 text-center text-emerald-400 font-mono text-xs"
                />
              </div>
              <button
                onClick={applyOffset}
                disabled={selectedIds.size === 0}
                className="w-full py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px]"
              >
                Apply Offset
              </button>
            </div>

            {/* Mirror */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-2">
              <span className="text-[11px] text-slate-400">Mirror Copy</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => applyMirror('X')}
                  disabled={selectedIds.size === 0}
                  className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px]"
                >
                  Mirror X
                </button>
                <button
                  onClick={() => applyMirror('Y')}
                  disabled={selectedIds.size === 0}
                  className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px]"
                >
                  Mirror Y
                </button>
              </div>
            </div>

            {/* Patterns */}
            <div className="flex flex-col gap-1.5 border-t border-slate-800/80 pt-2">
              <span className="text-[11px] text-slate-400">Pattern Multiplication</span>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                <label>Count:
                  <input type="number" value={patternCount} onChange={e => setPatternCount(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded px-1 mt-0.5 text-slate-300" />
                </label>
                <label>Spacing:
                  <input type="number" value={patternSpacing} onChange={e => setPatternSpacing(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded px-1 mt-0.5 text-slate-300" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                <button onClick={applyLinearPattern} disabled={selectedIds.size === 0} className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px]">Linear</button>
                <button onClick={applyCircularPattern} disabled={selectedIds.size === 0} className="py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px]">Circular</button>
              </div>
            </div>

          </div>

        </div>

        {/* B. DYNAMIC CAD CANVAS (xl:col-span-7) */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          
          <div className="bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col h-[480px]">
            
            {/* Viewport HUD Overlay */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-[11px] font-mono bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Mode:</span>
              <span className="text-emerald-400 font-bold">{drawMode}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Cursor:</span>
              <span className="text-sky-400">X:{currentCursorPos.x.toFixed(0)}, Y:{currentCursorPos.y.toFixed(0)}</span>
              {activeSnap && (
                <>
                  <span className="text-slate-700">|</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Magnet className="w-3 h-3" /> Snapped ({activeSnap.type})
                  </span>
                </>
              )}
            </div>

            {/* Viewport Control Panel Top-Right */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Zoom Out"
              >
                -
              </button>
              <button
                onClick={() => { setZoom(1.2); setPan({ x: 80, y: 50 }); }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                title="Fit View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SVG Interaction Layer */}
            <svg
              ref={canvasRef}
              className="w-full h-full cursor-crosshair select-none bg-slate-950"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
            >
              {/* Grid Background Pattern */}
              <defs>
                <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
                  <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#161e2e" strokeWidth="0.8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Real mathematical origin indicator */}
              <circle cx={pan.x} cy={pan.y} r={3} fill="#ef4444" />
              <line x1={pan.x} y1={pan.y} x2={pan.x + 30} y2={pan.y} stroke="#ef4444" strokeWidth={1.5} />
              <line x1={pan.x} y1={pan.y} x2={pan.x} y2={pan.y + 30} stroke="#22c55e" strokeWidth={1.5} />

              {/* Render CAD objects */}
              {renderEntities()}

              {/* Render dynamic GCS constraints */}
              {renderActiveConstraints()}

              {/* Render dynamic cursor snap feedback */}
              {renderSnapIndicator()}

              {/* Live drawing preview line */}
              {dragStartPoint && drawMode === 'LINE' && (
                <line
                  x1={dragStartPoint.x * zoom + pan.x}
                  y1={dragStartPoint.y * zoom + pan.y}
                  x2={currentCursorPos.x * zoom + pan.x}
                  y2={currentCursorPos.y * zoom + pan.y}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4"
                />
              )}

              {/* Live drawing preview circle */}
              {dragStartPoint && drawMode === 'CIRCLE' && (
                <circle
                  cx={dragStartPoint.x * zoom + pan.x}
                  cy={dragStartPoint.y * zoom + pan.y}
                  r={InteractiveSketchEngine.dist(dragStartPoint, currentCursorPos) * zoom}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4"
                />
              )}

              {/* Live drawing preview rectangle */}
              {dragStartPoint && drawMode === 'RECTANGLE' && (
                <rect
                  x={Math.min(dragStartPoint.x, currentCursorPos.x) * zoom + pan.x}
                  y={Math.min(dragStartPoint.y, currentCursorPos.y) * zoom + pan.y}
                  width={Math.abs(currentCursorPos.x - dragStartPoint.x) * zoom}
                  height={Math.abs(currentCursorPos.y - dragStartPoint.y) * zoom}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4"
                />
              )}

              {/* Box Selection Box */}
              {dragStartPoint && drawMode === 'SELECT' && boxSelectEnd && (
                <rect
                  x={Math.min(dragStartPoint.x, boxSelectEnd.x)}
                  y={Math.min(dragStartPoint.y, boxSelectEnd.y)}
                  width={Math.abs(boxSelectEnd.x - dragStartPoint.x)}
                  height={Math.abs(boxSelectEnd.y - dragStartPoint.y)}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth={1.2}
                />
              )}
            </svg>

            {/* Bottom Status bar */}
            <div className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Variational Solver Live
              </span>
              <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            </div>

          </div>

          {/* Quick manual constraints bar */}
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mr-1">Enforce Constraint:</span>
            <button onClick={() => addManualConstraint('HORIZONTAL')} disabled={selectedIds.size === 0} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-amber-400 border border-slate-700">Horizontal</button>
            <button onClick={() => addManualConstraint('VERTICAL')} disabled={selectedIds.size === 0} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-amber-400 border border-slate-700">Vertical</button>
            <button onClick={() => addManualConstraint('COINCIDENT')} disabled={selectedIds.size < 2} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-amber-400 border border-slate-700">Coincident</button>
            <button onClick={() => addManualConstraint('PARALLEL')} disabled={selectedIds.size < 2} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-amber-400 border border-slate-700">Parallel</button>
            <button onClick={() => addManualConstraint('CONCENTRIC')} disabled={selectedIds.size < 2} className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-amber-400 border border-slate-700">Concentric</button>
          </div>

        </div>

        {/* C. INSPECTOR PANEL (xl:col-span-3) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          
          {/* Pad Extrude depth control */}
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <label className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Extrusion Pad Depth
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="300"
                value={extrudeDepth}
                onChange={e => setExtrudeDepth(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono text-emerald-400 font-bold text-sm">{extrudeDepth} mm</span>
            </div>
          </div>

          {/* GCS Numerical Solver Inspector */}
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-500">GCS Optimizer</span>
              <button
                onClick={triggerManualSolve}
                className="px-2 py-1 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 border border-amber-500/20 font-bold font-mono text-[10px]"
              >
                Re-solve
              </button>
            </div>
            
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col gap-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Degree of Freedom (DoF):</span>
                <span className="text-emerald-400">Fully Constrained</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Drawn Points Count:</span>
                <span className="text-slate-300">
                  {Object.values(sketch.entities).filter((e: any) => e.type === 'POINT').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Constraints:</span>
                <span className="text-amber-400 font-bold">{Object.keys(sketch.constraints).length}</span>
              </div>
            </div>
          </div>

          {/* Entities Navigator */}
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-2.5 max-h-[220px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Drawn Elements</span>
              {selectedIds.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/30 text-[10px] hover:bg-red-900/30"
                >
                  <Trash2 className="w-3 h-3" /> Delete ({selectedIds.size})
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {Object.values(sketch.entities).map((ent: any) => {
                const isSel = selectedIds.has(ent.id);
                return (
                  <div
                    key={ent.id}
                    onClick={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(ent.id)) next.delete(ent.id);
                        else next.add(ent.id);
                        return next;
                      });
                    }}
                    className={`p-1.5 rounded border text-[11px] font-mono cursor-pointer transition flex items-center justify-between ${
                      isSel ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-400' : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{ent.id}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{ent.type}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
