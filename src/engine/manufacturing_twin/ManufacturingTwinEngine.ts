// SECP Industrial OS v2 — Manufacturing Twin Core Orchestration Engine
import {
  ManufacturingTwin,
  ManufacturingState,
  ManufacturingFeature,
  ProcessPlan,
  MachineConfiguration,
  ToolAssembly,
  FixtureDefinition,
  ManufacturingSetup,
  Toolpath,
  PostProcessorDefinition,
  NCProgram,
  ManufacturingExecution,
  ExecutionTelemetryPacket,
  AsManufacturedGeometry,
  ToleranceVerification,
  ManufacturedPartIdentity,
  ManufacturingEvidence,
  ManufacturingEvent,
  ManufacturingStateStatus,
  ManufacturingNonconformity
} from './types';
import { CanonicalManufacturingSerializer } from './CanonicalManufacturingSerializer';
import { ManufacturingIdentityService } from './ManufacturingIdentityService';
import { ManufacturingDependencyGraph } from './ManufacturingDependencyGraph';

export class ManufacturingTwinEngine {
  private twins: Map<string, ManufacturingTwin> = new Map();
  private events: Map<string, ManufacturingEvent[]> = new Map();
  private evidences: Map<string, ManufacturingEvidence> = new Map();

  // 1. Create Manufacturing Twin
  public createManufacturingTwin(params: {
    manufacturingTwinId: string;
    productId: string;
    productRevision: string;
    geometryTwinId: string;
    releasedGeometryHash: string;
    releasedGeometryRevision: string;
    materialId: string;
    materialRevision: string;
    materialBatch: string;
    features: ManufacturingFeature[];
    processPlan: ProcessPlan;
    machineConfiguration: MachineConfiguration;
    toolAssemblies: ToolAssembly[];
    fixture: FixtureDefinition;
    setup: ManufacturingSetup;
    toolpaths: Toolpath[];
    postProcessor: PostProcessorDefinition;
    ncProgram: NCProgram;
  }): ManufacturingTwin {
    const featHash = CanonicalManufacturingSerializer.canonicalizeFeatures(params.features);
    const procHash = CanonicalManufacturingSerializer.canonicalizeProcessPlan(params.processPlan);
    const mcHash = CanonicalManufacturingSerializer.canonicalizeMachineConfiguration(params.machineConfiguration);
    const toolingHash = CanonicalManufacturingSerializer.canonicalizeToolAssemblies(params.toolAssemblies);
    const toolpathsHash = CanonicalManufacturingSerializer.sha256(
      params.toolpaths.map(tp => CanonicalManufacturingSerializer.canonicalizeToolpath(tp)).join('|')
    );
    const fixtureConfigHash = params.fixture.fixtureConfigurationHash;
    const ncHash = params.ncProgram.programTextHash;

    const initialEvidenceId = `EVID-MFG-${params.manufacturingTwinId}-001`;
    const initialEvidenceHash = CanonicalManufacturingSerializer.sha256(`INITIAL_EVIDENCE_${params.manufacturingTwinId}`);

    const state: ManufacturingState = {
      designState: { productId: params.productId, productRevision: params.productRevision },
      geometryState: {
        geometryTwinId: params.geometryTwinId,
        geometryHash: params.releasedGeometryHash,
        geometryRevision: params.releasedGeometryRevision
      },
      materialState: {
        materialId: params.materialId,
        materialRevision: params.materialRevision,
        materialBatch: params.materialBatch
      },
      featureState: { features: params.features, featuresHash: featHash },
      processState: { processPlan: params.processPlan, processHash: procHash },
      machineState: { machineConfiguration: params.machineConfiguration, machineConfigHash: mcHash },
      toolState: { toolAssemblies: params.toolAssemblies, toolingHash },
      fixtureState: { fixture: params.fixture, setup: params.setup, fixtureConfigHash },
      toolpathState: { toolpaths: params.toolpaths, toolpathsHash },
      ncState: { postProcessor: params.postProcessor, ncProgram: params.ncProgram, ncHash },
      evidenceState: { evidenceId: initialEvidenceId, evidenceHash: initialEvidenceHash }
    };

    const inputHash = CanonicalManufacturingSerializer.computeManufacturingInputHash(state);

    const rootHash = CanonicalManufacturingSerializer.computeManufacturingRootHash({
      geometryHash: state.geometryState.geometryHash,
      materialHash: state.materialState.materialId,
      featureHash: state.featureState.featuresHash,
      processHash: state.processState.processHash,
      machineHash: state.machineState.machineConfigHash,
      toolHash: state.toolState.toolingHash,
      fixtureHash: state.fixtureState.fixtureConfigHash,
      toolpathHash: state.toolpathState.toolpathsHash,
      postHash: state.ncState.postProcessor.postHash,
      ncHash: state.ncState.ncProgram.programTextHash,
      executionHash: 'NO_EXECUTION',
      inspectionHash: 'NO_INSPECTION',
      asManufacturedHash: 'NO_SCAN',
      evidenceHash: state.evidenceState.evidenceHash
    });

    // Audit initial state
    const auditRes = ManufacturingIdentityService.auditManufacturingState(
      state,
      params.releasedGeometryHash,
      params.materialRevision
    );

    const now = new Date().toISOString();
    const twin: ManufacturingTwin = {
      manufacturingTwinId: params.manufacturingTwinId,
      productId: params.productId,
      productRevision: params.productRevision,
      geometryTwinId: params.geometryTwinId,
      materialRevision: params.materialRevision,
      manufacturingRevision: 'REV-MFG-001',
      processPlanId: params.processPlan.processPlanId,
      machineConfigurationId: params.machineConfiguration.machineId,
      toolConfigurationId: params.toolAssemblies[0]?.toolAssemblyId || 'NO_TOOL',
      fixtureConfigurationId: params.fixture.fixtureId,
      toolpathId: params.toolpaths[0]?.toolpathId || 'NO_TOOLPATH',
      ncProgramId: params.ncProgram.programId,
      executionId: 'NO_EXECUTION',
      inspectionId: 'NO_INSPECTION',
      state: auditRes.verdict,
      manufacturingState: state,
      createdAt: now,
      updatedAt: now,
      inputHash,
      processHash: procHash,
      executionHash: 'NO_EXECUTION',
      resultHash: 'NO_RESULT',
      rootHash
    };

    this.twins.set(twin.manufacturingTwinId, twin);
    this.events.set(twin.manufacturingTwinId, []);

    this.recordEvent(twin.manufacturingTwinId, 'JOB_CREATED', 'System', 'System', initialEvidenceId);

    return twin;
  }

