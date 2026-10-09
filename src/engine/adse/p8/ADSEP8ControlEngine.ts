/**
 * SECP — ADSE-P8 Control Integration Engine (Orchestrator)
 * 
 * The primary entry point for ADSE-P8. Orchestrates Control Architecture,
 * Plant Dynamics, Execution, Verification, and Forensic Auditing.
 * 
 * Key Responsibility:
 * - Establishing the dynamic engineering truth without creating parallel state.
 */

import { ControlRegistry } from './ControlRegistry';
import { ControlArchitectureEngine } from './ControlArchitectureEngine';
import { ControlExecutionEngine } from './ControlExecutionEngine';
import { ControlPersistenceEngine } from './ControlPersistenceEngine';
import { ADSEP8ForensicAuditEngine } from './ADSEP8ForensicAuditEngine';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { DigitalThreadRegistry } from '../p4/DigitalThreadRegistry';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { MBSEBehavioralEngine } from '../p2/MBSEBehavioralEngine';
import { ADSE_P8_CAPABILITIES } from './types';

export class ADSEP8ControlEngine {
  public registry: ControlRegistry;
  public architecture: ControlArchitectureEngine;
  public execution: ControlExecutionEngine;
  public persistence: ControlPersistenceEngine;
  public forensics: ADSEP8ForensicAuditEngine;

  private behavioralEngine: MBSEBehavioralEngine;
  private digitalThread: DigitalThreadRegistry;
  private capabilityRegister: Map<string, boolean> = new Map();

  constructor(
    revisionEngine: RevisionEngine,
    behavioralEngine: MBSEBehavioralEngine,
    digitalThread: DigitalThreadRegistry
  ) {
    this.behavioralEngine = behavioralEngine;
    this.digitalThread = digitalThread;
    this.registry = new ControlRegistry(revisionEngine, behavioralEngine, digitalThread);
    this.architecture = new ControlArchitectureEngine(this.registry);
    this.execution = new ControlExecutionEngine(this.registry);
    this.persistence = new ControlPersistenceEngine(this.registry);
    this.forensics = new ADSEP8ForensicAuditEngine(this.registry);

    this.initializeCapabilityRegister();
    this.registerWithCore();
  }

  private initializeCapabilityRegister() {
    Object.values(ADSE_P8_CAPABILITIES).forEach(cap => {
      this.capabilityRegister.set(cap, true);
    });
  }

  private registerWithCore() {
    CoreExecutionAuthority.registerSolver({
      solverId: 'P8-CONTROL-DYNAMICS-SOLVER-V1',
      solverVersion: '1.0.0',
      pluginId: 'adse-p8-controls',
      executionKind: 'control-simulation',
      execute: (req, snapshot) => this.execution.solve(req, snapshot)
    });
  }

  public getCapabilityRegister() {
    return Array.from(this.capabilityRegister.entries()).map(([name, active]) => ({
      name,
      active,
      status: active ? 'AUTHORIZED' : 'DEACTIVATED'
    }));
  }

  /**
   * Binds a Control System to physical context (Structure, Thermal, Power)
   */
  public bindContext(params: {
    controlSystemId: string;
    p5StructuralContextId?: string;
    p6ThermalContextId?: string;
    p7PowerContextId?: string;
  }) {
    const system = this.registry.getSystem(params.controlSystemId);
    if (!system) throw new Error(`SYSTEM_NOT_FOUND: '${params.controlSystemId}'`);

    if (params.p5StructuralContextId) system.p5StructuralContextId = params.p5StructuralContextId;
    if (params.p6ThermalContextId) system.p6ThermalContextId = params.p6ThermalContextId;
    if (params.p7PowerContextId) system.p7PowerContextId = params.p7PowerContextId;

    system.provenance.updatedAt = new Date().toISOString();
  }

  /**
   * High-level workflow for P8 integration
   */
  public async authorizeControlSystem(params: {
    systemId: string;
    architectureId: string;
    p4NodeId: string;
    configId: string;
  }) {
    // 1. Register system
    const system = this.registry.registerSystem({
      id: `CTRL-${params.systemId}`,
      systemId: params.systemId,
      p3ArchitectureId: params.architectureId,
      p4NodeId: params.p4NodeId,
      displayName: `Control System for ${params.systemId}`,
      configurationId: params.configId,
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED'
    });

    return system;
  }

  /**
   * Consumes canonical revision impact analysis from RevisionEngine & RevisionImpactAnalyzer
   * and transitions affected execution records to INVALIDATED.
   */
  public evaluateCanonicalImpact(changedRevisionId: string) {
    return this.registry.evaluateCanonicalRevisionImpact(changedRevisionId);
  }
}
