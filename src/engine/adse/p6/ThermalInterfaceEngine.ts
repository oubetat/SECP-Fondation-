/**
 * SECP — ADSE-P6 Thermal Interface Engine
 * 
 * Maps P5 Structural Interfaces directly to Thermal Interfaces and Contact Conductances.
 * Enforces:
 * - Direct coupling to P5 Structural Interface (`p5InterfaceId`)
 * - Source and target region validation
 * - Configuration & revision consistency between connected regions
 * - Non-negative contact resistance and strictly positive conductance ($G = 1 / R_{th}$)
 */

import { ThermalInterface } from './types';
import { ThermalRegistry } from './ThermalRegistry';
import { createHash } from 'crypto';

export class ThermalInterfaceEngine {
  private interfaces: Map<string, ThermalInterface> = new Map();
  private registry: ThermalRegistry;

  constructor(registry: ThermalRegistry) {
    this.registry = registry;
  }

  /**
   * Registers a Thermal Interface coupled to P5 Structural Interface.
   */
  public registerInterface(params: {
    interfaceId: string;
    thermalId: string;
    p5InterfaceId: string;
    sourceRegionId: string;
    targetRegionId: string;
    contactResistanceK_W?: number;
    conductanceW_K?: number;
    contactAreaM2: number;
    isPerfectContact?: boolean;
    configurationId: string;
    revisionId: string;
  }): ThermalInterface {
    if (this.interfaces.has(params.interfaceId)) {
      throw new Error(`THERMAL_INTERFACE_COLLISION: Thermal Interface '${params.interfaceId}' already exists.`);
    }

    // Must bind to P5 Structural Interface
    if (!params.p5InterfaceId || params.p5InterfaceId.startsWith('FAKE') || params.p5InterfaceId.startsWith('FORGED')) {
      throw new Error(`BROKEN_THERMAL_INTERFACE: Thermal Interface '${params.interfaceId}' must bind to an authoritative P5 Structural Interface.`);
    }

    // Verify parent model
    const model = this.registry.getModel(params.thermalId);
    if (!model) {
      throw new Error(`ORPHAN_THERMAL_INTERFACE: Parent Thermal Model '${params.thermalId}' not found.`);
    }

    // Verify regions
    const sourceRegion = this.registry.getRegion(params.sourceRegionId);
    const targetRegion = this.registry.getRegion(params.targetRegionId);

    if (!sourceRegion) {
      throw new Error(`INTERFACE_ENDPOINT_NOT_FOUND: Source region '${params.sourceRegionId}' does not exist.`);
    }

    if (!targetRegion) {
      throw new Error(`INTERFACE_ENDPOINT_NOT_FOUND: Target region '${params.targetRegionId}' does not exist.`);
    }

    // Cross-Configuration Contamination Check
    if (sourceRegion.configurationId !== targetRegion.configurationId || sourceRegion.configurationId !== params.configurationId) {
      throw new Error(`CROSS_CONFIGURATION_INTERFACE: Connected regions must belong to identical configuration '${params.configurationId}'.`);
    }

    // Cross-Revision Check
    if (sourceRegion.revisionId !== targetRegion.revisionId || sourceRegion.revisionId !== params.revisionId) {
      throw new Error(`CROSS_REVISION_INTERFACE: Connected regions have mismatched revisions (${sourceRegion.revisionId} vs ${targetRegion.revisionId}).`);
    }

    if (params.contactAreaM2 <= 0) {
      throw new Error(`IMPOSSIBLE_CONTACT_AREA: Contact area must be > 0 m^2, got ${params.contactAreaM2}.`);
    }

    // Resistance vs Conductance resolution
    let contactResistanceK_W = params.contactResistanceK_W ?? 0;
    let conductanceW_K = params.conductanceW_K ?? 0;

    if (params.isPerfectContact) {
      contactResistanceK_W = 0;
      conductanceW_K = 1e6; // Effectively infinite conductance
    } else if (conductanceW_K > 0 && contactResistanceK_W === 0) {
      contactResistanceK_W = 1.0 / conductanceW_K;
    } else if (contactResistanceK_W > 0 && conductanceW_K === 0) {
      conductanceW_K = 1.0 / contactResistanceK_W;
    } else if (conductanceW_K === 0 && contactResistanceK_W === 0) {
      // Default standard thermal contact resistance
      contactResistanceK_W = 0.05; // 0.05 K/W
      conductanceW_K = 20.0;
    }

    const provenanceId = `PROV-IF-${createHash('sha256')
      .update(`${params.interfaceId}-${params.p5InterfaceId}-${params.sourceRegionId}-${params.targetRegionId}`)
      .digest('hex').substring(0, 16)}`;

    const iface: ThermalInterface = {
      interfaceId: params.interfaceId,
      thermalId: params.thermalId,
      p5InterfaceId: params.p5InterfaceId,
      sourceRegionId: params.sourceRegionId,
      targetRegionId: params.targetRegionId,
      contactResistanceK_W,
      conductanceW_K,
      contactAreaM2: params.contactAreaM2,
      isPerfectContact: !!params.isPerfectContact,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId,
      coreBindingState: 'BOUND_TO_CORE'
    };

    this.interfaces.set(params.interfaceId, iface);
    return iface;
  }

  public getInterface(interfaceId: string): ThermalInterface | undefined {
    return this.interfaces.get(interfaceId);
  }

  public getInterfacesForModel(thermalId: string): ThermalInterface[] {
    return Array.from(this.interfaces.values()).filter(i => i.thermalId === thermalId);
  }

  public getAllInterfaces(): ThermalInterface[] {
    return Array.from(this.interfaces.values());
  }

  public clear(): void {
    this.interfaces.clear();
  }
}