  // 2. Attach Execution
  public attachExecution(
    manufacturingTwinId: string,
    execution: ManufacturingExecution
  ): { twin: ManufacturingTwin; valid: boolean; error?: string } {
    const twin = this.twins.get(manufacturingTwinId);
    if (!twin) throw new Error(`Twin ${manufacturingTwinId} not found`);

    // Verify program execution integrity
    const progMatch = ManufacturingIdentityService.verifyProgramExecution(
      execution.programHash,
      twin.manufacturingState.ncState.ncProgram.programTextHash
    );
    if (!progMatch.valid && progMatch.error) {
      twin.state = 'EXECUTION_FAILURE';
      return { twin, valid: false, error: progMatch.error };
    }

    // Verify telemetry
    const telemMatch = ManufacturingIdentityService.verifyTelemetry(execution.telemetryStream);
    if (!telemMatch.valid && telemMatch.error) {
      twin.state = 'EXECUTION_FAILURE';
      return { twin, valid: false, error: telemMatch.error };
    }

    twin.manufacturingState.executionState = execution;
    twin.executionId = execution.executionId;
    twin.executionHash = execution.executionHash;
    twin.updatedAt = new Date().toISOString();

    // Recompute root hash
    twin.rootHash = CanonicalManufacturingSerializer.computeManufacturingRootHash({
      geometryHash: twin.manufacturingState.geometryState.geometryHash,
      materialHash: twin.manufacturingState.materialState.materialId,
      featureHash: twin.manufacturingState.featureState.featuresHash,
      processHash: twin.manufacturingState.processState.processHash,
      machineHash: twin.manufacturingState.machineState.machineConfigHash,
      toolHash: twin.manufacturingState.toolState.toolingHash,
      fixtureHash: twin.manufacturingState.fixtureState.fixtureConfigHash,
      toolpathHash: twin.manufacturingState.toolpathState.toolpathsHash,
      postHash: twin.manufacturingState.ncState.postProcessor.postHash,
      ncHash: twin.manufacturingState.ncState.ncProgram.programTextHash,
      executionHash: execution.executionHash,
      inspectionHash: twin.manufacturingState.inspectionState?.verdict || 'NO_INSPECTION',
      asManufacturedHash: twin.manufacturingState.asManufacturedState?.scanHash || 'NO_SCAN',
      evidenceHash: twin.manufacturingState.evidenceState.evidenceHash
    });

    twin.state = 'READY';
    this.recordEvent(twin.manufacturingTwinId, 'EXECUTION_COMPLETED', execution.machineId, execution.operatorId, execution.executionId);

    return { twin, valid: true };
  }

