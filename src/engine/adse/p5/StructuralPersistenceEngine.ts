/**
 * SECP — ADSE-P5 Structural Persistence Engine
 * Produces cryptographic snapshots and enables complete in-memory destruction and deterministic reconstruction
 * of the Structural Integration Model.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralConstraintEngine } from './StructuralConstraintEngine';
import { StructuralPlacementEngine } from './StructuralPlacementEngine';
import { StructuralInterfaceEngine } from './StructuralInterfaceEngine';
import { StructuralSnapshot } from './types';
import { createHash } from 'crypto';

export class StructuralPersistenceEngine {
  private registry: StructuralElementRegistry;
  private constraints: StructuralConstraintEngine;
  private placements: StructuralPlacementEngine;
  private interfaces: StructuralInterfaceEngine;
  private snapshots: Map<string, StructuralSnapshot> = new Map();

  constructor(
    registry: StructuralElementRegistry,
    constraints: StructuralConstraintEngine,
    placements: StructuralPlacementEngine,
    interfaces: StructuralInterfaceEngine
  ) {
    this.registry = registry;
    this.constraints = constraints;
    this.placements = placements;
    this.interfaces = interfaces;
  }

  /**
   * Captures an immutable cryptographic snapshot of the Structural Integration Model.
   */
  public createSnapshot(params: {
    snapshotId?: string;
    configurationId: string;
    revisionId: string;
    persistedByAuthority: string;
  }): StructuralSnapshot {
    const elements = this.registry.getAllElements();
    const relationships = this.registry.getAllRelationships();
    const constraintsList = this.constraints.getAllConstraints();
    const interfacesList = this.interfaces.getAllInterfaces();
    const connectionsList = this.interfaces.getAllConnections();
    const placementsList = this.placements.getAllPlacements();

    const id = params.snapshotId || `SNAPSHOT-STRUCT-${params.configurationId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const payload = JSON.stringify({
      id,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      elements,
      relationships,
      constraints: constraintsList,
      interfaces: interfacesList,
      connections: connectionsList,
      placements: placementsList
    });

    const merkleHash = createHash('sha256').update(payload).digest('hex');
    const provenanceId = `PROV-STRUCT-SNAPSHOT-${merkleHash.substring(0, 12)}`;

    const snapshot: StructuralSnapshot = {
      snapshotId: id,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      timestamp,
      elements: JSON.parse(JSON.stringify(elements)),
      relationships: JSON.parse(JSON.stringify(relationships)),
      constraints: JSON.parse(JSON.stringify(constraintsList)),
      interfaces: JSON.parse(JSON.stringify(interfacesList)),
      connections: JSON.parse(JSON.stringify(connectionsList)),
      placements: JSON.parse(JSON.stringify(placementsList)),
      merkleHash,
      provenanceId,
      persistedByAuthority: params.persistedByAuthority
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  public getSnapshot(snapshotId: string): StructuralSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  public getAllSnapshots(): StructuralSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Complete destruction of in-memory maps and deterministic reconstruction from snapshot.
   */
  public restoreFromSnapshot(snapshotId: string): {
    restoredElementsCount: number;
    restoredRelationshipsCount: number;
    restoredConstraintsCount: number;
    restoredInterfacesCount: number;
    restoredConnectionsCount: number;
    restoredPlacementsCount: number;
    isValid: boolean;
  } {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`PERSISTENCE_ERROR: Structural snapshot '${snapshotId}' not found.`);
    }

    // 1. Destroy in-memory state
    this.registry.clear();
    this.constraints.clear();
    this.placements.clear();
    this.interfaces.clear();

    // 2. Reconstruct Definitions first, then Instances and Elements
    const definitions = snapshot.elements.filter(e => !e.elementType.endsWith('Instance'));
    const instances = snapshot.elements.filter(e => e.elementType.endsWith('Instance'));

    for (const def of definitions) {
      this.registry.registerElement({
        elementId: def.elementId,
        elementType: def.elementType,
        displayName: def.displayName,
        layer: def.layer,
        configurationId: def.configurationId,
        revisionId: def.revisionId,
        engineeringObjectId: def.engineeringObjectId,
        p3ArchId: def.p3ArchId,
        p2MbseId: def.p2MbseId,
        p1ReqId: def.p1ReqId,
        p4NodeId: def.p4NodeId,
        metadata: def.metadata
      });
    }

    for (const inst of instances) {
      this.registry.registerElement({
        elementId: inst.elementId,
        elementType: inst.elementType,
        displayName: inst.displayName,
        layer: inst.layer,
        configurationId: inst.configurationId,
        revisionId: inst.revisionId,
        definitionId: inst.definitionId,
        engineeringObjectId: inst.engineeringObjectId,
        p3ArchId: inst.p3ArchId,
        p2MbseId: inst.p2MbseId,
        p1ReqId: inst.p1ReqId,
        p4NodeId: inst.p4NodeId,
        metadata: inst.metadata
      });
    }

    // 3. Reconstruct Relationships
    for (const rel of snapshot.relationships) {
      this.registry.addRelationship({
        relationshipId: rel.relationshipId,
        relationshipType: rel.relationshipType,
        sourceElementId: rel.sourceElementId,
        targetElementId: rel.targetElementId,
        configurationId: rel.configurationId,
        revisionId: rel.revisionId,
        metadata: rel.metadata
      });
    }

    // 4. Reconstruct Interfaces
    for (const iface of snapshot.interfaces) {
      this.interfaces.defineStructuralInterface({
        interfaceId: iface.interfaceId,
        displayName: iface.displayName,
        p3InterfaceId: iface.p3InterfaceId,
        providerElementId: iface.providerElementId,
        consumerElementId: iface.consumerElementId,
        requiredInterfaceType: iface.requiredInterfaceType,
        providedInterfaceType: iface.providedInterfaceType,
        configurationId: iface.configurationId,
        revisionId: iface.revisionId
      });
    }

    // 5. Reconstruct Connections
    for (const conn of snapshot.connections) {
      this.interfaces.createPhysicalConnection({
        connectionId: conn.connectionId,
        displayName: conn.displayName,
        structuralInterfaceId: conn.structuralInterfaceId,
        sourcePartId: conn.sourcePartId,
        targetPartId: conn.targetPartId,
        connectionMethod: conn.connectionMethod,
        configurationId: conn.configurationId,
        revisionId: conn.revisionId,
        verifiedByIntentId: conn.verifiedByIntentId,
        evidenceId: conn.evidenceId
      });
    }

    // 6. Reconstruct Constraints
    for (const c of snapshot.constraints) {
      this.constraints.registerConstraint({
        constraintId: c.constraintId,
        constraintType: c.constraintType,
        displayName: c.displayName,
        sourceElementId: c.sourceElementId,
        targetElementId: c.targetElementId,
        parameters: c.parameters,
        configurationId: c.configurationId,
        revisionId: c.revisionId,
        verifiedByIntentId: c.verifiedByIntentId
      });
    }

    // 7. Reconstruct Placements
    for (const p of snapshot.placements) {
      this.placements.setPlacement({
        instanceId: p.instanceId,
        translation: p.transform.translation,
        rotation: p.transform.rotation,
        coordinateFrame: p.transform.coordinateFrame,
        referenceFrameId: p.referenceFrameId,
        configurationId: p.configurationId,
        revisionId: p.revisionId,
        isCanonical: p.transform.isCanonical
      });
    }

    return {
      restoredElementsCount: snapshot.elements.length,
      restoredRelationshipsCount: snapshot.relationships.length,
      restoredConstraintsCount: snapshot.constraints.length,
      restoredInterfacesCount: snapshot.interfaces.length,
      restoredConnectionsCount: snapshot.connections.length,
      restoredPlacementsCount: snapshot.placements.length,
      isValid: true
    };
  }
}
