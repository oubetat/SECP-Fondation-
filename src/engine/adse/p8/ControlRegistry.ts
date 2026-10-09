/**
 * SECP — ADSE-P8 Control Registry
 * 
 * Authoritative registry for Control Systems, Plants, Loops, Controllers, Laws,
 * Executions, and Verifications.
 * 
 * Enforces:
 * - Single-Core binding to P3 Architecture & Digital Thread (P4)
 * - Revision & Configuration consistency
 * - Deterministic provenance and integrity
 */

import {
  ControlSystem,
  ControlledPlant,
  ControlLoop,
  Controller,
  ControlLaw,
  ControlExecution,
  ControlExecutionResult,
  ControlVerificationIntent,
  ControlEvidence,
  ControlSnapshot,
  ControlMode,
  PlantModelType,
  ControlLawType
} from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { MBSEBehavioralEngine } from '../p2/MBSEBehavioralEngine';
import { ADSEAuthorityState, ADSELifecycleState } from '../p0/types';
import { createHash } from 'crypto';

export class ControlRegistry {
  private systems: Map<string, ControlSystem> = new Map();
  private plants: Map<string, ControlledPlant> = new Map();
  private loops: Map<string, ControlLoop> = new Map();
  private controllers: Map<string, Controller> = new Map();
  private laws: Map<string, ControlLaw> = new Map();
  private executions: Map<string, ControlExecution> = new Map();
  private results: Map<string, ControlExecutionResult> = new Map();
  private verifications: Map<string, ControlVerificationIntent> = new Map();
  private evidences: Map<string, ControlEvidence> = new Map();

  private revisionEngine: RevisionEngine;
  private behavioralEngine: MBSEBehavioralEngine;
  private digitalThread: DigitalThreadRegistry;

  constructor(
    revisionEngine: RevisionEngine, 
    behavioralEngine: MBSEBehavioralEngine,
    digitalThread: DigitalThreadRegistry
  ) {
    this.revisionEngine = revisionEngine;
    this.behavioralEngine = behavioralEngine;
    this.digitalThread = digitalThread;
  }

