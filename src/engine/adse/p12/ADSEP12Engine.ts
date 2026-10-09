import { createHash } from 'crypto';
import { SafetyRegistry } from './SafetyRegistry';
import { SafetyCausalityEngine } from './SafetyCausalityEngine';
import { SafetyGovernanceEngine } from './SafetyGovernanceEngine';
import { SafetyPersistenceEngine } from './SafetyPersistenceEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { ADSEP11Engine } from '../p11/ADSEP11Engine';
import {
  Hazard,
  SafetyControl,
  SafetyClaim,
  SafetyCase,
  HazardSeverity,
  HazardLikelihood,
  SafetyGovernanceState
} from './types';

export class ADSEP12Engine {
  private static instance: ADSEP12Engine | null = null;

  public registry: SafetyRegistry;
  public causality: SafetyCausalityEngine;
  public governance: SafetyGovernanceEngine;
  public persistence: SafetyPersistenceEngine;

  private digitalThread: DigitalThreadRegistry;
  private p11?: ADSEP11Engine;

  constructor(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p11?: ADSEP11Engine) {
    this.registry = new SafetyRegistry();
    this.causality = new SafetyCausalityEngine();
    this.governance = new SafetyGovernanceEngine(this.registry);
    this.persistence = new SafetyPersistenceEngine(this.registry);
    this.digitalThread = digitalThread;
    this.p11 = p11;
  }

  public static getInstance(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p11?: ADSEP11Engine): ADSEP12Engine {
    if (!this.instance) {
      this.instance = new ADSEP12Engine(revisionEngine, digitalThread, p11);
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  /**
   * P12.1: Derives a Hazard directly from a P11 Failure Mode, calculating risk and linking to Digital Thread.
   */
  public createHazardFromP11FailureMode(
    fmId: string,
    hazardInput: {
      hazardId: string;
      initiatingConditions: string[];
      hazardousCondition: string;
      consequences: string[];
      severity: HazardSeverity;
      likelihood: HazardLikelihood;
    },
    actorRole: string,
    actorId: string
  ): Hazard {
    if (!this.p11) {
      throw new Error('P11_ENGINE_NOT_LINKED');
    }

    const fm = this.p11.registry.getFailureMode(fmId);
    if (!fm) {
      throw new Error(`FAILURE_MODE_NOT_FOUND: ${fmId}`);
    }

    const hazard = this.causality.deriveHazardFromFailureMode(fm, hazardInput, actorRole, actorId);
    this.registry.registerHazard(hazard);

    // Register node and trace in Digital Thread
    const hazardNodeId = `thread:safety-hazard:${hazard.hazardId}`;
    if (!this.digitalThread.getNode(hazardNodeId)) {
      this.digitalThread.registerNode({
        nodeId: hazardNodeId,
        nodeType: 'MBSEElement',
        canonicalId: hazard.hazardId,
        authoritySource: 'P12_SAFETY_ENGINE',
        displayName: `Hazard: ${hazard.hazardousCondition} [${hazard.riskLevel}]`,
        configurationId: hazard.configurationId,
        revisionId: hazard.revisionId
      });

      // Link Failure Mode -> Hazard in Digital Thread
      const fmNodeId = `thread:failure-mode:${fmId}`;
      if (this.digitalThread.getNode(fmNodeId)) {
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${fmNodeId}->${hazardNodeId}`,
          edgeType: 'CAUSES',
          sourceNodeId: fmNodeId,
          targetNodeId: hazardNodeId,
          authoritySource: 'P12_SAFETY_ENGINE',
          configurationId: hazard.configurationId
        });
      }
    }

    return hazard;
  }

  /**
   * P12.2: Registers a Safety Control / Mitigation barrier and links it to the Digital Thread.
   */
  public registerSafetyControlAndTrace(control: SafetyControl): void {
    this.registry.registerSafetyControl(control);

    const ctrlNodeId = `thread:safety-control:${control.controlId}`;
    if (!this.digitalThread.getNode(ctrlNodeId)) {
      this.digitalThread.registerNode({
        nodeId: ctrlNodeId,
        nodeType: 'MBSEElement',
        canonicalId: control.controlId,
        authoritySource: 'P12_SAFETY_ENGINE',
        displayName: `Control: ${control.description} (Eff: ${(control.efficiency * 100).toFixed(0)}%)`,
        configurationId: control.configurationId,
        revisionId: control.revisionId
      });

      // Link Control -> Target Hazard (MITIGATES)
      const hazardNodeId = `thread:safety-hazard:${control.hazardId}`;
      if (this.digitalThread.getNode(hazardNodeId)) {
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${ctrlNodeId}->${hazardNodeId}`,
          edgeType: 'MITIGATES',
          sourceNodeId: ctrlNodeId,
          targetNodeId: hazardNodeId,
          authoritySource: 'P12_SAFETY_ENGINE',
          configurationId: control.configurationId
        });
      }

      // Link Control -> Target Requirement if present
      if (control.targetRequirementId) {
        const reqNodeId = `thread:requirement:${control.targetRequirementId}`;
        if (this.digitalThread.getNode(reqNodeId)) {
          this.digitalThread.registerEdge({
            edgeId: `thread:edge:${ctrlNodeId}->${reqNodeId}`,
            edgeType: 'SATISFIES',
            sourceNodeId: ctrlNodeId,
            targetNodeId: reqNodeId,
            authoritySource: 'P12_SAFETY_ENGINE',
            configurationId: control.configurationId
          });
        }
      }
    }
  }

