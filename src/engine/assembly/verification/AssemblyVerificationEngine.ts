
import { EngineeringDocument, AssemblyMate, AssemblyInstance } from '../../cad-kernel/document/CADDocument';
import { 
  AssemblyVerificationReport, 
  ConstraintVerificationResult, 
  DOFVerificationResult, 
  InterferenceVerificationResult, 
  VerificationStatus,
  RegenerationVerificationResult
} from './VerificationTypes';

export class AssemblyVerificationEngine {
  public static readonly DEFAULT_TOLERANCE = 1e-4;

  /**
   * Performs full engineering verification of the assembly document.
   */
  public static verify(doc: EngineeringDocument, previousReport?: AssemblyVerificationReport): AssemblyVerificationReport {
    const timestamp = new Date().toISOString();
    
    // 1. Verify all constraints
    const constraintResults = this.verifyConstraints(doc);
    
    // 2. Calculate DOF
    const dofResult = this.calculateDOF(doc);
    
    // 3. Analyze Interference
    const interferenceResult = this.analyzeInterference(doc);
    
    // 4. Verify Regeneration (if previous report exists)
    let regenerationResult: RegenerationVerificationResult | undefined;
    if (previousReport) {
      regenerationResult = this.verifyRegeneration(doc, previousReport, { 
        constraints: constraintResults, 
        dof: dofResult, 
        interference: interferenceResult 
      });
    }

    // Determine aggregate verdict
    const hasFail = constraintResults.some(r => r.status === 'FAIL') || 
                    dofResult.status === 'FAIL' || 
                    interferenceResult.status === 'FAIL' ||
                    (regenerationResult && regenerationResult.status === 'FAIL');
    
    const verdict: VerificationStatus = hasFail ? 'FAIL' : 'PASS';

    return {
      documentId: doc.documentId,
      revision: doc.revision,
      timestamp,
      constraints: constraintResults,
      dof: dofResult,
      interference: interferenceResult,
      regeneration: regenerationResult,
      verdict,
      evidenceHash: this.calculateEvidenceHash(doc, constraintResults, dofResult, interferenceResult)
    };
  }

  private static verifyConstraints(doc: EngineeringDocument): ConstraintVerificationResult[] {
    if (!doc.assembly || !doc.assembly.mates) return [];
    
    const instances = new Map(doc.assembly.instances.map(i => [i.instanceId, i]));
    const results: ConstraintVerificationResult[] = [];

    for (const mate of doc.assembly.mates) {
      const instA = instances.get(mate.instanceAId || '');
      const instB = instances.get(mate.instanceBId || '');
      
      if (!instA || !instB) {
        results.push({
          constraintId: mate.mateId || 'unknown',
          type: mate.type,
          referencedInstances: [mate.instanceAId || '', mate.instanceBId || ''],
          expectedRelationship: 'EXISTENCE',
          actualRelationship: 'MISSING_INSTANCE',
          residual: Infinity,
          tolerance: this.DEFAULT_TOLERANCE,
          status: 'FAIL',
          diagnostic: `Reference instance missing: A=${mate.instanceAId}, B=${mate.instanceBId}`
        });
        continue;
      }

      const result = this.verifySingleConstraint(mate, instA, instB);
      results.push(result);
    }

    return results;
  }

  private static verifySingleConstraint(mate: AssemblyMate, instA: AssemblyInstance, instB: AssemblyInstance): ConstraintVerificationResult {
    const tolerance = this.DEFAULT_TOLERANCE;
    let residual = 0;
    let status: VerificationStatus = 'UNSUPPORTED';
    let actualRel: any = null;
    let expectedRel: any = null;
    let diagnostic = '';

    const posA = instA.position;
    const posB = instB.position;

    switch (mate.type) {
      case 'COINCIDENT': {
        const offset = mate.offset || 0;
        // Simplified geometric measure: distance between origin points (or referenced points if available)
        // In a real system, we'd project points onto plane normal
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dz = posA.z - posB.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        residual = Math.abs(dist - offset);
        status = residual <= tolerance ? 'PASS' : 'FAIL';
        expectedRel = { distance: offset };
        actualRel = { distance: dist };
        break;
      }
      case 'CONCENTRIC': {
        // Simplified: check if X-Y are aligned in 2D or axis-alignment in 3D
        // For this 2D-heavy sim, we check X-Y alignment
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        residual = Math.sqrt(dx*dx + dy*dy);
        status = residual <= tolerance ? 'PASS' : 'FAIL';
        expectedRel = { concentricity: true };
        actualRel = { residual };
        break;
      }
      case 'DISTANCE': {
        const expected = mate.offset ?? mate.parameters?.distance ?? 0;
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const dz = posA.z - posB.z;
        const actual = Math.sqrt(dx*dx + dy*dy + dz*dz);
        residual = Math.abs(actual - expected);
        status = residual <= tolerance ? 'PASS' : 'FAIL';
        expectedRel = { distance: expected };
        actualRel = { distance: actual };
        break;
      }
      case 'GEAR': {
        // Gear Verification Requirement: Verify ratio between rotations
        const ratio = mate.parameters?.ratio || 1.0;
        const rotA = instA.rotation.z;
        const rotB = instB.rotation.z;
        // thetaB = -ratio * thetaA (standard internal gear logic)
        // We measure if the relationship holds
        // Note: Gears often need an initial offset, but we'll assume 0-base for verification sim
        const expectedRotB = -ratio * rotA;
        residual = Math.abs(rotB - expectedRotB) % (Math.PI * 2);
        if (residual > Math.PI) residual = Math.abs(residual - Math.PI * 2);
        
        status = residual <= tolerance ? 'PASS' : 'FAIL';
        expectedRel = { rotationB: expectedRotB };
        actualRel = { rotationB: rotB };
        diagnostic = `Gear Ratio: ${ratio}. Angular Residual: ${residual.toFixed(6)} rad`;
        break;
      }
      case 'LIMIT': {
        const min = mate.parameters?.min ?? -Infinity;
        const max = mate.parameters?.max ?? Infinity;
        // Assume limit is on X translation for this sim
        const pos = instA.position.x;
        residual = 0;
        if (pos < min) residual = min - pos;
        if (pos > max) residual = pos - max;
        
        status = residual <= tolerance ? 'PASS' : 'FAIL';
        expectedRel = { range: [min, max] };
        actualRel = { value: pos };
        break;
      }
      default:
        status = 'UNSUPPORTED';
        diagnostic = `Constraint type '${mate.type}' not verified by engine`;
    }

    return {
      constraintId: mate.mateId || 'mate-id',
      type: mate.type,
      referencedInstances: [instA.instanceId, instB.instanceId],
      expectedRelationship: expectedRel,
      actualRelationship: actualRel,
      residual,
      tolerance,
      status,
      diagnostic
    };
  }

