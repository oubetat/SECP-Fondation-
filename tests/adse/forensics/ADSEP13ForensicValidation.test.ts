import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP13Engine } from '../../../src/engine/adse/p13/ADSEP13Engine';
import { RevisionEngine } from '../../../src/engine/revision/RevisionEngine';
import { DigitalThreadRegistry } from '../../../src/engine/adse/p4/DigitalThreadRegistry';
import { ADSEP12Engine } from '../../../src/engine/adse/p12/ADSEP12Engine';
import { ConfigurationStatus, ConfigurationChangeType } from '../../../src/engine/adse/p13/types';

describe('ADSE P13 — Forensic Validation Suite', () => {
  let p13: ADSEP13Engine;
  let coreRevision: RevisionEngine;
  let digitalThread: DigitalThreadRegistry;
  let p12: ADSEP12Engine;

  beforeEach(() => {
    coreRevision = new RevisionEngine();
    digitalThread = new DigitalThreadRegistry(coreRevision);
    p12 = new ADSEP12Engine(coreRevision, digitalThread);
    p13 = new ADSEP13Engine(coreRevision, digitalThread, p12);
    ADSEP13Engine.resetInstance();
  });

  // --- PHASE B: Digital Thread Gap ---
  describe('PHASE B: Digital Thread Binding & Canonical Integrity', () => {
    it('proves fail-closed behavior when registering a configuration with a missing canonical entity', () => {
      // 1. Prepare Revision
      coreRevision.createRevision({ 
        revisionId: 'REV-A', 
        entityId: 'E1', 
        entityType: 'COMPONENT' as any, 
        revisionCode: 'A', 
        revisionNumber: 1, 
        content: {}, 
        createdBy: 'ENG' 
      } as any);

      // 2. Register real canonical node in thread
      digitalThread.registerNode({ nodeId: 'thread:canonical:REAL-01', nodeType: 'MBSEElement', canonicalId: 'REAL-01', authoritySource: 'CORE', displayName: 'Real Component', configurationId: 'NONE' });
      p13.registry.registerCanonicalEntityId('REAL-01');

      // 3. Attempt to register config item referencing MISSING entity
      const config: any = {
        configurationId: 'CONF-B1',
        revisionId: 'REV-A',
        name: 'Failure Test',
        variantId: 'V1',
        status: ConfigurationStatus.DRAFT,
        items: [{
          id: 'CI-01',
          identity: 'CI-VALVE-01',
          type: 'MECHANICAL',
          revisionRef: 'REV-A',
          canonicalEntityRef: 'MISSING-01', // Does not exist in registry
          dependencies: [],
          lifecycleState: ConfigurationStatus.ACTIVE,
          provenance: {} as any
        }]
      };

      expect(() => p13.registerConfigurationAndTrace(config)).toThrow('CANONICAL_BINDING_VIOLATION');
    });

    it('proves that Digital Thread nodes for P13 are bound to real canonical entities', () => {
      coreRevision.createRevision({ 
        revisionId: 'REV-A', 
        entityId: 'E1', 
        entityType: 'COMPONENT' as any, 
        revisionCode: 'A', 
        revisionNumber: 1, 
        content: {}, 
        createdBy: 'ENG' 
      } as any);
      p13.registry.registerCanonicalEntityId('REAL-02');
      
      const config: any = {
        configurationId: 'CONF-B2',
        revisionId: 'REV-A',
        name: 'Tracing Test',
        variantId: 'V1',
        status: ConfigurationStatus.DRAFT,
        items: [{
          id: 'CI-02',
          identity: 'CI-VALVE-02',
          type: 'MECHANICAL',
          revisionRef: 'REV-A',
          canonicalEntityRef: 'REAL-02',
          dependencies: [],
          lifecycleState: ConfigurationStatus.ACTIVE,
          provenance: {} as any
        }]
      };

      p13.registerConfigurationAndTrace(config);

      const ciNode = digitalThread.getNode('thread:config-item:CI-02');
      const canonicalNode = digitalThread.getNode('thread:canonical-entity:REAL-02');
      
      expect(ciNode).toBeDefined();
      expect(canonicalNode).toBeDefined();
      expect(ciNode?.canonicalId).toBe('CI-02');
      expect(canonicalNode?.canonicalId).toBe('REAL-02');

      const edges = digitalThread.getAllEdges().filter(e => e.sourceNodeId === 'thread:config-item:CI-02' && e.targetNodeId === 'thread:canonical-entity:REAL-02');
      expect(edges[0].edgeType).toBe('CONFIGURES');
    });
  });

  // --- PHASE C: Revision Authority ---
  describe('PHASE C: Revision Authority Subordination', () => {
    it('strictly rejects configuration binding to a non-existent revision in core RevisionEngine', () => {
      p13.registry.registerCanonicalEntityId('ENTITY-1');
      const config: any = {
        configurationId: 'CONF-C1',
        revisionId: 'NON-EXISTENT-REV',
        name: 'Rev Test',
        variantId: 'V1',
        status: ConfigurationStatus.DRAFT,
        items: []
      };

      expect(() => p13.registerConfigurationAndTrace(config)).toThrow('REVISION_AUTHORITY_MISMATCH');
    });

    it('proves cross-configuration revision contamination is blocked', () => {
      coreRevision.createRevision({ 
        revisionId: 'REV-1', 
        entityId: 'E1', 
        entityType: 'COMPONENT' as any, 
        revisionCode: 'A', 
        revisionNumber: 1, 
        content: {}, 
        createdBy: 'ENG' 
      } as any);
      p13.registry.registerCanonicalEntityId('E1');

      const config1: any = { configurationId: 'C1', revisionId: 'REV-1', items: [], status: ConfigurationStatus.ACTIVE };
      p13.registry.registerConfiguration(config1);

      // Attempt to validate config referencing non-existent revision in core
      const config2: any = {
        configurationId: 'C2',
        revisionId: 'REV-1',
        items: [{ id: 'CI-X', identity: 'X', type: 'M', revisionRef: 'REV-INVALID', canonicalEntityRef: 'E1', dependencies: [] }],
        status: ConfigurationStatus.ACTIVE
      };

      expect(() => p13.authority.validateRevisionBinding(config2)).toThrow('REVISION_AUTHORITY_MISMATCH');
    });
  });

  // --- PHASE D: Configuration Identity ---
  describe('PHASE D: Unambiguous Configuration Identity', () => {
    it('proves that duplicate configuration IDs are rejected at the registry level', () => {
      const config: any = { configurationId: 'DUP-01', revisionId: 'REV-A', items: [], status: ConfigurationStatus.ACTIVE };
      p13.registry.registerConfiguration(config);
      expect(() => p13.registry.registerConfiguration(config)).toThrow('DUPLICATE_CONFIGURATION_ID');
    });

    it('computes unique identity signatures based on config, revision, applicability, and variant', () => {
      const sig1 = p13.authority.computeConfigurationIdentitySignature('C1', 'R1', 'A1', 'V1');
      const sig2 = p13.authority.computeConfigurationIdentitySignature('C1', 'R1', 'A1', 'V2');
      expect(sig1).not.toBe(sig2);
    });
  });

  // --- PHASE E: Applicability / Effectivity ---
  describe('PHASE E: Applicability Semantics', () => {
    it('detects and rejects overlapping serial number ranges for the same configuration', () => {
      p13.registry.registerApplicability({ 
        applicabilityId: 'APP-1', 
        targetId: 'C1', 
        missionProfile: 'DEFAULT', 
        serialNumberMin: 1, 
        serialNumberMax: 100 
      } as any);
      p13.registry.registerApplicability({ 
        applicabilityId: 'APP-2', 
        targetId: 'C2', 
        missionProfile: 'DEFAULT', 
        serialNumberMin: 50, 
        serialNumberMax: 150 
      } as any);
      
      expect(() => p13.applicability.assertGlobalApplicabilityIntegrity()).toThrow('CONTRADICTORY_APPLICABILITY_OVERLAP');
    });

    it('proves that invalid serial ranges (start > end) are rejected', () => {
      const invalid: any = { applicabilityId: 'APP-INV', targetId: 'C1', serialNumberMin: 500, serialNumberMax: 100 };
      expect(() => p13.applicability.validateApplicability(invalid)).toThrow('INVALID_APPLICABILITY_RANGE');
    });
  });

  // --- PHASE F: Dependency & Compatibility ---
  describe('PHASE F: True Dependency Traversal & Compatibility', () => {
    it('detects INCOMPATIBLE_REVISION during cross-domain traversal', () => {
      p13.registry.registerCanonicalEntityId('ENG-01');
      p13.registry.registerCanonicalEntityId('SW-01');

      const config: any = {
        configurationId: 'SYS-01',
        revisionId: 'REV-R8',
        variantId: 'V1',
        items: [
          { id: 'CI-ENG', identity: 'CI-ENGINE', type: 'MECHANICAL', revisionRef: 'REV-R8', canonicalEntityRef: 'ENG-01', dependencies: ['CI-SW'] },
          { id: 'CI-SW', identity: 'CI-SOFTWARE', type: 'SOFTWARE', revisionRef: 'REV-R3', canonicalEntityRef: 'SW-01', dependencies: [] }
        ]
      };
      p13.registry.registerConfiguration(config);

      // Rule in checkCompatibility: Engine REV-R8 with Software REV-R3 is INCOMPATIBLE
      const result = p13.compatibility.checkCompatibility('SYS-01');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('INCOMPATIBLE_REVISION');
    });
  });

  // --- PHASE G: Baseline Authority ---
  describe('PHASE G: Baseline Prerequisite Integrity', () => {
    it('rejects baseline creation if the underlying configuration is invalidated', () => {
      const config: any = { configurationId: 'C1', status: ConfigurationStatus.INVALIDATED, items: [], revisionId: 'R1' };
      p13.registry.registerConfiguration(config);
      p13.registry.registerApplicability({ applicabilityId: 'A1', targetId: 'C1' } as any);
      
      expect(() => p13.baseline.createBaseline('B1', 'T1', 'C1', 'A1', 'CONFIGURATION_AUTHORITY', 'ENG-01')).toThrow('CONFIGURATION_INVALIDATED');
    });
  });

  // --- PHASE H: Change Management ---
  describe('PHASE H: Formal Change Control Production Path', () => {
    it('proves that approving a Change Request transitions the state to APPROVED', () => {
      p13.change.createChangeRequest(
        'CR-01',
        'Update',
        'Desc',
        ConfigurationChangeType.MAJOR,
        ['I1'],
        'HUMAN_ENG'
      );
      
      p13.change.approveChangeRequest('CR-01', 'CONFIGURATION_AUTHORITY', 'ENG-01');
      const updatedCr = p13.registry.getChangeRequest('CR-01');
      expect(updatedCr?.status).toBe('APPROVED');
    });
  });

  // --- PHASE I: P11 / P12 Integration ---
  describe('PHASE I: P11/P12 Integration & Impact Ripple', () => {
    it('automatically invalidates P12 Safety Claims when a configuration item is invalidated', () => {
      // 1. Setup P12
      p12.registry.registerHazard({ hazardId: 'HAZ-01', title: 'Pressure Spike', hazardousCondition: 'Overpressure', severity: 'CATASTROPHIC', status: 'ACTIVE' });
      p12.registry.registerSafetyControl({ controlId: 'CTRL-01', hazardId: 'HAZ-01', name: 'Pressure Valve', status: 'VERIFIED', efficiency: 0.99 });
      p12.registry.registerSafetyClaim({ claimId: 'CLAIM-01', targetHazardId: 'HAZ-01', targetControlId: 'CTRL-01', status: 'VERIFIED', statement: 'Valve holds pressure' });

      // 2. Setup P13 CI bound to the same canonical entity
      p13.registry.registerCanonicalEntityId('CTRL-01');
      const config: any = {
        configurationId: 'C1',
        revisionId: 'REV-1',
        items: [{ id: 'CI-VALVE', canonicalEntityRef: 'CTRL-01', dependencies: [] }]
      };
      p13.registry.configurations.set('C1', config);

      // 3. Invalidate CI
      p13.handleItemInvalidation('CI-VALVE');

      // 4. Verify P12 impact
      const claim = p12.registry.getSafetyClaim('CLAIM-01');
      expect(claim?.status).toBe('REASSESSMENT_REQUIRED');
    });
  });

  // --- PHASE J: AI Governance ---
  describe('PHASE J: Backend AI Governance Enforcement', () => {
    it('strictly rejects AI-authorized configuration sign-offs', () => {
      expect(() => p13.governance.assertHumanGovernanceAuthority('AI_AGENT', 'ai:123', 'AUTHORIZE_CONFIGURATION')).toThrow('AI_GOVERNANCE_VIOLATION');
    });

    it('allows human authority to approve', () => {
      expect(() => p13.governance.assertHumanGovernanceAuthority('CONFIGURATION_AUTHORITY', 'ENG-01', 'AUTHORIZE_CONFIGURATION')).not.toThrow();
    });
  });

  // --- PHASE K: Persistence Snapshot & Reconstruction Parity ---
  describe('PHASE K: Persistence Snapshot & Reconstruction Parity', () => {
    it('proves that a tampered snapshot fails rehydration', () => {
      p13.registry.registerConfiguration({ configurationId: 'C1', revisionId: 'R1', status: ConfigurationStatus.ACTIVE, items: [], name: 'C1', variantId: 'V1', provenance: {} as any });
      const snapshot = p13.persistence.createSnapshot('AUTH-01');
      
      // Tamper
      snapshot.configurations[0].name = 'TAMPERED';
      
      expect(() => p13.persistence.restoreFromSnapshot(snapshot)).toThrow('CONFIGURATION_SNAPSHOT_TAMPER_DETECTED');
    });
  });
});
