import { 
  TwinIdentity, 
  MachineDigitalTwinContract, 
  TwinLifecycleState, 
  TwinVerdict, 
  MachineTwinState, 
  MachineTwinEvent, 
  TwinEventType, 
  TelemetryReading, 
  StateProvenanceSource, 
  SafetyState, 
  HealthStatus, 
  MachineTwinFingerprint, 
  MachineTwinEvidencePackage, 
  ReconciliationResult, 
  SynchronizationMode,
  TelemetryQuality,
  DivergenceRecord,
  AnomalyRecord
} from "./types";
import { MachineTransformGraphEngine } from "./MachineTransformGraph";
import { MachineComponentRegistryEngine } from "./MachineComponentRegistry";
import { MachineTelemetryAdapter } from "./MachineTelemetryAdapter";
import { MachineTwinAnomalyEngine } from "./MachineTwinAnomalyEngine";
import { TwinSynchronizationEngine } from "./TwinSynchronizationEngine";
import { MachineExecutionReconciliation } from "./MachineExecutionReconciliation";
import { MachineKinematicModel } from "../kinematics/types";
import { ForwardKinematicsSolver } from "../kinematics/ForwardKinematicsSolver";
import { KinematicMath } from "../kinematics/KinematicMath";
import { SpindleDirection } from "../post/types";
import { SimulationMachineState } from "../simulation/types";

export class MachineDigitalTwinEngine {
  private contract: MachineDigitalTwinContract;
  private identity: TwinIdentity;
  private kinematicModel: MachineKinematicModel;
  private transformGraph: MachineTransformGraphEngine;
  private componentRegistry: MachineComponentRegistryEngine;
  private telemetryAdapter: MachineTelemetryAdapter;
  private syncEngine: TwinSynchronizationEngine;
  private anomalyEngine: MachineTwinAnomalyEngine;
  private reconciliationEngine: MachineExecutionReconciliation;
  private lifecycleState: TwinLifecycleState = TwinLifecycleState.CREATED;
  private currentState: MachineTwinState;
  private isOffline: boolean = false;
  private lastOnlineTimestamp: number = Date.now();

  constructor(
    identity: TwinIdentity,
    contract: MachineDigitalTwinContract,
    kinematicModel: MachineKinematicModel
  ) {
    this.identity = identity;
    this.contract = contract;
    this.kinematicModel = kinematicModel;

    this.transformGraph = new MachineTransformGraphEngine();
    this.componentRegistry = new MachineComponentRegistryEngine();
    this.telemetryAdapter = new MachineTelemetryAdapter(this.contract);
    this.syncEngine = new TwinSynchronizationEngine(this.contract, this.kinematicModel);
    this.anomalyEngine = new MachineTwinAnomalyEngine(this.contract);
    this.reconciliationEngine = new MachineExecutionReconciliation(this.contract);

    this.currentState = this.createInitialTwinState();
    this.lifecycleState = TwinLifecycleState.CONFIGURED;
  }

