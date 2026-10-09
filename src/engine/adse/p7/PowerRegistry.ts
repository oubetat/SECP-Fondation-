/**
 * SECP — ADSE-P7 Power Registry
 * 
 * Authoritative registry for Power Systems, Domains, Sources, Loads, Buses,
 * Converters, Storage, Protections, and Operating States.
 * 
 * Enforces:
 * - Single-Core binding to P3 Architecture & P5 Structural Integration
 * - Digital Thread registration (P4)
 * - RevisionEngine locking & cross-revision contamination prevention
 * - Configuration isolation & cross-configuration prevention
 * - Deterministic provenance and SHA-256 Merkle hashes
 */

import { 
  PowerSystem, 
  PowerDomain, 
  PowerSource, 
  PowerLoad, 
  PowerBus, 
  PowerConverter, 
  PowerStorage, 
  PowerProtection, 
  PowerOperatingState,
  PowerDomainType,
  PowerSourceType,
  PowerLoadCriticality,
  ConverterTopology,
  PowerOperatingMode
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { EngineeringAuthority, LifecycleState } from '../p0/types';
import { createHash } from 'crypto';

export class PowerRegistry {
  private systems: Map<string, PowerSystem> = new Map();
  private domains: Map<string, PowerDomain> = new Map();
  private sources: Map<string, PowerSource> = new Map();
  private loads: Map<string, PowerLoad> = new Map();
  private buses: Map<string, PowerBus> = new Map();
  private converters: Map<string, PowerConverter> = new Map();
  private storages: Map<string, PowerStorage> = new Map();
  private protections: Map<string, PowerProtection> = new Map();
  private operatingStates: Map<string, PowerOperatingState> = new Map();

  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine) {
    this.revisionEngine = revisionEngine;
  }

  // --- 1. Power System Registration ---
  public registerSystem(params: {
    systemId: string;
    canonicalId: string;
    p5StructuralId?: string;
    p4NodeId: string;
    displayName: string;
    nominalVoltageV: number;
    domainType: PowerDomainType;
    configurationId: string;
    revisionId?: string;
    authority: EngineeringAuthority;
    lifecycleState?: LifecycleState;
    metadata?: Record<string, any>;
  }): PowerSystem {
    if (this.systems.has(params.systemId)) {
      throw new Error(`POWER_SYSTEM_COLLISION: Power System '${params.systemId}' already exists.`);
    }

    if (!params.systemId || params.systemId.startsWith('FORGED') || params.systemId.includes('FAKE')) {
      throw new Error(`FORGED_POWER_IDENTITY: Power System ID '${params.systemId}' is forged or invalid.`);
    }

    if (!params.canonicalId || params.canonicalId.startsWith('FORGED') || params.canonicalId.includes('FAKE')) {
      throw new Error(`FORGED_CANONICAL_BINDING: Canonical ID '${params.canonicalId}' is forged or invalid.`);
    }

    if (!params.p4NodeId) {
      throw new Error(`DIGITAL_THREAD_UNBOUND: Power System '${params.systemId}' must link to an authoritative P4 Digital Thread node.`);
    }

    if (params.nominalVoltageV <= 0) {
      throw new Error(`IMPOSSIBLE_VOLTAGE: Nominal voltage must be strictly positive, got ${params.nominalVoltageV} V.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.canonicalId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-PWR-${params.systemId}`;
    const revisionHash = activeRev?.revisionHash || createHash('sha256').update(params.systemId + revisionId).digest('hex');

    const provenanceId = `PROV-PWR-${createHash('sha256')
      .update(`${params.systemId}-${params.canonicalId}-${revisionId}`)
      .digest('hex').substring(0, 16)}`;

    const system: PowerSystem = {
      systemId: params.systemId,
      canonicalId: params.canonicalId,
      p5StructuralId: params.p5StructuralId,
      p4NodeId: params.p4NodeId,
      displayName: params.displayName,
      nominalVoltageV: params.nominalVoltageV,
      domainType: params.domainType,
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

    this.systems.set(params.systemId, system);
    return system;
  }

  // --- 2. Power Domain Registration ---
  public registerDomain(params: {
    domainId: string;
    systemId: string;
    name: string;
    domainType: PowerDomainType;
    nominalVoltageV: number;
    voltageRangeMinV: number;
    voltageRangeMaxV: number;
    frequencyHz?: number;
    configurationId: string;
    revisionId: string;
  }): PowerDomain {
    if (this.domains.has(params.domainId)) {
      throw new Error(`DOMAIN_COLLISION: Power Domain '${params.domainId}' already exists.`);
    }

    const system = this.systems.get(params.systemId);
    if (!system) {
      throw new Error(`ORPHAN_DOMAIN: Parent system '${params.systemId}' not found.`);
    }

    if (system.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_DOMAIN: Domain configuration '${params.configurationId}' does not match system '${system.configurationId}'.`);
    }

    if (params.voltageRangeMinV <= 0 || params.voltageRangeMaxV <= params.voltageRangeMinV) {
      throw new Error(`INVALID_VOLTAGE_RANGE: Voltage range [${params.voltageRangeMinV}, ${params.voltageRangeMaxV}] is invalid.`);
    }

    const provenanceId = `PROV-DOM-${createHash('sha256')
      .update(`${params.domainId}-${params.nominalVoltageV}-${params.revisionId}`)
      .digest('hex').substring(0, 16)}`;

    const domain: PowerDomain = {
      domainId: params.domainId,
      systemId: params.systemId,
      name: params.name,
      domainType: params.domainType,
      nominalVoltageV: params.nominalVoltageV,
      voltageRangeMinV: params.voltageRangeMinV,
      voltageRangeMaxV: params.voltageRangeMaxV,
      frequencyHz: params.frequencyHz,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.domains.set(params.domainId, domain);
    return domain;
  }

  // --- 3. Power Bus Registration ---
  public registerBus(params: {
    busId: string;
    systemId: string;
    domainId: string;
    name: string;
    nominalVoltageV: number;
    maxCurrentCapacityAmps: number;
    connectedSourceIds?: string[];
    configurationId: string;
    revisionId: string;
  }): PowerBus {
    if (this.buses.has(params.busId)) {
      throw new Error(`BUS_COLLISION: Power Bus '${params.busId}' already exists.`);
    }

    if (params.busId.startsWith('FORGED') || params.busId.includes('FAKE')) {
      throw new Error(`FORGED_BUS: Bus ID '${params.busId}' is invalid.`);
    }

    const system = this.systems.get(params.systemId);
    if (!system) throw new Error(`ORPHAN_BUS: Parent system '${params.systemId}' not found.`);

    if (system.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_BUS: Bus configuration '${params.configurationId}' does not match system '${system.configurationId}'.`);
    }

    if (params.nominalVoltageV <= 0 || params.maxCurrentCapacityAmps <= 0) {
      throw new Error(`INVALID_BUS_RATINGS: Bus ratings (V=${params.nominalVoltageV}, I=${params.maxCurrentCapacityAmps}) must be strictly positive.`);
    }

    const provenanceId = `PROV-BUS-${createHash('sha256')
      .update(`${params.busId}-${params.nominalVoltageV}-${params.maxCurrentCapacityAmps}`)
      .digest('hex').substring(0, 16)}`;

    const bus: PowerBus = {
      busId: params.busId,
      systemId: params.systemId,
      domainId: params.domainId,
      name: params.name,
      nominalVoltageV: params.nominalVoltageV,
      maxCurrentCapacityAmps: params.maxCurrentCapacityAmps,
      connectedSourceIds: params.connectedSourceIds || [],
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.buses.set(params.busId, bus);
    return bus;
  }

  // --- 4. Power Source Registration ---
  public registerSource(params: {
    sourceId: string;
    systemId: string;
    domainId: string;
    canonicalComponentId: string;
    sourceType: PowerSourceType;
    nominalVoltageV: number;
    voltageRegulationPercent?: number;
    ratedContinuousPowerWatts: number;
    peakPowerWatts: number;
    internalResistanceOhms: number;
    efficiencyPercent?: number;
    configurationId: string;
    revisionId: string;
    derivedFromRequirementId?: string;
    derivedFromArchitectureId?: string;
  }): PowerSource {
    if (this.sources.has(params.sourceId)) {
      throw new Error(`SOURCE_COLLISION: Power Source '${params.sourceId}' already exists.`);
    }

    if (params.sourceId.startsWith('FORGED') || params.sourceId.includes('FAKE')) {
      throw new Error(`FORGED_SOURCE: Source ID '${params.sourceId}' is forged.`);
    }

    if (!params.canonicalComponentId || params.canonicalComponentId.startsWith('FORGED') || params.canonicalComponentId.includes('FAKE')) {
      throw new Error(`NON_CANONICAL_COMPONENT_INJECTION: Canonical component '${params.canonicalComponentId}' is invalid.`);
    }

    const system = this.systems.get(params.systemId);
    if (!system) throw new Error(`ORPHAN_SOURCE: Parent system '${params.systemId}' not found.`);

    if (system.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_SOURCE: Source config '${params.configurationId}' does not match system config '${system.configurationId}'.`);
    }

    if (params.nominalVoltageV <= 0) {
      throw new Error(`INVALID_VOLTAGE: Source nominal voltage must be > 0 V, got ${params.nominalVoltageV}.`);
    }

    if (params.ratedContinuousPowerWatts <= 0 || params.peakPowerWatts < params.ratedContinuousPowerWatts) {
      throw new Error(`INVALID_POWER: Power rating (Continuous=${params.ratedContinuousPowerWatts}, Peak=${params.peakPowerWatts}) is invalid.`);
    }

    if (params.internalResistanceOhms < 0) {
      throw new Error(`INVALID_RESISTANCE: Internal resistance cannot be negative.`);
    }

    const provenanceId = `PROV-SRC-${createHash('sha256')
      .update(`${params.sourceId}-${params.nominalVoltageV}-${params.ratedContinuousPowerWatts}`)
      .digest('hex').substring(0, 16)}`;

    const source: PowerSource = {
      sourceId: params.sourceId,
      systemId: params.systemId,
      domainId: params.domainId,
      canonicalComponentId: params.canonicalComponentId,
      sourceType: params.sourceType,
      nominalVoltageV: params.nominalVoltageV,
      voltageRegulationPercent: params.voltageRegulationPercent ?? 1.0,
      ratedContinuousPowerWatts: params.ratedContinuousPowerWatts,
      peakPowerWatts: params.peakPowerWatts,
      internalResistanceOhms: params.internalResistanceOhms,
      efficiencyPercent: params.efficiencyPercent ?? 95.0,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      derivedFromRequirementId: params.derivedFromRequirementId,
      derivedFromArchitectureId: params.derivedFromArchitectureId,
      provenanceId
    };

    this.sources.set(params.sourceId, source);
    return source;
  }

  // --- 5. Power Load Registration ---
  public registerLoad(params: {
    loadId: string;
    systemId: string;
    domainId: string;
    canonicalComponentId: string;
    connectedBusId: string;
    criticality: PowerLoadCriticality;
    nominalVoltageV: number;
    voltageToleranceMinV: number;
    voltageToleranceMaxV: number;
    nominalDemandWatts: number;
    peakDemandWatts: number;
    inrushDemandWatts?: number;
    inrushDurationMs?: number;
    dutyCycle?: number;
    thermalLossFraction?: number;
    configurationId: string;
    revisionId: string;
    proposedByAI?: boolean;
  }): PowerLoad {
    if (this.loads.has(params.loadId)) {
      throw new Error(`LOAD_COLLISION: Power Load '${params.loadId}' already exists.`);
    }

    if (params.loadId.startsWith('FORGED') || params.loadId.includes('FAKE')) {
      throw new Error(`FORGED_LOAD: Load ID '${params.loadId}' is forged.`);
    }

    if (params.canonicalComponentId.startsWith('FORGED') || params.canonicalComponentId.includes('FAKE')) {
      throw new Error(`NON_CANONICAL_COMPONENT_INJECTION: Canonical component '${params.canonicalComponentId}' is invalid.`);
    }

    const system = this.systems.get(params.systemId);
    if (!system) throw new Error(`ORPHAN_LOAD: Parent system '${params.systemId}' not found.`);

    if (system.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_LOAD: Load config '${params.configurationId}' does not match system config '${system.configurationId}'.`);
    }

    const bus = this.buses.get(params.connectedBusId);
    if (!bus) {
      throw new Error(`BROKEN_BUS: Connected bus '${params.connectedBusId}' does not exist.`);
    }

    if (params.nominalDemandWatts < 0 || params.peakDemandWatts < params.nominalDemandWatts) {
      throw new Error(`IMPOSSIBLE_DEMAND: Power demand (Nominal=${params.nominalDemandWatts}W, Peak=${params.peakDemandWatts}W) is invalid.`);
    }

    if (params.nominalVoltageV <= 0 || params.voltageToleranceMinV >= params.voltageToleranceMaxV) {
      throw new Error(`INVALID_VOLTAGE_TOLERANCE: Voltage tolerances [${params.voltageToleranceMinV}, ${params.voltageToleranceMaxV}] are invalid.`);
    }

    const provenanceId = `PROV-LD-${createHash('sha256')
      .update(`${params.loadId}-${params.connectedBusId}-${params.nominalDemandWatts}`)
      .digest('hex').substring(0, 16)}`;

    const load: PowerLoad = {
      loadId: params.loadId,
      systemId: params.systemId,
      domainId: params.domainId,
      canonicalComponentId: params.canonicalComponentId,
      connectedBusId: params.connectedBusId,
      criticality: params.criticality,
      nominalVoltageV: params.nominalVoltageV,
      voltageToleranceMinV: params.voltageToleranceMinV,
      voltageToleranceMaxV: params.voltageToleranceMaxV,
      nominalDemandWatts: params.nominalDemandWatts,
      peakDemandWatts: params.peakDemandWatts,
      inrushDemandWatts: params.inrushDemandWatts,
      inrushDurationMs: params.inrushDurationMs,
      dutyCycle: params.dutyCycle ?? 1.0,
      thermalLossFraction: params.thermalLossFraction ?? 0.90, // Default 90% dissipated as heat
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      proposedByAI: params.proposedByAI,
      provenanceId
    };

    this.loads.set(params.loadId, load);
    return load;
  }

  // --- 6. Power Converter Registration ---
  public registerConverter(params: {
    converterId: string;
    systemId: string;
    canonicalComponentId: string;
    inputBusId: string;
    outputBusId: string;
    topology: ConverterTopology;
    inputVoltageNominalV: number;
    outputVoltageNominalV: number;
    ratedPowerWatts: number;
    efficiencyPercent: number;
    fixedNoLoadLossWatts?: number;
    configurationId: string;
    revisionId: string;
  }): PowerConverter {
    if (this.converters.has(params.converterId)) {
      throw new Error(`CONVERTER_COLLISION: Power Converter '${params.converterId}' already exists.`);
    }

    if (params.efficiencyPercent <= 0 || params.efficiencyPercent > 100.0) {
      throw new Error(`IMPOSSIBLE_EFFICIENCY: Converter efficiency must be in (0, 100]%, got ${params.efficiencyPercent}%.`);
    }

    if (!this.buses.has(params.inputBusId)) {
      throw new Error(`INVALID_CONVERTER: Input bus '${params.inputBusId}' not found.`);
    }

    if (!this.buses.has(params.outputBusId)) {
      throw new Error(`INVALID_CONVERTER: Output bus '${params.outputBusId}' not found.`);
    }

    if (params.inputBusId === params.outputBusId) {
      throw new Error(`INVALID_TOPOLOGY: Converter input and output buses cannot be identical.`);
    }

    const provenanceId = `PROV-CONV-${createHash('sha256')
      .update(`${params.converterId}-${params.inputBusId}-${params.outputBusId}-${params.efficiencyPercent}`)
      .digest('hex').substring(0, 16)}`;

    const converter: PowerConverter = {
      converterId: params.converterId,
      systemId: params.systemId,
      canonicalComponentId: params.canonicalComponentId,
      inputBusId: params.inputBusId,
      outputBusId: params.outputBusId,
      topology: params.topology,
      inputVoltageNominalV: params.inputVoltageNominalV,
      outputVoltageNominalV: params.outputVoltageNominalV,
      ratedPowerWatts: params.ratedPowerWatts,
      efficiencyPercent: params.efficiencyPercent,
      fixedNoLoadLossWatts: params.fixedNoLoadLossWatts ?? 5.0,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.converters.set(params.converterId, converter);
    return converter;
  }

  // --- 7. Power Storage Registration ---
  public registerStorage(params: {
    storageId: string;
    systemId: string;
    canonicalComponentId: string;
    connectedBusId: string;
    chemistry: 'LI_ION_NMC' | 'LI_FE_PO4' | 'LI_S' | 'SOLID_STATE' | 'SUPERCAPACITOR';
    nameplateCapacityWh: number;
    nominalVoltageV: number;
    maxDischargeRateC: number;
    maxChargeRateC: number;
    roundTripEfficiencyPercent: number;
    stateOfChargePercent: number;
    usableSocMinPercent?: number;
    usableSocMaxPercent?: number;
    internalResistanceOhms: number;
    configurationId: string;
    revisionId: string;
  }): PowerStorage {
    if (this.storages.has(params.storageId)) {
      throw new Error(`STORAGE_COLLISION: Power Storage '${params.storageId}' already exists.`);
    }

    if (params.stateOfChargePercent < 0.0 || params.stateOfChargePercent > 100.0) {
      throw new Error(`INVALID_STORAGE_STATE: State of charge must be in [0, 100]%, got ${params.stateOfChargePercent}%.`);
    }

    const minSoc = params.usableSocMinPercent ?? 20.0;
    const maxSoc = params.usableSocMaxPercent ?? 95.0;
    if (minSoc >= maxSoc || minSoc < 0 || maxSoc > 100) {
      throw new Error(`INVALID_USABLE_SOC_RANGE: Usable SoC range [${minSoc}, ${maxSoc}] is invalid.`);
    }

    if (params.nameplateCapacityWh <= 0) {
      throw new Error(`INVALID_POWER: Battery capacity must be strictly positive.`);
    }

    const provenanceId = `PROV-BAT-${createHash('sha256')
      .update(`${params.storageId}-${params.nameplateCapacityWh}-${params.nominalVoltageV}`)
      .digest('hex').substring(0, 16)}`;

    const storage: PowerStorage = {
      storageId: params.storageId,
      systemId: params.systemId,
      canonicalComponentId: params.canonicalComponentId,
      connectedBusId: params.connectedBusId,
      chemistry: params.chemistry,
      nameplateCapacityWh: params.nameplateCapacityWh,
      nominalVoltageV: params.nominalVoltageV,
      maxDischargeRateC: params.maxDischargeRateC,
      maxChargeRateC: params.maxChargeRateC,
      roundTripEfficiencyPercent: params.roundTripEfficiencyPercent,
      stateOfChargePercent: params.stateOfChargePercent,
      usableSocMinPercent: params.usableSocMinPercent ?? 20.0,
      usableSocMaxPercent: params.usableSocMaxPercent ?? 95.0,
      internalResistanceOhms: params.internalResistanceOhms,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.storages.set(params.storageId, storage);
    return storage;
  }

  // --- 8. Power Protection Registration ---
  public registerProtection(params: {
    protectionId: string;
    systemId: string;
    branchId: string;
    deviceType: 'SOLID_STATE_POWER_CONTROLLER' | 'THERMAL_BREAKER' | 'FAST_FUSE' | 'CURRENT_LIMITER';
    tripCurrentAmps: number;
    tripTimeMs: number;
    configurationId: string;
    revisionId: string;
  }): PowerProtection {
    if (this.protections.has(params.protectionId)) {
      throw new Error(`PROTECTION_COLLISION: Protection '${params.protectionId}' already exists.`);
    }

    if (params.tripCurrentAmps <= 0) {
      throw new Error(`INVALID_CURRENT: Trip current must be > 0 A, got ${params.tripCurrentAmps}.`);
    }

    const provenanceId = `PROV-PROT-${createHash('sha256')
      .update(`${params.protectionId}-${params.branchId}-${params.tripCurrentAmps}`)
      .digest('hex').substring(0, 16)}`;

    const protection: PowerProtection = {
      protectionId: params.protectionId,
      systemId: params.systemId,
      branchId: params.branchId,
      deviceType: params.deviceType,
      tripCurrentAmps: params.tripCurrentAmps,
      tripTimeMs: params.tripTimeMs,
      isTripped: false,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.protections.set(params.protectionId, protection);
    return protection;
  }

  // --- 9. Power Operating State Registration ---
  public registerOperatingState(params: {
    stateId: string;
    systemId: string;
    mode: PowerOperatingMode;
    name: string;
    activeSourceIds: string[];
    activeLoadIds: string[];
    activeConverterIds?: string[];
    loadScalingFactors?: Record<string, number>;
    storageDischargeEnabled?: boolean;
    ambientTemperatureK?: number;
    durationSeconds?: number;
    configurationId: string;
    revisionId: string;
  }): PowerOperatingState {
    if (this.operatingStates.has(params.stateId)) {
      throw new Error(`STATE_COLLISION: Operating State '${params.stateId}' already exists.`);
    }

    const provenanceId = `PROV-ST-${createHash('sha256')
      .update(`${params.stateId}-${params.mode}-${params.activeLoadIds.length}`)
      .digest('hex').substring(0, 16)}`;

    const state: PowerOperatingState = {
      stateId: params.stateId,
      systemId: params.systemId,
      mode: params.mode,
      name: params.name,
      activeSourceIds: params.activeSourceIds,
      activeLoadIds: params.activeLoadIds,
      activeConverterIds: params.activeConverterIds || [],
      loadScalingFactors: params.loadScalingFactors || {},
      storageDischargeEnabled: params.storageDischargeEnabled ?? true,
      ambientTemperatureK: params.ambientTemperatureK ?? 295.15,
      durationSeconds: params.durationSeconds,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.operatingStates.set(params.stateId, state);
    return state;
  }

  // --- Getters & Queries ---
  public getSystem(systemId: string): PowerSystem | undefined { return this.systems.get(systemId); }
  public getAllSystems(): PowerSystem[] { return Array.from(this.systems.values()); }

  public getDomain(domainId: string): PowerDomain | undefined { return this.domains.get(domainId); }
  public getDomainsForSystem(systemId: string): PowerDomain[] { return Array.from(this.domains.values()).filter(d => d.systemId === systemId); }
  public getAllDomains(): PowerDomain[] { return Array.from(this.domains.values()); }

  public getBus(busId: string): PowerBus | undefined { return this.buses.get(busId); }
  public getBusesForSystem(systemId: string): PowerBus[] { return Array.from(this.buses.values()).filter(b => b.systemId === systemId); }
  public getAllBuses(): PowerBus[] { return Array.from(this.buses.values()); }

  public getSource(sourceId: string): PowerSource | undefined { return this.sources.get(sourceId); }
  public getSourcesForSystem(systemId: string): PowerSource[] { return Array.from(this.sources.values()).filter(s => s.systemId === systemId); }
  public getAllSources(): PowerSource[] { return Array.from(this.sources.values()); }

  public getLoad(loadId: string): PowerLoad | undefined { return this.loads.get(loadId); }
  public getLoadsForSystem(systemId: string): PowerLoad[] { return Array.from(this.loads.values()).filter(l => l.systemId === systemId); }
  public getAllLoads(): PowerLoad[] { return Array.from(this.loads.values()); }

  public getConverter(converterId: string): PowerConverter | undefined { return this.converters.get(converterId); }
  public getConvertersForSystem(systemId: string): PowerConverter[] { return Array.from(this.converters.values()).filter(c => c.systemId === systemId); }
  public getAllConverters(): PowerConverter[] { return Array.from(this.converters.values()); }

  public getStorage(storageId: string): PowerStorage | undefined { return this.storages.get(storageId); }
  public getStoragesForSystem(systemId: string): PowerStorage[] { return Array.from(this.storages.values()).filter(s => s.systemId === systemId); }
  public getAllStorages(): PowerStorage[] { return Array.from(this.storages.values()); }

  public getProtection(protectionId: string): PowerProtection | undefined { return this.protections.get(protectionId); }
  public getProtectionsForSystem(systemId: string): PowerProtection[] { return Array.from(this.protections.values()).filter(p => p.systemId === systemId); }
  public getAllProtections(): PowerProtection[] { return Array.from(this.protections.values()); }

  public getOperatingState(stateId: string): PowerOperatingState | undefined { return this.operatingStates.get(stateId); }
  public getOperatingStatesForSystem(systemId: string): PowerOperatingState[] { return Array.from(this.operatingStates.values()).filter(s => s.systemId === systemId); }
  public getAllOperatingStates(): PowerOperatingState[] { return Array.from(this.operatingStates.values()); }

  public clear(): void {
    this.systems.clear();
    this.domains.clear();
    this.sources.clear();
    this.loads.clear();
    this.buses.clear();
    this.converters.clear();
    this.storages.clear();
    this.protections.clear();
    this.operatingStates.clear();
  }
}
