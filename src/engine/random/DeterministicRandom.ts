
export class DeterministicRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  public next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}
