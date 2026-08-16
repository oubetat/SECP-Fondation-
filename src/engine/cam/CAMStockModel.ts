/**
 * SECP-098 — CAM Stock Model
 * Represents raw stock, tracks volumetric removal, and provides forensic fingerprints.
 */

import { Vector3D } from '../cadKernel';
import { StockModel } from './ToolpathTypes';
import { generateDeterministicHash } from '../../lib/hash';

export class CAMStockModel {
  private model: StockModel;
  private totalRemovedVolumeMm3: number = 0;

  constructor(
    stockId: string,
    material: string,
    bounds: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number }
  ) {
    const dx = bounds.xMax - bounds.xMin;
    const dy = bounds.yMax - bounds.yMin;
    const dz = bounds.zMax - bounds.zMin;
    const initialVolume = dx * dy * dz;

    this.model = {
      stockId,
      material,
      bounds,
      initialVolumeMm3: initialVolume,
      fingerprint: ''
    };
  }

  public async initializeAsync(): Promise<void> {
    this.model.fingerprint = await generateDeterministicHash({
      stockId: this.model.stockId,
      material: this.model.material,
      bounds: this.model.bounds,
      initialVolume: this.model.initialVolumeMm3
    });
  }

  public getModel(): StockModel {
    return { ...this.model };
  }

  public getRemainingVolumeMm3(): number {
    return Math.max(0, this.model.initialVolumeMm3 - this.totalRemovedVolumeMm3);
  }

  public registerMaterialRemoval(volumeMm3: number): void {
    this.totalRemovedVolumeMm3 += volumeMm3;
  }

  public getFingerprint(): string {
    return this.model.fingerprint;
  }
}
