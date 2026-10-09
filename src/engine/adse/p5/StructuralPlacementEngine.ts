/**
 * SECP — ADSE-P5 Structural Placement & Transform Engine
 * Manages spatial placement, 3D transforms, coordinate frames, and reference frames.
 * Enforces: Only Canonical Transforms define authoritative engineering truth (UI/Viz transforms cannot mutate canonical state).
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralPlacement, StructuralTransform } from './types';
import { createHash } from 'crypto';

export class StructuralPlacementEngine {
  private registry: StructuralElementRegistry;
  private placements: Map<string, StructuralPlacement> = new Map();

  constructor(registry: StructuralElementRegistry) {
    this.registry = registry;
  }

  public setPlacement(params: {
    instanceId: string;
    translation: { x: number; y: number; z: number };
    rotation: { rx: number; ry: number; rz: number };
    coordinateFrame?: string;
    referenceFrameId?: string;
    configurationId: string;
    revisionId?: string;
    isCanonical?: boolean;
    callerContext?: string;
  }): StructuralPlacement {
    const instance = this.registry.getElement(params.instanceId);
    if (!instance) {
      throw new Error(`PLACEMENT_ERROR: Target instance '${params.instanceId}' not found.`);
    }

    // UI/Viz Transform Mutation Guard
    const isUI = params.callerContext && (
      params.callerContext.toLowerCase().includes('ui') || 
      params.callerContext.toLowerCase().includes('viz') || 
      params.callerContext.toLowerCase().includes('viewer')
    );

    if (isUI && params.isCanonical !== false) {
      throw new Error(
        `UNAUTHORIZED_TRANSFORM_MUTATION: UI/Visualization context cannot directly write Canonical Transform state. Must pass through Engineering Core placement authorization.`
      );
    }

    const revisionId = params.revisionId || instance.revisionId;
    const provenanceId = `PROV-TRANSFORM-${createHash('sha256').update(params.instanceId + JSON.stringify(params.translation) + revisionId).digest('hex').substring(0, 12)}`;

    const transform: StructuralTransform = {
      translation: params.translation,
      rotation: params.rotation,
      coordinateFrame: params.coordinateFrame || 'GLOBAL_ECEF',
      referenceFrame: params.referenceFrameId || 'ORIGIN_FRAME',
      transformRevision: revisionId,
      configurationId: params.configurationId,
      provenanceId,
      isCanonical: params.isCanonical ?? true
    };

    const placement: StructuralPlacement = {
      instanceId: params.instanceId,
      transform,
      referenceFrameId: params.referenceFrameId || 'ORIGIN_FRAME',
      configurationId: params.configurationId,
      revisionId,
      provenanceId
    };

    this.placements.set(params.instanceId, placement);
    return placement;
  }

  public getPlacement(instanceId: string): StructuralPlacement | undefined {
    return this.placements.get(instanceId);
  }

  public getAllPlacements(): StructuralPlacement[] {
    return Array.from(this.placements.values());
  }

  public clear(): void {
    this.placements.clear();
  }
}
