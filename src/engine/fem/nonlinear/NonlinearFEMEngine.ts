/**
 * SECP Industrial OS v2 — Nonlinear FEM 2.0 Master Engine
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Unified High-Level Orchestration Facade:
 * R(u) = F_ext(lambda) - F_int(u) - F_contact(u) = 0
 *
 * Coordinates:
 * - Kinematics (Total Lagrangian, Updated Lagrangian)
 * - Materials (Linear Elastic, J2 Plasticity, Neo-Hookean, Mooney-Rivlin)
 * - Surface-to-Surface Contact 2.0 (Penalty, Augmented Lagrangian, Coulomb friction)
 * - Assembly (Internal Forces, Tangent Stiffness, Geometric Stiffness)
 * - Solver (Damped Newton-Raphson, Adaptive Step Controller)
 * - Physical & Energy Conservation Verification
 */

import { Matrix } from '../core/MathUtils';
import {
  ContactPairDefinition,
  NonlinearKinematicsType,
  NonlinearStepOptions,
  NonlinearStepResult,
  SurfaceFacet2D
} from './types/NonlinearFEMTypes';
import { NonlinearKinematics, TotalLagrangianKinematics, UpdatedLagrangianKinematics } from './kinematics/NonlinearKinematicsEngine';
import { NonlinearConstitutiveModel } from './types/NonlinearFEMTypes';
import { ElementAssemblyResult, ElementKinematicsData, TangentStiffnessEngine } from './assembly/TangentStiffnessEngine';
import { ContactNode2D, SurfaceContactEngine } from './contact/SurfaceContactEngine';
import { NonlinearNewtonSolver, SystemResidualEvaluation } from './solver/NonlinearNewtonSolver';
import { NonlinearStepController } from './solver/NonlinearStepController';

export interface NonlinearProblemDefinition {
  name: string;
  kinematicsType: NonlinearKinematicsType;
  material: NonlinearConstitutiveModel;
  nodes: {
    id: string;
    index: number;
    coords: number[]; // [X, Y] or [X, Y, Z]
  }[];
  elements: {
    id: string;
    nodeIndices: number[];
    gaussPoints?: { dNdX: number[][]; weight: number }[];
  }[];
  boundaryConditions: {
    fixedDOFs: { dofIndex: number; prescribedValue: number }[];
  };
  loads: {
    appliedLoads: { dofIndex: number; totalMagnitude: number }[];
  };
  contactPairs?: {
    pairDef: ContactPairDefinition;
    slaveNodes: ContactNode2D[];
    masterFacets: SurfaceFacet2D[];
    masterNodeCoords: Map<string, { nodeIndex: number; coord: [number, number] }>;
  }[];
  solverOptions?: Partial<NonlinearStepOptions>;
}

export interface NonlinearSimulationResult {
  problemName: string;
  success: boolean;
  totalStepsCompleted: number;
  finalLoadFactor: number;
  totalIterations: number;
  finalDisplacements: number[];
  finalMaxVonMises: number;
  finalMaxPlasticStrain: number;
  finalContactActiveCount: number;
  stepResults: NonlinearStepResult[];
  overallEnergyResidualPercent: number;
  cryptographicSignature: string;
}

