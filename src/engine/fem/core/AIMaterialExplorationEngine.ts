import { GoogleGenAI, Type } from "@google/genai";
import { FEMModel } from "./FEMTypes";
import { 
  EngineeringOptimizationEngine, 
  OptimizationProblem, 
  OptimizationCandidate,
  FeasibilityStatus
} from "./EngineeringOptimizationEngine";
import { MaterialTruthThreadEngine, MaterialTruthThread } from "./MaterialTruthThreadEngine";
import { FEMEvidenceEngine } from "./FEMEvidenceEngine";

export interface ExplorationRequest {
  requestId: string;
  engineeringIntent: string;
  targetProperties: string[];
  designSpace: {
    geometryRevision: string;
    variableBounds: Record<string, { min: number; max: number; unit: string }>;
  };
  constraints: {
    maxStress?: number;
    maxDisplacement?: number;
    minSafetyFactor?: number;
  };
  budget: {
    maxCandidates: number;
    feedbackLoops: number;
  };
}

export interface AIProposal {
  candidateId: string;
  designVariables: Record<string, number>;
  engineeringReasoning: string;
  expectedOutcome: string;
  confidenceLevel: number;
}

export interface ExplorationResult {
  requestId: string;
  proposals: AIProposal[];
  evaluatedCandidates: OptimizationCandidate[];
  recommendation?: OptimizationCandidate;
  summary: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  truthThread?: MaterialTruthThread;
  resultHash: string;
}

export class AIMaterialExplorationEngine {
  private optimizationEngine = new EngineeringOptimizationEngine();
  private genAI: GoogleGenAI;

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  /**
   * Executes AI-driven material exploration.
   * V11-ARCH-01: Explainable, physics-constrained AI candidate generation.
   */
  public async explore(
    baseModel: FEMModel,
    request: ExplorationRequest
  ): Promise<ExplorationResult> {
    const proposals: AIProposal[] = [];
    const evaluatedCandidates: OptimizationCandidate[] = [];

    // 1. Generate Candidates via Gemini
    try {
      const aiProposals = await this.generateAIProposals(request);
      proposals.push(...aiProposals);
    } catch (e: any) {
      console.error("[AI_EXPLORATION_GEN_ERROR]", e);
      return {
        requestId: request.requestId,
        proposals: [],
        evaluatedCandidates: [],
        summary: `AI Candidate Generation Failed: ${e.message}`,
        status: "FAILED",
        resultHash: FEMEvidenceEngine.hashData({ error: e.message })
      };
    }

    // 2. Map Proposals to Optimization Problem and Evaluate
    for (const proposal of proposals) {
      const candidate = await this.evaluateProposal(baseModel, request, proposal);
      evaluatedCandidates.push(candidate);
    }

    // 3. Select Best Recommendation
    const feasible = evaluatedCandidates.filter(c => c.evaluation.feasibility === "FEASIBLE");
    let recommendation: OptimizationCandidate | undefined;
    if (feasible.length > 0) {
      // Simplistic ranking: minimize strain energy if present, else just take first feasible
      recommendation = feasible[0]; 
    }

    const result: ExplorationResult = {
      requestId: request.requestId,
      proposals,
      evaluatedCandidates,
      recommendation,
      summary: `Exploration complete. Evaluated ${evaluatedCandidates.length} candidates. ${feasible.length} feasible solutions found.`,
      status: feasible.length === evaluatedCandidates.length ? "SUCCESS" : "PARTIAL",
      resultHash: ""
    };

    result.resultHash = FEMEvidenceEngine.hashData({
      requestId: request.requestId,
      proposalIds: proposals.map(p => p.candidateId),
      candidateHashes: evaluatedCandidates.map(c => c.candidateId),
      status: result.status
    });

    return result;
  }

  private async generateAIProposals(request: ExplorationRequest): Promise<AIProposal[]> {
    const prompt = `
      As an expert Material Science and Structural Engineer, explore the material design space for the following request:
      Intent: ${request.engineeringIntent}
      Target Properties: ${request.targetProperties.join(", ")}
      Variable Bounds: ${JSON.stringify(request.designSpace.variableBounds)}
      Constraints: ${JSON.stringify(request.constraints)}
      Budget: Generate exactly ${request.budget.maxCandidates} distinct candidates.
      
      For each candidate, provide a JSON object with:
      - candidateId: string
      - designVariables: Object mapping property name to numeric value
      - engineeringReasoning: string explaining the choice based on mechanics
      - expectedOutcome: predicted impact
      - confidenceLevel: number 0-1
    `;

    const response = await this.genAI.models.generateContent({
      model: "gemini-4-argon",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              candidateId: { type: Type.STRING },
              designVariables: { type: Type.OBJECT, additionalProperties: { type: Type.NUMBER } },
              engineeringReasoning: { type: Type.STRING },
              expectedOutcome: { type: Type.STRING },
              confidenceLevel: { type: Type.NUMBER }
            },
            required: ["candidateId", "designVariables", "engineeringReasoning", "expectedOutcome", "confidenceLevel"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  }

  private async evaluateProposal(
    baseModel: FEMModel,
    request: ExplorationRequest,
    proposal: AIProposal
  ): Promise<OptimizationCandidate> {
    // Convert AI Proposal designVariables to design variables for OptimizationEngine
    // Note: EngineeringOptimizationEngine requires an OptimizationProblem object
    const problem: OptimizationProblem = {
      problemId: `OPT-${request.requestId}-${proposal.candidateId}`,
      problemRevision: "REV-AI-1.0",
      variables: Object.entries(proposal.designVariables).map(([prop, val]) => ({
        variableId: prop,
        targetNodeId: "FIELD1", // Assuming target is FIELD1 for now
        propertyName: prop as any,
        range: [
            request.designSpace.variableBounds[prop]?.min || 0,
            request.designSpace.variableBounds[prop]?.max || Infinity
        ],
        initialValue: val
      })),
      objectives: [
        {
          objectiveId: "PRIMARY_OBJ",
          type: "MINIMIZE",
          metric: "STRAIN_ENERGY",
          unit: "J",
          weight: 1.0
        }
      ],
      constraints: Object.entries(request.constraints).map(([key, val]) => ({
          constraintId: key,
          type: "PHYSICS",
          limitType: "UPPER_BOUND",
          threshold: val as number
      })),
      strategy: {
        strategyType: "COORDINATE_DESCENT",
        maxIterations: 0, // Just evaluate the proposal, don't optimize further
        convergenceTolerance: 1e-4
      }
    };

    // Use OptimizationEngine's internal evaluateCandidate (exposed via refactoring if needed, or just run a 0-iteration optimize)
    const optResult = await this.optimizationEngine.optimize(baseModel, problem);
    
    if (optResult.allCandidates.length > 0) {
        return optResult.allCandidates[0];
    }

    return {
        candidateId: proposal.candidateId,
        variableValues: new Map(Object.entries(proposal.designVariables)),
        evaluation: {
            objectiveValues: new Map(),
            constraintResults: new Map(),
            feasibility: "INFEASIBLE",
            invalidationReason: "EVALUATION_INTERNAL_ERROR"
        },
        timestamp: new Date().toISOString()
    };
  }
}
