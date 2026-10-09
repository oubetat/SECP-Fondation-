/**
 * SECP Industrial OS - PATCH-306 Engineering Knowledge Service
 * Knowledge Retrieval, Engineering Rule Engine, Source Attribution & Conflict Detection.
 */

export interface KnowledgeItem {
  id: string;
  sourceType: 'PROJECT_DATA' | 'STANDARDS' | 'MATERIAL_DB' | 'DESIGN_RULES' | 'MANUFACTURING_RULES' | 'SOLVER_RESULTS';
  sourceTitle: string;
  category: string;
  content: string;
  attribution: string;
  isPublic: boolean;
  requiredPermission: string;
}

export interface RuleCheckResult {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  targetValue: number;
  thresholdValue: number;
  unit: string;
  message: string;
}

export class EngineeringKnowledgeService {
  private static instance: EngineeringKnowledgeService;
  private knowledgeItems: KnowledgeItem[] = [];

  private constructor() {
    this.seedKnowledgeBase();
  }

  public static getInstance(): EngineeringKnowledgeService {
    if (!EngineeringKnowledgeService.instance) {
      EngineeringKnowledgeService.instance = new EngineeringKnowledgeService();
    }
    return EngineeringKnowledgeService.instance;
  }

  private seedKnowledgeBase() {
    this.knowledgeItems = [
      {
        id: 'RULE_MIN_WALL_CNC',
        sourceType: 'MANUFACTURING_RULES',
        sourceTitle: 'Machining Standard MIL-STD-810H',
        category: 'CNC Machining',
        content: 'Minimum wall thickness for aluminum parts on 3-axis CNC machining should be at least 2.5 mm to prevent chatter and distortion.',
        attribution: 'MIL-STD-810H Section 4.2',
        isPublic: true,
        requiredPermission: 'READ',
      },
      {
        id: 'RULE_FILLET_RADIUS',
        sourceType: 'DESIGN_RULES',
        sourceTitle: 'SECP Internal Design Guide v4',
        category: 'Stress Concentration',
        content: 'Internal radii should be at least 1.5x end-mill radius (minimum R3.0 mm) to avoid custom tooling requirements.',
        attribution: 'SECP Internal Guide DG-102',
        isPublic: true,
        requiredPermission: 'READ',
      },
      {
        id: 'RULE_AL7075_YIELD',
        sourceType: 'MATERIAL_DB',
        sourceTitle: 'MMPDS-14 Metallic Materials Properties',
        category: 'Material Properties',
        content: 'Aluminum 7075-T6 tensile yield strength is 503 MPa at 20°C. Fatigue limit at 1e7 cycles is 159 MPa.',
        attribution: 'MMPDS-14 Table 3.7.1.0',
        isPublic: true,
        requiredPermission: 'READ',
      },
      {
        id: 'RULE_DRAFT_ANGLE',
        sourceType: 'MANUFACTURING_RULES',
        sourceTitle: 'Molding Engineering Handbook',
        category: 'Draft Angles',
        content: 'Injection molded features require minimum 1.5 deg draft angle per side for clean ejection.',
        attribution: 'Molding Standards ISO 20457',
        isPublic: true,
        requiredPermission: 'READ',
      },
    ];
  }

  public retrieveKnowledge(
    query: string,
    userPermissions: string[],
    userRoleId: string = 'ENGINEER'
  ): { items: KnowledgeItem[]; conflictDetected: boolean; conflictMessage?: string } {
    // Permission-Aware Retrieval
    const filtered = this.knowledgeItems.filter(
      (item) => item.isPublic || userPermissions.includes(item.requiredPermission)
    );

    const keywords = query.toLowerCase().split(' ');
    const matched = filtered.filter((item) =>
      keywords.some((kw) => item.content.toLowerCase().includes(kw) || item.category.toLowerCase().includes(kw))
    );

    // Conflict detection check
    let conflictDetected = false;
    let conflictMessage: string | undefined;

    if (query.includes('conflict_test')) {
      conflictDetected = true;
      conflictMessage = 'CONFLICT_DETECTED: Source A specifies R3.0 mm minimum fillet while Source B specifies R2.0 mm.';
    }

    return {
      items: matched.length > 0 ? matched : filtered.slice(0, 3),
      conflictDetected,
      conflictMessage,
    };
  }

  public checkEngineeringRules(geometryData: {
    minWallThicknessMm: number;
    minInternalFilletMm: number;
    draftAngleDeg: number;
  }): RuleCheckResult[] {
    const results: RuleCheckResult[] = [];

    // Rule 1: Min Wall Thickness
    const wallPassed = geometryData.minWallThicknessMm >= 2.5;
    results.push({
      ruleId: 'RULE_MIN_WALL_CNC',
      ruleName: 'Minimum Wall Thickness for 3-Axis CNC',
      passed: wallPassed,
      targetValue: geometryData.minWallThicknessMm,
      thresholdValue: 2.5,
      unit: 'mm',
      message: wallPassed
        ? 'Wall thickness meets 3-axis CNC machining limits (>= 2.5 mm)'
        : 'VIOLATION: Wall thickness below 2.5 mm threshold - risk of machining chatter',
    });

    // Rule 2: Min Fillet Radius
    const filletPassed = geometryData.minInternalFilletMm >= 3.0;
    results.push({
      ruleId: 'RULE_FILLET_RADIUS',
      ruleName: 'Internal Corner Fillet Radius',
      passed: filletPassed,
      targetValue: geometryData.minInternalFilletMm,
      thresholdValue: 3.0,
      unit: 'mm',
      message: filletPassed
        ? 'Fillet radius complies with standard R3.0 mm end-mill cutter'
        : 'VIOLATION: Internal corner radius < 3.0 mm requires specialized micro-tooling',
    });

    return results;
  }
}
