import { ThermalMaterialProps } from "./types";

export class ThermalMaterial {
  constructor(public props: ThermalMaterialProps) {
    this.validate();
  }

  validate(): void {
    if (this.props.conductivity <= 0) throw new Error("Invalid conductivity");
    if (this.props.density <= 0) throw new Error("Invalid density");
    if (this.props.specificHeat <= 0) throw new Error("Invalid specific heat");
  }

  getDiffusivity(): number {
    return this.props.conductivity / (this.props.density * this.props.specificHeat);
  }

  static fromK(k: number, rho: number, cp: number): ThermalMaterial {
    return new ThermalMaterial({ conductivity: k, density: rho, specificHeat: cp });
  }
}
