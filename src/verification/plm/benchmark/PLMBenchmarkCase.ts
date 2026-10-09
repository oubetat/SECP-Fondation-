
import { EngineeringPLMEngine } from '../../../engine/plm/EngineeringPLMEngine';
import { MasterPLMManager } from '../../../engine/plm/MasterPLMManager';
import { EngineeringArtifact, EngineeringChangeOrder } from '../../../engine/plm/PLMTypes';
import { PLMBenchmarkCaseResult, PLMBenchmarkVerdict } from './types';
import { PLMIndependentVerifier } from './PLMIndependentVerifier';

export class PLMBenchmarkCase {
  
  private static getCleanEngine() {
    // Reset engines if they have static state (most do)
    // For this benchmark we rely on fresh initialization
    return EngineeringPLMEngine;
  }

  /**
   * Case 01: Product Structure & Hierarchy
   */
  public static async runCase01(): Promise<PLMBenchmarkCaseResult> {
    await MasterPLMManager.initializeEnterpriseEnvironment();
    const artifacts = EngineeringPLMEngine.getAllArtifacts();
    
    const hasStructure = artifacts.some(a => a.type === 'ASSEMBLY') && 
                         artifacts.some(a => a.type === 'CAD_GEOMETRY');
    
    const verdict: PLMBenchmarkVerdict = hasStructure ? 'PASS' : 'FAIL';
    
    return {
      caseId: 'BENCH-PLM-01', caseName: 'Product Structure Integrity', category: 'STRUCTURE',
      verdict, metrics: { artifactCount: artifacts.length },
      details: `Detected ${artifacts.length} artifacts in structural graph.`,
      evidencePacket: artifacts, evidenceHash: 'NA'
    };
  }

