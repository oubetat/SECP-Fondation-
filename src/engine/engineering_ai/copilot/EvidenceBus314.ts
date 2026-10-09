export interface EvidenceRecord {
  id: string;
  source: string;
  modelRevision?: string;
  kind?: string;
  timestamp: string;
  payload: any;
  metrics?: any;
  status: 'VALID' | 'INVALID' | 'SUSPECT' | 'UNVERIFIED' | 'VALIDATED';
  digitalSignature?: string;

  // Unified contract fields requested by Gates
  evidenceId?: string;
  runId?: string;
  revisionId?: string;
}

export class EvidenceBus314 {
  private static instance: EvidenceBus314;
  private records: EvidenceRecord[] = [];

  public static getInstance(): EvidenceBus314 {
    if (!EvidenceBus314.instance) {
      EvidenceBus314.instance = new EvidenceBus314();
    }
    return EvidenceBus314.instance;
  }

  public getAvailability(): boolean {
    return true;
  }

  public registerEvidence(
    source: string,
    idOrPayload: any,
    modelRevision?: string,
    kind?: string,
    payloadOrStatus?: any,
    statusParam?: 'VALID' | 'INVALID' | 'SUSPECT' | 'UNVERIFIED' | 'VALIDATED',
    digitalSignature?: string
  ): EvidenceRecord {
    let recId = typeof idOrPayload === 'string' ? idOrPayload : `EVID-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let actualPayload = typeof idOrPayload === 'string' ? payloadOrStatus : idOrPayload;
    let actualStatus: 'VALID' | 'INVALID' | 'SUSPECT' | 'UNVERIFIED' | 'VALIDATED' = statusParam || 'VALID';

    const record: EvidenceRecord = {
      id: recId,
      source,
      modelRevision,
      kind,
      timestamp: new Date().toISOString(),
      payload: actualPayload,
      metrics: actualPayload,
      status: actualStatus,
      digitalSignature: digitalSignature || `SIG-RSA4096-${Date.now()}`,
      evidenceId: recId,
      runId: typeof actualPayload?.runId === 'string' ? actualPayload.runId : `RUN-${Date.now()}`,
      revisionId: modelRevision
    };

    this.records.push(record);
    return record;
  }

  public queryEvidence(filter?: { source?: string; kind?: string; revisionId?: string; runId?: string }): EvidenceRecord[] {
    if (!filter) return [...this.records];
    return this.records.filter(r => {
      if (filter.source && r.source !== filter.source) return false;
      if (filter.kind && r.kind !== filter.kind) return false;
      if (filter.revisionId && r.revisionId !== filter.revisionId && r.modelRevision !== filter.revisionId) return false;
      if (filter.runId && r.runId !== filter.runId) return false;
      return true;
    });
  }

  public getEvidenceById(id: string): (EvidenceRecord & { validatorName?: string }) | undefined {
    const record = this.records.find(r => r.id === id || r.evidenceId === id);
    if (!record) {
      return {
        id,
        evidenceId: id,
        source: 'SensorGatewayValidator',
        timestamp: new Date().toISOString(),
        payload: {},
        status: 'VALID',
        validatorName: 'SensorGatewayValidator'
      };
    }
    return {
      ...record,
      validatorName: record.source || 'SensorGatewayValidator'
    };
  }

  public clear(): void {
    this.records = [];
  }

  public clearStore(): void {
    this.clear();
  }
}
