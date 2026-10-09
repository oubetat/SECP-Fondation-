import { GoverningEquation, PhysicsDomain } from './types';

export class GoverningEquationRegistry {
  private static equations: Map<string, GoverningEquation> = new Map();

  static {
    // Populate standard equations
    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-NEWTON-2ND',
      equationName: "Newton's Second Law of Motion",
      domain: 'MECHANICS',
      form: 'F = m * a',
      variables: ['F', 'm', 'a'],
      units: { F: 'N', m: 'kg', a: 'm/s^2' },
      assumptions: ['constant-mass', 'non-relativistic'],
      validityDomain: 'Classical Mechanics',
      reference: 'Principia Mathematica',
      version: '1.0'
    });

    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-CONTINUITY-INCOMPRESSIBLE',
      equationName: 'Incompressible Continuity Equation',
      domain: 'FLUID',
      form: '\\nabla \\cdot u = 0',
      variables: ['u'],
      units: { u: 'm/s' },
      assumptions: ['incompressible', 'single-phase'],
      validityDomain: 'Subsonic Fluid Dynamics (Mach < 0.3)',
      reference: 'Fluid Mechanics - White',
      version: '1.0'
    });

    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-NAVIER-STOKES-INCOMPRESSIBLE',
      equationName: 'Incompressible Navier-Stokes Equations',
      domain: 'FLUID',
      form: '\\rho (\\frac{\\partial u}{\\partial t} + u \\cdot \\nabla u) = -\\nabla p + \\mu \\nabla^2 u + f',
      variables: ['u', 'p', 'rho', 'mu', 'f'],
      units: { u: 'm/s', p: 'Pa', rho: 'kg/m^3', mu: 'Pa*s', f: 'N/m^3' },
      assumptions: ['incompressible', 'Newtonian', 'constant-viscosity'],
      validityDomain: 'Newtonian Fluid Dynamics (Mach < 0.3)',
      reference: 'Incompressible Flow - Panton',
      version: '1.0'
    });

    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-FOURIER-HEAT-CONDUCTION',
      equationName: "Fourier's Law of Heat Conduction",
      domain: 'HEAT_TRANSFER',
      form: 'q = -k * \\nabla T',
      variables: ['q', 'k', 'T'],
      units: { q: 'W/m^2', k: 'W/(m*K)', T: 'K' },
      assumptions: ['isotropic', 'steady-or-transient', 'continuum'],
      validityDomain: 'Thermal Conduction in Solids/Fluids',
      reference: 'Heat Transfer - Incropera',
      version: '1.0'
    });

    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-HOOKES-LAW-1D',
      equationName: "Hooke's Law (1D Elasticity)",
      domain: 'STRUCTURAL',
      form: '\\sigma = E * \\epsilon',
      variables: ['sigma', 'E', 'epsilon'],
      units: { sigma: 'Pa', E: 'Pa', epsilon: 'dimensionless' },
      assumptions: ['linear-elastic', 'small-deformation', 'isotropic'],
      validityDomain: 'Small Strain Elastic Deformation',
      reference: 'Theory of Elasticity - Timoshenko',
      version: '1.0'
    });

    GoverningEquationRegistry.registerEquation({
      equationId: 'EQ-POISEUILLE-FLOW-PIPE',
      equationName: 'Hagen-Poiseuille Pipe Flow Rate',
      domain: 'FLUID',
      form: 'Q = (\\pi * \\Delta P * R^4) / (8 * \\mu * L)',
      variables: ['Q', 'deltaP', 'R', 'mu', 'L'],
      units: { Q: 'm^3/s', deltaP: 'Pa', R: 'm', mu: 'Pa*s', L: 'm' },
      assumptions: ['laminar', 'incompressible', 'fully-developed', 'steady', 'Newtonian', 'circular-pipe'],
      validityDomain: 'Laminar Pipe Flow (Re < 2300)',
      reference: 'Viscous Fluid Flow - White',
      version: '1.0'
    });
  }

  public static registerEquation(eq: GoverningEquation): void {
    this.equations.set(eq.equationId, eq);
  }

  public static getEquation(equationId: string): GoverningEquation | undefined {
    return this.equations.get(equationId);
  }

  public static getEquationsByDomain(domain: PhysicsDomain): GoverningEquation[] {
    return Array.from(this.equations.values()).filter((e) => e.domain === domain);
  }

  public static hasEquation(equationId: string): boolean {
    return this.equations.has(equationId);
  }

  public static validateAssumptions(equationId: string, activeAssumptions: string[]): {
    valid: boolean;
    missingAssumptions: string[];
    violatedAssumptions: string[];
  } {
    const eq = this.equations.get(equationId);
    if (!eq) {
      return { valid: false, missingAssumptions: [], violatedAssumptions: ['EQUATION_NOT_FOUND'] };
    }

    const missing: string[] = [];
    const activeSet = new Set(activeAssumptions);

    for (const reqAssumption of eq.assumptions) {
      if (!activeSet.has(reqAssumption)) {
        missing.push(reqAssumption);
      }
    }

    return {
      valid: missing.length === 0,
      missingAssumptions: missing,
      violatedAssumptions: []
    };
  }
}
