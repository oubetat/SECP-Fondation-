// SECP Industrial OS v2 — Physics Identity Service & Consistency Verifier
import {
  PhysicsState,
  PhysicsStateStatus,
  ConstraintIdentity,
  FEMMeshIdentity,
  PhysicsProvenance,
  PhysicsEvidence
} from './types';
import { CanonicalPhysicsSerializer } from './CanonicalPhysicsSerializer';

export interface ConsistencyReport {
  valid: boolean;
  verdict: PhysicsStateStatus;
  errors: string[];
}

export class PhysicsIdentityService {
  // 1. Verify Geometry Consistency
  public static verifyGeometryConsistency(
    physicsGeometryHash: string,
    geometryTwinHash: string
  ): { valid: boolean; error?: string } {
    if (physicsGeometryHash !== geometryTwinHash) {
      return {
        valid: false,
        error: `PHYSICS_GEOMETRY_MISMATCH: Physics geometry hash [${physicsGeometryHash}] does not match GeometryTwin hash [${geometryTwinHash}]`
      };
    }
    return { valid: true };
  }

  // 2. Verify Geometry Freshness
  public static verifyGeometryFreshness(
    geometryRevisionUsed: string,
    geometryRevisionNew: string
  ): { fresh: boolean; error?: string } {
    if (geometryRevisionUsed !== geometryRevisionNew) {
      return {
        fresh: false,
        error: `PHYSICS_GEOMETRY_STALE: Geometry revision changed from ${geometryRevisionUsed} to ${geometryRevisionNew}`
      };
    }
    return { fresh: true };
  }

  // 3. Verify Material Consistency
  public static verifyMaterialConsistency(
    physicsMaterialRevision: string,
    qualifiedMaterialRevision: string
  ): { valid: boolean; error?: string } {
    if (physicsMaterialRevision !== qualifiedMaterialRevision) {
      return {
        valid: false,
        error: `PHYSICS_MATERIAL_MISMATCH: Physics material revision [${physicsMaterialRevision}] does not match qualified revision [${qualifiedMaterialRevision}]`
      };
    }
    return { valid: true };
  }

  // 4. Verify Constraint Integrity
  public static verifyConstraintIntegrity(constraints: ConstraintIdentity[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (const c of constraints) {
      if (seenIds.has(c.constraintId)) {
        errors.push(`CONSTRAINT_CONFLICT: Duplicate constraint ID detected: ${c.constraintId}`);
      }
      seenIds.add(c.constraintId);

      // Check DOF validity
      if (c.degreesOfFreedom.length !== 6) {
        errors.push(`CONSTRAINT_CONFLICT: Invalid degrees of freedom length for ${c.constraintId}. Expected 6, got ${c.degreesOfFreedom.length}`);
      }

      // Check if completely unconstrained or contradictory
      const constrainedDOFs = c.degreesOfFreedom.filter(Boolean).length;
      if (constrainedDOFs === 0 && c.type !== 'ROLLER') {
        errors.push(`CONSTRAINT_CONFLICT: Constraint ${c.constraintId} specifies 0 constrained degrees of freedom`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 5. Verify Mesh Freshness
  public static verifyMeshFreshness(meshUsed: FEMMeshIdentity, currentMesh: FEMMeshIdentity): { fresh: boolean; error?: string } {
    if (meshUsed.meshHash !== currentMesh.meshHash) {
      return {
        fresh: false,
        error: `FEM_MESH_STALE: Mesh hash changed from ${meshUsed.meshHash} to ${currentMesh.meshHash}`
      };
    }
    return { fresh: true };
  }

  // 6. Comprehensive Physics State Audit
  public static auditPhysicsState(state: PhysicsState, geometryTwinHash: string, qualifiedMatRev: string): ConsistencyReport {
    const errors: string[] = [];

    // Geometry check
    const geomRes = this.verifyGeometryConsistency(state.geometryState.geometryHash, geometryTwinHash);
    if (!geomRes.valid && geomRes.error) errors.push(geomRes.error);

    // Material check
    const matRes = this.verifyMaterialConsistency(state.materialState.materialRevision, qualifiedMatRev);
    if (!matRes.valid && matRes.error) errors.push(matRes.error);

    // Constraint check
    const constrRes = this.verifyConstraintIntegrity(state.constraintState.constraints);
    if (!constrRes.valid) errors.push(...constrRes.errors);

    // Check no result without input rule
    if (state.resultState && (!state.geometryState.geometryHash || !state.materialState.materialId)) {
      errors.push('INVALID: Result exists without complete input identity');
    }

    // Check no verification without evidence
    if (state.verificationState && state.verificationState.verdict === 'CONVERGED' && !state.evidenceState.evidenceHash) {
      errors.push('INVALID: Verification marked CONVERGED without evidence hash');
    }

    // Determine verdict
    let verdict: PhysicsStateStatus = 'CONVERGED';
    if (errors.some(e => e.includes('PHYSICS_GEOMETRY_MISMATCH') || e.includes('PHYSICS_MATERIAL_MISMATCH'))) {
      verdict = 'OUT_OF_SYNC';
    } else if (errors.some(e => e.includes('CONSTRAINT_CONFLICT'))) {
      verdict = 'CONFLICT';
    } else if (errors.some(e => e.includes('INVALID'))) {
      verdict = 'INVALID';
    } else if (errors.length > 0) {
      verdict = 'INVALID';
    }

    return {
      valid: errors.length === 0,
      verdict,
      errors
    };
  }
}
