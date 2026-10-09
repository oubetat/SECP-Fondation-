/**
 * SECP CAD/CAE Platform - Global Stiffness Assembler
 * PATCH-234 — Global Stiffness Assembly
 *
 * Orchestrates the complete FEM Global Assembly Pipeline:
 * Mesh → Connectivity → DOF Mapping → Element Ke (PATCH-232/233) → Sparse Global K (CSR) → Global F → Boundary Conditions → Diagnostics & Evidence.
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { FEMNode } from '../mesh/FEMNode';
import { FEMElement } from '../mesh/FEMElement';
import { CSRStorage } from '../sparse/CSRStorage';
import { DOFField, DOFManager } from './DOFManager';
import { ElementConnectivity, ElementDOFMapping } from './ElementConnectivity';
import { ElementStiffnessProvider, ComputedElementKe } from './ElementStiffnessProvider';
import { SparseMatrixBuilder } from './SparseMatrixBuilder';
import { ConstraintAssembler, SystemPartition } from './ConstraintAssembler';
import { LoadVectorAssembler, NodalLoad, BodyForceLoad } from './LoadVectorAssembler';
import { AssemblyDiagnostics, AssemblyDiagnosticReport } from './AssemblyDiagnostics';
import { GlobalAssemblyEvidenceEngine, GlobalAssemblyEvidence } from './GlobalAssemblyEvidenceEngine';
import { MaterialConstitutiveDefinition } from '../material/constitutive/ConstitutiveTypes';

export interface GlobalAssemblyResult {
  meshId: string;
  totalDOFs: number;
  freeDOFCount: number;
  prescribedDOFCount: number;
  nnz: number;
  K_global: CSRStorage; // Unconstrained global stiffness matrix
  K_modified: CSRStorage; // Boundary-condition modified stiffness matrix
  F_global: number[]; // Right-hand-side load vector
  F_modified: number[]; // Boundary-condition modified load vector
  systemPartition?: SystemPartition;
  diagnostics: AssemblyDiagnosticReport;
  displacements: number[];
  reactions: number[];
  isSolvable: boolean;
  evidence: GlobalAssemblyEvidence;
  assemblyDurationMs: number;
  invalidationState: 'VALID' | 'MESH_INVALIDATED' | 'MATERIAL_INVALIDATED';
}

export type ParallelBackendMode = 'CPU_SEQUENTIAL' | 'CPU_OPENMP' | 'GPU_CUDA' | 'DISTRIBUTED_MPI';

export interface ParallelBackendStatus {
  mode: ParallelBackendMode;
  status: 'EXECUTED' | 'UNIMPLEMENTED';
  supportedThreads: number;
}

export class GlobalStiffnessAssembler {
  private mesh?: FEMMesh;
  private dofManager?: DOFManager;
  private nodalLoads: NodalLoad[] = [];
  private bodyForce?: BodyForceLoad;
  private materialOverrides: Map<string, MaterialConstitutiveDefinition> = new Map();

  // Invalidation state tracking (PATCH-190 integration)
  private geometryRevision: string = 'REV_001';
  private invalidationState: 'VALID' | 'MESH_INVALIDATED' | 'MATERIAL_INVALIDATED' = 'VALID';

  constructor() {}

  public setMesh(mesh: FEMMesh, fieldsPerNode: DOFField[] = ['UX', 'UY', 'UZ']) {
    this.mesh = mesh;
    this.dofManager = new DOFManager(mesh.nodes, fieldsPerNode);
    this.invalidationState = 'VALID';
  }

  public setBoundaryCondition(nodeId: string, field: DOFField, prescribedValue: number = 0.0) {
    if (!this.dofManager) {
      throw new Error('GlobalStiffnessAssembler: Cannot set boundary condition before initializing mesh.');
    }
    this.dofManager.setBoundaryCondition(nodeId, field, prescribedValue);
  }

  public addNodalLoad(nodeId: string, field: DOFField, magnitude: number) {
    this.nodalLoads.push({ nodeId, field, magnitude });
  }

  public setBodyForce(gravity: [number, number, number], density?: number) {
    this.bodyForce = { gravity, density };
  }

  public overrideMaterial(materialId: string, def: MaterialConstitutiveDefinition) {
    this.materialOverrides.set(materialId, def);
    this.invalidationState = 'MATERIAL_INVALIDATED';
  }

  public invalidateMesh(newRevision: string) {
    this.geometryRevision = newRevision;
    this.invalidationState = 'MESH_INVALIDATED';
  }

  public getDOFManager(): DOFManager {
    if (!this.dofManager) {
      throw new Error('DOFManager not initialized.');
    }
    return this.dofManager;
  }

  /**
   * Returns parallel execution capabilities abstraction.
   * Returns UNIMPLEMENTED for unsupported GPU/Distributed modes to preserve engineering truth.
   */
  public getParallelBackendStatus(mode: ParallelBackendMode): ParallelBackendStatus {
    if (mode === 'CPU_SEQUENTIAL') {
      return { mode, status: 'EXECUTED', supportedThreads: 1 };
    }
    return { mode, status: 'UNIMPLEMENTED', supportedThreads: 0 };
  }

  /**
   * Executes full Global Assembly & Solution Pipeline.
   */
  public assembleAndSolve(): GlobalAssemblyResult {
    const startTime = performance.now();

    if (!this.mesh || !this.dofManager) {
      throw new Error('GlobalStiffnessAssembler: Mesh or DOFManager uninitialized.');
    }

    const nodesMap = new Map<string, FEMNode>(this.mesh.nodes.map((n) => [n.id, n]));

    // 1. Pre-Assembly Diagnostics Audit
    const preAudit = AssemblyDiagnostics.auditPreAssembly(this.mesh.nodes, this.mesh.elements, this.dofManager);

    // 2. Initialize Sparse Matrix Builder
    const totalDOFs = this.dofManager.totalDOFs;
    const builder = new SparseMatrixBuilder(totalDOFs);

    // 3. Loop over elements: Ke computation (PATCH-232/233) + DOF mapping + COO insertion
    const computedElementStiffnesses: ComputedElementKe[] = [];

    for (const elem of this.mesh.elements) {
      const mapping = ElementConnectivity.buildElementDOFMapping(elem, this.dofManager);
      const matDef = this.materialOverrides.get(elem.materialId);
      const computedKe = ElementStiffnessProvider.computeElementStiffness(elem, nodesMap, matDef);

      if (!computedKe.isValid) {
        preAudit.errors.push(`Element ${elem.id} failed stiffness computation: ${computedKe.failureReason}`);
        preAudit.isValid = false;
        continue;
      }

      computedElementStiffnesses.push(computedKe);

      // Accumulate into global matrix coordinates
      builder.addElementStiffness(mapping.globalDofIndices, computedKe.Ke);
    }

    // 4. Assemble Global CSR Stiffness Matrix K_global
    const K_global = builder.assembleCSR();

    // 5. Assemble Global Load Vector F_global
    const loadRes = LoadVectorAssembler.assembleGlobalLoadVector(
      this.dofManager,
      this.nodalLoads,
      this.bodyForce,
      this.mesh.elements,
      nodesMap
    );
    const F_global = loadRes.F_global;

    // 6. Post-Assembly System Diagnostics
    const diagnostics = AssemblyDiagnostics.auditAssembledSystem(preAudit, K_global, this.dofManager);

    // 7. Apply Boundary Conditions (Row/Column Modification & Partitioning)
    const { K_mod, F_mod } = ConstraintAssembler.applyRowColumnModification(K_global, F_global, this.dofManager);
    const systemPartition = ConstraintAssembler.partitionSystem(K_global, F_global, this.dofManager);

    // 8. Numerical Direct Solution for Displacements u
    const displacements = new Array<number>(totalDOFs).fill(0.0);
    const reactions = new Array<number>(totalDOFs).fill(0.0);

    if (diagnostics.isSolvable && totalDOFs > 0) {
      // Gaussian elimination on K_mod * u = F_mod (or partition solve)
      const uSol = this.solveLinearSystemDenseFallback(K_mod, F_mod);
      for (let i = 0; i < uSol.length; i++) {
        displacements[i] = uSol[i];
      }

      // Compute Reactions: R = K_global * u - F_global
      const Ku = SparseMatrixBuilder.multiplyVector(K_global, displacements);
      for (let i = 0; i < totalDOFs; i++) {
        reactions[i] = Ku[i] - F_global[i];
      }
    }

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    // 9. Generate Cryptographic Evidence Packet
    const evidence = GlobalAssemblyEvidenceEngine.createEvidence(
      this.mesh,
      K_global,
      this.dofManager,
      diagnostics,
      loadRes.loadVectorHash,
      durationMs
    );

    return {
      meshId: this.mesh.id,
      totalDOFs,
      freeDOFCount: this.dofManager.freeDOFCount,
      prescribedDOFCount: this.dofManager.prescribedDOFCount,
      nnz: K_global.nnz,
      K_global,
      K_modified: K_mod,
      F_global,
      F_modified: F_mod,
      systemPartition,
      diagnostics,
      displacements,
      reactions,
      isSolvable: diagnostics.isSolvable,
      evidence,
      assemblyDurationMs: durationMs,
      invalidationState: this.invalidationState
    };
  }

  /**
   * Helper direct solver for small-to-medium matrices.
   */
  private solveLinearSystemDenseFallback(csrK: CSRStorage, F: number[]): number[] {
    const n = csrK.rows;
    if (n === 0) return [];
    const A = csrK.toDense();
    const b = [...F];

    // LU decomposition with partial pivoting
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      let maxVal = Math.abs(A[i][i]);
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxVal) {
          maxVal = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      if (maxRow !== i) {
        // Swap rows
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [b[i], b[maxRow]] = [b[maxRow], b[i]];
      }

      const pivot = A[i][i];
      if (Math.abs(pivot) < 1e-14) {
        continue;
      }

      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / pivot;
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
        b[k] -= factor * b[i];
      }
    }

    // Back substitution
    const x = new Array<number>(n).fill(0.0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = Math.abs(A[i][i]) > 1e-14 ? sum / A[i][i] : 0.0;
    }

    return x;
  }
}
