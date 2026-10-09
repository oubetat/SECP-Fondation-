// SECP Industrial OS v2 — Canonical Physics Serializer & Deterministic Hashing
import * as crypto from 'crypto';
import {
  PhysicsState,
  SolverIdentity,
  MaterialIdentityRef,
  BoundaryConditionIdentity,
  InitialConditionIdentity,
  LoadIdentity,
  ConstraintIdentity,
  FEMMeshIdentity,
  TransientPhysicsIdentity,
  PhysicsResult,
  PhysicsEvidence
} from './types';

export class CanonicalPhysicsSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  // 1. Canonicalize Material
  public static canonicalizeMaterial(mat: MaterialIdentityRef): string {
    return JSON.stringify({
      materialId: mat.materialId.trim(),
      materialModel: mat.materialModel.trim(),
      materialQualification: mat.materialQualification.trim(),
      materialRevision: mat.materialRevision.trim(),
      temperatureState: Number(mat.temperatureState.toFixed(6))
    });
  }

  // 2. Canonicalize Boundaries (sorted by boundaryId)
  public static canonicalizeBoundaries(boundaries: BoundaryConditionIdentity[]): string {
    const sorted = [...boundaries].sort((a, b) => a.boundaryId.localeCompare(b.boundaryId));
    return JSON.stringify(
      sorted.map(b => ({
        boundaryId: b.boundaryId.trim(),
        function: b.function ? b.function.trim() : '',
        location: b.location.trim(),
        referenceFrame: b.referenceFrame.trim(),
        spatialDependence: b.spatialDependence,
        timeDependence: b.timeDependence,
        type: b.type,
        unit: b.unit.trim(),
        value: b.value.map(v => Number(v.toFixed(6)))
      }))
    );
  }

  // 3. Canonicalize Initial Conditions
  public static canonicalizeInitialConditions(ics: InitialConditionIdentity[]): string {
    const sorted = [...ics].sort((a, b) => a.field.localeCompare(b.field));
    return JSON.stringify(
      sorted.map(ic => ({
        distribution: ic.distribution,
        field: ic.field.trim(),
        referenceFrame: ic.referenceFrame.trim(),
        unit: ic.unit.trim(),
        value: ic.value.map(v => Number(v.toFixed(6)))
      }))
    );
  }

  // 4. Canonicalize Loads
  public static canonicalizeLoads(loads: LoadIdentity[]): string {
    const sorted = [...loads].sort((a, b) => a.loadId.localeCompare(b.loadId));
    return JSON.stringify(
      sorted.map(l => ({
        loadId: l.loadId.trim(),
        location: l.location.trim(),
        referenceFrame: l.referenceFrame.trim(),
        timeDependence: l.timeDependence.trim(),
        type: l.type,
        unit: l.unit.trim(),
        value: l.value.map(v => Number(v.toFixed(6)))
      }))
    );
  }

  // 5. Canonicalize Constraints
  public static canonicalizeConstraints(constraints: ConstraintIdentity[]): string {
    const sorted = [...constraints].sort((a, b) => a.constraintId.localeCompare(b.constraintId));
    return JSON.stringify(
      sorted.map(c => ({
        constraintId: c.constraintId.trim(),
        degreesOfFreedom: c.degreesOfFreedom,
        location: c.location.trim(),
        referenceFrame: c.referenceFrame.trim(),
        type: c.type,
        value: c.value.map(v => Number(v.toFixed(6)))
      }))
    );
  }

  // 6. Canonicalize Mesh
  public static canonicalizeMesh(mesh: FEMMeshIdentity): string {
    return JSON.stringify({
      elementCount: mesh.elementCount,
      elementTypes: [...mesh.elementTypes].sort(),
      meshHash: mesh.meshHash,
      meshId: mesh.meshId.trim(),
      meshRevision: mesh.meshRevision.trim(),
      nodeCount: mesh.nodeCount
    });
  }

  // 7. Canonicalize Solver Identity & Config
  public static canonicalizeSolver(solver: SolverIdentity, config: Record<string, any>): string {
    const sortedConfigKeys = Object.keys(config).sort();
    const cleanConfig: Record<string, any> = {};
    for (const key of sortedConfigKeys) {
      cleanConfig[key] = config[key];
    }
    return JSON.stringify({
      buildId: solver.buildId.trim(),
      compiler: solver.compiler.trim(),
      config: cleanConfig,
      parallelMode: solver.parallelMode,
      platform: solver.platform.trim(),
      precision: solver.precision,
      solverId: solver.solverId.trim(),
      solverVersion: solver.solverVersion.trim()
    });
  }

  // 8. Compute Input Hash (Order Invariant & Deterministic)
  public static computePhysicsInputHash(state: PhysicsState): string {
    const geomStr = state.geometryState.geometryHash;
    const matStr = this.canonicalizeMaterial(state.materialState);
    const bcStr = this.canonicalizeBoundaries(state.boundaryState.boundaries);
    const loadStr = this.canonicalizeLoads(state.loadState.loads);
    const constraintStr = this.canonicalizeConstraints(state.constraintState.constraints);
    const icStr = this.canonicalizeInitialConditions(state.initialState.initialConditions);
    const meshStr = this.canonicalizeMesh(state.discretizationState.mesh);

    const payload = [geomStr, matStr, bcStr, loadStr, constraintStr, icStr, meshStr].join('|INPUT_SEP|');
    return this.sha256(payload);
  }

  // 9. Compute Model Hash
  public static computePhysicsModelHash(state: PhysicsState): string {
    const eqStr = [...state.modelState.governingEquations].sort().join(',');
    const lawsStr = [...state.modelState.constitutiveLaws].sort().join(',');
    const domainStr = state.domainState.domain + ':' + [...state.domainState.subDomains].sort().join(',');
    return this.sha256([eqStr, lawsStr, domainStr].join('|MODEL_SEP|'));
  }

  // 10. Compute Solver Config Hash
  public static computeSolverConfigHash(solver: SolverIdentity, config: Record<string, any>): string {
    return this.sha256(this.canonicalizeSolver(solver, config));
  }

  // 11. Compute Result Hash
  public static computeResultHash(result: PhysicsResult): string {
    const sortedSummaryKeys = Object.keys(result.dataSummary).sort();
    const sortedSummary: Record<string, number> = {};
    for (const k of sortedSummaryKeys) {
      sortedSummary[k] = Number(result.dataSummary[k].toFixed(6));
    }
    const payload = JSON.stringify({
      inputHash: result.inputHash,
      modelHash: result.modelHash,
      resultRevision: result.resultRevision,
      resultType: result.resultType,
      solverHash: result.solverHash,
      summary: sortedSummary
    });
    return this.sha256(payload);
  }

  // 12. Compute Physics Root Hash
  public static computePhysicsRootHash(hashes: {
    geometryHash: string;
    materialHash: string;
    modelHash: string;
    boundaryHash: string;
    loadHash: string;
    constraintHash: string;
    meshHash: string;
    solverConfigHash: string;
    timeStateHash: string;
    resultHash: string;
    verificationHash: string;
    validationHash: string;
    evidenceHash: string;
  }): string {
    const concat = [
      hashes.geometryHash,
      hashes.materialHash,
      hashes.modelHash,
      hashes.boundaryHash,
      hashes.loadHash,
      hashes.constraintHash,
      hashes.meshHash,
      hashes.solverConfigHash,
      hashes.timeStateHash,
      hashes.resultHash,
      hashes.verificationHash,
      hashes.validationHash,
      hashes.evidenceHash
    ].join('|ROOT_SEP|');

    return this.sha256(concat);
  }
}
