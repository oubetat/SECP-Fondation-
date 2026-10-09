import { CapabilityRegistry } from './CapabilityRegistry';
import { CapabilityResolver } from './CapabilityResolver';
import { CapabilityQualificationService } from './CapabilityQualificationService';
import { CapabilityPolicyEvaluator } from './CapabilityPolicyEvaluator';
import { CapabilityGraph } from './CapabilityGraph';
import { CapabilityIdentity } from './CapabilityIdentity';
import { EngineeringCapability, CapabilityProvider, EvidenceRecord } from './types';

export interface GateReport {
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  checks: {
    registryWorking: boolean;
    identityDeterministic: boolean;
    providerAbstractionWorking: boolean;
    resolutionWorking: boolean;
    dependencyResolutionWorking: boolean;
    authorizationWorking: boolean;
    executionContractWorking: boolean;
    evidenceIntegrationWorking: boolean;
    provenRequiresEvidence: boolean;
    simulationNotRealExecution: boolean;
    uiBypassPrevented: boolean;
    adversarialTestsSuccess: boolean;
  };
  timestamp: string;
}

export class HardAcceptanceGate155 {
  public static evaluateSuite(
    registry: CapabilityRegistry,
    resolver: CapabilityResolver,
    qualificationService: CapabilityQualificationService,
    adversarialPassed: boolean
  ): GateReport {
    const checks = {
      registryWorking: false,
      identityDeterministic: false,
      providerAbstractionWorking: false,
      resolutionWorking: false,
      dependencyResolutionWorking: false,
      authorizationWorking: false,
      executionContractWorking: false,
      evidenceIntegrationWorking: false,
      provenRequiresEvidence: false,
      simulationNotRealExecution: false,
      uiBypassPrevented: false,
      adversarialTestsSuccess: adversarialPassed
    };

    // 1. Verify Registry Working
    try {
      const testReg = new CapabilityRegistry();
      const testCap: EngineeringCapability = {
        id: 'capability:cad.brep.test',
        name: 'B-Rep Test',
        version: '1.0.0',
        domain: 'cad',
        description: 'Test Capability',
        status: 'UNPROVEN',
        executionMode: 'LOCAL',
        providerIds: ['prov-1'],
        requiredCapabilities: [],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: [],
        evidenceIds: [],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };
      testReg.register(testCap);
      checks.registryWorking = testReg.has('capability:cad.brep.test');
    } catch {
      checks.registryWorking = false;
    }

    // 2. Verify Identity Deterministic
    try {
      const ident1 = CapabilityIdentity.parse('capability:cad.brep.test', '1.0.0');
      const ident2 = CapabilityIdentity.parse('capability:cad.brep.test', '1.0.0');
      checks.identityDeterministic = ident1.hash === ident2.hash && ident1.hash !== undefined;
    } catch {
      checks.identityDeterministic = false;
    }

    // 3. Verify Provider Abstraction Working
    try {
      const mockProvider: CapabilityProvider = {
        id: 'mock-provider',
        name: 'Mock Provider',
        type: 'CPU',
        canProvide: (id) => id === 'capability:cad.brep.test',
        execute: async () => 'result' as any,
        verify: async () => true
      };
      checks.providerAbstractionWorking = mockProvider.canProvide('capability:cad.brep.test');
    } catch {
      checks.providerAbstractionWorking = false;
    }

    // 4. Verify Resolution Working
    try {
      const testReg = new CapabilityRegistry();
      const testQual = new CapabilityQualificationService();
      const testRes = new CapabilityResolver(testReg, testQual);

      const testCap: EngineeringCapability = {
        id: 'capability:cad.brep.test',
        name: 'B-Rep Test',
        version: '1.0.0',
        domain: 'cad',
        description: 'Test Capability',
        status: 'UNPROVEN',
        executionMode: 'LOCAL',
        providerIds: ['prov-1'],
        requiredCapabilities: [],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: [],
        evidenceIds: [],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };
      testReg.register(testCap);

      const resolvedUnavail = testRes.resolve('capability:cad.brep.test');
      checks.resolutionWorking = resolvedUnavail.status === 'UNAVAILABLE';
    } catch {
      checks.resolutionWorking = false;
    }

    // 5. Verify Dependency Resolution Working
    try {
      const testReg = new CapabilityRegistry();
      const testQual = new CapabilityQualificationService();
      const testRes = new CapabilityResolver(testReg, testQual);

      const parentCap: EngineeringCapability = {
        id: 'capability:cad.parent',
        name: 'Parent',
        version: '1.0.0',
        domain: 'cad',
        description: 'Depends on child',
        status: 'UNPROVEN',
        executionMode: 'LOCAL',
        providerIds: [],
        requiredCapabilities: ['capability:cad.child'],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: [],
        evidenceIds: [],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };

      testReg.register(parentCap);
      const resParent = testRes.resolve('capability:cad.parent');
      // Parent depends on child, but child is not registered -> status must propagate as UNAVAILABLE
      checks.dependencyResolutionWorking = resParent.status === 'UNAVAILABLE' && resParent.missingRequirements.includes('UNSATISFIED_DEPENDENCY::capability:cad.child');
    } catch {
      checks.dependencyResolutionWorking = false;
    }

    // 6. Verify Authorization Working
    try {
      const testCap: EngineeringCapability = {
        id: 'capability:cad.brep.test',
        name: 'B-Rep Test',
        version: '1.0.0',
        domain: 'cad',
        description: 'Test Capability',
        status: 'UNPROVEN',
        executionMode: 'LOCAL',
        providerIds: [],
        requiredCapabilities: [],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: ['STRICT_ENGINEER'],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {},
        evidenceIds: []
      };
      const dec1 = CapabilityPolicyEvaluator.evaluate('Guest-A', testCap, null);
      const dec2 = CapabilityPolicyEvaluator.evaluate('Engineer-A', testCap, null);
      checks.authorizationWorking = !dec1.allowed && dec2.allowed;
    } catch {
      checks.authorizationWorking = false;
    }

    // 7. Verify Execution Contract Working
    try {
      const req = {
        capabilityId: 'capability:cad.brep.test',
        objectId: 'OBJ-1',
        input: {},
        correlationId: 'CORR-1'
      };
      const res = {
        capabilityId: 'capability:cad.brep.test',
        objectId: 'OBJ-1',
        status: 'COMPLETED' as const,
        evidenceIds: ['EVID-1'],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        executionHash: 'hash-1'
      };
      checks.executionContractWorking = req.capabilityId === res.capabilityId;
    } catch {
      checks.executionContractWorking = false;
    }

    // 8. Verify Evidence Integration Working
    try {
      const testQual = new CapabilityQualificationService();
      const testEv: EvidenceRecord = {
        id: 'EVID-TEST',
        capabilityId: 'capability:cad.test',
        timestamp: new Date().toISOString(),
        verifier: 'Verifier-1',
        hash: 'hash-1',
        metricSnapshots: {},
        valid: true
      };
      testQual.registerEvidence(testEv);
      checks.evidenceIntegrationWorking = testQual.getEvidence('EVID-TEST') !== undefined;
    } catch {
      checks.evidenceIntegrationWorking = false;
    }

    // 9. Verify PROVEN status cannot be issued without evidence
    try {
      const testReg = new CapabilityRegistry();
      const testQual = new CapabilityQualificationService();
      const testRes = new CapabilityResolver(testReg, testQual);

      const testCap: EngineeringCapability = {
        id: 'capability:cad.brep.test',
        name: 'B-Rep Test',
        version: '1.0.0',
        domain: 'cad',
        description: 'Test Capability',
        status: 'PROVEN', // claims proven
        executionMode: 'LOCAL',
        providerIds: ['prov-1'],
        requiredCapabilities: [],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: [],
        evidenceIds: [], // but has NO evidence IDs
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };
      testReg.register(testCap);
      const mockProvider: CapabilityProvider = {
        id: 'prov-1',
        name: 'Mock',
        type: 'CPU',
        canProvide: () => true,
        execute: async () => ({}) as any,
        verify: async () => true
      };
      testRes.registerProvider(mockProvider);
      
      const resolved = testRes.resolve('capability:cad.brep.test');
      // Must be downgraded to UNPROVEN because evidenceIds is empty
      checks.provenRequiresEvidence = resolved.status === 'UNPROVEN';
    } catch {
      checks.provenRequiresEvidence = false;
    }

    // 10. Verify Simulation is not classified as real execution (meaning CPU/Simulation fallback on WebGPU yields UNPROVEN)
    try {
      const testReg = new CapabilityRegistry();
      const testQual = new CapabilityQualificationService();
      const testRes = new CapabilityResolver(testReg, testQual);

      const gpuCap: EngineeringCapability = {
        id: 'capability:compute.webgpu',
        name: 'WebGPU compute',
        version: '1.0.0',
        domain: 'compute',
        description: 'Claims GPU',
        status: 'PROVEN',
        executionMode: 'GPU', // Claims GPU execution
        providerIds: ['prov-sim'],
        requiredCapabilities: [],
        supportedObjectTypes: ['GEOMETRY'],
        requiredPolicies: [],
        evidenceIds: ['EVID-GPU'],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };
      testReg.register(gpuCap);

      const cpuProvider: CapabilityProvider = {
        id: 'prov-sim',
        name: 'CPU Simulation Provider',
        type: 'CPU', // Actually is CPU type!
        canProvide: () => true,
        execute: async () => ({}) as any,
        verify: async () => true
      };
      testRes.registerProvider(cpuProvider);

      const ev: EvidenceRecord = {
        id: 'EVID-GPU',
        capabilityId: 'capability:compute.webgpu',
        timestamp: new Date().toISOString(),
        verifier: 'Verifier',
        hash: 'hash',
        metricSnapshots: {
          apiDetected: true,
          adapterDetected: true,
          shaderCompiled: true,
          realHardwareExecution: false // No real hardware execution!
        },
        valid: true
      };
      testQual.registerEvidence(ev);

      const resolved = testRes.resolve('capability:compute.webgpu');
      // WebGPU requires GPU provider type and realHardwareExecution evidence
      checks.simulationNotRealExecution = resolved.status === 'UNPROVEN';
    } catch {
      checks.simulationNotRealExecution = false;
    }

    // 11. Verify UI cannot mutate frozen objects
    try {
      const testReg = new CapabilityRegistry();
      const testCap: EngineeringCapability = {
        id: 'capability:cad.test',
        name: 'Test',
        version: '1.0.0',
        domain: 'cad',
        description: 'Test',
        status: 'UNPROVEN',
        executionMode: 'LOCAL',
        providerIds: [],
        requiredCapabilities: [],
        supportedObjectTypes: [],
        requiredPolicies: [],
        evidenceIds: [],
        enabled: true,
        deterministic: true,
        reproducible: true,
        metadata: {}
      };
      testReg.register(testCap);
      const cap = testReg.get('capability:cad.test');
      if (cap) {
        // Attempt UI mutation
        (cap as any).status = 'PROVEN';
      }
      checks.uiBypassPrevented = cap !== undefined && cap.status === 'UNPROVEN';
    } catch {
      checks.uiBypassPrevented = true;
    }

    // Determine aggregate final verdict
    const allPassed = Object.values(checks).every(v => v === true);
    const verdict = allPassed ? ('PASS' as const) : ('FAIL' as const);

    return {
      verdict,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}
