/**
 * SECP Industrial OS — EPC-013: Cross-Domain Execution Tracker
 */

import { 
  CrossDomainExecutionRecord, 
  EngineeringDomain, 
  EngineeringServiceType,
  ServiceReuseAssertion,
  ReuseStatus
} from './CrossDomainTypes';
import { CrossDomainRegistry } from './CrossDomainRegistry';
import { EvidenceIntegrityService } from '../epc/evidence/EvidenceIntegrityService';

export class CrossDomainExecutionTracker {
  private static executions: CrossDomainExecutionRecord[] = [];

  /**
   * Records a service execution for a specific domain.
   */
  public static recordExecution(
    domain: EngineeringDomain,
    serviceType: EngineeringServiceType,
    workflowId: string,
    inputs: any,
    outputs: any,
    status: 'PASS' | 'FAIL' | 'INCONCLUSIVE'
  ): CrossDomainExecutionRecord {
    const service = CrossDomainRegistry.getService(serviceType);
    if (!service) throw new Error(`Service ${serviceType} not registered`);

    if (!CrossDomainRegistry.isServiceSupported(domain, serviceType)) {
      throw new Error(`Service ${serviceType} not supported for domain ${domain}`);
    }

    const execution: CrossDomainExecutionRecord = {
      executionId: `EXEC-XD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      serviceId: service.serviceId,
      domainId: domain,
      workflowId,
      implementationFingerprint: service.implementationFingerprint,
      inputHash: EvidenceIntegrityService.computeHash(inputs),
      outputHash: EvidenceIntegrityService.computeHash(outputs),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status
    };

    this.executions.push(execution);
    return execution;
  }

  /**
   * Generates a reuse assertion for a service.
   */
  public static getReuseAssertion(serviceType: EngineeringServiceType): ServiceReuseAssertion {
    const serviceExecs = this.executions.filter(e => {
      const s = CrossDomainRegistry.getService(serviceType);
      return s && e.serviceId === s.serviceId;
    });

    const domains = Array.from(new Set(serviceExecs.map(e => e.domainId)));
    const fingerprints = Array.from(new Set(serviceExecs.map(e => e.implementationFingerprint)));
    
    const successful = serviceExecs.filter(e => e.status === 'PASS').length;

    let reuseStatus = ReuseStatus.INCONCLUSIVE;
    if (domains.length >= 2 && fingerprints.length === 1 && successful > 0) {
      reuseStatus = ReuseStatus.VERIFIED;
    } else if (fingerprints.length > 1) {
      // Multiple implementations for the same service ID suggests duplication or inconsistency
      reuseStatus = ReuseStatus.INCONCLUSIVE; 
    }

    return {
      serviceId: serviceType,
      domainsTested: domains,
      implementationIds: fingerprints,
      executionCount: serviceExecs.length,
      successfulExecutions: successful,
      reuseStatus,
      evidenceReferences: serviceExecs.map(e => e.executionId)
    };
  }

  public static getExecutionsByDomain(domain: EngineeringDomain): CrossDomainExecutionRecord[] {
    return this.executions.filter(e => e.domainId === domain);
  }
}
