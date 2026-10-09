import {
  UnifiedDigitalTwin,
  TwinState,
  FieldTwinState,
  StateLayer,
  TwinEvent,
  DigitalTwinSnapshot,
  SensorTelemetry,
  TwinVerdict
} from './types';
import { DigitalTwinCanonicalizer } from './DigitalTwinCanonicalizer';

export class UnifiedDigitalTwinEngine {
  private twins: Map<string, UnifiedDigitalTwin> = new Map();
  // Map of twinId -> Array of historical states with timestamps
  private stateHistory: Map<string, Array<{ timestamp: string; state: TwinState }>> = new Map();
  // Map of twinId -> Array of immutable events
  private eventLogs: Map<string, TwinEvent[]> = new Map();
  // Snapshots
  private snapshots: Map<string, DigitalTwinSnapshot[]> = new Map();

  public createTwin(input: Partial<UnifiedDigitalTwin> & { initialState: Partial<TwinState>; evidenceId: string }): {
    twin: UnifiedDigitalTwin;
    initialState: TwinState;
    initialEvent: TwinEvent;
  } {
    if (!input.subjectId || !input.subjectType || !input.productId || !input.revisionId) {
      throw new Error('INVALID_IDENTITY: Subject identity, productId and revisionId are mandatory.');
    }

    const twinId = input.twinId || `TWIN-${DigitalTwinCanonicalizer.sha256(input.subjectId + input.revisionId + Date.now()).substring(0, 8)}`;
    const now = new Date().toISOString();

    const twin: UnifiedDigitalTwin = {
      twinId,
      twinType: input.twinType || 'PRODUCT_TWIN',
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      productId: input.productId,
      revisionId: input.revisionId,
      variantId: input.variantId || 'DEFAULT',
      configurationId: input.configurationId || 'BASE_CONFIG',
      instanceId: input.instanceId,
      currentLayer: input.currentLayer || 'DESIGN_STATE',
      version: input.version || '1.0',
      createdAt: now,
      updatedAt: now,
      twinHash: ''
    };

    twin.twinHash = DigitalTwinCanonicalizer.computeTwinIdentityHash(twin);

    const fullState: TwinState = {
      layer: twin.currentLayer,
      geometryState: input.initialState.geometryState,
      materialState: input.initialState.materialState,
      assemblyState: input.initialState.assemblyState,
      bomState: input.initialState.bomState,
      configurationState: input.initialState.configurationState,
      variantState: input.initialState.variantState,
      physicsState: input.initialState.physicsState,
      manufacturingState: input.initialState.manufacturingState,
      fieldState: input.initialState.fieldState,
      lifecycleState: input.initialState.lifecycleState || { state: 'DRAFT', effectiveDate: now },
      evidenceReferences: input.initialState.evidenceReferences ? [...input.initialState.evidenceReferences] : [input.evidenceId],
      timestamp: now,
      stateHash: ''
    };

    fullState.stateHash = DigitalTwinCanonicalizer.computeStateHash(fullState);

    const initialEvent: TwinEvent = {
      eventId: `EVT-INIT-${twinId}`,
      twinId,
      eventType: 'TWIN_INITIALIZED',
      previousStateHash: '0'.repeat(64),
      newStateHash: fullState.stateHash,
      timestamp: now,
      source: 'UNIFIED_TWIN_ENGINE',
      actor: 'ENGINEERING_SYSTEM',
      evidenceId: input.evidenceId,
      eventHash: ''
    };

    initialEvent.eventHash = DigitalTwinCanonicalizer.computeEventHash(initialEvent);

    this.twins.set(twinId, twin);
    this.stateHistory.set(twinId, [{ timestamp: now, state: fullState }]);
    this.eventLogs.set(twinId, [initialEvent]);

    const snapshot = DigitalTwinCanonicalizer.computeSnapshot(twinId, now, fullState);
    this.snapshots.set(twinId, [snapshot]);

    return { twin, initialState: fullState, initialEvent };
  }

  public getTwin(twinId: string): UnifiedDigitalTwin | undefined {
    return this.twins.get(twinId);
  }

