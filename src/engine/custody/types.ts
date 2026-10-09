export enum CustodyArtifactType { DESIGN = 'DESIGN', MANUFACTURE = 'MANUFACTURE', SIMULATION = 'SIMULATION', VERIFICATION = 'VERIFICATION' }
export enum CustodyActorType { HUMAN = 'HUMAN', SYSTEM = 'SYSTEM', AI_AGENT = 'AI_AGENT' }
export enum CustodyEventType { CREATED = 'CREATED', MODIFIED = 'MODIFIED', VERIFIED = 'VERIFIED', REVOKED = 'REVOKED' }
export enum CustodyStatus { VALID = 'VALID', INVALID = 'INVALID', REVOKED = 'REVOKED' }

export interface CustodyRecord {
  custodyId: string;
  events: {
    eventId?: string;
    previousCustodyHash: string;
    custodyHash: string;
  }[];
}
