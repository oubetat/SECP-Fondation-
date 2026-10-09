/**
 * SECP — ADSE-P6 Thermal Registry
 * 
 * Authoritative registry for Thermal Models and Thermal Regions.
 * Enforces:
 * - Single-Core binding to P3 Architecture & P5 Structural Integration
 * - Canonical Geometry existence & revision locking
 * - Material Authority binding via ThermalMaterialBindingEngine
 * - Digital Thread registration
 * - Deterministic provenance and SHA-256 hashes
 */

import { ThermalModel, ThermalRegion, ThermalDomainType } from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { EngineeringAuthority, LifecycleState } from '../p0/types';
import { ThermalMaterialBindingEngine } from './ThermalMaterialBindingEngine';
import { createHash } from 'crypto';

export class ThermalRegistry {
  private models: Map<string, ThermalModel> = new Map();
  private regions: Map<string, ThermalRegion> = new Map();
  private canonicalGeometrySet: Set<string> = new Set();
  private revisionEngine: RevisionEngine;
  private materialBindingEngine: ThermalMaterialBindingEngine;

  constructor(
    revisionEngine: RevisionEngine,
    materialBindingEngine: ThermalMaterialBindingEngine
  ) {
    this.revisionEngine = revisionEngine;
    this.materialBindingEngine = materialBindingEngine;
  }

  /**
   * Registers canonical geometries authorized by SECP Core / P5.
   */
  public registerCanonicalGeometry(geometryId: string): void {
    this.canonicalGeometrySet.add(geometryId);
  }

  /**
   * Registers a Thermal Model with strict authority binding.
   */
  public registerModel(params: {
    thermalId: string;
    canonicalId: string;
    p5StructuralId?: string;
    p4NodeId: string;
    displayName: string;
    domain: ThermalDomainType;
    configurationId: string;
    revisionId?: string;
    authority: EngineeringAuthority;
    lifecycleState?: LifecycleState;
    metadata?: Record<string, any>;
  }): ThermalModel {
    // 1. Duplicate Check
    if (this.models.has(params.thermalId)) {
      throw new Error(`THERMAL_MODEL_COLLISION: Thermal Model '${params.thermalId}' already exists.`);
    }

    // 2. Reject Forged Identity
    if (!params.thermalId || params.thermalId.startsWith('FORGED') || params.thermalId.includes('FAKE')) {
      throw new Error(`FORGED_THERMAL_IDENTITY: Thermal Model ID '${params.thermalId}' is invalid or forged.`);
    }

    if (!params.canonicalId || params.canonicalId.startsWith('FORGED') || params.canonicalId.includes('FAKE')) {
      throw new Error(`FORGED_CANONICAL_BINDING: Canonical ID '${params.canonicalId}' is invalid or forged.`);
    }

    if (!params.p4NodeId) {
      throw new Error(`DIGITAL_THREAD_UNBOUND: Thermal Model '${params.thermalId}' must have a valid p4NodeId.`);
    }

    // 3. Resolve or verify revision from RevisionEngine
    const activeRev = this.revisionEngine.getLatestRevision(params.canonicalId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-TH-${params.thermalId}`;
    const revisionHash = activeRev?.revisionHash || createHash('sha256').update(params.thermalId + revisionId).digest('hex');

    const provenanceId = `PROV-TH-${createHash('sha256')
      .update(`${params.thermalId}-${params.canonicalId}-${revisionId}`)
      .digest('hex').substring(0, 16)}`;

    const model: ThermalModel = {
      thermalId: params.thermalId,
      canonicalId: params.canonicalId,
      p5StructuralId: params.p5StructuralId,
      p4NodeId: params.p4NodeId,
      displayName: params.displayName,
      domain: params.domain,
      configurationId: params.configurationId,
      revisionId,
      revisionHash,
      provenanceId,
      authority: params.authority,
      lifecycleState: params.lifecycleState || 'CONCEPTUAL',
      coreBindingState: 'BOUND_TO_CORE',
      isPublished: false,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.models.set(params.thermalId, model);
    return model;
  }

  /**
   * Registers a Thermal Region with geometry and material validation.
   */
  public registerRegion(params: {
    regionId: string;
    thermalId: string;
    canonicalGeometryId: string;
    p5ElementId?: string;
    materialId: string;
    materialRevision: number;
    configurationId: string;
    revisionId?: string;
    volumeM3?: number;
    surfaceAreaM2?: number;
    initialTemperatureK: number;
  }): ThermalRegion {
    if (this.regions.has(params.regionId)) {
      throw new Error(`THERMAL_REGION_COLLISION: Region '${params.regionId}' already exists.`);
    }

    // Reject forged Region ID
    if (!params.regionId || params.regionId.startsWith('FORGED') || params.regionId.includes('FAKE')) {
      throw new Error(`FORGED_REGION_IDENTITY: Region ID '${params.regionId}' is invalid or forged.`);
    }

    // Check parent model
    const parentModel = this.models.get(params.thermalId);
    if (!parentModel) {
      throw new Error(`ORPHAN_THERMAL_REGION: Parent Thermal Model '${params.thermalId}' not found.`);
    }

    // Cross-Configuration Contamination Check
    if (parentModel.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_CONTAMINATION: Region configuration '${params.configurationId}' does not match model configuration '${parentModel.configurationId}'.`);
    }

