/**
 * SECP CAD/CAE Platform - Boundary Condition Engine Orchestrator
 * PATCH-235 — Boundary Condition Engine
 *
 * Full pipeline orchestrator executing deterministic boundary condition lifecycle:
 * Selection -> Mesh Projection -> DOF Resolution -> Conflict Audit -> Under-Constraint Audit
 * -> Load & Constraint Assembly -> Global System Solve -> Reaction Force Audit -> OS Invalidation.
 */

import { FEMMesh } from '../mesh/FEMMesh';
import { FEMNode } from '../mesh/FEMNode';
import { DOFManager } from '../assembly/DOFManager';
import { ElementConnectivity } from '../assembly/ElementConnectivity';
import { ElementStiffnessProvider } from '../assembly/ElementStiffnessProvider';
import { SparseMatrixBuilder } from '../assembly/SparseMatrixBuilder';
import { CSRStorage } from '../sparse/CSRStorage';
import {
  BoundaryConditionDefinition,
  LoadCase,
  BCDiagnosticIssue,
  ReactionForceResult,
  SystemEquilibriumAudit,
  EnforcementMethod
} from './BoundaryConditionTypes';
import { GeometrySelector, ProjectedMeshSelection } from './GeometrySelector';
import { DOFResolver, ResolvedNodeConstraint } from './DOFResolver';
import { ConflictDetector, ConflictAuditResult } from './ConflictDetector';
import { UnderConstrainedDetector, RigidBodyModeAnalysis } from './UnderConstrainedDetector';
import { LoadAssembler, LoadAssemblyContribution } from './LoadAssembler';
import { ConstraintEnforcement, EnforcementResult } from './ConstraintEnforcement';
import { ReactionForceCalculator } from './ReactionForceCalculator';
import { BoundaryConditionRegistry } from './BoundaryConditionRegistry';

export interface BCPipelineExecutionResult {
  success: boolean;
  mesh: FEMMesh;
  totalDOFs: number;
  constrainedDOFCount: number;
  freeDOFCount: number;
  bcConfigurationHash: string;
  constraintMapHash: string;
  loadVectorHash: string;
  solverInputHash: string;
  projections: Map<string, ProjectedMeshSelection>;
  conflictAudit: ConflictAuditResult;
  rigidBodyAnalysis: RigidBodyModeAnalysis;
  loadContributions: LoadAssemblyContribution[];
  enforcementResult?: EnforcementResult;
  displacementSolution?: number[];
  reactionForces?: ReactionForceResult[];
  equilibriumAudit?: SystemEquilibriumAudit;
  diagnostics: BCDiagnosticIssue[];
  executionTimeMs: number;
}

export class BoundaryConditionEngine {
  private registry: BoundaryConditionRegistry;

  constructor(registry?: BoundaryConditionRegistry) {
    this.registry = registry || new BoundaryConditionRegistry();
  }

  public getRegistry(): BoundaryConditionRegistry {
    return this.registry;
  }

