import { describe, it, expect, beforeEach } from 'vitest';
import { RevisionEngine } from '../../../revision/RevisionEngine';
import { SimulationEngine } from '../../../simulation/SimulationEngine';
import { SimulationExecutionRegistry } from '../../../simulation/SimulationExecutionRegistry';
import { SimulationIdentityService } from '../../../simulation/SimulationIdentityService';
import { PhysicalManufacturingEngine } from '../../../manufacturing/pma/PhysicalManufacturingEngine';
import { HardAcceptanceGatePMA001 } from '../../../manufacturing/pma/HardAcceptanceGatePMA001';
import { EngineeringTruthCertificateEngine } from '../EngineeringTruthCertificateEngine';
import { EngineeringTruthCertificateVerifier } from '../EngineeringTruthCertificateVerifier';
import { TruthVerdict, CertificationScope } from '../types';
import { RevisionLifecycleState } from '../../../revision/types';
import { CanonicalDerivedArtifactBinding } from '../../../topology/CanonicalDerivedArtifactBinding';
import * as crypto from 'crypto';

/**
 * SECP Industrial OS — Hydraulic Pump Benchmark
 * 
 * FAIL-CLOSED ADVERSARIAL BENCHMARK
 * Proves that the Engineering Truth Thread is tamper-evident and fail-closed
 * across all six Gates.
 */