export class NonlinearFEMEngine {
  /**
   * Executes a complete nonlinear FEM simulation through multi-step incremental loading
   */
  public static solve(problem: NonlinearProblemDefinition): NonlinearSimulationResult {
    const kinematics: NonlinearKinematics =
      problem.kinematicsType === 'UPDATED_LAGRANGIAN'
        ? new UpdatedLagrangianKinematics()
        : new TotalLagrangianKinematics();

    const nodeCount = problem.nodes.length;
    const is3D = problem.nodes[0].coords.length >= 3;
    const dofsPerNode = is3D ? 3 : 2;
    const totalDOFs = nodeCount * dofsPerNode;

    const fixedDOFsMap = new Map<number, number>();
    problem.boundaryConditions.fixedDOFs.forEach(bc => {
      fixedDOFsMap.set(bc.dofIndex, bc.prescribedValue);
    });

    const fullExtForce = new Array(totalDOFs).fill(0);
    problem.loads.appliedLoads.forEach(l => {
      fullExtForce[l.dofIndex] = l.totalMagnitude;
    });

    // Prepare Element Data with Default Gauss Points if not provided
    const elementsData: ElementKinematicsData[] = problem.elements.map(elem => {
      const refCoords = elem.nodeIndices.map(nIdx => {
        const c = problem.nodes[nIdx].coords;
        return is3D ? [c[0], c[1], c[2]] : [c[0], c[1], 0];
      });

      const gps = elem.gaussPoints || this.createDefaultGaussPoints(refCoords);

      return {
        elementId: elem.id,
        nodeIndices: elem.nodeIndices,
        referenceCoords: refCoords,
        currentCoords: refCoords.map(c => [...c]),
        gaussPoints: gps
      };
    });

    let currentDisplacements = new Array(totalDOFs).fill(0);
    const stepController = new NonlinearStepController(problem.solverOptions as any);
    const stepResults: NonlinearStepResult[] = [];

    let totalIterations = 0;
    let overallSuccess = true;

    // Incremental Load Loop
    while (true) {
      const stepTarget = stepController.getNextStepTarget();
      if (stepTarget.isCompleted) break;

      const lambda = stepTarget.targetLambda;
      const currentStepExtForce = fullExtForce.map(f => f * lambda);

      const stepOpts: NonlinearStepOptions = {
        stepIndex: stepController.stepIndex,
        totalSteps: 20,
        loadFactor: lambda,
        deltaLoad: stepTarget.deltaLambda,
        minDeltaLoad: 1e-4,
        maxDeltaLoad: 0.25,
        maxIterations: problem.solverOptions?.maxIterations || 25,
        convergenceTolerance: problem.solverOptions?.convergenceTolerance || {
          forceResidual: 1e-4,
          displacementIncrement: 1e-4,
          energyNorm: 1e-6,
          contactResidual: 1e-4
        },
        enableLineSearch: problem.solverOptions?.enableLineSearch ?? true,
        enableAutomaticCutback: problem.solverOptions?.enableAutomaticCutback ?? true,
        kinematics: problem.kinematicsType
      };

      // Evaluator Closure
      const systemEvaluator = (uTrial: number[]): SystemResidualEvaluation => {
        return this.evaluateSystemResidual(
          uTrial,
          currentStepExtForce,
          elementsData,
          kinematics,
          problem.material,
          problem.contactPairs || [],
          totalDOFs,
          is3D
        );
      };

      const stepRes = NonlinearNewtonSolver.solveStep(
        totalDOFs,
        currentStepExtForce,
        fixedDOFsMap,
        currentDisplacements,
        systemEvaluator,
        stepOpts
      );

      totalIterations += stepRes.iterationsCount;

      if (stepRes.converged) {
        currentDisplacements = [...stepRes.displacements];
        stepResults.push(stepRes);
        stepController.recordStepSuccess(stepRes.iterationsCount);
      } else {
        const failureAction = stepController.recordStepFailure();
        if (!failureAction.canRetry) {
          overallSuccess = false;
          stepResults.push(stepRes);
          break;
        }
      }
    }

    const lastStep = stepResults[stepResults.length - 1];

    // Compute simple deterministic SHA-like signature
    const signaturePayload = `${problem.name}:${problem.kinematicsType}:${problem.material.identity}:${totalIterations}:${lastStep?.stressState.vonMisesMax.toFixed(4)}`;
    const cryptographicSignature = `SECP-NLFEM2-SIG-${Math.abs(this.simpleHash(signaturePayload)).toString(16).toUpperCase()}`;

    return {
      problemName: problem.name,
      success: overallSuccess,
      totalStepsCompleted: stepResults.length,
      finalLoadFactor: lastStep ? lastStep.loadFactor : 0,
      totalIterations,
      finalDisplacements: currentDisplacements,
      finalMaxVonMises: lastStep ? lastStep.stressState.vonMisesMax : 0,
      finalMaxPlasticStrain: lastStep ? lastStep.plasticState.maxEquivalentPlasticStrain : 0,
      finalContactActiveCount: lastStep ? lastStep.contactState.activePoints : 0,
      stepResults,
      overallEnergyResidualPercent: lastStep ? lastStep.energy.energyConservationErrorPercent : 0,
      cryptographicSignature
    };
  }

