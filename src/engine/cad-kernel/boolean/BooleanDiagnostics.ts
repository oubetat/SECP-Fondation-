export class BooleanDiagnostics {
  public static report(data: any) {}
  public static invalidInput(entityId: string, message: string): any {
    return { code: 'INVALID', severity: 'ERROR', entityId, message };
  }

  public static coincidentSolids(idA: string, idB: string): any {
    return { 
      code: 'COINCIDENT', 
      severity: 'WARNING', 
      message: `Solids ${idA} and ${idB} are topologically coincident.` 
    };
  }

  public static volumeMismatch(expected: number, actual: number, diff: number): any {
    return {
      code: 'VOLUME_MISMATCH',
      severity: 'WARNING',
      message: `Volume mismatch: expected ${expected}, actual ${actual}, difference ${diff}`
    };
  }
}
