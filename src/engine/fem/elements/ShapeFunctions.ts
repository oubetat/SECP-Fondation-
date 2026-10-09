export interface ShapeFunctionResult {
  N: number[];
  dN_dxi: number[];
  dN_deta?: number[];
  dN_dzeta?: number[];
}

export class ShapeFunctions {
  // BAR2 Natural node locations: [-1, 1]
  static bar2(xi: number): ShapeFunctionResult {
    return {
      N: [0.5 * (1 - xi), 0.5 * (1 + xi)],
      dN_dxi: [-0.5, 0.5]
    };
  }

  // TRI3 Natural node locations: (0,0), (1,0), (0,1)
  static tri3(xi: number, eta: number): ShapeFunctionResult {
    return {
      N: [1 - xi - eta, xi, eta],
      dN_dxi: [-1, 1, 0],
      dN_deta: [-1, 0, 1]
    };
  }

  // QUAD4 Natural node locations:
  // Node 1: (-1, -1)
  // Node 2: ( 1, -1)
  // Node 3: ( 1,  1)
  // Node 4: (-1,  1)
  static quad4(xi: number, eta: number): ShapeFunctionResult {
    const N1 = 0.25 * (1 - xi) * (1 - eta);
    const N2 = 0.25 * (1 + xi) * (1 - eta);
    const N3 = 0.25 * (1 + xi) * (1 + eta);
    const N4 = 0.25 * (1 - xi) * (1 + eta);

    const dN1_dxi = -0.25 * (1 - eta);
    const dN2_dxi =  0.25 * (1 - eta);
    const dN3_dxi =  0.25 * (1 + eta);
    const dN4_dxi = -0.25 * (1 + eta);

    const dN1_deta = -0.25 * (1 - xi);
    const dN2_deta = -0.25 * (1 + xi);
    const dN3_deta =  0.25 * (1 + xi);
    const dN4_deta =  0.25 * (1 - xi);

    return {
      N: [N1, N2, N3, N4],
      dN_dxi: [dN1_dxi, dN2_dxi, dN3_dxi, dN4_dxi],
      dN_deta: [dN1_deta, dN2_deta, dN3_deta, dN4_deta]
    };
  }

  // TET4 Natural node locations: (0,0,0), (1,0,0), (0,1,0), (0,0,1)
  static tet4(xi: number, eta: number, zeta: number): ShapeFunctionResult {
    return {
      N: [1 - xi - eta - zeta, xi, eta, zeta],
      dN_dxi: [-1, 1, 0, 0],
      dN_deta: [-1, 0, 1, 0],
      dN_dzeta: [-1, 0, 0, 1]
    };
  }

  // HEX8 Natural node locations:
  // Node 1: (-1, -1, -1)
  // Node 2: ( 1, -1, -1)
  // Node 3: ( 1,  1, -1)
  // Node 4: (-1,  1, -1)
  // Node 5: (-1, -1,  1)
  // Node 6: ( 1, -1,  1)
  // Node 7: ( 1,  1,  1)
  // Node 8: (-1,  1,  1)
  private static readonly hex8Corners = [
    [-1, -1, -1],
    [ 1, -1, -1],
    [ 1,  1, -1],
    [-1,  1, -1],
    [-1, -1,  1],
    [ 1, -1,  1],
    [ 1,  1,  1],
    [-1,  1,  1]
  ];

  static hex8(xi: number, eta: number, zeta: number): ShapeFunctionResult {
    const N: number[] = new Array(8);
    const dN_dxi: number[] = new Array(8);
    const dN_deta: number[] = new Array(8);
    const dN_dzeta: number[] = new Array(8);

    for (let i = 0; i < 8; i++) {
      const [xi_i, eta_i, zeta_i] = this.hex8Corners[i];
      N[i] = 0.125 * (1 + xi_i * xi) * (1 + eta_i * eta) * (1 + zeta_i * zeta);
      dN_dxi[i] = 0.125 * xi_i * (1 + eta_i * eta) * (1 + zeta_i * zeta);
      dN_deta[i] = 0.125 * (1 + xi_i * xi) * eta_i * (1 + zeta_i * zeta);
      dN_dzeta[i] = 0.125 * (1 + xi_i * xi) * (1 + eta_i * eta) * zeta_i;
    }

    return { N, dN_dxi, dN_deta, dN_dzeta };
  }

