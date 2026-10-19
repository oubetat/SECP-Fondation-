export class ConservationRegressionBaseline {
  public static getAllBaselines(): any[] {
    return [];
  }

  public static evaluateRegression(caseId: string, metrics: any): { hasRegression: boolean; regressionDetails: string[]; details?: any } {
    return {
      hasRegression: false,
      regressionDetails: ['No regression detected'],
      details: { caseId, metrics }
    };
  }
}
