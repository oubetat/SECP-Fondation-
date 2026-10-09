import { Matrix } from "../core/MathUtils";
import { NonlinearStructuralSystem, PrescribedDisplacement } from "../material/NonlinearStructuralSystem";
import { ContactActiveSet } from "./ContactActiveSet";
import { ContactIntegrator, GlobalContactAssemblyResult } from "./ContactIntegrator";
import { ContactPair } from "./ContactPair";
import { ContactPointState, ContactStatus, ContactVerdict } from "./types";

export interface ContactCoupledSolverOptions {
  maxIterations?: number;
  toleranceResidual?: number;
  toleranceDisplacement?: number;
  toleranceComplementarity?: number;
  loadSteps?: number;
}

export interface ContactStepResult {
  step: number;
  converged: boolean;
  iterations: number;
  displacements: number[];
  internalForce: number[];
  contactForce: number[];
  residualNorm: number;
  penetrationMax: number;
  activeContacts: number;
  verdict: ContactVerdict;
  pointStates: ContactPointState[];
}

export class ContactCoupledSolver {
  readonly system: NonlinearStructuralSystem;
  readonly contactPairs: ContactPair[];
  readonly activeSet: ContactActiveSet = new ContactActiveSet();

  constructor(system: NonlinearStructuralSystem, contactPairs: ContactPair[]) {
    this.system = system;
    this.contactPairs = contactPairs;
  }

