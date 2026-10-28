/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — FEM Verification Pipeline
 */

import { Solid } from '../../cad-kernel/topology/TopologyContracts';
import { CadToFemModelBuilder } from './CadToFemModelBuilder';
import { GeometryIntegrityCheck, GeometryIntegrityReport } from './GeometryIntegrityCheck';
import { MeshQualityGate, MeshGateReport } from './MeshQualityGate';
import { BoundaryConditionEngine, BCPipelineExecutionResult } from '../bc/BoundaryConditionEngine';
import { FactorOfSafetyCalculator, FoSReport } from './FactorOfSafetyCalculator';
import { ResultProvenanceTracker } from './ResultProvenanceTracker';
import { AnalysisType } from './types';
import { FEMMesh } from '../mesh/FEMMesh';

export interface PipelineExecutionReport {
  success: boolean;
  modelIntegrity: GeometryIntegrityReport;
  meshQuality: MeshGateReport;
  analysisResults: BCPipelineExecutionResult;
  fosReport: FoSReport;
  provenanceHash: string;
  verdict: 'VERIFIED' | 'FAILED';
}

/**
 * FemVerificationPipeline: Orchestrates the CAD → Results sequence.
 */
export class FemVerificationPipeline {
  public static execute(
    solid: Solid,
    elementSize: number,
    materialProps: { youngModulus: number, poissonRatio: number, yieldStrength: number },
    setupBCs: (mesh: FEMMesh, engine: BoundaryConditionEngine) => void,
    documentRevision: number = 1
  ): PipelineExecutionReport {
    const modelIntegrity = GeometryIntegrityCheck.verify(solid);
    if (!modelIntegrity.valid) throw new Error("CAD_INVALID");

    const { mesh, mappings } = CadToFemModelBuilder.build(solid, elementSize);
    const meshQuality = MeshQualityGate.verify(mesh);
    if (!meshQuality.passed) throw new Error("MESH_INVALID");

    const bcEngine = new BoundaryConditionEngine();
    setupBCs(mesh, bcEngine);

    const materialDensityMap = new Map<string, number>();
    mesh.regions.forEach(r => materialDensityMap.set(r.id, 7850));

    const analysisResults = bcEngine.executeBCPipeline(mesh, 'LC_VERIF', 'ROW_COLUMN_MODIFICATION', materialDensityMap);
    if (!analysisResults.success) throw new Error("SOLVER_FAILURE");

    const vonMisesMap = this.recoverNodalStresses(mesh, analysisResults.displacementSolution || [], materialProps.youngModulus, materialProps.poissonRatio);
    const fosReport = FactorOfSafetyCalculator.calculate(vonMisesMap, mesh.nodes, materialProps.yieldStrength);

    const provenance = ResultProvenanceTracker.createProvenance(
      `P240_${solid.id}`, mesh, materialProps, { loadCase: 'LC_01' }, 
      { bcCount: bcEngine.getRegistry().getAllBoundaryConditions().length },
      { solver: 'SPARSE' }, analysisResults.displacementSolution, AnalysisType.LINEAR_STATIC,
      documentRevision
    );

    const success = analysisResults.success && fosReport.verdict !== 'FAIL';
    return { success, modelIntegrity, meshQuality, analysisResults, fosReport, provenanceHash: provenance.verificationId, verdict: success ? 'VERIFIED' : 'FAILED' };
  }

