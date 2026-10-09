import { SparseAssembler } from '../sparse/SparseAssembler';
import { ConditioningAnalyzer } from './ConditioningAnalyzer';
import { ConstraintManager } from './ConstraintManager';
import { DOFManager } from './DOFManager';
import { EnergyEvaluator } from './EnergyEvaluator';
import { EquilibriumChecker } from './EquilibriumChecker';
import { IndependentReactionAudit } from './IndependentReactionAudit';
import { IndependentResidualAudit } from './IndependentResidualAudit';
import { LinearSystem } from './LinearSystem';
import { LoadVectorAssembler } from './LoadVectorAssembler';
import { ReactionCalculator } from './ReactionCalculator';
import { ResidualEvaluator } from './ResidualEvaluator';
import { SolutionHasher } from './SolutionHasher';
import { SolutionValidator } from './SolutionValidator';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverEvidence, SolverEvidencePacket } from './SolverEvidence';
import { SolverMonitor } from './SolverMonitor';
import { SparseDirectBackend } from './SparseDirectBackend';
import { SparseSystemAssembler } from './SparseSystemAssembler';
import { StrainRecovery } from './StrainRecovery';
import { StructuralModel } from './StructuralModel';
import {
  ElementRecoveryResult,
  EnergyMetrics,
  EquilibriumMetrics,
  PerformanceStats,
  ReactionResult,
  ResidualMetrics,
  SolverFailureType,
  SolverStatus,
  SolverVerdictResult,
  StructuralSolverVerdict
} from './types';

export interface StructuralSolveResult {
  status: SolverStatus;
  verdict: StructuralSolverVerdict;
  converged: boolean;
  verified: boolean;
  failureType: SolverFailureType;
  failureReason?: string;
  displacements: number[];
  reactions: ReactionResult[];
  globalReactionVector: number[];
  elementResults: ElementRecoveryResult[];
  residualMetrics: ResidualMetrics;
  independentResidualMetrics: ResidualMetrics;
  equilibriumMetrics: EquilibriumMetrics;
  energyMetrics: EnergyMetrics;
  performanceStats: PerformanceStats;
  evidencePacket: SolverEvidencePacket;
  evidenceHash: string;
  stiffnessMatrix: number[][];
  globalStiffnessMatrix: number[][];
}

export class LinearStructuralSolver {
  private config: SolverConfiguration;

  constructor(config: SolverConfiguration = SolverConfiguration.default()) {
    this.config = config;
  }

