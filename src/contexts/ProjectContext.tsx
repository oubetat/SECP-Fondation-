import React, { createContext, useContext, useState, useEffect } from 'react';
import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { ProjectMetadata, NewProjectInput, ProjectSessionManager } from '../engine/session/ProjectSession';
import { CadSolidEntity } from '../engine/cadKernel';
import { AssemblyComponentItem } from '../engine/assembly';
import { 
  UniversalDigitalThread, 
  UniversalDigitalThreadEngine,
  ThreadNode
} from '../engine/verification/UniversalDigitalThreadEngine';

interface ProjectContextType {
  activeProject: ProjectMetadata | null;
  canonicalDocument: EngineeringDocument | null;
  activeSolid: CadSolidEntity | null;
  assemblyComponents: AssemblyComponentItem[];
  droneCamResult: any | null;
  digitalThread: UniversalDigitalThread | null;
  
  loadDemoProject: (demoId: string) => void;
  createNewProject: (input: NewProjectInput) => void;
  openSavedProject: (projectId: string, savedProjects: any[]) => void;
  closeProject: () => void;
  updateActiveSolid: (solid: CadSolidEntity | null) => void;
  updateAssembly: (components: AssemblyComponentItem[]) => void;
  updateCanonicalDocument: (doc: EngineeringDocument | null) => void;
  importProjectFile: (file: File) => Promise<void>;
  updateDigitalThread: (thread: UniversalDigitalThread) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<ProjectMetadata | null>(null);
  const [canonicalDocument, setCanonicalDocument] = useState<EngineeringDocument | null>(null);
  const [activeSolid, setActiveSolid] = useState<CadSolidEntity | null>(null);
  const [assemblyComponents, setAssemblyComponents] = useState<AssemblyComponentItem[]>([]);
  const [droneCamResult, setDroneCamResult] = useState<any | null>(null);
  const [digitalThread, setDigitalThread] = useState<UniversalDigitalThread | null>(null);

  // Sync Digital Thread with Canonical Document on load
  useEffect(() => {
    if (canonicalDocument && !digitalThread) {
      const cadNode: ThreadNode = {
        id: canonicalDocument.documentId,
        type: 'CAD_REVISION',
        name: canonicalDocument.title || canonicalDocument.name || 'CAD Root',
        revision: String(canonicalDocument.revision || 'v1.0.0'),
        metadata: { 
          geometryHash: canonicalDocument.derived?.geometryHash,
          documentHash: canonicalDocument.documentHash 
        },
        upstreamDependencies: []
      };

      const initialThread = UniversalDigitalThreadEngine.createThread(
        `THREAD-${activeProject?.projectId || 'GLOBAL'}`,
        activeProject?.type || 'INDUSTRIAL',
        [cadNode]
      );
      setDigitalThread(initialThread);
    }
  }, [canonicalDocument, activeProject, digitalThread]);

  const loadDemoProject = (demoId: string) => {
    try {
      const result = ProjectSessionManager.loadDemonstration(demoId);
      setActiveProject(result.metadata);
      setCanonicalDocument(result.document);
      setActiveSolid(result.activeSolid);
      setAssemblyComponents(result.assemblyData.components);
      setDroneCamResult(result.droneCamResult);
      setDigitalThread(null); // Reset to trigger re-sync
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
      setDigitalThread(null); // Reset
    } catch (error) {
      console.error('Failed to create new project:', error);
    }
  };

  const openSavedProject = (projectId: string, savedProjects: any[]) => {
    const proj = savedProjects.find(p => p.id === projectId);
    if (proj) {
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
      setDigitalThread(null);
    }
  };

  const closeProject = () => {
    setActiveProject(null);
    setCanonicalDocument(null);
    setActiveSolid(null);
    setAssemblyComponents([]);
    setDroneCamResult(null);
    setDigitalThread(null);
    ProjectSessionManager.getCleanSessionState();
  };

  const updateActiveSolid = (solid: CadSolidEntity | null) => {
    setActiveSolid(solid);
  };

  const updateAssembly = (components: AssemblyComponentItem[]) => {
    setAssemblyComponents(components);
  };

  const updateCanonicalDocument = (doc: EngineeringDocument | null) => {
    if (doc && digitalThread) {
      // Propagate change to digital thread
      const updatedThread = UniversalDigitalThreadEngine.propagateChange(
        digitalThread,
        doc.documentId,
        String(doc.revision),
        doc.derived?.geometryHash
      );
      setDigitalThread(updatedThread);
    }
    setCanonicalDocument(doc);
  };

  const updateDigitalThread = (thread: UniversalDigitalThread) => {
    setDigitalThread(thread);
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
            setDigitalThread(null);
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
      digitalThread,
      loadDemoProject,
      createNewProject,
      openSavedProject,
      closeProject,
      updateActiveSolid,
      updateAssembly,
      updateCanonicalDocument,
      importProjectFile,
      updateDigitalThread
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
