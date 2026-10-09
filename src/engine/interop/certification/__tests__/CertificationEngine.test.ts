/**
 * SECP Industrial OS v2 — CAD Fidelity Certification Tests
 * PATCH-041: formal CAD Fidelity Certification
 */

import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';
import { CertificationEngine } from '../CertificationEngine';
import { CertificationGate } from '../CertificationGate';
import { CrossKernelFixtures } from '../../cross-kernel/__fixtures__/CrossKernelFixtures';
import { CrossKernelPipeline } from '../../cross-kernel/CrossKernelPipeline';
import { TestExternalCADKernelAdapter, NullExternalCADKernelAdapter } from '../../cross-kernel/ExternalCADKernelAdapter';

describe('PATCH-041: CAD Fidelity Certification Framework', () => {

  it('generates a valid certification from real evidence', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();
    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    const cert = await CertificationEngine.certify({
      secpVersion: '1.0.0',
      kernelVersion: '1.0.0',
      formatVersions: { 'STEP_AP242': '2020' },
      scope: {
        formats: ['STEP_AP242'],
        operations: ['IMPORT', 'EXPORT', 'ROUND_TRIP'],
        engineeringDomains: ['GEOMETRY', 'TOPOLOGY', 'PMI']
      },
      evidencePackages: [pkg],
      adversarialEvidence: [{ category: 'TINY_EDGES', status: 'PASSED', evidenceReference: 'EVID_ADV_001' }],
      tamperEvidence: [{ test: 'METADATA_TAMPER', detected: true, evidenceReference: 'EVID_TAMPER_001' }]
    });

    expect(cert.overallVerdict).toBeDefined();
    expect(cert.signature.signatureValue).toBeDefined();

    const verification = CertificationGate.validate(cert);
    expect(verification.isValid).toBe(true);
    expect(verification.integrityVerified).toBe(true);
    
    const report = CertificationGate.generateReport(cert);
    expect(report).toContain('SECP CAD FIDELITY CERTIFICATION');
    expect(report).toContain('GEOMETRY');
  });

  it('rejects certification with tampered overall verdict (Anti-Fabrication)', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const pkg = await CrossKernelPipeline.execute(sourceDoc, new NullExternalCADKernelAdapter());
    
    const cert = await CertificationEngine.certify({
      secpVersion: '1.0.0',
      kernelVersion: '1.0.0',
      formatVersions: {},
      scope: {
        formats: [],
        operations: [],
        engineeringDomains: ['GEOMETRY']
      },
      evidencePackages: [pkg]
    });

    // Attempt to falsely promote verdict to CERTIFIED
    const tamperedCert = JSON.parse(JSON.stringify(cert));
    tamperedCert.overallVerdict = 'CERTIFIED';

    const verification = CertificationGate.validate(tamperedCert);
    expect(verification.isValid).toBe(false);
    expect(verification.reason).toContain('integrity violation');
  });

  it('rejects certification that hides failed capabilities (Rule 3)', async () => {
     // Mock a failed package
     const pkg = await CrossKernelPipeline.execute(CrossKernelFixtures.getValidModel(), new NullExternalCADKernelAdapter());
     pkg.differenceReport.categories.GEOMETRY.fidelityStatus = 'FAIL';
     
     const cert = await CertificationEngine.certify({
      secpVersion: '1.0.0',
      kernelVersion: '1.0.0',
      formatVersions: {},
      scope: {
        formats: [],
        operations: [],
        engineeringDomains: ['GEOMETRY']
      },
      evidencePackages: [pkg]
    });

    // The engine should have marked it FAILED or PARTIALLY_CERTIFIED
    expect(cert.overallVerdict).not.toBe('CERTIFIED');

    // Manually reconstruct a "certified" but invalid cert (bypassing the engine but failing the gate)
    const invalidCert = JSON.parse(JSON.stringify(cert));
    invalidCert.overallVerdict = 'CERTIFIED';
    
    // We also need to fix the signature to pass the first few checks, but the gate logic will catch the semantic lie
    invalidCert.signature.signatureValue = crypto.createHash('sha256').update(invalidCert.canonicalHash + invalidCert.signature.signedAt).digest('hex');

    const verification = CertificationGate.validate(invalidCert);
    // It should be invalid because GEOMETRY is FAILED in the list, yet overall is CERTIFIED
    // Wait, if I tampered with overallVerdict, the canonicalHash check would catch it first.
    // If I want to test the semantic check, I'd need to have a "validly signed" but "semantically impossible" cert.
    
    // Let's re-hash it to pass integrity
    const { signature: _, canonicalHash: __, evidenceHash: ___, ...rest } = invalidCert;
    const sortedKeys = Object.keys(rest).sort();
    const newCanonical = crypto.createHash('sha256').update(JSON.stringify(rest, sortedKeys)).digest('hex');
    invalidCert.canonicalHash = newCanonical;
    invalidCert.signature.signatureValue = crypto.createHash('sha256').update(newCanonical + invalidCert.signature.signedAt).digest('hex');

    const verification2 = CertificationGate.validate(invalidCert);
    expect(verification2.isValid).toBe(false);
    expect(verification2.reason).toContain('overall CERTIFIED cannot hide FAILED');
  });

  it('downgrades certification level when evidence is insufficient', async () => {
    const pkg = await CrossKernelPipeline.execute(CrossKernelFixtures.getValidModel(), new NullExternalCADKernelAdapter());
    
    const cert = await CertificationEngine.certify({
      secpVersion: '1.0.0',
      kernelVersion: '1.0.0',
      formatVersions: {},
      scope: {
        formats: [],
        operations: [],
        engineeringDomains: ['GEOMETRY']
      },
      evidencePackages: [pkg]
    });

    // level should be 1 because it's only structural (no genuine external kernel)
    expect(cert.overallLevel).toBe(1);
    
    const verification = CertificationGate.validate(cert);
    expect(verification.level).toBe(1);
  });
});
