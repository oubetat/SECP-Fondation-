/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Momentum Equation Controller
 */

import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { FVMEquationCoefficients } from '../../fvm/FVMTypes';
import { FieldState, MaterialProperties } from './LaminarSolverTypes';
import { LaminarDiscretization } from './LaminarDiscretization';

export class MomentumEquation {
  public static assemble(
    mesh: CFDMesh3D,
    state: FieldState,
    material: MaterialProperties,
    systemCoeffs: { x: FVMEquationCoefficients[], y: FVMEquationCoefficients[], z: FVMEquationCoefficients[] }
  ): void {
    for (const face of mesh.faces) {
      // Convection and Diffusion
      LaminarDiscretization.assembleFaceFlux(face, material.density, material.viscosity, state.velocity, state.pressure, systemCoeffs.x, 0);
      LaminarDiscretization.assembleFaceFlux(face, material.density, material.viscosity, state.velocity, state.pressure, systemCoeffs.y, 1);
      LaminarDiscretization.assembleFaceFlux(face, material.density, material.viscosity, state.velocity, state.pressure, systemCoeffs.z, 2);

      // Pressure Gradient
      LaminarDiscretization.assemblePressureGradient(face, state.pressure, systemCoeffs.x, 0);
      LaminarDiscretization.assemblePressureGradient(face, state.pressure, systemCoeffs.y, 1);
      LaminarDiscretization.assemblePressureGradient(face, state.pressure, systemCoeffs.z, 2);
    }
  }
}
