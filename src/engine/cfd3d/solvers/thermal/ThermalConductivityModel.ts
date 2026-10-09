/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Thermal Conductivity & Specific Heat Models
 */

export class ThermalConductivityModel {
  constructor(
    public readonly referenceConductivity: number = 0.0262,
    public readonly temperatureCoefficient: number = 0.0,
    public readonly referenceTemperatureK: number = 293.15
  ) {}

  public evaluate(temperatureK: number): number {
    if (Number.isNaN(temperatureK) || !Number.isFinite(temperatureK)) {
      throw new Error(`INVALID_THERMAL_INPUT: Temperature must be a finite number. Received: ${temperatureK}`);
    }
    if (temperatureK <= 0.0) {
      throw new Error(`NEGATIVE_TEMPERATURE: Temperature ${temperatureK} K is below absolute zero (must be > 0 K)`);
    }
    if (Number.isNaN(this.referenceConductivity) || !Number.isFinite(this.referenceConductivity) || this.referenceConductivity <= 0.0) {
      throw new Error(`INVALID_THERMAL_PROPERTY: Reference thermal conductivity must be strictly positive. Received: ${this.referenceConductivity}`);
    }

    const deltaT = temperatureK - this.referenceTemperatureK;
    const k = this.referenceConductivity * (1.0 + this.temperatureCoefficient * deltaT);

    if (Number.isNaN(k) || !Number.isFinite(k) || k <= 0.0) {
      throw new Error(`INVALID_THERMAL_PROPERTY: Evaluated thermal conductivity at ${temperatureK} K is non-positive: ${k}`);
    }

    return k;
  }

  public evaluateArray(temperatures: number[]): number[] {
    return temperatures.map(T => this.evaluate(T));
  }
}

export class SpecificHeatModel {
  constructor(
    public readonly referenceSpecificHeat: number = 1005.0,
    public readonly temperatureCoefficient: number = 0.0,
    public readonly referenceTemperatureK: number = 293.15
  ) {}

  public evaluate(temperatureK: number): number {
    if (Number.isNaN(temperatureK) || !Number.isFinite(temperatureK)) {
      throw new Error(`INVALID_THERMAL_INPUT: Temperature must be a finite number. Received: ${temperatureK}`);
    }
    if (temperatureK <= 0.0) {
      throw new Error(`NEGATIVE_TEMPERATURE: Temperature ${temperatureK} K is below absolute zero (must be > 0 K)`);
    }
    if (Number.isNaN(this.referenceSpecificHeat) || !Number.isFinite(this.referenceSpecificHeat) || this.referenceSpecificHeat <= 0.0) {
      throw new Error(`INVALID_THERMAL_PROPERTY: Reference specific heat must be strictly positive. Received: ${this.referenceSpecificHeat}`);
    }

    const deltaT = temperatureK - this.referenceTemperatureK;
    const cp = this.referenceSpecificHeat * (1.0 + this.temperatureCoefficient * deltaT);

    if (Number.isNaN(cp) || !Number.isFinite(cp) || cp <= 0.0) {
      throw new Error(`INVALID_THERMAL_PROPERTY: Evaluated specific heat at ${temperatureK} K is non-positive: ${cp}`);
    }

    return cp;
  }

  public evaluateArray(temperatures: number[]): number[] {
    return temperatures.map(T => this.evaluate(T));
  }
}
