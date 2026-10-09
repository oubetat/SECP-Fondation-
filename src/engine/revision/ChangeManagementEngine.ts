import { createHash } from 'crypto';

export type ChangeType = 'PARAMETER_CHANGE' | 'FEATURE_ADD' | 'GEOMETRY_REMOVAL' | 'MATERIAL_CHANGE' | 'TOLERANCE_ADJUSTMENT';
export type ChangePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ChangeOrigin = 'ENGINEER' | 'SIMULATION_RESULT' | 'SUPPLIER_REQUEST' | 'REGULATORY_COMPLIANCE' | 'AI_PROPOSED';
export type ChangeStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_ANALYSIS' | 'UNDER_REVIEW' | 'APPROVED' | 'IMPLEMENTING' | 'VALIDATING' | 'COMPLETED' | 'CANCELLED';

export interface EngineeringChange {
  changeId: string;
  title: string;
  description: string;
  type: ChangeType;
  priority: ChangePriority;
  origin: ChangeOrigin;
  status: ChangeStatus;
  author: string;
  createdAt: string;
  versionToken: string;
  targetObjectId: string;
  targetRevisionId: string;
  details: {
    whatChanges: string;
    why: string;
    where: string;
    expectedBenefit: string;
    expectedRisk: string;
    affectedObjects: string[];
  };
  impactsAnalyzed: boolean;
  directImpacts: string[];
  indirectImpacts: string[];
  riskScore: number;
  riskClass: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  classification: string;
  reviewers: string[];
  decisions: Record<string, { decision: string; comment: string; timestamp: string }>;
  validationPlan: {
    executions: Array<{
      domain: string;
      status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
      evidenceRef: string;
      executor: string;
    }>;
  };
  integrityHash?: string;
}

export interface AuditEvent {
  timestamp: string;
  user: string;
  action: string;
  comment?: string;
}

export class ChangeManagementEngine {
  private changes: EngineeringChange[] = [];

  public reset(): void {
    this.changes = [];
    this.history = {};
  }

  public loadDemoChanges(): void {
    this.changes = [
      {
        changeId: 'CR-001',
        title: 'Increase Structural Web Thickness',
        description: 'Strengthen core rib section to meet minimum safety factor under 150% structural loads.',
        type: 'PARAMETER_CHANGE',
        priority: 'HIGH',
        origin: 'SIMULATION_RESULT',
        status: 'SUBMITTED',
        author: 'FEA Analyst',
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        versionToken: 'tok_8f32a10c',
        targetObjectId: 'PART-001',
        targetRevisionId: 'PART-001:REV-A',
        details: {
          whatChanges: 'Adjust rib parameter from 4.5mm to 6.2mm.',
          why: 'Resolve local stress concentration discovered in multi-physics stress study.',
          where: 'Rotor blade Root Joint Section B',
          expectedBenefit: 'Increases structural yield limit margins by 24%.',
          expectedRisk: 'Adds approximately 140g of material weight.',
          affectedObjects: ['PART-001', 'STUDY-FEM-TURBINE']
        },
        impactsAnalyzed: false,
        directImpacts: [],
        indirectImpacts: [],
        riskScore: 0,
        riskClass: 'MEDIUM',
        classification: 'Class I Major',
        reviewers: ['LEAD_INTEGRATOR'],
        decisions: {},
        validationPlan: {
          executions: []
        }
      },
      {
        changeId: 'CR-002',
        title: 'Advanced Blade Cavity Geometry',
        description: 'Introduce internal hollow cavities on turbine blades to reduce dynamic rotary inertia.',
        type: 'FEATURE_ADD',
        priority: 'MEDIUM',
        origin: 'ENGINEER',
        status: 'APPROVED',
        author: 'Design Lead',
        createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        versionToken: 'tok_5a938210',
        targetObjectId: 'PART-001',
        targetRevisionId: 'PART-001:REV-A',
        details: {
          whatChanges: 'Carve internal 1.2mm shell offsets in mid-span section.',
          why: 'Decrease centrifugal force load on bearing hubs during high RPM duty.',
          where: 'Rotor Mid-Span Subassembly',
          expectedBenefit: 'Reduces dynamic rotor inertia by 8.5% with minor stiffness tradeoff.',
          expectedRisk: 'Increases modal vibration sensitivity by 4.2Hz.',
          affectedObjects: ['PART-001', 'ASM-002', 'DWG-PART-001']
        },
        impactsAnalyzed: true,
        directImpacts: ['PART-001', 'ASM-002'],
        indirectImpacts: ['DWG-PART-001', 'STUDY-FEM-TURBINE'],
        riskScore: 45,
        riskClass: 'MEDIUM',
        classification: 'Class I Major',
        reviewers: ['LEAD_INTEGRATOR'],
        decisions: {
          LEAD_INTEGRATOR: {
            decision: 'APPROVED',
            comment: 'Approved for active testing. Modal parameters must be verified during validation cycle.',
            timestamp: new Date().toISOString()
          }
        },
        validationPlan: {
          executions: [
            {
              domain: 'FEM_MESH',
              status: 'PASS',
              evidenceRef: 'EVI-83920',
              executor: 'PHYSICS_VALIDATOR'
            }
          ]
        }
      }
    ];
  }

