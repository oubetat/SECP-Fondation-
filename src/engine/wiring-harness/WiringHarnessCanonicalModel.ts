/**
 * SECP Wiring Harness Canonical Model (Phase 3)
 * Source of truth for wiring harnesses, cables, wires, connectors, terminals,
 * branches, junctions, sleeves, clamps, mounting points, and 3D routes.
 */

export interface Vector3d {
  x: number;
  y: number;
  z: number;
}

export interface ConnectorPin {
  pinNumber: number;
  pinName: string;
  isAssigned: boolean;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  pinCount: number;
  pins: ConnectorPin[];
  position3d: Vector3d;
}

export interface TerminalDefinition {
  id: string;
  name: string;
  connectorId: string;
  pinNumber: number;
  compatibleWireGauge: string; // e.g. "AWG 20"
  status: 'CONNECTED' | 'UNCONNECTED' | 'FAULT';
}

export interface WireDefinition {
  id: string;
  name: string;
  sourceTerminalId: string;
  targetTerminalId: string;
  cableId?: string;
  gaugeAwg: string;
  color: string;
  lengthMm: number;
}

export interface CableDefinition {
  id: string;
  name: string;
  wireIds: string[];
  diameterMm: number;
  minBendRadiusMm: number;
  insulationMaterial: string;
}

export interface ConnectionPointDefinition {
  id: string;
  name: string;
  entityId: string;
  entityType: 'CONNECTOR' | 'JUNCTION' | 'MOUNTING_POINT';
  position3d: Vector3d;
}

export interface BranchDefinition {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  lengthMm: number;
  wireIds: string[];
}

export interface JunctionDefinition {
  id: string;
  name: string;
  position3d: Vector3d;
  connectedBranchIds: string[];
}

export interface SleeveDefinition {
  id: string;
  name: string;
  startBranchId: string;
  endBranchId: string;
  material: string;
  diameterMm: number;
}

export interface ClampDefinition {
  id: string;
  name: string;
  position3d: Vector3d;
  fixingPointId: string;
  clampedBranchId: string;
}

export interface MountingPointDefinition {
  id: string;
  name: string;
  position3d: Vector3d;
  targetStructureId: string;
}

export interface RouteWaypoint {
  x: number;
  y: number;
  z: number;
}

export interface RouteDefinition {
  id: string;
  name: string;
  waypoints: RouteWaypoint[];
  branchIds: string[];
}

export interface WiringHarnessCanonicalModel {
  version: string;
  harnessId: string;
  name: string;
  connectors: ConnectorDefinition[];
  terminals: TerminalDefinition[];
  wires: WireDefinition[];
  cables: CableDefinition[];
  connectionPoints: ConnectionPointDefinition[];
  branches: BranchDefinition[];
  junctions: JunctionDefinition[];
  sleeves: SleeveDefinition[];
  clamps: ClampDefinition[];
  mountingPoints: MountingPointDefinition[];
  routes: RouteDefinition[];
}

export class WiringHarnessCanonicalModelValidator {
  public static validate(model: WiringHarnessCanonicalModel): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!model.harnessId) errors.harnessId = 'Harness ID is required';
    if (!model.version) errors.push('Model version is required');
    if (!Array.isArray(model.connectors)) errors.push('Connectors array is required');
    if (!Array.isArray(model.wires)) errors.push('Wires array is required');
    if (!Array.isArray(model.branches)) errors.push('Branches array is required');

    // Check terminal existence for wires
    for (const wire of model.wires) {
      const srcTerm = model.terminals.find(t => t.id === wire.sourceTerminalId);
      const tgtTerm = model.terminals.find(t => t.id === wire.targetTerminalId);
      if (!srcTerm) {
        errors.push(`Wire ${wire.id} references non-existent source terminal ${wire.sourceTerminalId}`);
      }
      if (!tgtTerm) {
        errors.push(`Wire ${wire.id} references non-existent target terminal ${wire.targetTerminalId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
