/**
 * SECP — ADSE-P3 Architecture Design Space & Possibility Space Engine
 * Formalizes Architecture Design Spaces, Candidate Architectures,
 * Unknown Design Discovery foundations, and trade-off explorations.
 *
 * Invariant: Candidates are speculative architectural explorations and
 * MUST NOT become canonical engineering truth without explicit human governance promotion.
 */

import { ArchitectureElementRegistry } from './ArchitectureElementRegistry';
import { 
  ArchitectureDesignSpace, 
  CandidateArchitecture, 
  EngineeringPossibilitySpace 
} from './types';
import { createHash } from 'crypto';

export class ArchitectureDesignSpaceEngine {
  private registry: ArchitectureElementRegistry;
  private designSpaces: Map<string, ArchitectureDesignSpace> = new Map();
  private possibilitySpaces: Map<string, EngineeringPossibilitySpace> = new Map();

  constructor(registry: ArchitectureElementRegistry) {
    this.registry = registry;
  }

  public createDesignSpace(params: {
    designSpaceId: string;
    title: string;
    systemArchId: string;
    boundingRequirements: string[];
    boundingConstraints: string[];
    assumptions: string[];
    configurationId: string;
  }): ArchitectureDesignSpace {
    if (this.designSpaces.has(params.designSpaceId)) {
      throw new Error(`DESIGN_SPACE_ERROR: Design space '${params.designSpaceId}' already exists.`);
    }

    const provenanceId = `PROV-SPACE-${createHash('sha256').update(params.designSpaceId + params.title).digest('hex').substring(0, 12)}`;

    const space: ArchitectureDesignSpace = {
      designSpaceId: params.designSpaceId,
      title: params.title,
      systemArchId: params.systemArchId,
      boundingRequirements: params.boundingRequirements,
      boundingConstraints: params.boundingConstraints,
      assumptions: params.assumptions,
      candidates: [],
      configurationId: params.configurationId,
      provenanceId
    };

    this.designSpaces.set(params.designSpaceId, space);
    return space;
  }

  public addCandidateArchitecture(
    designSpaceId: string, 
    candidate: Omit<CandidateArchitecture, 'provenanceId' | 'isPromotedToCanonical'>
  ): CandidateArchitecture {
    const space = this.designSpaces.get(designSpaceId);
    if (!space) {
      throw new Error(`DESIGN_SPACE_ERROR: Design space '${designSpaceId}' not found.`);
    }

    if (space.candidates.some(c => c.candidateId === candidate.candidateId)) {
      throw new Error(`DESIGN_SPACE_ERROR: Candidate '${candidate.candidateId}' already exists in space '${designSpaceId}'.`);
    }

    const provenanceId = `PROV-CANDIDATE-${createHash('sha256').update(candidate.candidateId + candidate.name).digest('hex').substring(0, 12)}`;

    const fullCandidate: CandidateArchitecture = {
      ...candidate,
      provenanceId,
      isPromotedToCanonical: false
    };

    space.candidates.push(fullCandidate);
    return fullCandidate;
  }

  /**
   * Promotes a candidate architecture to Canonical truth.
   * REQUIRES HUMAN GOVERNANCE: AI cannot self-promote.
   */
  public promoteCandidateToCanonical(params: {
    designSpaceId: string;
    candidateId: string;
    authorizedBy: string;
    targetRevisionCode: string;
  }): CandidateArchitecture {
    const isAI = params.authorizedBy.toLowerCase().includes('ai') || 
                 params.authorizedBy.toLowerCase().includes('copilot') || 
                 params.authorizedBy.toLowerCase().includes('assistant');

    if (isAI) {
      throw new Error(`AI_GOVERNANCE_VIOLATION: AI actor '${params.authorizedBy}' cannot promote Candidate Architecture to Canonical state.`);
    }

    const space = this.designSpaces.get(params.designSpaceId);
    if (!space) {
      throw new Error(`DESIGN_SPACE_ERROR: Design space '${params.designSpaceId}' not found.`);
    }

    const candidate = space.candidates.find(c => c.candidateId === params.candidateId);
    if (!candidate) {
      throw new Error(`DESIGN_SPACE_ERROR: Candidate '${params.candidateId}' not found.`);
    }

    if (candidate.verificationState !== 'VERIFIED') {
      throw new Error(`CANONICAL_PROMOTION_ERROR: Candidate '${params.candidateId}' cannot be promoted: verification state is '${candidate.verificationState}', must be 'VERIFIED'.`);
    }

    candidate.isPromotedToCanonical = true;
    candidate.promotedRevisionId = `REV-ARCH-${candidate.candidateId}-${params.targetRevisionCode}`;

    return candidate;
  }

  /**
   * Explores the engineering possibility space: partitions architectures into
   * Known, Alternative, Unexplored, Boundary, and Emergent.
   */
  public registerPossibilitySpace(params: {
    spaceId: string;
    systemArchId: string;
    knownDesigns: CandidateArchitecture[];
    alternativeDesigns: CandidateArchitecture[];
    unexploredArchitectures: CandidateArchitecture[];
    boundaryArchitectures: CandidateArchitecture[];
    emergentArchitectures: CandidateArchitecture[];
    configurationId: string;
  }): EngineeringPossibilitySpace {
    const provenanceId = `PROV-POSSIBILITY-${createHash('sha256').update(params.spaceId).digest('hex').substring(0, 12)}`;

    const possSpace: EngineeringPossibilitySpace = {
      spaceId: params.spaceId,
      systemArchId: params.systemArchId,
      knownDesigns: params.knownDesigns,
      alternativeDesigns: params.alternativeDesigns,
      unexploredArchitectures: params.unexploredArchitectures,
      boundaryArchitectures: params.boundaryArchitectures,
      emergentArchitectures: params.emergentArchitectures,
      activeScenarios: [],
      configurationId: params.configurationId,
      provenanceId
    };

    this.possibilitySpaces.set(params.spaceId, possSpace);
    return possSpace;
  }

  public getDesignSpace(spaceId: string): ArchitectureDesignSpace | undefined {
    return this.designSpaces.get(spaceId);
  }

  public getAllDesignSpaces(): ArchitectureDesignSpace[] {
    return Array.from(this.designSpaces.values());
  }

  public getPossibilitySpace(spaceId: string): EngineeringPossibilitySpace | undefined {
    return this.possibilitySpaces.get(spaceId);
  }

  public clear(): void {
    this.designSpaces.clear();
    this.possibilitySpaces.clear();
  }
}
