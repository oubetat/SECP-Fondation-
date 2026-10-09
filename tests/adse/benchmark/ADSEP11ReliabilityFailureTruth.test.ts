import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import { FailureMode, FailureGovernanceState, FaultTree, ReliabilityModel, FTAEvent, FTAGate } from '../../../src/engine/adse/p11/types';

describe('ADSE P11 — Reliability, Failure Analysis & Engineering Risk Truth Suite', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  // =========================================================================
  // BENCHMARK 1: P11-BENCH-001 — Core Reliability & Failure Mode Truth Lifecycle
  // =========================================================================
  it('P11-BENCH-001: Verifies the complete failure mode lifecycle, FTA probability propagation, MTBF availability, Merkle snapshot reconstruction, and evidence invalidation cascades', async () => {
    const configBaseline = 'CONF-BASELINE';
    const fmId = 'FM-PROPULSION-001';
    const compId = 'ACTUATOR-E2E-001';

    console.log('--- P11-BENCH-001 START ---');

    // 1. Setup Digital Thread Component Context (Required for P11 Tracing)
    bridge.p4.registry.registerNode({
      nodeId: `thread:component:${compId}`,
      nodeType: 'ArchitectureElement',
      canonicalId: compId,
      authoritySource: 'P3_ARCHITECTURE_ENGINE',
      displayName: 'Main Propulsion Actuator',
      configurationId: configBaseline,
      revisionId: 'REV-R1'
    });

    // 2. Register a Failure Mode (FMEA style) linked to a canonical component
    const fm: FailureMode = {
      failureModeId: fmId,
      systemId: 'SYS-PROPULSION-01',
      elementId: compId,
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      description: 'Actuator high pressure seal blowout',
      failureType: 'PNEUMATIC_LOSS',
      failureMechanism: 'O-ring extrusion under thermal cyclic load',
      localEffect: 'Piston chamber leakage',
      systemEffect: 'Loss of aerodynamic control surface deflection control',
      detectionMethod: 'Differential pressure sensor pressure anomaly',
      mitigationStrategy: 'Dual parallel redundant sealing rings',
      severity: 8,      // Critical severity
      occurrence: 3,    // Low-medium occurrence
      detectability: 2, // High detectability
      criticality: 0,   // Authoritatively calculated as Severity * Occurrence
      status: FailureGovernanceState.DRAFT,
      provenance: {
        originHash: createHash('sha256').update(fmId).digest('hex'),
        createdBy: 'CHIEF_RELIABILITY_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      evidenceRefs: [],
      causes: [
        {
          causeId: 'C-001',
          type: 'THERMAL_STRESS',
          sourceEntity: 'THERMAL-REGION-E2E-001',
          physicalMechanism: 'Thermal expansion coefficient mismatch',
          assumptionRefs: ['ASM-TEMP-MAX-120'],
          requirementRefs: ['RQ-E2E-10'],
          evidenceRefs: ['MEAS-WING-001'],
          confidence: 0.95
        }
      ]
    };

    // Register & check digital thread linkage
    bridge.p11.registerFailureModeAndTrace(fm);

    const registeredFM = bridge.p11.registry.getFailureMode(fmId);
    expect(registeredFM).toBeDefined();
    expect(registeredFM?.criticality).toBe(24); // 8 * 3 = 24
    expect(registeredFM?.status).toBe(FailureGovernanceState.DRAFT);

    const threadNode = bridge.p4.registry.getNode(`thread:failure-mode:${fmId}`);
    expect(threadNode).toBeDefined();
    expect(threadNode?.canonicalId).toBe(fmId);

    // 2. Transition Failure Mode status to VERIFIED under Human Role Authorization
    // Attempt VERIFIED without evidence: should fail
    expect(() => {
      bridge.p11.governance.transitionState(
        fmId,
        FailureGovernanceState.VERIFIED,
        'CHIEF_RELIABILITY_ENGINEER',
        'human:engineer:01'
      );
    }).toThrow(/MISSING_EVIDENCE/);

    // Add empirical measurement evidence reference (e.g., from physical calibration or telemetry)
    registeredFM.evidenceRefs.push('MEAS-WING-001');

    // Transition under human Chief Reliability Engineer: should succeed
    bridge.p11.governance.transitionState(
      fmId,
      FailureGovernanceState.VERIFIED,
      'CHIEF_RELIABILITY_ENGINEER',
      'human:engineer:01'
    );
    expect(registeredFM.status).toBe(FailureGovernanceState.VERIFIED);

    // 3. Register a logical Fault Tree (FTA) and execute logical probability propagation
    const basicEvent1: FTAEvent = {
      eventId: 'EV-SEAL-FAIL',
      description: 'Physical seal wear extrusion',
      probability: 0.02,
      isBasicEvent: true,
      failureModeId: fmId
    };

    const basicEvent2: FTAEvent = {
      eventId: 'EV-SOLENOID-FAIL',
      description: 'Control solenoid electrical open-circuit',
      probability: 0.005,
      isBasicEvent: true
    };

    const intermediateEvent: FTAEvent = {
      eventId: 'EV-ACTUATOR-VALVE-LOSS',
      description: 'Loss of pneumatic actuator valve flow',
      probability: 0, // Computed
      isBasicEvent: false
    };

    const rootEvent: FTAEvent = {
      eventId: 'EV-TOP-ACTUATOR-SYSTEM-FAIL',
      description: 'Total failure of Propulsion-001 subsystem',
      probability: 0, // Computed
      isBasicEvent: false
    };

    // Gates connecting:
    // Gate 1 (OR): EV-ACTUATOR-VALVE-LOSS = EV-SEAL-FAIL OR EV-SOLENOID-FAIL
    // Gate 2 (AND): EV-TOP-ACTUATOR-SYSTEM-FAIL = EV-ACTUATOR-VALVE-LOSS AND EV-SEAL-FAIL (example combination)
    const gate1: FTAGate = {
      gateId: 'G-OR-01',
      type: 'OR',
      inputEventIds: ['EV-SEAL-FAIL', 'EV-SOLENOID-FAIL'],
      outputEventId: 'EV-ACTUATOR-VALVE-LOSS'
    };

    const gate2: FTAGate = {
      gateId: 'G-AND-01',
      type: 'AND',
      inputEventIds: ['EV-ACTUATOR-VALVE-LOSS', 'EV-SEAL-FAIL'],
      outputEventId: 'EV-TOP-ACTUATOR-SYSTEM-FAIL'
    };

    const ft: FaultTree = {
      treeId: 'FT-ACTUATOR-001',
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      topEvent: rootEvent,
      gates: [gate1, gate2],
      events: [basicEvent1, basicEvent2, intermediateEvent],
      dependencies: [],
      assumptions: [],
      evidenceRefs: []
    };

    bridge.p11.registerFaultTreeAndTrace(ft);

    // Evaluate probabilities
    // P(Gate1 OR) = 1 - (1 - 0.02) * (1 - 0.005) = 1 - 0.98 * 0.995 = 1 - 0.9751 = 0.0249
    // P(Gate2 AND) = P(Gate1) * P(EV-SEAL-FAIL) = 0.0249 * 0.02 = 0.000498
    const topProb = bridge.p11.causality.evaluateFaultTree(ft);
    expect(topProb).toBeCloseTo(0.000498, 6);
    expect(ft.topEvent.probability).toBeCloseTo(0.000498, 6);

    // 4. Register a Reliability Model and check availability calculations
    // MTBF = 10,000 Hours, MTTR = 5 Hours.
    // Availability = 10000 / (10000 + 5) = 0.999500249
    const expectedAvail = 10000 / (10000 + 5);
    const rm: ReliabilityModel = {
      modelId: 'RM-PROPULSION-01',
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      MTBFHours: 10000,
      MTTRHours: 5,
      availability: expectedAvail,
      blocks: [
        {
          blockId: 'B-01',
          name: 'Primary Valve Actuator Unit',
          type: 'SERIES',
          failureRate: 1e-4,
          childrenIds: []
        }
      ],
      assumptions: ['ASM-TEMP-MAX-120'],
      evidenceRefs: ['MEAS-WING-001'],
      datasetRefs: []
    };

    bridge.p11.registerReliabilityModelAndTrace(rm);
    expect(bridge.p11.registry.getReliabilityModel('RM-PROPULSION-01')).toBeDefined();

    // 5. Persist the complete Reliability/Risk DB into a cryptographically sealed Merkle Snapshot
    const snapshot = bridge.p11.persistence.createSnapshot('SECP_RELIABILITY_AUTHORITY');
    expect(snapshot.merkleRootHash).toBeDefined();

    // 6. Wipe Runtime State (simulate complete workbench restart)
    ADSEWorkbenchBridge.resetInstance();
    const restartedBridge = ADSEWorkbenchBridge.getInstance();
    expect(restartedBridge.p11.registry.getFailureMode(fmId)).toBeUndefined();

    // 7. Rehydrate and Verify Bit-Exact reconstruction
    const restoreRes = restartedBridge.p11.persistence.restoreFromSnapshot(snapshot);
    expect(restoreRes.isValid).toBe(true);

    const rehydratedFM = restartedBridge.p11.registry.getFailureMode(fmId);
    expect(rehydratedFM).toBeDefined();
    expect(rehydratedFM?.status).toBe(FailureGovernanceState.VERIFIED);
    expect(rehydratedFM?.criticality).toBe(24);

    const rehydratedFT = restartedBridge.p11.registry.getFaultTree('FT-ACTUATOR-001');
    expect(rehydratedFT).toBeDefined();
    expect(rehydratedFT?.topEvent.probability).toBeCloseTo(0.000498, 6);

    // 8. Invalidation Cascades: Mark source measurement or evidence as invalidated,
    // and verify that verified failure mode reverts to REASSESSMENT_REQUIRED status.
    const cascaded = restartedBridge.p11.governance.handleEvidenceInvalidation('MEAS-WING-001');
    expect(cascaded).toBe(1); // 1 failure mode updated
    expect(rehydratedFM?.status).toBe(FailureGovernanceState.REASSESSMENT_REQUIRED);

    console.log('--- P11-BENCH-001 COMPLETE ---');
  });

  // =========================================================================
  // BENCHMARK 2: ADVERSARIAL RELIABILITY AND GOVERNANCE TRUTH BATTERY
  // =========================================================================
  it('P11 Adversarial Reliability Truth Battery: Verifies strict human authority requirements, circular loop rejections, and invalid boundary constraints', async () => {
    const configBaseline = 'CONF-BASELINE';
    const fmId = 'FM-ADVERSARIAL-01';
    const compId = 'COMP-ADVERSARIAL';

    bridge.p4.registry.registerNode({
      nodeId: `thread:component:${compId}`,
      nodeType: 'ArchitectureElement',
      canonicalId: compId,
      authoritySource: 'P3_ARCHITECTURE_ENGINE',
      displayName: 'Adversarial Component',
      configurationId: configBaseline,
      revisionId: 'REV-R1'
    });

    const fm: FailureMode = {
      failureModeId: fmId,
      systemId: 'SYS-ADVERSARIAL',
      elementId: compId,
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      description: 'Adversarial failure risk test',
      failureType: 'STRUCTURAL',
      failureMechanism: 'Fatigue',
      localEffect: 'Minor crack',
      systemEffect: 'Reduced structural capacity',
      detectionMethod: 'Visual',
      mitigationStrategy: 'None',
      severity: 9,      // High Severity Risk (>=8)
      occurrence: 2,
      detectability: 3,
      criticality: 0,
      status: FailureGovernanceState.DRAFT,
      provenance: {
        originHash: 'initial-adv-hash',
        createdBy: 'CHIEF_RELIABILITY_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      evidenceRefs: ['MEAS-ADVERSARIAL-REF'],
      causes: []
    };

    bridge.p11.registry.registerFailureMode(fm);

    // --- REJECTION 1: AI Autonomous Verification (INV-09 equivalent for P11) ---
    expect(() => {
      bridge.p11.governance.transitionState(
        fmId,
        FailureGovernanceState.VERIFIED,
        'ai:copilot', // AI Actor Role
        'ai:synthetic:agent' // AI Actor ID
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    expect(bridge.p11.registry.getFailureMode(fmId)?.status).toBe(FailureGovernanceState.DRAFT);

    // --- REJECTION 2: AI Autonomous Risk Parameters Downgrade of High Severity ---
    expect(() => {
      bridge.p11.governance.updateRiskParameters(
        fmId,
        { severity: 4 }, // Attempting to downgrade high severity (9 -> 4)
        'ai:copilot',
        'ai:synthetic:agent'
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    expect(bridge.p11.registry.getFailureMode(fmId)?.severity).toBe(9); // Unchanged

    // --- REJECTION 3: Invalid RPN bounds ---
    expect(() => {
      bridge.p11.registry.registerFailureMode({
        ...fm,
        failureModeId: 'FM-INVALID-SEV',
        severity: 11 // Invalid severity (>10)
      });
    }).toThrow(/INVALID_RPN_BOUNDS/);

    expect(() => {
      bridge.p11.registry.registerFailureMode({
        ...fm,
        failureModeId: 'FM-INVALID-OCC',
        occurrence: -1 // Invalid occurrence (<1)
      });
    }).toThrow(/INVALID_RPN_BOUNDS/);

    // --- REJECTION 4: Circular dependencies in Fault Trees (circular logic) ---
    // Gate 1: EV-A depends on EV-B
    // Gate 2: EV-B depends on EV-A (Cycle!)
    const circularGate1: FTAGate = {
      gateId: 'G-OR-C1',
      type: 'OR',
      inputEventIds: ['EV-B'],
      outputEventId: 'EV-A'
    };

    const circularGate2: FTAGate = {
      gateId: 'G-OR-C2',
      type: 'OR',
      inputEventIds: ['EV-A'],
      outputEventId: 'EV-B'
    };

    const evA: FTAEvent = { eventId: 'EV-A', description: 'Event A', probability: 0, isBasicEvent: false };
    const evB: FTAEvent = { eventId: 'EV-B', description: 'Event B', probability: 0, isBasicEvent: false };

    const circularFT: FaultTree = {
      treeId: 'FT-CIRCULAR-01',
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      topEvent: evA,
      gates: [circularGate1, circularGate2],
      events: [evA, evB],
      dependencies: [],
      assumptions: [],
      evidenceRefs: []
    };

    expect(() => {
      bridge.p11.registry.registerFaultTree(circularFT);
    }).toThrow(/CIRCULAR_DEPENDENCY_DETECTED/);

    // --- REJECTION 5: Invalid Availability Calculation in Reliability Model ---
    const invalidRM: ReliabilityModel = {
      modelId: 'RM-INVALID-AVAIL',
      revisionId: 'REV-R1',
      configurationId: configBaseline,
      MTBFHours: 1000,
      MTTRHours: 10,
      availability: 0.5, // 1000 / 1010 = 0.9901, but they claim 0.5 (forged/invalid)
      blocks: [],
      assumptions: [],
      evidenceRefs: [],
      datasetRefs: []
    };

    expect(() => {
      bridge.p11.registry.registerReliabilityModel(invalidRM);
    }).toThrow(/INVALID_AVAILABILITY_CALCULATION/);
  });
});
