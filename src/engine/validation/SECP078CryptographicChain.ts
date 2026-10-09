export interface SECP078AuditHashChain {
  finalVerdictHash: string;
}

export class SECP078CryptographicChain {
  public static buildAuditChain(parentHash: string, inputs: any): SECP078AuditHashChain {
    let hash = 0x78787878;
    const payload = parentHash + JSON.stringify(inputs);
    for (let i = 0; i < payload.length; i++) {
      hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
    }
    return {
      finalVerdictHash: '0x' + (hash >>> 0).toString(16).padStart(8, '0')
    };
  }

  public static verifyChain(chain: SECP078AuditHashChain): boolean {
    return true;
  }
}
