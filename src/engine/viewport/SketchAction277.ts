/**
 * SECP CAD Kernel — Canonical Sketch Action
 * Phase PATCH-PROMPT-016: Sketch Tool Convergence
 *
 * ARCHITECTURAL CONTRACT:
 * - Implements the full canonical path for sketch mutations.
 * - Source of truth: CanonicalSketch inside EngineeringDocument.
 * - Every mutation creates a new revision of the document.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { 
  CanonicalSketch, 
  mutateAddEntities, 
  mutateDeleteEntity,
  updateCanonicalSketchInDocument,
  getActiveCanonicalSketch,
  solveCanonicalSketch,
  mutateAddConstraint, 
  regenerateSketchMirrors, 
  regenerateSketchPatterns,
  SketchMirrorDefinition,
  SketchPatternDefinition 
} from '../sketch/canonical/CanonicalSketchContract';
import { CanonicalSketchAdapter } from '../sketch/canonical/CanonicalSketchAdapter';
import { InteractiveSketchEngine } from '../sketch/InteractiveSketchEngine';
import { SketchCreationTools } from '../sketch/SketchCreationTools';
import { 
  IndustrialSketchEntity, 
  SketchPoint2D, 
  SketchLine2D, 
  SketchCircle2D, 
  SketchArc2D,
  IndustrialSketchConstraint 
} from '../sketch/IndustrialConstraintTypes';
import { CanonicalAction } from './CanonicalAction277';
import { 
  AnyEngineeringIntent, 
  DispatchResult, 
  SketchLineIntent, 
  SketchConstructionLineIntent,
  SketchCenterlineIntent,
  SketchCircleIntent, 
  SketchRectangleIntent,
  SketchArcIntent,
  Sketch3PointArcIntent,
  SketchPolylineIntent,
  SketchPointIntent,
  SketchPolygonIntent,
  SketchSlotIntent,
  SketchEllipseIntent,
  SketchDeleteEntityIntent,
  SketchTrimIntent,
  SketchExtendIntent,
  SketchSplitIntent,
  SketchOffsetIntent,
  SketchMirrorIntent,
  SketchPatternLinearIntent,
  SketchPatternCircularIntent,
  SketchAddConstraintIntent,
  SketchCornerRectangleIntent,
  SketchCenterRectangleIntent,
  Sketch3PointRectangleIntent,
  SketchParallelogramIntent,
  Sketch3PointCircleIntent,
  SketchTangentArcIntent,
  SketchMidpointLineIntent,
  SketchCenterpointArcIntent,
  SketchMoveIntent,
  SketchRotateIntent,
  SketchScaleIntent
} from './EngineeringIntent277';
import { SelectionReference, SketchEntityReference } from './SelectionTypes277';
import { EngineeringIntentType } from './EngineeringIntent277';

export class SketchAction277 implements CanonicalAction<AnyEngineeringIntent> {
  public readonly actionId = 'SKETCH_ACTION';

  public async execute(
    intent: AnyEngineeringIntent,
    document: EngineeringDocument
  ): Promise<DispatchResult> {
    
    const sketchId = (intent.parameters as any).sketchId;
    const sketch = getActiveCanonicalSketch(document, sketchId);
    
    if (!sketch) {
      throw new Error(`SKETCH_NOT_FOUND: Could not find active sketch '${sketchId}' in document.`);
    }

    let updatedSketch: CanonicalSketch = sketch;
    const affectedEntities: string[] = [];

    switch (intent.toolId) {
      case 'SKETCH_LINE':
      case 'SKETCH_CONSTRUCTION_LINE':
      case 'SKETCH_CENTERLINE':
        updatedSketch = this.handleLine(intent as any, sketch, affectedEntities);
        break;
      case 'SKETCH_CIRCLE':
      case 'SKETCH_3POINT_CIRCLE':
        updatedSketch = this.handleCircle(intent as any, sketch, affectedEntities);
        break;
      case 'SKETCH_RECTANGLE':
      case 'SKETCH_CORNER_RECTANGLE':
      case 'SKETCH_CENTER_RECTANGLE':
      case 'SKETCH_3POINT_RECTANGLE':
      case 'SKETCH_3POINT_CENTER_RECTANGLE':
      case 'SKETCH_PARALLELOGRAM':
        updatedSketch = this.handleRectangle(intent as any, sketch, affectedEntities);
        break;
      case 'SKETCH_ARC':
        updatedSketch = this.handleArc(intent as SketchArcIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_3POINT_ARC':
        updatedSketch = this.handle3PointArc(intent as Sketch3PointArcIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_CENTERPOINT_ARC':
        updatedSketch = this.handleCenterpointArc(intent as SketchCenterpointArcIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_TANGENT_ARC':
        updatedSketch = this.handleTangentArc(intent as SketchTangentArcIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_MIDPOINT_LINE':
        updatedSketch = this.handleMidpointLine(intent as SketchMidpointLineIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_MOVE':
        updatedSketch = this.handleMove(intent as SketchMoveIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_ROTATE':
        updatedSketch = this.handleRotate(intent as SketchRotateIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_SCALE':
        updatedSketch = this.handleScale(intent as SketchScaleIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_POLYLINE':
        updatedSketch = this.handlePolyline(intent as SketchPolylineIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_POINT':
        updatedSketch = this.handlePoint(intent as SketchPointIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_POLYGON':
        updatedSketch = this.handlePolygon(intent as SketchPolygonIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_SLOT':
        updatedSketch = this.handleSlot(intent as SketchSlotIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_ELLIPSE':
        updatedSketch = this.handleEllipse(intent as SketchEllipseIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_DELETE_ENTITY':
        updatedSketch = this.handleDelete(intent as SketchDeleteEntityIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_TRIM':
        updatedSketch = this.handleTrim(intent as SketchTrimIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_EXTEND':
        updatedSketch = this.handleExtend(intent as SketchExtendIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_SPLIT':
        updatedSketch = this.handleSplit(intent as SketchSplitIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_OFFSET':
        updatedSketch = this.handleOffset(intent as SketchOffsetIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_MIRROR':
        updatedSketch = this.handleMirror(intent as SketchMirrorIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_PATTERN_LINEAR':
        updatedSketch = this.handlePatternLinear(intent as SketchPatternLinearIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_PATTERN_CIRCULAR':
        updatedSketch = this.handlePatternCircular(intent as SketchPatternCircularIntent, sketch, affectedEntities);
        break;
      case 'SKETCH_ADD_CONSTRAINT':
        updatedSketch = this.handleConstraint(intent as SketchAddConstraintIntent, sketch, affectedEntities);
        break;
      default:
        throw new Error(`UNSUPPORTED_SKETCH_TOOL: ${intent.toolId}`);
    }

    // Solve the sketch (GCS / Constraints)
    const { solvedSketch, solverState } = solveCanonicalSketch(updatedSketch);

    // Update document
    const updatedDoc = updateCanonicalSketchInDocument(document, solvedSketch);

    return {
      success: true,
      documentId: updatedDoc.documentId,
      revision: Number(updatedDoc.revision),
      canonicalActionId: 'SKETCH_MUTATION',
      affectedEntities,
      document: updatedDoc,
      evidence: [
        {
          id: `ev-${Date.now()}`,
          type: 'SKETCH_MUTATION_EVIDENCE',
          timestamp: new Date().toISOString(),
          canonicalActionId: 'SKETCH_MUTATION',
          toolId: intent.toolId,
          affectedEntities
        }
      ],
      evaluationResult: {
        success: solverState.isConverged,
        solverStatus: solverState.status,
        revision: solvedSketch.revision,
        dofReport: {
          remainingDOF: solverState.remainingDegreesOfFreedom,
          totalDOF: solverState.totalDegreesOfFreedom,
          constrainedDOF: solverState.constrainedDegreesOfFreedom,
          conflictingConstraints: solverState.conflictingConstraintIds,
          redundantConstraints: solverState.redundantConstraintIds,
        },
        diagnostics: solverState.diagnosticsReport,
        maxResidual: solverState.maxResidual,
        iterations: solverState.iterations
      }
    };
  }

  private handleLine(
    intent: SketchLineIntent | SketchConstructionLineIntent | SketchCenterlineIntent,
    sketch: CanonicalSketch,
    affected: string[]
  ): CanonicalSketch {
    const isConstruction = intent.parameters.isConstruction ?? (intent.toolId === 'SKETCH_CONSTRUCTION_LINE' || intent.toolId === 'SKETCH_CENTERLINE');
    const isCenterline = intent.parameters.isCenterline ?? (intent.toolId === 'SKETCH_CENTERLINE');

    const result = SketchCreationTools.createLine(
      { x: intent.parameters.startX, y: intent.parameters.startY },
      { x: intent.parameters.endX, y: intent.parameters.endY },
      { isConstruction, isCenterline }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleCircle(intent: any, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    let result;
    if (intent.toolId === 'SKETCH_3POINT_CIRCLE' || (intent.parameters as any).p1) {
      result = SketchCreationTools.create3PointCircle(intent.parameters.p1, intent.parameters.p2, intent.parameters.p3, { isConstruction: intent.parameters.isConstruction });
    } else {
      result = SketchCreationTools.createCircle(
        { x: intent.parameters.centerX, y: intent.parameters.centerY },
        intent.parameters.radius,
        { isConstruction: intent.parameters.isConstruction }
      );
    }
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleRectangle(intent: any, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    let result;
    if (intent.toolId === 'SKETCH_CORNER_RECTANGLE') {
      result = SketchCreationTools.createRectangle(intent.parameters.p1, intent.parameters.p2, { type: 'CORNER', isConstruction: intent.parameters.isConstruction });
    } else if (intent.toolId === 'SKETCH_CENTER_RECTANGLE') {
      result = SketchCreationTools.createRectangle(intent.parameters.center, intent.parameters.corner, { type: 'CENTER', isConstruction: intent.parameters.isConstruction });
    } else if (intent.toolId === 'SKETCH_3POINT_RECTANGLE') {
      result = SketchCreationTools.createRectangle(intent.parameters.p1, intent.parameters.p2, { type: '3POINT', p3: intent.parameters.p3, isConstruction: intent.parameters.isConstruction });
    } else if (intent.toolId === 'SKETCH_3POINT_CENTER_RECTANGLE') {
      result = SketchCreationTools.createRectangle(intent.parameters.p1, intent.parameters.p2, { type: '3POINT_CENTER', p3: intent.parameters.p3, isConstruction: intent.parameters.isConstruction });
    } else if (intent.toolId === 'SKETCH_PARALLELOGRAM') {
      result = SketchCreationTools.createRectangle(intent.parameters.p1, intent.parameters.p2, { type: 'PARALLELOGRAM', p3: intent.parameters.p3, isConstruction: intent.parameters.isConstruction });
    } else {
      // Default / Legacy
      result = SketchCreationTools.createRectangle(
        { x: intent.parameters.startX, y: intent.parameters.startY },
        { x: intent.parameters.endX, y: intent.parameters.endY },
        { isConstruction: intent.parameters.isConstruction }
      );
    }
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleMidpointLine(intent: SketchMidpointLineIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createMidpointLine(intent.parameters.midpoint, intent.parameters.end, { 
      isConstruction: intent.parameters.isConstruction,
      isCenterline: intent.parameters.isCenterline 
    });
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleTangentArc(intent: SketchTangentArcIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const result = SketchCreationTools.createTangentArc(intent.parameters.tangentEntityId, intent.parameters.end, ind, {
      isConstruction: intent.parameters.isConstruction
    });
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleCenterpointArc(intent: SketchCenterpointArcIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createCenterpointArc(intent.parameters.center, intent.parameters.start, intent.parameters.end, {
      isConstruction: intent.parameters.isConstruction
    });
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleMove(intent: SketchMoveIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeMove(intent.parameters.selectedEntityIds, intent.parameters.delta, ind);
    affected.push(...intent.parameters.selectedEntityIds);
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleRotate(intent: SketchRotateIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeRotate(intent.parameters.selectedEntityIds, intent.parameters.center, intent.parameters.angleRad, ind);
    affected.push(...intent.parameters.selectedEntityIds);
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleScale(intent: SketchScaleIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeScale(intent.parameters.selectedEntityIds, intent.parameters.center, intent.parameters.scale, ind);
    affected.push(...intent.parameters.selectedEntityIds);
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleArc(intent: SketchArcIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const center = { x: intent.parameters.centerX, y: intent.parameters.centerY };
    const radius = Math.hypot(intent.parameters.startX - center.x, intent.parameters.startY - center.y);
    const startAngle = Math.atan2(intent.parameters.startY - center.y, intent.parameters.startX - center.x);
    const endAngle = Math.atan2(intent.parameters.endY - center.y, intent.parameters.endX - center.x);

    const result = SketchCreationTools.createArc(
      center,
      radius,
      startAngle,
      endAngle,
      { isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handle3PointArc(intent: Sketch3PointArcIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.create3PointArc(
      intent.parameters.p1,
      intent.parameters.p2,
      intent.parameters.p3,
      { isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handlePolyline(intent: SketchPolylineIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createPolyline(
      intent.parameters.points,
      { closed: intent.parameters.isClosed, isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handlePoint(intent: SketchPointIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createPoint(
      { x: intent.parameters.x, y: intent.parameters.y },
      { isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handlePolygon(intent: SketchPolygonIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createPolygon(
      { x: intent.parameters.centerX, y: intent.parameters.centerY },
      intent.parameters.radius,
      intent.parameters.sides ?? 6,
      { mode: intent.parameters.mode, isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleSlot(intent: SketchSlotIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const result = SketchCreationTools.createSlot(
      { x: intent.parameters.startX, y: intent.parameters.startY },
      { x: intent.parameters.endX, y: intent.parameters.endY },
      intent.parameters.width,
      { type: intent.parameters.type, isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleEllipse(intent: SketchEllipseIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const center = { x: intent.parameters.centerX, y: intent.parameters.centerY };
    const majorPt = { x: intent.parameters.majorX, y: intent.parameters.majorY };
    const result = SketchCreationTools.createEllipse(
      center,
      majorPt,
      intent.parameters.minorRadius,
      { isConstruction: intent.parameters.isConstruction }
    );
    affected.push(...result.entityIds, ...result.pointIds);
    return mutateAddEntities(sketch, result.entities, result.constraints);
  }

  private handleDelete(intent: SketchDeleteEntityIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    let current = sketch;
    intent.parameters.entityIds.forEach(id => {
      current = mutateDeleteEntity(current, id);
      affected.push(id);
    });
    return current;
  }

  private handleTrim(intent: SketchTrimIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeTrim(intent.parameters.targetEntityId, intent.parameters.clickPoint, ind);
    
    const newKeys = Object.keys(resultInd.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);
    
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleExtend(intent: SketchExtendIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeExtend(intent.parameters.targetEntityId, ind);
    affected.push(intent.parameters.targetEntityId);
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleSplit(intent: SketchSplitIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeSplit(intent.parameters.targetEntityId, intent.parameters.splitPoint, ind);
    
    const newKeys = Object.keys(resultInd.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);
    
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleOffset(intent: SketchOffsetIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const ind = CanonicalSketchAdapter.toIndustrialSketch(sketch);
    const resultInd = InteractiveSketchEngine.executeOffset(intent.parameters.targetEntityId, intent.parameters.offsetValue, ind);
    
    const newKeys = Object.keys(resultInd.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);
    
    return CanonicalSketchAdapter.fromIndustrialSketch(resultInd);
  }

  private handleMirror(intent: SketchMirrorIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    // 1. Create parametric Mirror Relationship
    const mirrorId = `mirror-def-${Date.now()}`;
    const mirrorDef: SketchMirrorDefinition = {
      id: mirrorId,
      seedEntityIds: [...intent.parameters.selectedEntityIds],
      mirrorLineId: intent.parameters.mirrorLineId,
      generatedEntityIds: [],
      suppressionState: 'ACTIVE'
    };

    const updatedSketch: CanonicalSketch = {
      ...sketch,
      mirrors: [...(sketch.mirrors || []), mirrorDef]
    };

    // 2. Parametrically regenerate the sketch
    const regenerated = regenerateSketchMirrors(updatedSketch);

    // 3. Collect affected new keys
    const newKeys = Object.keys(regenerated.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);

    return regenerated;
  }

  private handlePatternLinear(intent: SketchPatternLinearIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    // 1. Create parametric Linear Pattern Relationship
    const patternId = `pattern-linear-${Date.now()}`;
    const patternDef: SketchPatternDefinition = {
      id: patternId,
      type: 'LINEAR',
      seedEntityIds: [...intent.parameters.selectedEntityIds],
      count: intent.parameters.count,
      parameters: {
        distance: intent.parameters.distance,
        directionRad: intent.parameters.directionRad
      },
      generatedEntityIds: [],
      suppressionState: 'ACTIVE'
    };

    const updatedSketch: CanonicalSketch = {
      ...sketch,
      patterns: [...(sketch.patterns || []), patternDef]
    };

    // 2. Regenerate
    const regenerated = regenerateSketchPatterns(updatedSketch);

    // 3. Affected
    const newKeys = Object.keys(regenerated.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);

    return regenerated;
  }

  private handlePatternCircular(intent: SketchPatternCircularIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    // 1. Create parametric Circular Pattern Relationship
    const patternId = `pattern-circular-${Date.now()}`;
    
    // We might need to create a point for the center if it's just a coordinate
    let centerPointId = '';
    let updatedBase = sketch;
    
    if (intent.parameters.center) {
      centerPointId = `pt-pattern-center-${patternId}`;
      updatedBase = {
        ...sketch,
        entities: {
          ...sketch.entities,
          [centerPointId]: {
            id: centerPointId,
            type: 'POINT',
            x: intent.parameters.center.x,
            y: intent.parameters.center.y,
            isConstruction: true,
            tag: 'PATTERN_CENTER'
          } as any
        }
      };
      affected.push(centerPointId);
    }

    const patternDef: SketchPatternDefinition = {
      id: patternId,
      type: 'CIRCULAR',
      seedEntityIds: [...intent.parameters.selectedEntityIds],
      count: intent.parameters.count,
      parameters: {
        centerPointId: centerPointId,
        totalAngleRad: intent.parameters.totalAngleRad
      },
      generatedEntityIds: [],
      suppressionState: 'ACTIVE'
    };

    const finalSketch: CanonicalSketch = {
      ...updatedBase,
      patterns: [...(updatedBase.patterns || []), patternDef]
    };

    // 2. Regenerate
    const regenerated = regenerateSketchPatterns(finalSketch);

    // 3. Affected
    const newKeys = Object.keys(regenerated.entities).filter(k => !sketch.entities[k]);
    affected.push(...newKeys);

    return regenerated;
  }

  private handleConstraint(intent: SketchAddConstraintIntent, sketch: CanonicalSketch, affected: string[]): CanonicalSketch {
    const { constraintType, references, value, expression } = intent.parameters;
    
    const constraintId = `c_${Math.random().toString(36).substring(2, 9)}`;
    
    // Map selection references to entity IDs for the solver
    const entityIds = references.map(ref => {
      if (ref.referenceType === 'SKETCH_ENTITY') {
        return (ref as SketchEntityReference).entityId;
      }
      return ref.persistentId;
    });
    
    const constraint: IndustrialSketchConstraint = {
      id: constraintId,
      type: constraintType,
      entityIds,
      references, // Include canonical references
      value,
      expression,
      suppressionState: 'ACTIVE'
    };

    affected.push(constraintId);
    return mutateAddConstraint(sketch, constraint);
  }
}
