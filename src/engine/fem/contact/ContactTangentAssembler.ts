import { Matrix } from "../core/MathUtils";
import { ContactPair } from "./ContactPair";
import { ContactDetector } from "./ContactDetector";
import { ContactConstraint } from "./ContactConstraint";
import { FrictionModel, CoulombFrictionModel } from "./FrictionModel";

export class ContactTangentAssembler {
  /**
   * Assembles global contact tangent stiffness matrix K_contact (totalDOFs x totalDOFs).
   */
  static assembleTangent(
    pairs: ContactPair[],
    totalDOFs: number,
    nodeDOFMap: Map<string, number[]>
  ): Matrix {
    const K_contact = Matrix.zeros(totalDOFs, totalDOFs);

    for (const pair of pairs) {
      const candidates = ContactDetector.broadPhaseSearch(pair);
      const { projections } = ContactDetector.narrowPhaseSearch(pair, candidates);

      const kp = pair.parameters.penaltyStiffness;
      const frictionModel: FrictionModel = pair.tangentialBehavior === 'FRICTIONAL_COULOMB'
        ? new CoulombFrictionModel(pair.parameters.frictionCoefficient || 0.0)
        : new CoulombFrictionModel(0.0);

      const slaveNodes = pair.slaveSurface.getNodes();

      for (const sNode of slaveNodes) {
        const proj = projections.get(sNode.id);
        if (!proj) continue;

        const constraint = ContactConstraint.evaluateNormalConstraint(
          proj.gap,
          pair.parameters,
          pair.enforcement
        );

        if (!constraint.isConstraintActive) continue;

        const slaveDOFs = nodeDOFMap.get(sNode.id);
        const masterFacet = pair.masterSurface.getFacets().find(f => f.facetId === proj.targetFacetId);

        if (!slaveDOFs || !masterFacet || masterFacet.nodeIds.length < 2) continue;

        const m1DOFs = nodeDOFMap.get(masterFacet.nodeIds[0]);
        const m2DOFs = nodeDOFMap.get(masterFacet.nodeIds[1]);

        if (!m1DOFs || !m2DOFs) continue;

        const triadDOFs = [slaveDOFs[0], slaveDOFs[1], m1DOFs[0], m1DOFs[1], m2DOFs[0], m2DOFs[1]];
        const xi = proj.parametricCoords[0];
        const Nc = [1.0, -(1.0 - xi), -xi];

        const [nx, ny] = proj.normal;
        const tx = -ny, ty = nx;

        const tangRes = frictionModel.computeTangentialTraction(
          constraint.normalPressure,
          [0, 0],
          [0, 0]
        );

        // Elemental tangent stiffness K_elem (6x6)
        // K_elem_ab = Nc_a * Nc_b * ( kp * (n (x) n) + k_tang * (t (x) t) )
        const kTangScalar = tangRes.tangentialTangent.get(0, 0) || 0.0;

        for (let a = 0; a < 3; a++) {
          for (let b = 0; b < 3; b++) {
            const shapeFactor = Nc[a] * Nc[b];

            // Normal component: kp * n * n^T
            const kNormal_xx = shapeFactor * kp * nx * nx;
            const kNormal_xy = shapeFactor * kp * nx * ny;
            const kNormal_yx = shapeFactor * kp * ny * nx;
            const kNormal_yy = shapeFactor * kp * ny * ny;

            // Tangential component: kTang * t * t^T
            const kTang_xx = shapeFactor * kTangScalar * tx * tx;
            const kTang_xy = shapeFactor * kTangScalar * tx * ty;
            const kTang_yx = shapeFactor * kTangScalar * ty * tx;
            const kTang_yy = shapeFactor * kTangScalar * ty * ty;

            const gAx = triadDOFs[2 * a];
            const gAy = triadDOFs[2 * a + 1];
            const gBx = triadDOFs[2 * b];
            const gBy = triadDOFs[2 * b + 1];

            K_contact.add(gAx, gBx, kNormal_xx + kTang_xx);
            K_contact.add(gAx, gBy, kNormal_xy + kTang_xy);
            K_contact.add(gAy, gBx, kNormal_yx + kTang_yx);
            K_contact.add(gAy, gBy, kNormal_yy + kTang_yy);
          }
        }
      }
    }

    return K_contact;
  }
}