  // 3. Attach Inspection & Verify Tolerance
  public attachInspection(
    manufacturingTwinId: string,
    asManufactured: AsManufacturedGeometry,
    verifications: ToleranceVerification[]
  ): { twin: ManufacturingTwin; auditResult: any } {
    const twin = this.twins.get(manufacturingTwinId);
    if (!twin) throw new Error(`Twin ${manufacturingTwinId} not found`);

    const auditRes = ManufacturingIdentityService.auditTolerance(verifications);

    twin.manufacturingState.asManufacturedState = asManufactured;
    twin.manufacturingState.inspectionState = {
      verifications,
      deviationMap: auditRes.deviationMap,
      verdict: auditRes.verdict
    };

    twin.inspectionId = asManufactured.measurementDataId;
    twin.resultHash = CanonicalManufacturingSerializer.sha256(JSON.stringify(auditRes.deviationMap));
    twin.updatedAt = new Date().toISOString();

    if (auditRes.verdict === 'OUT_OF_TOLERANCE') {
      twin.state = 'OUT_OF_TOLERANCE';
      this.recordEvent(twin.manufacturingTwinId, 'NONCONFORMITY_DETECTED', asManufactured.measurementDevice, 'QC_Inspector', asManufactured.measurementDataId);
    } else {
      twin.state = 'MANUFACTURING_VALID';
      this.recordEvent(twin.manufacturingTwinId, 'INSPECTION_COMPLETED', asManufactured.measurementDevice, 'QC_Inspector', asManufactured.measurementDataId);
    }

    // Recompute root hash
    twin.rootHash = CanonicalManufacturingSerializer.computeManufacturingRootHash({
      geometryHash: twin.manufacturingState.geometryState.geometryHash,
      materialHash: twin.manufacturingState.materialState.materialId,
      featureHash: twin.manufacturingState.featureState.featuresHash,
      processHash: twin.manufacturingState.processState.processHash,
      machineHash: twin.manufacturingState.machineState.machineConfigHash,
      toolHash: twin.manufacturingState.toolState.toolingHash,
      fixtureHash: twin.manufacturingState.fixtureState.fixtureConfigHash,
      toolpathHash: twin.manufacturingState.toolpathState.toolpathsHash,
      postHash: twin.manufacturingState.ncState.postProcessor.postHash,
      ncHash: twin.manufacturingState.ncState.ncProgram.programTextHash,
      executionHash: twin.manufacturingState.executionState?.executionHash || 'NO_EXECUTION',
      inspectionHash: auditRes.verdict,
      asManufacturedHash: asManufactured.scanHash,
      evidenceHash: twin.manufacturingState.evidenceState.evidenceHash
    });

    // Create Evidence Object & Part Identity
    const partSerial = `SN-PART-${twin.manufacturingTwinId}-0001`;
    const partIdentity: ManufacturedPartIdentity = {
      partSerial,
      manufacturingTwinId: twin.manufacturingTwinId,
      executionId: twin.executionId,
      materialBatch: twin.manufacturingState.materialState.materialBatch,
      machineId: twin.machineConfigurationId,
      programHash: twin.manufacturingState.ncState.ncProgram.programTextHash,
      inspectionId: twin.inspectionId,
      finalGeometryHash: asManufactured.scanHash
    };

    const evidence: ManufacturingEvidence = {
      evidenceId: `EVID-FULL-${twin.manufacturingTwinId}`,
      manufacturingTwinId: twin.manufacturingTwinId,
      inputHash: twin.inputHash,
      processHash: twin.processHash,
      ncHash: twin.manufacturingState.ncState.ncHash,
      executionHash: twin.executionHash,
      inspectionHash: twin.resultHash,
      rootHash: twin.rootHash,
      provenance: {
        sourceGeometry: twin.manufacturingState.geometryState.geometryHash,
        sourceMaterial: twin.manufacturingState.materialState.materialId,
        sourceProcessPlan: twin.processPlanId,
        sourceMachine: twin.machineConfigurationId,
        sourceTooling: twin.toolConfigurationId,
        sourceFixture: twin.fixtureConfigurationId,
        sourceToolpath: twin.toolpathId,
        sourceNCProgram: twin.ncProgramId,
        sourceExecution: twin.executionId,
        sourceInspection: twin.inspectionId
      },
      partIdentity,
      timestamp: new Date().toISOString()
    };

    this.evidences.set(twin.manufacturingTwinId, evidence);

    return { twin, auditResult: auditRes };
  }

