/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Thermal Conductivity Provider Interface & Implementation
 */

export interface ThermalConductivityProvider {
  getThermalConductivityAtCell(cellIdx: number): number;
  getThermalConductivityAtFace(faceIdx: number): number;
}

export class ConstantThermalConductivityProvider implements ThermalConductivityProvider {
  constructor(private readonly k: number) {
    if (!Number.isFinite(k) || k < 0) {
      throw new Error(`Invalid thermal conductivity: ${k}`);
    }
  }

  public getThermalConductivityAtCell(_cellIdx: number): number {
    return this.k;
  }

  public getThermalConductivityAtFace(_faceIdx: number): number {
    return this.k;
  }
}
