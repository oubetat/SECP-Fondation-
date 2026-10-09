/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Discretizer
 */

import { CFDMesh3D, CFDFace3D } from '../mesh/CFDMeshTypes';
import {
  BoundaryConditionIdentity,
  BoundaryConditionType,
  DiscretizationContribution,
  Vector3D
} from './BoundaryConditionTypes';
import { BoundaryPatch } from './BoundaryPatch';

export class BoundaryConditionDiscretizer {
  public static discretizeBoundaryFace(
    face: CFDFace3D,
    patch: BoundaryPatch,
    condition: BoundaryConditionIdentity,
    density: number = 1.2,
    viscosity: number = 1.8e-5,
    thermalConductivity: number = 0.026
  ): DiscretizationContribution {
    let faceFlux = 0;
    let matrixDiagonalContribution = 0;
    let matrixOffDiagonalContribution = 0;
    let sourceContribution = 0;

    const area = face.area;
    const normal = face.normal;

    switch (condition.conditionType) {
      case BoundaryConditionType.FIXED_VELOCITY:
      case BoundaryConditionType.VELOCITY_INLET: {
        const vel = (condition.parameters.value as Vector3D) || [0, 0, 0];
        // Normal flux: phi = rho * (u . n) * area
        const uDotN = vel[0] * normal[0] + vel[1] * normal[1] + vel[2] * normal[2];
        faceFlux = density * uDotN * area;
        matrixDiagonalContribution = Math.abs(faceFlux);
        sourceContribution = -faceFlux;
        break;
      }

      case BoundaryConditionType.NO_SLIP_WALL: {
        // Wall velocity u_wall
        const wallVel = (condition.parameters.value as Vector3D) || [0, 0, 0];
        faceFlux = 0; // Mass flux through solid wall is 0
        const dist = 1.0; // Distance to cell center
        matrixDiagonalContribution = (viscosity * area) / dist;
        sourceContribution = matrixDiagonalContribution * (wallVel[0] * normal[0] + wallVel[1] * normal[1] + wallVel[2] * normal[2]);
        break;
      }

      case BoundaryConditionType.SLIP_WALL:
      case BoundaryConditionType.SYMMETRY: {
        faceFlux = 0;
        matrixDiagonalContribution = 0;
        sourceContribution = 0;
        break;
      }

      case BoundaryConditionType.FIXED_PRESSURE:
      case BoundaryConditionType.PRESSURE_OUTLET: {
        const pBound = typeof condition.parameters.value === 'number' ? condition.parameters.value : 0;
        faceFlux = 0;
        matrixDiagonalContribution = 0;
        sourceContribution = pBound * area; // Pressure force
        break;
      }

      case BoundaryConditionType.FIXED_TEMPERATURE: {
        const tBound = typeof condition.parameters.value === 'number' ? condition.parameters.value : 300;
        const dist = 1.0;
        matrixDiagonalContribution = (thermalConductivity * area) / dist;
        sourceContribution = matrixDiagonalContribution * tBound;
        break;
      }

      case BoundaryConditionType.FIXED_HEAT_FLUX: {
        const q = condition.parameters.heatFlux ?? 0;
        // Heat flux Q = q * A
        faceFlux = q * area;
        sourceContribution = faceFlux;
        break;
      }

      case BoundaryConditionType.ADIABATIC_WALL: {
        faceFlux = 0;
        matrixDiagonalContribution = 0;
        sourceContribution = 0;
        break;
      }

      default: {
        faceFlux = 0;
        matrixDiagonalContribution = 0;
        sourceContribution = 0;
        break;
      }
    }

    const provenanceHash = BoundaryConditionDiscretizer.computeHash(
      `${condition.boundaryConditionId}:${face.id}:${faceFlux}:${matrixDiagonalContribution}:${sourceContribution}`
    );

    return {
      boundaryConditionId: condition.boundaryConditionId,
      faceId: face.id,
      faceFlux,
      matrixDiagonalContribution,
      matrixOffDiagonalContribution,
      sourceContribution,
      provenanceHash
    };
  }

  private static computeHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `disc-hash-${Math.abs(hash).toString(16)}`;
  }
}
