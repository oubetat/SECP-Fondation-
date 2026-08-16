/**
 * SECP-102.3: Engineering Compliance, Governance & Audit Provenance Engine
 * Implements deterministic V-Model verification chains, cryptographic evidence nodes,
 * audit compliance scoring, and standards enforcement (AS9100D / ASME B31.8 / ISO 9001:2015).
 */

import { TelemetryHasher } from './telemetry/TelemetryHasher';

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

export interface CertificationAuditResult {
  isValid: boolean;
  computedScorePct: number;
  brokenLinkIndices: number[];
  unauthorizedTransitions: string[];
  chainDigestSha256: string;
  errors: string[];
}

export class CertificationEngine {
  private static computeNodeHash(node: Omit<ProvenanceEvidenceNode, 'hashSha256'>): string {
    const payload = `${node.step}:${node.artifactRef}:${node.title}:${node.authorOrAuditor}:${node.standardsBadge}:${node.status}`;
    return TelemetryHasher.hashString(payload);
  }

  /**
   * Generates deterministic ISO/ASME/AS9100 engineering compliance chain
   */
  public static getCertificationMatrix(): CertificationMatrix {
    const rawNodes: Omit<ProvenanceEvidenceNode, 'hashSha256'>[] = [
      {
        step: 'REQUIREMENT',
        title: 'High Pressure Shell Hoop Stress Limit (ASME B31.8)',
        description: 'Shell geometry must withstand maximum allowable operating pressure (MAOP) of 18.5 MPa with a safety factor >= 2.0.',
        artifactRef: 'REQ-SECP-2026-001',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Systems Engineering Team',
        timestamp: '2026-08-01 09:00:00Z',
        standardsBadge: 'ASME B31.8',
      },
      {
        step: 'DESIGN',
        title: '3D B-Rep Parametric Flange CAD Geometry',
        description: 'Outer diameter 250mm, wall thickness 18.5mm, 12 bolt hole array modeled in SECP CAD kernel.',
        artifactRef: 'CAD-BREP-MAIN-FLANGE-V3',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Marcus Vance (Lead Designer)',
        timestamp: '2026-08-03 14:15:00Z',
        standardsBadge: 'ISO 10303 STEP',
      },
      {
        step: 'CALCULATION',
        title: 'Barlow Pressure & Section Modulus Analytical Proof',
        description: 'Calculated hoop stress sigma = 125.0 MPa against material yield strength of 250.0 MPa (Safety Factor SF = 2.00).',
        artifactRef: 'CALC-SECP-BARLOW-99',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'SECP Physics Core',
        timestamp: '2026-08-05 11:30:00Z',
        standardsBadge: 'ASME Boiler Code',
      },
      {
        step: 'SIMULATION',
        title: '3D Structural FEA Stress & Deformed Mesh Solution',
        description: 'Von Mises peak stress solved at 122.4 MPa using SECP 4-node quad FEA mesh engine.',
        artifactRef: 'SIM-FEA-MESH-SOLVE-04',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Dr. Sarah Chen (FEA Lead)',
        timestamp: '2026-08-07 16:20:00Z',
        standardsBadge: 'NAFEMS Verified',
      },
      {
        step: 'TEST',
        title: 'Digital Twin Telemetry Bench Test Data Sync',
        description: 'Hydraulic pressure test bench telemetry recorded at 22.0 MPa burst peak for 300 seconds.',
        artifactRef: 'TEST-BENCH-STREAM-882',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Test Facility Bench #3',
        timestamp: '2026-08-09 10:45:00Z',
        standardsBadge: 'ISO/IEC 17025',
      },
      {
        step: 'EVIDENCE',
        title: 'Cryptographic Provenance Artifact Bundle',
        description: 'Unified cryptographic bundle containing CAD STEP file, FEA raw matrices, and telemetry log hashes.',
        artifactRef: 'EVID-BUNDLE-SHA-900',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'SECP Evidence Provenance Engine',
        timestamp: '2026-08-10 18:00:00Z',
        standardsBadge: 'AS9100D Compliance',
      },
      {
        step: 'VALIDATION',
        title: 'Chief Compliance Auditor Final Sign-off Certificate',
        description: 'Final aerospace engineering compliance validation signed off with cryptographic keys.',
        artifactRef: 'CERT-SECP-FINAL-PASS',
        status: 'VERIFIED_PASSED',
        authorOrAuditor: 'Global Quality Compliance Board',
        timestamp: '2026-08-11 08:30:00Z',
        standardsBadge: 'ISO 9001:2015',
      },
    ];

    const chain: ProvenanceEvidenceNode[] = rawNodes.map(node => ({
      ...node,
      hashSha256: this.computeNodeHash(node)
    }));

    return {
      certificateId: 'CERT-SECP-2026-AERO-001',
      projectName: 'SECP Turbo Pump Hydraulic Housing Assembly',
      targetStandard: 'AS9100D / ASME B31.8 / ISO 9001',
      overallComplianceScorePct: 100,
      isFullyCertified: true,
      chain,
    };
  }

  /**
   * Evaluates and audits a certification matrix against strict V-Model invariants
   */
  public static auditCertificationMatrix(matrix: CertificationMatrix): CertificationAuditResult {
    const errors: string[] = [];
    const brokenLinkIndices: number[] = [];
    const unauthorizedTransitions: string[] = [];

    if (!matrix.certificateId || !matrix.certificateId.trim()) {
      errors.push('Matrix missing certificateId');
    }
    if (!matrix.chain || matrix.chain.length === 0) {
      errors.push('Matrix contains empty provenance chain');
      return {
        isValid: false,
        computedScorePct: 0,
        brokenLinkIndices: [],
        unauthorizedTransitions: [],
        chainDigestSha256: '',
        errors
      };
    }

    const expectedOrder: ProvenanceEvidenceNode['step'][] = [
      'REQUIREMENT',
      'DESIGN',
      'CALCULATION',
      'SIMULATION',
      'TEST',
      'EVIDENCE',
      'VALIDATION'
    ];

    let passedCount = 0;

    matrix.chain.forEach((node, index) => {
      // 1. Check step sequence progression
      if (index < expectedOrder.length && node.step !== expectedOrder[index]) {
        unauthorizedTransitions.push(`Step index ${index} expected ${expectedOrder[index]} but received ${node.step}`);
      }

      // 2. Cryptographic node hash integrity
      const expectedHash = this.computeNodeHash({
        step: node.step,
        title: node.title,
        description: node.description,
        artifactRef: node.artifactRef,
        status: node.status,
        authorOrAuditor: node.authorOrAuditor,
        timestamp: node.timestamp,
        standardsBadge: node.standardsBadge
      });

      if (node.hashSha256 !== expectedHash) {
        brokenLinkIndices.push(index);
        errors.push(`Cryptographic hash mismatch at node ${index} (${node.artifactRef})`);
      }

      // 3. Status invariant
      if (node.status === 'VERIFIED_PASSED') {
        passedCount++;
      }
    });

    const computedScorePct = Math.round((passedCount / matrix.chain.length) * 100);
    const isValid = errors.length === 0 && unauthorizedTransitions.length === 0 && computedScorePct === 100 && matrix.isFullyCertified;

    const chainDigestSha256 = TelemetryHasher.hashString(
      matrix.chain.map(n => n.hashSha256).join(':')
    );

    return {
      isValid,
      computedScorePct,
      brokenLinkIndices,
      unauthorizedTransitions,
      chainDigestSha256,
      errors
    };
  }
}
