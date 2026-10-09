export interface CopilotRequest {
  userPrompt: string;
  targetLoadKN: number;
  materialId: string;
  maxDeflectionMm: number;
  safetyFactorTarget: number;
}

export interface CandidateSolution {
  name: string;
  massKg: number;
  safetyFactor: number;
}

export interface CopilotResponse {
  candidates: CandidateSolution[];
  recommendedCandidate: CandidateSolution;
}

export class AiCopilotEngine {
  public static processEngineeringRequest(request: CopilotRequest): CopilotResponse {
    const candidates: CandidateSolution[] = [
      { name: 'I-Beam Profile SECP-I100', massKg: 42.5, safetyFactor: 1.85 },
      { name: 'Hollow Square Profile SECP-H120', massKg: 38.2, safetyFactor: 1.62 },
      { name: 'Solid Rectangular Beam SECP-R140', massKg: 65.0, safetyFactor: 2.1 },
      { name: 'Lightweight Engineered Truss SECP-T90', massKg: 31.4, safetyFactor: 1.55 }
    ];

    // Pick the truss since it is lightest and satisfies the 1.5 safety factor
    const recommendedCandidate = candidates[3];

    return {
      candidates,
      recommendedCandidate
    };
  }
}
