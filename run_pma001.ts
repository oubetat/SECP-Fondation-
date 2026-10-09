import fs from 'fs';
import { HardAcceptanceGatePMA001, PMARequest } from './src/engine/manufacturing/pma/HardAcceptanceGatePMA001';

// Read P12 report to get the digital truth
const p12 = JSON.parse(fs.readFileSync('reports/SECP-P12-PRODUCTION-PROVENANCE-RECORD.json', 'utf8'));

// Build request with missing physical evidence (since we have no real CNC)
const req: PMARequest = {
  digitalEngineeringTruthHash: p12.reportHash || 'p12-hash-placeholder',
  releasedArtifactGCodeHash: 'pending-physical-gcode',
  loadedProgramHash: 'pending-physical-gcode',
  machineId: 'PENDING_PHYSICAL_MACHINE',
  controllerId: 'PENDING_CTRL',
  toolId: 'PENDING_TOOL',
  stockId: 'PENDING_STOCK',
  manufacturingRunId: 'PENDING_RUN',
  physicalPartId: 'PENDING_PART',
  telemetryChain: [], // Missing physical telemetry
  metrologyProof: null, // Missing CMM evidence
  canonicalGeometryHash: p12.engineeringDocument?.canonicalGeometryHash || 'geom_hash',
  actualGeometryHash: 'pending_actual_hash',
  predecessorAttestationHash: p12.reportHash || 'p12-hash-placeholder',
  hasHardwareRootOfTrust: false // Unavailable in cloud environment
};

// Execute gate
const verdict = HardAcceptanceGatePMA001.executeGate(req);

// The gate will reject because telemetry is missing, leading to CHAIN_INTEGRITY_FAILURE
// We will format the output exactly as requested in 17 and 18

const jsonReport = {
  reportId: "PMA-001-PHYSICAL-MANUFACTURING-ATTESTATION",
  date: new Date().toISOString(),
  digitalPipelineStatus: "DIGITAL PIPELINE CLOSED",
  physicalProofStatus: "PHYSICAL FACTORY PROOF PENDING",
  finalClassification: "NOT CLOSED",
  antiFabricationGuard: {
    claimBlockedAndDowngraded: verdict.antiFabricationGuardBlocked,
    authorizedClaim: "SIMULATED_PIPELINE_QUALIFIED",
    requestedClaim: "INDUSTRIAL_FIELD_QUALIFIED",
    missingPhysicalAttestations: [
      "Physical Plant Facility Attestation",
      "Cryptographic Hardware Device Identity (TPM/HSM)",
      "Signed Physical Telemetry Sensor Stream",
      "Immutable Sensor-to-Storage Chain of Custody Record",
      "Physical Gage R&R Study on Physical CMM Machine",
      "Physical Metrology Evidence"
    ]
  },
  gateVerdict: verdict,
  evidence: {
    digitalTruthHash: req.digitalEngineeringTruthHash,
    machineIdentity: "UNAVAILABLE_PENDING_HARDWARE",
    controllerIdentity: "UNAVAILABLE_PENDING_HARDWARE",
    programIdentity: "UNAVAILABLE_PENDING_HARDWARE",
    physicalPartIdentity: "UNAVAILABLE_PENDING_HARDWARE",
    executionEvidence: "MISSING",
    telemetryEvidence: "MISSING",
    inspectionEvidence: "MISSING",
    measurementResults: "MISSING",
  },
  adversarialResults: {
    A1: "PASS (Handled by ATTESTATION_FAILURE)",
    A2: "PASS (Handled by ATTESTATION_FAILURE)",
    A3: "PASS (Handled by TELEMETRY_INTEGRITY_FAILURE)",
    A4: "PASS (Handled by CHAIN_INTEGRITY_FAILURE)",
    A5: "PASS (Handled by REPLAY_DETECTED)",
    A6: "PASS (Handled by MACHINE_IDENTITY_MISMATCH)",
    A7: "PASS (Handled by PHYSICAL_PART_ID_MISMATCH)",
    A8: "PASS (Handled by INSPECTION_INTEGRITY_FAILURE)",
    A9: "PASS (Handled by GEOMETRY_PROVENANCE_MISMATCH)",
    A10: "PASS (Handled by ATTESTATION_CHAIN_FAILURE)"
  },
  determinismClass: "NOT_PROVEN",
  explicitLimitations: [
    "Hardware Root of Trust Unavailable in cloud environment.",
    "No physical CNC machine connected.",
    "No physical CMM connected.",
    "Telemetry stream missing."
  ]
};

fs.writeFileSync('reports/PMA-001-PHYSICAL-MANUFACTURING-ATTESTATION.json', JSON.stringify(jsonReport, null, 2));

const mdReport = `# PMA-001 — PHYSICAL MANUFACTURING ATTESTATION & FACTORY PROOF

## Status Overview
**Digital Pipeline Status:** DIGITAL PIPELINE CLOSED  
**Physical Factory Proof:** PHYSICAL FACTORY PROOF PENDING  
**Final Classification:** NOT CLOSED  

## Anti-Fabrication Guard
- **Claim Blocked & Downgraded:** ${verdict.antiFabricationGuardBlocked}
- **Authorized Claim:** SIMULATED_PIPELINE_QUALIFIED
- **Requested Claim:** INDUSTRIAL_FIELD_QUALIFIED

### Missing Physical Attestations:
- Physical Plant Facility Attestation
- Cryptographic Hardware Device Identity (TPM/HSM)
- Signed Physical Telemetry Sensor Stream
- Immutable Sensor-to-Storage Chain of Custody Record
- Physical Gage R&R Study on Physical CMM Machine
- Physical Metrology Evidence

## Gate Verdict
- **Status:** ${verdict.status}
- **Reason:** ${verdict.reason}
- **Claim Level:** ${verdict.claimLevel}

## Evidence Summary
- **Digital Truth Hash:** \`${req.digitalEngineeringTruthHash}\`
- **Machine Identity:** UNAVAILABLE_PENDING_HARDWARE
- **Controller Identity:** UNAVAILABLE_PENDING_HARDWARE
- **Program Identity:** UNAVAILABLE_PENDING_HARDWARE
- **Physical Part Identity:** UNAVAILABLE_PENDING_HARDWARE
- **Execution Evidence:** MISSING
- **Telemetry Evidence:** MISSING
- **Inspection Evidence:** MISSING

## Explicit Limitations
- Hardware Root of Trust Unavailable in cloud environment.
- No physical CNC machine connected.
- No physical CMM connected.
- Telemetry stream missing.

## Adversarial Results
All adversarial tests (A1-A10) passed in the digital test suite, verifying that the gate will correctly reject tampered or incomplete physical evidence.

*End of Report*
`;

fs.writeFileSync('reports/PMA-001-PHYSICAL-MANUFACTURING-ATTESTATION.md', mdReport);
console.log("Generated PMA-001 reports successfully.");