  /**
   * P12.3: Registers a Safety Claim and establishes Digital Thread edges to Hazard & Control.
   */
  public registerSafetyClaimAndTrace(claim: SafetyClaim): void {
    this.registry.registerSafetyClaim(claim);

    const claimNodeId = `thread:safety-claim:${claim.claimId}`;
    if (!this.digitalThread.getNode(claimNodeId)) {
      this.digitalThread.registerNode({
        nodeId: claimNodeId,
        nodeType: 'MBSEElement',
        canonicalId: claim.claimId,
        authoritySource: 'P12_SAFETY_ENGINE',
        displayName: `Safety Claim: ${claim.claimText}`,
        configurationId: claim.configurationId,
        revisionId: claim.revisionId
      });

      // Link Claim -> Target Hazard (ADDRESSES)
      const hazardNodeId = `thread:safety-hazard:${claim.targetHazardId}`;
      if (this.digitalThread.getNode(hazardNodeId)) {
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${claimNodeId}->${hazardNodeId}`,
          edgeType: 'ADDRESSES',
          sourceNodeId: claimNodeId,
          targetNodeId: hazardNodeId,
          authoritySource: 'P12_SAFETY_ENGINE',
          configurationId: claim.configurationId
        });
      }

      // Link Claim -> Target Control (SUPPORTED_BY)
      const ctrlNodeId = `thread:safety-control:${claim.targetControlId}`;
      if (this.digitalThread.getNode(ctrlNodeId)) {
        this.digitalThread.registerEdge({
          edgeId: `thread:edge:${claimNodeId}->${ctrlNodeId}`,
          edgeType: 'SUPPORTED_BY',
          sourceNodeId: claimNodeId,
          targetNodeId: ctrlNodeId,
          authoritySource: 'P12_SAFETY_ENGINE',
          configurationId: claim.configurationId
        });
      }
    }
  }

  /**
   * P12.4: Registers a Safety Case (Structured Goal Structuring Notation / Assurance Case).
   */
  public registerSafetyCaseAndTrace(sCase: SafetyCase): void {
    this.registry.registerSafetyCase(sCase);

    const caseNodeId = `thread:safety-case:${sCase.caseId}`;
    if (!this.digitalThread.getNode(caseNodeId)) {
      this.digitalThread.registerNode({
        nodeId: caseNodeId,
        nodeType: 'MBSEElement',
        canonicalId: sCase.caseId,
        authoritySource: 'P12_SAFETY_ENGINE',
        displayName: `Safety Case: ${sCase.title}`,
        configurationId: sCase.configurationId,
        revisionId: sCase.revisionId
      });

      // Link Safety Case -> Claims in Digital Thread
      if (sCase.claims) {
        for (const cl of sCase.claims) {
          const claimNodeId = `thread:safety-claim:${cl.claimId}`;
          if (this.digitalThread.getNode(claimNodeId)) {
            this.digitalThread.registerEdge({
              edgeId: `thread:edge:${caseNodeId}->${claimNodeId}`,
              edgeType: 'CONTAINS',
              sourceNodeId: caseNodeId,
              targetNodeId: claimNodeId,
              authoritySource: 'P12_SAFETY_ENGINE',
              configurationId: sCase.configurationId
            });
          }
        }
      }
    }
  }
}
