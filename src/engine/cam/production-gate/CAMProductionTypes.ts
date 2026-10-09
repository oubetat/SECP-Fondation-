export type CAMCapabilityStatus = 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'ABSENT';
export type CAMQualificationLevel = 'LEVEL_5_PRODUCTION_QUALIFIED' | 'LEVEL_4_PROVEN' | 'LEVEL_3_PARTIAL';
export type CAMProductionVerdict = 'CAM_PRODUCTION_READY' | 'CAM_PRODUCTION_NOT_READY' | 'CAM_PRODUCTION_READY_WITH_LIMITATIONS';
export interface CAMCapabilityItem { id: string; name: string; category: string; description: string; status: CAMCapabilityStatus; qualificationLevel: CAMQualificationLevel; evidenceRef: string; verifiedByGate: boolean; notes: string; }
export interface CAMCapabilityMatrix { timestamp: string; capabilities: CAMCapabilityItem[]; overallQualificationLevel: CAMQualificationLevel; provenCount: number; partialCount: number; unprovenCount: number; }
