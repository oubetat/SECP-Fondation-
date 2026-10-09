
import { WorkflowStage, WorkflowStatus, EngineeringRequirement, WorkflowArtifact } from './RealEngineerWorkflowTypes';

export type ProjectDomain =
  | 'MECHANICAL'
  | 'AEROSPACE'
  | 'AUTOMOTIVE'
  | 'ROBOTICS'
  | 'FLUID_SYSTEMS'
  | 'THERMAL_SYSTEMS'
  | 'GEAR_SYSTEMS'
  | 'MANUFACTURING'
  | 'INDUSTRIAL_MACHINERY'
  | 'ADVANCED_SYSTEMS';

export type ProjectLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface ProjectMetadata {
  projectId: string;
  projectName: string;
  domain: ProjectDomain;
  level: ProjectLevel;
  requirements: EngineeringRequirement[];
  configuration: Record<string, any>;
}

export interface ProjectEvidenceRecord {
  projectId: string;
  workflowId: string;
  artifacts: Map<WorkflowStage, WorkflowArtifact>;
  finalVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}

export interface PortfolioScore {
  totalProjects: number;
  domainCoverage: Record<ProjectDomain, number>;
  levelDistribution: Record<number, number>;
  successRate: number;
  totalEvidenceCount: number;
  globalVerdict: 'PASS' | 'FAIL';
}