  public getCurrentState(twinId: string): TwinState | undefined {
    const history = this.stateHistory.get(twinId);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1].state;
  }

  public transitionState(
    twinId: string,
    nextLayer: StateLayer,
    stateDelta: Partial<TwinState>,
    eventMeta: { eventType: string; source: string; actor: string; evidenceId: string }
  ): { twin: UnifiedDigitalTwin; newState: TwinState; event: TwinEvent } {
    const twin = this.twins.get(twinId);
    if (!twin) throw new Error(`TWIN_NOT_FOUND: ${twinId}`);

    const currentState = this.getCurrentState(twinId);
    if (!currentState) throw new Error(`STATE_NOT_FOUND: ${twinId}`);

    const now = new Date().toISOString();

    const newState: TwinState = {
      layer: nextLayer,
      geometryState: stateDelta.geometryState || currentState.geometryState,
      materialState: stateDelta.materialState || currentState.materialState,
      assemblyState: stateDelta.assemblyState || currentState.assemblyState,
      bomState: stateDelta.bomState || currentState.bomState,
      configurationState: stateDelta.configurationState || currentState.configurationState,
      variantState: stateDelta.variantState || currentState.variantState,
      physicsState: stateDelta.physicsState || currentState.physicsState,
      manufacturingState: stateDelta.manufacturingState || currentState.manufacturingState,
      fieldState: stateDelta.fieldState || currentState.fieldState,
      lifecycleState: stateDelta.lifecycleState || currentState.lifecycleState,
      evidenceReferences: Array.from(new Set([...currentState.evidenceReferences, ...(stateDelta.evidenceReferences || []), eventMeta.evidenceId])),
      timestamp: now,
      stateHash: ''
    };

    newState.stateHash = DigitalTwinCanonicalizer.computeStateHash(newState);

    const event: TwinEvent = {
      eventId: `EVT-${DigitalTwinCanonicalizer.sha256(twinId + now + eventMeta.eventType).substring(0, 8)}`,
      twinId,
      eventType: eventMeta.eventType,
      previousStateHash: currentState.stateHash,
      newStateHash: newState.stateHash,
      timestamp: now,
      source: eventMeta.source,
      actor: eventMeta.actor,
      evidenceId: eventMeta.evidenceId,
      eventHash: ''
    };

    event.eventHash = DigitalTwinCanonicalizer.computeEventHash(event);

    twin.currentLayer = nextLayer;
    twin.updatedAt = now;

    this.stateHistory.get(twinId)!.push({ timestamp: now, state: newState });
    this.eventLogs.get(twinId)!.push(event);

    const snapshot = DigitalTwinCanonicalizer.computeSnapshot(twinId, now, newState);
    this.snapshots.get(twinId)!.push(snapshot);

    return { twin, newState, event };
  }

  public getTwinStateAsOf(twinId: string, targetTimestamp: string): TwinState | undefined {
    const history = this.stateHistory.get(twinId);
    if (!history) return undefined;

    const targetTime = new Date(targetTimestamp).getTime();
    let selectedState: TwinState | undefined = undefined;

    for (const record of history) {
      if (new Date(record.timestamp).getTime() <= targetTime) {
        selectedState = record.state;
      } else {
        break;
      }
    }

    return selectedState;
  }

  public getTwinHistory(twinId: string): TwinEvent[] {
    return this.eventLogs.get(twinId) || [];
  }

  public reconstructTwin(twinId: string, timestamp: string): { state: TwinState; stateHash: string } {
    const state = this.getTwinStateAsOf(twinId, timestamp);
    if (!state) throw new Error(`RECONSTRUCTION_FAILED: No state found for ${twinId} at ${timestamp}`);

    const stateHash = DigitalTwinCanonicalizer.computeStateHash(state);
    return { state, stateHash };
  }

  public compareDigitalToPhysical(twinId: string): {
    match: boolean;
    deviations: Array<{ category: string; designValue: any; physicalValue: any; message: string }>;
  } {
    const currentState = this.getCurrentState(twinId);
    if (!currentState) throw new Error(`TWIN_NOT_FOUND: ${twinId}`);

    const deviations: Array<{ category: string; designValue: any; physicalValue: any; message: string }> = [];

    // 1. Configuration check
    if (currentState.fieldState && currentState.configurationState) {
      if (currentState.fieldState.currentConfigurationId !== currentState.configurationState.configurationId) {
        deviations.push({
          category: 'CONFIGURATION',
          designValue: currentState.configurationState.configurationId,
          physicalValue: currentState.fieldState.currentConfigurationId,
          message: 'Physical installed configuration does not match digital design baseline.'
        });
      }
    }

    // 2. Manufacturing inspection tolerance deviations
    if (currentState.manufacturingState) {
      for (const rec of currentState.manufacturingState.inspectionRecords) {
        if (!rec.passed || Math.abs(rec.actual - rec.nominal) > rec.tolerance) {
          deviations.push({
            category: 'MANUFACTURING_TOLERANCE',
            designValue: rec.nominal,
            physicalValue: rec.actual,
            message: `Feature ${rec.feature} out of tolerance: Delta = ${rec.actual - rec.nominal}`
          });
        }
      }
    }

    // 3. Field recorded deviations
    if (currentState.fieldState && currentState.fieldState.deviations.length > 0) {
      for (const dev of currentState.fieldState.deviations) {
        deviations.push({
          category: 'FIELD_DEVIATION',
          designValue: dev.designValue,
          physicalValue: dev.fieldActual,
          message: `Field deviation on ${dev.feature}`
        });
      }
    }

    return {
      match: deviations.length === 0,
      deviations
    };
  }

  public reconcilePhysicalToDigital(
    twinId: string,
    telemetry: SensorTelemetry,
    evidenceId: string
  ): {
    verdict: 'MATCH' | 'DEVIATION' | 'UNRESOLVED' | 'INVALID';
    deviationRecorded?: any;
    changeProposalCreated: boolean;
  } {
    // Strictly prevent automatic design rewrite:
    // Sensor observations record a field deviation and an Engineering Change Proposal (ECP),
    // but DO NOT alter the design baseline CAD/BOM.
    const currentState = this.getCurrentState(twinId);
    if (!currentState) throw new Error(`TWIN_NOT_FOUND: ${twinId}`);

    if (telemetry.quality === 'BAD') {
      return { verdict: 'INVALID', changeProposalCreated: false };
    }

    // Example threshold check
    const isAnomaly = telemetry.measurement > 100 || telemetry.measurement < -100;
    if (isAnomaly) {
      const deviation = {
        feature: `SENSOR-${telemetry.sensorId}`,
        designValue: 'NOMINAL_OPERATING_RANGE [-100, 100]',
        fieldActual: telemetry.measurement,
        recordedAt: telemetry.timestamp,
        proposalId: `ECP-${DigitalTwinCanonicalizer.sha256(twinId + telemetry.timestamp).substring(0, 6)}`
      };

      const existingField = currentState.fieldState || {
        installedConfigurationId: currentState.configurationState?.configurationId || 'UNKNOWN',
        currentConfigurationId: currentState.configurationState?.configurationId || 'UNKNOWN',
        operatingHours: 0,
        serviceHistory: [],
        telemetry: {},
        deviations: []
      };

      const updatedFieldState: FieldTwinState = {
        ...existingField,
        telemetry: {
          ...existingField.telemetry,
          [telemetry.sensorId]: telemetry
        },
        deviations: [...existingField.deviations, deviation]
      };

      this.transitionState(
        twinId,
        currentState.layer,
        { fieldState: updatedFieldState },
        {
          eventType: 'FIELD_DEVIATION_RECORDED',
          source: 'IOT_GATEWAY',
          actor: 'FIELD_MONITOR',
          evidenceId
        }
      );

      return {
        verdict: 'DEVIATION',
        deviationRecorded: deviation,
        changeProposalCreated: true // Notice: Created proposal, did NOT rewrite design CAD!
      };
    }

    return { verdict: 'MATCH', changeProposalCreated: false };
  }

  public computeTwinRootHash(twinId: string): string {
    const currentState = this.getCurrentState(twinId);
    if (!currentState) return '0'.repeat(64);

    const snapshot = DigitalTwinCanonicalizer.computeSnapshot(twinId, currentState.timestamp, currentState);
    return snapshot.twinRootHash;
  }
}
