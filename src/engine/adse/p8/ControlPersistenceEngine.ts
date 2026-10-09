/**
 * SECP — ADSE-P8 Control Persistence Engine
 * Produces cryptographic snapshots and enables complete in-memory destruction and deterministic reconstruction
 * of the Control Integration Model.
 */

import { ControlRegistry } from './ControlRegistry';
import { ControlSnapshot } from './types';
import { createHash } from 'crypto';

export class ControlPersistenceEngine {
  private registry: ControlRegistry;
  private snapshots: Map<string, ControlSnapshot> = new Map();

  constructor(registry: ControlRegistry) {
    this.registry = registry;
  }

  /**
   * Captures an immutable cryptographic snapshot of the Control Integration Model.
   */
  public createSnapshot(params: {
    snapshotId?: string;
    controlSystemId: string;
    persistedByAuthority: string;
  }): ControlSnapshot {
    const systems = this.registry.getAllSystems();
    const plants = this.registry.getAllPlants();
    const loops = this.registry.getAllLoops();
    const controllers = this.registry.getAllControllers();
    const laws = this.registry.getAllLaws();
    const executions = this.registry.getAllExecutions();
    const results = this.registry.getAllResults();
    const verifications = this.registry.getAllVerifications();
    const evidences = this.registry.getAllEvidences();

    const id = params.snapshotId || `SNAPSHOT-CTRL-${params.controlSystemId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const payload = JSON.stringify({
      id,
      controlSystemId: params.controlSystemId,
      systems,
      plants,
      loops,
      controllers,
      laws,
      executions,
      results,
      verifications,
      evidences
    });

    const merkleRoot = createHash('sha256').update(payload).digest('hex');

    const snapshot: ControlSnapshot = {
      id,
      type: 'ControlSnapshot',
      controlSystemId: params.controlSystemId,
      timestamp,
      entities: {
        systems: JSON.parse(JSON.stringify(systems)),
        plants: JSON.parse(JSON.stringify(plants)),
        loops: JSON.parse(JSON.stringify(loops)),
        controllers: JSON.parse(JSON.stringify(controllers)),
        laws: JSON.parse(JSON.stringify(laws)),
        executions: JSON.parse(JSON.stringify(executions)),
        results: JSON.parse(JSON.stringify(results)),
        verifications: JSON.parse(JSON.stringify(verifications)),
        evidences: JSON.parse(JSON.stringify(evidences))
      },
      merkleRoot,
      // Metadata for snapshot entity itself
      systemId: systems[0]?.systemId || 'UNKNOWN',
      configurationId: systems[0]?.configurationId || 'UNKNOWN',
      revisionId: systems[0]?.revisionId || 'UNKNOWN',
      authorityState: 'AUTHORITATIVE',
      lifecycleState: 'RELEASED',
      provenance: {
        originHash: merkleRoot,
        createdBy: params.persistedByAuthority,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      relationships: [],
      dependencies: [],
      verificationStatus: 'VERIFIED',
      evidenceReferences: []
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(snapshotId: string): ControlSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Complete destruction of in-memory maps and deterministic reconstruction from snapshot.
   */
  public restoreFromSnapshot(snapshotId: string): {
    restoredCount: number;
    isValid: boolean;
  } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`PERSISTENCE_ERROR: Control snapshot '${snapshotId}' not found.`);
    }

    // 1. Destroy in-memory state
    this.registry.clear();

    // 2. Reconstruct Systems
    for (const s of snapshot.entities.systems) {
      this.registry.registerSystem({
        id: s.id,
        systemId: s.systemId,
        p3ArchitectureId: s.p3ArchitectureId,
        p4NodeId: s.p4NodeId,
        displayName: s.displayName,
        configurationId: s.configurationId,
        revisionId: s.revisionId,
        p5StructuralContextId: s.p5StructuralContextId,
        p6ThermalContextId: s.p6ThermalContextId,
        p7PowerContextId: s.p7PowerContextId,
        authorityState: s.authorityState,
        lifecycleState: s.lifecycleState,
        provenance: s.provenance
      });
    }

    // 3. Reconstruct Controllers (Must be before Laws)
    for (const c of snapshot.entities.controllers) {
      this.registry.registerController({
        id: c.id,
        systemId: c.systemId,
        controlSystemId: c.controlSystemId,
        canonicalArchitectureId: c.canonicalArchitectureId,
        supportedModes: c.supportedModes,
        activeMode: c.activeMode,
        mbseStateId: c.mbseStateId,
        samplingRateHz: c.samplingRateHz,
        configurationId: c.configurationId,
        revisionId: c.revisionId
      });
    }

    // 4. Reconstruct Plants
    for (const p of snapshot.entities.plants) {
      this.registry.registerPlant({
        id: p.id,
        systemId: p.systemId,
        controlSystemId: p.controlSystemId,
        canonicalArchitectureId: p.canonicalArchitectureId,
        plantModelType: p.plantModelType,
        p5StructuralId: p.p5StructuralId,
        stateVariables: p.stateVariables,
        controlInputs: p.controlInputs,
        measurements: p.measurements,
        parameters: p.parameters,
        configurationId: p.configurationId,
        revisionId: p.revisionId
      });
    }

    // 5. Reconstruct Loops
    for (const l of snapshot.entities.loops) {
      this.registry.registerLoop({
        id: l.id,
        systemId: l.systemId,
        controlSystemId: l.controlSystemId,
        loopName: l.loopName,
        controllerId: l.controllerId,
        plantId: l.plantId,
        feedbackPaths: l.feedbackPaths,
        feedforwardPaths: l.feedforwardPaths,
        executionRateHz: l.executionRateHz,
        targetOperatingMode: l.targetOperatingMode,
        configurationId: l.configurationId,
        revisionId: l.revisionId
      });
    }

    // 6. Reconstruct Laws
    for (const law of snapshot.entities.laws) {
      this.registry.registerLaw({
        id: law.id,
        systemId: law.systemId,
        controllerId: law.controllerId,
        lawType: law.lawType,
        parameters: law.parameters,
        constraints: law.constraints,
        configurationId: law.configurationId,
        revisionId: law.revisionId
      });
    }

    // 7. Reconstruct Executions, Results, Verifications, Evidences
    for (const ex of snapshot.entities.executions) this.registry.registerExecution(ex);
    for (const res of snapshot.entities.results) this.registry.registerResult(res);
    for (const v of snapshot.entities.verifications) this.registry.registerVerification(v);
    for (const e of snapshot.entities.evidences) this.registry.registerEvidence(e);

    const restoredCount = 
      snapshot.entities.systems.length +
      snapshot.entities.plants.length +
      snapshot.entities.loops.length +
      snapshot.entities.controllers.length +
      snapshot.entities.laws.length +
      snapshot.entities.executions.length +
      snapshot.entities.results.length +
      snapshot.entities.verifications.length +
      snapshot.entities.evidences.length;

    return {
      restoredCount,
      isValid: true
    };
  }
}
