import { EngineeringWorkflow, WorkflowMaturity } from './WorkflowTypes';

export class CompetitiveWorkflowRegistry {
  private static instance: CompetitiveWorkflowRegistry;
  private workflows: EngineeringWorkflow[] = [];

  private constructor() {
    this.workflows = [
      {
        id: 'WF-001',
        name: 'Aerospace Component Design to CFD',
        maturity: WorkflowMaturity.PRODUCTION_PROVEN,
        stages: [
          { id: 'S1', name: 'NURBS Modeling', domain: 'CAD', status: 'COMPLETED', evidenceIds: ['EVID-001'] },
          { id: 'S2', name: 'Mesh Generation', domain: 'MESH', status: 'COMPLETED', evidenceIds: ['EVID-002'] },
          { id: 'S3', name: 'CFD Solver', domain: 'CFD', status: 'PENDING', evidenceIds: [] }
        ],
        lineage: []
      }
    ];
  }

  public static getInstance(): CompetitiveWorkflowRegistry {
    if (!CompetitiveWorkflowRegistry.instance) {
      CompetitiveWorkflowRegistry.instance = new CompetitiveWorkflowRegistry();
    }
    return CompetitiveWorkflowRegistry.instance;
  }

  public getAllWorkflows(): EngineeringWorkflow[] {
    return this.workflows;
  }
}