  /**
   * Recovers nodal Cauchy stress tensors and von Mises equivalent stress
   * from displacement solution using tetrahedral strain-displacement kinematics
   * and linear isotropic constitutive Hookean relations.
   */
  private static recoverNodalStresses(
    mesh: FEMMesh,
    displacements: number[],
    E: number,
    nu: number = 0.3
  ): Map<string, number> {
    const vonMisesMap = new Map<string, number>();
    const nodeIndexMap = new Map<string, number>();
    mesh.nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

    // Accumulators for nodal stress tensor averaging
    const nodeStressAccum = new Map<string, {
      sigX: number; sigY: number; sigZ: number;
      tauXY: number; tauYZ: number; tauXZ: number;
      count: number;
    }>();

    mesh.nodes.forEach(n => {
      nodeStressAccum.set(n.id, { sigX: 0, sigY: 0, sigZ: 0, tauXY: 0, tauYZ: 0, tauXZ: 0, count: 0 });
    });

    const nuEff = Math.min(0.499, Math.max(0.01, nu));
    const lambda = (E * nuEff) / ((1 + nuEff) * (1 - 2 * nuEff));
    const mu = E / (2 * (1 + nuEff));

    // Element-level Cauchy stress recovery
    for (const elem of mesh.elements) {
      if (!elem.nodeIds || elem.nodeIds.length < 4) continue;
      const n0Id = elem.nodeIds[0];
      const n1Id = elem.nodeIds[1];
      const n2Id = elem.nodeIds[2];
      const n3Id = elem.nodeIds[3];

      const idx0 = nodeIndexMap.get(n0Id);
      const idx1 = nodeIndexMap.get(n1Id);
      const idx2 = nodeIndexMap.get(n2Id);
      const idx3 = nodeIndexMap.get(n3Id);

      if (idx0 === undefined || idx1 === undefined || idx2 === undefined || idx3 === undefined) continue;

      const node0 = mesh.nodes[idx0];
      const node1 = mesh.nodes[idx1];
      const node2 = mesh.nodes[idx2];
      const node3 = mesh.nodes[idx3];

      // Coordinate differences for Jacobian
      const J11 = node1.x - node0.x, J12 = node1.y - node0.y, J13 = node1.z - node0.z;
      const J21 = node2.x - node0.x, J22 = node2.y - node0.y, J23 = node2.z - node0.z;
      const J31 = node3.x - node0.x, J32 = node3.y - node0.y, J33 = node3.z - node0.z;

      const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
      if (Math.abs(detJ) < 1e-14) continue;

      const invDetJ = 1.0 / detJ;
      // Inverse Jacobian transpose components
      const invJ11 = (J22 * J33 - J23 * J32) * invDetJ;
      const invJ12 = (J13 * J32 - J12 * J33) * invDetJ;
      const invJ13 = (J12 * J23 - J13 * J22) * invDetJ;

      const invJ21 = (J23 * J31 - J21 * J33) * invDetJ;
      const invJ22 = (J11 * J33 - J13 * J31) * invDetJ;
      const invJ23 = (J13 * J21 - J11 * J23) * invDetJ;

      const invJ31 = (J21 * J32 - J22 * J31) * invDetJ;
      const invJ32 = (J12 * J31 - J11 * J32) * invDetJ;
      const invJ33 = (J11 * J22 - J12 * J21) * invDetJ;

      // Shape function derivatives in reference coordinates
      const dN_dxi = [-1, 1, 0, 0];
      const dN_deta = [-1, 0, 1, 0];
      const dN_dzeta = [-1, 0, 0, 1];

      // Physical derivatives of shape functions dN/dx, dN/dy, dN/dz
      const dN_dx = new Float64Array(4);
      const dN_dy = new Float64Array(4);
      const dN_dz = new Float64Array(4);

      for (let i = 0; i < 4; i++) {
        dN_dx[i] = invJ11 * dN_dxi[i] + invJ12 * dN_deta[i] + invJ13 * dN_dzeta[i];
        dN_dy[i] = invJ21 * dN_dxi[i] + invJ22 * dN_deta[i] + invJ23 * dN_dzeta[i];
        dN_dz[i] = invJ31 * dN_dxi[i] + invJ32 * dN_deta[i] + invJ33 * dN_dzeta[i];
      }

      // Elemental nodal displacements
      const indices = [idx0, idx1, idx2, idx3];
      const uNode = [
        displacements[idx0 * 3] || 0, displacements[idx1 * 3] || 0, displacements[idx2 * 3] || 0, displacements[idx3 * 3] || 0
      ];
      const vNode = [
        displacements[idx0 * 3 + 1] || 0, displacements[idx1 * 3 + 1] || 0, displacements[idx2 * 3 + 1] || 0, displacements[idx3 * 3 + 1] || 0
      ];
      const wNode = [
        displacements[idx0 * 3 + 2] || 0, displacements[idx1 * 3 + 2] || 0, displacements[idx2 * 3 + 2] || 0, displacements[idx3 * 3 + 2] || 0
      ];

      // Strain tensor components
      let epsX = 0, epsY = 0, epsZ = 0;
      let gamXY = 0, gamYZ = 0, gamXZ = 0;

      for (let i = 0; i < 4; i++) {
        epsX += uNode[i] * dN_dx[i];
        epsY += vNode[i] * dN_dy[i];
        epsZ += wNode[i] * dN_dz[i];

        gamXY += uNode[i] * dN_dy[i] + vNode[i] * dN_dx[i];
        gamYZ += vNode[i] * dN_dz[i] + wNode[i] * dN_dy[i];
        gamXZ += uNode[i] * dN_dz[i] + wNode[i] * dN_dx[i];
      }

      // Cauchy stress tensor from 3D Hookean law
      const trEps = epsX + epsY + epsZ;
      const sigX = lambda * trEps + 2 * mu * epsX;
      const sigY = lambda * trEps + 2 * mu * epsY;
      const sigZ = lambda * trEps + 2 * mu * epsZ;
      const tauXY = mu * gamXY;
      const tauYZ = mu * gamYZ;
      const tauXZ = mu * gamXZ;

      // Accumulate to element nodes
      for (const nid of [n0Id, n1Id, n2Id, n3Id]) {
        const acc = nodeStressAccum.get(nid);
        if (acc) {
          acc.sigX += sigX;
          acc.sigY += sigY;
          acc.sigZ += sigZ;
          acc.tauXY += tauXY;
          acc.tauYZ += tauYZ;
          acc.tauXZ += tauXZ;
          acc.count++;
        }
      }
    }

    // Recover nodal von Mises from averaged stress tensors
    mesh.nodes.forEach((node, i) => {
      const acc = nodeStressAccum.get(node.id);
      if (acc && acc.count > 0) {
        const sx = acc.sigX / acc.count;
        const sy = acc.sigY / acc.count;
        const sz = acc.sigZ / acc.count;
        const txy = acc.tauXY / acc.count;
        const tyz = acc.tauYZ / acc.count;
        const txz = acc.tauXZ / acc.count;

        const vmSq = 0.5 * (
          (sx - sy) ** 2 +
          (sy - sz) ** 2 +
          (sz - sx) ** 2 +
          6.0 * (txy ** 2 + tyz ** 2 + txz ** 2)
        );
        vonMisesMap.set(node.id, Math.sqrt(Math.max(0, vmSq)));
      } else {
        // Fallback for isolated nodes without element connectivity
        const ux = displacements[i * 3] || 0;
        const uy = displacements[i * 3 + 1] || 0;
        const uz = displacements[i * 3 + 2] || 0;
        const uMag = Math.sqrt(ux * ux + uy * uy + uz * uz);
        // Strain estimation from nodal displacement scale: eps ~ uMag / L_ref
        const estStress = (uMag / 1.0) * E;
        vonMisesMap.set(node.id, estStress);
      }
    });

    return vonMisesMap;
  }
}