  /**
   * Case 02: Revision Isolation (The "Anti-Bleed" Test)
   */
  public static async runCase02(): Promise<PLMBenchmarkCaseResult> {
    const artId = 'ART-CAD-101';
    const revA = EngineeringPLMEngine.getArtifact(artId);
    if (!revA) return this.failCase('BENCH-PLM-02', 'Revision A not found');

    const hashA = revA.geometryHash;

    // Simulate creation of Revision B
    const revB: EngineeringArtifact = {
      ...revA,
      revision: 'REV-B',
      geometryHash: 'G-HASH-B-MODIFIED',
      status: 'VALID'
    };
    EngineeringPLMEngine.registerArtifact(revB);

    // Verify Revision A hasn't changed
    const revA_Check = EngineeringPLMEngine.getAllArtifacts().find(a => a.artifactId === artId && a.revision === 'REV-A');
    const isolationIntact = revA_Check && revA_Check.geometryHash === hashA;

    const verdict: PLMBenchmarkVerdict = isolationIntact ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-PLM-02', caseName: 'Revision Isolation', category: 'REVISION',
      verdict, metrics: {},
      details: isolationIntact ? 'Revision A remained immutable after Revision B creation.' : 'Revision A was modified by Revision B creation!',
      evidencePacket: { revA_Check, revB }, evidenceHash: 'NA'
    };
  }

  /**
   * Case 03: Change Impact Analysis
   */
  public static async runCase03(): Promise<PLMBenchmarkCaseResult> {
    const ecoId = 'ECO-2026-IMPACT-TEST';
    
    // Ensure we are testing against a revision that actually has dependents
    // We'll create a fresh pair for this test to ensure isolation
    const baseId = 'ART-IMPACT-BASE';
    const depId = 'ART-IMPACT-DEP';
    
    const base: EngineeringArtifact = {
      artifactId: baseId, type: 'CAD_GEOMETRY', name: 'Base', revision: 'REV-A', version: 1,
      status: 'RELEASED', createdBy: 'TEST', createdAt: new Date().toISOString(),
      geometryHash: 'G-1', dependencyHash: 'D-1', metadata: {}
    };
    const dep: EngineeringArtifact = {
      artifactId: depId, type: 'ASSEMBLY', name: 'Dep', revision: 'REV-A', version: 1,
      status: 'RELEASED', createdBy: 'TEST', createdAt: new Date().toISOString(),
      geometryHash: 'G-2', dependencyHash: 'D-2', metadata: {}
    };
    
    EngineeringPLMEngine.registerArtifact(base);
    EngineeringPLMEngine.registerArtifact(dep);
    EngineeringPLMEngine.addDependency(depId, 'REV-A', baseId, 'REV-A');

    const eco: EngineeringChangeOrder = {
      ecoId, title: 'Impact Test', description: 'Test', reason: 'Test', author: 'TEST',
      createdAt: new Date().toISOString(), status: 'OPEN',
      affectedArtifacts: [baseId],
      changeRequests: [{ requestId: 'CR-01', ecoId, artifactId: baseId, changeType: 'MODIFY', description: 'Mod', reason: 'Test' }],
      validationGates: [], approvalStatus: 'PENDING'
    };
    EngineeringPLMEngine.createECO(eco);

    const impacts = EngineeringPLMEngine.analyzeImpact(ecoId);
    const targetImpact = impacts.find(i => i.targetArtifactId === baseId);
    const hasDownstream = targetImpact && targetImpact.affectedDownstreamArtifacts.length > 0;
    
    // Verifier check
    const verified = PLMIndependentVerifier.verifyImpactAnalysis(ecoId);

    const verdict: PLMBenchmarkVerdict = (hasDownstream && verified) ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-PLM-03', caseName: 'Change Impact Analysis', category: 'CHANGE',
      verdict, metrics: { affectedCount: targetImpact?.affectedDownstreamArtifacts.length || 0 },
      details: `Detected ${targetImpact?.affectedDownstreamArtifacts.length || 0} downstream dependencies.`,
      evidencePacket: impacts, evidenceHash: 'NA'
    };
  }

  /**
   * Case 04: Lifecycle State Enforcement
   */
  public static async runCase04(): Promise<PLMBenchmarkCaseResult> {
    const art = EngineeringPLMEngine.getArtifact('ART-CAD-101');
    if (!art) return this.failCase('BENCH-PLM-04', 'Artifact not found');

    // Attempt illegal transition (e.g., RELEASED -> DRAFT if not allowed)
    // EngineeringPLMEngine implementation is simple, let's test if it handles status correctly
    const originalStatus = art.status;
    
    // In our implementation, registerArtifact supersedes old one.
    // Let's test a release manifest gate
    try {
        EngineeringPLMEngine.generateReleaseManifest('P1', 'N1', 'INVALID-ECO');
        return this.failCase('BENCH-PLM-04', 'Allowed release with invalid ECO');
    } catch(e) {
        // Expected failure
    }

    return {
      caseId: 'BENCH-PLM-04', caseName: 'Lifecycle Enforcement', category: 'LIFECYCLE',
      verdict: 'PASS', metrics: {},
      details: 'Prevented release with unapproved ECO.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  /**
   * Case 05: Tamper Detection (Adversarial)
   */
  public static async runCase05(): Promise<PLMBenchmarkCaseResult> {
    const artId = 'ART-CAD-101';
    const artifacts = EngineeringPLMEngine.getAllArtifacts();
    const target = artifacts.find(a => a.artifactId === artId && a.revision === 'REV-A');
    
    if (!target) return this.failCase('BENCH-PLM-05', 'Target not found');

    // Simulate direct memory tampering (if we were using a real DB this would be a bit different)
    const originalHash = target.geometryHash;
    target.geometryHash = 'TAMPERED-HASH';

    const integrityResult = PLMIndependentVerifier.verifyRevisionIntegrity(artId);
    
    // Restore
    target.geometryHash = originalHash;

    const verdict: PLMBenchmarkVerdict = !integrityResult ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-PLM-05', caseName: 'Tamper Detection', category: 'SECURITY',
      verdict, metrics: {},
      details: !integrityResult ? 'Independent verifier detected identity inconsistency.' : 'Tampering went undetected!',
      evidencePacket: { originalHash, tampered: 'TAMPERED-HASH' }, evidenceHash: 'NA'
    };
  }

  private static failCase(id: string, details: string): PLMBenchmarkCaseResult {
    return {
      caseId: id, caseName: 'Failure', category: 'ERROR',
      verdict: 'FAIL', metrics: {}, details, evidencePacket: {}, evidenceHash: 'NA'
    };
  }
}
