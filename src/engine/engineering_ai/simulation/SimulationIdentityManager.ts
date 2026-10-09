import * as crypto from 'crypto';
import { SimulationContext, SimulationManifest } from './types';

export class SimulationIdentityManager {
  public static computeContextHash(ctx: Omit<SimulationContext, 'contextHash'>): string {
    const payload = [
      ctx.simulationId,
      ctx.simulationType,
      ctx.geometryHash,
      ctx.meshHash,
      ctx.materialHash,
      ctx.physicsModelHash,
      ctx.boundaryConditionHash,
      ctx.initialConditionHash,
      ctx.solverConfigurationHash,
      ctx.postProcessingHash,
      ctx.environmentHash
    ].join('|');

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public static computeManifestHash(manifest: SimulationManifest): string {
    const payload = JSON.stringify({
      geometry: manifest.geometry,
      mesh: manifest.mesh,
      materials: manifest.materials,
      physics: manifest.physics,
      boundaryConditions: manifest.boundaryConditions,
      solver: manifest.solver,
      numericalSettings: manifest.numericalSettings
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  public static isStale(currentHash: string, originalHash: string): boolean {
    return currentHash !== originalHash;
  }
}
