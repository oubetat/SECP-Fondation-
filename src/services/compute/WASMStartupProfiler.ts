export class WASMStartupProfiler {
  private startTime: number = 0;
  private compilationTime: number = 0;
  private instantiationTime: number = 0;

  public startProfiling(): void {
    this.startTime = Date.now();
  }

  public recordCompilation(timeMs: number): void {
    this.compilationTime = timeMs;
  }

  public recordInstantiation(timeMs: number): void {
    this.instantiationTime = timeMs;
  }

  public getMetrics(isWarmStart: boolean): { coldStartMs: number; warmStartMs: number; compilationTimeMs: number; instantiationTimeMs: number } {
    const total = Date.now() - this.startTime;
    return {
      coldStartMs: isWarmStart ? 0 : total,
      warmStartMs: isWarmStart ? total : 0,
      compilationTimeMs: this.compilationTime,
      instantiationTimeMs: this.instantiationTime
    };
  }
}
