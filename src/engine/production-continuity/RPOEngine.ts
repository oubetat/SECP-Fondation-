/**
 * PATCH-SECP-067: RPO Engine
 * Validates Recovery Point Objective (data loss) boundaries.
 */

export class RPOEngine {
  public static calculateRPO(lastBackup: string, incident: string): number {
    const b = new Date(lastBackup).getTime();
    const i = new Date(incident).getTime();
    return (i - b) / 1000;
  }
}
