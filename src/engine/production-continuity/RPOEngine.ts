export class RPOEngine {
  public static calculateRPO(backupTimestamp: string, triggerDetectedAt: string): number {
    const backupTime = new Date(backupTimestamp).getTime();
    const triggerTime = new Date(triggerDetectedAt).getTime();
    
    // Return the difference in seconds
    const diffMs = Math.abs(triggerTime - backupTime);
    return Math.floor(diffMs / 1000);
  }
}