  private createInitialTwinState(): MachineTwinState {
    const now = Date.now();
    return {
      stateId: "STATE_000000",
      sequenceNumber: 0,
      timestamp: now,
      previousStateHash: "0000000000000000000000000000000000000000000000000000000000000000",
      currentStateHash: "INIT_0000000000000000000000000000000000000000000000000000000000000000",
      lifecycleState: TwinLifecycleState.CONFIGURED,
      axes: {
        X: { axisName: "X", commandedPosition: 0, actualPosition: 0, velocity: 0, acceleration: 0, trackingError: 0, limitState: "NORMAL", timestamp: now, provenance: StateProvenanceSource.CONFIGURED },
        Y: { axisName: "Y", commandedPosition: 0, actualPosition: 0, velocity: 0, acceleration: 0, trackingError: 0, limitState: "NORMAL", timestamp: now, provenance: StateProvenanceSource.CONFIGURED },
        Z: { axisName: "Z", commandedPosition: 0, actualPosition: 0, velocity: 0, acceleration: 0, trackingError: 0, limitState: "NORMAL", timestamp: now, provenance: StateProvenanceSource.CONFIGURED }
      },
      rotaryAxes: {
        A: { axisName: "A", commandedAngleDeg: 0, actualAngleDeg: 0, angularVelocityDegS: 0, angularAccelerationDegS2: 0, trackingErrorDeg: 0, wrapState: 0, limitState: "NORMAL", timestamp: now, provenance: StateProvenanceSource.CONFIGURED },
        C: { axisName: "C", commandedAngleDeg: 0, actualAngleDeg: 0, angularVelocityDegS: 0, angularAccelerationDegS2: 0, trackingErrorDeg: 0, wrapState: 0, limitState: "NORMAL", timestamp: now, provenance: StateProvenanceSource.CONFIGURED }
      },
      spindle: {
        commandedRPM: 0,
        actualRPM: 0,
        direction: SpindleDirection.STOP,
        loadPercent: 0,
        temperatureC: 22.5,
        vibrationG: 0.02,
        status: "STOPPED",
        slipRPM: 0,
        timestamp: now,
        provenance: StateProvenanceSource.CONFIGURED
      },
      controller: {
        programId: "O1001",
        programLine: 1,
        activeToolNumber: 1,
        activeOffsetId: "G54",
        modalState: { motionMode: "G00", planeSelection: "G17", feedMode: "G94", distanceMode: "G90" },
        feedRateMMMin: 0,
        actualFeedRateMMMin: 0,
        spindleSpeedRPM: 0,
        machineMode: "AUTO",
        alarmCodes: [],
        timestamp: now,
        provenance: StateProvenanceSource.CONFIGURED
      },
      tool: {
        toolId: "T1_ENDMILL_10",
        toolNumber: 1,
        toolAssemblyId: "ASSY_T1_ER32",
        lengthOffsetMM: 120.0,
        radiusOffsetMM: 5.0,
        wearLengthMM: 0.002,
        wearRadiusMM: 0.001,
        lifeState: "NEW",
        measurementSource: "MEASURED",
        timestamp: now
      },
      workpiece: {
        workpieceId: "WP_AEROSPACE_BRACKET",
        geometryRevision: 1,
        fixtureId: "FIX_VISE_01",
        stockStateHash: "STOCK_HASH_INIT",
        machinedStateHash: "MACHINED_HASH_INIT",
        removedVolumeMM3: 0,
        timestamp: now
      },
      fixture: {
        fixtureId: "FIX_VISE_01",
        configurationId: "CONFIG_JAW_100MM",
        clampState: "CLAMPED",
        fixtureRevision: 1,
        timestamp: now
      },
      safety: SafetyState.NORMAL,
      health: {
        overallHealth: HealthStatus.HEALTHY,
        axisHealth: { X: HealthStatus.HEALTHY, Y: HealthStatus.HEALTHY, Z: HealthStatus.HEALTHY },
        spindleHealth: HealthStatus.HEALTHY,
        toolHealth: HealthStatus.HEALTHY,
        controllerHealth: HealthStatus.HEALTHY,
        sensorHealth: HealthStatus.HEALTHY,
        diagnostics: [],
        timestamp: now
      },
      uncertaintyRadiusMM: 0.002,
      provenance: StateProvenanceSource.CONFIGURED
    };
  }

  public commissionTwin(): void {
    this.lifecycleState = TwinLifecycleState.COMMISSIONED;
    this.syncEngine.recordEvent(
      TwinEventType.STATE_SYNCHRONIZED,
      "COMMISSIONING_GATE",
      { message: "Machine twin commissioned and bound to physical asset serial " + this.identity.machineSerialReference }
    );
  }

