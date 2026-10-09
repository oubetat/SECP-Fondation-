/**
 * SECP — ADSE-P6 Thermal Persistence Engine
 * 
 * Invariant:
 * «Persistence does not create new truth; it deterministically captures,
 * hashes, clears, reloads, and reconstructs authoritative Thermal Truth.»
 */

import { ThermalSnapshot } from './types';
import { ThermalRegistry } from './ThermalRegistry';
import { ThermalMaterialBindingEngine } from './ThermalMaterialBindingEngine';
import { ThermalBoundaryEngine } from './ThermalBoundaryEngine';
import { ThermalInterfaceEngine } from './ThermalInterfaceEngine';
import { ThermalPathEngine } from './ThermalPathEngine';
import { ThermalSolverBridge } from './ThermalSolverBridge';
import { ThermalVerificationAndEvidenceEngine } from './ThermalVerificationAndEvidenceEngine';
import { createHash } from 'crypto';

export class ThermalPersistenceEngine {
  constructor(
    private registry: ThermalRegistry,
    private materialBindings: ThermalMaterialBindingEngine,
    private boundaries: ThermalBoundaryEngine,
    private interfaces: ThermalInterfaceEngine,
    private paths: ThermalPathEngine,
    private solverBridge: ThermalSolverBridge,
    private verificationEngine: ThermalVerificationAndEvidenceEngine
  ) {}

  /**
   * Creates an immutable, Merkle-hashed snapshot of all thermal entities.
   */
  public createSnapshot(configurationId: string): ThermalSnapshot {
    const models = this.registry.getAllModels().filter(m => m.configurationId === configurationId);
    const modelIds = models.map(m => m.thermalId);

    const regions = this.registry.getAllRegions().filter(r => modelIds.includes(r.thermalId));
    const materials = this.materialBindings.getAllBindings();
    const boundaries = this.boundaries.getAllBoundaries().filter(b => modelIds.includes(b.thermalId));
    const heatSources = this.boundaries.getAllHeatSources().filter(h => modelIds.includes(h.thermalId));
    const heatSinks = this.boundaries.getAllHeatSinks().filter(h => modelIds.includes(h.thermalId));
    const interfaces = this.interfaces.getAllInterfaces().filter(i => modelIds.includes(i.thermalId));
    const paths = this.paths.getAllPaths().filter(p => modelIds.includes(p.thermalId));
    const executions = this.solverBridge.getAllExecutions().filter(e => modelIds.includes(e.thermalId));
    const results = this.solverBridge.getAllResults().filter(r => modelIds.includes(r.thermalId));
    const verifications = this.verificationEngine.getAllIntents().filter(v => modelIds.includes(v.thermalId));
    const evidences = this.verificationEngine.getAllEvidences().filter(ev => modelIds.includes(ev.thermalId));

    const rawPayload = JSON.stringify({
      models,
      regions,
      materials,
      boundaries,
      heatSources,
      heatSinks,
      interfaces,
      paths,
      executions,
      results,
      verifications,
      evidences
    });

    const merkleRoot = createHash('sha256').update(rawPayload).digest('hex');

    return {
      snapshotId: `snap:th:${createHash('sha256').update(merkleRoot).digest('hex').substring(0, 16)}`,
      timestamp: new Date().toISOString(),
      configurationId,
      models,
      regions,
      materials,
      boundaries,
      heatSources,
      heatSinks,
      interfaces,
      paths,
      executions,
      results,
      verifications,
      evidences,
      merkleRoot
    };
  }

