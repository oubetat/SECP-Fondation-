/**
 * SECP CAD Core v0.1 — Project Persistence Engine
 * Saves and loads complete SECP CAD Projects containing Metadata, Parameters,
 * 2D Sketch Profiles, Feature Tree DAG, Assembly Components & Mates.
 */

import { Project } from '../types/domainModel';
import { CadSolidEntity } from './cadKernel';
import { AssemblyComponentItem, AssemblyMate } from './assembly';
import { FeatureTreeNode } from './featureTree';
import { Parameter, Constraint } from '../types/domainModel';

export interface SecpCadProjectData {
  version: string;
  projectId: string;
  projectName: string;
  unit: string;
  updatedAt: string;
  parameters: Record<string, Parameter>;
  constraints: Constraint[];
  featureTree: Record<string, FeatureTreeNode>;
  activeSolid: CadSolidEntity;
  assemblyComponents: AssemblyComponentItem[];
  assemblyMates: AssemblyMate[];
}

export class ProjectStorageEngine {
  private static STORAGE_KEY = 'SECP_CAD_CORE_PROJECT_V01';

  public static saveToLocalStorage(project: SecpCadProjectData): void {
    try {
      const json = JSON.stringify(project, null, 2);
      localStorage.setItem(ProjectStorageEngine.STORAGE_KEY, json);
    } catch (e) {
      console.error('Failed to save SECP project to LocalStorage', e);
    }
  }

  public static loadFromLocalStorage(): SecpCadProjectData | null {
    try {
      const raw = localStorage.getItem(ProjectStorageEngine.STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SecpCadProjectData;
    } catch (e) {
      console.error('Failed to load SECP project from LocalStorage', e);
      return null;
    }
  }

  public static exportProjectJson(project: SecpCadProjectData): string {
    return JSON.stringify(project, null, 2);
  }

  public static importProjectJson(jsonString: string): SecpCadProjectData {
    const parsed = JSON.parse(jsonString) as SecpCadProjectData;
    if (!parsed.version || !parsed.projectName) {
      throw new Error('Invalid SECP CAD Project File Format');
    }
    return parsed;
  }
}
