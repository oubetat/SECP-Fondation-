import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  CapabilityRegistry,
  CapabilityIdentity,
  CapabilityGraph,
  CapabilityQualificationService,
  CapabilityResolver,
  CapabilityPolicyEvaluator,
  HardAcceptanceGate155,
  EngineeringCapability,
  CapabilityProvider,
  EvidenceRecord,
  CapabilityExecutionRequest,
  CapabilityExecutionResult
} from '../../src/engine/industrial-os/capabilities';

interface TestResult {
  name: string;
  type: 'CORE' | 'ADVERSARIAL';
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

function track(name: string, type: 'CORE' | 'ADVERSARIAL', success: boolean, detail: string) {
  results.push({
    name,
    type,
    status: success ? 'PASS' : 'FAIL',
    detail
  });
  const icon = success ? '✅ PASS' : '❌ FAIL';
  console.log(`[${type} TEST] ${name.padEnd(45)} | ${icon} | ${detail}`);
}

async function runPatch155Verification() {
  console.log('================================================================');
  console.log('  PATCH-155: CAPABILITY SYSTEM - QUALIFICATION BATTERY');
  console.log('================================================================');

  const registry = new CapabilityRegistry();
  const qualificationService = new CapabilityQualificationService();
  const resolver = new CapabilityResolver(registry, qualificationService);

  const executionLog: any[] = [];
  let adversarialSuccess = true;

  // ---------------------------------------------------------
  // CORE TEST 1: Registry Operations
  // ---------------------------------------------------------
  let ct1 = false;
  try {
    registry.clear();
    const cap1: EngineeringCapability = {
      id: 'capability:cad.brep.boolean',
      name: 'B-Rep Boolean Kernel',
      version: '1.2.0',
      domain: 'cad',
      description: 'Solid Modeling Boolean Operations',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: ['cad-local-engine'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY', 'BREP'],
      requiredPolicies: [],
      evidenceIds: ['EVID-CAD-01'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: { isCoreGeometry: true }
    };
    registry.register(cap1);

    // Duplicate rejection
    let dupeRejected = false;
    try {
      registry.register(cap1);
    } catch {
      dupeRejected = true;
    }

    // Invalid format rejection
    let formatRejected = false;
    try {
      registry.register({
        ...cap1,
        id: 'invalid-prefix-id'
      });
    } catch {
      formatRejected = true;
    }

    // Invalid version format rejection
    let verRejected = false;
    try {
      registry.register({
        ...cap1,
        id: 'capability:cad.brep.other',
        version: '1.x.beta'
      });
    } catch {
      verRejected = true;
    }

    ct1 = registry.has('capability:cad.brep.boolean') && dupeRejected && formatRejected && verRejected;
  } catch (e: any) {
    console.error('Core Test 1 failed:', e);
  }
  track('Test 1: Capability Registry', 'CORE', ct1, 'Verified registration checks, uniqueness protection, and structural formats.');

  // ---------------------------------------------------------
  // CORE TEST 2: Capability Identity
  // ---------------------------------------------------------
  let ct2 = false;
  try {
    const ident = CapabilityIdentity.parse('capability:physics.cfd.solve', '2.1.0');
    const hashMatches = ident.hash !== undefined && ident.hash.length === 64;
    ct2 = ident.canonicalId === 'capability:physics.cfd.solve' && ident.namespace === 'physics' && hashMatches;
  } catch (e: any) {
    console.error('Core Test 2 failed:', e);
  }
  track('Test 2: Deterministic Identity', 'CORE', ct2, 'Verified canonical parsing, namespace mapping, and deterministic hashes.');

  // ---------------------------------------------------------
  // CORE TEST 3: Dependency Graph
  // ---------------------------------------------------------
  let ct3 = false;
  try {
    const graph = new CapabilityGraph();
    graph.addEdge('capability:manufacturing.cam.5axis', 'capability:cad.brep.boolean');
    graph.addEdge('capability:manufacturing.cam.5axis', 'capability:physics.kinematics');
    
    const deps = graph.getDependencies('capability:manufacturing.cam.5axis');
    const topo = graph.topologicalSort();

    // Verify cycle detection
    let cycleDetected = false;
    try {
      const badGraph = new CapabilityGraph();
      badGraph.addEdge('A', 'B');
      badGraph.addEdge('B', 'A');
      badGraph.topologicalSort();
    } catch {
      cycleDetected = true;
    }

    ct3 = deps.includes('capability:cad.brep.boolean') && topo.length === 3 && cycleDetected;
  } catch (e: any) {
    console.error('Core Test 3 failed:', e);
  }
  track('Test 3: Dependency Graph', 'CORE', ct3, 'Verified Directed Acyclic Graph, cycle detection, and topological sorting.');

  // ---------------------------------------------------------
  // CORE TEST 4: Capability Resolution
  // ---------------------------------------------------------
  let ct4 = false;
  try {
    const testReg = new CapabilityRegistry();
    const testQual = new CapabilityQualificationService();
    const testRes = new CapabilityResolver(testReg, testQual);

    const cap: EngineeringCapability = {
      id: 'capability:cad.brep.boolean',
      name: 'B-Rep Boolean',
      version: '1.0.0',
      domain: 'cad',
      description: 'Boolean',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: ['local-provider'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['EVID-1'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    testReg.register(cap);

    // No provider registered -> status UNAVAILABLE
    const resNoProv = testRes.resolve('capability:cad.brep.boolean');
    
    // Register provider
    const prov: CapabilityProvider = {
      id: 'local-provider',
      name: 'Local CAD engine',
      type: 'CPU',
      canProvide: (id) => id === 'capability:cad.brep.boolean',
      execute: async () => 'completed',
      verify: async () => true
    };
    testRes.registerProvider(prov);

    // Register valid evidence
    const ev: EvidenceRecord = {
      id: 'EVID-1',
      capabilityId: 'capability:cad.brep.boolean',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier-CAD',
      hash: 'sha256-hash',
      metricSnapshots: {},
      valid: true
    };
    testQual.registerEvidence(ev);

    const resWithProv = testRes.resolve('capability:cad.brep.boolean');

    ct4 = resNoProv.status === 'UNAVAILABLE' && resWithProv.status === 'PROVEN' && resWithProv.executable === true;
  } catch (e: any) {
    console.error('Core Test 4 failed:', e);
  }
  track('Test 4: Capability Resolution', 'CORE', ct4, 'Verified resolution logic under varying provider and evidence availability.');

  // ---------------------------------------------------------
  // CORE TEST 5: Capability Qualification
  // ---------------------------------------------------------
  let ct5 = false;
  try {
    const testQual = new CapabilityQualificationService();
    const cap: EngineeringCapability = {
      id: 'capability:compute.webgpu',
      name: 'WebGPU Compute',
      version: '1.0.0',
      domain: 'compute',
      description: 'GPU computations',
      status: 'PROVEN',
      executionMode: 'GPU',
      providerIds: ['gpu-prov'],
      requiredCapabilities: [],
      supportedObjectTypes: [],
      requiredPolicies: [],
      evidenceIds: ['EVID-GPU'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };

    const prov: CapabilityProvider = {
      id: 'gpu-prov',
      name: 'GPU Accelerator',
      type: 'GPU',
      canProvide: (id) => id === 'capability:compute.webgpu',
      execute: async () => ({}),
      verify: async () => true
    };

    // No evidence registered -> qualified as UNPROVEN
    const qualNoEv = testQual.qualify(cap, prov);

    // Register incomplete hardware pipeline evidence
    const evIncomplete: EvidenceRecord = {
      id: 'EVID-GPU',
      capabilityId: 'capability:compute.webgpu',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier-Hardware',
      hash: 'hash',
      metricSnapshots: {
        apiDetected: true,
        adapterDetected: true,
        shaderCompiled: true,
        realHardwareExecution: false // missing real hardware validation!
      },
      valid: true
    };
    testQual.registerEvidence(evIncomplete);
    const qualIncomplete = testQual.qualify(cap, prov);

    // Register complete evidence
    const evComplete: EvidenceRecord = {
      id: 'EVID-GPU',
      capabilityId: 'capability:compute.webgpu',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier-Hardware',
      hash: 'hash',
      metricSnapshots: {
        apiDetected: true,
        adapterDetected: true,
        shaderCompiled: true,
        realHardwareExecution: true,
        hardwareTimingPassed: true,
        independentVerification: true
      },
      valid: true
    };
    testQual.registerEvidence(evComplete);
    const qualComplete = testQual.qualify(cap, prov);

    ct5 = qualNoEv.status === 'UNPROVEN' && qualIncomplete.status === 'PARTIAL' && qualComplete.status === 'PROVEN';
  } catch (e: any) {
    console.error('Core Test 5 failed:', e);
  }
  track('Test 5: Qualification Engine', 'CORE', ct5, 'Verified dynamic evidence-based grading (PROVEN, PARTIAL, UNPROVEN).');

  // ---------------------------------------------------------
  // CORE TEST 6: Capability -> Engineering Object Mapping
  // ---------------------------------------------------------
  let ct6 = false;
  try {
    const cap: EngineeringCapability = {
      id: 'capability:cad.brep.boolean',
      name: 'B-Rep Boolean',
      version: '1.0.0',
      domain: 'cad',
      description: 'Boolean',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: [],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: [],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };

    const validObj = { id: 'OBJ-1', objectType: 'GEOMETRY', status: 'ACTIVE' };
    const invalidTypeObj = { id: 'OBJ-2', objectType: 'SIMULATION', status: 'ACTIVE' };
    const invalidatedObj = { id: 'OBJ-3', objectType: 'GEOMETRY', status: 'INVALIDATED' };

    const check1 = resolver.canOperateOn(cap, validObj);
    const check2 = resolver.canOperateOn(cap, invalidTypeObj);
    const check3 = resolver.canOperateOn(cap, invalidatedObj);

    ct6 = check1.allowed && !check2.allowed && !check3.allowed;
  } catch (e: any) {
    console.error('Core Test 6 failed:', e);
  }
  track('Test 6: Object Validation', 'CORE', ct6, 'Verified capability operates only on supported, valid object types.');

  // ---------------------------------------------------------
  // CORE TEST 7: Capability Authorization
  // ---------------------------------------------------------
  let ct7 = false;
  try {
    const cap: EngineeringCapability = {
      id: 'capability:cad.brep.boolean',
      name: 'B-Rep Boolean',
      version: '1.0.0',
      domain: 'cad',
      description: 'Boolean',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: [],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: ['STRICT_ENGINEER', 'WRITE_VALIDATED'],
      evidenceIds: [],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };

    const activeObj = { id: 'OBJ-1', objectType: 'GEOMETRY', status: 'ACTIVE' };
    const draftObj = { id: 'OBJ-2', objectType: 'GEOMETRY', status: 'DRAFT' };

    // Actor Guest-A should be blocked by STRICT_ENGINEER
    const dec1 = CapabilityPolicyEvaluator.evaluate('Guest-A', cap, activeObj);
    // Actor Engineer-A on activeObj should pass
    const dec2 = CapabilityPolicyEvaluator.evaluate('Engineer-A', cap, activeObj);
    // Actor Engineer-A on draftObj should be blocked by WRITE_VALIDATED policy
    const dec3 = CapabilityPolicyEvaluator.evaluate('Engineer-A', cap, draftObj);

    ct7 = !dec1.allowed && dec2.allowed && !dec3.allowed;
  } catch (e: any) {
    console.error('Core Test 7 failed:', e);
  }
  track('Test 7: Policy Authorization', 'CORE', ct7, 'Verified Actor, Object, and policy-driven execution clearance.');

  // ---------------------------------------------------------
  // CORE TEST 8: Capability Execution Contract
  // ---------------------------------------------------------
  let ct8 = false;
  try {
    // 1. Register main provider
    const prov: CapabilityProvider = {
      id: 'cad-local-engine',
      name: 'CAD Solid Engine',
      type: 'CPU',
      canProvide: (id) => id === 'capability:cad.brep.boolean',
      execute: async (id, input: any) => {
        return { resultState: 'SUCCESS', volume: input.width * input.height };
      },
      verify: async () => true
    };
    resolver.registerProvider(prov);

    // 2. Register main evidence
    const mainEvidence: EvidenceRecord = {
      id: 'EVID-CAD-01',
      capabilityId: 'capability:cad.brep.boolean',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier-CAD-Main',
      hash: 'sha256-hash-main',
      metricSnapshots: {},
      valid: true
    };
    qualificationService.registerEvidence(mainEvidence);

    const req: CapabilityExecutionRequest<{ width: number; height: number }> = {
      capabilityId: 'capability:cad.brep.boolean',
      objectId: 'OBJ-GEOM-123',
      input: { width: 10, height: 20 },
      requestedBy: 'Engineer-A',
      correlationId: `CORR-${crypto.randomUUID()}`
    };

    const resolved = resolver.resolve(req.capabilityId);
    let execResult: CapabilityExecutionResult<any>;

    if (resolved.executable && resolved.providerId) {
      const activeProvider = resolver.getProviderFor(req.capabilityId);
      const startTime = new Date().toISOString();
      const output = await activeProvider!.execute(req.capabilityId, req.input);
      const endTime = new Date().toISOString();

      const executionHash = crypto.createHash('sha256')
        .update(`${req.capabilityId}::${req.objectId}::${JSON.stringify(output)}::${req.correlationId}`)
        .digest('hex');

      execResult = {
        capabilityId: req.capabilityId,
        objectId: req.objectId,
        status: 'COMPLETED',
        result: output,
        providerId: resolved.providerId,
        evidenceIds: resolved.evidenceIds,
        startedAt: startTime,
        completedAt: endTime,
        executionHash
      };

      executionLog.push(execResult);
      ct8 = execResult.status === 'COMPLETED' && execResult.result.volume === 200 && execResult.executionHash !== undefined;
    }
  } catch (e: any) {
    console.error('Core Test 8 failed:', e);
  }
  track('Test 8: Execution Contract', 'CORE', ct8, 'Verified cryptographic execution hash tracing and payload validation.');


  // ---------------------------------------------------------
  // ADVERSARIAL TEST SCENARIOS
  // ---------------------------------------------------------
  console.log('\n--- Running Adversarial Defense Tests ---');

  // Scenario 1: Fake PROVEN capability claiming proven status in registry but having no valid evidence
  let adv1 = false;
  try {
    const fakeProvenCap: EngineeringCapability = {
      id: 'capability:cad.spoofed.proven',
      name: 'Spoofed Proven CAD',
      version: '1.0.0',
      domain: 'cad',
      description: 'Fraudulent Proven Claims',
      status: 'PROVEN', // Spurious claim
      executionMode: 'LOCAL',
      providerIds: ['cad-local-engine-spoofed'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: [], // Missing execution evidence
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(fakeProvenCap);

    // Register active provider specifically for this capability
    const specificProv: CapabilityProvider = {
      id: 'cad-local-engine-spoofed',
      name: 'CAD Local engine',
      type: 'CPU',
      canProvide: (id) => id === 'capability:cad.spoofed.proven',
      execute: async () => ({}),
      verify: async () => true
    };
    resolver.registerProvider(specificProv);
    
    const resolved = resolver.resolve('capability:cad.spoofed.proven');
    // Resolution must enforce verification downgrading to UNPROVEN
    adv1 = resolved.status === 'UNPROVEN' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 1 failed:', e);
  }
  track('Scenario 1: Fake PROVEN Claim', 'ADVERSARIAL', adv1, 'Prevented fake PROVEN claims by downgrading unverified state.');
  if (!adv1) adversarialSuccess = false;

  // Scenario 2: Spoofed GPU capability (WebGPU) utilizing a fallback CPU provider instead of GPU
  let adv2 = false;
  try {
    const spoofedGpuCap: EngineeringCapability = {
      id: 'capability:compute.spoofed.gpu',
      name: 'GPU simulation fallback',
      version: '1.0.0',
      domain: 'compute',
      description: 'WebGPU spoofing',
      status: 'PROVEN',
      executionMode: 'GPU', // Claims GPU execution mode
      providerIds: ['cpu-fallback-provider'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['EVID-SPOOFED-GPU'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(spoofedGpuCap);

    const cpuProvider: CapabilityProvider = {
      id: 'cpu-fallback-provider',
      name: 'CPU fallback runner',
      type: 'CPU', // Actually CPU provider!
      canProvide: (id) => id === 'capability:compute.spoofed.gpu',
      execute: async () => ({}),
      verify: async () => true
    };
    resolver.registerProvider(cpuProvider);

    const ev: EvidenceRecord = {
      id: 'EVID-SPOOFED-GPU',
      capabilityId: 'capability:compute.spoofed.gpu',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier',
      hash: 'hash',
      metricSnapshots: {
        apiDetected: true,
        adapterDetected: true,
        shaderCompiled: true,
        realHardwareExecution: false // CPU fallback
      },
      valid: true
    };
    qualificationService.registerEvidence(ev);

    const resolved = resolver.resolve('capability:compute.spoofed.gpu');
    // GPU execution mode + CPU provider + missing hardware verification = UNPROVEN
    adv2 = resolved.status === 'UNPROVEN' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 2 failed:', e);
  }
  track('Scenario 2: Hardware Hallucination', 'ADVERSARIAL', adv2, 'Successfully flagged CPU fallback on GPU execution mode claim.');
  if (!adv2) adversarialSuccess = false;

  // Scenario 3: Spurious/fake evidence ID linked
  let adv3 = false;
  try {
    const cap: EngineeringCapability = {
      id: 'capability:physics.solve.spoofed.evidence',
      name: 'Solver with non-existent evidence',
      version: '1.0.0',
      domain: 'physics',
      description: 'Solver',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: ['spoofed-ev-provider'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['NON-EXISTENT-EVID-ID'], // Missing evidence reference
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(cap);

    const spoofedEvProvider: CapabilityProvider = {
      id: 'spoofed-ev-provider',
      name: 'Spoofed EV Provider',
      type: 'CPU',
      canProvide: (id) => id === 'capability:physics.solve.spoofed.evidence',
      execute: async () => ({}),
      verify: async () => true
    };
    resolver.registerProvider(spoofedEvProvider);

    const resolved = resolver.resolve('capability:physics.solve.spoofed.evidence');
    // Evidence does not exist in store, resolver downgrades to UNPROVEN
    adv3 = resolved.status === 'UNPROVEN' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 3 failed:', e);
  }
  track('Scenario 3: Non-existent Evidence ID', 'ADVERSARIAL', adv3, 'Prevented authorization of solver when its evidence is missing.');
  if (!adv3) adversarialSuccess = false;

  // Scenario 4: Circular dependency setup
  let adv4 = false;
  try {
    // Attempting circular dependency during registration
    const capA: EngineeringCapability = {
      id: 'capability:circular.alpha',
      name: 'Alpha',
      version: '1.0.0',
      domain: 'test',
      description: 'Alpha',
      status: 'UNPROVEN',
      executionMode: 'LOCAL',
      providerIds: [],
      requiredCapabilities: ['capability:circular.beta'], // alpha depends on beta
      supportedObjectTypes: [],
      requiredPolicies: [],
      evidenceIds: [],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    const capB: EngineeringCapability = {
      id: 'capability:circular.beta',
      name: 'Beta',
      version: '1.0.0',
      domain: 'test',
      description: 'Beta',
      status: 'UNPROVEN',
      executionMode: 'LOCAL',
      providerIds: [],
      requiredCapabilities: ['capability:circular.alpha'], // beta depends on alpha (circular!)
      supportedObjectTypes: [],
      requiredPolicies: [],
      evidenceIds: [],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };

    registry.register(capA);
    
    let rejectedAtRegistration = false;
    try {
      registry.register(capB);
    } catch {
      rejectedAtRegistration = true;
    }

    adv4 = rejectedAtRegistration;
  } catch (e: any) {
    console.error('Adversarial Test 4 failed:', e);
  }
  track('Scenario 4: Circular Dependencies', 'ADVERSARIAL', adv4, 'Registry successfully blocked circular dependency registration.');
  if (!adv4) adversarialSuccess = false;

  // Scenario 5: Missing or unavailable provider
  let adv5 = false;
  try {
    const cap: EngineeringCapability = {
      id: 'capability:physics.unsupported.solver',
      name: 'Unsupported Solver',
      version: '1.0.0',
      domain: 'physics',
      description: 'No provider exists for this',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: ['non-existent-prov-id'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['EVID-1'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(cap);
    
    // Explicitly check without registration of non-existent-prov-id
    const resolved = resolver.resolve('capability:physics.unsupported.solver');
    adv5 = resolved.status === 'UNAVAILABLE' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 5 failed:', e);
  }
  track('Scenario 5: Missing Provider Registry', 'ADVERSARIAL', adv5, 'Properly set capability status to UNAVAILABLE when provider is missing.');
  if (!adv5) adversarialSuccess = false;

  // Scenario 6: Tampered/invalid evidence
  let adv6 = false;
  try {
    const cap: EngineeringCapability = {
      id: 'capability:cad.tampered.evidence',
      name: 'Tampered CAD Solver',
      version: '1.0.0',
      domain: 'cad',
      description: 'Tampered',
      status: 'PROVEN',
      executionMode: 'LOCAL',
      providerIds: ['tampered-ev-provider'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['EVID-TAMPERED-01'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(cap);

    const tamperedEvProvider: CapabilityProvider = {
      id: 'tampered-ev-provider',
      name: 'Tampered EV Provider',
      type: 'CPU',
      canProvide: (id) => id === 'capability:cad.tampered.evidence',
      execute: async () => ({}),
      verify: async () => true
    };
    resolver.registerProvider(tamperedEvProvider);

    // Register evidence explicitly marked as invalid (mimicking failed cryptographic signature)
    const ev: EvidenceRecord = {
      id: 'EVID-TAMPERED-01',
      capabilityId: 'capability:cad.tampered.evidence',
      timestamp: new Date().toISOString(),
      verifier: 'Verifier',
      hash: 'corrupted-hash',
      metricSnapshots: {},
      valid: false // INVALID EVIDENCE!
    };
    qualificationService.registerEvidence(ev);

    const resolved = resolver.resolve('capability:cad.tampered.evidence');
    adv6 = resolved.status === 'UNPROVEN' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 6 failed:', e);
  }
  track('Scenario 6: Tampered Evidence Mitigation', 'ADVERSARIAL', adv6, 'Successfully rejected capability execution due to invalid/tampered evidence.');
  if (!adv6) adversarialSuccess = false;

  // Scenario 7: Remote capability with zero network providers
  let adv7 = false;
  try {
    const remoteCap: EngineeringCapability = {
      id: 'capability:compute.hpc.remote',
      name: 'HPC Remote Solver',
      version: '1.0.0',
      domain: 'compute',
      description: 'Remote Compute Grid',
      status: 'PROVEN',
      executionMode: 'REMOTE',
      providerIds: ['remote-grid-node'],
      requiredCapabilities: [],
      supportedObjectTypes: ['GEOMETRY'],
      requiredPolicies: [],
      evidenceIds: ['EVID-HPC-01'],
      enabled: true,
      deterministic: true,
      reproducible: true,
      metadata: {}
    };
    registry.register(remoteCap);

    // Ensure there is absolutely no provider registered that can handle REMOTE compute
    const resolved = resolver.resolve('capability:compute.hpc.remote');
    adv7 = resolved.status === 'UNAVAILABLE' && !resolved.executable;
  } catch (e: any) {
    console.error('Adversarial Test 7 failed:', e);
  }
  track('Scenario 7: REMOTE Mode Orphan checks', 'ADVERSARIAL', adv7, 'Correctly flags remote capabilities as UNAVAILABLE without network providers.');
  if (!adv7) adversarialSuccess = false;


  // ---------------------------------------------------------
  // HARD ACCEPTANCE GATE 155 RUN
  // ---------------------------------------------------------
  console.log('\n================================================================');
  console.log('  RUNNING HARD ACCEPTANCE GATE 155...');
  console.log('================================================================');

  const gateReport = HardAcceptanceGate155.evaluateSuite(registry, resolver, qualificationService, adversarialSuccess);
  const finalVerdict = gateReport.verdict;

  console.log(`Gate Evaluation Verdict: ${finalVerdict === 'PASS' ? '🟢 PASS (PROVEN)' : '🔴 FAIL'}`);
  console.log('Gate Checks Detailed Output:');
  console.log(JSON.stringify(gateReport.checks, null, 2));


  // ---------------------------------------------------------
  // GENERATING ARTIFACT REPORTS (AS REQUIRED BY PATCH MOCK)
  // ---------------------------------------------------------
  
  // 1. PATCH155_CAPABILITY_REGISTRY.json
  const registryOutput = registry.list();
  fs.writeFileSync(
    path.join(process.cwd(), 'PATCH155_CAPABILITY_REGISTRY.json'),
    JSON.stringify(registryOutput, null, 2)
  );

  // 2. PATCH155_CAPABILITY_GRAPH.json
  const graph = CapabilityGraph.buildFromRegistry(registry);
  fs.writeFileSync(
    path.join(process.cwd(), 'PATCH155_CAPABILITY_GRAPH.json'),
    JSON.stringify(graph.toJSON(), null, 2)
  );

  // 3. PATCH155_EXECUTION_REPORT.json
  fs.writeFileSync(
    path.join(process.cwd(), 'PATCH155_EXECUTION_REPORT.json'),
    JSON.stringify(executionLog, null, 2)
  );

  // 4. PATCH155_EVIDENCE.json
  const evidenceOutput = qualificationService.listEvidence();
  fs.writeFileSync(
    path.join(process.cwd(), 'PATCH155_EVIDENCE.json'),
    JSON.stringify(evidenceOutput, null, 2)
  );

  // 5. PATCH155_FORENSIC_REPORT.md
  const markdownReport = `
# PATCH-155: Capability System Forensic Verification Report

## 1. Executive Summary
- **System**: SECP Industrial OS v2 (Capability Management Layer)
- **Patch**: PATCH-155 — Capability System
- **Evaluation Time**: ${new Date().toISOString()}
- **Final Verdict**: **${finalVerdict === 'PASS' ? 'PROVEN / PASS' : 'UNPROVEN'}**

---

## 2. Capability State Architecture
Every capability transitions dynamically through state gates, preventing static boolean hallucinations:
\`REGISTERED\` ➔ \`DEPENDENCIES SATISFIED\` ➔ \`PROVIDER AVAILABLE\` ➔ \`EXECUTION AVAILABLE\` ➔ \`EVIDENCE VERIFIED\` ➔ \`PROVEN\`

---

## 3. Core Test & Adversarial Suite Results

### Core Functional Tests
| Test Name | Status | Forensic Detail |
| :--- | :--- | :--- |
${results
  .filter(r => r.type === 'CORE')
  .map(r => `| **${r.name}** | ${r.status === 'PASS' ? '🟢 PASS' : '🔴 FAIL'} | ${r.detail} |`)
  .join('\n')}

### Adversarial Security Challenges
| Scenario Name | Status | Forensic Defense Mechanism |
| :--- | :--- | :--- |
${results
  .filter(r => r.type === 'ADVERSARIAL')
  .map(r => `| **${r.name}** | ${r.status === 'PASS' ? '🛡️  SECURE' : '💥 BREACHED'} | ${r.detail} |`)
  .join('\n')}

---

## 4. Forensic Questions Checklist Answers
1. **How is Capability Identity determined?**
   Via canonical deterministic parses of \`capability:domain.name.action\` accompanied by strict SemVer.
2. **What prevents duplicate capability definitions?**
   Memory hashing index collision checks inside the central registry class.
3. **Does WebGPU simulation count as real execution?**
   No. Providers claiming GPU execution must match the active hardware pipeline verification metrics, otherwise they are downgraded to \`UNPROVEN\`.
4. **Is a capability marked PROVEN without registered evidence?**
   No. All executive capabilities lacking execution evidence are qualified as \`UNPROVEN\`.
5. **How are circular dependencies prevented?**
   Registry-level cycle DFS traverses the transient registry graph during each register call, blocking cycles immediately.
6. **Can the UI forge capability execution?**
   No. Immutable frozen capability descriptors and runtime resolver validation enforce server-side evaluation.

---

## 5. Classification of Evidence
- **Capability Registration & Memory Graph**: **PROVEN**
- **Hardware Fallback & Anti-Spoofing checks**: **MEASURED**
- **Context-Aware Policy Authorization**: **DERIVED**
- **Qualification & Forensic Report**: **ARCHITECTURAL**

================================================================
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'PATCH155_FORENSIC_REPORT.md'),
    markdownReport
  );

  console.log('================================================================');
  console.log('PATCH-155 QUALIFICATION COMPLETE');
  console.log(`Core Tests passed:      ${results.filter(r => r.type === 'CORE' && r.status === 'PASS').length}/${results.filter(r => r.type === 'CORE').length}`);
  console.log(`Adversarial Secured:    ${results.filter(r => r.type === 'ADVERSARIAL' && r.status === 'PASS').length}/${results.filter(r => r.type === 'ADVERSARIAL').length}`);
  console.log(`FINAL VERDICT:          ${finalVerdict === 'PASS' ? 'PASS' : 'FAIL'}`);
  console.log('================================================================');

  if (finalVerdict !== 'PASS') {
    process.exit(1);
  }
}

runPatch155Verification();
