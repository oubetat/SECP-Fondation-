import * as crypto from 'crypto';
import { AssemblyConstraintState } from './AssemblyConstraintState';
import { AssemblyConstraintSolver } from './AssemblyConstraintSolver';
import { AssemblySolveResult } from './AssemblySolveResult';
import { AssemblyRevision } from './AssemblyConstraintModel';
import { EngineeringEvidenceFactory } from '../../evidence/EngineeringEvidence';
import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';

export class AssemblyConstraintTransaction {
  private activeState: AssemblyConstraintState;
  private snapshotState?: AssemblyConstraintState;
  private inTransaction = false;

  constructor(state: AssemblyConstraintState) {
    this.activeState = state;
  }

  /**
   * Begins a new transaction, taking a snapshot of the current state
   */
  public begin(): void {
    if (this.inTransaction) {
      throw new Error('Transaction is already in progress');
    }
    this.snapshotState = this.activeState.clone();
    this.inTransaction = true;
  }

  /**
   * Executes the solver inside the transaction and evaluates residuals
   */
  public solve(): AssemblySolveResult {
    if (!this.inTransaction) {
      throw new Error('No transaction in progress. Call begin() first.');
    }

    // 1. Solve the current active state
    const result = AssemblyConstraintSolver.solve(this.activeState);

    // 2. Perform residual checks (Section 15 & 20)
    const allSatisfied = result.residualDiagnostics.every(d => d.satisfied);

    if (result.status === 'INVALID' || result.status === 'CONFLICT' || !allSatisfied) {
      // Automatic rollback on failure
      this.rollback();
      return {
        ...result,
        status: result.status === 'CONFLICT' ? 'CONFLICT' : 'INVALID',
      };
    }

    return result;
  }

  /**
   * Commits the current active state, creating a new AssemblyRevision and generating engineering evidence
   */
  public commit(result: AssemblySolveResult): AssemblyRevision {
    if (!this.inTransaction || !this.snapshotState) {
      throw new Error('No transaction in progress to commit.');
    }

    const assemblyId = this.activeState.getAssemblyId();
    const parentRevisionId = this.snapshotState.getCurrentRevisionId();
    const newRevisionId = `REV-${crypto.randomUUID().substring(0, 8)}`;

    // Generate deterministic hashes for the solved state
    const hashes = AssemblyConstraintSolver.computeDeterministicHashes(
      this.activeState.getAllComponents(),
      this.activeState.getAllConstraints()
    );

    // Generate an Engineering Evidence entry (Section 15 & 16)
    const evidenceId = `EVI-${crypto.randomUUID().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    const evidenceInput: Partial<EngineeringEvidence> = {
      evidenceId,
      evidenceType: 'VALIDATION',
      subject: {
        identityId: assemblyId,
        identityType: 'ASSEMBLY',
        revision: newRevisionId,
        name: `Assembly solver verification for ${assemblyId}`,
      },
      artifact: {
        artifactId: `ART-${assemblyId}`,
        artifactType: 'ASSEMBLY_STATE',
        canonicalHash: hashes.componentPoseHash,
      },
      provenance: {
        producer: {
          type: 'SOLVER',
          id: 'AssemblyConstraintSolver',
          version: '1.0.0',
        },
      },
      canonicalization: {
        serializer: 'JSON',
        version: '1.0.0',
        canonicalHash: hashes.constraintSetHash,
      },
      integrity: {
        hashAlgorithm: 'sha256',
        canonicalHash: hashes.componentPoseHash,
        integrityStatus: 'INTACT',
      },
      verification: {
        verdict: 'PASS',
        reason: `Assembly resolved successfully. Residual error: ${result.convergence.finalResidual.toExponential(4)}`,
        checks: [
          {
            checkId: 'RESIDUAL_STABILITY',
            name: 'Residual Stability Check',
            status: 'PASS',
            details: `Residuals matched tolerance: ${result.convergence.finalResidual.toExponential(4)}`,
          },
        ],
      },
      claims: [
        {
          claimId: 'CLAIM-1',
          statement: 'Assembly satisfies all specified geometric constraints within tolerance.',
          claimType: 'VALIDATION',
          supportedBy: ['RESIDUAL_STABILITY'],
        },
      ],
      createdAt: timestamp,
    };

    // Construct evidence node and register it
    const evidence = EngineeringEvidenceFactory.createEvidence(evidenceInput);

    // Update activeState revision ID
    this.activeState.setCurrentRevisionId(newRevisionId);

    const revision: AssemblyRevision = {
      revisionId: newRevisionId,
      parentRevisionId,
      assemblyId,
      constraintSetHash: hashes.constraintSetHash,
      componentPoseHash: hashes.componentPoseHash,
      solverVersion: '1.0.0',
      solverStatus: result.status,
      residualSummary: result.convergence.finalResidual,
      timestamp,
      evidenceId,
    };

    // Clean up transaction
    this.snapshotState = undefined;
    this.inTransaction = false;

    return revision;
  }

  /**
   * Discards any modifications and restores the snapshot state
   */
  public rollback(): void {
    if (!this.inTransaction || !this.snapshotState) {
      return;
    }

    // Rollback active state to snapshot
    this.activeState = this.snapshotState;
    this.snapshotState = undefined;
    this.inTransaction = false;
  }

  public getActiveState(): AssemblyConstraintState {
    return this.activeState;
  }
}
