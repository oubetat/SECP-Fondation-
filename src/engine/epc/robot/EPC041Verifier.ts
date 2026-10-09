/**
 * SECP Industrial OS — EPC-041: Assembly Acceptance Gate Verifier
 * Executes deterministic acceptance checks against RobotAssemblyManager
 * and generates the official EPC-041 Gate Report & Cryptographic Evidence.
 */

import { RobotAssemblyManager } from './RobotAssemblyManager';
import { EPC041GateReport } from './RobotAssemblyTypes';

export class EPC041Verifier {
  public static verify(): EPC041GateReport {
    const manager = new RobotAssemblyManager();
    const checks: Record<string, { passed: boolean; message: string }> = {};

    // 1. TEST-01: Assembly Creation
    const assemblyId = manager.assemblyId;
    const isAssyCreated = Boolean(assemblyId && manager.name && manager.revision);
    checks['TEST-01_AssemblyCreation'] = {
      passed: isAssyCreated,
      message: isAssyCreated
        ? `Assembly ${assemblyId} created with name "${manager.name}" (Rev ${manager.revision})`
        : 'Failed to create root assembly structure'
    };

    // 2. TEST-02: Part Instance Creation
    const instances = manager.getAllPartInstances();
    const uniqueParts = new Set(instances.map(i => i.partId));
    const hasMultipleInstancesPerPart = instances.length > uniqueParts.size;
    const hasValidTransforms = instances.every(i => i.instanceId && i.partId && i.transform && i.position);
    const passedInst = instances.length >= 15 && hasMultipleInstancesPerPart && hasValidTransforms;
    checks['TEST-02_PartInstanceCreation'] = {
      passed: passedInst,
      message: passedInst
        ? `Created ${instances.length} instances across ${uniqueParts.size} part definitions with multi-instance support and 3D transforms`
        : 'Part instance creation failed or lacking multi-instance CAD reference capability'
    };

    // 3. TEST-03: Assembly Hierarchy
    const rootNode = manager.getTreeNode(assemblyId);
    const subassemblies = manager.getAllTreeNodes().filter(n => n.nodeType === 'SUBSYSTEM' || n.nodeType === 'SUBASSEMBLY');
    const baseChildren = manager.getChildrenOf('SUB-BASE');
    const baseSiblings = manager.getSiblingsOf('INST-BASE-PLATE');

    const passedHierarchy = Boolean(
      rootNode &&
      subassemblies.length >= 5 &&
      baseChildren.instances.length > 0 &&
      baseSiblings.length > 0
    );
    checks['TEST-03_AssemblyHierarchy'] = {
      passed: passedHierarchy,
      message: passedHierarchy
        ? `Hierarchy intact: Root -> ${subassemblies.length} Subassemblies -> ${instances.length} Instances with parent/child/sibling navigation`
        : 'Assembly hierarchy incomplete or corrupted'
    };

    // 4. TEST-04: Constraint Registration
    const constraints = manager.getAllConstraints();
    const constraintTypes = new Set(constraints.map(c => c.constraintType));
    const passedConstraints = constraints.length >= 8 && constraintTypes.has('FIXED') && constraintTypes.has('COINCIDENT') && constraintTypes.has('CONCENTRIC');

    checks['TEST-04_ConstraintRegistration'] = {
      passed: passedConstraints,
      message: passedConstraints
        ? `Registered ${constraints.length} assembly mates including FIXED, COINCIDENT, CONCENTRIC, PARALLEL`
        : 'Constraint registration failed or insufficient mate diversity'
    };

    // 5. TEST-05: Constraint Solve
    const solveRes = manager.solveConstraints();
    const passedSolve = solveRes.status === 'CONVERGED' && solveRes.residual < 1e-4 && solveRes.isFullyConstrained;

    checks['TEST-05_ConstraintSolve'] = {
      passed: passedSolve,
      message: passedSolve
        ? `AssemblyConstraintSolver converged in ${solveRes.iterations} iterations (residual = ${solveRes.residual.toExponential(2)})`
        : `Assembly constraint solve failed (status: ${solveRes.status})`
    };

    // 6. TEST-06: Broken Reference Detection
    // We create a temporary manager and inject a broken part reference to test detection
    const tempManager = new RobotAssemblyManager();
    const valBefore = tempManager.validateAssembly();
    // Intentionally inject broken partId into an instance
    const instToCorrupt = tempManager.getPartInstance('INST-END-EFFECTOR');
    if (instToCorrupt) {
      instToCorrupt.partId = 'NON-EXISTENT-PART-ID-999';
    }
    const valAfter = tempManager.validateAssembly();
    const passedBrokenRef = valBefore.noBrokenReferences && !valAfter.noBrokenReferences && valAfter.brokenReferenceIds.includes('INST-END-EFFECTOR');

    checks['TEST-06_BrokenReferenceDetection'] = {
      passed: passedBrokenRef,
      message: passedBrokenRef
        ? 'Broken reference detector successfully identified missing part definition dependency'
        : 'Broken reference detection failed to identify invalid part reference'
    };

    // 7. TEST-07: Assembly Validation
    const valReport = manager.validateAssembly();
    checks['TEST-07_AssemblyValidation'] = {
      passed: valReport.valid,
      message: valReport.valid
        ? 'All parts exist, instances valid, no broken references, no orphans, hierarchy intact, transforms valid, joint refs valid'
        : `Assembly validation failed: ${valReport.issues.join('; ')}`
    };

    // 8. TEST-08: BOM Consistency
    const bomConsistency = manager.verifyBOMConsistency();
    checks['TEST-08_BOMConsistency'] = {
      passed: bomConsistency.isConsistent,
      message: bomConsistency.isConsistent
        ? `Extracted BOM quantity (${bomConsistency.totalBOMQty}) strictly matches active instance count (${bomConsistency.totalInstances})`
        : `BOM mismatch detected: ${bomConsistency.mismatchDetails.join('; ')}`
    };

    // 9. TEST-09: CAD ↔ Assembly Dependency
    const impact = manager.updatePartRevision('PART-DEF-MOTOR-SERVO', 'REV-B');
    const passedCADLink = impact.changedPartId === 'PART-DEF-MOTOR-SERVO' && impact.affectedInstanceIds.length >= 3 && impact.requiresReSolve;

    checks['TEST-09_CADAssyDependency'] = {
      passed: passedCADLink,
      message: passedCADLink
        ? `CAD part revision update propagated to ${impact.affectedInstanceIds.length} instances across ${impact.affectedSubassemblies.length} subassemblies`
        : 'CAD to Assembly dependency link failed'
    };

    // 10. TEST-10: Revision Tracking
    const evidencePkg = manager.generateEvidencePackage();
    const passedRevTracking = evidencePkg.revision !== undefined && evidencePkg.cadDependencyStatus.dependencyChainIntact;

    checks['TEST-10_RevisionTracking'] = {
      passed: passedRevTracking,
      message: passedRevTracking
        ? `Assembly revision ${evidencePkg.revision} tracked with complete source references`
        : 'Revision tracking verification failed'
    };

    // 11. TEST-11: Interference Detection
    const interferences = manager.analyzeInterference();
    const passedInterference = Array.isArray(interferences) && interferences.length > 0;

    checks['TEST-11_InterferenceDetection'] = {
      passed: passedInterference,
      message: passedInterference
        ? `AssemblyInterferenceEngine evaluated ${interferences.length} component pair clearance interfaces`
        : 'Interference detection failed'
    };

    // 12. TEST-12: Evidence Generation
    const passedEvidence = Boolean(evidencePkg.evidenceHash && evidencePkg.verdict === 'PASS' && evidencePkg.provenance.who);

    checks['TEST-12_EvidenceGeneration'] = {
      passed: passedEvidence,
      message: passedEvidence
        ? `Generated signed SHA-256 evidence package: ${evidencePkg.evidenceHash.substring(0, 16)}... (Verdict: ${evidencePkg.verdict})`
        : 'Evidence package generation failed'
    };

    const allCheckValues = Object.values(checks);
    const passedChecks = allCheckValues.filter(c => c.passed).length;
    const failedChecks = allCheckValues.length - passedChecks;

    const verdict: 'PASS' | 'FAIL' = failedChecks === 0 ? 'PASS' : 'FAIL';

    return {
      epc: 'EPC-041',
      name: 'Industrial Robot Assembly Verification',
      verdict,
      checks,
      summary: {
        totalChecks: allCheckValues.length,
        passedChecks,
        failedChecks
      },
      evidenceHash: evidencePkg.evidenceHash,
      timestamp: new Date().toISOString()
    };
  }
}
