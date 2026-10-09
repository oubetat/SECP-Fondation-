/**
 * SECP — ADSE-P3 Architecture Interface & Port Engine
 * Manages architectural endpoints, contracts, provider/consumer directions,
 * and interface compatibility across boundaries.
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { ArchitectureInterface } from './types';

export class ArchitectureInterfaceEngine {
  private registry: ArchitectureElementRegistry;
  private interfaces: Map<string, ArchitectureInterface> = new Map();

  constructor(registry: ArchitectureElementRegistry) {
    this.registry = registry;
  }

  public defineInterface(params: {
    interfaceId: string;
    displayName: string;
    providerArchId: string;
    consumerArchId: string;
    direction?: 'UNIDIRECTIONAL' | 'BIDIRECTIONAL';
    requiredContract: string;
    providedContract: string;
    flowItemType?: string;
    configurationId: string;
  }): ArchitectureInterface {
    if (this.interfaces.has(params.interfaceId)) {
      throw new Error(`INTERFACE_ERROR: Interface '${params.interfaceId}' already defined.`);
    }

    const provider = this.registry.getElement(params.providerArchId);
    const consumer = this.registry.getElement(params.consumerArchId);

    if (!provider) {
      throw new Error(`INTERFACE_ERROR: Provider element '${params.providerArchId}' does not exist.`);
    }
    if (!consumer) {
      throw new Error(`INTERFACE_ERROR: Consumer element '${params.consumerArchId}' does not exist.`);
    }

    // Compatibility check between providedContract and requiredContract
    const isCompatible = params.providedContract.trim().toLowerCase() === params.requiredContract.trim().toLowerCase();
    const compatibilityDetails = isCompatible 
      ? 'Contract match verified.' 
      : `Contract mismatch: Provided '${params.providedContract}' != Required '${params.requiredContract}'`;

    const archInterface: ArchitectureInterface = {
      interfaceId: params.interfaceId,
      displayName: params.displayName,
      providerArchId: params.providerArchId,
      consumerArchId: params.consumerArchId,
      direction: params.direction || 'UNIDIRECTIONAL',
      requiredContract: params.requiredContract,
      providedContract: params.providedContract,
      flowItemType: params.flowItemType,
      configurationId: params.configurationId,
      revisionId: provider.revisionId,
      isCompatible,
      compatibilityDetails
    };

    this.interfaces.set(params.interfaceId, archInterface);

    // Register typed relationships in the registry
    this.registry.addRelationship({
      relationshipType: 'INTERFACES_WITH',
      sourceArchId: params.providerArchId,
      targetArchId: params.consumerArchId,
      configurationId: params.configurationId,
      metadata: { interfaceId: params.interfaceId, flowItemType: params.flowItemType }
    });

    return archInterface;
  }

  public getInterface(interfaceId: string): ArchitectureInterface | undefined {
    return this.interfaces.get(interfaceId);
  }

  public getAllInterfaces(): ArchitectureInterface[] {
    return Array.from(this.interfaces.values());
  }

  public getInterfacesForElement(archId: string): ArchitectureInterface[] {
    return Array.from(this.interfaces.values()).filter(
      i => i.providerArchId === archId || i.consumerArchId === archId
    );
  }

  public clear(): void {
    this.interfaces.clear();
  }
}
