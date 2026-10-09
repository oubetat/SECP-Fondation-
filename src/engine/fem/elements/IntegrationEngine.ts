import { IntegrationPoint, IntegrationRule } from "./types";

export class IntegrationEngine {
  private static rules: Map<string, IntegrationRule> = new Map();

  static initializeRules() {
    if (this.rules.size > 0) return;

    // --- 1D Gauss Rules on [-1, 1] ---
    const gauss1D_1pt: IntegrationRule = {
      ruleId: 'GAUSS_1D_1PT',
      dimension: 1,
      order: 1,
      points: [{ xi: 0, weight: 2 }],
      totalWeight: 2,
      formulationCompatibility: ['BAR2']
    };

    const invSqrt3 = 1 / Math.sqrt(3);
    const gauss1D_2pt: IntegrationRule = {
      ruleId: 'GAUSS_1D_2PT',
      dimension: 1,
      order: 2,
      points: [
        { xi: -invSqrt3, weight: 1 },
        { xi: invSqrt3, weight: 1 }
      ],
      totalWeight: 2,
      formulationCompatibility: ['BAR2', 'BEAM2']
    };

    // --- 2D Triangle Rules on unit triangle [0, 1] x [0, 1-x] (Area = 0.5) ---
    const tri2D_1pt: IntegrationRule = {
      ruleId: 'TRI_2D_1PT',
      dimension: 2,
      order: 1,
      points: [{ xi: 1 / 3, eta: 1 / 3, weight: 0.5 }],
      totalWeight: 0.5,
      formulationCompatibility: ['TRI3']
    };

    const tri2D_3pt: IntegrationRule = {
      ruleId: 'TRI_2D_3PT',
      dimension: 2,
      order: 2,
      points: [
        { xi: 0.5, eta: 0.0, weight: 1 / 6 },
        { xi: 0.5, eta: 0.5, weight: 1 / 6 },
        { xi: 0.0, eta: 0.5, weight: 1 / 6 }
      ],
      totalWeight: 0.5,
      formulationCompatibility: ['TRI3', 'TRI6']
    };

    // --- 2D Quad Gauss Rules on [-1, 1]^2 (Area = 4) ---
    const quad2D_1pt: IntegrationRule = {
      ruleId: 'GAUSS_QUAD_1PT',
      dimension: 2,
      order: 1,
      points: [{ xi: 0, eta: 0, weight: 4 }],
      totalWeight: 4,
      formulationCompatibility: ['QUAD4']
    };

    const quad2D_2x2: IntegrationRule = {
      ruleId: 'GAUSS_QUAD_2X2',
      dimension: 2,
      order: 2,
      points: [
        { xi: -invSqrt3, eta: -invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta: -invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta:  invSqrt3, weight: 1.0 },
        { xi: -invSqrt3, eta:  invSqrt3, weight: 1.0 }
      ],
      totalWeight: 4.0,
      formulationCompatibility: ['QUAD4', 'QUAD8']
    };

    // --- 3D Tetrahedral Rules on unit tet (Volume = 1/6) ---
    const tet3D_1pt: IntegrationRule = {
      ruleId: 'TET_3D_1PT',
      dimension: 3,
      order: 1,
      points: [{ xi: 0.25, eta: 0.25, zeta: 0.25, weight: 1 / 6 }],
      totalWeight: 1 / 6,
      formulationCompatibility: ['TET4']
    };

    const tet3D_4pt: IntegrationRule = {
      ruleId: 'TET_3D_4PT',
      dimension: 3,
      order: 2,
      points: [
        { xi: 0.58541020, eta: 0.13819660, zeta: 0.13819660, weight: (1 / 6) * 0.25 },
        { xi: 0.13819660, eta: 0.58541020, zeta: 0.13819660, weight: (1 / 6) * 0.25 },
        { xi: 0.13819660, eta: 0.13819660, zeta: 0.58541020, weight: (1 / 6) * 0.25 },
        { xi: 0.13819660, eta: 0.13819660, zeta: 0.13819660, weight: (1 / 6) * 0.25 }
      ],
      totalWeight: 1 / 6,
      formulationCompatibility: ['TET4', 'TET10']
    };

    // --- 3D Hexahedral Gauss Rules on [-1, 1]^3 (Volume = 8) ---
    const hex3D_1pt: IntegrationRule = {
      ruleId: 'GAUSS_HEX_1PT',
      dimension: 3,
      order: 1,
      points: [{ xi: 0, eta: 0, zeta: 0, weight: 8 }],
      totalWeight: 8,
      formulationCompatibility: ['HEX8']
    };

    const hex3D_2x2x2: IntegrationRule = {
      ruleId: 'GAUSS_HEX_2X2X2',
      dimension: 3,
      order: 2,
      points: [
        { xi: -invSqrt3, eta: -invSqrt3, zeta: -invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta: -invSqrt3, zeta: -invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta:  invSqrt3, zeta: -invSqrt3, weight: 1.0 },
        { xi: -invSqrt3, eta:  invSqrt3, zeta: -invSqrt3, weight: 1.0 },
        { xi: -invSqrt3, eta: -invSqrt3, zeta:  invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta: -invSqrt3, zeta:  invSqrt3, weight: 1.0 },
        { xi:  invSqrt3, eta:  invSqrt3, zeta:  invSqrt3, weight: 1.0 },
        { xi: -invSqrt3, eta:  invSqrt3, zeta:  invSqrt3, weight: 1.0 }
      ],
      totalWeight: 8.0,
      formulationCompatibility: ['HEX8', 'HEX20']
    };

    this.rules.set(gauss1D_1pt.ruleId, gauss1D_1pt);
    this.rules.set(gauss1D_2pt.ruleId, gauss1D_2pt);
    this.rules.set(tri2D_1pt.ruleId, tri2D_1pt);
    this.rules.set(tri2D_3pt.ruleId, tri2D_3pt);
    this.rules.set(quad2D_1pt.ruleId, quad2D_1pt);
    this.rules.set(quad2D_2x2.ruleId, quad2D_2x2);
    this.rules.set(tet3D_1pt.ruleId, tet3D_1pt);
    this.rules.set(tet3D_4pt.ruleId, tet3D_4pt);
    this.rules.set(hex3D_1pt.ruleId, hex3D_1pt);
    this.rules.set(hex3D_2x2x2.ruleId, hex3D_2x2x2);
  }

