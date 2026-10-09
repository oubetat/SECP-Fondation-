
export class EngineeringClock {
  private static frozenTime: number | null = null;

  public static setFrozenTime(time: number): void {
    this.frozenTime = time;
  }

  public static clearFrozenTime(): void {
    this.frozenTime = null;
  }

  public static now(): number {
    return this.frozenTime !== null ? this.frozenTime : Date.now();
  }

  public static nowISO(): string {
    return new Date(this.now()).toISOString();
  }
}
