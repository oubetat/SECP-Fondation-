export class EvidenceLineageResolver {
  public static resolve(evidenceId: string, query: any): any {
    return {
      depth: 3,
      parentEvidence: 'mock'
    };
  }
}
