import { createHash } from 'crypto';
import { FailureRegistry } from './FailureRegistry';
import { ReliabilityCausalityEngine } from './ReliabilityCausalityEngine';
import { FailureGovernanceEngine } from './FailureGovernanceEngine';
import { ReliabilityPersistenceEngine } from './ReliabilityPersistenceEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { FailureMode, FaultTree, ReliabilityModel, FailureGovernanceState } from './types';

import { ADSEP10Engine } from '../p10/ADSEP10Engine';

export class ADSEP11Engine {
  private static instance: ADSEP11Engine | null = null;

  public registry: FailureRegistry;
  public causality: ReliabilityCausalityEngine;
  public governance: FailureGovernanceEngine;
  public persistence: ReliabilityPersistenceEngine;
  private digitalThread: DigitalThreadRegistry;
  private p10?: ADSEP10Engine;

  constructor(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p10?: ADSEP10Engine) {
    this.registry = new FailureRegistry();
    this.causality = new ReliabilityCausalityEngine();
    this.governance = new FailureGovernanceEngine(this.registry);
    this.persistence = new ReliabilityPersistenceEngine(this.registry);
    this.digitalThread = digitalThread;
    this.p10 = p10;
  }

  public static getInstance(revisionEngine: RevisionEngine, digitalThread: DigitalThreadRegistry, p10?: ADSEP10Engine): ADSEP11Engine {
    if (!this.instance) {
      this.instance = new ADSEP11Engine(revisionEngine, digitalThread, p10);
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  /**
   * P11.4: Formally promotes a Physical Finding (P10) to a Failure Hypothesis (P11).
   * Establishing the authoritative link between physical evidence and risk analysis.
   */
  public createFailureHypothesisFromFinding(findingId: string, configurationId: string): FailureMode {
    if (!this.p10) throw new Error('P10_ENGINE_NOT_LINKED');
    
    const finding = this.p10.registry.getPhysicalFinding(findingId);
    if (!finding) throw new Error(`PHYSICAL_FINDING_NOT_FOUND: ${findingId}`);

    const fmId = `FM-HYPOTHESIS-${findingId}`;
    const fm: FailureMode = {
      failureModeId: fmId,
      systemId: 'UNKNOWN_SYSTEM', // Should be derived from context in real implementation
      elementId: finding.sensorId, // Tracing back to the sensor context
      revisionId: 'REV-R1',
      configurationId: configurationId,
      description: `Hypothesis: ${finding.engineeringFindingText}`,
      failureType: 'HYPOTHESIS',
      failureMechanism: 'TBD',
      localEffect: 'TBD',
      systemEffect: 'TBD',
      detectionMethod: 'SENSOR_ANOMALY',
      mitigationStrategy: 'TBD',
      severity: 5, // Default hypothesis severity
      occurrence: 5,
      detectability: 5,
      criticality: 25,
      status: FailureGovernanceState.PROPOSED,
      provenance: {
        originHash: createHash('sha256').update(fmId).digest('hex'),
        createdBy: 'SYSTEM_DIAGNOSTICS_AI', // Hypotheses can be AI-proposed
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      evidenceRefs: [finding.measurementId],
      causes: [],
      physicalFindingId: findingId
    };

    this.registerFailureModeAndTrace(fm);
    return fm;
  }

  /**
   * P11.1 & P11.4: Registers a failure mode and links it to both the core component model 
   * and the Digital Thread registry with a traceable lifecycle.
   */
  public registerFailureModeAndTrace(fm: FailureMode): void {
    this.registry.registerFailureMode(fm);

    // Create a digital thread node for the failure mode
    const fmNodeId = `thread:failure-mode:${fm.failureModeId}`;
    if (!this.digitalThread.getNode(fmNodeId)) {
      this.digitalThread.registerNode({
        nodeId: fmNodeId,
        nodeType: 'MBSEElement',
        canonicalId: fm.failureModeId,
        authoritySource: 'P11_RELIABILITY_ENGINE',
        displayName: `Failure Mode: ${fm.description} (${fm.failureType})`,
        configurationId: fm.configurationId,
        revisionId: fm.revisionId
      });

      // Link Failure Mode to target node (Component or Sensor)
      let targetNodeId = `thread:component:${fm.elementId}`;
      if (!this.digitalThread.getNode(targetNodeId)) {
        const sensorNodeId = `thread:sensor:${fm.elementId}`;
        if (this.digitalThread.getNode(sensorNodeId)) {
          targetNodeId = sensorNodeId;
        }
      }

      this.digitalThread.registerEdge({
        edgeId: `thread:edge:${fmNodeId}->${targetNodeId}`,
        edgeType: 'DEPENDS_ON',
        sourceNodeId: fmNodeId,
        targetNodeId,
        authoritySource: 'P11_RELIABILITY_ENGINE',
        configurationId: fm.configurationId
      });

      // Link any evidence references to the failure mode in the digital thread
      if (fm.evidenceRefs && fm.evidenceRefs.length > 0) {
        for (const evidenceId of fm.evidenceRefs) {
          const mNodeId = `thread:measurement:${evidenceId}`;
          if (this.digitalThread.getNode(mNodeId)) {
            this.digitalThread.registerEdge({
              edgeId: `thread:edge:${mNodeId}->${fmNodeId}`,
              edgeType: 'CONNECTED_TO',
              sourceNodeId: mNodeId,
              targetNodeId: fmNodeId,
              authoritySource: 'P11_RELIABILITY_ENGINE',
              configurationId: fm.configurationId
            });
          }
        }
      }
    }
  }

  /**
   * P11.5: Registers a logical Fault Tree and establishes its Digital Thread linkages.
   */
  public registerFaultTreeAndTrace(ft: FaultTree): void {
    this.registry.registerFaultTree(ft);

    const ftNodeId = `thread:fault-tree:${ft.treeId}`;
    if (!this.digitalThread.getNode(ftNodeId)) {
      this.digitalThread.registerNode({
        nodeId: ftNodeId,
        nodeType: 'MBSEElement',
        canonicalId: ft.treeId,
        authoritySource: 'P11_RELIABILITY_ENGINE',
        displayName: `Fault Tree: ${ft.topEvent.description} (P_top=${ft.topEvent.probability.toFixed(6)})`,
        configurationId: ft.configurationId,
        revisionId: ft.revisionId
      });

      // Link all constituent failure modes in the tree to the Fault Tree node
      for (const ev of ft.events) {
        if (ev.failureModeId) {
          const fmNodeId = `thread:failure-mode:${ev.failureModeId}`;
          if (this.digitalThread.getNode(fmNodeId)) {
            this.digitalThread.registerEdge({
              edgeId: `thread:edge:${fmNodeId}->${ftNodeId}`,
              edgeType: 'DEPENDS_ON',
              sourceNodeId: fmNodeId,
              targetNodeId: ftNodeId,
              authoritySource: 'P11_RELIABILITY_ENGINE',
              configurationId: ft.configurationId
            });
          }
        }
      }
    }
  }

  /**
   * P11.6: Registers a Reliability Model and links it inside the Digital Thread.
   */
  public registerReliabilityModelAndTrace(model: ReliabilityModel): void {
    this.registry.registerReliabilityModel(model);

    const rmNodeId = `thread:reliability-model:${model.modelId}`;
    if (!this.digitalThread.getNode(rmNodeId)) {
      this.digitalThread.registerNode({
        nodeId: rmNodeId,
        nodeType: 'MBSEElement',
        canonicalId: model.modelId,
        authoritySource: 'P11_RELIABILITY_ENGINE',
        displayName: `Reliability Model ${model.modelId} (Availability: ${(model.availability * 100).toFixed(4)}%)`,
        configurationId: model.configurationId,
        revisionId: model.revisionId
      });
    }
  }
}
