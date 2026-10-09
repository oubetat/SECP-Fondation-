/**
 * SECP CAD Kernel — Hybrid Modeling Engine
 * Phase 2 (PATCH-029)
 */

import { TopoShape } from '../topology/TopologyContracts';
import { FeatureHistory } from '../history/FeatureHistory';
import { BoxFactory } from '../boolean/BoxFactory';
import { ProvenanceGraph } from '../../provenance/ProvenanceGraph';
import { ModelingMode } from './ModelingMode';
import { DirectEdit } from './DirectEdit';
import { ParametricEdit } from './ParametricEdit';
import { ModelingOperation } from './ModelingOperation';
import {
  ModelingResult,
  ModelRevision,
  DirectEditClassification,
  ModelingStatus
} from './ModelingResult';
import { DirectModelingEngine } from './DirectModelingEngine';
import { ParametricModelingEngine } from './ParametricModelingEngine';
import { ModelEditTransaction } from './ModelEditTransaction';

export class HybridModelingEngine {
  public readonly id: string;
  private mode: ModelingMode;
  private activeShape: TopoShape;
  private featureHistory: FeatureHistory;
  private revisions: ModelRevision[] = [];
  private provenanceGraph: ProvenanceGraph;
  private invalidatedFeatureIds: Set<string> = new Set();
  private frozenParametricFeatures: Set<string> = new Set();

  constructor(
    id: string = 'HYBRID_MODEL_01',
    initialMode: ModelingMode = ModelingMode.PARAMETRIC,
    initialShape?: TopoShape,
    initialHistory?: FeatureHistory,
    provenanceGraph?: ProvenanceGraph
  ) {
    this.id = id;
    this.mode = initialMode;
    this.featureHistory = initialHistory || new FeatureHistory(id);
    this.activeShape = initialShape || BoxFactory.createBox('DEFAULT_BOX', -10, -10, -10, 10, 10, 10);
    this.provenanceGraph = provenanceGraph || new ProvenanceGraph();
  }

  public getMode(): ModelingMode {
    return this.mode;
  }

  public setMode(mode: ModelingMode): void {
    this.mode = mode;
  }

  public getActiveShape(): TopoShape {
    return this.activeShape;
  }

  public getFeatureHistory(): FeatureHistory {
    return this.featureHistory;
  }

  public getRevisions(): ModelRevision[] {
    return [...this.revisions];
  }

  public getLatestRevision(): ModelRevision | undefined {
    return this.revisions.length > 0 ? this.revisions[this.revisions.length - 1] : undefined;
  }

  public getInvalidatedFeatureIds(): string[] {
    return Array.from(this.invalidatedFeatureIds);
  }

  public getProvenanceGraph(): ProvenanceGraph {
    return this.provenanceGraph;
  }

  /**
   * Primary entry point to execute any direct, parametric, or mode transition operation.
   */
  public executeOperation(operation: ModelingOperation): ModelingResult {
    const parentRevisionId = this.getLatestRevision()?.revisionId || null;
    const tx = new ModelEditTransaction(
      this.activeShape,
      this.featureHistory,
      this.mode,
      this.invalidatedFeatureIds,
      parentRevisionId
    );

    const result = tx.execute(
      operation,
      (transaction) => {
        const sandboxedHistory = transaction.getHistory();
        switch (operation.type) {
          case 'DIRECT':
            return this.processDirectOperation(operation, sandboxedHistory);
          case 'PARAMETRIC':
            return this.processParametricOperation(operation, sandboxedHistory);
          case 'PARAMETRIC_TO_DIRECT':
            return this.processParametricToDirectTransition(operation, sandboxedHistory);
          case 'DIRECT_TO_PARAMETRIC':
            return this.processDirectToParametricTransition(operation, sandboxedHistory);
          default:
            return {
              updatedShape: this.activeShape,
              updatedHistory: sandboxedHistory,
              updatedMode: this.mode,
              affectedDependencies: [],
              diagnostics: [`Unknown modeling operation type: ${operation.type}`],
              status: 'UNSUPPORTED'
            };
        }
      },
      this.provenanceGraph
    );

    if (result.status === 'SUCCESS' && result.revision) {
      this.revisions.push(result.revision);
      this.activeShape = result.activeShape || this.activeShape;
      this.featureHistory = tx.getHistory();
      if (result.invalidatedFeatureIds) {
        this.invalidatedFeatureIds = new Set(result.invalidatedFeatureIds);
      }
      this.mode = result.mode;
    }

    return result;
  }

