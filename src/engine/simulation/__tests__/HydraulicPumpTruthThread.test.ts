/**
 * SECP Industrial OS — Hydraulic Pump Engineering Truth Thread Benchmark
 * 
 * Verifies end-to-end cryptographic and forensic continuity across all 6 gates:
 * Canonical Revision -> Topology Lineage -> SimulationExecutionRegistry ->
 * CanonicalDerivedArtifactBinding -> CAM / Manufacturing Execution ->
 * Physical Acquisition / CMM Metrology -> Engineering Truth Certificate ->
 * Independent Verifier.
 * 
 * Enforces Fail-Closed behavior across the positive lifecycle and 16 independent
 * adversarial breaking tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';

// Revision & Identity Services
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { SimulationIdentityService } from '../SimulationIdentityService';

// Gate 2: Simulation Execution Authority
import { SimulationEngine, SimulationScenario } from '../SimulationEngine';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { initializeAuthorityHandshake } from '../SimulationAuthorityInternal';

// Gate 3: Canonical Derived Artifact Binding
import { 
  CanonicalDerivedArtifactBinding, 
  DerivedArtifactBindingResult 
} from '../../topology/CanonicalDerivedArtifactBinding';

// Gate 4: CAM -> Manufacturing Execution Gate
import { 
  HardAcceptanceGatePMA001, 
  PMARequest 
} from '../../manufacturing/pma/HardAcceptanceGatePMA001';
import { 
  PhysicalManufacturingEngine,
  PRODUCTION_PHYSICAL_TRUST,
  TELEMETRY_TRUST_CLASSIFICATION
} from '../../manufacturing/pma/PhysicalManufacturingEngine';
import { 
  PhysicalTelemetryEnvelope, 
  MetrologyProof,
  ManufacturingExecutionEnvelope 
} from '../../manufacturing/pma/PhysicalManufacturingTypes';

// Gate 5: Physical Acquisition / CMM Metrology
import { 
  CMMHardwareProtocolBridge, 
  CMMMachineSpecification, 
  ProbeTipCalibration 
} from '../../manufacturing/metrology/CMMHardwareProtocolBridge';

// Gate 6: Engineering Truth Certificate & Independent Verifier
import { 
  EngineeringTruthCertificateEngine 
} from '../../certification/truth/EngineeringTruthCertificateEngine';
import { 
  EngineeringTruthCertificateVerifier 
} from '../../certification/truth/EngineeringTruthCertificateVerifier';
import { 
  TruthVerdict, 
  CertificationScope, 
  EvidenceLeafRecord 
} from '../../certification/truth/types';
import { 
  EvidenceMerkleTree 
} from '../../certification/truth/EvidenceMerkleTree';

// Rogue Plugin Containment
import { 
  PluginAuthorityBoundary 
} from '../../governance/PluginAuthorityBoundary';

describe('Hydraulic Pump Engineering Truth Thread Benchmark', () => {
  // Identity & Canonical State
  const ENTITY_ID = 'HYDRAULIC-PUMP-ROTOR-01';
  const ENTITY_ID_A = 'HYDRAULIC-PUMP-ROTOR-REV-A-MODEL';
  const PART_ID = 'PART-ROTOR-451';
  const PROJECT_ID = 'PROJ-HYD-PUMP-V2';

  // Rev-A: Initial Bore Ø48
  const REV_A_ID = 'REV-A';
  let CAD_REV_A_HASH = 'SHA256:CAD_REV_A_BORE_48MM_1111111111111111111111111111111111111111';
  let GEOM_REV_A_HASH = 'SHA256:GEOM_REV_A_48MM_0000000000000000000000000000000000000000000';

  // Rev-B: Parametric Bore Expansion Ø50
  const REV_B_ID = 'REV-B';
  let CAD_REV_B_HASH = 'SHA256:CAD_REV_B_BORE_50MM_2222222222222222222222222222222222222222';
  let GEOM_REV_B_HASH = 'SHA256:GEOM_REV_B_50MM_0000000000000000000000000000000000000000000';

  let revisionEngine: RevisionEngine;

  beforeEach(() => {
    SimulationExecutionRegistry.clear();
    try {
      const engineKey = initializeAuthorityHandshake();
      SimulationEngine.bootAuthority(engineKey);
    } catch (e) {
      // Authority already booted in runtime
    }

    revisionEngine = new RevisionEngine();
    SimulationIdentityService.initialize(revisionEngine);

    // Setup Rev-A released revision
    const revA = revisionEngine.createRevision({
      revisionId: 'REV-A-DOC',
      entityId: ENTITY_ID_A,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER',
      content: { boreDiameter: 48.0 },
      snapshot: {
        geometryState: {
          parameters: { boreDiameter: 48.0 },
          features: ['FEATURE_BORE_48'],
          topologyHash: 'TOPO_BORE_48',
          geometryHash: 'GEOM_HASH_BORE_48'
        }
      }
    } as any);
    revisionEngine.addApproval(revA.revisionId, {
      approvalId: 'APP-A',
      revisionId: revA.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Bore 48 approved'
    });
    revisionEngine.setValidationState(revA.revisionId, 'SIMULATED');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Reviewing');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approved');
    const releasedA = revisionEngine.releaseRevision(revA.revisionId, 'ADMIN', 'Release Rev A');
    CAD_REV_A_HASH = releasedA.revisionHash;
    GEOM_REV_A_HASH = releasedA.snapshot!.geometryState!.geometryHash!;

    // Setup Rev-B released revision
    const revB = revisionEngine.createRevision({
      revisionId: 'REV-B-DOC',
      entityId: ENTITY_ID,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER',
      content: { boreDiameter: 50.0 },
      snapshot: {
        geometryState: {
          parameters: { boreDiameter: 50.0 },
          features: ['FEATURE_BORE_50'],
          topologyHash: 'TOPO_BORE_50',
          geometryHash: 'GEOM_HASH_BORE_50'
        }
      }
    } as any);
    revisionEngine.addApproval(revB.revisionId, {
      approvalId: 'APP-B',
      revisionId: revB.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Bore 50 approved'
    });
    revisionEngine.setValidationState(revB.revisionId, 'SIMULATED');
    revisionEngine.transitionState(revB.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Reviewing');
    revisionEngine.transitionState(revB.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approved');
    const releasedB = revisionEngine.releaseRevision(revB.revisionId, 'ADMIN', 'Release Rev B');
    CAD_REV_B_HASH = releasedB.revisionHash;
    GEOM_REV_B_HASH = releasedB.snapshot!.geometryState!.geometryHash!;
  });

  // Helper to generate a valid 5-node telemetry chain
  function generateTelemetryChain(machineId: string): PhysicalTelemetryEnvelope[] {
    const chain: PhysicalTelemetryEnvelope[] = [];
    let prevHash = 'genesis-pump-telemetry';
    for (let i = 0; i < 5; i++) {
      const rec = PhysicalManufacturingEngine.signTelemetry({
        deviceId: 'CONTROLLER-SIEMENS-840D',
        machineId,
        sequenceNumber: i + 1,
        timestamp: '2026-09-25T08:00:00.000Z',
        payload: {
          spindleRpm: 12000,
          feedMmPerMin: 1500,
          boreZCoordinate: -25.0 + i * 5.0,
          coolantPressureBar: 40
        },
        previousHash: prevHash
      });
      chain.push(rec);
      prevHash = PhysicalManufacturingEngine.hashTelemetryRecord(rec);
    }
    return chain;
  }

  // =========================================================================
  // 1. POSITIVE LIFECYCLE PATH
  // =========================================================================
  it('POSITIVE PATH — Rev-A -> Bore Ø48 -> Rev-B -> Bore Ø50 -> Topology -> Simulation -> DFM -> CAM -> Mfg -> CMM -> Truth Cert -> Independent Verifier -> RELEASED', () => {
    // 1. Simulation for Rev-B
    const scenarioB = {
      id: 'SIM-SCENARIO-BORE-50-STRESS',
      revision: '2',
      geometry: {
        modelId: ENTITY_ID,
        geometryHash: GEOM_REV_B_HASH,
        hash: CAD_REV_B_HASH
      },
      parameters: [{ id: 'param1', name: 'hydraulicPressureBar', value: 350, type: 'number' }],
      material: { materialId: 'STEEL', revision: '1', propertiesHash: 'STEEL_HASH' },
      mesh: { hash: 'MESH_50MM', meshId: 'M1', revision: '1', elementType: 'TET10', elementCount: 50000 },
      boundaryConditions: [],
      loads: [],
      solver: { solverId: 'FEA_OPENFOAM', version: '2.0', configurationHash: 'SOLVER_CONF', settings: {} }
    } as any;
    const simResultB = SimulationEngine.runScenario(scenarioB, CAD_REV_B_HASH, GEOM_REV_B_HASH);
    expect(simResultB.status).toBe('SAFE');
    expect(simResultB.derivedArtifactBinding).toBeDefined();

    // 2. DFM Analysis for Rev-B
    const dfmContentHash = crypto.createHash('sha256').update('DFM_PASS_BORE_50MM_TOOL_CLEARANCE_OK').digest('hex');
    const dfmBindingB = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'MANUFACTURING_FEATURE',
      derivationIdentity: 'DFM_BORE_CLEARANCE_EVALUATOR',
      artifactContentHash: dfmContentHash
    });
    expect(dfmBindingB.isBound).toBe(true);

    // 3. CAM Generation & Canonical Derived Artifact Binding for Rev-B
    const gCodeContentB = 'G21 G90 G0 Z5.0\nG1 Z-25.0 F1500\nG2 I0 J25.0 (BORE CIRCULAR INTERPOLATION 50MM)\nG0 Z50.0 M30';
    const gCodeHashB = crypto.createHash('sha256').update(gCodeContentB).digest('hex');
    const camBindingB = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CAM_TOOLPATH',
      derivationIdentity: '5AXIS_CNC_BORE_MILLING',
      artifactContentHash: gCodeHashB
    });
    expect(camBindingB.isBound).toBe(true);

    // 4. Manufacturing Execution on Shop Floor (Gate 4)
    const machineId = 'CNC-DMG-MORI-05';
    const telemetryChain = generateTelemetryChain(machineId);
    const telemetryRoot = crypto.createHash('sha256').update(JSON.stringify(telemetryChain)).digest('hex');

    const mfgEnvelope: ManufacturingExecutionEnvelope = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactDigest: camBindingB.artifactDigest,
      gCodeHash: gCodeHashB,
      loadedProgramHash: gCodeHashB,
      machineId,
      executionId: 'EXEC-RUN-2026-PUMP-01',
      telemetryRoot,
      bindingResult: camBindingB,
      telemetryChain
    };

    // 5. CMM Physical Metrology Acquisition (Gate 5)
    const bridge = new CMMHardwareProtocolBridge();
    const cmmSpec: CMMMachineSpecification = {
      machineModel: 'ZEISS_PRISMO_VERITY',
      serialNumber: 'CMM-ZEISS-PRISMO-9901',
      controllerIp: '192.168.10.50',
      controllerPort: 8080,
      measuringRangeMm: { x: [-500, 500], y: [-500, 500], z: [-400, 400] },
      iso10360_2_MPE_E: { baseConstantUm: 1.2, lengthDenominator: 400 },
      maxAccelerationMmPerS2: 1500,
      maxVelocityMmPerS: 300,
      currentTemperatureDegC: 20.0,
      referenceTemperatureDegC: 20.0,
      thermalExpansionCoefficientPpmPerK: 11.5
    };
    const probe: ProbeTipCalibration = {
      probeId: 'PROBE-VAST-GOLD-2MM',
      tipDiameterMm: 2.000,
      calibratedSphereRadiusMm: 12.500,
      formErrorMm: 0.0002,
      qualificationDate: new Date().toISOString(),
      qualificationCertificateId: 'CERT-PROBE-DAKKS-2026',
      touchRepeatabilityMm: 0.0004
    };
    bridge.connect(cmmSpec, probe);

    // Touch probe at Bore surface: radius = 25.0 mm (+ tip radius 1.0 mm along approach)
    const qualifiedPoint = bridge.acquireQualifiedPoint('FEATURE_BORE_DIAMETER', {
      touchIndex: 1,
      rawPosition: { x: 26.0, y: 0, z: -10.0 },
      approachVector: { x: 1.0, y: 0, z: 0 },
      temperatureDegC: 20.0,
      triggerForceMillinewtons: 150,
      timestampUtc: '2026-09-25T08:30:00.000Z'
    });
    bridge.disconnect();

    const metrologyProof: MetrologyProof = {
      inspectionId: 'CMM-INSP-ROTOR-50MM-001',
      instrumentIdentity: 'ZEISS_PRISMO_VERITY',
      measurementSystem: 'CMM_TACTILE',
      dimensionalMeasurements: {
        boreDiameterDeviation: 0.002 // +2 um deviation from 50.000 mm
      },
      geometricDeviations: {
        cylindricity: 0.003,
        runout: 0.002
      },
      datumReferences: ['DATUM_A', 'DATUM_B'],
      tolerances: {
        boreDiameterDeviation: 0.010, // +/- 10 um allowed
        cylindricity: 0.008
      },
      measurementUncertainty: qualifiedPoint.expandedUncertaintyMm,
      inspectionEvidenceHash: qualifiedPoint.provenanceHash
    };

    // 6. Execute Gate 4 Authority Check
    const pmaVerdict = HardAcceptanceGatePMA001.executeGate({
      digitalEngineeringTruthHash: CAD_REV_B_HASH,
      releasedArtifactGCodeHash: gCodeHashB,
      loadedProgramHash: gCodeHashB,
      machineId,
      controllerId: 'CTRL-840D',
      toolId: 'BORING_BAR_50',
      stockId: 'ALLOY_4140_ROUND',
      manufacturingRunId: 'RUN-451',
      physicalPartId: PART_ID,
      telemetryChain,
      metrologyProof,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      actualGeometryHash: GEOM_REV_B_HASH,
      predecessorAttestationHash: 'GENESIS_ATTESTATION',
      hasHardwareRootOfTrust: true,
      cadRevisionHash: CAD_REV_B_HASH,
      manufacturingEnvelope: mfgEnvelope
    });
    expect(pmaVerdict.status).toBe('ACCEPTED');
    expect(pmaVerdict.claimLevel).toBe('INDUSTRIAL_FIELD_QUALIFIED');

    // 7. Gate 6: Issue Engineering Truth Certificate with all domain leaves
    const evidenceLeaves: EvidenceLeafRecord[] = [
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'CAD_MODEL',
        artifactContentHash: CAD_REV_B_HASH,
        evidenceType: 'CAD',
        authorityIdentity: 'SECP_CAD_CORE',
        sourceIdentity: 'CAD_REVISION_SERVICE',
        executionIdentity: 'REV_B_COMMIT'
      },
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'SIMULATION_RESULT',
        artifactContentHash: simResultB.derivedArtifactBinding!.artifactDigest,
        evidenceType: 'SIMULATION',
        authorityIdentity: 'SimulationEngine.runScenario',
        sourceIdentity: 'SECP_FEM_SOLVER',
        executionIdentity: simResultB.executionId!
      },
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'MANUFACTURING_FEATURE',
        artifactContentHash: dfmBindingB.artifactDigest,
        evidenceType: 'DFM',
        authorityIdentity: 'DFM_ENGINE',
        sourceIdentity: 'SECP_DFM_ANALYST',
        executionIdentity: 'EXEC_DFM_01'
      },
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'CAM_TOOLPATH',
        artifactContentHash: camBindingB.artifactDigest,
        evidenceType: 'CAM',
        authorityIdentity: 'CAM_ENGINE',
        sourceIdentity: 'SECP_CAM_POSTPROCESSOR',
        executionIdentity: 'EXEC_CAM_01'
      },
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'TELEMETRY_CHAIN',
        artifactContentHash: telemetryRoot,
        evidenceType: 'MANUFACTURING',
        authorityIdentity: 'HardAcceptanceGatePMA001',
        sourceIdentity: machineId,
        executionIdentity: mfgEnvelope.executionId
      },
      {
        entityId: ENTITY_ID,
        partId: PART_ID,
        revisionId: REV_B_ID,
        cadRevisionHash: CAD_REV_B_HASH,
        canonicalGeometryHash: GEOM_REV_B_HASH,
        artifactKind: 'CMM_INSPECTION',
        artifactContentHash: qualifiedPoint.provenanceHash,
        evidenceType: 'METROLOGY',
        authorityIdentity: 'CMMHardwareProtocolBridge',
        sourceIdentity: cmmSpec.serialNumber,
        executionIdentity: metrologyProof.inspectionId,
        payload: {
          measuredDiameterMm: 50.002,
          nominalDiameterMm: 50.000,
          toleranceMm: 0.010
        }
      }
    ];

    const certificate = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: evidenceLeaves,
      verificationSummaries: [
        { status: 'VERIFIED', patchId: 'SECP-PMA', findings: 0 }
      ],
      scope: [
        CertificationScope.GEOMETRY,
        CertificationScope.SIMULATION_RESULT,
        CertificationScope.MANUFACTURING,
        CertificationScope.PHYSICAL_METROLOGY
      ],
      issuer: 'SECP_CENTRAL_TRUTH_AUTHORITY'
    });

    expect(certificate.verdict).toBe(TruthVerdict.PASS);
    expect(certificate.evidenceRootHash).not.toContain('ROOT_'); // Real Merkle Root!

    // 8. Independent Verification from First Principles
    const verification = EngineeringTruthCertificateVerifier.verify(certificate, evidenceLeaves);
    expect(verification.overallVerdict).toBe(TruthVerdict.PASS);
    expect(verification.integrityVerified).toBe(true);
    expect(verification.signatureVerified).toBe(true);
    expect(verification.evidenceVerified).toBe(true);
    expect(verification.revisionBindingVerified).toBe(true);
    expect(verification.geometryBindingVerified).toBe(true);
    expect(verification.findings.length).toBe(0);
  });

  // =========================================================================
  // 2. REQUIRED NEGATIVE TEST MATRIX (16 ADVERSARIAL CASES)
  // =========================================================================

  // Test 1: B + Simulation(A) -> REJECT: STALE_SIMULATION_EVIDENCE / CROSS_REVISION_REPLAY
  it('Negative 1: B + Simulation(A) -> REJECT: CROSS_REVISION_REPLAY / STALE_SIMULATION_EVIDENCE', () => {
    // Generate Rev-A simulation
    const scenarioA = {
      id: 'SIM-SCENARIO-BORE-48-STRESS',
      revision: '1',
      geometry: {
        modelId: ENTITY_ID_A,
        geometryHash: GEOM_REV_A_HASH,
        hash: CAD_REV_A_HASH
      },
      parameters: [{ id: 'param1', name: 'hydraulicPressureBar', value: 350, type: 'number' }],
      material: { materialId: 'STEEL', revision: '1', propertiesHash: 'STEEL_HASH' },
      mesh: { hash: 'MESH_48MM', meshId: 'M1', revision: '1', elementType: 'TET10', elementCount: 50000 },
      boundaryConditions: [],
      loads: [],
      solver: { solverId: 'FEA_OPENFOAM', version: '2.0', configurationHash: 'SOLVER_CONF', settings: {} }
    } as any;
    const simResultA = SimulationEngine.runScenario(scenarioA, CAD_REV_A_HASH, GEOM_REV_A_HASH);

    // Attempt to verify simResultA against Rev-B expectations
    const verifyBinding = SimulationExecutionRegistry.verifyResultBinding(
      simResultA,
      CAD_REV_B_HASH,
      GEOM_REV_B_HASH
    );
    expect(verifyBinding.isValid).toBe(false);
    expect(verifyBinding.failureReason).toContain('REVISION_MISMATCH');

    // Also attempt in Certificate Verifier
    const staleLeaf: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_A_ID,
      cadRevisionHash: CAD_REV_A_HASH, // Stale Rev-A!
      canonicalGeometryHash: GEOM_REV_A_HASH,
      artifactKind: 'SIMULATION_RESULT',
      artifactContentHash: simResultA.derivedArtifactBinding!.artifactDigest,
      evidenceType: 'SIMULATION',
      authorityIdentity: 'SimulationEngine.runScenario',
      sourceIdentity: 'SECP_FEM_SOLVER',
      executionIdentity: 'EXEC_A_01'
    };

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [staleLeaf],
      verificationSummaries: [],
      scope: [CertificationScope.SIMULATION_RESULT],
      issuer: 'AUTH'
    });

    const verification = EngineeringTruthCertificateVerifier.verify(cert, [staleLeaf]);
    expect(verification.overallVerdict).toBe(TruthVerdict.FAIL);
    expect(verification.findings.some(f => f.includes('CROSS_REVISION_REPLAY'))).toBe(true);
  });

  // Test 2: B + CAM(A) -> REJECT: DERIVED_ARTIFACT_REVISION_MISMATCH
  it('Negative 2: B + CAM(A) -> REJECT: DERIVED_ARTIFACT_REVISION_MISMATCH', () => {
    // CAM bound to Rev-A
    const camBindingA = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: CAD_REV_A_HASH,
      canonicalGeometryHash: GEOM_REV_A_HASH,
      artifactKind: 'CAM_TOOLPATH',
      derivationIdentity: '5AXIS_CNC_BORE_MILLING',
      artifactContentHash: 'GCODE_A_BORE_48'
    });

    const telemetry = generateTelemetryChain('MACH1');
    const verdict = HardAcceptanceGatePMA001.executeGate({
      digitalEngineeringTruthHash: CAD_REV_B_HASH, // Rev-B
      releasedArtifactGCodeHash: 'gcode',
      loadedProgramHash: 'gcode',
      machineId: 'MACH1',
      controllerId: 'CTRL1',
      toolId: 'TOOL1',
      stockId: 'STOCK1',
      manufacturingRunId: 'RUN1',
      physicalPartId: PART_ID,
      telemetryChain: telemetry,
      metrologyProof: null,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      actualGeometryHash: GEOM_REV_B_HASH,
      predecessorAttestationHash: 'PRED',
      hasHardwareRootOfTrust: true,
      cadRevisionHash: CAD_REV_B_HASH,
      derivedArtifactBinding: camBindingA // Replay of Rev-A toolpath!
    });

    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('DERIVED_ARTIFACT_REVISION_MISMATCH');
  });

  // Test 3: B + forged telemetry -> REJECT: TELEMETRY_INTEGRITY_FAILURE
  it('Negative 3: B + forged telemetry -> REJECT: TELEMETRY_INTEGRITY_FAILURE', () => {
    const telemetry = generateTelemetryChain('MACH1');
    // Forge spindle speed without updating signature
    telemetry[2].payload.spindleRpm = 999999;

    const verdict = HardAcceptanceGatePMA001.executeGate({
      digitalEngineeringTruthHash: CAD_REV_B_HASH,
      releasedArtifactGCodeHash: 'gcode',
      loadedProgramHash: 'gcode',
      machineId: 'MACH1',
      controllerId: 'CTRL1',
      toolId: 'TOOL1',
      stockId: 'STOCK1',
      manufacturingRunId: 'RUN1',
      physicalPartId: PART_ID,
      telemetryChain: telemetry,
      metrologyProof: null,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      actualGeometryHash: GEOM_REV_B_HASH,
      predecessorAttestationHash: 'PRED',
      hasHardwareRootOfTrust: true
    });

    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('TELEMETRY_INTEGRITY_FAILURE');
  });

  // Test 4: B + wrong physical serial -> REJECT: PHYSICAL_IDENTITY_MISMATCH
  it('Negative 4: B + wrong physical serial -> REJECT: PHYSICAL_IDENTITY_MISMATCH', () => {
    const telemetry = generateTelemetryChain('MACH1');
    const envelope: ManufacturingExecutionEnvelope = {
      entityId: ENTITY_ID,
      partId: 'ROTOR-CORRECT-451',
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactDigest: 'DIGEST',
      gCodeHash: 'GCODE',
      loadedProgramHash: 'GCODE',
      machineId: 'MACH1',
      executionId: 'EXEC1',
      telemetryRoot: crypto.createHash('sha256').update(JSON.stringify(telemetry)).digest('hex')
    };

    const verdict = HardAcceptanceGatePMA001.executeGate({
      digitalEngineeringTruthHash: CAD_REV_B_HASH,
      releasedArtifactGCodeHash: 'GCODE',
      loadedProgramHash: 'GCODE',
      machineId: 'MACH1',
      controllerId: 'CTRL1',
      toolId: 'TOOL1',
      stockId: 'STOCK1',
      manufacturingRunId: 'RUN1',
      physicalPartId: 'ROTOR-WRONG-999', // Mismatched physical part!
      telemetryChain: telemetry,
      metrologyProof: null,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      actualGeometryHash: GEOM_REV_B_HASH,
      predecessorAttestationHash: 'PRED',
      hasHardwareRootOfTrust: true,
      manufacturingEnvelope: envelope
    });

    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('PHYSICAL_IDENTITY_MISMATCH');
  });

  // Test 5: B + unsigned CMM -> REJECT: UNQUALIFIED_METROLOGY_ACQUISITION
  it('Negative 5: B + unsigned CMM -> REJECT: UNQUALIFIED_METROLOGY_ACQUISITION', () => {
    const bridge = new CMMHardwareProtocolBridge();
    // Attempt to acquire points without connecting and qualifying probe
    expect(() => {
      bridge.acquireQualifiedPoint('FEATURE_1', {
        touchIndex: 1,
        rawPosition: { x: 0, y: 0, z: 0 },
        approachVector: { x: 0, y: 0, z: 1 },
        temperatureDegC: 20,
        triggerForceMillinewtons: 100,
        timestampUtc: new Date().toISOString()
      });
    }).toThrow(/CMM_HARDWARE_ERROR/);
  });

  // Test 6: B + CMM but no Simulation -> REJECT: EVIDENCE_CHAIN_INCOMPLETE
  it('Negative 6: B + CMM but no Simulation -> REJECT: EVIDENCE_CHAIN_INCOMPLETE', () => {
    const cmmOnlyLeaf: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CMM_INSPECTION',
      artifactContentHash: 'HASH_CMM',
      evidenceType: 'METROLOGY',
      authorityIdentity: 'CMM_AUTH',
      sourceIdentity: 'CMM_ZEISS',
      executionIdentity: 'INSP_01'
    };

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [cmmOnlyLeaf],
      verificationSummaries: [],
      // Scope requires Simulation, but no simulation evidence provided!
      scope: [CertificationScope.PHYSICAL_METROLOGY, CertificationScope.SIMULATION_RESULT],
      issuer: 'AUTH'
    });

    const verification = EngineeringTruthCertificateVerifier.verify(cert, [cmmOnlyLeaf]);
    expect(verification.overallVerdict).toBe(TruthVerdict.UNPROVEN);
    expect(verification.findings.some(f => f.includes('EVIDENCE_CHAIN_INCOMPLETE'))).toBe(true);
  });

  // Test 7: B + all evidence except one altered root -> REJECT: EVIDENCE_ROOT_DISSONANCE
  it('Negative 7: B + all evidence except one altered root -> REJECT: EVIDENCE_ROOT_DISSONANCE', () => {
    const validLeaf: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CAD_MODEL',
      artifactContentHash: 'HASH1',
      evidenceType: 'CAD',
      authorityIdentity: 'AUTH',
      sourceIdentity: 'SRC',
      executionIdentity: 'EX1'
    };

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [validLeaf],
      verificationSummaries: [],
      scope: [CertificationScope.GEOMETRY],
      issuer: 'AUTH'
    });

    // Replace declared evidenceRootHash with a forged root
    const tamperedCert = { ...cert, evidenceRootHash: 'FORGED_MERKLE_ROOT_99999999999999999999999999999999' };
    const verification = EngineeringTruthCertificateVerifier.verify(tamperedCert, [validLeaf]);
    expect(verification.overallVerdict).not.toBe(TruthVerdict.PASS);
    expect(verification.findings.some(f => f.includes('EVIDENCE_ROOT_DISSONANCE') || f.includes('TAMPER_DETECTED'))).toBe(true);
  });

  // Test 8: Valid certificate + modify ONE CMM coordinate -> verifier MUST FAIL
  it('Negative 8: Valid certificate + modify ONE CMM coordinate -> verifier MUST FAIL', () => {
    const leaf: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CMM_INSPECTION',
      artifactContentHash: 'ORIGINAL_COORDINATES_HASH',
      evidenceType: 'METROLOGY',
      authorityIdentity: 'ZEISS_BRIDGE',
      sourceIdentity: 'CMM_01',
      executionIdentity: 'MEAS_01'
    };

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [leaf],
      verificationSummaries: [],
      scope: [CertificationScope.PHYSICAL_METROLOGY],
      issuer: 'AUTH'
    });

    // Attacker modifies ONE coordinate hash in the leaf
    const tamperedLeaf: EvidenceLeafRecord = {
      ...leaf,
      artifactContentHash: 'MODIFIED_COORDINATES_HASH_PLUS_5_MICRONS'
    };

    const verification = EngineeringTruthCertificateVerifier.verify(cert, [tamperedLeaf]);
    expect(verification.overallVerdict).toBe(TruthVerdict.FAIL);
    expect(verification.findings.some(f => f.includes('EVIDENCE_ROOT_DISSONANCE'))).toBe(true);
  });

  // Test 9: Valid certificate + replace ONE Merkle root -> verifier MUST FAIL
  it('Negative 9: Valid certificate + replace ONE Merkle root -> verifier MUST FAIL', () => {
    const leaf: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CAD_MODEL',
      artifactContentHash: 'HASH',
      evidenceType: 'CAD',
      authorityIdentity: 'AUTH',
      sourceIdentity: 'SRC',
      executionIdentity: 'EX'
    };

    const cert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [leaf],
      verificationSummaries: [],
      scope: [CertificationScope.GEOMETRY],
      issuer: 'AUTH'
    });

    const tampered = { ...cert, evidenceRootHash: 'COMPLETELY_REPLACED_MERKLE_ROOT' };
    const verification = EngineeringTruthCertificateVerifier.verify(tampered, [leaf]);
    expect(verification.overallVerdict).toBe(TruthVerdict.INVALID); // Hash tamper detected!
  });

  // Test 10: Valid Rev-A certificate replayed against Rev-B -> REJECT
  it('Negative 10: Valid Rev-A certificate replayed against Rev-B -> REJECT', () => {
    const leafA: EvidenceLeafRecord = {
      entityId: ENTITY_ID,
      partId: PART_ID,
      revisionId: REV_A_ID,
      cadRevisionHash: CAD_REV_A_HASH,
      canonicalGeometryHash: GEOM_REV_A_HASH,
      artifactKind: 'CAD_MODEL',
      artifactContentHash: 'REV_A_HASH',
      evidenceType: 'CAD',
      authorityIdentity: 'AUTH',
      sourceIdentity: 'SRC',
      executionIdentity: 'EX_A'
    };

    const certA = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_A_ID,
      cadRevisionHash: CAD_REV_A_HASH,
      canonicalGeometryHash: GEOM_REV_A_HASH,
      artifactHash: CAD_REV_A_HASH,
      evidenceRecords: [leafA],
      verificationSummaries: [],
      scope: [CertificationScope.GEOMETRY],
      issuer: 'AUTH'
    });

    // Replay against Rev-B expectations:
    // If verifier is asked to verify certA against Rev-B leaves:
    const leafB: EvidenceLeafRecord = {
      ...leafA,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH
    };

    const verification = EngineeringTruthCertificateVerifier.verify(certA, [leafB]);
    expect(verification.overallVerdict).toBe(TruthVerdict.FAIL);
    expect(verification.findings.some(f => f.includes('CROSS_REVISION_REPLAY'))).toBe(true);
  });

  // Test 11: Valid Rotor-01 certificate replayed against Rotor-02 -> REJECT
  it('Negative 11: Valid Rotor-01 certificate replayed against Rotor-02 -> REJECT', () => {
    const leaf01: EvidenceLeafRecord = {
      entityId: 'HYDRAULIC-PUMP-ROTOR-01',
      partId: 'ROTOR-01',
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactKind: 'CAD_MODEL',
      artifactContentHash: 'HASH',
      evidenceType: 'CAD',
      authorityIdentity: 'AUTH',
      sourceIdentity: 'SRC',
      executionIdentity: 'EX_01'
    };

    const cert01 = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: 'HYDRAULIC-PUMP-ROTOR-01',
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      artifactHash: CAD_REV_B_HASH,
      evidenceRecords: [leaf01],
      verificationSummaries: [],
      scope: [CertificationScope.GEOMETRY],
      issuer: 'AUTH'
    });

    // Replay against Rotor-02
    const leaf02: EvidenceLeafRecord = {
      ...leaf01,
      entityId: 'HYDRAULIC-PUMP-ROTOR-02',
      partId: 'ROTOR-02'
    };

    const verification = EngineeringTruthCertificateVerifier.verify(cert01, [leaf02]);
    expect(verification.overallVerdict).toBe(TruthVerdict.FAIL);
    expect(verification.findings.some(f => f.includes('CROSS_ENTITY_REPLAY'))).toBe(true);
  });

  // Test 12: Valid CAM + altered loaded G-Code -> REJECT
  it('Negative 12: Valid CAM + altered loaded G-Code -> REJECT', () => {
    const telemetry = generateTelemetryChain('MACH1');
    const verdict = HardAcceptanceGatePMA001.executeGate({
      digitalEngineeringTruthHash: CAD_REV_B_HASH,
      releasedArtifactGCodeHash: 'VALID_GCODE_HASH_A',
      loadedProgramHash: 'ALTERED_OR_SUBSTITUTED_GCODE_HASH_B', // Substitution!
      machineId: 'MACH1',
      controllerId: 'CTRL1',
      toolId: 'TOOL1',
      stockId: 'STOCK1',
      manufacturingRunId: 'RUN1',
      physicalPartId: PART_ID,
      telemetryChain: telemetry,
      metrologyProof: null,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      actualGeometryHash: GEOM_REV_B_HASH,
      predecessorAttestationHash: 'PRED',
      hasHardwareRootOfTrust: true
    });

    expect(verdict.status).toBe('REJECTED');
    expect(verdict.reason).toBe('ATTESTATION_FAILURE');
  });

  // Test 13: Telemetry record deleted -> REJECT
  it('Negative 13: Telemetry record deleted -> REJECT', () => {
    const telemetry = generateTelemetryChain('MACH1');
    // Delete record #3
    telemetry.splice(2, 1);

    const error = PhysicalManufacturingEngine.verifyTelemetryChain(telemetry, 'MACH1');
    expect(error).toBe('CHAIN_INTEGRITY_FAILURE');
  });

  // Test 14: Telemetry order changed -> REJECT
  it('Negative 14: Telemetry order changed -> REJECT', () => {
    const telemetry = generateTelemetryChain('MACH1');
    // Swap record 1 and 2
    const tmp = telemetry[1];
    telemetry[1] = telemetry[2];
    telemetry[2] = tmp;

    const error = PhysicalManufacturingEngine.verifyTelemetryChain(telemetry, 'MACH1');
    expect(error).toBe('CHAIN_INTEGRITY_FAILURE');
  });

  // Test 15: Rogue Plugin submits markPartAsManufactured(...SUCCESS) -> DECLARED ONLY -> NEVER physical proof
  it('Negative 15: Rogue Plugin submits markPartAsManufactured(...SUCCESS) -> DECLARED ONLY -> NEVER physical proof', () => {
    const rogueEvaluation = PluginAuthorityBoundary.markPartAsManufactured('rogue-machining-plugin', PART_ID, 'SUCCESS');
    
    expect(rogueEvaluation.isAuthoritative).toBe(false);
    expect(rogueEvaluation.classification).toBe('DECLARED_ONLY');
    expect(rogueEvaluation.canCrossReleaseBoundary).toBe(false);
    expect(rogueEvaluation.reason).toContain('DECLARED_ONLY');
  });

  // Test 16: Truth Certificate forged with status=RELEASED -> verifier MUST ignore declared status -> recompute verdict -> FAIL
  it('Negative 16: Truth Certificate forged with status=RELEASED -> verifier MUST ignore declared status -> recompute verdict -> FAIL', () => {
    // Attacker crafts a certificate claiming RELEASED and PASS, but provides no evidence leaves
    const forgedCert = {
      certificateId: 'FORGED-RELEASE-CERT-007',
      certificateVersion: '2.0.0-PROD',
      engineeringObjectId: ENTITY_ID,
      engineeringObjectType: 'HYDRAULIC_ROTOR',
      projectId: PROJECT_ID,
      revisionId: REV_B_ID,
      cadRevisionHash: CAD_REV_B_HASH,
      canonicalGeometryHash: GEOM_REV_B_HASH,
      issuedAt: '2026-09-25T00:00:00.000Z',
      issuedBy: 'ATTACKER',
      artifactHash: CAD_REV_B_HASH,
      evidenceRootHash: 'FORGED_ROOT',
      evidenceLedgerRoot: 'LEDGER_ROOT',
      attestationRoot: 'ATT_ROOT',
      chainOfCustodyRoot: 'CUST_ROOT',
      sourceArtifacts: [],
      dependencyArtifacts: [],
      verificationResults: [],
      certificationScope: [CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
      verdict: TruthVerdict.PASS, // False claim!
      verdictReason: 'Attacker says all good',
      reproducibility: true,
      determinism: true,
      provenanceIntegrity: true,
      tamperEvidence: true,
      limitations: [],
      unprovenClaims: [],
      excludedClaims: [],
      issuer: 'ATTACKER',
      status: 'RELEASED', // False declared status!
      certificateHash: 'HASH',
      certificateSignature: 'SIG_CERT_HASH'
    };

    // Verifier is called:
    const result = EngineeringTruthCertificateVerifier.verify(forgedCert as any, []);
    
    // Verifier must NOT return PASS just because status === 'RELEASED'!
    expect(result.overallVerdict).not.toBe(TruthVerdict.PASS);
    expect(result.overallVerdict).toBe(TruthVerdict.INVALID); // Signature/hash fail-closed!
  });
});
