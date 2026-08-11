export type EvidenceStatus = 'VERIFIED_PASSED' | 'IN_REVIEW' | 'NON_COMPLIANT';

export interface ProvenanceEvidenceNode {
  step: 'REQUIREMENT' | 'DESIGN' | 'CALCULATION' | 'SIMULATION' | 'TEST' | 'EVIDENCE' | 'VALIDATION';
  title: string;
  description: string;
  artifactRef: string; // e.g. 'REQ-HYDRO-350', 'CAD-FEAT-FLANGE-01', 'FEA-SIM-RESULT-08'
  hashSha256: string;
  status: EvidenceStatus;
  authorOrAuditor: string;
  timestamp: string;
  standardsBadge: string; // e.g. 'ISO 9001 / ASME B31.8'
}

export interface CertificationMatrix {
  certificateId: string;
  projectName: string;
  targetStandard: string;
  overallComplianceScorePct: number;
  isFullyCertified: boolean;
  chain: ProvenanceEvidenceNode[];
}

export class CertificationEngine {
  /**
   * Generates mock ISO/ASME/AS9100 engineering compliance chain
   */
  public static getCertificationMatrix(): CertificationMatrix {
    const chain: ProvenanceEvidenceNode[] = [
      {
        step: 'REQUIREMENT',
        title: 'High Pressure Shell Hoop Stress Limit (ASME B31.8)',
        description: 'Shell geometry must withstand maximum allowable operating pressure (MAOP) of 18.5 MPa with a safety factor ≥ 2.0.',
        artifactRef: 'REQ-SECP-2026-001',
        hashSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Systems Engineering Team',
        timestamp: '2026-08-01 09:00',
        standardsBadge: 'ASME B31.8',
      },
      {
        step: 'DESIGN',
        title: '3D B-Rep Parametric Flange CAD Geometry',
        description: 'Outer diameter 250mm, wall thickness 18.5mm, 12 bolt hole array modeled in SECP CAD kernel.',
        artifactRef: 'CAD-BREP-MAIN-FLANGE-V3',
        hashSha256: 'b2c3d4e5f6a17890123456789abcdef0123456789abcdef0123456789abcdef1',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Marcus Vance (Lead Designer)',
        timestamp: '2026-08-03 14:15',
        standardsBadge: 'ISO 10303 STEP',
      },
      {
        step: 'CALCULATION',
        title: 'Barlow Pressure & Section Modulus Analytical Proof',
        description: 'Calculated hoop stress σ = 125.0 MPa against material yield strength of 250.0 MPa (Safety Factor SF = 2.00).',
        artifactRef: 'CALC-SECP-BARLOW-99',
        hashSha256: 'c3d4e5f6a1b27890123456789abcdef0123456789abcdef0123456789abcdef2',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'SECP Physics Core',
        timestamp: '2026-08-05 11:30',
        standardsBadge: 'ASME Boiler Code',
      },
      {
        step: 'SIMULATION',
        title: '3D Structural FEA Stress & Deformed Mesh Solution',
        description: 'Von Mises peak stress solved at 122.4 MPa using SECP 4-node quad FEA mesh engine.',
        artifactRef: 'SIM-FEA-MESH-SOLVE-04',
        hashSha256: 'd4e5f6a1b2c37890123456789abcdef0123456789abcdef0123456789abcdef3',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Dr. Sarah Chen (FEA Lead)',
        timestamp: '2026-08-07 16:20',
        standardsBadge: 'NAFEMS Verified',
      },
      {
        step: 'TEST',
        title: 'Digital Twin Telemetry Bench Test Data Sync',
        description: 'Hydraulic pressure test bench telemetry recorded at 22.0 MPa burst peak for 300 seconds.',
        artifactRef: 'TEST-BENCH-STREAM-882',
        hashSha256: 'e5f6a1b2c3d47890123456789abcdef0123456789abcdef0123456789abcdef4',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Test Facility Bench #3',
        timestamp: '2026-08-09 10:45',
        standardsBadge: 'ISO/IEC 17025',
      },
      {
        step: 'EVIDENCE',
        title: 'Cryptographic Provenance Artifact Bundle',
        description: 'Unified cryptographic bundle containing CAD STEP file, FEA raw matrices, and telemetry log hashes.',
        artifactRef: 'EVID-BUNDLE-SHA-900',
        hashSha256: 'f6a1b2c3d4e57890123456789abcdef0123456789abcdef0123456789abcdef5',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'SECP Evidence Provenance Engine',
        timestamp: '2026-08-10 18:00',
        standardsBadge: 'AS9100D Compliance',
      },
      {
        step: 'VALIDATION',
        title: 'Chief Compliance Auditor Final Sign-off Certificate',
        description: 'Final aerospace engineering compliance validation signed off with cryptographic keys.',
        artifactRef: 'CERT-SECP-FINAL-PASS',
        hashSha256: 'a1f6b2c3d4e57890123456789abcdef0123456789abcdef0123456789abcdef6',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Global Quality Compliance Board',
        timestamp: '2026-08-11 08:30',
        standardsBadge: 'ISO 9001:2015',
      },
    ];

    return {
      certificateId: 'CERT-SECP-2026-AERO-001',
      projectName: 'SECP Turbo Pump Hydraulic Housing Assembly',
      targetStandard: 'AS9100D / ASME B31.8 / ISO 9001',
      overallComplianceScorePct: 100,
      isFullyCertified: true,
      chain,
    };
  }
}
