export class GPUMemoryManager {
  private totalVramMB: number;
  private usedVramMB: number;

  constructor(totalVramMB: number) {
    this.totalVramMB = totalVramMB;
    this.usedVramMB = 0;
  }

  public allocateVram(sizeMB: number): { success: boolean; allocatedMB: number; error?: string } {
    if (this.usedVramMB + sizeMB > this.totalVramMB) {
      return {
        success: false,
        allocatedMB: 0,
        error: 'OUT_OF_MEMORY: VRAM allocation request exceeds available memory capacity'
      };
    }

    this.usedVramMB += sizeMB;
    return { success: true, allocatedMB: sizeMB };
  }

  public freeVram(sizeMB: number): void {
    this.usedVramMB = Math.max(0, this.usedVramMB - sizeMB);
  }

  public getMemoryStats(): { totalMB: number; usedMB: number; freeMB: number } {
    return {
      totalMB: this.totalVramMB,
      usedMB: this.usedVramMB,
      freeMB: this.totalVramMB - this.usedVramMB
    };
  }
}
