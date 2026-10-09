import { Matrix } from "../core/MathUtils";
import { ContactActiveSet } from "./ContactActiveSet";
import { ContactModel } from "./ContactModel";
import { ContactPair } from "./ContactPair";
import { ContactSearchEngine } from "./ContactSearchEngine";
import { ContactElementEvaluation, ContactPointState, ContactStatus } from "./types";

export interface GlobalContactAssemblyResult {
  contactForce: number[];           // Total DOFs x 1
  contactTangent: Matrix;           // Total DOFs x Total DOFs
  activeCount: number;
  penetrationMax: number;
  contactEnergyTotal: number;
  actionReactionResidual: number;   // |F_slave + F_master|
  pointStates: ContactPointState[];
  status: ContactStatus;
}

export class ContactIntegrator {
  /**
   * Evaluates contact pair and assembles global contact force vector and global contact tangent matrix.
   */
  static evaluateContactPair(
    pair: ContactPair,
    totalDOFs: number,
    nodeDOFMap: Map<string, number[]>, // nodeId -> [dof_x, dof_y, ...]
    activeSet?: ContactActiveSet
  ): GlobalContactAssemblyResult {
    const F_contact = new Array(totalDOFs).fill(0.0);
    const K_contact = Matrix.zeros(totalDOFs, totalDOFs);

    // 1. Broad phase
    const candidates = ContactSearchEngine.broadPhaseSearch(pair);

    // 2. Narrow phase
    const projections = ContactSearchEngine.narrowPhaseSearch(pair, candidates);

    const contactModel = new ContactModel(pair.parameters, pair.enforcement);

    let activeCount = 0;
    let penetrationMax = 0.0;
    let contactEnergyTotal = 0.0;

    let fSlaveX = 0.0, fSlaveY = 0.0;
    let fMasterX = 0.0, fMasterY = 0.0;

    const pointStates: ContactPointState[] = [];

    const slaveNodes = pair.slaveSurface.getNodes();

    for (const sNode of slaveNodes) {
      const proj = projections.get(sNode.id);
      
      if (!proj) {
        pointStates.push({
          pointId: sNode.id,
          pairId: pair.pairId,
          gap: Infinity,
          normal: [0, 1],
          tangent: [1, 0],
          contactPressure: 0,
          tangentialTraction: [0, 0],
          penetration: 0,
          status: 'OPEN', stateMode: 'OPEN',
          lagrangeMultiplier: 0,
          contactWork: 0,
          iteration: 0,
          step: 0
        });
        continue;
      }

      // Compute force and tangent for node-to-segment pair
      const elemEval = contactModel.computeNodeToSegmentForceAndTangent(proj);

      const status = elemEval.status;
      const isContacting = status === 'ACTIVE' || status === 'CONTACTING';

      if (isContacting) {
        activeCount++;
        if (elemEval.penetration > penetrationMax) {
          penetrationMax = elemEval.penetration;
        }

        const energy = 0.5 * pair.parameters.penaltyStiffness * elemEval.penetration * elemEval.penetration;
        contactEnergyTotal += energy;

        // Assembly into global vectors
        const slaveDOFs = nodeDOFMap.get(sNode.id);
        const masterFacet = pair.masterSurface.getFacets().find(f => f.facetId === proj.targetFacetId);

        if (slaveDOFs && masterFacet && masterFacet.nodeIds.length >= 2) {
          const m1NodeId = masterFacet.nodeIds[0];
          const m2NodeId = masterFacet.nodeIds[1];
          const m1DOFs = nodeDOFMap.get(m1NodeId);
          const m2DOFs = nodeDOFMap.get(m2NodeId);

          if (m1DOFs && m2DOFs) {
            const triadDOFs = [slaveDOFs[0], slaveDOFs[1], m1DOFs[0], m1DOFs[1], m2DOFs[0], m2DOFs[1]];

            // Force vector assembly
            for (let i = 0; i < 6; i++) {
              const gI = triadDOFs[i];
              F_contact[gI] += elemEval.contactForce[i];
            }

            // Tangent matrix assembly
            for (let i = 0; i < 6; i++) {
              const gI = triadDOFs[i];
              for (let j = 0; j < 6; j++) {
                const gJ = triadDOFs[j];
                K_contact.add(gI, gJ, elemEval.contactTangent.get(i, j));
              }
            }

            // Track reaction force components
            fSlaveX += elemEval.contactForce[0];
            fSlaveY += elemEval.contactForce[1];

            fMasterX += (elemEval.contactForce[2] + elemEval.contactForce[4]);
            fMasterY += (elemEval.contactForce[3] + elemEval.contactForce[5]);
          }
        }
      }

      const pState: ContactPointState = {
        pointId: sNode.id,
        pairId: pair.pairId,
        gap: proj.gap,
        normal: proj.normal,
        tangent: [-proj.normal[1], proj.normal[0]],
        contactPressure: elemEval.normalPressure,
        tangentialTraction: [0, 0],
        penetration: elemEval.penetration,
        status: isContacting ? 'ACTIVE' : 'OPEN',
        stateMode: elemEval.stateMode,
        lagrangeMultiplier: elemEval.normalPressure,
        contactWork: 0.5 * pair.parameters.penaltyStiffness * Math.max(0, -proj.gap) ** 2,
        iteration: 0,
        step: 0
      };

      pair.setPointState(pState);
      pointStates.push(pState);
    }

    if (activeSet) {
      activeSet.updateActiveSet(pointStates);
    }

    // Action-Reaction residual |F_slave + F_master|
    const arResX = fSlaveX + fMasterX;
    const arResY = fSlaveY + fMasterY;
    const actionReactionResidual = Math.hypot(arResX, arResY);

    return {
      contactForce: F_contact,
      contactTangent: K_contact,
      activeCount,
      penetrationMax,
      contactEnergyTotal,
      actionReactionResidual,
      pointStates,
      status: activeCount > 0 ? 'ACTIVE' : 'OPEN'
    };
  }
}
