import { Matrix } from "../core/MathUtils";
import { NonlinearStructuralSystem, PrescribedDisplacement } from "../material/NonlinearStructuralSystem";
import { ContactManager } from "./ContactManager";
import { ContactPair } from "./ContactPair";
import { ContactPointState, ContactVerdict } from "./types";

export interface ContactSolverOptions {
  maxIterations?: number;
  toleranceResidual?: number;
  toleranceDisplacement?: number;
  tolerancePenetration?: number;
  loadSteps?: number;
}

export interface ContactSolverStepResult {
  step: number;
  converged: boolean;
  iterations: number;
  displacements: number[];
  internalForce: number[];
  contactForce: number[];
  residualNorm: number;
  penetrationMax: number;
  activeContacts: number;
  stickContacts: number;
  slipContacts: number;
  verdict: ContactVerdict;
  pointStates: ContactPointState[];
  violations: string[];
}

export class ContactSolverEngine {
  readonly system: NonlinearStructuralSystem;
  readonly contactManager: ContactManager = new ContactManager();

  constructor(system: NonlinearStructuralSystem, contactPairs: ContactPair[] = []) {
    this.system = system;
    for (const pair of contactPairs) {
      this.contactManager.addPair(pair);
    }
  }

  /**
   * Solves a load step executing the complete numerical pathway:
   * Geometry -> Contact Detection -> Pairing -> Gap -> Contact State -> Constraint -> Forces -> Tangent -> Global Assembly -> Newton-Raphson -> Convergence
   */
  solveStep(
    externalForces: number[],
    prescribedDisplacements: PrescribedDisplacement[] = [],
    options: ContactSolverOptions = {}
  ): ContactSolverStepResult {
    const maxIter = options.maxIterations ?? 30;
    const tolR = options.toleranceResidual ?? 1e-4;
    const tolU = options.toleranceDisplacement ?? 1e-6;

    const totalDOFs = this.system.totalDOFs;
    let u = new Array(totalDOFs).fill(0.0);

    // Apply prescribed displacements
    for (const p of prescribedDisplacements) {
      const node = this.system.nodes.find(n => n.id === p.nodeId);
      if (node) {
        const globalDOF = node.index * this.system.dofsPerNode + p.dofIndex;
        u[globalDOF] = p.value;
      }
    }

    // Node index to global DOF mapping
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
    let lastForceRes: any = null;
    let lastConvergenceRes: any = null;

    while (iterations < maxIter && !converged) {
      iterations++;

      // 1. Update contact surface geometry dynamically from current displacement u (Large deformation contact update)
      const nodeDispsMap = new Map<string, number[]>();
      for (const node of this.system.nodes) {
        const dofs = nodeDOFMap.get(node.id)!;
        nodeDispsMap.set(node.id, dofs.map(idx => u[idx]));
      }
      this.contactManager.updateGeometryDisplacements(nodeDispsMap);

      // 2. Structural material assembly (F_int, K_mat)
      const matAssembly = this.system.assembleSystem(u);

      // 3. Contact forces assembly (F_contact)
      const forceRes = this.contactManager.assembleGlobalForce(totalDOFs, nodeDOFMap);
      lastForceRes = forceRes;

      // 4. Contact tangent stiffness assembly (K_contact)
      const K_contact = this.contactManager.assembleGlobalTangent(totalDOFs, nodeDOFMap);

      // 5. Global Residual vector R = F_int + F_contact - F_ext
      const Residual = new Array(totalDOFs).fill(0.0);
      for (let i = 0; i < totalDOFs; i++) {
        Residual[i] = matAssembly.internalForce[i] + forceRes.contactForce[i] - externalForces[i];
      }

      // Zero out residual for fixed/prescribed DOFs
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

      // Check residual norm on free DOFs
      let rSquare = 0.0;
      for (const dof of freeDOFs) {
        rSquare += Residual[dof] * Residual[dof];
      }
      residualNorm = Math.sqrt(rSquare);

      // 6. Contact constraint convergence check
      const contactConv = this.contactManager.evaluateConvergence();
      lastConvergenceRes = contactConv;

      if (residualNorm < tolR && contactConv.converged) {
        converged = true;
        break;
      }

      // 7. Global Tangent Stiffness K_global = K_mat + K_contact
      const K_global = Matrix.zeros(totalDOFs, totalDOFs);
      for (let i = 0; i < totalDOFs; i++) {
        for (let j = 0; j < totalDOFs; j++) {
          K_global.set(i, j, matAssembly.tangentStiffness.get(i, j) + K_contact.get(i, j));
        }
      }

      const numFree = freeDOFs.length;
      if (numFree === 0) {
        converged = true;
        break;
      }

      // Solve K_free * delta_u_free = -R_free
      const K_free = Matrix.zeros(numFree, numFree);
      const R_free = new Array(numFree).fill(0.0);

      for (let i = 0; i < numFree; i++) {
        R_free[i] = Residual[freeDOFs[i]];
        for (let j = 0; j < numFree; j++) {
          K_free.set(i, j, K_global.get(freeDOFs[i], freeDOFs[j]));
        }
      }

      let deltaU_free: number[];
      try {
        const K_inv = K_free.inverse();
        deltaU_free = K_inv.multiplyVector(R_free.map(r => -r));
      } catch (err) {
        // Fallback solver with diagonal regularization
        deltaU_free = R_free.map((r, idx) => {
          const diag = K_free.get(idx, idx) || 1e6;
          return -r / diag;
        });
      }

      // Update displacement vector u
      let duNormSq = 0.0;
      for (let i = 0; i < numFree; i++) {
        const dof = freeDOFs[i];
        const du = deltaU_free[i];
        u[dof] += du;
        duNormSq += du * du;
      }

      if (Math.sqrt(duNormSq) < tolU && residualNorm < tolR * 5 && contactConv.converged) {
        converged = true;
        break;
      }
    }

    if (converged) {
      this.system.commitAllMaterialStates();
      this.contactManager.commitStep(1, iterations);
      return {
        step: 1,
        converged: true,
        iterations,
        displacements: u,
        internalForce: this.system.assembleSystem(u).internalForce,
        contactForce: lastForceRes ? lastForceRes.contactForce : new Array(totalDOFs).fill(0),
        residualNorm,
        penetrationMax: lastForceRes ? lastForceRes.penetrationMax : 0,
        activeContacts: lastForceRes ? lastForceRes.activeCount : 0,
        stickContacts: lastForceRes ? lastForceRes.stickCount : 0,
        slipContacts: lastForceRes ? lastForceRes.slipCount : 0,
        verdict: lastForceRes && lastForceRes.activeCount > 0 ? 'ACTIVE' : 'OPEN',
        pointStates: lastForceRes ? lastForceRes.pointStates : [],
        violations: lastConvergenceRes ? lastConvergenceRes.violations : []
      };
    } else {
      this.system.revertAllMaterialStates();
      this.contactManager.rollbackStep();
      return {
        step: 1,
        converged: false,
        iterations,
        displacements: u,
        internalForce: new Array(totalDOFs).fill(0),
        contactForce: new Array(totalDOFs).fill(0),
        residualNorm,
        penetrationMax: lastForceRes ? lastForceRes.penetrationMax : 0,
        activeContacts: 0,
        stickContacts: 0,
        slipContacts: 0,
        verdict: 'NOT_CONVERGED',
        pointStates: [],
        violations: lastConvergenceRes ? lastConvergenceRes.violations : ['Nonlinear contact solver failed to converge']
      };
    }
  }
}