  /**
   * Executes the full Boundary Condition pipeline on a given FEM mesh and material model set.
   */
  public executeBCPipeline(
    mesh: FEMMesh,
    loadCaseId: string = 'LC_01_STATIC',
    enforcementMethod: EnforcementMethod = 'ROW_COLUMN_MODIFICATION',
    materialDensityMap?: Map<string, number>
  ): BCPipelineExecutionResult {
    const startTime = performance.now();
    const diagnostics: BCDiagnosticIssue[] = [];

    // 1. Fetch active BCs for target load case
    const allBCs = this.registry.getAllBoundaryConditions();
    const activeBCs = allBCs.filter(
      (b) => b.enabled && (b.loadCaseId === loadCaseId || loadCaseId === 'ALL')
    );

    // 2. Project Geometry selections to Mesh entities
    const projections = new Map<string, ProjectedMeshSelection>();
    const bcResolvedNodeConstraintsMap = new Map<string, ResolvedNodeConstraint[]>();

    for (const bc of activeBCs) {
      const proj = GeometrySelector.projectSelection(bc.target, mesh);
      projections.set(bc.id, proj);

      if (proj.diagnostics.length > 0) {
        proj.diagnostics.forEach((diagMsg) => {
          diagnostics.push({
            code: 'STALE_MESH_PROJECTION',
            severity: 'WARNING',
            bcId: bc.id,
            message: diagMsg
          });
        });
      }

      // Resolve DOFs
      const { constraints, issues } = DOFResolver.resolvePrescribedConstraints(bc, proj.nodeIds, mesh);
      bcResolvedNodeConstraintsMap.set(bc.id, constraints);
      issues.forEach((i) => diagnostics.push(i));
    }

    // 3. Audit for Constraint Conflicts and Over-constraints
    const conflictAudit = ConflictDetector.auditConstraints(
      activeBCs,
      bcResolvedNodeConstraintsMap,
      mesh
    );
    conflictAudit.issues.forEach((i) => diagnostics.push(i));

    if (conflictAudit.hasConflict) {
      const endTime = performance.now();
      return {
        success: false,
        mesh,
        totalDOFs: mesh.nodes.length * 3,
        constrainedDOFCount: 0,
        freeDOFCount: mesh.nodes.length * 3,
        bcConfigurationHash: this.registry.computeBCConfigurationHash(),
        constraintMapHash: 'CONFLICT_REJECTED',
        loadVectorHash: 'CONFLICT_REJECTED',
        solverInputHash: 'CONFLICT_REJECTED',
        projections,
        conflictAudit,
        rigidBodyAnalysis: {
          isSufficientlyConstrained: false,
          unconstrainedModes: ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ'],
          constrainedDOFsCount: 0,
          totalDOFsCount: mesh.nodes.length * 3,
          issues: conflictAudit.issues
        },
        loadContributions: [],
        diagnostics,
        executionTimeMs: endTime - startTime
      };
    }

    // 4. Audit for Rigid Body Under-Constrained Mechanisms
    const rigidBodyAnalysis = UnderConstrainedDetector.analyzeRigidBodyModes(
      conflictAudit.validConstraintMap,
      mesh
    );
    rigidBodyAnalysis.issues.forEach((i) => diagnostics.push(i));

    // 5. Initialize DOFManager and mark prescribed DOFs
    const dofManager = new DOFManager(mesh.nodes, ['UX', 'UY', 'UZ']);
    for (const [key, c] of conflictAudit.validConstraintMap.entries()) {
      dofManager.setBoundaryCondition(c.nodeId, c.field, c.prescribedValue);
    }

    // 6. Assemble Unmodified Global Stiffness K_global
    const nodesMap = new Map<string, FEMNode>(mesh.nodes.map((n) => [n.id, n]));
    const builder = new SparseMatrixBuilder(dofManager.totalDOFs);
    for (const elem of mesh.elements) {
      const mapping = ElementConnectivity.buildElementDOFMapping(elem, dofManager);
      const computedKe = ElementStiffnessProvider.computeElementStiffness(elem, nodesMap);
      if (computedKe.isValid) {
        builder.addElementStiffness(mapping.globalDofIndices, computedKe.Ke);
      }
    }
    const K_unmodified = builder.assembleCSR();

    // 7. Assemble Global Load Vector F_global
    const { F_global, contributions, issues: loadIssues } = LoadAssembler.assembleLoadVector(
      activeBCs,
      dofManager,
      mesh,
      materialDensityMap
    );
    loadIssues.forEach((i) => diagnostics.push(i));

    // 8. Enforce Dirichlet Boundary Conditions on System (K_mod, F_mod)
    const enforcementResult = ConstraintEnforcement.enforceConstraints(
      K_unmodified,
      F_global,
      dofManager,
      enforcementMethod
    );

    // 9. Solve Linear FEM System K_mod * u = F_mod
    const u_solution = BoundaryConditionEngine.solveLinearSystem(
      enforcementResult.K_mod,
      enforcementResult.F_mod
    );

    // 10. Calculate Reactions R = K_unmodified * u - F_global & Verify Equilibrium
    const { reactions, audit: equilibriumAudit } = ReactionForceCalculator.calculateReactions(
      K_unmodified,
      u_solution,
      F_global,
      dofManager
    );

    // 11. Hashes & Signatures
    const bcConfigurationHash = this.registry.computeBCConfigurationHash();
    const constraintMapHash = BoundaryConditionEngine.simpleHash(
      Array.from(conflictAudit.validConstraintMap.keys()).sort().join(';')
    );
    const loadVectorHash = BoundaryConditionEngine.simpleHash(
      F_global.map((v) => v.toFixed(4)).join(',')
    );
    const solverInputHash = BoundaryConditionEngine.simpleHash(
      `${bcConfigurationHash}:${constraintMapHash}:${loadVectorHash}`
    );

    const endTime = performance.now();
    const success = !conflictAudit.hasConflict && (rigidBodyAnalysis.isSufficientlyConstrained || activeBCs.length === 0);

    return {
      success,
      mesh,
      totalDOFs: dofManager.totalDOFs,
      constrainedDOFCount: dofManager.getPrescribedIndices().length,
      freeDOFCount: dofManager.getFreeIndices().length,
      bcConfigurationHash,
      constraintMapHash,
      loadVectorHash,
      solverInputHash,
      projections,
      conflictAudit,
      rigidBodyAnalysis,
      loadContributions: contributions,
      enforcementResult,
      displacementSolution: u_solution,
      reactionForces: reactions,
      equilibriumAudit,
      diagnostics,
      executionTimeMs: endTime - startTime
    };
  }

  /**
   * Simple linear solver (Conjugate Gradient / Direct Gauss elimination) for dense/sparse systems.
   */
  public static solveLinearSystem(csrK: CSRStorage, F: number[]): number[] {
    const n = F.length;
    const x = new Array<number>(n).fill(0.0);

    // Extract dense representation for robust direct solving
    const K_dense: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0.0));
    for (let r = 0; r < n; r++) {
      const rowStart = csrK.rowPointers[r];
      const rowEnd = csrK.rowPointers[r + 1];
      for (let p = rowStart; p < rowEnd; p++) {
        K_dense[r][csrK.columnIndices[p]] = csrK.values[p];
      }
    }

    // Direct Gauss Elimination with Partial Pivoting
    const A = K_dense.map((row) => [...row]);
    const b = [...F];

    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      const tmpRow = A[i];
      A[i] = A[maxRow];
      A[maxRow] = tmpRow;

      const tmpB = b[i];
      b[i] = b[maxRow];
      b[maxRow] = tmpB;

      if (Math.abs(A[i][i]) < 1e-15) {
        continue;
      }

      for (let k = i + 1; k < n; k++) {
        const c = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] -= c * A[i][j];
          }
        }
        b[k] -= c * b[i];
      }
    }

    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j];
      }
      if (Math.abs(A[i][i]) > 1e-15) {
        x[i] = (b[i] - sum) / A[i][i];
      } else {
        x[i] = 0.0;
      }
    }

    return x;
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `HASH_${Math.abs(hash).toString(16)}`;
  }
}
