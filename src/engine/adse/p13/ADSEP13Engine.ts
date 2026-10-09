import { createHash } from 'crypto';
import { ConfigurationRegistry } from './ConfigurationRegistry';
import { ConfigurationAuthorityEngine } from './ConfigurationAuthorityEngine';
import { ConfigurationBaselineEngine } from './ConfigurationBaselineEngine';
import { ConfigurationChangeEngine } from './ConfigurationChangeEngine';
import { ConfigurationImpactEngine } from './ConfigurationImpactEngine';
import { ConfigurationApplicabilityEngine } from './ConfigurationApplicabilityEngine';
import { ConfigurationCompatibilityEngine } from './ConfigurationCompatibilityEngine';
import { ConfigurationGovernanceEngine } from './ConfigurationGovernanceEngine';
import { ConfigurationPersistenceEngine } from './ConfigurationPersistenceEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { ADSEP12Engine } from '../p12/ADSEP12Engine';
import {
  Configuration,
  ConfigurationItem,
  ConfigurationStatus,
  ConfigurationBaseline,
  ConfigurationRelationship,
  ConfigurationApplicability,
  ConfigurationVariant,
  ConfigurationChangeRequest,
  ConfigurationChange,
  ConfigurationRelease,
  ConfigurationAudit,
  ConfigurationDependency,
  ConfigurationManifest,
  ConfigurationSnapshot
} from './types';
import { SafetyGovernanceState } from '../p12/types';

export class ADSEP13Engine {
  private static instance: ADSEP13Engine | null = null;

  public registry: ConfigurationRegistry;
  public authority: ConfigurationAuthorityEngine;
  public baseline: ConfigurationBaselineEngine;
  public change: ConfigurationChangeEngine;
  public impact: ConfigurationImpactEngine;
  public applicability: ConfigurationApplicabilityEngine;
  public compatibility: ConfigurationCompatibilityEngine;
  public governance: ConfigurationGovernanceEngine;
  public persistence: ConfigurationPersistenceEngine;

  private digitalThread: DigitalThreadRegistry;
  private p12?: ADSEP12Engine;
  private revisionEngine: RevisionEngine;

  constructor(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p12?: ADSEP12Engine) {
    this.registry = new ConfigurationRegistry();
    this.authority = new ConfigurationAuthorityEngine(this.registry, revisionEngine);
    this.baseline = new ConfigurationBaselineEngine(this.registry);
    this.change = new ConfigurationChangeEngine(this.registry, this.baseline);
    this.impact = new ConfigurationImpactEngine(this.registry, digitalThread);
    this.applicability = new ConfigurationApplicabilityEngine(this.registry);
    this.compatibility = new ConfigurationCompatibilityEngine(this.registry);
    this.governance = new ConfigurationGovernanceEngine(this.registry);
    this.persistence = new ConfigurationPersistenceEngine(this.registry);

    this.digitalThread = digitalThread;
    this.p12 = p12;
    this.revisionEngine = revisionEngine;
  }