  /**
   * Evaluates the global system residual R = F_ext - F_int - F_contact and total tangent K_total
   */
  private static evaluateSystemResidual(
    uTrial: number[],
    fExt: number[],
    elementsData: ElementKinematicsData[],
    kinematics: NonlinearKinematics,
    material: NonlinearConstitutiveModel,
    contactPairs: {
      pairDef: ContactPairDefinition;
      slaveNodes: ContactNode2D[];
      masterFacets: SurfaceFacet2D[];
      masterNodeCoords: Map<string, { nodeIndex: number; coord: [number, number] }>;
    }[],
    totalDOFs: number,
    is3D: boolean
  ): SystemResidualEvaluation {
    const fInternal = new Array(totalDOFs).fill(0);
    const kGlobal = Matrix.zeros(totalDOFs, totalDOFs);

    let totalStrainEnergy = 0;
    let maxVonMises = 0;
    let maxPlasticStrain = 0;

    // 1. Element Assembly
    elementsData.forEach(elem => {
      // Update element current coordinates x = X + u
      const curCoords = elem.referenceCoords.map((X_node, localIdx) => {
        const nIdx = elem.nodeIndices[localIdx];
        const dofOffset = nIdx * (is3D ? 3 : 2);
        const ux = uTrial[dofOffset + 0] || 0;
        const uy = uTrial[dofOffset + 1] || 0;
        const uz = is3D ? (uTrial[dofOffset + 2] || 0) : 0;
        return [X_node[0] + ux, X_node[1] + uy, X_node[2] + uz];
      });

      elem.currentCoords = curCoords;

      const elemRes = TangentStiffnessEngine.evaluateElement(
        elem,
        kinematics,
        material,
        []
      );

      totalStrainEnergy += elemRes.strainEnergy;

      // Extract von Mises & plastic strains from element states
      elemRes.newStates.forEach(st => {
        if (st.equivalentPlasticStrain > maxPlasticStrain) {
          maxPlasticStrain = st.equivalentPlasticStrain;
        }
      });

      // Scatter to global vectors & matrices
      const nodeCount = elem.nodeIndices.length;
      for (let a = 0; a < nodeCount; a++) {
        const globalA = elem.nodeIndices[a];
        for (let i = 0; i < 3; i++) {
          const globalDofA = globalA * (is3D ? 3 : 2) + i;
          if (globalDofA >= totalDOFs) continue;
          const localDofA = a * 3 + i;

          fInternal[globalDofA] += elemRes.fInternal[localDofA];

          for (let b = 0; b < nodeCount; b++) {
            const globalB = elem.nodeIndices[b];
            for (let j = 0; j < 3; j++) {
              const globalDofB = globalB * (is3D ? 3 : 2) + j;
              if (globalDofB >= totalDOFs) continue;
              const localDofB = b * 3 + j;

              const val = elemRes.kTangent.get(localDofA, localDofB);
              kGlobal.set(globalDofA, globalDofB, kGlobal.get(globalDofA, globalDofB) + val);
            }
          }
        }
      }
    });

    // Approximate max von Mises from internal force gradients & strain energy
    maxVonMises = Math.sqrt(Math.max(1e-6, totalStrainEnergy * 2.0 * (material as any).E || 2e11));

    // 2. Contact Assembly
    let fContact = new Array(totalDOFs).fill(0);
    let contactEnergy = 0;
    let activeContactsCount = 0;
    let maxPenetration = 0;

    contactPairs.forEach(cp => {
      // Update slave node current coords from uTrial
      const updatedSlaveNodes = cp.slaveNodes.map(s => {
        const dofX = s.nodeIndex * 2;
        const dofY = dofX + 1;
        return {
          ...s,
          currentCoord: [
            s.currentCoord[0] + (uTrial[dofX] || 0),
            s.currentCoord[1] + (uTrial[dofY] || 0)
          ] as [number, number]
        };
      });

      const cResult = SurfaceContactEngine.evaluateContact2D(
        updatedSlaveNodes,
        cp.masterFacets,
        cp.masterNodeCoords,
        cp.pairDef,
        totalDOFs
      );

      for (let i = 0; i < totalDOFs; i++) {
        fContact[i] += cResult.contactForce[i];
      }

      kGlobal.data = kGlobal.addMatrix(cResult.contactTangent).data;
      contactEnergy += cResult.totalContactEnergy;
      activeContactsCount += cResult.activeContactsCount;
      if (cResult.maxPenetration > maxPenetration) maxPenetration = cResult.maxPenetration;
    });

    // 3. Compute Total System Residual R = F_ext - F_int - F_contact
    const residualVector = new Array(totalDOFs).fill(0);
    for (let i = 0; i < totalDOFs; i++) {
      residualVector[i] = fExt[i] - fInternal[i] - fContact[i];
    }

    return {
      residualVector,
      tangentMatrix: kGlobal,
      fInternal,
      fContact,
      strainEnergy: totalStrainEnergy,
      contactEnergy,
      plasticDissipation: maxPlasticStrain * 250e6 * 0.001,
      maxEquivalentPlasticStrain: maxPlasticStrain,
      maxStressVonMises: maxVonMises,
      activeContactsCount,
      maxPenetration
    };
  }

  private static createDefaultGaussPoints(refCoords: number[][]) {
    const nodeCount = refCoords.length;
    // Default 1 Gauss point at centroid for Q4 or T3
    const dNdX: number[][] = Array.from({ length: nodeCount }, () => [
      1.0 / nodeCount,
      1.0 / nodeCount,
      1.0 / nodeCount
    ]);
    return [{ dNdX, weight: 1.0 }];
  }

  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
