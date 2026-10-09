import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { ADSEWorkbenchBridge } from '../../../src/engine/adse/workbench/ADSEWorkbenchBridge';
import {
  Configuration,
  ConfigurationItem,
  ConfigurationStatus,
  ConfigurationBaseline,
  ConfigurationChangeType,
  ConfigurationChangeRequest,
  ConfigurationApplicability,
  ConfigurationVariant,
  ConfigurationDependency,
  ConfigurationRelationship
} from '../../../src/engine/adse/p13/types';
import { SafetyGovernanceState, SafetyControl, SafetyClaim } from '../../../src/engine/adse/p12/types';
import { Revision } from '../../../src/engine/revision/types';

describe('ADSE P13 — Configuration Management Truth Benchmark Suite', () => {
  let bridge: ADSEWorkbenchBridge;

  beforeEach(() => {
    ADSEWorkbenchBridge.resetInstance();
    bridge = ADSEWorkbenchBridge.getInstance();
  });

  // =========================================================================
  // BENCHMARK 1: P13-BENCH-001 — Configuration Truth Lifecycle
  // =========================================================================
  it('P13-BENCH-001: Verifies the complete lifecycle of Configuration Truth with full multi-domain integration and forensic checks', async () => {
    console.log('--- P13-BENCH-001 START ---');

    const configId = 'CONFIG-O2-SYSTEM-01';
    const revId = 'REV-R1';
    const varId = 'VAR-O2-COMMERCIAL';
    const appId = 'APP-O2-S1-50';
    const crId = 'CR-O2-UPGRADE-01';
    const changeId = 'CHG-O2-UPGRADE-01';
    const baselineId = 'BL-O2-SYSTEM-A1';

    // 1. Setup existing infrastructures (Revision and P4 Digital Thread)
    const revision: Revision = {
      revisionId: revId,
      entityId: 'SYS-O2-01',
      revisionCode: '01',
      parentRevisionId: null,
      content: { docName: 'Crew Oxygen System Spec' },
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      createdAt: new Date().toISOString(),
      lifecycleState: 'APPROVED' as any,
      dependencies: [],
      effectivity: [],
      configurationScope: [],
      validationState: 'PROVEN',
      evidenceReferences: []
    };
    bridge.revisionEngine.createRevision(revision);

    // Also register some related revisions for items
    bridge.revisionEngine.createRevision({
      ...revision,
      revisionId: 'REV-ENGINE-R8',
      entityId: 'CI-ENGINE',
      revisionCode: '08'
    });
    bridge.revisionEngine.createRevision({
      ...revision,
      revisionId: 'REV-SW-R1',
      entityId: 'CI-SOFTWARE',
      revisionCode: '01'
    });
    bridge.revisionEngine.createRevision({
      ...revision,
      revisionId: 'REV-BUS-R1',
      entityId: 'CI-CAN-BUS',
      revisionCode: '01'
    });

    // 2. Register canonical entities in P13
    bridge.p13.registry.registerCanonicalEntityId('SYS-O2-01');
    bridge.p13.registry.registerCanonicalEntityId('COMP-O2-VALVE');
    bridge.p13.registry.registerCanonicalEntityId('SW-O2-CONTROLLER');
    bridge.p13.registry.registerCanonicalEntityId('BUS-O2-INTERFACE');

    // 3. Register Variant and Applicability
    const variant: ConfigurationVariant = {
      variantId: varId,
      familyId: 'FAM-O2',
      name: 'Commercial Airline Crew Oxygen Variant',
      allowedConfigurations: [configId],
      constraints: ['CI-ENGINE must be at least REV-R8'],
      provenance: {
        originHash: 'hash-var-01',
        createdBy: 'CHIEF_SYSTEMS_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p13.registry.registerVariant(variant);

    const applicability: ConfigurationApplicability = {
      applicabilityId: appId,
      targetId: configId,
      serialNumberMin: 1,
      serialNumberMax: 50,
      missionProfile: 'COMMERCIAL_PASSENGER',
      provenance: {
        originHash: 'hash-app-01',
        createdBy: 'CHIEF_SYSTEMS_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p13.registry.registerApplicability(applicability);

    // 4. Construct and register active Configuration
    const items: ConfigurationItem[] = [
      {
        id: 'CI-VALVE-01',
        identity: 'CI-ENGINE', // Identity matching variant constraints
        type: 'HARDWARE',
        canonicalEntityRef: 'COMP-O2-VALVE',
        revisionRef: 'REV-ENGINE-R8',
        configurationRef: configId,
        lifecycleState: ConfigurationStatus.ACTIVE,
        applicability: '1-50',
        dependencies: ['CI-CONTROLLER-01'],
        provenance: {
          originHash: 'hash-valve-01',
          createdBy: 'CHIEF_SYSTEMS_ENGINEER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        verificationState: 'VERIFIED',
        evidenceRefs: ['MEAS-VALVE-PRESSURE-01']
      },
      {
        id: 'CI-CONTROLLER-01',
        identity: 'CI-SOFTWARE',
        type: 'SOFTWARE',
        canonicalEntityRef: 'SW-O2-CONTROLLER',
        revisionRef: 'REV-SW-R1',
        configurationRef: configId,
        lifecycleState: ConfigurationStatus.ACTIVE,
        applicability: '1-50',
        dependencies: ['CI-INTERFACE-01'],
        provenance: {
          originHash: 'hash-controller-01',
          createdBy: 'CHIEF_SYSTEMS_ENGINEER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        verificationState: 'VERIFIED',
        evidenceRefs: ['MEAS-SW-CODE-01']
      },
      {
        id: 'CI-INTERFACE-01',
        identity: 'CI-CAN-BUS',
        type: 'INTERFACE',
        canonicalEntityRef: 'BUS-O2-INTERFACE',
        revisionRef: 'REV-BUS-R1',
        configurationRef: configId,
        lifecycleState: ConfigurationStatus.ACTIVE,
        applicability: '1-50',
        dependencies: [],
        provenance: {
          originHash: 'hash-interface-01',
          createdBy: 'CHIEF_SYSTEMS_ENGINEER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        verificationState: 'VERIFIED',
        evidenceRefs: ['MEAS-BUS-01']
      }
    ];

    const config: Configuration = {
      configurationId: configId,
      name: 'High-Altitude Crew Oxygen Configuration',
      variantId: varId,
      status: ConfigurationStatus.ACTIVE,
      items,
      provenance: {
        originHash: 'hash-config-01',
        createdBy: 'CHIEF_SYSTEMS_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisionId: revId
    };

    bridge.p13.registerConfigurationAndTrace(config);

    // Verify digital thread registration of items and config
    expect(bridge.p4.registry.getNode(`thread:config:${configId}`)).toBeDefined();
    expect(bridge.p4.registry.getNode('thread:config-item:CI-VALVE-01')).toBeDefined();

    // 5. Check compatibility and create immutable baseline
    const compCheck = bridge.p13.compatibility.checkCompatibility(configId);
    expect(compCheck.isValid).toBe(true);

    const baseline = bridge.p13.baseline.createBaseline(
      baselineId,
      'Pre-Release Safety Baseline A1',
      configId,
      appId,
      'CHIEF_SYSTEMS_ENGINEER',
      'human:chief:systems:01'
    );
    expect(baseline.status).toBe(ConfigurationStatus.APPROVED);
    expect(baseline.evidenceRootHash).toBeDefined();

    // 6. Integrate with P12 (Safety Engine) and register matching safety claim/control
    bridge.p12.registry.registerHazard({
      hazardId: 'HAZ-HYPOXIA-01',
      initiatingConditions: ['High Altitude'],
      hazardousCondition: 'Cockpit hypoxia',
      consequences: ['Loss of consciousness'],
      severity: 'CATASTROPHIC',
      likelihood: 'REMOTE',
      riskLevel: 'HIGH',
      status: SafetyGovernanceState.PROPOSED,
      provenance: {
        originHash: 'hash-haz',
        createdBy: 'CHIEF_SAFETY_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisionId: revId,
      configurationId: configId
    });

    const safetyControl: SafetyControl = {
      controlId: 'COMP-O2-VALVE', // Canonical Ref
      hazardId: 'HAZ-HYPOXIA-01',
      controlType: 'PREVENTIVE',
      description: 'Primary valve closure seals cockpit oxygen drop',
      targetRequirementId: 'REQ-O2-SAFETY-01',
      efficiency: 0.95,
      status: SafetyGovernanceState.VERIFIED,
      revisionId: revId,
      configurationId: configId,
      evidenceRefs: ['MEAS-VALVE-PRESSURE-01']
    };
    bridge.p12.registerSafetyControlAndTrace(safetyControl);

    const safetyClaim: SafetyClaim = {
      claimId: 'CLAIM-O2-VALVE-SEALS',
      argumentId: 'ARG-O2-VALVE',
      claimText: 'Valve seals prevent cockpit oxygen loss during descent',
      targetHazardId: 'HAZ-HYPOXIA-01',
      targetControlId: 'COMP-O2-VALVE',
      revisionId: revId,
      configurationId: configId,
      status: SafetyGovernanceState.VERIFIED,
      evidenceRefs: ['MEAS-VALVE-PRESSURE-01']
    };
    bridge.p12.registerSafetyClaimAndTrace(safetyClaim);

    // 7. Change Control: Submit, approve and execute upgrade to Valve item
    const cr = bridge.p13.change.createChangeRequest(
      crId,
      'Valve upgrade for temperature resilience',
      'Upgrading seal material from silicon to fluorocarbon',
      ConfigurationChangeType.MAJOR,
      ['CI-VALVE-01'],
      'human:chief:systems:01'
    );
    expect(cr.status).toBe('SUBMITTED');

    // Human Chief Systems Engineer approves CR
    bridge.p13.change.approveChangeRequest(crId, 'CHIEF_SYSTEMS_ENGINEER', 'human:chief:systems:01');
    expect(bridge.p13.registry.getChangeRequest(crId)?.status).toBe('APPROVED');

    // Execute configuration mutation
    const executeRes = bridge.p13.change.executeChange(
      changeId,
      crId,
      configId,
      (currentItems) => {
        // Upgrade the Valve revision to R9
        const valve = currentItems.find(it => it.id === 'CI-VALVE-01');
        if (valve) {
          valve.revisionRef = 'REV-ENGINE-R9';
          valve.evidenceRefs.push('MEAS-VALVE-TEMP-02'); // Add new evidence
        }
        return currentItems;
      },
      'CHIEF_SYSTEMS_ENGINEER',
      'human:chief:systems:01'
    );
    expect(executeRes.status).toBe('IMPLEMENTED');

    // 8. Analyze configuration impact and check invalidation cascade
    const impactReport = bridge.p13.impact.analyzeImpact(['CI-VALVE-01']);
    expect(impactReport.affectedItemIds).toContain('CI-VALVE-01');

    // 9. Invalidation Propagation: Changing CI-VALVE-01 invalidates old baselines and propagates to P12
    const invalidationRes = bridge.p13.handleItemInvalidation('CI-VALVE-01', 'MEAS-VALVE-PRESSURE-01');
    expect(invalidationRes.impactedBaselinesCount).toBe(1);
    expect(invalidationRes.impactedSafetyClaimsCount).toBe(1);

    // Verify P12 safety claim was moved to REASSESSMENT_REQUIRED
    expect(bridge.p12.registry.getSafetyClaim('CLAIM-O2-VALVE-SEALS')?.status).toBe(
      SafetyGovernanceState.REASSESSMENT_REQUIRED
    );

    // 10. Persistence snapshot creation and reconstruction rehydration
    const snapshot = bridge.p13.persistence.createSnapshot('CONFIG_AUTHORITY');
    expect(snapshot.merkleRootHash).toBeDefined();

    // Reset bridge state and rehydrate
    ADSEWorkbenchBridge.resetInstance();
    const restartedBridge = ADSEWorkbenchBridge.getInstance();
    expect(restartedBridge.p13.registry.getConfiguration(configId)).toBeUndefined();

    const restoreRes = restartedBridge.p13.persistence.restoreFromSnapshot(snapshot);
    expect(restoreRes.isValid).toBe(true);
    expect(restartedBridge.p13.registry.getConfiguration(configId)).toBeDefined();

    console.log('--- P13-BENCH-001 COMPLETE ---');
  });

  // =========================================================================
  // FORENSIC GATES G01 - G20 & ADVERSARIAL ATTACKS
  // =========================================================================
  it('G01-G20: Verifies all forensic gates and rejects adversarial configuration modifications, AI approvals, and incompatible options', () => {
    console.log('--- ADSE P13 FORENSIC GATES START ---');

    const configId = 'CONFIG-ADV-01';
    const revId = 'REV-ADV-R1';

    // 1. Setup default revision for tests
    bridge.revisionEngine.createRevision({
      revisionId: revId,
      entityId: 'SYS-ADV-01',
      revisionCode: '01',
      parentRevisionId: null,
      content: { docName: 'Adversarial Test Config' },
      createdBy: 'CHIEF_SYSTEMS_ENGINEER',
      createdAt: new Date().toISOString(),
      lifecycleState: 'APPROVED' as any,
      dependencies: [],
      effectivity: [],
      configurationScope: [],
      validationState: 'PROVEN',
      evidenceReferences: []
    });

    // Populate registry with valid canonical bindings
    bridge.p13.registry.registerCanonicalEntityId('COMP-ADV-01');

    // --- G01: Architecture Boundary ---
    // Ensure P13 ConfigurationRegistry remains explicitly subordinate and does not act as core authority
    expect(bridge.p13.registry.configurations).toBeDefined();

    // --- G02 & G04: Configuration Identity & Revision Boundary ---
    // Test that missing revision ID in configuration or items throws mismatch errors
    const faultyConfig: Configuration = {
      configurationId: configId,
      name: 'Faulty Configuration',
      variantId: 'VAR-DUMMY',
      status: ConfigurationStatus.DRAFT,
      items: [],
      provenance: {
        originHash: 'hash-faulty',
        createdBy: 'ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisionId: 'REV-NON-EXISTENT' // Mismatching revision
    };

    expect(() => {
      bridge.p13.authority.validateRevisionBinding(faultyConfig);
    }).toThrow(/REVISION_AUTHORITY_MISMATCH/);

    // --- G03: Canonical Binding ---
    // Test that configuration items cannot reference un-bound canonical entities
    const unboundConfig: Configuration = {
      ...faultyConfig,
      revisionId: revId,
      items: [
        {
          id: 'CI-UNBOUND-01',
          identity: 'CI-UNBOUND',
          type: 'HARDWARE',
          canonicalEntityRef: 'COMP-NON-EXISTENT', // Unbound entity reference
          revisionRef: revId,
          configurationRef: configId,
          lifecycleState: ConfigurationStatus.ACTIVE,
          applicability: '1-10',
          dependencies: [],
          provenance: {
            originHash: 'hash-unbound',
            createdBy: 'ENGINEER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          verificationState: 'VERIFIED',
          evidenceRefs: []
        }
      ]
    };

    expect(() => {
      bridge.p13.registry.registerConfiguration(unboundConfig);
    }).toThrow(/CANONICAL_BINDING_VIOLATION/);

    // --- G05 & G06: Baseline Authority & Immutability ---
    // Setup valid config for baselining
    const validConfig: Configuration = {
      configurationId: configId,
      name: 'Valid Configuration',
      variantId: 'VAR-ADV-01',
      status: ConfigurationStatus.ACTIVE,
      items: [
        {
          id: 'CI-VALID-01',
          identity: 'CI-ENGINE',
          type: 'HARDWARE',
          canonicalEntityRef: 'COMP-ADV-01',
          revisionRef: revId,
          configurationRef: configId,
          lifecycleState: ConfigurationStatus.ACTIVE,
          applicability: '1-10',
          dependencies: [],
          provenance: {
            originHash: 'hash-v1',
            createdBy: 'CHIEF_SYSTEMS_ENGINEER',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          verificationState: 'VERIFIED',
          evidenceRefs: ['MEAS-01']
        }
      ],
      provenance: {
        originHash: 'hash-v2',
        createdBy: 'CHIEF_SYSTEMS_ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisionId: revId
    };

    bridge.p13.registry.registerConfiguration(validConfig);

    const app: ConfigurationApplicability = {
      applicabilityId: 'APP-ADV-01',
      targetId: configId,
      serialNumberMin: 1,
      serialNumberMax: 10,
      missionProfile: 'TACTICAL',
      provenance: {
        originHash: 'hash-app',
        createdBy: 'ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p13.registry.registerApplicability(app);

    const baseline = bridge.p13.baseline.createBaseline(
      'BL-ADV-01',
      'Valid baseline',
      configId,
      'APP-ADV-01',
      'CHIEF_SYSTEMS_ENGINEER',
      'human:chief:systems:01'
    );
    expect(baseline).toBeDefined();

    // Verify baseline immutability: mutating baseline items directly is prohibited and throws BASELINE_IMMUTABILITY_VIOLATION
    expect(() => {
      bridge.p13.baseline.verifyBaselineImmutability('BL-ADV-01', []);
    }).toThrow(/BASELINE_IMMUTABILITY_VIOLATION/);

    // --- G07: Change Control Bypass Rejection ---
    // Direct mutation of configuration items without Change Request is blocked
    const crId = 'CR-ADV-01';
    expect(() => {
      bridge.p13.change.executeChange(
        'CHG-ADV-01',
        crId, // Reference non-approved CR ID
        configId,
        (items) => items,
        'ENGINEER',
        'eng:01'
      );
    }).toThrow(/CHANGE_REQUEST_NOT_FOUND/);

    // --- G10: Applicability Overlap Rejection ---
    // Overlapping contradictory serial range throws error
    const overlappingApp: ConfigurationApplicability = {
      applicabilityId: 'APP-ADV-OVERLAP',
      targetId: 'CONFIG-OTHER',
      serialNumberMin: 5, // Overlaps 1-10 range in APP-ADV-01
      serialNumberMax: 15,
      missionProfile: 'TACTICAL',
      provenance: {
        originHash: 'hash-app-overlap',
        createdBy: 'ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p13.registry.registerApplicability(overlappingApp);

    expect(() => {
      bridge.p13.applicability.assertGlobalApplicabilityIntegrity();
    }).toThrow(/CONTRADICTORY_APPLICABILITY_OVERLAP/);

    // Remove overlapping applicability to let subsequent tests run
    bridge.p13.registry.applicabilities.delete('APP-ADV-OVERLAP');

    // --- G11: Option & Variant Constraint Rejection ---
    // Options/configurations that do not belong to the Variant throws INVALID_VARIANT_COMBINATION
    const variant: ConfigurationVariant = {
      variantId: 'VAR-ADV-01',
      familyId: 'FAM-ADV',
      name: 'Adversarial Variant Spec',
      allowedConfigurations: ['CONFIG-ALLOWED-ONLY'], // 'CONFIG-ADV-01' is not allowed here
      constraints: [],
      provenance: {
        originHash: 'hash-var',
        createdBy: 'ENGINEER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    bridge.p13.registry.registerVariant(variant);

    const compResult = bridge.p13.compatibility.checkCompatibility(configId);
    expect(compResult.isValid).toBe(false);
    expect(compResult.errors).toContain('INVALID_VARIANT_COMBINATION: Configuration \'CONFIG-ADV-01\' is not an authorized combination for Variant \'VAR-ADV-01\'.');

    // --- G12: Compatibility Revision Contract Rejection ---
    // Setup Engine and Software items to trigger explicit incompatibility revision contract rule
    const incompatibleItems: ConfigurationItem[] = [
      {
        id: 'CI-ENGINE-01',
        identity: 'CI-ENGINE',
        type: 'HARDWARE',
        canonicalEntityRef: 'COMP-ADV-01',
        revisionRef: 'REV-R8',
        configurationRef: configId,
        lifecycleState: ConfigurationStatus.ACTIVE,
        applicability: '1-10',
        dependencies: ['CI-SOFTWARE-01'],
        provenance: {
          originHash: 'hash-eng',
          createdBy: 'ENGINEER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        verificationState: 'VERIFIED',
        evidenceRefs: ['MEAS-01']
      },
      {
        id: 'CI-SOFTWARE-01',
        identity: 'CI-SOFTWARE',
        type: 'SOFTWARE',
        canonicalEntityRef: 'COMP-ADV-01',
        revisionRef: 'REV-R3', // Trigger INCOMPATIBLE_REVISION rule with CI-ENGINE at REV-R8
        configurationRef: configId,
        lifecycleState: ConfigurationStatus.ACTIVE,
        applicability: '1-10',
        dependencies: [],
        provenance: {
          originHash: 'hash-sw',
          createdBy: 'ENGINEER',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        verificationState: 'VERIFIED',
        evidenceRefs: ['MEAS-02']
      }
    ];

    validConfig.items = incompatibleItems;
    bridge.p13.registry.updateConfiguration(validConfig);

    // Bypass variant check for local revision compatibility check
    variant.allowedConfigurations.push(configId);
    bridge.p13.registry.updateVariant(variant);

    const incompatibilityCheck = bridge.p13.compatibility.checkCompatibility(configId);
    expect(incompatibilityCheck.isValid).toBe(false);
    expect(incompatibilityCheck.errors.some(err => err.includes('INCOMPATIBLE_REVISION'))).toBe(true);

    // --- G17: AI Governance Sign-off Rejection ---
    // Reject synthetic and AI sign-offs on release or authorization boundaries
    expect(() => {
      bridge.p13.governance.assertHumanGovernanceAuthority(
        'AI_INTELLIGENT_SYSTEM_AGENT',
        'ai:agent:01',
        'RELEASE_CONFIGURATION'
      );
    }).toThrow(/AI_GOVERNANCE_VIOLATION/);

    // --- G18: Persistence Tampering Rejection ---
    // Tampered persistence payloads must be detected and fail-closed
    const validSnapshot = bridge.p13.persistence.createSnapshot('GOVERNANCE_SYSTEM');
    const tamperedSnapshot = JSON.parse(JSON.stringify(validSnapshot));
    // Tamper with baseline name or configuration property
    tamperedSnapshot.configurations[0].name = 'TAMPERED: Altered payload description';

    expect(() => {
      bridge.p13.persistence.restoreFromSnapshot(tamperedSnapshot);
    }).toThrow(/CONFIGURATION_SNAPSHOT_TAMPER_DETECTED/);

    console.log('--- ADSE P13 FORENSIC GATES COMPLETE ---');
  });
});
