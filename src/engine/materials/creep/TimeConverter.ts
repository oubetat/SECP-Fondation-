import { TimeUnit, TimeCoordinate } from "./types";

export class TimeConverter {
  private static readonly TO_SECONDS: Record<TimeUnit, number> = {
    [TimeUnit.SECOND]: 1,
    [TimeUnit.MINUTE]: 60,
    [TimeUnit.HOUR]: 3600,
    [TimeUnit.DAY]: 86400,
    [TimeUnit.YEAR]: 31536000 // 365 days
  };

  public static toSeconds(value: number, unit: TimeUnit): number {
    return value * this.TO_SECONDS[unit];
  }

  public static fromSeconds(seconds: number, unit: TimeUnit): number {
    return seconds / this.TO_SECONDS[unit];
  }

  public static createCoordinate(value: number, unit: TimeUnit): TimeCoordinate {
    if (value < 0) throw new Error("Negative time is physically invalid.");
    return {
      value,
      unit,
      normalizedSeconds: this.toSeconds(value, unit)
    };
  }
}
