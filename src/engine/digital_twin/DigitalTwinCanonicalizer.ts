import * as crypto from 'crypto';
import { TwinState, UnifiedDigitalTwin, TwinEvent, DigitalTwinSnapshot } from './types';

export class DigitalTwinCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => DigitalTwinCanonicalizer.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const keyValues = keys.map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return `${JSON.stringify(key)}:${DigitalTwinCanonicalizer.canonicalize(val)}`;
    }).filter(kv => kv !== null);

    return '{' + keyValues.join(',') + '}';
  }

  public static computeTwinIdentityHash(twin: Partial<UnifiedDigitalTwin>): string {
    const payload = {
      twinType: twin.twinType,
      subjectId: twin.subjectId,
      subjectType: twin.subjectType,
      productId: twin.productId,
      revisionId: twin.revisionId,
      variantId: twin.variantId,
      configurationId: twin.configurationId,
      instanceId: twin.instanceId || null,
      version: twin.version
    };
    return DigitalTwinCanonicalizer.sha256(DigitalTwinCanonicalizer.canonicalize(payload));
  }

  public static computeStateHash(state: Partial<TwinState>): string {
    const payload = {
      layer: state.layer,
      geometry: state.geometryState ? {
        geometryId: state.geometryState.geometryId,
        geometryRevision: state.geometryState.geometryRevision,
        topologyHash: state.geometryState.topologyHash,
        geometryHash: state.geometryState.geometryHash,
        brep: state.geometryState.brep || null
      } : null,
      material: state.materialState ? {
        materialId: state.materialState.materialId,
        materialRevision: state.materialState.materialRevision,
        materialBatch: state.materialState.materialBatch,
        materialState: state.materialState.materialState
      } : null,
      assembly: state.assemblyState ? {
        assemblyId: state.assemblyState.assemblyId,
        assemblyRevision: state.assemblyState.assemblyRevision,
        assemblyHash: state.assemblyState.assemblyHash,
        components: [...state.assemblyState.components].sort()
      } : null,
      bom: state.bomState ? {
        bomId: state.bomState.bomId,
        BOMRevision: state.bomState.BOMRevision,
        BOMHash: state.bomState.BOMHash,
        componentSet: [...state.bomState.componentSet].sort((a, b) => a.partNumber.localeCompare(b.partNumber))
      } : null,
      configuration: state.configurationState ? {
        configurationId: state.configurationState.configurationId,
        configurationHash: state.configurationState.configurationHash
      } : null,
      variant: state.variantState ? {
        variantId: state.variantState.variantId,
        variantHash: state.variantState.variantHash
      } : null,
      physics: state.physicsState ? {
        domain: state.physicsState.physicsDomain,
        solver: state.physicsState.solver,
        inputHash: state.physicsState.inputHash,
        resultHash: state.physicsState.resultHash || null
      } : null,
      manufacturing: state.manufacturingState ? {
        orderId: state.manufacturingState.manufacturingOrderId,
        machineId: state.manufacturingState.machineId,
        toolpathHash: state.manufacturingState.toolpathHash,
        gcodeHash: state.manufacturingState.gcodeHash
      } : null,
      field: state.fieldState ? {
        installedConfig: state.fieldState.installedConfigurationId,
        currentConfig: state.fieldState.currentConfigurationId,
        deviations: state.fieldState.deviations
      } : null,
      evidenceReferences: [...(state.evidenceReferences || [])].sort()
    };
    return DigitalTwinCanonicalizer.sha256(DigitalTwinCanonicalizer.canonicalize(payload));
  }

  public static computeEventHash(event: Partial<TwinEvent>): string {
    const payload = {
      twinId: event.twinId,
      eventType: event.eventType,
      previousStateHash: event.previousStateHash,
      newStateHash: event.newStateHash,
      timestamp: event.timestamp,
      source: event.source,
      actor: event.actor,
      evidenceId: event.evidenceId
    };
    return DigitalTwinCanonicalizer.sha256(DigitalTwinCanonicalizer.canonicalize(payload));
  }

  public static computeSnapshot(twinId: string, timestamp: string, state: TwinState): DigitalTwinSnapshot {
    const geometryHash = state.geometryState?.geometryHash || '0'.repeat(64);
    const materialHash = state.materialState ? DigitalTwinCanonicalizer.sha256(DigitalTwinCanonicalizer.canonicalize(state.materialState)) : '0'.repeat(64);
    const BOMHash = state.bomState?.BOMHash || '0'.repeat(64);
    const assemblyHash = state.assemblyState?.assemblyHash || '0'.repeat(64);
    const revisionHash = state.geometryState?.geometryRevision ? DigitalTwinCanonicalizer.sha256(state.geometryState.geometryRevision) : '0'.repeat(64);
    const variantHash = state.variantState?.variantHash || '0'.repeat(64);
    const configurationHash = state.configurationState?.configurationHash || '0'.repeat(64);
    const physicsHash = state.physicsState?.resultHash || (state.physicsState?.inputHash ? DigitalTwinCanonicalizer.sha256(state.physicsState.inputHash) : '0'.repeat(64));
    const manufacturingHash = state.manufacturingState?.gcodeHash || '0'.repeat(64);
    const fieldHash = state.fieldState ? DigitalTwinCanonicalizer.sha256(DigitalTwinCanonicalizer.canonicalize(state.fieldState.deviations)) : '0'.repeat(64);
    const evidenceHash = state.evidenceReferences && state.evidenceReferences.length > 0 
      ? DigitalTwinCanonicalizer.sha256([...state.evidenceReferences].sort().join('|')) 
      : '0'.repeat(64);

    const hashes = [
      geometryHash,
      materialHash,
      BOMHash,
      assemblyHash,
      revisionHash,
      variantHash,
      configurationHash,
      physicsHash,
      manufacturingHash,
      fieldHash,
      evidenceHash
    ];

    const twinRootHash = DigitalTwinCanonicalizer.sha256(hashes.join('|'));

    return {
      twinId,
      timestamp,
      geometryHash,
      materialHash,
      BOMHash,
      assemblyHash,
      revisionHash,
      variantHash,
      configurationHash,
      physicsHash,
      manufacturingHash,
      fieldHash,
      evidenceHash,
      twinRootHash
    };
  }
}
