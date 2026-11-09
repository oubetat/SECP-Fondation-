import {
  AIDesignSession,
  StructuredIntent,
  AIDesignProposal,
  AIDesignReview,
  DesignCandidate,
  AIDesignEvidenceRecord
} from './AIDesignAssistantTypes306';
import { AIDesignEvidenceGenerator } from './AIDesignEvidenceGenerator';

export class AIDesignAssistantService {
  private static instance: AIDesignAssistantService;

  public static getInstance(): AIDesignAssistantService {
    if (!AIDesignAssistantService.instance) {
      AIDesignAssistantService.instance = new AIDesignAssistantService();
    }
    return AIDesignAssistantService.instance;
  }

  public createSession(params?: {
    projectId?: string;
    revisionId?: string;
    userId?: string;
    targetArtifactId?: string;
  } | string): AIDesignSession {
    const pId = typeof params === 'object' ? params.projectId || 'PROJ_DEFAULT' : 'PROJ_DEFAULT';
    const rId = typeof params === 'object' ? params.revisionId || 'REV_A' : 'REV_A';
    const uId = typeof params === 'object' ? params.userId || 'ENG_USER_01' : 'ENG_USER_01';

    return {
      sessionId: `SESSION_${Date.now()}`,
      projectId: pId,
      revisionId: rId,
      userId: uId,
      contextHash: `CTX_HASH_${Date.now()}`,
      model: {
        modelId: 'gemini-3.6-flash',
        modelVersion: '2.5.0',
        provider: 'Google AI Studio',
        configuration: { temperature: 0.2 }
      },
      promptVersion: 'SECP_AI_ASSISTANT_V3.0',
      policyVersion: 'SECP_SAFETY_POLICY_2026.1',
      createdAt: Date.now()
    };
  }

  public parseIntent(input: string): StructuredIntent {
    const isAmbiguous = input.toLowerCase().includes('impossible') || input.toLowerCase().includes('contradiction');

    return {
      rawNaturalLanguage: input,
      primaryObjective: 'Reduce mass while maintaining structural rigidity and machinability',
      objectives: [
        { metric: 'MASS', direction: 'MINIMIZE', targetValue: 15 },
        { metric: 'STIFFNESS', direction: 'MAINTAIN' }
      ],
      constraints: [
        { metric: 'MAX_VON_MISES_STRESS', boundType: 'MAX', value: 250, unit: 'MPa' },
        { metric: 'MIN_WALL_THICKNESS', boundType: 'MIN', value: 3.0, unit: 'mm' }
      ],
      manufacturingRequirements: ['3_AXIS_CNC', 'STANDARD_END_MILL'],
      performanceRequirements: ['SAFETY_FACTOR >= 1.5'],
      explicitAssumptions: [
        'Material remains Aluminum 7075-T6',
        'Load boundary conditions unchanged from baseline REV_A'
      ],
      ambiguityStatus: isAmbiguous ? 'NEEDS_CLARIFICATION' : 'CLEAR',
      clarificationPrompt: isAmbiguous ? 'Please resolve conflicting mass and boundary requirements' : undefined
    };
  }

  public async createDesignProposal(
    session: AIDesignSession,
    intent: StructuredIntent,
    targetObject: string = 'Bracket_Body_v2'
  ): Promise<AIDesignProposal> {
    const proposalId = `PROP_${Date.now()}`;
    return {
      proposalId,
      sessionId: session.sessionId,
      requestId: `REQ_${Date.now()}`,
      baseRevision: session.revisionId,
      targetObject,
      changes: [
        {
          type: 'GEOMETRY_PARAM',
          targetId: 'Pocket_Depth',
          description: 'Increase pocket depth to eliminate non-structural core mass',
          action: 'MODIFY_DEPTH'
        },
        {
          type: 'FEATURE_MODIFICATION',
          targetId: 'Rib_Thickness',
          description: 'Taper rib thickness from 5.0mm to 3.8mm',
          action: 'REDUCE_THICKNESS'
        }
      ],
      diff: {
        parametricDiffs: [
          { parameterName: 'Pocket_Depth', oldValue: 12.0, newValue: 15.5, unit: 'mm' },
          { parameterName: 'Rib_Thickness', oldValue: 5.0, newValue: 3.8, unit: 'mm' }
        ],
        affectedFeatures: ['Pocket_Extrude_01', 'Rib_Pattern_02'],
        affectedConstraints: ['Max_Stress_Limit', 'Clearance_Zone_C'],
        assemblyImpact: {
          hasClearanceIssue: false,
          affectedMatingParts: []
        },
        manufacturingImpact: {
          machinabilityScoreBefore: 88,
          machinabilityScoreAfter: 94,
          toolpathCollisionRisk: 'NONE'
        },
        simulationImpact: {
          revalidationRequiredSolvers: ['FEM', 'CAM']
        },
        validationImpact: {
          revalidationRequiredGates: ['GATE_306', 'GATE_FEM_STATIC']
        }
      },
      reasoning: 'Material removal focused on low-strain nodal zones evaluated via native FEM solver sensitivity topology graph.',
      expectedImpact: {
        massDeltaPercent: -18.4,
        stiffnessDeltaPercent: -1.2,
        costDeltaPercent: -8.5
      },
      assumptions: ['Static structural loading condition 15kN applied at mounting flange'],
      validationPlan: {
        solversToRun: ['FEM_STATIC_SOLVER', 'CAM_TOOLPATH_ANALYZER'],
        rulesToCheck: ['MIN_WALL_THICKNESS_RULE', 'TOOL_ACCESSIBILITY_RULE']
      },
      aiModelConfidence: 0.94,
      status: 'PENDING_REVIEW',
      createdAt: Date.now()
    };
  }

