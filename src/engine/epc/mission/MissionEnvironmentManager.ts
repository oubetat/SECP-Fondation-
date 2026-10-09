/**
 * SECP Engineering Core — Mission Environment Manager
 * Manages atmospheric conditions and gravity for the simulation.
 */

import { Vector3 } from '../../geometry/GeometryTypes';
import { MissionEnvironment } from './MissionSimulationTypes';

export class MissionEnvironmentManager {
  private config: MissionEnvironment;

  constructor(config?: Partial<MissionEnvironment>) {
    this.config = {
      airDensityKgM3: config?.airDensityKgM3 ?? 1.225, // ISA Standard at SL
      temperatureK: config?.temperatureK ?? 288.15,
      pressurePa: config?.pressurePa ?? 101325,
      gravityMS2: config?.gravityMS2 ?? 9.80665,
      windVectorMS: config?.windVectorMS ?? { x: 0, y: 0, z: 0 }
    };
  }

  public getEnvironmentAtAltitude(altitudeM: number): MissionEnvironment {
    // Basic Barometric Formula / ISA Model
    const L = 0.0065; // Temperature lapse rate (K/m)
    const T0 = 288.15;
    const P0 = 101325;
    const g = this.config.gravityMS2;
    const R = 287.05; // Gas constant for dry air

    const T = T0 - L * altitudeM;
    const P = P0 * Math.pow(1 - (L * altitudeM) / T0, (g / (R * L)));
    const rho = P / (R * T);

    return {
      ...this.config,
      temperatureK: T,
      pressurePa: P,
      airDensityKgM3: rho
    };
  }

  public getGravity(): number {
    return this.config.gravityMS2;
  }

  public getWind(): Vector3 {
    return this.config.windVectorMS;
  }
}