  solve(model: StructuralModel): StructuralSolveResult {
    const startTime = performance.now();
    const monitor = new SolverMonitor();

    // 1. Model Validation
    const modelVal = model.validate();
    if (!modelVal.isValid) {
      return this.failResult(
        model,
        'INVALID_MODEL',
        `Model validation failed: ${modelVal.errors.join('; ')}`,
        monitor,
        startTime
      );
    }

    // 2. DOF Management
    const dofManager = new DOFManager(model.nodes, modelVal.dofsPerNode, model.constraints);

    // Resource limits check
    if (dofManager.totalDOFs > this.config.maxDOFs) {
      return this.failResult(
        model,
        'RESOURCE_LIMIT_EXCEEDED',
        `DOFs count (${dofManager.totalDOFs}) exceeds max limit (${this.config.maxDOFs})`,
        monitor,
        startTime
      );
    }

    // 3. Constraint Validation
    const constraintManager = new ConstraintManager(model.constraints);
    const nodeIdsSet = new Set(model.nodes.map((n) => n.id));
    const constraintVal = constraintManager.validate(nodeIdsSet);
    if (!constraintVal.isValid) {
      const failType = constraintVal.conflictDetected ? 'CONSTRAINT_CONFLICT' : 'INVALID_CONSTRAINT';
      return this.failResult(
        model,
        failType,
        `Constraint validation failed: ${constraintVal.errors.join('; ')}`,
        monitor,
        startTime
      );
    }

    // Check rigid body modes / zero constraints warning
    if (dofManager.getConstrainedDOFIndices().length === 0) {
      return this.failResult(
        model,
        'SINGULAR_SYSTEM',
        'Model has zero boundary constraints (unconstrained rigid body motion). SINGULAR_SYSTEM.',
        monitor,
        startTime
      );
    }

    // 4. Load Vector Assembly
    const loadResult = LoadVectorAssembler.assembleGlobalLoadVector(dofManager, model.loads);
    if (!loadResult.validation.isValid) {
      return this.failResult(
        model,
        'INVALID_LOAD',
        `Load vector assembly failed: ${loadResult.validation.errors.join('; ')}`,
        monitor,
        startTime
      );
    }
    const F_global = loadResult.F;

    // 5. Sparse System Assembly & Partitioning
    const asmStartTime = performance.now();
    const partitionedSystem = SparseSystemAssembler.assembleAndPartition(model, dofManager, F_global);
    const asmEndTime = performance.now();

    const K_full = partitionedSystem.Kff; // Note: partitionedSystem contains Kff, Kfc, Kcf, Kcc
    monitor.recordAssembly(
      asmEndTime - asmStartTime,
      partitionedSystem.Kff.nnz,
      partitionedSystem.Kff.memoryProfile.totalSparseBytes
    );

    // 6. System Integrity & Conditioning
    const linearSystem = new LinearSystem(partitionedSystem);
    const sysIntegrity = linearSystem.validateSystemIntegrity();
    if (!sysIntegrity.isValid) {
      return this.failResult(
        model,
        'INVALID_MODEL',
        `System integrity check failed: ${sysIntegrity.reason}`,
        monitor,
        startTime
      );
    }

    const condAnalysis = ConditioningAnalyzer.analyze(linearSystem.Kff);
    if (condAnalysis.hasZeroDiagonal) {
      return this.failResult(
        model,
        'SINGULAR_SYSTEM',
        `Zero diagonal entry detected at free DOF index ${condAnalysis.zeroDiagonalIndices[0]}. System is singular or unconstrained mechanism.`,
        monitor,
        startTime
      );
    }

    // 7. Backend Solver Factorization & Solve
    const backend = new SparseDirectBackend();
    backend.analyze(linearSystem.Kff);

    const factorRes = backend.factorize(linearSystem.Kff);
    if (!factorRes.success) {
      return this.failResult(model, factorRes.failureType, factorRes.reason ?? 'Factorization failed', monitor, startTime);
    }

    const backendStats = backend.getStatistics();
    monitor.recordFactorization(
      backendStats.factorizationTimeMs,
      backendStats.factorNNZ,
      backendStats.factorizationMemoryBytes
    );

    const solveStartTime = performance.now();
    const u_free = backend.solve(linearSystem.reducedRHS);
    const solveEndTime = performance.now();

    monitor.recordSolve(solveEndTime - solveStartTime, dofManager.totalDOFs);

    // 8. Reconstruct Global Displacement Vector u_global
    const u_global = new Array<number>(dofManager.totalDOFs).fill(0);
    const freeIndices = dofManager.getFreeDOFIndices();
    for (let i = 0; i < freeIndices.length; i++) {
      u_global[freeIndices[i]] = u_free[i];
    }
    const constrainedIndices = dofManager.getConstrainedDOFIndices();
    for (let i = 0; i < constrainedIndices.length; i++) {
      const idx = constrainedIndices[i];
      u_global[idx] = dofManager.globalDOFs[idx].constrainedValue ?? 0;
    }

    // 9. Field Recovery: Reactions, Stresses, Strains, Energy
    const recoveryStartTime = performance.now();

    // Reassemble full global K to compute exact full residuals & reactions
    // (Note: we reconstruct full K using SparseAssembler)
    const fullAsm = SparseAssembler.assembleGlobalStiffness(
      dofManager.totalDOFs,
      dofManager.dofsPerNode,
      model.elements.map((e) => ({
        id: e.id,
        type: e.type,
        nodeIndices: e.nodeIds.map((nid) => model.getNode(nid)!.index),
        coordinates: e.nodeIds.map((nid) => model.getNode(nid)!.coordinates),
        material: e.material
      }))
    );
    const K_global_full = fullAsm.sparseMatrix;

    const reactionRes = ReactionCalculator.calculateReactions(K_global_full, u_global, F_global, dofManager);
    const elementResults = StrainRecovery.recoverElementResults(model, dofManager, u_global);
    const energyMetrics = EnergyEvaluator.evaluateEnergy(
      K_global_full,
      u_global,
      F_global,
      elementResults,
      this.config.energyTolerance
    );

    const recoveryEndTime = performance.now();
    monitor.recordRecovery(recoveryEndTime - recoveryStartTime);

    // 10. Residual & Equilibrium Verification
    const verificationStartTime = performance.now();

    const residualMetrics = ResidualEvaluator.evaluate(
      K_global_full,
      u_global,
      F_global,
      freeIndices,
      this.config.residualTolerance
    );

    const independentResidualMetrics = IndependentResidualAudit.audit(
      K_global_full,
      u_global,
      F_global,
      freeIndices,
      this.config.residualTolerance
    );

    const equilibriumMetrics = IndependentReactionAudit.auditEquilibrium(
      F_global,
      reactionRes.reactions,
      dofManager
    );

    const solutionVal = SolutionValidator.validate(
      u_global,
      dofManager,
      residualMetrics,
      this.config.constraintTolerance
    );

    const verificationEndTime = performance.now();
    monitor.recordVerification(verificationEndTime - verificationStartTime);

    const endTime = performance.now();
    monitor.recordTotal(endTime - startTime);

    // 11. Verdict Determination
    const converged = solutionVal.isValid && factorRes.success;
    const verified =
      converged &&
      residualMetrics.passed &&
      independentResidualMetrics.passed &&
      equilibriumMetrics.forceBalancePassed &&
      energyMetrics.passed;

    let finalVerdict: StructuralSolverVerdict = 'VERIFIED';
    let failureType: SolverFailureType = 'NONE';
    let failureReason: string | undefined = undefined;

    if (!converged) {
      finalVerdict = 'NUMERICAL_FAILURE';
      failureType = solutionVal.failureType;
      failureReason = solutionVal.failureReason;
    } else if (!verified) {
      if (!equilibriumMetrics.forceBalancePassed) {
        finalVerdict = 'EQUILIBRIUM_FAILURE';
        failureType = 'EQUILIBRIUM_FAILURE';
        failureReason = 'Global force equilibrium balance failed.';
      } else if (!energyMetrics.passed) {
        finalVerdict = 'ENERGY_FAILURE';
        failureType = 'ENERGY_FAILURE';
        failureReason = 'Global strain energy vs element strain energy consistency failed.';
      } else {
        finalVerdict = 'NOT_CONVERGED';
        failureType = 'RESIDUAL_FAILURE';
        failureReason = 'Residual or independent audit tolerance exceeded.';
      }
    }

    const verdictResult: SolverVerdictResult = {
      status: verified ? 'VERIFIED' : converged ? 'SOLVED' : 'FAILED',
      verdict: finalVerdict,
      converged,
      verified,
      failureType,
      failureReason,
      evidenceHash: ''
    };

    const evidenceHash = SolutionHasher.computeHash(model, u_global, reactionRes.globalReactionVector, energyMetrics);
    verdictResult.evidenceHash = evidenceHash;

    const performanceStats = monitor.getStats();

    const evidencePacket = SolverEvidence.createPacket(
      model,
      dofManager,
      u_global,
      reactionRes.globalReactionVector,
      elementResults,
      residualMetrics,
      equilibriumMetrics,
      energyMetrics,
      performanceStats,
      verdictResult
    );

    return {
      status: verdictResult.status,
      verdict: verdictResult.verdict,
      converged,
      verified,
      failureType,
      failureReason,
      displacements: u_global,
      reactions: reactionRes.reactions,
      globalReactionVector: reactionRes.globalReactionVector,
      elementResults,
      residualMetrics,
      independentResidualMetrics,
      equilibriumMetrics,
      energyMetrics,
      performanceStats,
      evidencePacket,
      evidenceHash,
      stiffnessMatrix: K_global_full.toDense(),
      globalStiffnessMatrix: K_global_full.toDense()
    };
  }