  public generateProposal(session: AIDesignSession, intent: StructuredIntent): Promise<AIDesignProposal> {
    return this.createDesignProposal(session, intent);
  }

  public approveProposalAndCreateRevision(
    proposalId: string,
    session: AIDesignSession,
    engineerId: string
  ): {
    proposal: AIDesignProposal;
    newRevisionId: string;
    ecoId: string;
    evidenceRecord: AIDesignEvidenceRecord;
  } {
    const newRevisionId = `${session.projectId}_REV_B_AI`;
    const ecoId = `ECO_PATCH306_${Date.now()}`;

    const evidenceRecord = AIDesignEvidenceGenerator.generateEvidence({
      sessionId: session.sessionId,
      requestId: `REQ_${Date.now()}`,
      projectId: session.projectId,
      revisionId: newRevisionId,
      userId: engineerId,
      modelId: session.model.modelId,
      modelVersion: session.model.modelVersion,
      promptVersion: session.promptVersion,
      policyVersion: session.policyVersion,
      contextHash: session.contextHash,
      toolCallCount: 6,
      proposalId,
      validationRunsCount: 2,
      decision: 'APPROVED',
      outputHash: `OUT_HASH_${proposalId}`
    });

    const proposal: AIDesignProposal = {
      proposalId,
      sessionId: session.sessionId,
      requestId: `REQ_${Date.now()}`,
      baseRevision: session.revisionId,
      targetObject: 'Bracket_Body_v2',
      changes: [],
      diff: {
        parametricDiffs: [],
        affectedFeatures: [],
        affectedConstraints: [],
        assemblyImpact: { hasClearanceIssue: false, affectedMatingParts: [] },
        manufacturingImpact: { machinabilityScoreBefore: 88, machinabilityScoreAfter: 94, toolpathCollisionRisk: 'NONE' },
        simulationImpact: { revalidationRequiredSolvers: [] },
        validationImpact: { revalidationRequiredGates: [] }
      },
      reasoning: 'Approved by human engineer',
      expectedImpact: { massDeltaPercent: -18.4, stiffnessDeltaPercent: -1.2, costDeltaPercent: -8.5 },
      assumptions: [],
      validationPlan: { solversToRun: [], rulesToCheck: [] },
      aiModelConfidence: 0.94,
      status: 'APPROVED',
      createdAt: Date.now()
    };

    return {
      proposal,
      newRevisionId,
      ecoId,
      evidenceRecord
    };
  }

  public runDesignReview(projectId: string, revisionId: string): AIDesignReview {
    return {
      reviewId: `REV_AI_${Date.now()}`,
      projectId,
      revisionId,
      items: [
        {
          itemId: 'REV_ITEM_01',
          category: 'GEOMETRY',
          severity: 'INFO',
          title: 'Machining Fillet Radius Optimization',
          description: 'Corner radius 3.5mm allows standard 6mm ball end mill toolpath without chattering.',
          flaggedBy: 'CAM_RULES_ENGINE',
          evidenceSource: 'Toolpath_Accessibility_Graph',
          explainability: 'Tool clearance ratio exceeds 1.35x nominal shank diameter.'
        },
        {
          itemId: 'REV_ITEM_02',
          category: 'STRUCTURAL',
          severity: 'WARNING',
          title: 'Stress Concentration at Mounting Boss',
          description: 'Localized stress reaches 210 MPa (Safety Factor 1.68 vs target 2.0).',
          flaggedBy: 'FEM_SOLVER_RUN',
          evidenceSource: 'Von_Mises_Contour_Mesh_Node_482',
          explainability: 'Sudden cross-sectional area transition from flange to cylindrical boss.'
        }
      ],
      overallStatus: 'PASS_WITH_WARNINGS',
      createdAt: Date.now()
    };
  }

  public exploreDesignSpace(projectId: string): DesignCandidate[] {
    return [
      {
        candidateId: 'CAND_01',
        name: 'Aggressive Topology Mask (Mass -22%)',
        parameters: { Pocket_Depth: 18.0, Rib_Thickness: 3.2 },
        revisionId: 'REV_A',
        solverResults: [
          { solver: 'SECP_FEM', metric: 'SafetyFactor', value: 1.52, hash: 'HASH_FEM_01' },
          { solver: 'SECP_CAM', metric: 'Machinability', value: 89, hash: 'HASH_CAM_01' }
        ],
        compositeScore: 92.4,
        status: 'CANDIDATE'
      },
      {
        candidateId: 'CAND_02',
        name: 'Balanced Standard CNC Milling (Mass -15%)',
        parameters: { Pocket_Depth: 14.5, Rib_Thickness: 4.0 },
        revisionId: 'REV_A',
        solverResults: [
          { solver: 'SECP_FEM', metric: 'SafetyFactor', value: 1.95, hash: 'HASH_FEM_02' },
          { solver: 'SECP_CAM', metric: 'Machinability', value: 96, hash: 'HASH_CAM_02' }
        ],
        compositeScore: 96.8,
        status: 'SELECTED'
      }
    ];
  }

  public async runCounterfactualAnalysis(
    session: AIDesignSession,
    parameterName: string,
    delta: number
  ): Promise<{
    parameterName: string;
    delta: number;
    massDeltaKg: number;
    stressDeltaMPa: number;
    safetyFactorDelta: number;
    confidence: number;
  }> {
    const massDeltaKg = -(delta * 0.082);
    const stressDeltaMPa = delta * 6.4;
    const safetyFactorDelta = -(delta * 0.05);

    return {
      parameterName,
      delta,
      massDeltaKg: Number(massDeltaKg.toFixed(3)),
      stressDeltaMPa: Number(stressDeltaMPa.toFixed(1)),
      safetyFactorDelta: Number(safetyFactorDelta.toFixed(2)),
      confidence: 0.96
    };
  }
}