  private history: Record<string, AuditEvent[]> = {
    'CR-001': [
      {
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        user: 'FEA Analyst',
        action: 'PROPOSED',
        comment: 'Initial submission of parameter alteration request.'
      }
    ],
    'CR-002': [
      {
        timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
        user: 'Design Lead',
        action: 'PROPOSED',
        comment: 'Proposed weight-reduction hollow cavity layout.'
      },
      {
        timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        user: 'LEAD_INTEGRATOR',
        action: 'APPROVED',
        comment: 'Approved with conditions. Check FEM mesh accuracy.'
      }
    ]
  };

  public getAllChanges(): EngineeringChange[] {
    return this.changes;
  }

  public getChanges(): EngineeringChange[] {
    return this.changes;
  }

  public createChange(
    title: string,
    description: string,
    type: ChangeType,
    priority: ChangePriority,
    targetObjectId: string,
    targetRevisionId: string,
    author: string,
    origin: ChangeOrigin,
    details: EngineeringChange['details']
  ): EngineeringChange {
    const changeId = `CR-00${this.changes.length + 1}`;
    const newChange: EngineeringChange = {
      changeId,
      title,
      description,
      type,
      priority,
      origin,
      status: 'DRAFT',
      author,
      createdAt: new Date().toISOString(),
      versionToken: `tok_${createHash('sha256').update(changeId + author + 'INIT').digest('hex').slice(0, 10)}`,
      targetObjectId,
      targetRevisionId,
      details,
      impactsAnalyzed: false,
      directImpacts: [],
      indirectImpacts: [],
      riskScore: 0,
      riskClass: 'LOW',
      classification: 'Class II Minor',
      reviewers: [],
      decisions: {},
      validationPlan: {
        executions: []
      }
    };

    this.changes.push(newChange);
    this.history[changeId] = [
      {
        timestamp: new Date().toISOString(),
        user: author,
        action: 'CREATED',
        comment: 'Change Request created as Draft.'
      }
    ];

    return newChange;
  }

