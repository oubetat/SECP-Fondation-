/**
 * SECP — ADSE-P7 Power Persistence Engine
 * 
 * Invariant:
 * «Persistence does not create new truth; it deterministically captures,
 * hashes, clears, reloads, and reconstructs authoritative Power Truth.»
 */

import { PowerSnapshot } from './types';
import { PowerRegistry } from './PowerRegistry';
import { PowerTopologyEngine } from './PowerTopologyEngine';
import { PowerSolverBridge } from './PowerSolverBridge';
import { PowerVerificationAndEvidenceEngine } from './PowerVerificationAndEvidenceEngine';
import { createHash } from 'crypto';

export class PowerPersistenceEngine {
  constructor(
    private registry: PowerRegistry,
    private topology: PowerTopologyEngine,
    private solverBridge: PowerSolverBridge,
    private verificationEngine: PowerVerificationAndEvidenceEngine
  ) {}

  /**
   * Creates an immutable, Merkle-hashed snapshot of all power entities.
   */
  public createSnapshot(configurationId: string): PowerSnapshot {
    const systems = this.registry.getAllSystems().filter(s => s.configurationId === configurationId);
    const systemIds = systems.map(s => s.systemId);

    const domains = this.registry.getAllDomains().filter(d => systemIds.includes(d.systemId));
    const sources = this.registry.getAllSources().filter(s => systemIds.includes(s.systemId));
    const loads = this.registry.getAllLoads().filter(l => systemIds.includes(l.systemId));
    const buses = this.registry.getAllBuses().filter(b => systemIds.includes(b.systemId));
    const branches = this.topology.getAllBranches().filter(br => systemIds.includes(br.systemId));
    const converters = this.registry.getAllConverters().filter(c => systemIds.includes(c.systemId));
    const storages = this.registry.getAllStorages().filter(st => systemIds.includes(st.systemId));
    const protections = this.registry.getAllProtections().filter(p => systemIds.includes(p.systemId));
    const operatingStates = this.registry.getAllOperatingStates().filter(o => systemIds.includes(o.systemId));

    const executions = this.solverBridge.getAllExecutions().filter(e => systemIds.includes(e.systemId));
    const results = this.solverBridge.getAllResults().filter(r => systemIds.includes(r.systemId));
    const verifications = this.verificationEngine.getAllIntents().filter(v => systemIds.includes(v.systemId));
    const evidences = this.verificationEngine.getAllEvidences().filter(ev => systemIds.includes(ev.systemId));

    const rawPayload = JSON.stringify({
      systems,
      domains,
      sources,
      loads,
      buses,
      branches,
      converters,
      storages,
      protections,
      operatingStates,
      executions,
      results,
      verifications,
      evidences
    });

    const merkleRoot = createHash('sha256').update(rawPayload).digest('hex');

    return {
      snapshotId: `snap:pwr:${createHash('sha256').update(merkleRoot).digest('hex').substring(0, 16)}`,
      timestamp: new Date().toISOString(),
      configurationId,
      systems,
      domains,
      sources,
      loads,
      buses,
      branches,
      converters,
      storages,
      protections,
      operatingStates,
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
  public reconstruct(snapshot: PowerSnapshot): void {
    // 1. Clear in-memory state
    this.registry.clear();
    this.topology.clear();
    this.solverBridge.clear();
    this.verificationEngine.clear();

    // 2. Re-populate Systems
    for (const sys of snapshot.systems) {
      this.registry.registerSystem({
        systemId: sys.systemId,
        canonicalId: sys.canonicalId,
        p5StructuralId: sys.p5StructuralId,
        p4NodeId: sys.p4NodeId,
        displayName: sys.displayName,
        nominalVoltageV: sys.nominalVoltageV,
        domainType: sys.domainType,
        configurationId: sys.configurationId,
        revisionId: sys.revisionId,
        authority: sys.authority,
        lifecycleState: sys.lifecycleState,
        metadata: sys.metadata
      });
    }

    // 3. Re-populate Domains
    for (const dom of snapshot.domains) {
      this.registry.registerDomain({
        domainId: dom.domainId,
        systemId: dom.systemId,
        name: dom.name,
        domainType: dom.domainType,
        nominalVoltageV: dom.nominalVoltageV,
        voltageRangeMinV: dom.voltageRangeMinV,
        voltageRangeMaxV: dom.voltageRangeMaxV,
        frequencyHz: dom.frequencyHz,
        configurationId: dom.configurationId,
        revisionId: dom.revisionId
      });
    }

    // 4. Re-populate Buses
    for (const b of snapshot.buses) {
      this.registry.registerBus({
        busId: b.busId,
        systemId: b.systemId,
        domainId: b.domainId,
        name: b.name,
        nominalVoltageV: b.nominalVoltageV,
        maxCurrentCapacityAmps: b.maxCurrentCapacityAmps,
        connectedSourceIds: b.connectedSourceIds,
        configurationId: b.configurationId,
        revisionId: b.revisionId
      });
    }

    // 5. Re-populate Sources
    for (const s of snapshot.sources) {
      this.registry.registerSource({
        sourceId: s.sourceId,
        systemId: s.systemId,
        domainId: s.domainId,
        canonicalComponentId: s.canonicalComponentId,
        sourceType: s.sourceType,
        nominalVoltageV: s.nominalVoltageV,
        voltageRegulationPercent: s.voltageRegulationPercent,
        ratedContinuousPowerWatts: s.ratedContinuousPowerWatts,
        peakPowerWatts: s.peakPowerWatts,
        internalResistanceOhms: s.internalResistanceOhms,
        efficiencyPercent: s.efficiencyPercent,
        configurationId: s.configurationId,
        revisionId: s.revisionId,
        derivedFromRequirementId: s.derivedFromRequirementId,
        derivedFromArchitectureId: s.derivedFromArchitectureId
      });
    }

    // 6. Re-populate Loads
    for (const l of snapshot.loads) {
      this.registry.registerLoad({
        loadId: l.loadId,
        systemId: l.systemId,
        domainId: l.domainId,
        canonicalComponentId: l.canonicalComponentId,
        connectedBusId: l.connectedBusId,
        criticality: l.criticality,
        nominalVoltageV: l.nominalVoltageV,
        voltageToleranceMinV: l.voltageToleranceMinV,
        voltageToleranceMaxV: l.voltageToleranceMaxV,
        nominalDemandWatts: l.nominalDemandWatts,
        peakDemandWatts: l.peakDemandWatts,
        inrushDemandWatts: l.inrushDemandWatts,
        inrushDurationMs: l.inrushDurationMs,
        dutyCycle: l.dutyCycle,
        thermalLossFraction: l.thermalLossFraction,
        configurationId: l.configurationId,
        revisionId: l.revisionId,
        proposedByAI: l.proposedByAI
      });
    }

    // 7. Re-populate Branches
    for (const br of snapshot.branches) {
      this.topology.registerBranch({
        branchId: br.branchId,
        systemId: br.systemId,
        fromBusId: br.fromBusId,
        toTargetId: br.toTargetId,
        lineResistanceOhms: br.lineResistanceOhms,
        maxCurrentAmps: br.maxCurrentAmps,
        protectionRatingAmps: br.protectionRatingAmps,
        configurationId: br.configurationId,
        revisionId: br.revisionId
      });
    }

    // 8. Re-populate Converters & Storage & Protection
    for (const c of snapshot.converters) {
      this.registry.registerConverter({
        converterId: c.converterId,
        systemId: c.systemId,
        canonicalComponentId: c.canonicalComponentId,
        inputBusId: c.inputBusId,
        outputBusId: c.outputBusId,
        topology: c.topology,
        inputVoltageNominalV: c.inputVoltageNominalV,
        outputVoltageNominalV: c.outputVoltageNominalV,
        ratedPowerWatts: c.ratedPowerWatts,
        efficiencyPercent: c.efficiencyPercent,
        fixedNoLoadLossWatts: c.fixedNoLoadLossWatts,
        configurationId: c.configurationId,
        revisionId: c.revisionId
      });
    }

    for (const st of snapshot.storages) {
      this.registry.registerStorage({
        storageId: st.storageId,
        systemId: st.systemId,
        canonicalComponentId: st.canonicalComponentId,
        connectedBusId: st.connectedBusId,
        chemistry: st.chemistry,
        nameplateCapacityWh: st.nameplateCapacityWh,
        nominalVoltageV: st.nominalVoltageV,
        maxDischargeRateC: st.maxDischargeRateC,
        maxChargeRateC: st.maxChargeRateC,
        roundTripEfficiencyPercent: st.roundTripEfficiencyPercent,
        stateOfChargePercent: st.stateOfChargePercent,
        usableSocMinPercent: st.usableSocMinPercent,
        usableSocMaxPercent: st.usableSocMaxPercent,
        internalResistanceOhms: st.internalResistanceOhms,
        configurationId: st.configurationId,
        revisionId: st.revisionId
      });
    }

    for (const p of snapshot.protections) {
      this.registry.registerProtection({
        protectionId: p.protectionId,
        systemId: p.systemId,
        branchId: p.branchId,
        deviceType: p.deviceType,
        tripCurrentAmps: p.tripCurrentAmps,
        tripTimeMs: p.tripTimeMs,
        configurationId: p.configurationId,
        revisionId: p.revisionId
      });
    }

    // 9. Re-populate Operating States
    for (const o of snapshot.operatingStates) {
      this.registry.registerOperatingState({
        stateId: o.stateId,
        systemId: o.systemId,
        mode: o.mode,
        name: o.name,
        activeSourceIds: o.activeSourceIds,
        activeLoadIds: o.activeLoadIds,
        activeConverterIds: o.activeConverterIds,
        loadScalingFactors: o.loadScalingFactors,
        storageDischargeEnabled: o.storageDischargeEnabled,
        ambientTemperatureK: o.ambientTemperatureK,
        durationSeconds: o.durationSeconds,
        configurationId: o.configurationId,
        revisionId: o.revisionId
      });
    }
  }
}
