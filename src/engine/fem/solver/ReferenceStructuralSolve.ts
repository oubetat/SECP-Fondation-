export interface ReferenceBenchmarkSolution {
  modelType: 'BAR1D' | 'TRUSS2D' | 'QUAD4_PATCH' | 'HEX8_BLOCK';
  expectedDisplacements: { nodeId: string; dof: string; value: number }[];
  expectedReactions: { nodeId: string; dof: string; value: number }[];
  expectedCenterStresses: { elementId: string; stress: number[]; vonMises: number }[];
  expectedStrainEnergy: number;
}

export class ReferenceStructuralSolve {
  /**
   * Reference solution for 1D Bar fixed at x=0, loaded at x=L with load P
   */
  static solveBar1D(L: number, A: number, E: number, P: number, numElements: number = 2): ReferenceBenchmarkSolution {
    const elemLength = L / numElements;
    const expectedDisplacements: { nodeId: string; dof: string; value: number }[] = [];
    const expectedReactions: { nodeId: string; dof: string; value: number }[] = [];
    const expectedCenterStresses: { elementId: string; stress: number[]; vonMises: number }[] = [];

    // Node 0 fixed
    expectedDisplacements.push({ nodeId: 'N0', dof: 'UX', value: 0 });
    expectedReactions.push({ nodeId: 'N0', dof: 'UX', value: -P });

    for (let i = 1; i <= numElements; i++) {
      const x = i * elemLength;
      const u_x = (P * x) / (E * A);
      expectedDisplacements.push({ nodeId: `N${i}`, dof: 'UX', value: u_x });
    }

    const sigma = P / A;
    for (let e = 0; e < numElements; e++) {
      expectedCenterStresses.push({
        elementId: `E${e}`,
        stress: [sigma],
        vonMises: Math.abs(sigma)
      });
    }

    const expectedStrainEnergy = (P * P * L) / (2 * E * A);

    return {
      modelType: 'BAR1D',
      expectedDisplacements,
      expectedReactions,
      expectedCenterStresses,
      expectedStrainEnergy
    };
  }

  /**
   * Reference solution for 2D QUAD4 constant strain patch [0, L] x [0, H] under uniform tension sigma_0
   */
  static solveQuad4Patch(
    L: number,
    H: number,
    t: number,
    E: number,
    nu: number,
    sigma0: number
  ): ReferenceBenchmarkSolution {
    const expectedDisplacements: { nodeId: string; dof: string; value: number }[] = [];
    const expectedReactions: { nodeId: string; dof: string; value: number }[] = [];

    const u_L = (sigma0 * L) / E;
    const v_H = (-nu * sigma0 * H) / E;

    // N0 (0,0), N1 (L,0), N2 (L,H), N3 (0,H)
    expectedDisplacements.push({ nodeId: 'N0', dof: 'UX', value: 0 });
    expectedDisplacements.push({ nodeId: 'N0', dof: 'UY', value: 0 });

    expectedDisplacements.push({ nodeId: 'N1', dof: 'UX', value: u_L });
    expectedDisplacements.push({ nodeId: 'N1', dof: 'UY', value: 0 });

    expectedDisplacements.push({ nodeId: 'N2', dof: 'UX', value: u_L });
    expectedDisplacements.push({ nodeId: 'N2', dof: 'UY', value: v_H });

    expectedDisplacements.push({ nodeId: 'N3', dof: 'UX', value: 0 });
    expectedDisplacements.push({ nodeId: 'N3', dof: 'UY', value: v_H });

    // Total force P_x = sigma0 * H * t
    const Px = sigma0 * H * t;
    expectedReactions.push({ nodeId: 'N0', dof: 'UX', value: -Px / 2 });
    expectedReactions.push({ nodeId: 'N3', dof: 'UX', value: -Px / 2 });

    const eps_x = sigma0 / E;
    const eps_y = (-nu * sigma0) / E;
    const expectedStrainEnergy = 0.5 * (sigma0 * eps_x) * (L * H * t);

    return {
      modelType: 'QUAD4_PATCH',
      expectedDisplacements,
      expectedReactions,
      expectedCenterStresses: [
        {
          elementId: 'E0',
          stress: [sigma0, 0, 0],
          vonMises: Math.abs(sigma0)
        }
      ],
      expectedStrainEnergy
    };
  }
}