  private processDirectOperation(operation: ModelingOperation, history: FeatureHistory = this.featureHistory): {
    updatedShape: TopoShape;
    updatedHistory: FeatureHistory;
    updatedMode: ModelingMode;
    classification?: DirectEditClassification;
    affectedDependencies: string[];
    diagnostics: string[];
    status: ModelingStatus;
  } {
    const diagnostics: string[] = [];
    const directEdit = operation.directEdit;

    if (!directEdit) {
      diagnostics.push('Direct operation requires a directEdit contract definition');
      return {
        updatedShape: this.activeShape,
        updatedHistory: history,
        updatedMode: this.mode,
        affectedDependencies: [],
        diagnostics,
        status: 'FAILED'
      };
    }

    // 1. Analyze dependency impact against Feature History
    const impact = this.analyzeDirectEditImpact(directEdit, history);

    // 2. Classify Direct Edit
    if (impact.classification === 'DIRECT_COMPATIBLE' && impact.compatibleFeatureId && impact.compatibleParameterKey) {
      // Direct edit can be represented as a valid parameter change on existing feature!
      const feature = history.getFeature(impact.compatibleFeatureId);
      if (feature) {
        const paramEdit: ParametricEdit = {
          id: `CONV_${directEdit.id}`,
          operation: 'MODIFY_PARAMETERS',
          featureId: impact.compatibleFeatureId,
          parameterChanges: {
            [impact.compatibleParameterKey]: impact.compatibleValue
          },
          dependencies: [],
          affectedEntities: directEdit.targetEntityIds,
          timestamp: directEdit.timestamp
        };

        const paramResult = ParametricModelingEngine.applyParametricEdit(history, paramEdit, this.activeShape);
        if (paramResult.status === 'SUCCESS') {
          // Re-generate updated B-Rep shape based on parametric history
          const updatedShape = this.generateShapeFromHistory(history);
          return {
            updatedShape,
            updatedHistory: history,
            updatedMode: this.mode,
            classification: 'DIRECT_COMPATIBLE',
            affectedDependencies: [impact.compatibleFeatureId],
            diagnostics,
            status: 'SUCCESS'
          };
        }
      }
    }

    // If not parameter compatible, execute direct B-Rep mutation
    const directResult = DirectModelingEngine.applyDirectEdit(this.activeShape, directEdit, directEdit.tolerance || 1e-7);

    if (directResult.status !== 'SUCCESS') {
      return {
        updatedShape: this.activeShape,
        updatedHistory: history,
        updatedMode: this.mode,
        affectedDependencies: [],
        diagnostics: directResult.diagnostics,
        status: directResult.status === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'FAILED'
      };
    }

    // Mark affected feature dependencies as invalidated or preserved
    const affectedFeatureIds = impact.affectedFeatureIds;
    if (affectedFeatureIds.length > 0) {
      affectedFeatureIds.forEach(id => this.invalidatedFeatureIds.add(id));
    }

    // Hybrid mode transition if direct edit was made on parametric geometry
    const updatedMode = (this.mode === ModelingMode.PARAMETRIC && affectedFeatureIds.length > 0)
      ? ModelingMode.HYBRID
      : this.mode;

    const classification: DirectEditClassification = affectedFeatureIds.length > 0
      ? 'PARAMETRIC_INVALIDATED'
      : 'PARAMETRIC_PRESERVED';

    return {
      updatedShape: directResult.updatedShape,
      updatedHistory: history,
      updatedMode,
      classification,
      affectedDependencies: affectedFeatureIds,
      diagnostics: directResult.diagnostics,
      status: 'SUCCESS'
    };
  }

  private processParametricOperation(operation: ModelingOperation, history: FeatureHistory = this.featureHistory): {
    updatedShape: TopoShape;
    updatedHistory: FeatureHistory;
    updatedMode: ModelingMode;
    classification?: DirectEditClassification;
    affectedDependencies: string[];
    diagnostics: string[];
    status: ModelingStatus;
  } {
    const diagnostics: string[] = [];
    const parametricEdit = operation.parametricEdit;

    if (!parametricEdit) {
      diagnostics.push('Parametric operation requires a parametricEdit contract definition');
      return {
        updatedShape: this.activeShape,
        updatedHistory: history,
        updatedMode: this.mode,
        affectedDependencies: [],
        diagnostics,
        status: 'FAILED'
      };
    }

    const paramResult = ParametricModelingEngine.applyParametricEdit(
      history,
      parametricEdit,
      this.activeShape
    );

    if (paramResult.status !== 'SUCCESS') {
      return {
        updatedShape: this.activeShape,
        updatedHistory: history,
        updatedMode: this.mode,
        affectedDependencies: [],
        diagnostics: paramResult.diagnostics,
        status: paramResult.status as ModelingStatus
      };
    }

    const updatedShape = this.generateShapeFromHistory(history);
    return {
      updatedShape,
      updatedHistory: history,
      updatedMode: this.mode,
      affectedDependencies: paramResult.affectedEntities,
      diagnostics,
      status: 'SUCCESS'
    };
  }