  // --- Analytical Validation Methods ---

  static testPartitionOfUnity(elementTypeId: string, samples = 5): boolean {
    const tolerance = 1e-12;
    for (let i = 0; i < samples; i++) {
      const xi = -0.8 + (1.6 * i) / (samples - 1 || 1);
      const eta = -0.7 + (1.4 * i) / (samples - 1 || 1);
      const zeta = -0.6 + (1.2 * i) / (samples - 1 || 1);

      let sum = 0;
      switch (elementTypeId) {
        case 'BAR2':
        case 'BEAM': {
          const res = this.bar2(xi);
          sum = res.N.reduce((a, b) => a + b, 0);
          break;
        }
        case 'TRI3': {
          // Inside unit triangle
          const txi = 0.2 + 0.1 * i;
          const teta = 0.2 + 0.1 * (samples - 1 - i);
          const res = this.tri3(txi, teta);
          sum = res.N.reduce((a, b) => a + b, 0);
          break;
        }
        case 'QUAD4':
        case 'SHELL': {
          const res = this.quad4(xi, eta);
          sum = res.N.reduce((a, b) => a + b, 0);
          break;
        }
        case 'TET4': {
          const txi = 0.1 + 0.05 * i;
          const teta = 0.1 + 0.05 * i;
          const tzeta = 0.1 + 0.05 * i;
          const res = this.tet4(txi, teta, tzeta);
          sum = res.N.reduce((a, b) => a + b, 0);
          break;
        }
        case 'HEX8':
        case 'SOLID': {
          const res = this.hex8(xi, eta, zeta);
          sum = res.N.reduce((a, b) => a + b, 0);
          break;
        }
        default:
          return false;
      }

      if (Math.abs(sum - 1.0) > tolerance) {
        return false;
      }
    }
    return true;
  }

  static testNodalProperty(elementTypeId: string): boolean {
    const tolerance = 1e-12;

    switch (elementTypeId) {
      case 'BAR2':
      case 'BEAM': {
        const nodes = [-1, 1];
        for (let i = 0; i < 2; i++) {
          const res = this.bar2(nodes[i]);
          for (let j = 0; j < 2; j++) {
            const expected = i === j ? 1.0 : 0.0;
            if (Math.abs(res.N[j] - expected) > tolerance) return false;
          }
        }
        return true;
      }
      case 'TRI3': {
        const nodes = [[0, 0], [1, 0], [0, 1]];
        for (let i = 0; i < 3; i++) {
          const res = this.tri3(nodes[i][0], nodes[i][1]);
          for (let j = 0; j < 3; j++) {
            const expected = i === j ? 1.0 : 0.0;
            if (Math.abs(res.N[j] - expected) > tolerance) return false;
          }
        }
        return true;
      }
      case 'QUAD4':
      case 'SHELL': {
        const nodes = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let i = 0; i < 4; i++) {
          const res = this.quad4(nodes[i][0], nodes[i][1]);
          for (let j = 0; j < 4; j++) {
            const expected = i === j ? 1.0 : 0.0;
            if (Math.abs(res.N[j] - expected) > tolerance) return false;
          }
        }
        return true;
      }
      case 'TET4': {
        const nodes = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
        for (let i = 0; i < 4; i++) {
          const res = this.tet4(nodes[i][0], nodes[i][1], nodes[i][2]);
          for (let j = 0; j < 4; j++) {
            const expected = i === j ? 1.0 : 0.0;
            if (Math.abs(res.N[j] - expected) > tolerance) return false;
          }
        }
        return true;
      }
      case 'HEX8':
      case 'SOLID': {
        for (let i = 0; i < 8; i++) {
          const [xi, eta, zeta] = this.hex8Corners[i];
          const res = this.hex8(xi, eta, zeta);
          for (let j = 0; j < 8; j++) {
            const expected = i === j ? 1.0 : 0.0;
            if (Math.abs(res.N[j] - expected) > tolerance) return false;
          }
        }
        return true;
      }
      default:
        return false;
    }
  }
}
