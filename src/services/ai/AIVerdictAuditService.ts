import { AIHallucinationEvent } from '../../engine/engineering_ai/verdict/types';

export class AIVerdictAuditService {
  private static auditLogs: Array<{ timestamp: string; responseText: string; verdictState: string; event?: AIHallucinationEvent }> = [];

  public static logAttempt(responseText: string, verdictState: string, event?: AIHallucinationEvent) {
    this.auditLogs.push({
      timestamp: new Date().toISOString(),
      responseText,
      verdictState,
      event
    });
  }

  public static getLogs() {
    return this.auditLogs;
  }
}