  private failResult(
    model: StructuralModel,
    failureType: SolverFailureType,
    reason: string,
    monitor: SolverMonitor,
    startTime: number
  ): StructuralSolveResult {
    const totalTime = performance.now() - startTime;
    monitor.recordTotal(totalTime);

    const verdictResult: SolverVerdictResult = {
      status: 'FAILED',
      verdict:
        failureType === 'SINGULAR_SYSTEM'
          ? 'SINGULAR_SYSTEM'
          : failureType === 'INVALID_MODEL'
          ? 'INVALID_MODEL'
          : 'NUMERICAL_FAILURE',
      converged: false,
      verified: false,
      failureType,
      failureReason: reason,
      evidenceHash: `FAILED_${failureType}`
    };

    const dummyResidual: ResidualMetrics = {
      absoluteNormL2: Infinity,
      absoluteNormInf: Infinity,
      relativeResidual: Infinity,
      maxResidualEntry: { index: 0, value: Infinity },
      passed: false
    };

    const dummyEquilibrium: EquilibriumMetrics = {
      sumExternalForces: { fx: 0, fy: 0, fz: 0 },
      sumReactions: { rx: 0, ry: 0, rz: 0 },
      netResidualForces: { x: Infinity, y: Infinity, z: Infinity },
      residualForceNorm: Infinity,
      forceBalancePassed: false
    };

    const dummyEnergy: EnergyMetrics = {
      globalStrainEnergy: 0,
      sumElementStrainEnergy: 0,
      externalWork: 0,
      energyErrorAbsolute: Infinity,
      energyErrorRelative: Infinity,
      workEnergyErrorRelative: Infinity,
      passed: false
    };

    const stats = monitor.getStats();

    const dummyPacket: SolverEvidencePacket = {
      modelId: model.id,
      verdictResult,
      residualMetrics: dummyResidual,
      equilibriumMetrics: dummyEquilibrium,
      energyMetrics: dummyEnergy,
      performanceStats: stats,
      forensicTraces: [],
      timestamp: new Date().toISOString()
    };

    return {
      status: 'FAILED',
      verdict: verdictResult.verdict,
      converged: false,
      verified: false,
      failureType,
      failureReason: reason,
      displacements: [],
      reactions: [],
      globalReactionVector: [],
      elementResults: [],
      residualMetrics: dummyResidual,
      independentResidualMetrics: dummyResidual,
      equilibriumMetrics: dummyEquilibrium,
      energyMetrics: dummyEnergy,
      performanceStats: stats,
      evidencePacket: dummyPacket,
      evidenceHash: verdictResult.evidenceHash
    };
  }
}
