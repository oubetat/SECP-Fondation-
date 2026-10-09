import { Matrix } from "../core/MathUtils";
import { ContactPair } from "./ContactPair";
import { ContactDetector } from "./ContactDetector";
import { ContactConstraint } from "./ContactConstraint";
import { FrictionModel, CoulombFrictionModel } from "./FrictionModel";
import { ContactElementEvaluation, ContactPointState, ContactStatus } from "./types";
import { ContactStateManager } from "./ContactStateManager";

export interface ContactForceAssemblyResult {
  contactForce: number[];           // Total DOFs x 1
  activeCount: number;
  stickCount: number;
  slipCount: number;
  penetrationMax: number;
  contactEnergyTotal: number;
  pointStates: ContactPointState[];
  status: ContactStatus;
}

export class ContactForceAssembler {
  /**
   * Assembles the global contact force vector F_contact for a set of contact pairs.
   */
  static assembleForce(
    pairs: ContactPair[],
    totalDOFs: number,
    nodeDOFMap: Map<string, number[]>,
    stateManager?: ContactStateManager
  ): ContactForceAssemblyResult {
    const F_contact = new Array(totalDOFs).fill(0.0);
    let activeCount = 0;
    let stickCount = 0;
    let slipCount = 0;
    let penetrationMax = 0.0;
    let contactEnergyTotal = 0.0;
    const allPointStates: ContactPointState[] = [];

    for (const pair of pairs) {
      const candidates = ContactDetector.broadPhaseSearch(pair);
      const { projections } = ContactDetector.narrowPhaseSearch(pair, candidates);

      const frictionModel: FrictionModel = pair.tangentialBehavior === 'FRICTIONAL_COULOMB'
        ? new CoulombFrictionModel(pair.parameters.frictionCoefficient || 0.0)
        : new CoulombFrictionModel(0.0);

      const slaveNodes = pair.slaveSurface.getNodes();

      for (const sNode of slaveNodes) {
        const proj = projections.get(sNode.id);

        if (!proj) {
          const openState: ContactPointState = {
            pointId: sNode.id,
            pairId: pair.pairId,
            gap: Infinity,
            normal: [0, 1],
            tangent: [1, 0],
            contactPressure: 0,
            tangentialTraction: [0, 0],
            penetration: 0,
            status: 'OPEN',
            stateMode: 'OPEN',
            lagrangeMultiplier: 0,
            contactWork: 0,
            iteration: 0,
            step: 0
          };
          allPointStates.push(openState);
          pair.setPointState(openState);
          if (stateManager) stateManager.setTrialState(sNode.id, openState);
          continue;
        }

        const constraint = ContactConstraint.evaluateNormalConstraint(
          proj.gap,
          pair.parameters,
          pair.enforcement
        );

        if (!constraint.isConstraintActive) {
          const openState: ContactPointState = {
            pointId: sNode.id,
            pairId: pair.pairId,
            gap: proj.gap,
            normal: proj.normal,
            tangent: [-proj.normal[1], proj.normal[0]],
            contactPressure: 0,
            tangentialTraction: [0, 0],
            penetration: 0,
            status: 'OPEN',
            stateMode: 'OPEN',
            lagrangeMultiplier: 0,
            contactWork: 0,
            iteration: 0,
            step: 0
          };
          allPointStates.push(openState);
          pair.setPointState(openState);
          if (stateManager) stateManager.setTrialState(sNode.id, openState);
          continue;
        }

        // Active contact point
        activeCount++;
        if (constraint.penetration > penetrationMax) {
          penetrationMax = constraint.penetration;
        }
        contactEnergyTotal += constraint.potentialEnergy;

        // Tangential traction calculation via Friction Model
        const prevTraction = pair.getPointState(sNode.id)?.tangentialTraction || [0, 0];
        const relativeSlip = [0, 0]; // 2D nodal relative slip increment
        const tangRes = frictionModel.computeTangentialTraction(
          constraint.normalPressure,
          relativeSlip,
          prevTraction
        );

        if (tangRes.stateMode === 'STICK') stickCount++;
        if (tangRes.stateMode === 'SLIP') slipCount++;

        const { status, mode } = ContactStateManager.determineStateMode(
          proj.gap,
          constraint.normalPressure,
          0.0,
          Math.hypot(tangRes.tangentialTraction[0], tangRes.tangentialTraction[1]),
          tangRes.frictionLimit
        );

        // Assemble into global force vector F_contact
        const slaveDOFs = nodeDOFMap.get(sNode.id);
        const masterFacet = pair.masterSurface.getFacets().find(f => f.facetId === proj.targetFacetId);

        if (slaveDOFs && masterFacet && masterFacet.nodeIds.length >= 2) {
          const m1DOFs = nodeDOFMap.get(masterFacet.nodeIds[0]);
          const m2DOFs = nodeDOFMap.get(masterFacet.nodeIds[1]);

          if (m1DOFs && m2DOFs) {
            const triadDOFs = [slaveDOFs[0], slaveDOFs[1], m1DOFs[0], m1DOFs[1], m2DOFs[0], m2DOFs[1]];
            const xi = proj.parametricCoords[0];
            const Nc = [1.0, -(1.0 - xi), -xi];

            const [nx, ny] = proj.normal;
            const tx = -ny, ty = nx; // tangent vector

            const fn = constraint.normalPressure;
            const ft = tangRes.tangentialTraction[0]; // scalar tangential traction in 2D

            // Total force vector at node = fn * n + ft * t
            const fx = fn * nx + ft * tx;
            const fy = fn * ny + ft * ty;

            for (let i = 0; i < 3; i++) {
              const gX = triadDOFs[2 * i];
              const gY = triadDOFs[2 * i + 1];

              F_contact[gX] += -Nc[i] * fx;
              F_contact[gY] += -Nc[i] * fy;
            }
          }
        }

        const pointState: ContactPointState = {
          pointId: sNode.id,
          pairId: pair.pairId,
          gap: proj.gap,
          normal: proj.normal,
          tangent: [-proj.normal[1], proj.normal[0]],
          contactPressure: constraint.normalPressure,
          tangentialTraction: tangRes.tangentialTraction,
          penetration: constraint.penetration,
          status,
          stateMode: mode,
          lagrangeMultiplier: constraint.normalPressure,
          contactWork: constraint.potentialEnergy,
          iteration: 0,
          step: 0
        };

        allPointStates.push(pointState);
        pair.setPointState(pointState);
        if (stateManager) stateManager.setTrialState(sNode.id, pointState);
      }
    }

    return {
      contactForce: F_contact,
      activeCount,
      stickCount,
      slipCount,
      penetrationMax,
      contactEnergyTotal,
      pointStates: allPointStates,
      status: activeCount > 0 ? 'ACTIVE' : 'OPEN'
    };
  }
}
