import { createHash } from 'crypto';

export type EcoStatus = 'DRAFT' | 'SUBMITTED' | 'ANALYSIS' | 'REVIEW' | 'AUTHORIZED' | 'PLANNED' | 'IMPLEMENTING' | 'VALIDATING' | 'READY_FOR_RELEASE' | 'RELEASED' | 'CLOSED' | 'CANCELLED' | 'BLOCKED' | 'REJECTED';
export type EcoPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type EcoSeverity = 'MAJOR' | 'MINOR' | 'CRITICAL';

export interface EcoAffectedObject {
  objectId: string;
  objectType: string;
  requiredAction: string;
  currentState: string;
}

export interface EcoTask {
  taskId: string;
  domain: string;
  status: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'TODO' | string;
  description: string;
  dependencies: string[];
  owner: string;
  evidenceId?: string;
}

export interface EngineeringChangeOrder {
  ecoId: string;
  ecoNumber: string;
  title: string;
  description: string;
  status: EcoStatus;
  priority: EcoPriority;
  severity: EcoSeverity;
  author: string;
  createdDate: string;
  dueDate: string;
  linkedChangeId: string;
  revisionLevel: string;
  riskClass: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  versionToken: string;
  reason: string;
  technicalRationale: string;
  businessRationale: string;
  implementationTasks: EcoTask[];
  affectedObjects: EcoAffectedObject[];
  integrityHash?: string;
}

export interface EcoAuditEvent {
  timestamp: string;
  user: string;
  action: string;
  details?: string;
}

export class EcoManagementEngine {
  private ecos: EngineeringChangeOrder[] = [];

  public reset(): void {
    this.ecos = [];
    this.history = {};
  }

  public loadDemoECOs(): void {
    this.ecos = [
      {
        ecoId: 'ECO-2026-001',
        ecoNumber: 'ECO-2026-001',
        title: 'Rotor Structural Web Thickness Adjustment',
        description: 'Strengthen core rib sections to support higher structural payload limits under 1.5G centrifugal dynamic load.',
        status: 'REVIEW',
        priority: 'HIGH',
        severity: 'MAJOR',
        author: 'Lead Design Specialist',
        createdDate: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        dueDate: '2026-10-15',
        linkedChangeId: 'CR-001',
        revisionLevel: 'B',
        riskClass: 'HIGH',
        versionToken: 'tok_eco_9a2f3e8c',
        reason: 'Physical stress levels surpassed baseline margins in latest non-linear static solver run.',
        technicalRationale: 'Local thickness increased from 4.5mm to 6.2mm increases local load-carrying limit by 24.5% while preventing yield failure.',
        businessRationale: 'Maintains turbine life cycles within strict 20-year structural warranty constraints.',
        affectedObjects: [
          {
            objectId: 'PART-001',
            objectType: 'PART',
            requiredAction: 'UPDATE_RIB_GEOMETRY',
            currentState: 'PROVEN'
          },
          {
            objectId: 'ASM-002',
            objectType: 'ASSEMBLY',
            requiredAction: 'RECONCILE_MATES',
            currentState: 'PENDING'
          }
        ],
        implementationTasks: [
          {
            taskId: 'TSK-001',
            domain: 'CAD_MODELING',
            status: 'COMPLETED',
            description: 'Update the solid body parameters for the core rib thickness in the parametric model.',
            dependencies: [],
            owner: 'Design Engineer 1',
            evidenceId: 'EVI-CAD-74291'
          },
          {
            taskId: 'TSK-002',
            domain: 'FEM_ANALYSIS',
            status: 'READY',
            description: 'Rerun non-linear static stress solver to verify equivalent stress threshold metrics.',
            dependencies: ['TSK-001'],
            owner: 'FEA Analyst 2'
          }
        ]
      },
      {
        ecoId: 'ECO-2026-002',
        ecoNumber: 'ECO-2026-002',
        title: 'Advanced Hollow Cavity Refinement',
        description: 'Incorporate weight-optimized hollow profiles inside mid-span rotor layouts.',
        status: 'IMPLEMENTING',
        priority: 'MEDIUM',
        severity: 'MINOR',
        author: 'Design Coordinator',
        createdDate: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        dueDate: '2026-11-01',
        linkedChangeId: 'CR-002',
        revisionLevel: 'A',
        riskClass: 'MEDIUM',
        versionToken: 'tok_eco_1b0d5c2e',
        reason: 'Rotor weight reduction initiative to reduce rotary moment of inertia.',
        technicalRationale: '1.2mm wall offsets shave 1.86kg total mass while conserving natural flexural modes.',
        businessRationale: 'Drastically cuts raw material expenditures for large batch runs.',
        affectedObjects: [
          {
            objectId: 'PART-001',
            objectType: 'PART',
            requiredAction: 'SHELL_HOLLOW',
            currentState: 'PENDING'
          }
        ],
        implementationTasks: [
          {
            taskId: 'TSK-010',
            domain: 'SHELL_OP',
            status: 'IN_PROGRESS',
            description: 'Carve internal hollow pockets on blade structure.',
            dependencies: [],
            owner: 'CAD Engineer 4'
          }
        ]
      }
    ];
  }

  private history: Record<string, EcoAuditEvent[]> = {
    'ECO-2026-001': [
      {
        timestamp: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
        user: 'Lead Design Specialist',
        action: 'CREATED',
        details: 'Initial engineering change order created and linked to CR-001.'
      }
    ],
    'ECO-2026-002': [
      {
        timestamp: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
        user: 'Design Coordinator',
        action: 'CREATED',
        details: 'ECO established to shell internal hollow pockets.'
      }
    ]
  };