  static getRule(ruleId: string): IntegrationRule {
    this.initializeRules();
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Integration rule not found: ${ruleId}`);
    }
    return rule;
  }

  static listRules(): IntegrationRule[] {
    this.initializeRules();
    return Array.from(this.rules.values());
  }

  /**
   * Numerically integrate a 1D function on [-1, 1]
   */
  static integrate1D(func: (xi: number) => number, ruleId = 'GAUSS_1D_2PT'): number {
    const rule = this.getRule(ruleId);
    let sum = 0;
    for (const pt of rule.points) {
      sum += func(pt.xi) * pt.weight;
    }
    return sum;
  }

  /**
   * Numerically integrate a 2D function on [-1, 1]^2 or Triangle
   */
  static integrate2D(func: (xi: number, eta: number) => number, ruleId = 'GAUSS_QUAD_2X2'): number {
    const rule = this.getRule(ruleId);
    let sum = 0;
    for (const pt of rule.points) {
      sum += func(pt.xi, pt.eta ?? 0) * pt.weight;
    }
    return sum;
  }

  /**
   * Numerically integrate a 3D function on [-1, 1]^3 or Tet
   */
  static integrate3D(func: (xi: number, eta: number, zeta: number) => number, ruleId = 'GAUSS_HEX_2X2X2'): number {
    const rule = this.getRule(ruleId);
    let sum = 0;
    for (const pt of rule.points) {
      sum += func(pt.xi, pt.eta ?? 0, pt.zeta ?? 0) * pt.weight;
    }
    return sum;
  }
}
