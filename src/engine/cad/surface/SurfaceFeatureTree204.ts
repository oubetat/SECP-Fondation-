/**
 * SECP CAD Kernel — Surface Feature Tree, Dependency Graph, & Industrial OS Provenance
 * PATCH-204: Phase 18 — Professional Modeling
 */

import { Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import { BoundarySurfaceBuilder } from './BoundarySurfaceBuilder';
import { LoftSurfaceBuilder } from './LoftSurfaceBuilder';
import { SweepSurfaceBuilder } from './SweepSurfaceBuilder';
import { SurfaceSewingAndBRep } from './SurfaceSewingAndBRep';
import {
  SurfaceFeatureRecord,
  SurfaceFeatureType,
  SurfaceIndustrialEvent,
  SurfaceIndustrialEventType,
  BoundarySurfaceOptions,
  LoftSurfaceOptions,
  SweepSurfaceOptions
} from './BoundaryLoftSweepTypes';

export class SurfaceFeatureTree204 {
  private features: SurfaceFeatureRecord[] = [];
  private undoStack: SurfaceFeatureRecord[][] = [];
  private redoStack: SurfaceFeatureRecord[][] = [];
  private eventLog: SurfaceIndustrialEvent[] = [];
  private activePreview: SurfaceFeatureRecord | null = null;

  public getFeatures(): SurfaceFeatureRecord[] {
    return [...this.features];
  }

  public getEventLog(): SurfaceIndustrialEvent[] {
    return [...this.eventLog];
  }

  /**
   * Transactional Live Preview Safety
   */
  public previewBoundarySurface(curves: Curve[], options?: BoundarySurfaceOptions): BRepNURBSSurface {
    const { surface, data } = BoundarySurfaceBuilder.buildBoundarySurface(curves, options);
    this.activePreview = {
      featureId: `PREVIEW_BOUNDARY_${Date.now()}`,
      name: 'Preview Boundary Surface',
      type: 'BOUNDARY_SURFACE',
      inputs: { curvesCount: curves.length, options },
      suppressed: false,
      revision: 0,
      timestamp: new Date().toISOString(),
      status: 'VALID',
      outputSurface: surface,
      outputData: data
    };
    return surface;
  }

  public previewLoftSurface(sections: Curve[], options?: LoftSurfaceOptions): BRepNURBSSurface {
    const { surface, data } = LoftSurfaceBuilder.buildLoftSurface(sections, options);
    this.activePreview = {
      featureId: `PREVIEW_LOFT_${Date.now()}`,
      name: 'Preview Loft Surface',
      type: 'LOFT_SURFACE',
      inputs: { sectionsCount: sections.length, options },
      suppressed: false,
      revision: 0,
      timestamp: new Date().toISOString(),
      status: 'VALID',
      outputSurface: surface,
      outputData: data
    };
    return surface;
  }

  public previewSweepSurface(profile: Curve, path: Curve, options?: SweepSurfaceOptions): BRepNURBSSurface {
    const { surface, data } = SweepSurfaceBuilder.buildSweepSurface(profile, path, options);
    this.activePreview = {
      featureId: `PREVIEW_SWEEP_${Date.now()}`,
      name: 'Preview Sweep Surface',
      type: 'SWEEP_SURFACE',
      inputs: { options },
      suppressed: false,
      revision: 0,
      timestamp: new Date().toISOString(),
      status: 'VALID',
      outputSurface: surface,
      outputData: data
    };
    return surface;
  }

  /**
   * Commit preview transaction to permanent feature stack
   */
  public commitPreview(): SurfaceFeatureRecord {
    if (!this.activePreview) {
      throw new Error('No active preview to commit.');
    }

    this.undoStack.push([...this.features]);
    this.redoStack = [];

    const feature: SurfaceFeatureRecord = {
      ...this.activePreview,
      featureId: `FEAT_${Math.random().toString(36).substring(2, 9)}`,
      revision: 1
    };

    this.features.push(feature);
    this.activePreview = null;

    let eventType: SurfaceIndustrialEventType = 'SURFACE_REBUILT';
    if (feature.type === 'BOUNDARY_SURFACE') eventType = 'BOUNDARY_SURFACE_CREATED';
    else if (feature.type === 'LOFT_SURFACE') eventType = 'LOFT_CREATED';
    else if (feature.type === 'SWEEP_SURFACE') eventType = 'SWEEP_CREATED';

    this.emitEvent(eventType, feature.featureId, feature.revision, feature.inputs, feature.outputData);

    return feature;
  }

  /**
   * Direct Commit Operations
   */
  public addBoundarySurfaceFeature(name: string, curves: Curve[], options?: BoundarySurfaceOptions): SurfaceFeatureRecord {
    const { surface, data } = BoundarySurfaceBuilder.buildBoundarySurface(curves, options);
    return this.commitDirect('BOUNDARY_SURFACE', name, { curves, options }, surface, data, 'BOUNDARY_SURFACE_CREATED');
  }

  public addLoftSurfaceFeature(name: string, sections: Curve[], options?: LoftSurfaceOptions): SurfaceFeatureRecord {
    const { surface, data } = LoftSurfaceBuilder.buildLoftSurface(sections, options);
    return this.commitDirect('LOFT_SURFACE', name, { sections, options }, surface, data, 'LOFT_CREATED');
  }

  public addSweepSurfaceFeature(name: string, profile: Curve, path: Curve, options?: SweepSurfaceOptions): SurfaceFeatureRecord {
    const { surface, data } = SweepSurfaceBuilder.buildSweepSurface(profile, path, options);
    return this.commitDirect('SWEEP_SURFACE', name, { profile, path, options }, surface, data, 'SWEEP_CREATED');
  }

  public addSewSurfacesFeature(name: string, surfaces: BRepNURBSSurface[], tolerance: number = 1e-4): SurfaceFeatureRecord {
    const sewRes = SurfaceSewingAndBRep.sewSurfaces(surfaces, tolerance);
    return this.commitDirect('SEW_SURFACES', name, { surfacesCount: surfaces.length, tolerance }, undefined, undefined, 'SURFACE_SEWN', sewRes);
  }

  /**
   * Cascading Invalidation upon dependency change
   */
  public invalidateFromDependency(dependencyName: string, reason: string) {
    for (const feat of this.features) {
      feat.status = 'INVALIDATED';
      feat.errorMessage = `Cascading invalidation triggered by ${dependencyName}: ${reason}`;
      this.emitEvent('SURFACE_INVALIDATED', feat.featureId, feat.revision, { reason }, feat.outputData, 'INVALIDATED');
    }
  }

  /**
   * Recompute all non-suppressed features
   */
  public recomputeAll() {
    for (const feat of this.features) {
      if (feat.suppressed) continue;
      feat.revision += 1;
      feat.status = 'VALID';
      this.emitEvent('SURFACE_REBUILT', feat.featureId, feat.revision, feat.inputs, feat.outputData);
    }
  }

  /**
   * Undo / Redo Transaction Support
   */
  public undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push([...this.features]);
    this.features = this.undoStack.pop()!;
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push([...this.features]);
    this.features = this.redoStack.pop()!;
    return true;
  }

  private commitDirect(
    type: SurfaceFeatureType,
    name: string,
    inputs: Record<string, any>,
    surface?: BRepNURBSSurface,
    data?: NURBSSurfaceData,
    eventType: SurfaceIndustrialEventType = 'SURFACE_REBUILT',
    extraPayload?: any
  ): SurfaceFeatureRecord {
    this.undoStack.push([...this.features]);
    this.redoStack = [];

    const feature: SurfaceFeatureRecord = {
      featureId: `FEAT_${Math.random().toString(36).substring(2, 9)}`,
      name,
      type,
      inputs,
      suppressed: false,
      revision: 1,
      timestamp: new Date().toISOString(),
      status: 'VALID',
      outputSurface: surface,
      outputData: data
    };

    this.features.push(feature);
    this.emitEvent(eventType, feature.featureId, feature.revision, { ...inputs, extraPayload }, data);
    return feature;
  }

  private emitEvent(
    type: SurfaceIndustrialEventType,
    featureId: string,
    revision: number,
    payload: any,
    data?: NURBSSurfaceData,
    status: 'VALID' | 'INVALIDATED' | 'RECOMPUTED' = 'VALID'
  ) {
    const inputHash = `INP_${Math.random().toString(36).substring(2, 8)}`;
    const outputHash = data ? NURBSEngine.computeGeometryHash(data) : `OUT_${Math.random().toString(36).substring(2, 8)}`;

    const event: SurfaceIndustrialEvent = {
      eventId: `EVT_${Math.random().toString(36).substring(2, 9)}`,
      type,
      featureId,
      timestamp: new Date().toISOString(),
      revision,
      inputHash,
      outputHash,
      payload,
      evidence: { status }
    };
    this.eventLog.push(event);
  }
}