  public getAllECOs(): EngineeringChangeOrder[] {
    return this.ecos;
  }

  public getEcos(): EngineeringChangeOrder[] {
    return this.ecos;
  }

  public getEcoById(id: string): EngineeringChangeOrder | undefined {
    return this.ecos.find(e => e.ecoId === id);
  }

  public createECO(
    linkedChangeId: string,
    author: string,
    dueDate: string,
    description: string,
    reason: string,
    technicalRationale: string,
    businessRationale: string
  ): EngineeringChangeOrder {
    const num = this.ecos.length + 1;
    const ecoId = `ECO-2026-00${num}`;
    const newEco: EngineeringChangeOrder = {
      ecoId,
      ecoNumber: ecoId,
      title: `Verification Order for ${linkedChangeId}`,
      description,
      status: 'DRAFT',
      priority: 'MEDIUM',
      severity: 'MAJOR',
      author,
      createdDate: new Date().toISOString(),
      dueDate,
      linkedChangeId,
      revisionLevel: 'A',
      riskClass: 'MEDIUM',
      versionToken: `tok_eco_${createHash('sha256').update(ecoId + author + 'INIT').digest('hex').slice(0, 10)}`,
      reason,
      technicalRationale,
      businessRationale,
      affectedObjects: [
        {
          objectId: 'PART-001',
          objectType: 'PART',
          requiredAction: 'RECONCILE_GEOMETRY',
          currentState: 'PENDING'
        }
      ],
      implementationTasks: [
        {
          taskId: `TSK-10${num}`,
          domain: 'RECONCILIATION',
          status: 'READY',
          description: 'Review physical interfaces and boundary consistency checks.',
          dependencies: [],
          owner: author
        }
      ]
    };

    this.ecos.push(newEco);
    this.history[ecoId] = [
      {
        timestamp: new Date().toISOString(),
        user: author,
        action: 'CREATED',
        details: `ECO created in Draft linked to Change Request ${linkedChangeId}`
      }
    ];

    return newEco;
  }

  public transitionECO(
    ecoId: string,
    nextStatus: EcoStatus,
    user: string,
    token: string,
    comment?: string
  ): void {
    const eco = this.getEcoById(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found.`);
    if (eco.versionToken !== token) {
      throw new Error(`Concurrency Warning: Stale version token detected.`);
    }

    eco.status = nextStatus;
    eco.versionToken = `tok_eco_${createHash('sha256').update(ecoId + nextStatus + String(this.history[ecoId]?.length || 0)).digest('hex').slice(0, 10)}`;

    if (!this.history[ecoId]) this.history[ecoId] = [];
    this.history[ecoId].push({
      timestamp: new Date().toISOString(),
      user,
      action: `TRANSITIONED_TO_${nextStatus}`,
      details: comment || `Status advanced to ${nextStatus}`
    });
  }

  public startTask(ecoId: string, taskId: string, user: string): void {
    const eco = this.getEcoById(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found.`);

    const task = eco.implementationTasks.find(t => t.taskId === taskId);
    if (!task) throw new Error(`Task ${taskId} not found in ECO ${ecoId}`);

    task.status = 'IN_PROGRESS';

    if (!this.history[ecoId]) this.history[ecoId] = [];
    this.history[ecoId].push({
      timestamp: new Date().toISOString(),
      user,
      action: `TASK_STARTED_${taskId}`,
      details: `Task '${task.description}' active under work-by assignee ${task.owner}`
    });
  }

  public completeTask(ecoId: string, taskId: string, evidenceId: string, user: string): void {
    const eco = this.getEcoById(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found.`);

    const task = eco.implementationTasks.find(t => t.taskId === taskId);
    if (!task) throw new Error(`Task ${taskId} not found in ECO ${ecoId}`);

    task.status = 'COMPLETED';
    task.evidenceId = evidenceId;

    // Check if there are other tasks. If they are ready, auto-unlock them
    eco.implementationTasks.forEach(t => {
      if (t.status === 'READY' || t.status === 'TODO' || t.status === '') {
        if (t.dependencies.includes(taskId)) {
          t.status = 'READY';
        }
      }
    });

    if (!this.history[ecoId]) this.history[ecoId] = [];
    this.history[ecoId].push({
      timestamp: new Date().toISOString(),
      user,
      action: `TASK_COMPLETED_${taskId}`,
      details: `Task '${task.description}' complete. Evidence of verification sealed: ${evidenceId}`
    });
  }

  public submitECOApproval(
    ecoId: string,
    reviewerName: string,
    reviewRole: string,
    reviewDecision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    comment: string
  ): void {
    const eco = this.getEcoById(ecoId);
    if (!eco) throw new Error(`ECO ${ecoId} not found.`);

    const decisionMap: Record<string, EcoStatus> = {
      APPROVE: 'AUTHORIZED',
      REJECT: 'REJECTED',
      REQUEST_CHANGES: 'DRAFT'
    };

    eco.status = decisionMap[reviewDecision] || eco.status;
    eco.versionToken = `tok_eco_${createHash('sha256').update(ecoId + String(reviewDecision) + String(this.history[ecoId]?.length || 0)).digest('hex').slice(0, 10)}`;

    if (!this.history[ecoId]) this.history[ecoId] = [];
    this.history[ecoId].push({
      timestamp: new Date().toISOString(),
      user: reviewerName,
      action: `BOARD_REVIEW_${reviewDecision}`,
      details: `Role [${reviewRole}] submitted review: ${reviewDecision}. Notes: ${comment}`
    });
  }

  public getECOHistory(ecoId: string): EcoAuditEvent[] {
    return this.history[ecoId] || [];
  }
}