describe('Hydraulic Pump Engineering Truth Thread Benchmark', () => {
  let revisionEngine: RevisionEngine;
  let revA: any;
  let revB: any;
  let scenarioA: any;
  let simulationA: any;

  beforeEach(() => {
    SimulationExecutionRegistry.clear();
    revisionEngine = new RevisionEngine();
    SimulationIdentityService.initialize(revisionEngine);

    // 1. GATE 1: Setup Valid Revision A
    revA = revisionEngine.createRevision({
      revisionId: 'PUMP-REV-A',
      entityId: 'HYDRAULIC-PUMP-001',
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER-01',
      content: { geometry: 'PUMP_V1_GEOM' },
      snapshot: {
        geometryState: {
          parameters: { boreDiameter: 50 },
          features: ['Housing', 'Bore', 'Inlet', 'Outlet'],
          topologyHash: 'TOPO-PUMP-A',
          geometryHash: 'GEOM-PUMP-A'
        }
      }
    } as any);

    // Release Rev A
    revisionEngine.addApproval(revA.revisionId, {
      approvalId: 'APP-A',
      revisionId: revA.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER-01',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Bore design verified'
    });
    revisionEngine.setValidationState(revA.revisionId, 'SIMULATED');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Reviewing');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approved');
    revA = revisionEngine.releaseRevision(revA.revisionId, 'ADMIN', 'Initial Release');

    // Setup Simulation Scenario for Rev A
    scenarioA = {
      id: 'SIM-PUMP-A',
      revision: 1,
      geometry: { modelId: 'HYDRAULIC-PUMP-001', geometryHash: 'GEOM-PUMP-A', hash: revA.revisionHash },
      parameters: [{ name: 'boreDiameter', value: 50 }],
      material: { materialId: 'STEEL-440C' },
      mesh: { hash: 'MESH-PUMP-A' },
      boundaryConditions: [],
      loads: [{ type: 'PRESSURE', value: 3000 }], // 3000 PSI
      solver: { solverId: 'NS_SOLVER' }
    };

    // Run Simulation A while it is the latest released
    simulationA = SimulationEngine.runScenario(scenarioA);

    // 2. GATE 1: Setup Valid Revision B (Different Bore)
    revB = revisionEngine.createRevision({
      revisionId: 'PUMP-REV-B',
      entityId: 'HYDRAULIC-PUMP-001',
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'B',
      revisionNumber: 2,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'ENGINEER-01',
      content: { geometry: 'PUMP_V2_GEOM' },
      snapshot: {
        geometryState: {
          parameters: { boreDiameter: 55 },
          features: ['Housing', 'Bore', 'Inlet', 'Outlet'],
          topologyHash: 'TOPO-PUMP-B',
          geometryHash: 'GEOM-PUMP-B'
        }
      }
    } as any);

    // Release Rev B
    revisionEngine.addApproval(revB.revisionId, {
      approvalId: 'APP-B',
      revisionId: revB.revisionId,
      role: 'ENGINEER',
      actorId: 'APPROVER-01',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Increased bore for high flow'
    });
    revisionEngine.setValidationState(revB.revisionId, 'SIMULATED');
    revisionEngine.transitionState(revB.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Reviewing');
    revisionEngine.transitionState(revB.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approved');
    revB = revisionEngine.releaseRevision(revB.revisionId, 'ADMIN', 'Revision B Release');

    // Run Simulation A
    // simulationA already run in setup
  });

  it('HAPPY PATH: Should verify a valid Truth Thread for Revision A', () => {
    // 3. GATE 4: Manufacturing Execution for Rev A
    const telemetry = [
        PhysicalManufacturingEngine.signTelemetry({
            deviceId: 'CNC-01',
            machineId: 'MACHINE-01',
            sequenceNumber: 0,
            timestamp: new Date().toISOString(),
            previousHash: 'GENESIS',
            payload: { operation: 'BORE_DRILLING', rpm: 1200, feed: 0.1 }
        })
    ];

    const metrology = {
        inspectionId: 'INSP-01',
        dimensionalMeasurements: { 'bore_diameter': 0.002 },
        inspectionEvidenceHash: 'METROLOGY_HASH_A'
    };

    const pmaReq = {
        digitalEngineeringTruthHash: revA.revisionHash,
        releasedArtifactGCodeHash: 'GCODE-PUMP-A',
        loadedProgramHash: 'GCODE-PUMP-A',
        machineId: 'MACHINE-01',
        controllerId: 'CTRL-01',
        toolId: 'TOOL-01',
        stockId: 'STOCK-01',
        manufacturingRunId: 'RUN-01',
        physicalPartId: 'PART-SERIAL-A-001',
        telemetryChain: telemetry,
        metrologyProof: metrology as any,
        canonicalGeometryHash: 'GEOM-PUMP-A',
        actualGeometryHash: 'GEOM-PUMP-A',
        predecessorAttestationHash: 'NONE',
        hasHardwareRootOfTrust: true,
        requiredTolerances: { 'bore_diameter': 0.01 },
        cadRevisionHash: revA.revisionHash,
        derivedArtifactBinding: simulationA.derivedArtifactBinding
    };

    const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
    expect(pmaVerdict.status).toBe('ACCEPTED');

    // 4. GATE 6: Truth Certificate Issue
    const certificate = EngineeringTruthCertificateEngine.issue({
        engineeringObjectId: 'HYDRAULIC-PUMP-001',
        engineeringObjectType: 'PHYSICAL_PART',
        projectId: 'PROJECT-H1',
        revisionId: 'PUMP-REV-A',
        cadRevisionHash: revA.revisionHash,
        canonicalGeometryHash: 'GEOM-PUMP-A',
        artifactHash: 'GCODE-PUMP-A',
        evidenceRecords: [
            { evidenceType: 'CAD', artifactContentHash: revA.revisionHash, entityId: 'HYDRAULIC-PUMP-001' },
            { evidenceType: 'SIMULATION', artifactContentHash: simulationA.provenanceHash, entityId: 'HYDRAULIC-PUMP-001' },
            { evidenceType: 'MANUFACTURING', artifactContentHash: 'RUN-01', entityId: 'HYDRAULIC-PUMP-001' },
            { evidenceType: 'METROLOGY', artifactContentHash: 'INSP-01', entityId: 'HYDRAULIC-PUMP-001' }
        ],
        verificationSummaries: [
            { status: 'SUCCESS', details: 'Design verified' },
            { status: 'SUCCESS', details: 'Manufacturing verified' }
        ],
        scope: [CertificationScope.GEOMETRY, CertificationScope.SIMULATION_RESULT, CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
        issuer: 'SECP-AUTHORITY'
    });

    // Verify Certificate
    const verification = EngineeringTruthCertificateVerifier.verify(certificate);
    expect(verification.overallVerdict).toBe(TruthVerdict.PASS);
  });

  describe('ADVERSARIAL BOUNDARY BREAKING TESTS', () => {

    it('A1: B + Simulation(A) → REJECT (Cross-revision simulation replay)', () => {
      // Attacker tries to use a successful simulation of Rev A to approve Rev B
      const pmaReq = {
        digitalEngineeringTruthHash: revB.revisionHash, // Target is Rev B
        releasedArtifactGCodeHash: 'GCODE-PUMP-B',
        loadedProgramHash: 'GCODE-PUMP-B',
        machineId: 'MACHINE-01',
        controllerId: 'CTRL-01',
        toolId: 'TOOL-01',
        stockId: 'STOCK-01',
        manufacturingRunId: 'RUN-01',
        physicalPartId: 'PART-SERIAL-B-001',
        telemetryChain: [PhysicalManufacturingEngine.signTelemetry({
            deviceId: 'CNC-01', machineId: 'MACHINE-01', sequenceNumber: 0, timestamp: new Date().toISOString(), previousHash: 'GENESIS',
            payload: { operation: 'BORE_DRILLING' }
        })],
        metrologyProof: { inspectionId: 'INSP-02', dimensionalMeasurements: { 'bore_diameter': 55.002 }, inspectionEvidenceHash: 'METROLOGY_HASH_B' } as any,
        canonicalGeometryHash: 'GEOM-PUMP-B',
        actualGeometryHash: 'GEOM-PUMP-B',
        predecessorAttestationHash: 'NONE',
        hasHardwareRootOfTrust: true,
        cadRevisionHash: revB.revisionHash,
        derivedArtifactBinding: simulationA.derivedArtifactBinding // Replaying Simulation A!
      };

      const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
      expect(pmaVerdict.status).toBe('REJECTED');
      expect(pmaVerdict.reason).toBe('DERIVED_ARTIFACT_REVISION_MISMATCH');
    });

    it('A2: B + CAM(A) → REJECT (Cross-revision CAM toolpath replay)', () => {
      // Attacker tries to use Rev A's G-Code/Toolpath on Rev B's process
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
          cadRevisionHash: revA.revisionHash,
          canonicalGeometryHash: 'GEOM-PUMP-A',
          artifactKind: 'CAM_TOOLPATH',
          derivationIdentity: 'CAM-ENGINE',
          artifactContentHash: 'GCODE-PUMP-A'
      });

      const pmaReq = {
        digitalEngineeringTruthHash: revB.revisionHash, // Target is Rev B
        releasedArtifactGCodeHash: 'GCODE-PUMP-A', // Using G-Code A
        loadedProgramHash: 'GCODE-PUMP-A',
        machineId: 'MACHINE-01',
        controllerId: 'CTRL-01',
        toolId: 'TOOL-01',
        stockId: 'STOCK-01',
        manufacturingRunId: 'RUN-01',
        physicalPartId: 'PART-SERIAL-B-001',
        telemetryChain: [PhysicalManufacturingEngine.signTelemetry({
            deviceId: 'CNC-01', machineId: 'MACHINE-01', sequenceNumber: 0, timestamp: new Date().toISOString(), previousHash: 'GENESIS',
            payload: { operation: 'BORE_DRILLING' }
        })],
        metrologyProof: { inspectionId: 'INSP-02', dimensionalMeasurements: { 'bore_diameter': 55.002 }, inspectionEvidenceHash: 'METROLOGY_HASH_B' } as any,
        canonicalGeometryHash: 'GEOM-PUMP-B',
        actualGeometryHash: 'GEOM-PUMP-B',
        predecessorAttestationHash: 'NONE',
        hasHardwareRootOfTrust: true,
        cadRevisionHash: revB.revisionHash,
        derivedArtifactBinding: bindingA // Replaying CAM A!
      };

      const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
      expect(pmaVerdict.status).toBe('REJECTED');
      expect(pmaVerdict.reason).toBe('DERIVED_ARTIFACT_REVISION_MISMATCH');
    });

    it('A3: B + forged Machine telemetry → REJECT (Telemetry HMAC violation)', () => {
       const forgedTelemetry = [
           {
               deviceId: 'CNC-01',
               machineId: 'MACHINE-01',
               sequenceNumber: 0,
               timestamp: new Date().toISOString(),
               previousHash: 'GENESIS',
               payload: { operation: 'BORE_DRILLING' },
               signature: 'INVALID_SIGNATURE'
           }
       ];

       const pmaReq = {
           digitalEngineeringTruthHash: revB.revisionHash,
           releasedArtifactGCodeHash: 'GCODE-PUMP-B',
           loadedProgramHash: 'GCODE-PUMP-B',
           machineId: 'MACHINE-01',
           controllerId: 'CTRL-01',
           toolId: 'TOOL-01',
           stockId: 'STOCK-01',
           manufacturingRunId: 'RUN-01',
           physicalPartId: 'PART-SERIAL-B-001',
           telemetryChain: forgedTelemetry as any,
           metrologyProof: { inspectionId: 'INSP-02', dimensionalMeasurements: { 'bore_diameter': 55.002 }, inspectionEvidenceHash: 'METROLOGY_HASH_B' } as any,
           canonicalGeometryHash: 'GEOM-PUMP-B',
           actualGeometryHash: 'GEOM-PUMP-B',
           predecessorAttestationHash: 'NONE',
           hasHardwareRootOfTrust: true,
           cadRevisionHash: revB.revisionHash
       };

       const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
       expect(pmaVerdict.status).toBe('REJECTED');
       expect(pmaVerdict.reason).toBe('TELEMETRY_INTEGRITY_FAILURE');
    });

    it('A4: B + wrong Part Serial → REJECT (Physical identity violation)', () => {
        // Envelopes bound to PART-B-001, but req has PART-B-999
        const manufacturingEnvelope = {
            partId: 'PART-B-001',
            gCodeHash: 'GCODE-B',
            loadedProgramHash: 'GCODE-B',
            telemetryRoot: 'ROOT'
        };

        const pmaReq = {
            digitalEngineeringTruthHash: revB.revisionHash,
            releasedArtifactGCodeHash: 'GCODE-B',
            loadedProgramHash: 'GCODE-B',
            machineId: 'MACHINE-01',
            controllerId: 'CTRL-01',
            toolId: 'TOOL-01',
            stockId: 'STOCK-01',
            manufacturingRunId: 'RUN-01',
            physicalPartId: 'PART-B-999', // Mismatch!
            telemetryChain: [PhysicalManufacturingEngine.signTelemetry({
                deviceId: 'CNC-01', machineId: 'MACHINE-01', sequenceNumber: 0, timestamp: new Date().toISOString(), previousHash: 'GENESIS',
                payload: { operation: 'DRILLING' }
            })],
            metrologyProof: { inspectionId: 'INSP-02', dimensionalMeasurements: { 'bore_diameter': 55.002 }, inspectionEvidenceHash: 'METROLOGY_HASH_B' } as any,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            actualGeometryHash: 'GEOM-PUMP-B',
            predecessorAttestationHash: 'NONE',
            hasHardwareRootOfTrust: true,
            cadRevisionHash: revB.revisionHash,
            manufacturingEnvelope: manufacturingEnvelope as any
        };

        const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
        expect(pmaVerdict.status).toBe('REJECTED');
        expect(pmaVerdict.reason).toBe('PHYSICAL_IDENTITY_MISMATCH');
    });

    it('A5: B + unsigned CMM result → REJECT (Hardware Root of Trust missing)', () => {
        const pmaReq = {
            digitalEngineeringTruthHash: revB.revisionHash,
            releasedArtifactGCodeHash: 'GCODE-PUMP-B',
            loadedProgramHash: 'GCODE-PUMP-B',
            machineId: 'MACHINE-01',
            controllerId: 'CTRL-01',
            toolId: 'TOOL-01',
            stockId: 'STOCK-01',
            manufacturingRunId: 'RUN-01',
            physicalPartId: 'PART-B-001',
            telemetryChain: [PhysicalManufacturingEngine.signTelemetry({
                deviceId: 'CNC-01', machineId: 'MACHINE-01', sequenceNumber: 0, timestamp: new Date().toISOString(), previousHash: 'GENESIS',
                payload: { operation: 'BORE_DRILLING' }
            })],
            metrologyProof: { inspectionId: 'INSP-02', dimensionalMeasurements: { 'bore_diameter': 55.002 }, inspectionEvidenceHash: 'METROLOGY_HASH_B' } as any,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            actualGeometryHash: 'GEOM-PUMP-B',
            predecessorAttestationHash: 'NONE',
            hasHardwareRootOfTrust: false, // TPM/HSM turned off
            cadRevisionHash: revB.revisionHash
        };

        const pmaVerdict = HardAcceptanceGatePMA001.executeGate(pmaReq);
        expect(pmaVerdict.status).toBe('REJECTED');
        expect(pmaVerdict.reason).toBe('HARDWARE_ROOT_OF_TRUST = UNAVAILABLE');
    });

    it('A6: B + valid CMM but no Simulation → REJECT (Chain incompleteness)', () => {
        const certificate = EngineeringTruthCertificateEngine.issue({
            engineeringObjectId: 'HYDRAULIC-PUMP-001',
            engineeringObjectType: 'PHYSICAL_PART',
            projectId: 'PROJECT-H1',
            revisionId: 'PUMP-REV-B',
            cadRevisionHash: revB.revisionHash,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            artifactHash: 'GCODE-PUMP-B',
            evidenceRecords: [
                { evidenceType: 'CAD', artifactContentHash: revB.revisionHash, entityId: 'HYDRAULIC-PUMP-001' },
                // Simulation evidence is MISSING
                { evidenceType: 'MANUFACTURING', artifactContentHash: 'RUN-02', entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'METROLOGY', artifactContentHash: 'INSP-02', entityId: 'HYDRAULIC-PUMP-001' }
            ],
            verificationSummaries: [{ status: 'SUCCESS', details: 'Partial verification' }],
            scope: [CertificationScope.GEOMETRY, CertificationScope.SIMULATION_RESULT, CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
            issuer: 'SECP-AUTHORITY'
        });

        const verification = EngineeringTruthCertificateVerifier.verify(certificate);
        expect(verification.overallVerdict).toBe(TruthVerdict.UNPROVEN);
        expect(verification.findings.some(f => f.includes('EVIDENCE_CHAIN_INCOMPLETE'))).toBe(true);
    });

    it('A7: B + valid everything except one Evidence Root → REJECT (Merkle root dissonance)', () => {
        const certificate = EngineeringTruthCertificateEngine.issue({
            engineeringObjectId: 'HYDRAULIC-PUMP-001',
            engineeringObjectType: 'PHYSICAL_PART',
            projectId: 'PROJECT-H1',
            revisionId: 'PUMP-REV-B',
            cadRevisionHash: revB.revisionHash,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            artifactHash: 'GCODE-PUMP-B',
            evidenceRecords: [
                { evidenceType: 'CAD', artifactContentHash: revB.revisionHash, entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'SIMULATION', artifactContentHash: 'SIM-B-HASH', entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'MANUFACTURING', artifactContentHash: 'RUN-02', entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'METROLOGY', artifactContentHash: 'INSP-02', entityId: 'HYDRAULIC-PUMP-001' }
            ],
            verificationSummaries: [{ status: 'SUCCESS', details: 'Verified' }],
            scope: [CertificationScope.GEOMETRY, CertificationScope.SIMULATION_RESULT, CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
            issuer: 'SECP-AUTHORITY'
        });

        // TAMPER: Manually change the declared evidenceRootHash in the certificate
        const tamperedCert = { ...certificate, evidenceRootHash: 'FORGED_ROOT_HASH' };

        const verification = EngineeringTruthCertificateVerifier.verify(tamperedCert);
        expect(verification.overallVerdict).toBe(TruthVerdict.INVALID); // because signature check fails when hash changes, or root dissonance
        expect(verification.findings.some(f => f.includes('EVIDENCE_ROOT_DISSONANCE') || f.includes('TAMPER_DETECTED'))).toBe(true);
    });

    it('A8: Valid Truth Thread ↓ tamper with ONE artifact ↓ Certificate verification ↓ FAIL', () => {
        const simulationB = SimulationEngine.runScenario({
            ...scenarioA,
            id: 'SIM-PUMP-B',
            revision: 2,
            geometry: { modelId: 'HYDRAULIC-PUMP-001', geometryHash: 'GEOM-PUMP-B', hash: revB.revisionHash },
            parameters: [{ name: 'boreDiameter', value: 55 }]
        });

        const certificate = EngineeringTruthCertificateEngine.issue({
            engineeringObjectId: 'HYDRAULIC-PUMP-001',
            engineeringObjectType: 'PHYSICAL_PART',
            projectId: 'PROJECT-H1',
            revisionId: 'PUMP-REV-B',
            cadRevisionHash: revB.revisionHash,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            artifactHash: 'GCODE-PUMP-B',
            evidenceRecords: [
                { evidenceType: 'CAD', artifactContentHash: revB.revisionHash, entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'SIMULATION', artifactContentHash: simulationB.provenanceHash, entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'MANUFACTURING', artifactContentHash: 'RUN-02', entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'METROLOGY', artifactContentHash: 'INSP-02', entityId: 'HYDRAULIC-PUMP-001' }
            ],
            verificationSummaries: [{ status: 'SUCCESS', details: 'Verified' }],
            scope: [CertificationScope.GEOMETRY, CertificationScope.SIMULATION_RESULT, CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
            issuer: 'SECP-AUTHORITY'
        });

        // TAMPER: Change the content hash of one evidence leaf without updating the Merkle root
        if (certificate.evidenceLeaves && certificate.evidenceLeaves.length > 1) {
            certificate.evidenceLeaves[1].artifactContentHash = 'MALICIOUS_SUBSTITUTION';
        }

        const verification = EngineeringTruthCertificateVerifier.verify(certificate);
        // Either integrity check fails (if leaf is part of cert hash) or evidence root check fails
        expect(verification.overallVerdict).not.toBe(TruthVerdict.PASS);
        expect(verification.findings.some(f => f.includes('EVIDENCE_ROOT_DISSONANCE') || f.includes('TAMPER_DETECTED'))).toBe(true);
    });

    it('A9: Valid Truth Thread ↓ replace one evidence root ↓ Certificate verification ↓ FAIL', () => {
        const simulationB = SimulationEngine.runScenario({
            ...scenarioA,
            id: 'SIM-PUMP-B',
            revision: 2,
            geometry: { modelId: 'HYDRAULIC-PUMP-001', geometryHash: 'GEOM-PUMP-B', hash: revB.revisionHash },
            parameters: [{ name: 'boreDiameter', value: 55 }]
        });

        const certificate = EngineeringTruthCertificateEngine.issue({
            engineeringObjectId: 'HYDRAULIC-PUMP-001',
            engineeringObjectType: 'PHYSICAL_PART',
            projectId: 'PROJECT-H1',
            revisionId: 'PUMP-REV-B',
            cadRevisionHash: revB.revisionHash,
            canonicalGeometryHash: 'GEOM-PUMP-B',
            artifactHash: 'GCODE-PUMP-B',
            evidenceRecords: [
                { evidenceType: 'CAD', artifactContentHash: revB.revisionHash, entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'SIMULATION', artifactContentHash: simulationB.provenanceHash, entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'MANUFACTURING', artifactContentHash: 'RUN-02', entityId: 'HYDRAULIC-PUMP-001' },
                { evidenceType: 'METROLOGY', artifactContentHash: 'INSP-02', entityId: 'HYDRAULIC-PUMP-001' }
            ],
            verificationSummaries: [{ status: 'SUCCESS', details: 'Verified' }],
            scope: [CertificationScope.GEOMETRY, CertificationScope.SIMULATION_RESULT, CertificationScope.MANUFACTURING, CertificationScope.PHYSICAL_METROLOGY],
            issuer: 'SECP-AUTHORITY'
        });

        // TAMPER: Replace attestation root
        const tamperedCert = { ...certificate, attestationRoot: 'FORGED_ATTESTATION_ROOT' };

        const verification = EngineeringTruthCertificateVerifier.verify(tamperedCert);
        expect(verification.overallVerdict).not.toBe(TruthVerdict.PASS);
        expect(verification.findings.some(f => f.includes('ATTESTATION_TAMPERED') || f.includes('TAMPER_DETECTED'))).toBe(true);
    });
  });
});