  // 4. Record Event
  private recordEvent(
    manufacturingTwinId: string,
    eventType: any,
    source: string,
    actor: string,
    evidenceId: string
  ): void {
    const list = this.events.get(manufacturingTwinId) || [];
    const prevHash = list.length > 0 ? list[list.length - 1].eventHash : 'GENESIS';
    const now = new Date().toISOString();
    const eventHash = CanonicalManufacturingSerializer.sha256([manufacturingTwinId, eventType, now, prevHash].join('|'));

    const evt: ManufacturingEvent = {
      eventId: `EVT-${list.length + 1}`,
      manufacturingTwinId,
      executionId: 'EXEC-001',
      eventType,
      timestamp: now,
      previousStateHash: prevHash,
      newStateHash: eventHash,
      source,
      actor,
      evidenceId,
      eventHash
    };
    list.push(evt);
    this.events.get(manufacturingTwinId);
  }

  // 5. Getters
  public getTwin(manufacturingTwinId: string): ManufacturingTwin | undefined {
    return this.twins.get(manufacturingTwinId);
  }

  public getEvidence(manufacturingTwinId: string): ManufacturingEvidence | undefined {
    return this.evidences.get(manufacturingTwinId);
  }

  // 6. Historical Reconstruction
  public reconstructManufacturingState(manufacturingTwinId: string): { twin: ManufacturingTwin; reconstructedInputHash: string } {
    const twin = this.twins.get(manufacturingTwinId);
    if (!twin) throw new Error(`Twin ${manufacturingTwinId} not found`);

    const reconstructedInputHash = CanonicalManufacturingSerializer.computeManufacturingInputHash(twin.manufacturingState);

    return { twin, reconstructedInputHash };
  }
}
