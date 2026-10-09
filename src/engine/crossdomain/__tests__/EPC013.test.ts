/**
 * SECP Industrial OS — EPC-013: Cross-Domain Verification Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { EngineeringDomain, EngineeringServiceType, ReuseStatus } from '../CrossDomainTypes';
import { CrossDomainRegistry } from '../CrossDomainRegistry';
import { CrossDomainExecutionTracker } from '../CrossDomainExecutionTracker';

describe('EPC-013: Cross-Domain Engineering Service Reuse', () => {
  
  beforeEach(() => {
    // Reset registries for clean tests (if they weren't static, but since they are, we register common set)
    const commonDomains = [
      EngineeringDomain.DRONE, 
      EngineeringDomain.ROBOT, 
      EngineeringDomain.VEHICLE, 
      EngineeringDomain.PUMP
    ];

    CrossDomainRegistry.registerService(EngineeringServiceType.CAD, {
      serviceId: 'CORE-CAD-ENGINE',
      serviceName: 'Universal CAD Kernel',
      serviceVersion: 'v2.1.0',
      implementationFingerprint: 'FP-CAD-7788',
      supportedDomains: commonDomains,
      inputSchema: {},
      outputSchema: {}
    });

    CrossDomainRegistry.registerService(EngineeringServiceType.FEA, {
      serviceId: 'CORE-FEA-SOLVER',
      serviceName: 'Universal Finite Element Solver',
      serviceVersion: 'v4.5.0',
      implementationFingerprint: 'FP-FEA-1122',
      supportedDomains: [EngineeringDomain.DRONE, EngineeringDomain.ROBOT, EngineeringDomain.VEHICLE],
      inputSchema: {},
      outputSchema: {}
    });

    CrossDomainRegistry.registerService(EngineeringServiceType.EVIDENCE, {
      serviceId: 'CORE-EVIDENCE-BUS',
      serviceName: 'Universal Evidence Bus',
      serviceVersion: 'v1.0.0',
      implementationFingerprint: 'FP-EV-9900',
      supportedDomains: [...commonDomains, EngineeringDomain.MANUFACTURING_CELL],
      inputSchema: {},
      outputSchema: {}
    });
  });

  test('TEST 1: Execution across multiple domains using SAME service', () => {
    // Execution in DRONE domain
    CrossDomainExecutionTracker.recordExecution(
      EngineeringDomain.DRONE,
      EngineeringServiceType.CAD,
      'WF-DRONE-01',
      { geometry: 'Propeller' },
      { mass: 0.15 },
      'PASS'
    );

    // Execution in ROBOT domain
    CrossDomainExecutionTracker.recordExecution(
      EngineeringDomain.ROBOT,
      EngineeringServiceType.CAD,
      'WF-ROBOT-01',
      { geometry: 'ArmLink' },
      { mass: 2.5 },
      'PASS'
    );

    const reuse = CrossDomainExecutionTracker.getReuseAssertion(EngineeringServiceType.CAD);
    expect(reuse.reuseStatus).toBe(ReuseStatus.VERIFIED);
    expect(reuse.domainsTested).toContain(EngineeringDomain.DRONE);
    expect(reuse.domainsTested).toContain(EngineeringDomain.ROBOT);
    expect(reuse.implementationIds.length).toBe(1); // Crucial: Same fingerprint
  });

  test('TEST 2: FEA Reuse Matrix (Drone + Robot)', () => {
    CrossDomainExecutionTracker.recordExecution(
      EngineeringDomain.DRONE,
      EngineeringServiceType.FEA,
      'WF-FEA-01',
      { load: 100 },
      { stress: 50 },
      'PASS'
    );

    CrossDomainExecutionTracker.recordExecution(
      EngineeringDomain.ROBOT,
      EngineeringServiceType.FEA,
      'WF-FEA-02',
      { load: 500 },
      { stress: 250 },
      'PASS'
    );

    const reuse = CrossDomainExecutionTracker.getReuseAssertion(EngineeringServiceType.FEA);
    expect(reuse.reuseStatus).toBe(ReuseStatus.VERIFIED);
  });

  test('TEST 3: Domain Extensibility (New domain without core change)', () => {
    // Dynamically link a new domain to the universal CAD service
    CrossDomainRegistry.linkDomainToService(EngineeringDomain.TEST_DOMAIN, EngineeringServiceType.CAD);
    
    // Attempt execution in the new domain
    const exec = CrossDomainExecutionTracker.recordExecution(
      EngineeringDomain.TEST_DOMAIN,
      EngineeringServiceType.CAD,
      'WF-TEST-01',
      { data: 'extensibility' },
      { result: 'ok' },
      'PASS'
    );

    expect(exec.domainId).toBe(EngineeringDomain.TEST_DOMAIN);
    expect(exec.status).toBe('PASS');
  });

  test('NEGATIVE TEST 1: Detect Domain-Specific Duplication in IDs', () => {
    expect(() => {
      CrossDomainRegistry.registerService(EngineeringServiceType.CFD, {
        serviceId: 'DRONE-CFD-SOLVER', // Forbidden naming
        serviceName: 'Drone CFD',
        serviceVersion: 'v1',
        implementationFingerprint: 'FP-BAD',
        supportedDomains: [EngineeringDomain.DRONE],
        inputSchema: {},
        outputSchema: {}
      });
    }).toThrow('ARCHITECTURAL_DUPLICATION');
  });

  test('NEGATIVE TEST 2: Implementation Mismatch (Fake Reuse)', () => {
    // Registering another service with same ID but different fingerprint manually 
    // would be hard if we use a Map, but we check fingerprints in Tracker.
    
    // Let's simulate a case where a service claims to be universal but has different implementation IDs recorded
    // (This would happen if we updated the service implementation without proper versioning or if different nodes reported different FPs)
    
    // In our simplified tracker, we'd see multiple fingerprints in getReuseAssertion
    const reuse = CrossDomainExecutionTracker.getReuseAssertion(EngineeringServiceType.CAD);
    // If I were to manually add an execution with a different FP for the same serviceId...
    // (Mocking this internal state for the test)
    (CrossDomainExecutionTracker as any).executions.push({
      executionId: 'FAKE-01',
      serviceId: 'CORE-CAD-ENGINE',
      domainId: EngineeringDomain.VEHICLE,
      implementationFingerprint: 'FP-DIFFERENT-IMPL',
      status: 'PASS'
    });

    const brokenReuse = CrossDomainExecutionTracker.getReuseAssertion(EngineeringServiceType.CAD);
    expect(brokenReuse.implementationIds.length).toBeGreaterThan(1);
    expect(brokenReuse.reuseStatus).toBe(ReuseStatus.INCONCLUSIVE);
  });

  test('NEGATIVE TEST 3: Unsupported Service for Domain', () => {
    expect(() => {
      CrossDomainExecutionTracker.recordExecution(
        EngineeringDomain.PUMP,
        EngineeringServiceType.FEA, // FEA not registered for PUMP in beforeEach
        'WF-BAD',
        {},
        {},
        'PASS'
      );
    }).toThrow('not supported for domain PUMP');
  });

  test('TEST 4: Evidence Bus Cross-Domain Verification', () => {
    const domains = [EngineeringDomain.DRONE, EngineeringDomain.ROBOT, EngineeringDomain.VEHICLE, EngineeringDomain.PUMP];
    
    domains.forEach(d => {
      CrossDomainExecutionTracker.recordExecution(
        d,
        EngineeringServiceType.EVIDENCE,
        `WF-EV-${d}`,
        { evidence: 'test' },
        { hash: 'h1' },
        'PASS'
      );
    });

    const reuse = CrossDomainExecutionTracker.getReuseAssertion(EngineeringServiceType.EVIDENCE);
    expect(reuse.domainsTested.length).toBe(4);
    expect(reuse.reuseStatus).toBe(ReuseStatus.VERIFIED);
  });
});
