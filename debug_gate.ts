import { HardAcceptanceGate170 } from './src/engine/certification/truth/HardAcceptanceGate170';
import { EngineeringTruthCertificateVerifier } from './src/engine/certification/truth/EngineeringTruthCertificateVerifier';
import { EngineeringTruthCertificateEngine } from './src/engine/certification/truth/EngineeringTruthCertificateEngine';
import { VerificationStatus } from './src/engine/verification/portal/types';
import { CertificationScope } from './src/engine/certification/truth/types';

async function debug() {
    const validCert = EngineeringTruthCertificateEngine.issue({
      engineeringObjectId: "ART-CAD-101",
      engineeringObjectType: "GEOMETRY",
      projectId: "PROJ-777",
      revisionId: "REV-A",
      artifactHash: "SHA256:777888999",
      evidenceRecords: [
        { evidenceType: 'CAD', engineeringObjectId: 'ART-CAD-101', verificationStatus: 'VERIFIED' } as any,
        { evidenceType: 'VERIFICATION', engineeringObjectId: 'VER-101', verificationStatus: 'VERIFIED' } as any
      ],
      verificationSummaries: [
        { patchId: 'PATCH-168', status: VerificationStatus.VERIFIED, findings: 0, timestamp: new Date().toISOString() }
      ],
      scope: [CertificationScope.GEOMETRY_INTEGRITY, CertificationScope.REPRODUCIBILITY],
      issuer: "SECP_CENTRAL_AUTH"
    });

    const verify1 = EngineeringTruthCertificateVerifier.verify(validCert);
    console.log('Overall Verdict:', verify1.overallVerdict);
    console.log('Findings:', JSON.stringify(verify1.findings, null, 2));
    
    if (validCert.evidenceLeaves) {
        console.log('Leaf 1 partId:', validCert.evidenceLeaves[0].partId);
        console.log('Leaf 2 partId:', validCert.evidenceLeaves[1].partId);
    }
}

debug();
