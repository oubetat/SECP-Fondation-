import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import {
  Hazard,
  SafetyControl,
  SafetyClaim,
  SafetyCase,
  SafetyGovernanceState,
  HazardSeverity,
  HazardLikelihood
} from '../../../src/engine/adse/p12/types';
import { PhysicalFinding } from '../../../src/engine/adse/p10/types';
import { FailureMode, FailureGovernanceState } from '../../../src/engine/adse/p11/types';

describe('ADSE P12 — Safety Engineering Truth Benchmark Suite', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  // =========================================================================
  // BENCHMARK 1: P12-BENCH-001 — Complete Production Truth Path (P10 -> P11 -> P12)
  // =========================================================================
  it('P12-BENCH-001: Verifies complete production truth path from P10 Physical Finding -> P11 Failure Mode -> P12 Hazard -> Safety Control -> Safety Claim -> Safety Case -> Verification -> Merkle Snapshot -> Evidence Invalidation Cascade', async () => {
    const configBaseline = 'CONF-SAFETY-BASELINE';
    const revId = 'REV-R1';
    const sensorId = 'S-OXYGEN-01';
    const compId = 'COMP-FLIGHT-DECK-O2';
    const measId = 'MEAS-O2-LOW-01';
    const findingId = 'PF-O2-DROP-01';
    const fmId = 'FM-O2-LEAK-01';
    const hazardId = 'HAZ-HYPOXIA-01';
    const controlId = 'CTRL-AUTO-O2-MASK-01';
    const claimId = 'CLAIM-HYPOXIA-MITIGATED-01';
    const caseId = 'CASE-FLIGHT-SAFETY-01';

    console.log('--- P12-BENCH-001 START ---');

    // 1. Setup Digital Thread Component & Sensor Nodes in P4
    bridge.p4.registry.registerNode({
      nodeId: `thread:component:${compId}`,
      nodeType: 'ArchitectureElement',
      canonicalId: compId,
      authoritySource: 'P3_ARCHITECTURE_ENGINE',
      displayName: 'Flight Deck Crew Oxygen System',
      configurationId: configBaseline,
      revisionId: revId
    });

    bridge.p4.registry.registerNode({
      nodeId: `thread:sensor:${sensorId}`,
      nodeType: 'ArchitectureElement',
      canonicalId: sensorId,
      authoritySource: 'P10_SENSOR_REGISTRY',
      displayName: 'Oxygen Partial Pressure Transducer',
      configurationId: configBaseline,
      revisionId: revId
    });

    // 2. P10 Sensor Acquisition -> Physical Finding
    bridge.p10.registry.registerSensor({
      sensorId,
      type: 'PRESSURE_TRANSDUCER',
      manufacturer: 'AeroOxygen Systems',
      model: 'AO2-P100',
      revision: 1,
      configurationId: configBaseline,
      physicalLocation: 'COCKPIT_STATION_1',
      measurementDomain: 'CONTROL',
      measurementRange: { min: 0, max: 100 },
      resolution: 0.1,
      accuracy: 0.5,
      samplingRateHz: 10,
      latencyMs: 1,
      calibrationState: 'VALID',
      uncertaintyModel: { type: 'GAUSSIAN', value: 0.2 },
      interfaceType: 'CAN_BUS_01',
      provenance: {
        originHash: createHash('sha256').update(sensorId).digest('hex'),
        createdBy: 'CHIEF_SYSTEMS_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    bridge.p10.registry.registerCalibrationCertificate({
      id: 'CAL-AO2-2026',
      sensorId,
      calibratedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2027-01-01T00:00:00Z',
      technicianId: 'TECH-LEAD-O2',
      calibrationRevision: 1,
      offset: 0,
      gain: 1.0,
      accuracyClass: 'CLASS_A',
      authoritySignature: 'SIG_CHIEF_CAL'
    });

    bridge.p10.measurement.acquireCalibratedMeasurement({
      measurementId: measId,
      sensorId,
      rawValue: 12.0, // Low pressure reading (psi)
      unit: 'psi',
      timestamp: new Date().toISOString(),
      acquisitionContext: 'FLIGHT-CRUISE',
      configurationId: configBaseline
    });

    const physicalFinding: PhysicalFinding = {
      findingId,
      sensorId,
      measurementId: measId,
      engineeringFindingText: 'Rapid pressure drop detected in crew oxygen supply line',
      affectedAssumptionId: 'ASM-O2-PRESSURE-NOMINAL',
      associatedModelId: 'MODEL-O2-FLOW',
      severity: 'CRITICAL',
      timestamp: new Date().toISOString(),
      status: 'OPEN'
    };
    bridge.p10.registry.registerPhysicalFinding(physicalFinding);

    // 3. P11 Failure Analysis derived from P10 Finding
    const failureMode: FailureMode = {
      failureModeId: fmId,
      systemId: 'SYS-O2-01',
      elementId: compId,
      revisionId: revId,
      configurationId: configBaseline,
      description: 'Cockpit primary oxygen line valve seal failure',
      failureType: 'PNEUMATIC_LEAK',
      failureMechanism: 'Seal degradation',
      localEffect: 'Cabin oxygen supply pressure loss',
      systemEffect: 'Cockpit crew hypoxia risk during high altitude flight',
      detectionMethod: 'Low pressure transducer alert',
      mitigationStrategy: 'Emergency mask deployment & emergency descent',
      severity: 9,
      occurrence: 2,
      detectability: 2,
      criticality: 18,
      status: FailureGovernanceState.ANALYZED,
      provenance: {
        originHash: createHash('sha256').update(fmId).digest('hex'),
        createdBy: 'CHIEF_RELIABILITY_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      evidenceRefs: [measId],
      causes: [],
      physicalFindingId: findingId
    };
    bridge.p11.registerFailureModeAndTrace(failureMode);

    // 4. P12 Hazard Analysis derived formally from P11 Failure Mode
    const hazard = bridge.p12.createHazardFromP11FailureMode(
      fmId,
      {
        hazardId,
        initiatingConditions: ['High altitude cruise (> 25,000 ft)', 'Oxygen supply line leak'],
        hazardousCondition: 'Cockpit oxygen partial pressure drops below physiological safety bounds',
        consequences: ['Flight crew hypoxia', 'Loss of aircraft control'],
        severity: 'CATASTROPHIC',
        likelihood: 'OCCASIONAL'
      },
      'CHIEF_SAFETY_ENGINEER',
      'human:chief:safety:01'
    );

    expect(hazard.riskLevel).toBe('UNACCEPTABLE');
    expect(hazard.failureModeRef).toBe(fmId);

    // Verify Digital Thread trace
    const hazardNode = bridge.p4.registry.getNode(`thread:safety-hazard:${hazardId}`);
    expect(hazardNode).toBeDefined();

    // 5. Register Safety Control & Safety Claim
    const control: SafetyControl = {
      controlId,
      hazardId,
      controlType: 'PREVENTIVE',
      description: 'Automatic cabin depressurization quick-donning emergency oxygen mask deployment',
      targetRequirementId: 'REQ-SAFETY-O2-AUTO-01',
      efficiency: 0.95,
      status: SafetyGovernanceState.VERIFIED,
      revisionId: revId,
      configurationId: configBaseline,
      evidenceRefs: [measId]
    };
    bridge.p12.registerSafetyControlAndTrace(control);

    const claim: SafetyClaim = {
      claimId,
      argumentId: 'ARG-SAFETY-O2-01',
      claimText: 'Automatic emergency oxygen mask deployment prevents crew hypoxia under rapid line leakage',
      targetHazardId: hazardId,
      targetControlId: controlId,
      revisionId: revId,
      configurationId: configBaseline,
      status: SafetyGovernanceState.PROPOSED,
      evidenceRefs: [measId]
    };
    bridge.p12.registerSafetyClaimAndTrace(claim);

    // 6. Transition Safety Claim state to VERIFIED under Human Chief Safety Engineer Authority
    bridge.p12.governance.transitionClaimState(
      claimId,
      SafetyGovernanceState.VERIFIED,
      'CHIEF_SAFETY_ENGINEER',
      'human:chief:safety:01'
    );
    expect(bridge.p12.registry.getSafetyClaim(claimId)?.status).toBe(SafetyGovernanceState.VERIFIED);

    // 7. Register Structured Safety Case
    const sCase: SafetyCase = {
      caseId,
      title: 'High-Altitude Crew Oxygen Safety Case',
      systemId: 'SYS-O2-01',
      revisionId: revId,
      configurationId: configBaseline,
      topGoal: {
        nodeId: 'GOAL-O2-01',
        nodeType: 'GOAL',
        description: 'Cockpit crew is protected against high-altitude hypoxia in all flight envelopes',
        childNodeIds: ['STRAT-O2-01']
      },
      nodes: [
        {
          nodeId: 'STRAT-O2-01',
          nodeType: 'STRATEGY',
          description: 'Argument based on automatic emergency oxygen control barrier efficiency',
          childNodeIds: ['CLAIM-NODE-01']
        },
        {
          nodeId: 'CLAIM-NODE-01',
          nodeType: 'CLAIM',
          description: claim.claimText,
          childNodeIds: [],
          claimId
        }
      ],
      claims: [claim],
      assumptions: ['ASM-MASK-DESCENT-CAPABLE'],
      evidenceRefs: [measId],
      status: SafetyGovernanceState.VERIFIED,
      provenance: {
        originHash: createHash('sha256').update(caseId).digest('hex'),
        createdBy: 'CHIEF_SAFETY_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p12.registerSafetyCaseAndTrace(sCase);

    // 8. Persist State into Cryptographically Sealed Merkle Snapshot
    const snapshot = bridge.p12.persistence.createSnapshot('SECP_SAFETY_AUTHORITY');
    expect(snapshot.merkleRootHash).toBeDefined();

    // 9. Destroy Runtime State & Rehydrate
    ADSEWorkbenchBridge.resetInstance();
    const restartedBridge = ADSEWorkbenchBridge.getInstance();
    expect(restartedBridge.p12.registry.getHazard(hazardId)).toBeUndefined();

    const restoreRes = restartedBridge.p12.persistence.restoreFromSnapshot(snapshot);
    expect(restoreRes.isValid).toBe(true);

    const restoredClaim = restartedBridge.p12.registry.getSafetyClaim(claimId);
    expect(restoredClaim).toBeDefined();
    expect(restoredClaim?.status).toBe(SafetyGovernanceState.VERIFIED);

    // 10. Evidence Invalidation Cascade Execution
    // Invalidate measurement `measId` and verify downstream impact
    const invalidationImpact = restartedBridge.p12.governance.handleEvidenceInvalidation(measId);
    expect(invalidationImpact.impactedControlsCount).toBe(1);
    expect(invalidationImpact.impactedClaimsCount).toBe(1);
    expect(invalidationImpact.impactedCasesCount).toBe(1);

    expect(restartedBridge.p12.registry.getSafetyControl(controlId)?.status).toBe(
      SafetyGovernanceState.REASSESSMENT_REQUIRED
    );
    expect(restartedBridge.p12.registry.getSafetyClaim(claimId)?.status).toBe(
      SafetyGovernanceState.REASSESSMENT_REQUIRED
    );
    expect(restartedBridge.p12.registry.getSafetyCase(caseId)?.status).toBe(
      SafetyGovernanceState.REASSESSMENT_REQUIRED
    );

    console.log('--- P12-BENCH-001 COMPLETE ---');
  });

  // =========================================================================
  // BENCHMARK 2: P12-BENCH-002 — Negative & Adversarial Governance Battery
  // =========================================================================
  it('P12-BENCH-002: Rejects AI authorization sign-offs, duplicate entity registration, invalid control efficiency, and tampered Merkle snapshots', async () => {
    const configBaseline = 'CONF-SAFETY-BASELINE';
    const revId = 'REV-R1';
    const hazardId = 'HAZ-ADV-01';

    // Register baseline hazard & control
    bridge.p4.registry.registerNode({
      nodeId: 'thread:component:COMP-ADV-01',
      nodeType: 'ArchitectureElement',
      canonicalId: 'COMP-ADV-01',
      authoritySource: 'P3_ARCHITECTURE_ENGINE',
      displayName: 'Adversarial Test Component',
      configurationId: configBaseline,
      revisionId: revId
    });

    // 1. AI Safety Sign-off Rejection
    const dummyHazard: Hazard = {
      hazardId,
      initiatingConditions: ['Condition A'],
      hazardousCondition: 'Thermal Runaway Risk',
      consequences: ['Cell explosion'],
      severity: 'CRITICAL',
      likelihood: 'REMOTE',
      riskLevel: 'HIGH',
      status: SafetyGovernanceState.PROPOSED,
      provenance: {
        originHash: 'hash-001',
        createdBy: 'ENGINEER-01',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisionId: revId,
      configurationId: configBaseline
    };
    bridge.p12.registry.registerHazard(dummyHazard);

    const dummyControl: SafetyControl = {
      controlId: 'CTRL-ADV-01',
      hazardId,
      controlType: 'PREVENTIVE',
      description: 'Active Liquid Cooling Loop',
      targetRequirementId: 'REQ-ADV-01',
      efficiency: 0.9,
      status: SafetyGovernanceState.PROPOSED,
      revisionId: revId,
      configurationId: configBaseline,
      evidenceRefs: ['EVID-01']
    };
    bridge.p12.registerSafetyControlAndTrace(dummyControl);

    const dummyClaim: SafetyClaim = {
      claimId: 'CLAIM-ADV-01',
      argumentId: 'ARG-ADV-01',
      claimText: 'Cooling prevents thermal runaway',
      targetHazardId: hazardId,
      targetControlId: 'CTRL-ADV-01',
      status: SafetyGovernanceState.PROPOSED,
      revisionId: revId,
      configurationId: configBaseline,
      evidenceRefs: ['EVID-01']
    };
    bridge.p12.registerSafetyClaimAndTrace(dummyClaim);

    // AI Attempting to verify safety claim -> MUST throw AI_SAFETY_AUTHORIZATION_PROHIBITED
    expect(() => {
      bridge.p12.governance.transitionClaimState(
        'CLAIM-ADV-01',
        SafetyGovernanceState.VERIFIED,
        'AI_SYSTEM_DIAGNOSTIC_AGENT',
        'ai:agent:001'
      );
    }).toThrow(/AI_SAFETY_AUTHORIZATION_PROHIBITED/);

    // 2. Duplicate Hazard ID Rejection
    expect(() => {
      bridge.p12.registry.registerHazard(dummyHazard);
    }).toThrow(/DUPLICATE_HAZARD_ID/);

    // 3. Invalid Control Efficiency Bounds Rejection
    expect(() => {
      bridge.p12.registry.registerSafetyControl({
        ...dummyControl,
        controlId: 'CTRL-INVALID-EFF',
        efficiency: 1.5 // Out of bounds (> 1.0)
      });
    }).toThrow(/INVALID_CONTROL_EFFICIENCY/);

    // 4. Snapshot Merkle Tampering Rejection
    const validSnapshot = bridge.p12.persistence.createSnapshot('SAFETY_AUTHORITY');
    const tamperedSnapshot = JSON.parse(JSON.stringify(validSnapshot));
    tamperedSnapshot.hazards[0].hazardousCondition = 'TAMPERED: Fake non-hazardous description';

    expect(() => {
      bridge.p12.persistence.restoreFromSnapshot(tamperedSnapshot);
    }).toThrow(/SAFETY_SNAPSHOT_TAMPER_DETECTED/);

    console.log('--- P12-BENCH-002 COMPLETE ---');
  });
});