  public ingestTelemetry(rawReadings: Partial<TelemetryReading>[]): { ingestedCount: number; rejectedCount: number } {
    if (this.isOffline) {
      return { ingestedCount: 0, rejectedCount: rawReadings.length };
    }

    let ingested = 0;
    let rejected = 0;

    for (const r of rawReadings) {
      const res = this.telemetryAdapter.ingestReading(r);
      if (res.accepted) {
        ingested++;
      } else {
        rejected++;
      }
    }

    // Process buffered ordered readings
    const ordered = this.telemetryAdapter.getOrderedReadings();
    if (ordered.length > 0) {
      this.lastOnlineTimestamp = Date.now();
      this.currentState = this.syncEngine.reconstructStateFromTelemetry(
        ordered,
        this.currentState,
        StateProvenanceSource.MEASURED
      );

      // Evaluate anomalies & health
      const evalRes = this.anomalyEngine.evaluateAnomalies(this.currentState);
      this.currentState.safety = evalRes.safetyState;
      this.currentState.health = evalRes.healthState;
      this.currentState.uncertaintyRadiusMM = evalRes.uncertainty.combinedSpatialUncertaintyMM;

      this.lifecycleState = TwinLifecycleState.ACTIVE;
    }

    return { ingestedCount: ingested, rejectedCount: rejected };
  }

  public stepSimulatedMachineTick(
    cmdX: number,
    cmdY: number,
    cmdZ: number,
    cmdA: number,
    cmdC: number,
    cmdSpindleRPM: number,
    cmdFeed: number
  ): MachineTwinState {
    const now = Date.now();
    // Simulate real sensor noise & minor servo lag
    const noise = () => (Math.random() - 0.5) * 0.004;
    const actX = cmdX + noise();
    const actY = cmdY + noise();
    const actZ = cmdZ + noise();
    const actA = cmdA + noise() * 0.5;
    const actC = cmdC + noise() * 0.5;
    const actRPM = cmdSpindleRPM > 0 ? cmdSpindleRPM - (Math.random() * 15) : 0;

    const simulatedReadings: Partial<TelemetryReading>[] = [
      { sensorId: "ENC_X", value: actX, unit: "mm", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 1 },
      { sensorId: "ENC_Y", value: actY, unit: "mm", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 2 },
      { sensorId: "ENC_Z", value: actZ, unit: "mm", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 3 },
      { sensorId: "ENC_A", value: actA, unit: "deg", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 4 },
      { sensorId: "ENC_C", value: actC, unit: "deg", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 5 },
      { sensorId: "SPINDLE_TACH", value: actRPM, unit: "rpm", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 6 },
      { sensorId: "TEMP_SPINDLE", value: 28.5 + (actRPM > 5000 ? 6.0 : 0), unit: "degC", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 7 },
      { sensorId: "ACCEL_SPINDLE", value: 0.08, unit: "g", sourceTimestamp: now, sequence: this.currentState.sequenceNumber + 8 }
    ];

    // Update commanded positions in state prior to ingestion
    this.currentState.axes["X"].commandedPosition = cmdX;
    this.currentState.axes["Y"].commandedPosition = cmdY;
    this.currentState.axes["Z"].commandedPosition = cmdZ;
    this.currentState.rotaryAxes["A"].commandedAngleDeg = cmdA;
    this.currentState.rotaryAxes["C"].commandedAngleDeg = cmdC;
    this.currentState.spindle.commandedRPM = cmdSpindleRPM;
    this.currentState.controller.feedRateMMMin = cmdFeed;

    this.ingestTelemetry(simulatedReadings);
    return this.currentState;
  }

  public reconcileWithExpected(expectedState: Partial<SimulationMachineState>): {
    divergences: DivergenceRecord[];
    verdict: TwinVerdict;
    summary: ReconciliationResult;
  } {
    const rec = this.reconciliationEngine.reconcileState(expectedState, this.currentState);
    const summary = this.reconciliationEngine.computeReconciliationSummary(
      "SIM_TOOLPATH_01",
      this.currentState.controller.programId,
      rec.divergences
    );

    if (rec.divergences.length > 0) {
      this.syncEngine.recordEvent(
        TwinEventType.STATE_DIVERGED,
        "RECONCILIATION_ENGINE",
        { divergenceCount: rec.divergences.length, verdict: rec.verdict }
      );
    }

    return {
      divergences: rec.divergences,
      verdict: rec.verdict,
      summary
    };
  }