  // --- 1. Control System Registration ---
  public registerSystem(params: {
    id: string;
    systemId: string;
    p3ArchitectureId: string;
    p4NodeId: string;
    displayName: string;
    configurationId: string;
    revisionId?: string;
    p5StructuralContextId?: string;
    p6ThermalContextId?: string;
    p7PowerContextId?: string;
    authorityState?: ADSEAuthorityState;
    lifecycleState?: ADSELifecycleState;
    provenance?: any;
  }): ControlSystem {
    if (this.systems.has(params.id)) {
      throw new Error(`CONTROL_SYSTEM_COLLISION: Control System '${params.id}' already exists.`);
    }

    if (!params.id || params.id.startsWith('FORGED') || params.id.includes('FAKE')) {
      throw new Error(`FORGED_CONTROL_IDENTITY: Control System ID '${params.id}' is invalid.`);
    }

    if (!params.p3ArchitectureId) {
      throw new Error(`ARCHITECTURAL_BINDING_REQUIRED: Control System must link to an authoritative P3 architecture node.`);
    }

    if (!params.p4NodeId) {
      throw new Error(`DIGITAL_THREAD_UNBOUND: Control System must link to a P4 node.`);
    }

    const activeRev = this.revisionEngine.getLatestRevision(params.p3ArchitectureId);
    const revisionId = params.revisionId || activeRev?.revisionId || `REV-CTRL-${params.id}`;

    // Official P4 Digital Thread Registration (Idempotent for P8 reconstruction)
    if (!this.digitalThread.getNode(params.p4NodeId)) {
      this.digitalThread.registerNode({
        nodeId: params.p4NodeId,
        nodeType: 'SystemModel',
        canonicalId: params.id,
        authoritySource: 'P1_SYSTEM_MODEL_AUTHORITY',
        displayName: params.displayName,
        configurationId: params.configurationId,
        revisionId: revisionId,
        metadata: {
          p3Binding: params.p3ArchitectureId,
          controlSystemId: params.systemId
        }
      });
    }

    const archNode = this.digitalThread.getNodeByCanonicalId(params.p3ArchitectureId);
    if (archNode) {
      const edgeId = `thread:edge:IMPLEMENTED_BY:${archNode.nodeId}->${params.p4NodeId}`;
      if (!this.digitalThread.getEdge(edgeId)) {
        this.digitalThread.registerEdge({
          edgeId,
          edgeType: 'IMPLEMENTED_BY',
          sourceNodeId: archNode.nodeId,
          targetNodeId: params.p4NodeId,
          authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
          configurationId: params.configurationId
        });
      }
    }

    const system: ControlSystem = {
      id: params.id,
      type: 'ControlSystem',
      systemId: params.systemId,
      displayName: params.displayName,
      p3ArchitectureId: params.p3ArchitectureId,
      p4NodeId: params.p4NodeId,
      p5StructuralContextId: params.p5StructuralContextId,
      p6ThermalContextId: params.p6ThermalContextId,
      p7PowerContextId: params.p7PowerContextId,
      configurationId: params.configurationId,
      revisionId,
      authorityState: params.authorityState || 'DECLARED',
      lifecycleState: params.lifecycleState || 'DRAFT',
      provenance: params.provenance || {
        originHash: createHash('sha256').update(params.id + revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: [],
      isPublished: false
    };

    this.systems.set(params.id, system);
    return system;
  }

  public updateSystem(id: string, params: Partial<ControlSystem>): ControlSystem {
    const system = this.systems.get(id);
    if (!system) throw new Error(`SYSTEM_NOT_FOUND: '${id}'`);

    const oldRevisionId = system.revisionId;
    const oldConfigId = system.configurationId;
    const oldP5 = system.p5StructuralContextId;
    const oldP6 = system.p6ThermalContextId;
    const oldP7 = system.p7PowerContextId;
    
    Object.assign(system, params);
    system.provenance.updatedAt = new Date().toISOString();

    const changed = 
      (params.revisionId && params.revisionId !== oldRevisionId) ||
      (params.configurationId && params.configurationId !== oldConfigId) ||
      (params.p5StructuralContextId && params.p5StructuralContextId !== oldP5) ||
      (params.p6ThermalContextId && params.p6ThermalContextId !== oldP6) ||
      (params.p7PowerContextId && params.p7PowerContextId !== oldP7);

    if (changed) {
      if (params.revisionId && params.revisionId !== oldRevisionId) {
        // Record the new revision in the Digital Thread
        const newNodeId = `${params.p4NodeId || system.p4NodeId}:rev:${params.revisionId}`;
        this.digitalThread.registerNode({
          nodeId: newNodeId,
          nodeType: 'SystemModel',
          canonicalId: id,
          authoritySource: 'P1_SYSTEM_MODEL_AUTHORITY',
          displayName: `${system.displayName} (Revised)`,
          configurationId: system.configurationId,
          revisionId: params.revisionId,
          metadata: {
            previousRevision: oldRevisionId,
            p3Binding: system.p3ArchitectureId
          }
        });

        this.digitalThread.registerEdge({
          edgeType: 'REVISED_BY',
          sourceNodeId: system.p4NodeId,
          targetNodeId: newNodeId,
          authoritySource: 'SECP_CORE_REVISION_AUTHORITY',
          configurationId: system.configurationId
        });

        // Update the active node reference
        system.p4NodeId = newNodeId;
      }

      this.invalidateResults({
        controlSystemId: id,
        reason: `System state/dependency changed (Revision: ${oldRevisionId}->${system.revisionId}, Config: ${oldConfigId}->${system.configurationId}, P5: ${oldP5}->${system.p5StructuralContextId})`
      });
    }

    return system;
  }

  // --- 2. Controlled Plant Registration ---
  public registerPlant(params: {
    id: string;
    systemId: string;
    controlSystemId: string;
    canonicalArchitectureId: string;
    plantModelType: PlantModelType;
    p5StructuralId?: string;
    stateVariables: any[];
    controlInputs: any[];
    measurements: any[];
    parameters: Record<string, number>;
    configurationId: string;
    revisionId: string;
  }): ControlledPlant {
    if (this.plants.has(params.id)) throw new Error(`PLANT_COLLISION: '${params.id}' exists.`);
    
    if (!params.id || params.id.startsWith('FORGED') || params.id.includes('FAKE')) {
      throw new Error(`FORGED_PLANT_IDENTITY: Plant ID '${params.id}' is invalid.`);
    }

    const controlSystem = this.systems.get(params.controlSystemId);
    if (!controlSystem) throw new Error(`ORPHAN_PLANT: Control system '${params.controlSystemId}' not found.`);

    const plant: ControlledPlant = {
      id: params.id,
      type: 'ControlledPlant',
      systemId: params.systemId,
      controlSystemId: params.controlSystemId,
      canonicalArchitectureId: params.canonicalArchitectureId,
      plantModelType: params.plantModelType,
      p5StructuralId: params.p5StructuralId,
      stateVariables: params.stateVariables,
      controlInputs: params.controlInputs,
      measurements: params.measurements,
      parameters: params.parameters,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };

    this.plants.set(params.id, plant);
    return plant;
  }

  public updatePlant(id: string, params: Partial<ControlledPlant>): ControlledPlant {
    const plant = this.plants.get(id);
    if (!plant) throw new Error(`PLANT_NOT_FOUND: '${id}'`);

    const oldRev = plant.revisionId;
    const oldP5 = plant.p5StructuralId;
    
    Object.assign(plant, params);
    plant.provenance.updatedAt = new Date().toISOString();

    if ((params.revisionId && params.revisionId !== oldRev) || (params.p5StructuralId && params.p5StructuralId !== oldP5)) {
      this.invalidateResults({
        controlSystemId: plant.controlSystemId,
        reason: `Plant dependency changed (Revision: ${oldRev}->${plant.revisionId}, P5: ${oldP5}->${plant.p5StructuralId})`
      });
    }

    return plant;
  }

  // --- 3. Control Loop Registration ---
  public registerLoop(params: {
    id: string;
    systemId: string;
    controlSystemId: string;
    loopName: string;
    controllerId: string;
    plantId: string;
    feedbackPaths: any[];
    feedforwardPaths: any[];
    executionRateHz: number;
    targetOperatingMode: ControlMode;
    configurationId: string;
    revisionId: string;
  }): ControlLoop {
    const loop: ControlLoop = {
      id: params.id,
      type: 'ControlLoop',
      systemId: params.systemId,
      controlSystemId: params.controlSystemId,
      loopName: params.loopName,
      controllerId: params.controllerId,
      plantId: params.plantId,
      feedbackPaths: params.feedbackPaths,
      feedforwardPaths: params.feedforwardPaths,
      executionRateHz: params.executionRateHz,
      targetOperatingMode: params.targetOperatingMode,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };
    this.loops.set(params.id, loop);
    return loop;
  }

  public updateLoop(id: string, params: Partial<ControlLoop>): ControlLoop {
    const loop = this.loops.get(id);
    if (!loop) throw new Error(`LOOP_NOT_FOUND: '${id}'`);

    const oldRev = loop.revisionId;
    Object.assign(loop, params);
    loop.provenance.updatedAt = new Date().toISOString();

    if (params.revisionId && params.revisionId !== oldRev) {
      this.invalidateResults({
        loopId: id,
        reason: `Loop revision changed from ${oldRev} to ${loop.revisionId}`
      });
    }

    return loop;
  }

  // --- 4. Controller Registration ---
  public registerController(params: {
    id: string;
    systemId: string;
    controlSystemId: string;
    canonicalArchitectureId: string;
    supportedModes: ControlMode[];
    activeMode: ControlMode;
    mbseStateId?: string;
    samplingRateHz: number;
    configurationId: string;
    revisionId: string;
  }): Controller {
    if (params.mbseStateId) {
      const state = this.behavioralEngine.getState(params.mbseStateId);
      if (!state) {
        throw new Error(`BEHAVIORAL_STATE_NOT_FOUND: Controller refers to unknown MBSE state '${params.mbseStateId}'`);
      }
    }

    const controller: Controller = {
      id: params.id,
      type: 'Controller',
      systemId: params.systemId,
      controlSystemId: params.controlSystemId,
      canonicalArchitectureId: params.canonicalArchitectureId,
      supportedModes: params.supportedModes,
      activeMode: params.activeMode,
      mbseStateId: params.mbseStateId,
      laws: [],
      samplingRateHz: params.samplingRateHz,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };
    this.controllers.set(params.id, controller);
    return controller;
  }

  public updateController(id: string, params: Partial<Controller>): Controller {
    const controller = this.controllers.get(id);
    if (!controller) throw new Error(`CONTROLLER_NOT_FOUND: '${id}'`);

    const oldRev = controller.revisionId;
    Object.assign(controller, params);
    controller.provenance.updatedAt = new Date().toISOString();

    if (params.revisionId && params.revisionId !== oldRev) {
      this.invalidateResults({
        controlSystemId: controller.controlSystemId,
        reason: `Controller revision changed from ${oldRev} to ${controller.revisionId}`
      });
    }

    return controller;
  }

  // --- 5. Control Law Registration ---
  public registerLaw(params: {
    id: string;
    systemId: string;
    controllerId: string;
    lawType: ControlLawType;
    parameters: any[];
    constraints: any[];
    configurationId: string;
    revisionId: string;
  }): ControlLaw {
    const law: ControlLaw = {
      id: params.id,
      type: 'ControlLaw',
      systemId: params.systemId,
      controllerId: params.controllerId,
      lawType: params.lawType,
      parameters: params.parameters,
      constraints: params.constraints,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      authorityState: 'CORE_BOUND',
      lifecycleState: 'DRAFT',
      provenance: {
        originHash: createHash('sha256').update(params.id + params.revisionId).digest('hex'),
        createdBy: 'SECP_CORE_SYSTEM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'UNVERIFIED',
      evidenceReferences: []
    };
    this.laws.set(params.id, law);
    
    const controller = this.controllers.get(params.controllerId);
    if (controller) {
      controller.laws.push(law);
    }

    return law;
  }

  public updateLaw(id: string, params: Partial<ControlLaw>): ControlLaw {
    const law = this.laws.get(id);
    if (!law) throw new Error(`LAW_NOT_FOUND: '${id}'`);

    const oldRev = law.revisionId;
    Object.assign(law, params);
    law.provenance.updatedAt = new Date().toISOString();

    if (params.revisionId && params.revisionId !== oldRev) {
      const controller = this.controllers.get(law.controllerId);
      this.invalidateResults({
        controlSystemId: controller?.controlSystemId,
        reason: `Control Law revision changed from ${oldRev} to ${law.revisionId}`
      });
    }

    return law;
  }

  // --- 6. Execution Registration ---
  public registerExecution(execution: ControlExecution): void {
    this.executions.set(execution.id, execution);
  }

  public registerResult(result: ControlExecutionResult): void {
    this.results.set(result.id, result);
  }

  public registerVerification(intent: ControlVerificationIntent): void {
    this.verifications.set(intent.id, intent);
  }

  public registerEvidence(evidence: ControlEvidence): void {
    this.evidences.set(evidence.id, evidence);
  }

  /**
   * Reactive Invalidation: Marks all results related to a system or component as INVALIDATED
   * when a change is detected.
   */
  public invalidateResults(params: {
    controlSystemId?: string;
    loopId?: string;
    reason: string;
  }): number {
    let invalidatedCount = 0;

    for (const ex of this.executions.values()) {
      if (
        (params.controlSystemId && ex.controlSystemId === params.controlSystemId) ||
        (params.loopId && ex.loopId === params.loopId)
      ) {
        if (ex.status !== 'INVALIDATED') {
          ex.status = 'INVALIDATED';
          invalidatedCount++;

          // Also invalidate associated results
          for (const res of this.results.values()) {
            if (res.executionId === ex.id) {
              res.verificationStatus = 'UNVERIFIED';
            }
          }
        }
      }
    }
    return invalidatedCount;
  }

  /**
   * Consumes canonical revision impact analysis from SECP RevisionEngine and RevisionImpactAnalyzer.
   * Identifies any P8 control systems or executions affected by a change in canonical revision
   * and transitions affected execution records to INVALIDATED.
   */
  public evaluateCanonicalRevisionImpact(changedRevisionId: string): {
    impactedItems: any[];
    invalidatedExecutionsCount: number;
  } {
    const impactList = this.revisionEngine.getImpact(changedRevisionId);
    let invalidatedExecutionsCount = 0;

    for (const item of impactList) {
      // Find matching systems or components by entityId, systemId, or revisionCode
      const matchingSystems = Array.from(this.systems.values()).filter(
        s => s.id === item.entityId || s.systemId === item.entityId || s.p3ArchitectureId === item.entityId || s.revisionId === item.revisionCode
      );

      for (const sys of matchingSystems) {
        invalidatedExecutionsCount += this.invalidateResults({
          controlSystemId: sys.id,
          reason: `Canonical Revision Impact (${item.entityId}): ${item.reason} [${item.severity}]`
        });
      }

      // Direct execution invalidation for executions tied to impacted revisions or entities
      for (const ex of this.executions.values()) {
        if (ex.revisionId === item.revisionCode || ex.systemId === item.entityId) {
          if (ex.status !== 'INVALIDATED') {
            ex.status = 'INVALIDATED';
            invalidatedExecutionsCount++;
          }
        }
      }
    }

    return {
      impactedItems: impactList,
      invalidatedExecutionsCount
    };
  }

  // --- Persistence Support ---
  public clear(): void {
    this.systems.clear();
    this.plants.clear();
    this.loops.clear();
    this.controllers.clear();
    this.laws.clear();
    this.executions.clear();
    this.results.clear();
    this.verifications.clear();
    this.evidences.clear();
  }

  // --- Getters ---
  public getSystem(id: string) { return this.systems.get(id); }
  public getPlant(id: string) { return this.plants.get(id); }
  public getLoop(id: string) { return this.loops.get(id); }
  public getController(id: string) { return this.controllers.get(id); }
  public getLaw(id: string) { return this.laws.get(id); }
  public getExecution(id: string) { return this.executions.get(id); }
  public getResult(id: string) { return this.results.get(id); }
  public getVerification(id: string) { return this.verifications.get(id); }
  public getEvidence(id: string) { return this.evidences.get(id); }

  public getAllSystems() { return Array.from(this.systems.values()); }
  public getAllPlants() { return Array.from(this.plants.values()); }
  public getAllLoops() { return Array.from(this.loops.values()); }
  public getAllControllers() { return Array.from(this.controllers.values()); }
  public getAllLaws() { return Array.from(this.laws.values()); }
  public getAllExecutions() { return Array.from(this.executions.values()); }
  public getAllResults() { return Array.from(this.results.values()); }
  public getAllVerifications() { return Array.from(this.verifications.values()); }
  public getAllEvidences() { return Array.from(this.evidences.values()); }
}
