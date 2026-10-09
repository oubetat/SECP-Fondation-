export class WASMMemoryManager {
  private initialMemoryMB: number;
  private maxMemoryMB: number;
  private currentMemoryMB: number;

  constructor(initialMB: number = 16, maxMB: number = 256) {
    this.initialMemoryMB = initialMB;
    this.maxMemoryMB = maxMB;
    this.currentMemoryMB = initialMB;
  }

  public allocateMemory(sizeMB: number): { success: boolean; allocatedMB: number; error?: string } {
    if (this.currentMemoryMB + sizeMB > this.maxMemoryMB) {
      return {
        success: false,
        allocatedMB: 0,
        error: 'WASM_MEMORY_LIMIT: WASM linear memory allocation exceeded maximum memory budget limit'
      };
    }

    this.currentMemoryMB += sizeMB;
    return { success: true, allocatedMB: sizeMB };
  }

  public freeMemory(sizeMB: number): void {
    this.currentMemoryMB = Math.max(this.initialMemoryMB, this.currentMemoryMB - sizeMB);
  }

  public getMemoryStats(): { initialMB: number; maxMB: number; currentMB: number; freeMB: number } {
    return {
      initialMB: this.initialMemoryMB,
      maxMB: this.maxMemoryMB,
      currentMB: this.currentMemoryMB,
      freeMB: this.maxMemoryMB - this.currentMemoryMB
    };
  }
}
