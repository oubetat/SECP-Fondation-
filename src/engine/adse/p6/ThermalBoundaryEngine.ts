/**
 * SECP — ADSE-P6 Thermal Boundary Engine
 * 
 * Manages Thermal Boundary Conditions, Heat Sources, and Heat Sinks.
 * Enforces:
 * - Target validity and existence in ThermalRegistry
 * - Physical unit compliance (K, W, W/m^2, W/(m^2*K))
 * - Conflict detection (e.g. contradictory prescribed temperatures or simultaneous conflicting conditions)
 * - Lineage tracking for Heat Sources (Requirement-derived, Architecture-derived, Execution-derived)
 * - AI Governance (AI proposed loads must be authorized)
 */

import { 
  ThermalBoundaryCondition, 
  HeatSource, 
  HeatSink, 
  BoundaryConditionType,
  HeatSourceType
} from './types';
import { ThermalRegistry } from './ThermalRegistry';
import { EngineeringAuthority } from '../p0/types';
import { createHash } from 'crypto';

export class ThermalBoundaryEngine {
  private boundaries: Map<string, ThermalBoundaryCondition> = new Map();
  private heatSources: Map<string, HeatSource> = new Map();
  private heatSinks: Map<string, HeatSink> = new Map();
  private registry: ThermalRegistry;

  constructor(registry: ThermalRegistry) {
    this.registry = registry;
  }

