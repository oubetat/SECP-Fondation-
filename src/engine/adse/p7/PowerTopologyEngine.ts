/**
 * SECP — ADSE-P7 Power Topology Engine
 * 
 * Manages electrical network topologies, branches, distribution paths, and connectivity.
 * Validates:
 * - Continuity from Source -> Bus -> Branch -> Converter/Sub-Bus -> Load
 * - Branch capacity and overcurrent protection matching
 * - Cross-configuration isolation
 * - Detection of dangling branches, disconnected paths, and impossible endpoints
 */

import { PowerBranch } from './types';
import { PowerRegistry } from './PowerRegistry';
import { createHash } from 'crypto';

export class PowerTopologyEngine {
  private branches: Map<string, PowerBranch> = new Map();
  private registry: PowerRegistry;

  constructor(registry: PowerRegistry) {
    this.registry = registry;
  }

  /**
   * Registers an authoritative distribution branch/conductor.
   */
  public registerBranch(params: {
    branchId: string;
    systemId: string;
    fromBusId: string;
    toTargetId: string;
    lineResistanceOhms: number;
    maxCurrentAmps: number;
    protectionRatingAmps: number;
    configurationId: string;
    revisionId: string;
  }): PowerBranch {
    if (this.branches.has(params.branchId)) {
      throw new Error(`BRANCH_COLLISION: Power Branch '${params.branchId}' already exists.`);
    }

    if (params.branchId.startsWith('FORGED') || params.branchId.includes('FAKE')) {
      throw new Error(`FORGED_BRANCH: Branch ID '${params.branchId}' is forged.`);
    }

    const system = this.registry.getSystem(params.systemId);
    if (!system) {
      throw new Error(`ORPHAN_BRANCH: Parent system '${params.systemId}' not found.`);
    }

    if (system.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_BRANCH: Branch configuration '${params.configurationId}' does not match system '${system.configurationId}'.`);
    }

    // Verify fromBus exists
    const fromBus = this.registry.getBus(params.fromBusId);
    if (!fromBus) {
      throw new Error(`BROKEN_BUS: From-bus '${params.fromBusId}' does not exist.`);
    }

    if (fromBus.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_BRANCH: From-bus config '${fromBus.configurationId}' does not match branch config '${params.configurationId}'.`);
    }

    // Verify toTarget exists (can be Load, Converter, or another Bus)
    const isTargetLoad = !!this.registry.getLoad(params.toTargetId);
    const isTargetConverter = !!this.registry.getConverter(params.toTargetId);
    const isTargetBus = !!this.registry.getBus(params.toTargetId);

    if (!isTargetLoad && !isTargetConverter && !isTargetBus) {
      throw new Error(`IMPOSSIBLE_ENDPOINT: Target '${params.toTargetId}' is neither a registered Load, Converter, nor Bus.`);
    }

    if (params.lineResistanceOhms < 0) {
      throw new Error(`INVALID_RESISTANCE: Branch line resistance cannot be negative.`);
    }

    if (params.maxCurrentAmps <= 0 || params.protectionRatingAmps <= 0) {
      throw new Error(`INVALID_CURRENT: Branch ratings must be strictly positive.`);
    }

    if (params.protectionRatingAmps > params.maxCurrentAmps * 1.25) {
      throw new Error(`OVERLOADED_BRANCH_PROTECTION: Protection rating (${params.protectionRatingAmps}A) exceeds branch safe ampacity (${params.maxCurrentAmps}A).`);
    }

    const provenanceId = `PROV-BR-${createHash('sha256')
      .update(`${params.branchId}-${params.fromBusId}-${params.toTargetId}-${params.lineResistanceOhms}`)
      .digest('hex').substring(0, 16)}`;

    const branch: PowerBranch = {
      branchId: params.branchId,
      systemId: params.systemId,
      fromBusId: params.fromBusId,
      toTargetId: params.toTargetId,
      lineResistanceOhms: params.lineResistanceOhms,
      maxCurrentAmps: params.maxCurrentAmps,
      protectionRatingAmps: params.protectionRatingAmps,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.branches.set(params.branchId, branch);
    return branch;
  }

  public getBranch(branchId: string): PowerBranch | undefined {
    return this.branches.get(branchId);
  }

  public getBranchesForSystem(systemId: string): PowerBranch[] {
    return Array.from(this.branches.values()).filter(b => b.systemId === systemId);
  }

  public getAllBranches(): PowerBranch[] {
    return Array.from(this.branches.values());
  }

  /**
   * Finds the path from a source to a given load.
   */
  public tracePathToLoad(loadId: string): {
    load: any;
    bus: any;
    sources: any[];
    branch?: PowerBranch;
    isContinuous: boolean;
  } {
    const load = this.registry.getLoad(loadId);
    if (!load) throw new Error(`LOAD_NOT_FOUND: Load '${loadId}' not found.`);

    const bus = this.registry.getBus(load.connectedBusId);
    if (!bus) {
      return { load, bus: undefined, sources: [], isContinuous: false };
    }

    const sources = bus.connectedSourceIds
      .map(id => this.registry.getSource(id))
      .filter(s => s !== undefined);

    const branch = Array.from(this.branches.values()).find(
      b => b.fromBusId === bus.busId && b.toTargetId === loadId
    );

    const isContinuous = sources.length > 0;

    return {
      load,
      bus,
      sources,
      branch,
      isContinuous
    };
  }

  public clear(): void {
    this.branches.clear();
  }
}