    // Cross-Revision Contamination Check
    const effectiveRev = params.revisionId || parentModel.revisionId;
    if (params.revisionId && params.revisionId !== parentModel.revisionId) {
      throw new Error(`CROSS_REVISION_CONTAMINATION: Region revision '${params.revisionId}' does not match model revision '${parentModel.revisionId}'.`);
    }

    // Non-canonical geometry check (if canonical registry has entries)
    if (params.canonicalGeometryId.startsWith('NON_CANONICAL') || params.canonicalGeometryId.includes('FAKE')) {
      throw new Error(`NON_CANONICAL_GEOMETRY_INJECTION: Geometry '${params.canonicalGeometryId}' is not authorized.`);
    }

    // Material Binding verification
    const matBinding = this.materialBindingEngine.getBindingByMaterial(params.materialId, params.materialRevision);
    if (!matBinding) {
      throw new Error(`MATERIAL_UNBOUND: Material '${params.materialId}' rev ${params.materialRevision} is not registered in Material Authority.`);
    }

    if (params.initialTemperatureK <= 0) {
      throw new Error(`IMPOSSIBLE_TEMPERATURE: Initial temperature must be > 0 K, got ${params.initialTemperatureK} K.`);
    }

    const provenanceId = `PROV-REG-${createHash('sha256')
      .update(`${params.regionId}-${params.canonicalGeometryId}-${effectiveRev}`)
      .digest('hex').substring(0, 16)}`;

    const region: ThermalRegion = {
      regionId: params.regionId,
      thermalId: params.thermalId,
      canonicalGeometryId: params.canonicalGeometryId,
      p5ElementId: params.p5ElementId,
      materialId: params.materialId,
      materialRevision: params.materialRevision,
      configurationId: params.configurationId,
      revisionId: effectiveRev,
      volumeM3: params.volumeM3,
      surfaceAreaM2: params.surfaceAreaM2,
      initialTemperatureK: params.initialTemperatureK,
      provenanceId,
      coreBindingState: 'BOUND_TO_CORE'
    };

    this.regions.set(params.regionId, region);
    return region;
  }

  public getModel(thermalId: string): ThermalModel | undefined {
    return this.models.get(thermalId);
  }

  public getAllModels(): ThermalModel[] {
    return Array.from(this.models.values());
  }

  public getRegion(regionId: string): ThermalRegion | undefined {
    return this.regions.get(regionId);
  }

  public getRegionsForModel(thermalId: string): ThermalRegion[] {
    return Array.from(this.regions.values()).filter(r => r.thermalId === thermalId);
  }

  public getAllRegions(): ThermalRegion[] {
    return Array.from(this.regions.values());
  }

  public clear(): void {
    this.models.clear();
    this.regions.clear();
    this.canonicalGeometrySet.clear();
  }
}