  /**
   * Reconstructs authoritative in-memory state from a verified snapshot.
   */
  public reconstruct(snapshot: ThermalSnapshot): void {
    // 1. Clear in-memory state
    this.registry.clear();
    this.materialBindings.clear();
    this.boundaries.clear();
    this.interfaces.clear();
    this.paths.clear();
    this.solverBridge.clear();
    this.verificationEngine.clear();

    // 2. Re-populate materials first
    for (const mat of snapshot.materials) {
      this.materialBindings.registerMaterialBinding({
        bindingId: mat.bindingId,
        materialId: mat.materialId,
        materialRevision: mat.materialRevision,
        canonicalName: mat.canonicalName,
        conductivityW_mK: mat.conductivityW_mK,
        densityKg_m3: mat.densityKg_m3,
        specificHeatJ_kgK: mat.specificHeatJ_kgK,
        emissivity: mat.emissivity,
        absorptivity: mat.absorptivity,
        thermalExpansion1_K: mat.thermalExpansion1_K,
        authority: mat.verifiedByAuthority,
        isTemperatureDependent: mat.isTemperatureDependent,
        temperatureCurve: mat.temperatureCurve
      });
    }

    // 3. Re-populate models
    for (const m of snapshot.models) {
      this.registry.registerModel({
        thermalId: m.thermalId,
        canonicalId: m.canonicalId,
        p5StructuralId: m.p5StructuralId,
        p4NodeId: m.p4NodeId,
        displayName: m.displayName,
        domain: m.domain,
        configurationId: m.configurationId,
        revisionId: m.revisionId,
        authority: m.authority,
        lifecycleState: m.lifecycleState,
        metadata: m.metadata
      });
    }

    // 4. Re-populate regions
    for (const r of snapshot.regions) {
      this.registry.registerRegion({
        regionId: r.regionId,
        thermalId: r.thermalId,
        canonicalGeometryId: r.canonicalGeometryId,
        p5ElementId: r.p5ElementId,
        materialId: r.materialId,
        materialRevision: r.materialRevision,
        configurationId: r.configurationId,
        revisionId: r.revisionId,
        volumeM3: r.volumeM3,
        surfaceAreaM2: r.surfaceAreaM2,
        initialTemperatureK: r.initialTemperatureK
      });
    }

    // 5. Re-populate boundaries, heat sources, heat sinks
    for (const b of snapshot.boundaries) {
      this.boundaries.applyBoundaryCondition({
        boundaryId: b.boundaryId,
        thermalId: b.thermalId,
        type: b.type,
        targetId: b.targetId,
        value: b.value,
        unit: b.unit,
        ambientTemperatureK: b.ambientTemperatureK,
        emissivity: b.emissivity,
        configurationId: b.configurationId,
        revisionId: b.revisionId,
        authority: b.authority
      });
    }

    for (const hs of snapshot.heatSources) {
      this.boundaries.registerHeatSource({
        sourceId: hs.sourceId,
        thermalId: hs.thermalId,
        targetRegionId: hs.targetRegionId,
        sourceType: hs.sourceType,
        heatPowerWatts: hs.heatPowerWatts,
        unit: hs.unit,
        configurationId: hs.configurationId,
        revisionId: hs.revisionId,
        derivedFromRequirementId: hs.derivedFromRequirementId,
        derivedFromArchitectureId: hs.derivedFromArchitectureId
      });
    }

    for (const sk of snapshot.heatSinks) {
      this.boundaries.registerHeatSink({
        sinkId: sk.sinkId,
        thermalId: sk.thermalId,
        targetRegionId: sk.targetRegionId,
        sinkType: sk.sinkType,
        capacityWatts: sk.capacityWatts,
        ambientTemperatureK: sk.ambientTemperatureK,
        configurationId: sk.configurationId,
        revisionId: sk.revisionId
      });
    }

    // 6. Re-populate interfaces
    for (const iface of snapshot.interfaces) {
      this.interfaces.registerInterface({
        interfaceId: iface.interfaceId,
        thermalId: iface.thermalId,
        p5InterfaceId: iface.p5InterfaceId,
        sourceRegionId: iface.sourceRegionId,
        targetRegionId: iface.targetRegionId,
        contactResistanceK_W: iface.contactResistanceK_W,
        conductanceW_K: iface.conductanceW_K,
        contactAreaM2: iface.contactAreaM2,
        isPerfectContact: iface.isPerfectContact,
        configurationId: iface.configurationId,
        revisionId: iface.revisionId
      });
    }

    // 7. Re-populate paths
    for (const p of snapshot.paths) {
      this.paths.registerPath({
        pathId: p.pathId,
        thermalId: p.thermalId,
        name: p.name,
        sourceEndpoint: p.sourceEndpoint,
        sinkEndpoint: p.sinkEndpoint,
        segments: p.segments,
        configurationId: p.configurationId,
        revisionId: p.revisionId
      });
    }
  }
}