  /**
   * Applies a verified thermal boundary condition.
   */
  public applyBoundaryCondition(params: {
    boundaryId: string;
    thermalId: string;
    type: BoundaryConditionType;
    targetId: string;
    value: number;
    unit: string;
    ambientTemperatureK?: number;
    emissivity?: number;
    configurationId: string;
    revisionId: string;
    authority: EngineeringAuthority;
    proposedByAI?: boolean;
    authorizedByEngineer?: boolean;
  }): ThermalBoundaryCondition {
    if (this.boundaries.has(params.boundaryId)) {
      throw new Error(`BOUNDARY_COLLISION: Boundary condition '${params.boundaryId}' already exists.`);
    }

    // AI Authorization Check
    if (params.proposedByAI && !params.authorizedByEngineer) {
      throw new Error(`UNAUTHORIZED_AI_BOUNDARY: AI-proposed boundary condition '${params.boundaryId}' must be explicitly authorized by an Engineering Authority.`);
    }

    // Verify Thermal Model exists
    const model = this.registry.getModel(params.thermalId);
    if (!model) {
      throw new Error(`ORPHAN_BOUNDARY_CONDITION: Parent Thermal Model '${params.thermalId}' not found.`);
    }

    if (model.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_BOUNDARY: Boundary configuration '${params.configurationId}' does not match model configuration '${model.configurationId}'.`);
    }

    // Verify Target exists in Region or Interface
    const region = this.registry.getRegion(params.targetId);
    if (!region && !params.targetId.startsWith('surf:') && !params.targetId.startsWith('iface:')) {
      throw new Error(`INVALID_BOUNDARY_TARGET: Target '${params.targetId}' does not exist in Thermal Model regions or surfaces.`);
    }

    // Unit and Physical Range Validation
    if (params.type === 'PRESCRIBED_TEMPERATURE') {
      if (params.unit !== 'K') {
        throw new Error(`UNIT_MISMATCH: Prescribed temperature must use unit 'K', got '${params.unit}'.`);
      }
      if (params.value <= 0) {
        throw new Error(`IMPOSSIBLE_TEMPERATURE: Prescribed temperature must be > 0 K, got ${params.value} K.`);
      }
    } else if (params.type === 'HEAT_FLUX') {
      if (params.unit !== 'W/m^2') {
        throw new Error(`UNIT_MISMATCH: Heat flux must use unit 'W/m^2', got '${params.unit}'.`);
      }
    } else if (params.type === 'CONVECTION') {
      if (params.unit !== 'W/(m^2*K)') {
        throw new Error(`UNIT_MISMATCH: Convection coefficient must use unit 'W/(m^2*K)', got '${params.unit}'.`);
      }
      if (params.value < 0) {
        throw new Error(`IMPOSSIBLE_HTC: Convection coefficient must be >= 0, got ${params.value}.`);
      }
      if (params.ambientTemperatureK === undefined || params.ambientTemperatureK <= 0) {
        throw new Error(`INVALID_AMBIENT_TEMPERATURE: Convection requires valid ambientTemperatureK > 0.`);
      }
    } else if (params.type === 'RADIATION') {
      if (params.emissivity === undefined || params.emissivity < 0 || params.emissivity > 1.0) {
        throw new Error(`INVALID_EMISSIVITY: Radiation boundary condition requires emissivity between 0 and 1.`);
      }
      if (params.ambientTemperatureK === undefined || params.ambientTemperatureK <= 0) {
        throw new Error(`INVALID_AMBIENT_TEMPERATURE: Radiation boundary requires valid ambientTemperatureK > 0.`);
      }
    }

    // Conflicting boundary check: Can't have two prescribed temperatures with different values on same target
    const existingBoundaries = Array.from(this.boundaries.values()).filter(
      b => b.thermalId === params.thermalId && b.targetId === params.targetId
    );

    for (const b of existingBoundaries) {
      if (b.type === 'PRESCRIBED_TEMPERATURE' && params.type === 'PRESCRIBED_TEMPERATURE' && b.value !== params.value) {
        throw new Error(`CONFLICTING_BOUNDARY_CONDITIONS: Target '${params.targetId}' already has contradictory prescribed temperature ${b.value} K.`);
      }
    }

    const provenanceId = `PROV-BC-${createHash('sha256')
      .update(`${params.boundaryId}-${params.type}-${params.value}-${params.revisionId}`)
      .digest('hex').substring(0, 16)}`;

    const bc: ThermalBoundaryCondition = {
      boundaryId: params.boundaryId,
      thermalId: params.thermalId,
      type: params.type,
      targetId: params.targetId,
      value: params.value,
      unit: params.unit,
      ambientTemperatureK: params.ambientTemperatureK,
      emissivity: params.emissivity,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authority: params.authority,
      provenanceId,
      proposedByAI: params.proposedByAI
    };

    this.boundaries.set(params.boundaryId, bc);
    return bc;
  }

  /**
   * Registers a Heat Source with lineage to Requirements or Architecture.
   */
  public registerHeatSource(params: {
    sourceId: string;
    thermalId: string;
    targetRegionId: string;
    sourceType: HeatSourceType;
    heatPowerWatts: number;
    unit?: 'W' | 'W/m^2' | 'W/m^3';
    configurationId: string;
    revisionId: string;
    derivedFromRequirementId?: string;
    derivedFromArchitectureId?: string;
    proposedByAI?: boolean;
    authorizedByEngineer?: boolean;
  }): HeatSource {
    if (this.heatSources.has(params.sourceId)) {
      throw new Error(`HEAT_SOURCE_COLLISION: Heat source '${params.sourceId}' already exists.`);
    }

    if (params.proposedByAI && !params.authorizedByEngineer) {
      throw new Error(`UNAUTHORIZED_AI_HEAT_LOAD: AI-proposed heat source '${params.sourceId}' is unauthorized.`);
    }

    const model = this.registry.getModel(params.thermalId);
    if (!model) {
      throw new Error(`ORPHAN_HEAT_SOURCE: Parent model '${params.thermalId}' not found.`);
    }

    const region = this.registry.getRegion(params.targetRegionId);
    if (!region) {
      throw new Error(`HEAT_SOURCE_TARGET_NOT_FOUND: Target region '${params.targetRegionId}' does not exist.`);
    }

    if (params.heatPowerWatts < 0) {
      throw new Error(`IMPOSSIBLE_HEAT_POWER: Heat power cannot be negative (use HeatSink for heat extraction), got ${params.heatPowerWatts} W.`);
    }

    const provenanceId = `PROV-HS-${createHash('sha256')
      .update(`${params.sourceId}-${params.targetRegionId}-${params.heatPowerWatts}`)
      .digest('hex').substring(0, 16)}`;

    const source: HeatSource = {
      sourceId: params.sourceId,
      thermalId: params.thermalId,
      targetRegionId: params.targetRegionId,
      sourceType: params.sourceType,
      heatPowerWatts: params.heatPowerWatts,
      unit: params.unit || 'W',
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      derivedFromRequirementId: params.derivedFromRequirementId,
      derivedFromArchitectureId: params.derivedFromArchitectureId,
      proposedByAI: params.proposedByAI,
      provenanceId
    };

    this.heatSources.set(params.sourceId, source);
    return source;
  }

  /**
   * Registers a Heat Sink.
   */
  public registerHeatSink(params: {
    sinkId: string;
    thermalId: string;
    targetRegionId?: string;
    sinkType: 'ENVIRONMENT' | 'FLUID_LOOP' | 'RADIATOR_PANEL' | 'STRUCTURAL_CHASSIS';
    capacityWatts: number;
    ambientTemperatureK: number;
    configurationId: string;
    revisionId: string;
  }): HeatSink {
    if (this.heatSinks.has(params.sinkId)) {
      throw new Error(`HEAT_SINK_COLLISION: Heat sink '${params.sinkId}' already exists.`);
    }

    const model = this.registry.getModel(params.thermalId);
    if (!model) {
      throw new Error(`ORPHAN_HEAT_SINK: Parent model '${params.thermalId}' not found.`);
    }

    if (params.targetRegionId) {
      const region = this.registry.getRegion(params.targetRegionId);
      if (!region) {
        throw new Error(`HEAT_SINK_TARGET_NOT_FOUND: Target region '${params.targetRegionId}' not found.`);
      }
    }

    if (params.ambientTemperatureK <= 0) {
      throw new Error(`IMPOSSIBLE_TEMPERATURE: Ambient temperature must be > 0 K.`);
    }

    const provenanceId = `PROV-SINK-${createHash('sha256')
      .update(`${params.sinkId}-${params.capacityWatts}-${params.ambientTemperatureK}`)
      .digest('hex').substring(0, 16)}`;

    const sink: HeatSink = {
      sinkId: params.sinkId,
      thermalId: params.thermalId,
      targetRegionId: params.targetRegionId,
      sinkType: params.sinkType,
      capacityWatts: params.capacityWatts,
      ambientTemperatureK: params.ambientTemperatureK,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.heatSinks.set(params.sinkId, sink);
    return sink;
  }

  public getBoundary(boundaryId: string): ThermalBoundaryCondition | undefined {
    return this.boundaries.get(boundaryId);
  }

  public getBoundariesForModel(thermalId: string): ThermalBoundaryCondition[] {
    return Array.from(this.boundaries.values()).filter(b => b.thermalId === thermalId);
  }

  public getAllBoundaries(): ThermalBoundaryCondition[] {
    return Array.from(this.boundaries.values());
  }

  public getHeatSourcesForModel(thermalId: string): HeatSource[] {
    return Array.from(this.heatSources.values()).filter(hs => hs.thermalId === thermalId);
  }

  public getAllHeatSources(): HeatSource[] {
    return Array.from(this.heatSources.values());
  }

  public getHeatSinksForModel(thermalId: string): HeatSink[] {
    return Array.from(this.heatSinks.values()).filter(hs => hs.thermalId === thermalId);
  }

  public getAllHeatSinks(): HeatSink[] {
    return Array.from(this.heatSinks.values());
  }

  public clear(): void {
    this.boundaries.clear();
    this.heatSources.clear();
    this.heatSinks.clear();
  }
}