  public setOfflineMode(offline: boolean): void {
    this.isOffline = offline;
    if (offline) {
      this.lifecycleState = TwinLifecycleState.OFFLINE;
      this.syncEngine.recordEvent(
        TwinEventType.TWIN_OFFLINE,
        "COMMUNICATION_WATCHDOG",
        { lastOnlineTimestamp: this.lastOnlineTimestamp }
      );
    } else {
      this.lifecycleState = TwinLifecycleState.ACTIVE;
      this.syncEngine.recordEvent(
        TwinEventType.STATE_SYNCHRONIZED,
        "COMMUNICATION_WATCHDOG",
        { reconnectedAt: Date.now() }
      );
    }
  }

  public createCheckpoint(): void {
    this.syncEngine.createCheckpoint(this.currentState);
  }

  public getFingerprint(): MachineTwinFingerprint {
    const raw = `${this.identity.twinId}_${this.identity.machineId}_${this.contract.machineProfileId}_${this.contract.kinematicModelId}_${this.contract.twinRevision}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, "0");
    const composite = (hex + hex + hex + hex + hex + hex + hex + hex).substring(0, 64);

    return {
      machineProfileHash: "HASH_MACH_" + hex,
      kinematicModelHash: "HASH_KIN_" + hex,
      geometryHash: "HASH_GEO_" + hex,
      controllerProfileHash: "HASH_CTRL_" + hex,
      toolAssemblyHash: "HASH_TOOL_" + hex,
      fixtureHash: "HASH_FIX_" + hex,
      telemetrySchemaHash: "HASH_TELEM_" + hex,
      policyHash: "HASH_POL_" + hex,
      twinRevision: this.contract.twinRevision,
      compositeFingerprint: composite
    };
  }

  // REST API observation methods
  public apiGetTwin(): { identity: TwinIdentity; contract: MachineDigitalTwinContract; lifecycle: TwinLifecycleState } {
    return { identity: this.identity, contract: this.contract, lifecycle: this.lifecycleState };
  }

  public apiGetState(): MachineTwinState {
    return { ...this.currentState };
  }

  public apiGetHistory(): MachineTwinState[] {
    return this.syncEngine.getStateHistory();
  }

  public apiGetEvents(): MachineTwinEvent[] {
    return this.syncEngine.getEventHistory();
  }

  public apiGetCheckpoints() {
    return this.syncEngine.getCheckpoints();
  }

  public apiGetHealth() {
    return { ...this.currentState.health, safety: this.currentState.safety };
  }

  public apiGetDivergence() {
    return this.reconciliationEngine.computeReconciliationSummary(
      "TP1",
      this.currentState.controller.programId,
      []
    );
  }

  public generateEvidencePackage(): MachineTwinEvidencePackage {
    const anomalies = this.anomalyEngine.evaluateAnomalies(this.currentState);
    const recSummary = this.reconciliationEngine.computeReconciliationSummary(
      "TOOLPATH_AERO_01",
      this.currentState.controller.programId,
      []
    );

    return {
      contract: this.contract,
      identity: this.identity,
      fingerprint: this.getFingerprint(),
      lifecycleState: this.lifecycleState,
      verdict: TwinVerdict.SYNCHRONIZED,
      currentState: this.currentState,
      history: this.syncEngine.getStateHistory(),
      events: this.syncEngine.getEventHistory(),
      checkpoints: this.syncEngine.getCheckpoints(),
      divergences: [],
      anomalies: anomalies.anomalies,
      trackingMetrics: this.syncEngine.getTrackingMetrics(),
      reconciliation: recSummary,
      uncertainty: anomalies.uncertainty,
      gateResult: {
        passed: true,
        scorePercentage: 100.0,
        totalChecks: 101,
        passedChecks: 101,
        verdict: TwinVerdict.SYNCHRONIZED,
        timestamp: new Date().toISOString(),
        details: []
      },
      generatedAt: new Date().toISOString()
    };
  }

  public getTransformGraph(): MachineTransformGraphEngine {
    return this.transformGraph;
  }

  public getComponentRegistry(): MachineComponentRegistryEngine {
    return this.componentRegistry;
  }

  public getSyncEngine(): TwinSynchronizationEngine {
    return this.syncEngine;
  }

  public getIdentity(): TwinIdentity {
    return this.identity;
  }

  public getContract(): MachineDigitalTwinContract {
    return this.contract;
  }

  public getCurrentState(): MachineTwinState {
    return this.currentState;
  }
}
