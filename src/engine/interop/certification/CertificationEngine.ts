/**
 * SECP Industrial OS v2 — CAD Fidelity Certification Engine
 * PATCH-041: formal CAD Fidelity Certification
 */

import * as crypto from 'crypto';
import { 
  CADFidelityCertification, 
  CertificationLevel, 
  CertificationVerdict, 
  CertificationStatus,
  CapabilityAssessment,
  FormatCapabilityMatrix
} from './CertificationTypes';
import { 
  CrossKernelEvidencePackage, 
  DifferenceCategory, 
  FidelityStatus 
} from '../cross-kernel/CrossKernelTypes';

export interface CertificationInput {
  secpVersion: string;
  kernelVersion: string;
  formatVersions: Record<string, string>;
  scope: {
    formats: string[];
    operations: ('IMPORT' | 'EXPORT' | 'ROUND_TRIP')[];
    engineeringDomains: DifferenceCategory[];
  };
  evidencePackages: CrossKernelEvidencePackage[];
  adversarialEvidence?: { category: string; status: 'PASSED' | 'FAILED' | 'UNPROVEN'; evidenceReference: string }[];
  tamperEvidence?: { test: string; detected: boolean; evidenceReference: string }[];
}

export class CertificationEngine {

  public static async certify(input: CertificationInput): Promise<CADFidelityCertification> {
    const issuedAt = new Date().toISOString();
    const validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(); // 180 days validity
    const certificationId = `CERT_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    const capabilities = this.assessCapabilities(input.evidencePackages, input.scope.engineeringDomains);
    const formatMatrix = this.buildFormatMatrix(input.evidencePackages, input.scope.formats);
    const externalKernelMatrix = this.buildExternalKernelMatrix(input.evidencePackages);
    
    const overallLevel = this.calculateCertificationLevel(input, capabilities);
    const overallVerdict = this.calculateOverallVerdict(capabilities, input.evidencePackages);

    const certification: Partial<CADFidelityCertification> = {
      certificationId,
      certificationVersion: '1.0.0',
      schemaVersion: 'SECP-CAD-CERT-v1.0.0',
      secpVersion: input.secpVersion,
      kernelVersion: input.kernelVersion,
      formatVersions: input.formatVersions,
      issuedAt,
      validUntil,
      scope: input.scope,
      capabilities,
      formatMatrix,
      testCorpus: {
        corpusVersion: 'v1.0.0', // Standardized SECP Interop Corpus
        cases: input.evidencePackages.map(pkg => ({
          caseId: pkg.sourceBaseline.objectId,
          caseVersion: pkg.sourceBaseline.revisionId,
          sourceHash: pkg.sourceArtifactHash,
          evidenceReference: pkg.packageId,
          verdict: this.mapVerdictToStatus(pkg.verdict)
        }))
      },
      externalKernelMatrix,
      adversarialResults: input.adversarialEvidence || [],
      tamperResults: input.tamperEvidence || [],
      overallVerdict,
      overallLevel
    };

    // Canonicalization and Hashing
    const canonicalContent = JSON.stringify(certification, Object.keys(certification).sort());
    const canonicalHash = crypto.createHash('sha256').update(canonicalContent).digest('hex');
    const evidenceHash = crypto.createHash('sha256').update(JSON.stringify(input.evidencePackages.map(p => p.packageId))).digest('hex');

    const finalCertification: CADFidelityCertification = {
      ...certification as CADFidelityCertification,
      signature: {
        signedAt: issuedAt,
        signingIdentity: 'SECP_CERTIFICATION_AUTHORITY_v1',
        signatureAlgorithm: 'SHA256-RSA-MOCK', // Production would use real HSM
        signatureValue: crypto.createHash('sha256').update(canonicalHash + issuedAt).digest('hex')
      },
      canonicalHash,
      evidenceHash
    };

    return finalCertification;
  }

  private static assessCapabilities(packages: CrossKernelEvidencePackage[], domains: DifferenceCategory[]): CapabilityAssessment[] {
    return domains.map(domain => {
      const statuses = packages.map(pkg => pkg.differenceReport.categories[domain]?.fidelityStatus || 'UNPROVEN');
      
      let status: CertificationStatus = 'UNPROVEN';
      if (statuses.length > 0) {
        if (statuses.every(s => s === 'PROVEN')) status = 'PROVEN';
        else if (statuses.some(s => s === 'FAIL')) status = 'FAILED';
        else if (statuses.some(s => s === 'PARTIAL')) status = 'PARTIAL';
      }

      return {
        capability: domain,
        status,
        evidenceReference: `EV_REF_AGGREGATED_${domain}`,
        limitations: status === 'PARTIAL' ? ['Some edge cases exhibited representation changes'] : []
      };
    });
  }

  private static buildFormatMatrix(packages: CrossKernelEvidencePackage[], formats: string[]): FormatCapabilityMatrix[] {
    return formats.map(format => ({
      format,
      capabilities: [] // In a real impl, we'd filter packages by format
    }));
  }

  private static buildExternalKernelMatrix(packages: CrossKernelEvidencePackage[]) {
    const kernels = new Map<string, CrossKernelEvidencePackage[]>();
    for (const pkg of packages) {
      const key = `${pkg.externalKernelIdentity.vendor}_${pkg.externalKernelIdentity.kernelName}`;
      if (!kernels.has(key)) kernels.set(key, []);
      kernels.get(key)!.push(pkg);
    }

    return Array.from(kernels.entries()).map(([_, pkgs]) => ({
      identity: pkgs[0].externalKernelIdentity,
      status: pkgs[0].externalKernelStatus,
      capabilities: [] // Capability assessment per kernel
    }));
  }

  private static calculateCertificationLevel(input: CertificationInput, capabilities: CapabilityAssessment[]): CertificationLevel {
    const statuses = new Map(capabilities.map(c => [c.capability, c.status]));
    
    // Level 6: Forensic (Cross-kernel + Adversarial + Tamper)
    const hasGenuineAvailable = input.evidencePackages.some(p => p.externalKernelStatus === 'AVAILABLE' && !p.externalKernelIdentity.isTestHarness);
    if (input.adversarialEvidence?.length && input.tamperEvidence?.length && hasGenuineAvailable) {
       return CertificationLevel.LEVEL_6_FORENSIC;
    }

    // Level 5: Cross-Kernel
    if (hasGenuineAvailable) {
      return CertificationLevel.LEVEL_5_CROSS_KERNEL;
    }

    // Level 3/4 check
    if (statuses.get('GEOMETRY') === 'PROVEN' && statuses.get('TOPOLOGY') === 'PROVEN') {
      return statuses.get('PMI') === 'PROVEN' ? CertificationLevel.LEVEL_4_ENGINEERING : CertificationLevel.LEVEL_3_TOPOLOGICAL;
    }

    return CertificationLevel.LEVEL_1_STRUCTURAL;
  }

  private static calculateOverallVerdict(capabilities: CapabilityAssessment[], packages: CrossKernelEvidencePackage[]): CertificationVerdict {
    if (packages.some(p => p.verdict === 'INVALID')) return 'INVALID';
    if (capabilities.some(c => c.status === 'FAILED')) return 'FAILED';
    if (capabilities.every(c => c.status === 'PROVEN')) return 'CERTIFIED';
    if (capabilities.some(c => c.status === 'PARTIAL')) return 'PARTIALLY_CERTIFIED';
    
    return 'UNPROVEN';
  }

  private static mapVerdictToStatus(v: string): CertificationStatus {
    switch (v) {
      case 'PASS': return 'PROVEN';
      case 'FAIL': return 'FAILED';
      case 'PARTIAL': return 'PARTIAL';
      default: return 'UNPROVEN';
    }
  }
}
