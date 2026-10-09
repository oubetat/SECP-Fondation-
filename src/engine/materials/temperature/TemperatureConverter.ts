import { TemperatureUnit } from "./types";

export class TemperatureConverter {
  /**
   * Normalizes any temperature to Kelvin.
   */
  public static toKelvin(value: number, unit: TemperatureUnit): number {
    switch (unit) {
      case TemperatureUnit.KELVIN:
        return value;
      case TemperatureUnit.CELSIUS:
        return value + 273.15;
      case TemperatureUnit.FAHRENHEIT:
        return (value - 32) * 5 / 9 + 273.15;
      default:
        throw new Error(`Unsupported temperature unit: ${unit}`);
    }
  }

  /**
   * Converts Kelvin to any temperature unit.
   */
  public static fromKelvin(kelvin: number, unit: TemperatureUnit): number {
    switch (unit) {
      case TemperatureUnit.KELVIN:
        return kelvin;
      case TemperatureUnit.CELSIUS:
        return kelvin - 273.15;
      case TemperatureUnit.FAHRENHEIT:
        return (kelvin - 273.15) * 9 / 5 + 32;
      default:
        throw new Error(`Unsupported temperature unit: ${unit}`);
    }
  }
}