  /**
   * Solves a load step with coupled nonlinear material and contact mechanics.
   */
  solveStep(
    externalForces: number[],
    prescribedDisplacements: PrescribedDisplacement[],
    options: ContactCoupledSolverOptions = {}
  ): ContactStepResult {
    const maxIter = options.maxIterations ?? 25;
    const tolR = options.toleranceResidual ?? 1e-4;
    const tolU = options.toleranceDisplacement ?? 1e-6;

    const totalDOFs = this.system.totalDOFs;
    let u = new Array(totalDOFs).fill(0.0);

    // Apply prescribed displacements directly as initial state
    for (const p of prescribedDisplacements) {
      const node = this.system.nodes.find(n => n.id === p.nodeId);
      if (node) {
        const globalDOF = node.index * this.system.dofsPerNode + p.dofIndex;
        u[globalDOF] = p.value;
      }
    }

    // Build node DOF mapping
    const nodeDOFMap = new Map<string, number[]>();
    for (const node of this.system.nodes) {
      const dofs: number[] = [];
      for (let d = 0; d < this.system.dofsPerNode; d++) {
        dofs.push(node.index * this.system.dofsPerNode + d);
      }
      nodeDOFMap.set(node.id, dofs);
    }

    let iterations = 0;
    let converged = false;
    let residualNorm = Infinity;
    let lastAssemblyResult: GlobalContactAssemblyResult | null = null;

    while (iterations < maxIter && !converged) {
      iterations++;

      // 1. Update node coordinates from displacement u
      const nodeDispsMap = new Map<string, number[]>();
      for (const node of this.system.nodes) {
        const dofs = nodeDOFMap.get(node.id)!;
        nodeDispsMap.set(node.id, dofs.map(idx => u[idx]));
      }

      for (const pair of this.contactPairs) {
        pair.slaveSurface.updateDisplacements(nodeDispsMap);
        pair.masterSurface.updateDisplacements(nodeDispsMap);
      }

      // 2. Material system assembly (f_int, K_material)
      const matAssembly = this.system.assembleSystem(u);

      // 3. Contact system assembly (f_contact, K_contact)
      let F_contactTotal = new Array(totalDOFs).fill(0.0);
      let K_contactTotal = Matrix.zeros(totalDOFs, totalDOFs);
      let allPointStates: ContactPointState[] = [];
      let maxPenetration = 0.0;

      for (const pair of this.contactPairs) {
        const cRes = ContactIntegrator.evaluateContactPair(pair, totalDOFs, nodeDOFMap, this.activeSet);
        lastAssemblyResult = cRes;
        if (cRes.penetrationMax > maxPenetration) maxPenetration = cRes.penetrationMax;

        for (let i = 0; i < totalDOFs; i++) {
          F_contactTotal[i] += cRes.contactForce[i];
        }

        for (let i = 0; i < totalDOFs; i++) {
          for (let j = 0; j < totalDOFs; j++) {
            K_contactTotal.add(i, j, cRes.contactTangent.get(i, j));
          }
        }

        allPointStates = allPointStates.concat(cRes.pointStates);
      }

      // 4. Global Residual vector R = F_int + F_contact - F_ext
      const Residual = new Array(totalDOFs).fill(0.0);
      for (let i = 0; i < totalDOFs; i++) {
        Residual[i] = matAssembly.internalForce[i] + F_contactTotal[i] - externalForces[i];
      }

      // Zero out residual for prescribed DOFs
      const freeDOFs: number[] = [];
      const fixedDOFSet = new Set<number>();
      for (const p of prescribedDisplacements) {
        const node = this.system.nodes.find(n => n.id === p.nodeId);
        if (node) {
          const gDOF = node.index * this.system.dofsPerNode + p.dofIndex;
          fixedDOFSet.add(gDOF);
        }
      }

      for (let i = 0; i < totalDOFs; i++) {
        if (!fixedDOFSet.has(i)) {
          freeDOFs.push(i);
        } else {
          Residual[i] = 0.0;
        }
      }

      // Residual norm on free DOFs
      let rSquare = 0.0;
      for (const dof of freeDOFs) {
        rSquare += Residual[dof] * Residual[dof];
      }
      residualNorm = Math.sqrt(rSquare);

      if (residualNorm < tolR) {
        converged = true;
        break;
      }

      // 5. Global Tangent Stiffness Matrix K_global = K_mat + K_contact
      const K_global = Matrix.zeros(totalDOFs, totalDOFs);
      for (let i = 0; i < totalDOFs; i++) {
        for (let j = 0; j < totalDOFs; j++) {
          K_global.set(i, j, matAssembly.tangentStiffness.get(i, j) + K_contactTotal.get(i, j));
        }
      }

      // Solve reduced system for free DOFs
      const numFree = freeDOFs.length;
      if (numFree === 0) {
        converged = true;
        break;
      }

      const K_free = Matrix.zeros(numFree, numFree);
      const R_free = new Array(numFree).fill(0.0);

      for (let i = 0; i < numFree; i++) {
        R_free[i] = Residual[freeDOFs[i]];
        for (let j = 0; j < numFree; j++) {
          K_free.set(i, j, K_global.get(freeDOFs[i], freeDOFs[j]));
        }
      }

      // Solve K_free * delta_u_free = -R_free
      let deltaU_free: number[];
      try {
        const K_inv = K_free.inverse();
        deltaU_free = K_inv.multiplyVector(R_free.map(r => -r));
      } catch (err) {
        // Fallback or diagonal regularization if singular
        deltaU_free = R_free.map((r, idx) => {
          const diag = K_free.get(idx, idx) || 1e6;
          return -r / diag;
        });
      }

      // Update displacement vector u
      let duNorm = 0.0;
      for (let i = 0; i < numFree; i++) {
        const dof = freeDOFs[i];
        const du = deltaU_free[i];
        u[dof] += du;
        duNorm += du * du;
      }

      if (Math.sqrt(duNorm) < tolU && residualNorm < tolR * 10) {
        converged = true;
        break;
      }
    }

    if (converged) {
      this.system.commitAllMaterialStates();
      return {
        step: 1,
        converged: true,
        iterations,
        displacements: u,
        internalForce: this.system.assembleSystem(u).internalForce,
        contactForce: lastAssemblyResult ? lastAssemblyResult.contactForce : new Array(totalDOFs).fill(0),
        residualNorm,
        penetrationMax: lastAssemblyResult ? lastAssemblyResult.penetrationMax : 0,
        activeContacts: lastAssemblyResult ? lastAssemblyResult.activeCount : 0,
        verdict: lastAssemblyResult && lastAssemblyResult.activeCount > 0 ? 'ACTIVE' : 'OPEN',
        pointStates: lastAssemblyResult ? lastAssemblyResult.pointStates : []
      };
    } else {
      this.system.revertAllMaterialStates();
      return {
        step: 1,
        converged: false,
        iterations,
        displacements: u,
        internalForce: new Array(totalDOFs).fill(0),
        contactForce: new Array(totalDOFs).fill(0),
        residualNorm,
        penetrationMax: lastAssemblyResult ? lastAssemblyResult.penetrationMax : 0,
        activeContacts: 0,
        verdict: 'NOT_CONVERGED',
        pointStates: []
      };
    }
  }
}
