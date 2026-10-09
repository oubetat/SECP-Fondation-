/**
 * SECP Industrial OS — EPC-013: Cross-Domain Registry
 */

import { 
  EngineeringDomain, 
  EngineeringServiceType, 
  CrossDomainServiceContract 
} from './CrossDomainTypes';

export class CrossDomainRegistry {
  private static services: Map<EngineeringServiceType, CrossDomainServiceContract> = new Map();
  private static domainCapabilities: Map<EngineeringDomain, EngineeringServiceType[]> = new Map();

  /**
   * Registers a universal engineering service.
   */
  public static registerService(type: EngineeringServiceType, contract: CrossDomainServiceContract): void {
    // Architectural check: No domain-specific naming in IDs
    if (contract.serviceId.toUpperCase().includes('DRONE') || 
        contract.serviceId.toUpperCase().includes('ROBOT') || 
        contract.serviceId.toUpperCase().includes('VEHICLE')) {
      throw new Error(`ARCHITECTURAL_DUPLICATION: Service ID '${contract.serviceId}' contains domain-specific naming.`);
    }

    this.services.set(type, contract);
    
    // Auto-link supported domains
    for (const domain of contract.supportedDomains) {
      this.linkDomainToService(domain, type);
    }
  }

  /**
   * Links a domain to an existing service type.
   */
  public static linkDomainToService(domain: EngineeringDomain, type: EngineeringServiceType): void {
    const caps = this.domainCapabilities.get(domain) || [];
    if (!caps.includes(type)) {
      caps.push(type);
    }
    this.domainCapabilities.set(domain, caps);
  }

  public static getService(type: EngineeringServiceType): CrossDomainServiceContract | undefined {
    return this.services.get(type);
  }

  public static getDomainCapabilities(domain: EngineeringDomain): EngineeringServiceType[] {
    return this.domainCapabilities.get(domain) || [];
  }

  public static isServiceSupported(domain: EngineeringDomain, type: EngineeringServiceType): boolean {
    return this.getDomainCapabilities(domain).includes(type);
  }
}
