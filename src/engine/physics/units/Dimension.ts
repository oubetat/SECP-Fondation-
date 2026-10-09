/**
 * SECP Industrial OS v2 — Dimensional Model
 * PATCH-043: Units & Dimensions Engine
 */

export interface DimensionVector {
  length: number;      // L
  mass: number;        // M
  time: number;        // T
  temperature: number; // Theta
  current: number;     // I
  amount: number;      // N
  luminosity: number;  // J
}

export class Dimension {
  constructor(public readonly vector: Readonly<DimensionVector>) {}

  public static readonly SCALAR = new Dimension({ length: 0, mass: 0, time: 0, temperature: 0, current: 0, amount: 0, luminosity: 0 });
  public static readonly LENGTH = new Dimension({ length: 1, mass: 0, time: 0, temperature: 0, current: 0, amount: 0, luminosity: 0 });
  public static readonly MASS = new Dimension({ length: 0, mass: 1, time: 0, temperature: 0, current: 0, amount: 0, luminosity: 0 });
  public static readonly TIME = new Dimension({ length: 0, mass: 0, time: 1, temperature: 0, current: 0, amount: 0, luminosity: 0 });
  public static readonly TEMPERATURE = new Dimension({ length: 0, mass: 0, time: 0, temperature: 1, current: 0, amount: 0, luminosity: 0 });
  public static readonly CURRENT = new Dimension({ length: 0, mass: 0, time: 0, temperature: 0, current: 1, amount: 0, luminosity: 0 });
  public static readonly AMOUNT = new Dimension({ length: 0, mass: 0, time: 0, temperature: 0, current: 0, amount: 1, luminosity: 0 });
  public static readonly LUMINOSITY = new Dimension({ length: 0, mass: 0, time: 0, temperature: 0, current: 0, amount: 0, luminosity: 1 });

  // Derived Dimensions
  public static readonly AREA = Dimension.LENGTH.multiply(Dimension.LENGTH);
  public static readonly VOLUME = Dimension.AREA.multiply(Dimension.LENGTH);
  public static readonly VELOCITY = Dimension.LENGTH.divide(Dimension.TIME);
  public static readonly ACCELERATION = Dimension.VELOCITY.divide(Dimension.TIME);
  public static readonly FORCE = Dimension.MASS.multiply(Dimension.ACCELERATION);
  public static readonly PRESSURE = Dimension.FORCE.divide(Dimension.AREA);
  public static readonly ENERGY = Dimension.FORCE.multiply(Dimension.LENGTH);
  public static readonly POWER = Dimension.ENERGY.divide(Dimension.TIME);
  public static readonly DENSITY = Dimension.MASS.divide(Dimension.VOLUME);

  public multiply(other: Dimension): Dimension {
    return new Dimension({
      length: this.vector.length + other.vector.length,
      mass: this.vector.mass + other.vector.mass,
      time: this.vector.time + other.vector.time,
      temperature: this.vector.temperature + other.vector.temperature,
      current: this.vector.current + other.vector.current,
      amount: this.vector.amount + other.vector.amount,
      luminosity: this.vector.luminosity + other.vector.luminosity,
    });
  }

  public divide(other: Dimension): Dimension {
    return new Dimension({
      length: this.vector.length - other.vector.length,
      mass: this.vector.mass - other.vector.mass,
      time: this.vector.time - other.vector.time,
      temperature: this.vector.temperature - other.vector.temperature,
      current: this.vector.current - other.vector.current,
      amount: this.vector.amount - other.vector.amount,
      luminosity: this.vector.luminosity - other.vector.luminosity,
    });
  }

  public equals(other: Dimension): boolean {
    return (
      this.vector.length === other.vector.length &&
      this.vector.mass === other.vector.mass &&
      this.vector.time === other.vector.time &&
      this.vector.temperature === other.vector.temperature &&
      this.vector.current === other.vector.current &&
      this.vector.amount === other.vector.amount &&
      this.vector.luminosity === other.vector.luminosity
    );
  }

  public toString(): string {
    const parts: string[] = [];
    if (this.vector.length !== 0) parts.push(`L^${this.vector.length}`);
    if (this.vector.mass !== 0) parts.push(`M^${this.vector.mass}`);
    if (this.vector.time !== 0) parts.push(`T^${this.vector.time}`);
    if (this.vector.temperature !== 0) parts.push(`Theta^${this.vector.temperature}`);
    if (this.vector.current !== 0) parts.push(`I^${this.vector.current}`);
    if (this.vector.amount !== 0) parts.push(`N^${this.vector.amount}`);
    if (this.vector.luminosity !== 0) parts.push(`J^${this.vector.luminosity}`);
    return parts.length === 0 ? "1" : parts.join(' ');
  }
}
