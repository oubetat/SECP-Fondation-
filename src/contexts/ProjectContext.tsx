import React, { createContext, useContext, useState, useEffect } from 'react';
import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { ProjectMetadata, NewProjectInput, ProjectSessionManager } from '../engine/session/ProjectSession';
import { CadSolidEntity } from '../engine/cadKernel';
import { AssemblyComponentItem } from '../engine/assembly';

interface ProjectContextType {
  activeProject: ProjectMetadata | null;
  canonicalDocument: EngineeringDocument | null;
  activeSolid: CadSolidEntity | null;
  assemblyComponents: AssemblyComponentItem[];
  droneCamResult: any | null;
  
  loadDemoProject: (demoId: string) => void;
  createNewProject: (input: NewProjectInput) => void;
  openSavedProject: (projectId: string, savedProjects: any[]) => void;
  closeProject: () => void;
  updateActiveSolid: (solid: CadSolidEntity | null) => void;
  updateAssembly: (components: AssemblyComponentItem[]) => void;
  updateCanonicalDocument: (doc: EngineeringDocument | null) => void;
  importProjectFile: (file: File) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<ProjectMetadata | null>(null);
  const [canonicalDocument, setCanonicalDocument] = useState<EngineeringDocument | null>(null);
  const [activeSolid, setActiveSolid] = useState<CadSolidEntity | null>(null);
  const [assemblyComponents, setAssemblyComponents] = useState<AssemblyComponentItem[]>([]);
  const [droneCamResult, setDroneCamResult] = useState<any | null>(null);

  const loadDemoProject = (demoId: string) => {
    try {
      const result = ProjectSessionManager.loadDemonstration(demoId);
      setActiveProject(result.metadata);
      setCanonicalDocument(result.document);
      setActiveSolid(result.activeSolid);
      setAssemblyComponents(result.assemblyData.components);
      setDroneCamResult(result.droneCamResult);
    } catch (error) {
      console.error('Failed to load demo project:', error);
    }
  };

  const createNewProject = (input: NewProjectInput) => {
    try {
      const result = ProjectSessionManager.createNewProject(input);
      setActiveProject(result.metadata);
      setCanonicalDocument(result.document);
      setActiveSolid(result.activeSolid);
      setAssemblyComponents(result.assemblyData.components);
      setDroneCamResult(result.droneCamResult);
    } catch (error) {
      console.error('Failed to create new project:', error);
    }
  };

  const openSavedProject = (projectId: string, savedProjects: any[]) => {
    const proj = savedProjects.find(p => p.id === projectId);
    if (proj) {
      // In a real app, we'd load the full document from storage
      // For now, we simulate by creating a clean session for that metadata
      setActiveProject({
        projectId: proj.id,
        documentId: `DOC_${proj.id}`,
        name: proj.name,
        projectNumber: proj.projectNumber,
        kind: 'USER_PROJECT',
        isReadOnly: false,
        type: proj.type,
        description: proj.description,
        unit: proj.units
      } as any);
      setCanonicalDocument(null);
      setActiveSolid(null);
      setAssemblyComponents([]);
      setDroneCamResult(null);
    }
  };

  const closeProject = () => {
    setActiveProject(null);
    setCanonicalDocument(null);
    setActiveSolid(null);
    setAssemblyComponents([]);
    setDroneCamResult(null);
    ProjectSessionManager.getCleanSessionState();
  };

  const updateActiveSolid = (solid: CadSolidEntity | null) => {
    setActiveSolid(solid);
  };

  const updateAssembly = (components: AssemblyComponentItem[]) => {
    setAssemblyComponents(components);
  };

  const updateCanonicalDocument = (doc: EngineeringDocument | null) => {
    setCanonicalDocument(doc);
  };

  const importProjectFile = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          if (data.metadata && (data.document || data.activeSolid)) {
            setActiveProject(data.metadata);
            setCanonicalDocument(data.document || null);
            setActiveSolid(data.activeSolid || null);
            setAssemblyComponents(data.assemblyData?.components || []);
            setDroneCamResult(data.droneCamResult || null);
            resolve();
          } else {
            reject(new Error('Invalid project file format'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  };

  return (
    <ProjectContext.Provider value={{
      activeProject,
      canonicalDocument,
      activeSolid,
      assemblyComponents,
      droneCamResult,
      loadDemoProject,
      createNewProject,
      openSavedProject,
      closeProject,
      updateActiveSolid,
      updateAssembly,
      updateCanonicalDocument,
      importProjectFile
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