  public static getInstance(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p12?: ADSEP12Engine): ADSEP13Engine {
    if (!this.instance) {
      this.instance = new ADSEP13Engine(revisionEngine, digitalThread, p12);
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  /**
   * P13.1: Registers a Configuration and propagates all configuration items and edges to the canonical P4 Digital Thread.
   * Standardizes edges: CONFIGURES, CONTAINS, DEPENDS_ON, APPLIES_TO, SUPERSEDES, DERIVED_FROM, AFFECTS, VERIFIED_BY, SUPPORTED_BY, INVALIDATES.
   */
  public registerConfigurationAndTrace(config: Configuration): void {
    // 1. Core-authorize and validate bindings
    this.authority.validateRevisionBinding(config);
    this.registry.registerConfiguration(config);

    // 2. Register configuration node in Digital Thread
    const configNodeId = `thread:config:${config.configurationId}`;
    if (!this.digitalThread.getNode(configNodeId)) {
      this.digitalThread.registerNode({
        nodeId: configNodeId,
        nodeType: 'Configuration',
        canonicalId: config.configurationId,
        authoritySource: 'P13_CONFIGURATION_AUTHORITY',
        displayName: `Configuration: ${config.name} [${config.status}]`,
        configurationId: config.configurationId,
        revisionId: config.revisionId
      });
    }

    // 3. First pass: Register all Configuration Item nodes in Digital Thread
    for (const item of config.items) {
      const itemNodeId = `thread:config-item:${item.id}`;
      if (!this.digitalThread.getNode(itemNodeId)) {
        this.digitalThread.registerNode({
          nodeId: itemNodeId,
          nodeType: 'ConfigurationItem',
          canonicalId: item.id,
          authoritySource: 'P13_CONFIGURATION_AUTHORITY',
          displayName: `CI: ${item.identity} (${item.type}) [${item.lifecycleState}]`,
          configurationId: config.configurationId,
          revisionId: item.revisionRef
        });

        // Link Item -> Configuration (CONTAINS)
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${configNodeId}->${itemNodeId}`,
          edgeType: 'CONTAINS',
          sourceNodeId: configNodeId,
          targetNodeId: itemNodeId,
          authoritySource: 'P13_CONFIGURATION_AUTHORITY',
          configurationId: config.configurationId
        });

        // Link Item -> Canonical Entity Ref (CONFIGURES)
        const canonicalNodeId = `thread:canonical-entity:${item.canonicalEntityRef}`;
        this.digitalThread.registerNode({
          nodeId: canonicalNodeId,
          nodeType: 'MBSEElement',
          canonicalId: item.canonicalEntityRef,
          authoritySource: 'P13_CONFIGURATION_AUTHORITY',
          displayName: `Canonical Entity: ${item.canonicalEntityRef}`,
          configurationId: config.configurationId,
          revisionId: item.revisionRef
        });

        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${itemNodeId}->${canonicalNodeId}`,
          edgeType: 'CONFIGURES',
          sourceNodeId: itemNodeId,
          targetNodeId: canonicalNodeId,
          authoritySource: 'P13_CONFIGURATION_AUTHORITY',
          configurationId: config.configurationId
        });
      }
    }

    // 4. Second pass: Register all DEPENDS_ON edges between Configuration Items
    for (const item of config.items) {
      const itemNodeId = `thread:config-item:${item.id}`;
      for (const depId of item.dependencies) {
        const depNodeId = `thread:config-item:${depId}`;
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${itemNodeId}->${depNodeId}`,
          edgeType: 'DEPENDS_ON',
          sourceNodeId: itemNodeId,
          targetNodeId: depNodeId,
          authoritySource: 'P13_CONFIGURATION_AUTHORITY',
          configurationId: config.configurationId
        });
      }
    }
  }

  /**
   * P13.2: Handles Configuration Invalidation & P12 Safety Integration.
   * If a configuration item undergoes a change or is invalidated, we perform semantic
   * dependency propagation. Any dependent P12 Safety Claim becomes REASSESSMENT_REQUIRED.
   */
  public handleItemInvalidation(itemId: string, invalidatedEvidenceId?: string): {
    impactedSafetyClaimsCount: number;
    impactedSafetyControlsCount: number;
    impactedBaselinesCount: number;
  } {
    let impactedSafetyClaimsCount = 0;
    let impactedSafetyControlsCount = 0;
    let impactedBaselinesCount = 0;

    // Find the CI
    let targetItem: ConfigurationItem | undefined;
    let parentConfig: Configuration | undefined;

    for (const config of this.registry.configurations.values()) {
      const match = config.items.find(it => it.id === itemId);
      if (match) {
        targetItem = match;
        parentConfig = config;
        break;
      }
    }

    if (!targetItem || !parentConfig) {
      throw new Error(`CONFIGURATION_ITEM_NOT_FOUND: ${itemId}`);
    }

    // Update item status to INVALIDATED
    targetItem.lifecycleState = ConfigurationStatus.INVALIDATED;
    this.registry.updateConfiguration(parentConfig);

    // Invalidate dependent baselines
    for (const b of this.registry.baselines.values()) {
      if (b.configurationId === parentConfig.configurationId) {
        b.status = ConfigurationStatus.REASSESSMENT_REQUIRED;
        this.registry.updateBaseline(b);
        impactedBaselinesCount++;
      }
    }

    // Integrate with P12 Safety Engine:
    // If the changed configuration item was linked to a P12 Safety Claim, we propagate the invalidation.
    if (this.p12) {
      const safetyClaims = this.p12.registry.getAllSafetyClaims();
      for (const claim of safetyClaims) {
        // Semantic dependency check: if the claim targetControlId is linked to this item
        // or if they share an evidenceRef or canonical entity ref, transition claim status
        const control = this.p12.registry.getSafetyControl(claim.targetControlId);
        
        const isLinkedToControl = control && control.controlId === targetItem.canonicalEntityRef;
        const sharesEvidence = invalidatedEvidenceId && claim.evidenceRefs && claim.evidenceRefs.includes(invalidatedEvidenceId);

        if (isLinkedToControl || sharesEvidence) {
          if (claim.status !== SafetyGovernanceState.REASSESSMENT_REQUIRED) {
            claim.status = SafetyGovernanceState.REASSESSMENT_REQUIRED;
            this.p12.registry.updateSafetyClaim(claim);
            impactedSafetyClaimsCount++;
          }
          if (control && control.status !== SafetyGovernanceState.REASSESSMENT_REQUIRED) {
            control.status = SafetyGovernanceState.REASSESSMENT_REQUIRED;
            this.p12.registry.updateSafetyControl(control);
            impactedSafetyControlsCount++;
          }
        }
      }
    }

    return {
      impactedSafetyClaimsCount,
      impactedSafetyControlsCount,
      impactedBaselinesCount
    };
  }
}