  public transitionChange(
    changeId: string,
    nextStatus: ChangeStatus,
    user: string,
    token: string,
    comment?: string
  ): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);
    if (change.versionToken !== token) {
      throw new Error(`Concurrency Violation: Version tokens do not match.`);
    }

    change.status = nextStatus;
    change.versionToken = `tok_${createHash('sha256').update(changeId + nextStatus + String(this.history[changeId]?.length || 0)).digest('hex').slice(0, 10)}`;

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user,
      action: `TRANSITIONED_TO_${nextStatus}`,
      comment
    });
  }

  public analyzeImpact(changeId: string, user: string): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    change.impactsAnalyzed = true;
    change.directImpacts = [change.targetObjectId];
    change.indirectImpacts = change.details.affectedObjects.filter(obj => obj !== change.targetObjectId);
    
    // Compute deterministic impact risk score
    const factor = change.priority === 'CRITICAL' ? 85 : change.priority === 'HIGH' ? 68 : 42;
    const impactBonus = Math.min(10, (change.directImpacts.length + change.indirectImpacts.length) * 2);
    change.riskScore = Math.min(98, factor + impactBonus);
    change.riskClass = change.riskScore > 75 ? 'CRITICAL' : change.riskScore > 50 ? 'HIGH' : 'MEDIUM';
    change.classification = change.riskScore > 60 ? 'Class I Major' : 'Class II Minor';
    change.status = 'UNDER_ANALYSIS';

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user,
      action: 'IMPACT_ANALYSIS_EXECUTED',
      comment: `Risk assessed at ${change.riskScore}% (${change.riskClass}).`
    });
  }

  public assignReviewer(changeId: string, reviewer: string, user: string): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    if (!change.reviewers.includes(reviewer)) {
      change.reviewers.push(reviewer);
      if (!this.history[changeId]) this.history[changeId] = [];
      this.history[changeId].push({
        timestamp: new Date().toISOString(),
        user,
        action: 'REVIEWER_ASSIGNED',
        comment: `Assigned review duty to ${reviewer}.`
      });
    }
  }

  public submitReviewDecision(
    changeId: string,
    reviewer: string,
    decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    comment: string
  ): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    const nextStatusMap: Record<string, ChangeStatus> = {
      APPROVE: 'APPROVED',
      REJECT: 'CANCELLED',
      REQUEST_CHANGES: 'DRAFT'
    };

    change.decisions[reviewer] = {
      decision,
      comment,
      timestamp: new Date().toISOString()
    };

    change.status = nextStatusMap[decision] || change.status;

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user: reviewer,
      action: `REVIEW_SUBMITTED_${decision}`,
      comment
    });
  }

  public startImplementation(changeId: string, user: string): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    change.status = 'IMPLEMENTING';

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user,
      action: 'IMPLEMENTATION_STARTED',
      comment: 'Branch sandbox initialized and G-code compiler dispatched.'
    });
  }

  public executeValidationPlan(
    changeId: string,
    domain: string,
    status: 'PASS' | 'FAIL' | 'INCONCLUSIVE',
    evidenceRef: string,
    user: string
  ): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    // Add execution
    change.validationPlan.executions = change.validationPlan.executions.filter(e => e.domain !== domain);
    change.validationPlan.executions.push({
      domain,
      status,
      evidenceRef,
      executor: user
    });

    change.status = 'VALIDATING';

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user,
      action: `VALIDATION_EXECUTED_${domain}`,
      comment: `Domain ${domain} assessed with status: ${status}. Evidence sealed: ${evidenceRef}`
    });
  }

  public completeChange(changeId: string, releasedRevision: string, user: string): void {
    const change = this.changes.find(c => c.changeId === changeId);
    if (!change) throw new Error(`Change Request ${changeId} not found.`);

    change.status = 'COMPLETED';
    const changePayload = `${changeId}|${releasedRevision}|${change.targetObjectId}|${change.targetRevisionId}|${user}`;
    change.integrityHash = `secp-sha256-${createHash('sha256').update(changePayload).digest('hex').slice(0, 32)}`;

    if (!this.history[changeId]) this.history[changeId] = [];
    this.history[changeId].push({
      timestamp: new Date().toISOString(),
      user,
      action: 'SIGNED_OFF_COMPLETED',
      comment: `Formally released new revision: ${releasedRevision}. Integrity hash sealed.`
    });
  }

  public getChangeHistory(changeId: string): AuditEvent[] {
    return this.history[changeId] || [];
  }
}
