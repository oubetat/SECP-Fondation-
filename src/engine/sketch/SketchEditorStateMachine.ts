/**
 * SECP CAD Kernel — Sketch Editor Interaction State Machine
 * Authoritative single state machine governing interactive drawing,
 * flat entity generation, canonical mutation, and document synchronization.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import {
  CanonicalSketch,
  createEmptyCanonicalSketch,
  getActiveCanonicalSketch,
  updateCanonicalSketchInDocument,
  mutateAddFlatEntities,
  mutateDeleteFlatEntity,
  mutateAddFlatConstraint
} from './canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from './canonical/CanonicalSketchAdapter';
import { SketchEntity, SketchConstraintType } from '../geometry/SketchEngine';

export type SketchEditorTool =
  | 'SELECT'
  | 'LINE'
  | 'CONSTRUCTION_LINE'
  | 'CENTERLINE'
  | 'POINT'
  | 'CIRCLE'
  | 'RECTANGLE'
  | 'ARC'
  | '3POINT_ARC'
  | 'SPLINE'
  | 'ELLIPSE'
  | 'POLYGON'
  | 'POLYLINE'
  | 'SLOT'
  | '3D_LINE'
  | 'TRIM'
  | 'EXTEND'
  | 'FILLET'
  | 'CHAMFER'
  | 'DIMENSION';

export interface StateMachineListener {
  onStateChange?: (state: SketchEditorStateSnapshot) => void;
  onCanonicalUpdate?: (doc: EngineeringDocument | undefined, sketch: CanonicalSketch) => void;
  onNotify?: (message: string) => void;
}

export interface SketchEditorStateSnapshot {
  activeTool: SketchEditorTool;
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;
  mousePos: { x: number; y: number };
  selectedEntity: string | null;
  hoveredEntity: string | null;
  isConstruction: boolean;
  activeCanonical: CanonicalSketch;
  flatEntities: SketchEntity[];
}

export class SketchEditorStateMachine {
  private activeTool: SketchEditorTool = 'SELECT';
  private isDrawing: boolean = false;
  private drawingStart: { x: number; y: number } | null = null;
  private mousePos: { x: number; y: number } = { x: 350, y: 250 };
  private selectedEntity: string | null = null;
  private hoveredEntity: string | null = null;
  private isConstruction: boolean = false;

  private internalSketch: CanonicalSketch;
  private canonicalDocument?: EngineeringDocument;
  private activeSketchId?: string | null;
  private listeners: StateMachineListener = {};

  constructor(options?: {
    canonicalDocument?: EngineeringDocument;
    activeSketchId?: string | null;
    canonicalSketch?: CanonicalSketch;
    listeners?: StateMachineListener;
  }) {
    this.canonicalDocument = options?.canonicalDocument;
    this.activeSketchId = options?.activeSketchId;
    if (options?.listeners) {
      this.listeners = options.listeners;
    }

    if (options?.canonicalSketch) {
      this.internalSketch = options.canonicalSketch;
    } else if (this.canonicalDocument) {
      const fromDoc = getActiveCanonicalSketch(this.canonicalDocument, this.activeSketchId);
      this.internalSketch = fromDoc || createEmptyCanonicalSketch('SKETCH_01', 'Sketch_1');
    } else {
      this.internalSketch = createEmptyCanonicalSketch('SKETCH_01', 'Sketch_1');
    }
  }

  public getActiveTool(): SketchEditorTool {
    return this.activeTool;
  }

  public setTool(tool: SketchEditorTool): void {
    this.activeTool = tool;
    this.isDrawing = false;
    this.drawingStart = null;
    this.emitChange();
  }

  public getIsDrawing(): boolean {
    return this.isDrawing;
  }

  public getDrawingStart(): { x: number; y: number } | null {
    return this.drawingStart ? { ...this.drawingStart } : null;
  }

  public getSelectedEntity(): string | null {
    return this.selectedEntity;
  }

  public setSelectedEntity(id: string | null): void {
    this.selectedEntity = id;
    this.emitChange();
  }

  public getHoveredEntity(): string | null {
    return this.hoveredEntity;
  }

  public setHoveredEntity(id: string | null): void {
    this.hoveredEntity = id;
    this.emitChange();
  }

  public setIsConstruction(val: boolean): void {
    this.isConstruction = val;
    this.emitChange();
  }

  public getActiveCanonical(): CanonicalSketch {
    return this.internalSketch;
  }

  public getCanonicalDocument(): EngineeringDocument | undefined {
    return this.canonicalDocument;
  }

  public getFlatEntities(): SketchEntity[] {
    return CanonicalSketchAdapter.toFlatEntities(this.internalSketch);
  }

  public getSnapshot(): SketchEditorStateSnapshot {
    return {
      activeTool: this.activeTool,
      isDrawing: this.isDrawing,
      drawingStart: this.drawingStart ? { ...this.drawingStart } : null,
      mousePos: { ...this.mousePos },
      selectedEntity: this.selectedEntity,
      hoveredEntity: this.hoveredEntity,
      isConstruction: this.isConstruction,
      activeCanonical: this.internalSketch,
      flatEntities: this.getFlatEntities()
    };
  }

  /**
   * Commit a canonical mutation through the single authoritative path.
   */
  public commitCanonicalMutation(updatedCanonical: CanonicalSketch): void {
    this.internalSketch = updatedCanonical;
    if (this.canonicalDocument) {
      const updatedDoc = updateCanonicalSketchInDocument(this.canonicalDocument, updatedCanonical);
      this.canonicalDocument = updatedDoc;
      if (this.listeners.onCanonicalUpdate) {
        this.listeners.onCanonicalUpdate(updatedDoc, updatedCanonical);
      }
    } else if (this.listeners.onCanonicalUpdate) {
      this.listeners.onCanonicalUpdate(undefined, updatedCanonical);
    }
    this.emitChange();
  }

  /**
   * Mouse Move: updates current cursor position.
   */
  public handleMouseMove(coords: { x: number; y: number }): void {
    this.mousePos = { ...coords };
    this.emitChange();
  }

  /**
   * Mouse Down: Initiates or completes a drawing operation based on state.
   */
  public handleMouseDown(coords: { x: number; y: number }): void {
    if (this.activeTool === 'SELECT') {
      if (this.hoveredEntity) {
        this.selectedEntity = this.hoveredEntity;
      } else {
        this.selectedEntity = null;
      }
      this.emitChange();
      return;
    }

    if (this.activeTool === 'TRIM') {
      if (this.hoveredEntity) {
        const updated = mutateDeleteFlatEntity(this.internalSketch, this.hoveredEntity);
        this.commitCanonicalMutation(updated);
        if (this.selectedEntity === this.hoveredEntity) {
          this.selectedEntity = null;
        }
        this.hoveredEntity = null;
        this.notify('Trimmed selected entity');
      }
      return;
    }

    if (this.activeTool === 'DIMENSION') {
      if (this.hoveredEntity) {
        this.selectedEntity = this.hoveredEntity;
        const updated = mutateAddFlatConstraint(this.internalSketch, this.hoveredEntity, 'DISTANCE');
        this.commitCanonicalMutation(updated);
        this.notify(`Smart Dimension applied to ${this.hoveredEntity}`);
      }
      return;
    }

    if (this.activeTool === 'POINT') {
      const entities = this.getFlatEntities();
      const entSeq = (entities.length + 1).toString().padStart(4, '0');
      const newPoint: SketchEntity = {
        id: `ENT-PT-${entSeq}`,
        type: 'POINT',
        points: [{ x: coords.x, y: coords.y }],
        params: {},
        constraints: [],
        isConstruction: this.isConstruction
      };
      const updated = mutateAddFlatEntities(this.internalSketch, [newPoint]);
      this.commitCanonicalMutation(updated);
      this.selectedEntity = newPoint.id;
      this.notify(`Created Point at (${coords.x}, ${coords.y}) mm`);
      return;
    }

    // Two-click workflow: if drawing is already started, second click finishes it
    if (this.isDrawing && this.drawingStart) {
      this.finishDrawing(coords);
      return;
    }

    // First click: record starting coordinate and enter drawing state
    this.drawingStart = { ...coords };
    this.isDrawing = true;
    this.emitChange();
  }

  /**
   * Mouse Up: Drag-release completion workflow.
   */
  public handleMouseUp(coords: { x: number; y: number }): void {
    if (!this.isDrawing || !this.drawingStart) return;

    const dist = Math.hypot(coords.x - this.drawingStart.x, coords.y - this.drawingStart.y);
    if (dist >= 4) {
      // Drag workflow: release completes shape
      this.finishDrawing(coords);
    }
    // If dist < 4, keep isDrawing = true for two-click workflow!
  }

  /**
   * Escape key: cancels in-flight drawing or deselects.
   */
  public handleEscape(): void {
    this.activeTool = 'SELECT';
    this.isDrawing = false;
    this.drawingStart = null;
    this.emitChange();
  }

  /**
   * Delete key: removes selected entity from authoritative canonical sketch.
   */
  public handleDelete(): void {
    if (!this.selectedEntity) return;
    const updated = mutateDeleteFlatEntity(this.internalSketch, this.selectedEntity);
    this.commitCanonicalMutation(updated);
    this.selectedEntity = null;
    this.notify('Deleted selected entity');
  }

  /**
   * Finish drawing: produces flat entities, converts to canonical entities,
   * commits mutation, and resets interaction state.
   */
  public finishDrawing(coords: { x: number; y: number }): void {
    if (!this.drawingStart) return;

    const entities = this.getFlatEntities();
    const newFlatEntities: SketchEntity[] = [];
    const baseSeq = entities.length + 1;

    if (this.activeTool === 'LINE' || this.activeTool === 'CONSTRUCTION_LINE' || this.activeTool === 'CENTERLINE') {
      const dist = Math.hypot(coords.x - this.drawingStart.x, coords.y - this.drawingStart.y);
      const endX = dist >= 3 ? coords.x : this.drawingStart.x + 100;
      const endY = dist >= 3 ? coords.y : this.drawingStart.y;
      const isCenter = this.activeTool === 'CENTERLINE';
      const isConst = this.activeTool === 'CONSTRUCTION_LINE' || isCenter || this.isConstruction;
      newFlatEntities.push({
        id: `ENT-LINE-${baseSeq.toString().padStart(4, '0')}`,
        type: 'LINE',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }, { x: endX, y: endY }],
        params: {},
        constraints: this.drawingStart.y === endY ? ['HORIZONTAL'] : (this.drawingStart.x === endX ? ['VERTICAL'] : []),
        isConstruction: isConst,
        isCenterline: isCenter
      });
      const label = isCenter ? 'Centerline' : (isConst ? 'Construction Line' : 'Line');
      this.notify(`Drawn ${label}`);
    } else if (this.activeTool === 'POINT') {
      newFlatEntities.push({
        id: `ENT-PT-${baseSeq.toString().padStart(4, '0')}`,
        type: 'POINT',
        points: [{ x: coords.x, y: coords.y }],
        params: {},
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify(`Created Point`);
    } else if (this.activeTool === 'CIRCLE') {
      const radius = Math.round(Math.hypot(coords.x - this.drawingStart.x, coords.y - this.drawingStart.y));
      const finalRadius = radius >= 4 ? radius : 40;
      newFlatEntities.push({
        id: `ENT-CIRC-${baseSeq.toString().padStart(4, '0')}`,
        type: 'CIRCLE',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }],
        params: { radius: finalRadius },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify(`Drawn Circle (R = ${finalRadius} mm)`);
    } else if (this.activeTool === 'RECTANGLE') {
      const w = Math.abs(coords.x - this.drawingStart.x);
      const h = Math.abs(coords.y - this.drawingStart.y);
      const width = w >= 4 ? w : 80;
      const height = h >= 4 ? h : 50;
      const endX = w >= 4 ? coords.x : this.drawingStart.x + width;
      const endY = h >= 4 ? coords.y : this.drawingStart.y + height;
      newFlatEntities.push({
        id: `ENT-RECT-${baseSeq.toString().padStart(4, '0')}`,
        type: 'RECTANGLE',
        points: [
          { x: Math.min(this.drawingStart.x, endX), y: Math.min(this.drawingStart.y, endY) },
          { x: Math.max(this.drawingStart.x, endX), y: Math.max(this.drawingStart.y, endY) }
        ],
        params: { width, height },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify(`Drawn Rectangle (${width} × ${height} mm)`);
    } else if (this.activeTool === 'POLYLINE') {
      const midPoint = { x: Math.round((this.drawingStart.x + coords.x) / 2), y: this.drawingStart.y };
      newFlatEntities.push({
        id: `ENT-POLY1-${baseSeq.toString().padStart(4, '0')}`,
        type: 'LINE',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }, midPoint],
        params: {},
        constraints: [],
        isConstruction: this.isConstruction
      });
      newFlatEntities.push({
        id: `ENT-POLY2-${(baseSeq + 1).toString().padStart(4, '0')}`,
        type: 'LINE',
        points: [midPoint, { x: coords.x, y: coords.y }],
        params: {},
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify('Drawn Polyline');
    } else if (this.activeTool === '3POINT_ARC' || this.activeTool === 'ARC') {
      const midPoint = {
        x: Math.round((this.drawingStart.x + coords.x) / 2),
        y: Math.round((this.drawingStart.y + coords.y) / 2 - 45)
      };
      newFlatEntities.push({
        id: `ENT-ARC-${baseSeq.toString().padStart(4, '0')}`,
        type: 'ARC',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }, midPoint, { x: coords.x, y: coords.y }],
        params: { radius: Math.round(Math.sqrt(Math.pow(coords.x - this.drawingStart.x, 2) + Math.pow(coords.y - this.drawingStart.y, 2)) / 1.4) || 35 },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify('Drawn Arc');
    } else if (this.activeTool === 'SPLINE') {
      const cp1 = { x: this.drawingStart.x, y: this.drawingStart.y };
      const cp2 = { x: Math.round(this.drawingStart.x + (coords.x - this.drawingStart.x) * 0.3), y: this.drawingStart.y - 60 };
      const cp3 = { x: Math.round(this.drawingStart.x + (coords.x - this.drawingStart.x) * 0.7), y: coords.y + 60 };
      const cp4 = { x: coords.x, y: coords.y };
      newFlatEntities.push({
        id: `ENT-SPLINE-${baseSeq.toString().padStart(4, '0')}`,
        type: 'SPLINE',
        points: [cp1, cp2, cp3, cp4],
        params: { segments: 4, degree: 3 },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify('Drawn Spline Curve');
    } else if (this.activeTool === 'ELLIPSE') {
      const rx = Math.max(Math.abs(coords.x - this.drawingStart.x), 50);
      const ry = Math.max(Math.abs(coords.y - this.drawingStart.y), 30);
      newFlatEntities.push({
        id: `ENT-ELLIPSE-${baseSeq.toString().padStart(4, '0')}`,
        type: 'ELLIPSE',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }],
        params: { rx, ry },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify(`Drawn Ellipse (rx=${rx}, ry=${ry} mm)`);
    } else if (this.activeTool === 'POLYGON') {
      const radius = Math.max(Math.round(Math.hypot(coords.x - this.drawingStart.x, coords.y - this.drawingStart.y)), 40);
      const sides = 6;
      const polyPts = [];
      for (let s = 0; s < sides; s++) {
        const ang = (s * 2 * Math.PI) / sides - Math.PI / 2;
        polyPts.push({
          x: Math.round(this.drawingStart.x + radius * Math.cos(ang)),
          y: Math.round(this.drawingStart.y + radius * Math.sin(ang))
        });
      }
      newFlatEntities.push({
        id: `ENT-POLY-${baseSeq.toString().padStart(4, '0')}`,
        type: 'POLYGON',
        points: polyPts,
        params: { sides, radius },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify(`Drawn Hexagon Polygon (R=${radius} mm)`);
    } else if (this.activeTool === 'SLOT') {
      const p2 = Math.hypot(coords.x - this.drawingStart.x, coords.y - this.drawingStart.y) < 5
        ? { x: this.drawingStart.x + 80, y: this.drawingStart.y }
        : { x: coords.x, y: coords.y };
      newFlatEntities.push({
        id: `ENT-SLOT-${baseSeq.toString().padStart(4, '0')}`,
        type: 'SLOT',
        points: [{ x: this.drawingStart.x, y: this.drawingStart.y }, p2],
        params: { slotWidth: 30 },
        constraints: [],
        isConstruction: this.isConstruction
      });
      this.notify('Drawn Straight Slot');
    }

    if (newFlatEntities.length > 0) {
      const updatedCanonical = mutateAddFlatEntities(this.internalSketch, newFlatEntities);
      this.commitCanonicalMutation(updatedCanonical);
      this.selectedEntity = newFlatEntities[0].id;
    }

    this.isDrawing = false;
    this.drawingStart = null;
    this.emitChange();
  }

  private notify(msg: string): void {
    if (this.listeners.onNotify) {
      this.listeners.onNotify(msg);
    }
  }

  private emitChange(): void {
    if (this.listeners.onStateChange) {
      this.listeners.onStateChange(this.getSnapshot());
    }
  }
}
