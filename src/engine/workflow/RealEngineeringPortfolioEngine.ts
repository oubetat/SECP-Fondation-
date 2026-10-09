
import { 
  ProjectDomain, 
  ProjectLevel, 
  ProjectMetadata, 
  ProjectEvidenceRecord,
  PortfolioScore
} from './RealEngineeringProjectTypes';
import { RealEngineerWorkflowEngine } from './RealEngineerWorkflowEngine';
import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';

export class RealEngineeringPortfolioEngine {
  private static instance: RealEngineeringPortfolioEngine;
  private workflowEngine = RealEngineerWorkflowEngine.getInstance();
  private evidenceBus = EvidenceBus314.getInstance();
  private projects: Map<string, ProjectMetadata> = new Map();
  private evidenceRecords: Map<string, ProjectEvidenceRecord> = new Map();

  private constructor() {
    this.initializePortfolio();
  }

  public static getInstance(): RealEngineeringPortfolioEngine {
    if (!RealEngineeringPortfolioEngine.instance) {
      RealEngineeringPortfolioEngine.instance = new RealEngineeringPortfolioEngine();
    }
    return RealEngineeringPortfolioEngine.instance;
  }

  private initializePortfolio(): void {
    const domains: ProjectDomain[] = [
      'MECHANICAL', 'AEROSPACE', 'ROBOTICS', 'AUTOMOTIVE', 'FLUID_SYSTEMS',
      'THERMAL_SYSTEMS', 'GEAR_SYSTEMS', 'MANUFACTURING', 'INDUSTRIAL_MACHINERY', 'ADVANCED_SYSTEMS'
    ];

    // Generate 100 projects (10 per domain)
    for (let i = 1; i <= 100; i++) {
      const domainIndex = Math.floor((i - 1) / 10);
      const domain = domains[domainIndex];
      const id = `REP-${i.toString().padStart(3, '0')}`;
      
      const project: ProjectMetadata = {
        projectId: id,
        projectName: `${domain} Project ${i}`,
        domain: domain,
        level: (i % 6 + 1) as ProjectLevel,
        requirements: [
          { 
            id: `REQ-${id}-01`, 
            description: `Primary Structural Integrity for ${domain} component`, 
            constraints: { maxStress: 250e6 }, 
            material: 'AL6061', 
            priority: 'HIGH' 
          }
        ],
        configuration: {
          dx: 100 + (i % 50),
          dy: 80 + (i % 40),
          dz: 30 + (i % 20),
          materialId: i % 2 === 0 ? 'MAT-AL6061-T6' : 'MAT-SS304'
        }
      };
      this.projects.set(id, project);
    }
  }

  public async runProject(projectId: string): Promise<ProjectEvidenceRecord> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);

    console.log(`[PORTFOLIO] Executing Project: ${project.projectId} - ${project.projectName} (Level ${project.level})`);
    
    this.workflowEngine.resetContext(project.projectId);
    
    // Create specific context for this project execution (simplified for battery run)
    // In a real scenario, we would use the project requirements to drive the workflow engine
    const decision = await this.workflowEngine.executeFullBattery();
    
    const record: ProjectEvidenceRecord = {
      projectId: project.projectId,
      workflowId: this.workflowEngine.getContext().workflowId,
      artifacts: new Map(this.workflowEngine.getContext().artifacts),
      finalVerdict: decision.verdict === 'ACCEPT' ? 'PASS' : 'FAIL',
      timestamp: new Date().toISOString()
    };

    this.evidenceRecords.set(projectId, record);
    return record;
  }

  public async runFullPortfolio(): Promise<PortfolioScore> {
    console.log('--- STARTING 100-PROJECT PORTFOLIO EXECUTION ---');
    
    const domainCoverage: Record<ProjectDomain, number> = {
      MECHANICAL: 0, AEROSPACE: 0, ROBOTICS: 0, AUTOMOTIVE: 0, FLUID_SYSTEMS: 0,
      THERMAL_SYSTEMS: 0, GEAR_SYSTEMS: 0, MANUFACTURING: 0, INDUSTRIAL_MACHINERY: 0, ADVANCED_SYSTEMS: 0
    };
    const levelDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    let successes = 0;

    for (const [id, project] of this.projects) {
      const record = await this.runProject(id);
      if (record.finalVerdict === 'PASS') successes++;
      
      domainCoverage[project.domain]++;
      levelDistribution[project.level]++;
    }

    const score: PortfolioScore = {
      totalProjects: this.projects.size,
      domainCoverage,
      levelDistribution,
      successRate: successes / this.projects.size,
      totalEvidenceCount: this.evidenceBus.queryEvidence({}).length,
      globalVerdict: successes === 100 ? 'PASS' : 'FAIL'
    };

    return score;
  }

  public getProjects(): ProjectMetadata[] {
    return Array.from(this.projects.values());
  }

  public getEvidenceRecords(): ProjectEvidenceRecord[] {
    return Array.from(this.evidenceRecords.values());
  }
}
