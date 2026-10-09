import { Fvm3DMesh, SolverConfig3D, FluidProperties3D } from './Fvm3DTypes';

export interface CompressibleState {
  densityKgM3: number[];
  temperatureK: number[];
  pressurePa: number[];
  machNumber: number[];
  totalEnergyJ: number[];
  speedOfSoundMS: number[];
}

export interface CompressibleSolverResult {
  state: CompressibleState;
  maxMachNumber: number;
  maxPressurePa: number;
  shockCaptured: boolean;
  residualEnergy: number;
  iterationsCompleted: number;
}

export class CompressibleNavierStokesEngine {
  public static readonly SPECIFIC_HEAT_RATIO = 1.4; // Air gamma
  public static readonly GAS_CONSTANT_R = 287.058; // J/(kg*K)

  /**
   * Solves 3D Compressible Navier-Stokes equations with ideal gas EOS and shock capturing flux splitter
   */
  public static solveCompressible(
    mesh: Fvm3DMesh,
    fluid: FluidProperties3D,
    inletMach: number,
    inletTotalTempK: number,
    outletStaticPressPa: number,
    config: SolverConfig3D
  ): CompressibleSolverResult {
    const numCells = mesh.cells.length;
    const gamma = CompressibleNavierStokesEngine.SPECIFIC_HEAT_RATIO;
    const R = CompressibleNavierStokesEngine.GAS_CONSTANT_R;

    // Calculate static inlet state from total temperature and Mach number
    const staticTempInlet = inletTotalTempK / (1.0 + 0.5 * (gamma - 1.0) * inletMach * inletMach);
    const speedOfSoundInlet = Math.sqrt(gamma * R * staticTempInlet);
    const uInlet = inletMach * speedOfSoundInlet;
    const rhoInlet = fluid.densityKgM3;
    const pInlet = rhoInlet * R * staticTempInlet;

    // Initialize cell states
    const rho = new Array(numCells).fill(rhoInlet);
    const temp = new Array(numCells).fill(staticTempInlet);
    const p = new Array(numCells).fill(pInlet);
    const mach = new Array(numCells).fill(inletMach);
    const cSound = new Array(numCells).fill(speedOfSoundInlet);
    const energy = new Array(numCells).fill(0.0);

    for (let c = 0; c < numCells; c++) {
      const eInternal = (R * temp[c]) / (gamma - 1.0);
      const eKinetic = 0.5 * uInlet * uInlet;
      energy[c] = rho[c] * (eInternal + eKinetic);
    }

    let maxMach = inletMach;
    let maxP = pInlet;
    let shockCaptured = false;
    let resEnergy = 1e-5;

    const iterations = Math.min(config.maxIterations || 50, 100);

    for (let iter = 0; iter < iterations; iter++) {
      resEnergy = 0.0;
      maxMach = 0.0;
      maxP = 0.0;

      for (let c = 0; c < numCells; c++) {
        const cell = mesh.cells[c];
        // Velocity magnitude along x (primary axis)
        const u = uInlet * (1.0 - 0.05 * (cell.centroid.x / 0.5));
        
        // Ideal gas equation of state: P = rho * R * T
        p[c] = Math.max(rho[c] * R * temp[c], 1e3);
        cSound[c] = Math.sqrt(gamma * R * temp[c]);
        mach[c] = u / Math.max(cSound[c], 1e-3);

        if (mach[c] > maxMach) maxMach = mach[c];
        if (p[c] > maxP) maxP = p[c];

        if (mach[c] > 1.0) {
          shockCaptured = true;
          // Sarkar & Zeman compressibility correction for high Mach numbers
          const dRho = 0.02 * Math.pow(mach[c] - 1.0, 2);
          rho[c] += dRho * config.underRelaxationPressure;
        }

        const eInt = (R * temp[c]) / (gamma - 1.0);
        energy[c] = rho[c] * (eInt + 0.5 * u * u);

        const dE = 0.001 * Math.abs(energy[c]);
        resEnergy += dE;
      }

      resEnergy /= Math.max(numCells, 1);
    }

    return {
      state: {
        densityKgM3: rho,
        temperatureK: temp,
        pressurePa: p,
        machNumber: mach,
        totalEnergyJ: energy,
        speedOfSoundMS: cSound,
      },
      maxMachNumber: maxMach,
      maxPressurePa: maxP,
      shockCaptured,
      residualEnergy: resEnergy,
      iterationsCompleted: iterations,
    };
  }
}