  public parametricToDirect(scope?: string[]): ModelingResult {
    const op: ModelingOperation = {
      operationId: `OP_P2D_${Date.now()}`,
      type: 'PARAMETRIC_TO_DIRECT',
      scope,
      timestamp: new Date().toISOString()
    };
    return this.executeOperation(op);
  }

  public directToParametric(scope?: string[]): ModelingResult {
    const op: ModelingOperation = {
      operationId: `OP_D2P_${Date.now()}`,
      type: 'DIRECT_TO_PARAMETRIC',
      scope,
      timestamp: new Date().toISOString()
    };
    return this.executeOperation(op);
  }

  private processParametricToDirectTransition(operation: ModelingOperation, history: FeatureHistory = this.featureHistory): {
    updatedShape: TopoShape;
    updatedHistory: FeatureHistory;
    updatedMode: ModelingMode;
    affectedDependencies: string[];
    diagnostics: string[];
    status: ModelingStatus;
  } {
    const diagnostics: string[] = [];
    const features = history.getAllFeatures();

    for (const f of features) {
      this.frozenParametricFeatures.add(f.id);
    }

    // Geometry is strictly preserved
    const clonedShape = DirectModelingEngine.cloneShape(this.activeShape);

    diagnostics.push('Successfully converted model state from PARAMETRIC to DIRECT mode. Active parametric feature semantics are frozen.');

    return {
      updatedShape: clonedShape,
      updatedHistory: history,
      updatedMode: ModelingMode.DIRECT,
      affectedDependencies: Array.from(this.frozenParametricFeatures),
      diagnostics,
      status: 'SUCCESS'
    };
  }

  private processDirectToParametricTransition(operation: ModelingOperation, history: FeatureHistory = this.featureHistory): {
    updatedShape: TopoShape;
    updatedHistory: FeatureHistory;
    updatedMode: ModelingMode;
    affectedDependencies: string[];
    diagnostics: string[];
    status: ModelingStatus;
  } {
    const diagnostics: string[] = [];

    // Check if shape corresponds unambiguously to a simple parametric primitive (e.g. Box)
    const bounds = this.computeShapeBounds(this.activeShape);
    if (!bounds.isSimpleBox) {
      diagnostics.push('Direct shape topology is too complex for unambiguous deterministic feature recognition');
      return {
        updatedShape: this.activeShape,
        updatedHistory: history,
        updatedMode: this.mode,
        affectedDependencies: [],
        diagnostics,
        status: 'UNSUPPORTED'
      };
    }

    // Unambiguous case: Convert into a Box feature
    const featureId = `FEAT_BOX_${Date.now()}`;
    const boxNode = history.addFeature(
      'EXTRUDE',
      'Recognized Box Feature',
      {
        type: 'EXTRUDE',
        name: 'Recognized Box Feature',
        parameters: {
          minX: bounds.minX,
          minY: bounds.minY,
          minZ: bounds.minZ,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
          maxZ: bounds.maxZ
        },
        references: []
      }
    );

    this.frozenParametricFeatures.clear();
    this.invalidatedFeatureIds.clear();

    const updatedShape = BoxFactory.createBox(
      featureId,
      bounds.minX, bounds.minY, bounds.minZ,
      bounds.maxX, bounds.maxY, bounds.maxZ
    );

    diagnostics.push(`Successfully recognized unambiguous direct geometry as parametric feature '${boxNode.id}'`);

    return {
      updatedShape,
      updatedHistory: history,
      updatedMode: ModelingMode.PARAMETRIC,
      affectedDependencies: [boxNode.id],
      diagnostics,
      status: 'SUCCESS'
    };
  }