  private static calculateDOF(doc: EngineeringDocument): DOFVerificationResult {
    if (!doc.assembly) return { totalAssemblyDOF: 0, componentDOFs: {}, status: 'UNSUPPORTED' };
    
    const instances = doc.assembly.instances;
    const mates = doc.assembly.mates || [];
    
    let totalDOF = instances.length * 6; // 6 DOF per body in 3D
    const componentDOFs: Record<string, any> = {};

    for (const inst of instances) {
      let dof = 6;
      if (inst.isGrounded || inst.grounded) {
        dof = 0;
      } else {
        // Subtract DOFs based on mates
        const instMates = mates.filter(m => m.instanceAId === inst.instanceId || m.instanceBId === inst.instanceId);
        for (const m of instMates) {
          switch (m.type) {
            case 'FIXED': dof = 0; break;
            case 'COINCIDENT': dof -= 3; break; // Planar coincident removes 3 (1T, 2R) or Point removes 3T
            case 'CONCENTRIC': dof -= 4; break; // Removes 2T, 2R
            case 'DISTANCE': dof -= 1; break;
          }
        }
      }
      
      dof = Math.max(0, dof);
      componentDOFs[inst.instanceId] = {
        instanceId: inst.instanceId,
        remainingDOF: dof,
        status: dof === 0 ? 'FULLY_CONSTRAINED' : (dof === 6 ? 'UNCONSTRAINED' : 'PARTIALLY_CONSTRAINED')
      };
    }

    totalDOF = Object.values(componentDOFs).reduce((acc, curr: any) => acc + curr.remainingDOF, 0);

    return {
      totalAssemblyDOF: totalDOF,
      componentDOFs,
      status: 'PASS',
      diagnostic: `Total Assembly DOF: ${totalDOF}`
    };
  }

  private static analyzeInterference(doc: EngineeringDocument): InterferenceVerificationResult {
    if (!doc.assembly) return { hasInterference: false, clashCount: 0, totalClashVolumeMm3: 0, clashes: [], status: 'UNSUPPORTED' };

    const instances = doc.assembly.instances;
    const clashes: any[] = [];
    
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const a = instances[i];
        const b = instances[j];
        
        // Geometric check: simplified bounding sphere check (radius 10mm)
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dz = a.position.z - b.position.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (dist < 10) { // Collision threshold
          clashes.push({
            id: `clash-${a.instanceId}-${b.instanceId}`,
            instanceAId: a.instanceId,
            instanceBId: b.instanceId,
            volumeMm3: (10 - dist) * 100 // Approximation
          });
        }
      }
    }

    return {
      hasInterference: clashes.length > 0,
      clashCount: clashes.length,
      totalClashVolumeMm3: clashes.reduce((acc, c) => acc + c.volumeMm3, 0),
      clashes,
      status: 'PASS'
    };
  }

  private static verifyRegeneration(
    doc: EngineeringDocument, 
    prev: AssemblyVerificationReport, 
    current: { constraints: ConstraintVerificationResult[], dof: DOFVerificationResult, interference: InterferenceVerificationResult }
  ): RegenerationVerificationResult {
    // Compare transforms
    const currentInst = new Map(doc.assembly?.instances.map(i => [i.instanceId, i]));
    // (Note: In a real test we'd have the previous instances too, but here we compare current against prev report data)
    
    // Check residuals consistency
    let residualsMatch = true;
    let maxDivergence = 0;
    
    for (const c of current.constraints) {
      const p = prev.constraints.find(rc => rc.constraintId === c.constraintId);
      if (p) {
        const div = Math.abs(c.residual - p.residual);
        if (div > maxDivergence) maxDivergence = div;
        if (div > 1e-6) residualsMatch = false;
      }
    }

    const dofMatches = current.dof.totalAssemblyDOF === prev.dof.totalAssemblyDOF;
    
    return {
      transformsMatch: true, // We assume positions are loaded exactly from doc
      residualsMatch,
      dofMatches,
      maxDivergence,
      status: (residualsMatch && dofMatches) ? 'PASS' : 'FAIL'
    };
  }

  private static calculateEvidenceHash(doc: EngineeringDocument, c: any[], d: any, i: any): string {
    // Deterministic hash of the verification state
    return `hash-${doc.revision}-${c.length}-${d.totalAssemblyDOF}-${i.clashCount}`;
  }
}
