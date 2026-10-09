/**
 * SECP — ADSE-P5 Structural Interface & Physical Connection Engine
 * Maps P3 Architectural Interfaces to physical Structural Connections between components/parts.
 * Detects interface-without-connection, connection-without-interface, and contract mismatches.
 */

import { StructuralElementRegistry } from './StructuralElementRegistry';
import { StructuralInterface, StructuralConnection } from './types';
import { createHash } from 'crypto';

export class StructuralInterfaceEngine {
  private registry: StructuralElementRegistry;
  private interfaces: Map<string, StructuralInterface> = new Map();
  private connections: Map<string, StructuralConnection> = new Map();

  constructor(registry: StructuralElementRegistry) {
    this.registry = registry;
  }

  public defineStructuralInterface(params: {
    interfaceId?: string;
    displayName: string;
    p3InterfaceId?: string;
    providerElementId: string;
    consumerElementId: string;
    requiredInterfaceType: string;
    providedInterfaceType: string;
    configurationId: string;
    revisionId?: string;
  }): StructuralInterface {
    const provider = this.registry.getElement(params.providerElementId);
    const consumer = this.registry.getElement(params.consumerElementId);

    if (!provider) {
      throw new Error(`STRUCTURAL_INTERFACE_ERROR: Provider element '${params.providerElementId}' not found.`);
    }
    if (!consumer) {
      throw new Error(`STRUCTURAL_INTERFACE_ERROR: Consumer element '${params.consumerElementId}' not found.`);
    }

    const id = params.interfaceId || `IF-STRUCT-${params.providerElementId}->${params.consumerElementId}`;
    if (this.interfaces.has(id)) {
      throw new Error(`STRUCTURAL_INTERFACE_ERROR: Structural interface '${id}' already exists.`);
    }

    const isCompatible = params.requiredInterfaceType === params.providedInterfaceType;
    const revisionId = params.revisionId || provider.revisionId;
    const provenanceId = `PROV-STRUCT-IF-${createHash('sha256').update(id + revisionId).digest('hex').substring(0, 12)}`;

    const iface: StructuralInterface = {
      interfaceId: id,
      displayName: params.displayName,
      p3InterfaceId: params.p3InterfaceId,
      providerElementId: params.providerElementId,
      consumerElementId: params.consumerElementId,
      requiredInterfaceType: params.requiredInterfaceType,
      providedInterfaceType: params.providedInterfaceType,
      isConnected: false,
      configurationId: params.configurationId,
      revisionId,
      provenanceId,
      isCompatible
    };

    this.interfaces.set(id, iface);
    return iface;
  }

  public createPhysicalConnection(params: {
    connectionId?: string;
    displayName: string;
    structuralInterfaceId: string;
    sourcePartId: string;
    targetPartId: string;
    connectionMethod: string;
    configurationId: string;
    revisionId?: string;
    verifiedByIntentId?: string;
    evidenceId?: string;
  }): StructuralConnection {
    const iface = this.interfaces.get(params.structuralInterfaceId);
    if (!iface) {
      throw new Error(`CONNECTION_ERROR: Referenced structural interface '${params.structuralInterfaceId}' not found.`);
    }

    const sourcePart = this.registry.getElement(params.sourcePartId);
    const targetPart = this.registry.getElement(params.targetPartId);

    if (!sourcePart) {
      throw new Error(`CONNECTION_ERROR: Source part '${params.sourcePartId}' not found.`);
    }
    if (!targetPart) {
      throw new Error(`CONNECTION_ERROR: Target part '${params.targetPartId}' not found.`);
    }

    const connId = params.connectionId || `CONN-STRUCT-${params.sourcePartId}->${params.targetPartId}`;
    if (this.connections.has(connId)) {
      throw new Error(`CONNECTION_ERROR: Connection '${connId}' already exists.`);
    }

    const revisionId = params.revisionId || sourcePart.revisionId;
    const provenanceId = `PROV-CONN-${createHash('sha256').update(connId + revisionId).digest('hex').substring(0, 12)}`;

    const conn: StructuralConnection = {
      connectionId: connId,
      displayName: params.displayName,
      structuralInterfaceId: params.structuralInterfaceId,
      sourcePartId: params.sourcePartId,
      targetPartId: params.targetPartId,
      connectionMethod: params.connectionMethod,
      configurationId: params.configurationId,
      revisionId,
      provenanceId,
      verifiedByIntentId: params.verifiedByIntentId,
      evidenceId: params.evidenceId
    };

    iface.isConnected = true;
    iface.connectionId = connId;

    this.connections.set(connId, conn);
    return conn;
  }

  public getInterface(interfaceId: string): StructuralInterface | undefined {
    return this.interfaces.get(interfaceId);
  }

  public getAllInterfaces(): StructuralInterface[] {
    return Array.from(this.interfaces.values());
  }

  public getConnection(connectionId: string): StructuralConnection | undefined {
    return this.connections.get(connectionId);
  }

  public getAllConnections(): StructuralConnection[] {
    return Array.from(this.connections.values());
  }

  public clear(): void {
    this.interfaces.clear();
    this.connections.clear();
  }
}