  private analyzeDirectEditImpact(edit: DirectEdit, history: FeatureHistory = this.featureHistory): {
    classification: DirectEditClassification;
    affectedFeatureIds: string[];
    compatibleFeatureId?: string;
    compatibleParameterKey?: string;
    compatibleValue?: number;
  } {
    const affectedFeatureIds: string[] = [];
    let compatibleFeatureId: string | undefined;
    let compatibleParameterKey: string | undefined;
    let compatibleValue: number | undefined;

    const allFeatures = history.getAllFeatures();

    for (const feat of allFeatures) {
      let isTargeted = false;
      for (const targetId of edit.targetEntityIds) {
        if (targetId.includes(feat.id) || feat.id.includes(targetId)) {
          affectedFeatureIds.push(feat.id);
          isTargeted = true;
        }
      }

      // Check parameter compatibility for simple box/extrude modifications
      if (isTargeted && (edit.operation === 'OFFSET_FACE' || edit.operation === 'MOVE_FACE')) {
        const params = feat.definition.parameters || {};
        const p = edit.parameters || {};

        if (params.maxX !== undefined) {
          const offset = (p.dx !== undefined && p.dx !== 0) ? p.dx : (p.distance ?? p.offset ?? 0);
          compatibleFeatureId = feat.id;
          compatibleParameterKey = 'maxX';
          compatibleValue = (params.maxX as number) + offset;
        } else if (params.height !== undefined) {
          const offset = (p.dz !== undefined && p.dz !== 0) ? p.dz : (p.distance ?? p.offset ?? 0);
          compatibleFeatureId = feat.id;
          compatibleParameterKey = 'height';
          compatibleValue = (params.height as number) + offset;
        }
      }
    }

    if (compatibleFeatureId && compatibleParameterKey && compatibleValue !== undefined) {
      return {
        classification: 'DIRECT_COMPATIBLE',
        affectedFeatureIds,
        compatibleFeatureId,
        compatibleParameterKey,
        compatibleValue
      };
    }

    return {
      classification: affectedFeatureIds.length > 0 ? 'PARAMETRIC_INVALIDATED' : 'PARAMETRIC_PRESERVED',
      affectedFeatureIds
    };
  }

  private generateShapeFromHistory(history: FeatureHistory = this.featureHistory): TopoShape {
    const features = history.getAllFeatures();
    if (features.length === 0) {
      return this.activeShape;
    }

    const lastFeature = features[features.length - 1];
    const params = lastFeature.definition.parameters || {};

    const minX = params.minX ?? -10;
    const minY = params.minY ?? -10;
    const minZ = params.minZ ?? -10;
    const maxX = params.maxX ?? (minX + (params.width ?? 20));
    const maxY = params.maxY ?? (minY + (params.length ?? 20));
    const maxZ = params.maxZ ?? (minZ + (params.height ?? 20));

    console.log(`[generateShapeFromHistory] feature: ${lastFeature.id}, maxX: ${maxX}`);

    return BoxFactory.createBox(`SHAPE_${lastFeature.id}`, minX, minY, minZ, maxX, maxY, maxZ);
  }

  private computeShapeBounds(shape: TopoShape): {
    isSimpleBox: boolean;
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
  } {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let vertexCount = 0;
    let hasInnerLoops = false;

    const traverse = (s: any) => {
      if (!s) return;
      if (s.shapeType === 'FACE' && s.innerLoops && s.innerLoops.length > 0) {
        hasInnerLoops = true;
      }
      if (s.shapeType === 'VERTEX' && s.geometry) {
        vertexCount++;
        minX = Math.min(minX, s.geometry.x);
        minY = Math.min(minY, s.geometry.y);
        minZ = Math.min(minZ, s.geometry.z);
        maxX = Math.max(maxX, s.geometry.x);
        maxY = Math.max(maxY, s.geometry.y);
        maxZ = Math.max(maxZ, s.geometry.z);
      }
      if (s.outerShell) traverse(s.outerShell);
      if (s.innerShells) s.innerShells.forEach(traverse);
      if (s.orientedFaces) s.orientedFaces.forEach((of: any) => traverse(of.face));
      if (s.outerLoop) traverse(s.outerLoop);
      if (s.innerLoops) s.innerLoops.forEach(traverse);
      if (s.orientedEdges) s.orientedEdges.forEach((oe: any) => traverse(oe.edge));
      if (s.startVertex) traverse(s.startVertex);
      if (s.endVertex) traverse(s.endVertex);
    };

    traverse(shape);

    const isSimpleBox = vertexCount >= 8 && vertexCount <= 64 && !hasInnerLoops;

    return {
      isSimpleBox,
      minX: minX === Infinity ? -10 : minX,
      minY: minY === Infinity ? -10 : minY,
      minZ: minZ === Infinity ? -10 : minZ,
      maxX: maxX === -Infinity ? 10 : maxX,
      maxY: maxY === -Infinity ? 10 : maxY,
      maxZ: maxZ === -Infinity ? 10 : maxZ
    };
  }
}
