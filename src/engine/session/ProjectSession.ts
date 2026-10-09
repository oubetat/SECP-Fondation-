/**
 * SECP Industrial OS v3 — Project Session Manager
 * Holds project-scoped state and ensures complete reset & session isolation
 */

import { SketchUIIntegration } from '../cad-kernel/ui-integration/SketchUIIntegration';
import { EngineeringDocument, DEFAULT_UNIT_SYSTEM_MM } from '../cad-kernel/document/CADDocument';

export interface ProjectMetadata {
  projectId: string;
  documentId: string;
  name: string;
  projectNumber: string;
  kind: 'DEMONSTRATION' | 'USER_PROJECT';
  isReadOnly: boolean;
  type: string;
  description: string;
  updatedAt?: string;
  lastModified?: string;
  forkedFromDemo?: string;
}

export interface NewProjectInput {
  name: string;
  projectNumber: string;
  type: string;
  unit: string;
  description: string;
  projectId?: string;
}

export interface ProjectSessionState {
  sessionId: string;
  projectId: string;
  activeRevisionId: string;
}

export interface SessionStatePayload {
  sessionState: 'NO_PROJECT' | 'PROJECT_OPEN';
  activeProjectMetadata: ProjectMetadata | null;
  canonicalDocument: EngineeringDocument | null;
  activeSolid: any | null;
  activeSketchId: string | null;
  assemblyData: {
    components: any[];
    mates: any[];
  };
  selectedCanonicalFace: any | null;
  selectedPartId: string | null;
  droneCamResult: any | null;
  explodedFactor: number;
  hiddenInstanceIds: string[];
  selectedEntityName: string;
}

export const OFFICIAL_DEMONSTRATIONS = [
  {
    id: 'demo-industrial-drone',
    projectNumber: 'DEMO-DRONE-001',
    unit: 'MILLIMETERS',
    name: 'Industrial Quadcopter Drone Reference Template',
    description: 'Carbon fiber quadcopter chassis with avionics and 5-axis CAM milling toolpaths.',
    tags: ['Hexacopter Drone', '5-Axis CAM', 'Aerospace B-Rep', 'CFD Rotor']
  },
  {
    id: 'demo-ball-valve',
    projectNumber: 'DEMO-VALVE-002',
    unit: 'MILLIMETERS',
    name: 'SolidWorks Industrial Ball Valve Reference Template',
    description: 'Brass high-fidelity ball valve assembly with flow simulation characteristics.',
    tags: ['Ball Valve', 'Fluid Simulation', 'Casting B-Rep', 'Mating Constraints']
  }
];

export class ProjectSession {
  private static activeSession: ProjectSessionState | null = null;

  public static getActiveSession(): ProjectSessionState | null {
    return this.activeSession;
  }

  public static setActiveSession(session: ProjectSessionState): void {
    this.activeSession = session;
  }
}

export class ProjectSessionManager {
  private static currentSession: SessionStatePayload | null = null;

  public static getCleanSessionState(): SessionStatePayload {
    const clean: SessionStatePayload = {
      sessionState: 'NO_PROJECT',
      activeProjectMetadata: null,
      canonicalDocument: null,
      activeSolid: null,
      activeSketchId: null,
      assemblyData: {
        components: [],
        mates: []
      },
      selectedCanonicalFace: null,
      selectedPartId: null,
      droneCamResult: null,
      explodedFactor: 0,
      hiddenInstanceIds: [],
      selectedEntityName: "Main Base Solid"
    };
    this.currentSession = clean;
    ProjectSession.setActiveSession({
      sessionId: 'IDLE_SESSION',
      projectId: 'NO_PROJECT',
      activeRevisionId: 'NO_REVISION'
    });
    return clean;
  }

  public static createNewProject(input: NewProjectInput): {
    metadata: ProjectMetadata;
    document: EngineeringDocument;
    activeSolid: any | null;
    assemblyData: { components: any[]; mates: any[] };
    droneCamResult: any | null;
  } {
    const projectId = input.projectId || ('PRJ_' + input.projectNumber + '_' + Math.floor(Math.random() * 1000000));
    const docId = 'DOC_' + input.projectNumber + '_' + Math.floor(Math.random() * 1000000);
    const timestamp = new Date().toISOString();

    const metadata: ProjectMetadata = {
      projectId,
      documentId: docId,
      name: input.name,
      projectNumber: input.projectNumber,
      kind: 'USER_PROJECT',
      isReadOnly: false,
      type: input.type,
      description: input.description,
      updatedAt: timestamp,
      lastModified: timestamp
    };

    const doc: EngineeringDocument = {
      documentId: docId,
      version: 1,
      revision: 'REV_v1',
      revisionId: 'REV_v1',
      units: {
        length: input.unit || 'mm',
        angle: 'deg'
      },
      header: {
        author: 'USER',
        organization: 'SECP',
        timestamp,
        description: input.description
      },
      shapes: [],
      assemblies: [],
      sketches: [],
      features: [],
      metadata: {
        projectId,
        projectNumber: input.projectNumber,
        description: input.description,
        unit: input.unit,
        name: input.name
      }
    };

    const sessionResult = {
      metadata,
      document: doc,
      activeSolid: null,
      assemblyData: {
        components: [],
        mates: []
      },
      droneCamResult: null
    };

    this.currentSession = {
      sessionState: 'PROJECT_OPEN',
      activeProjectMetadata: metadata,
      canonicalDocument: doc,
      activeSolid: null,
      activeSketchId: null,
      assemblyData: { components: [], mates: [] },
      selectedCanonicalFace: null,
      selectedPartId: null,
      droneCamResult: null,
      explodedFactor: 0,
      hiddenInstanceIds: [],
      selectedEntityName: "Main Base Solid"
    };

    ProjectSession.setActiveSession({
      sessionId: 'SESSION_' + projectId,
      projectId,
      activeRevisionId: 'REV_v1'
    });

    return sessionResult;
  }

  public static loadDemonstration(demoId: string, resolver?: any): {
    metadata: ProjectMetadata;
    document: EngineeringDocument;
    activeSolid: any | null;
    assemblyData: { components: any[]; mates: any[] };
    droneCamResult: any | null;
  } {
    const demoSpec = OFFICIAL_DEMONSTRATIONS.find(d => d.id === demoId);
    if (!demoSpec) {
      throw new Error(`Demonstration with ID "${demoId}" not found in registry.`);
    }

    const timestamp = new Date().toISOString();
    let evaluationResult: any;

    if (demoId === 'demo-industrial-drone') {
      evaluationResult = SketchUIIntegration.createIndustrialDroneDocument('DOC_DRONE_001');
    } else if (demoId === 'demo-ball-valve') {
      evaluationResult = SketchUIIntegration.createValveDocument('DOC_VALVE_001');
    } else {
      throw new Error(`Unknown demonstration reference: ${demoId}`);
    }

    const doc = evaluationResult.document;
    const metadata: ProjectMetadata = {
      projectId: demoId,
      documentId: doc.documentId,
      name: doc.metadata?.name || demoSpec.name,
      projectNumber: doc.metadata?.projectNumber || 'DEMO-REF',
      kind: 'DEMONSTRATION',
      isReadOnly: true,
      type: demoId === 'demo-industrial-drone' ? 'INDUSTRIAL_DRONE' : 'BALL_VALVE',
      description: doc.metadata?.description || demoSpec.description,
      updatedAt: timestamp,
      lastModified: timestamp
    };

    // Ensure sketches and features arrays exist
    if (!doc.sketches) doc.sketches = [];
    if (!doc.features) doc.features = [];

    // Extract assembly components and mates if present in doc.assembly
    const components = doc.assembly?.instances || [];
    const mates = doc.assembly?.mates || [];

    const sessionResult = {
      metadata,
      document: doc,
      activeSolid: evaluationResult.activeSolid || doc.derived?.solid || null,
      assemblyData: {
        components,
        mates
      },
      droneCamResult: evaluationResult.droneCamResult || null
    };

    this.currentSession = {
      sessionState: 'PROJECT_OPEN',
      activeProjectMetadata: metadata,
      canonicalDocument: doc,
      activeSolid: sessionResult.activeSolid,
      activeSketchId: null,
      assemblyData: sessionResult.assemblyData,
      selectedCanonicalFace: null,
      selectedPartId: null,
      droneCamResult: sessionResult.droneCamResult,
      explodedFactor: 0,
      hiddenInstanceIds: [],
      selectedEntityName: "Main Base Solid"
    };

    ProjectSession.setActiveSession({
      sessionId: 'SESSION_' + demoId,
      projectId: demoId,
      activeRevisionId: doc.revisionId || 'REV_v1'
    });

    if (resolver && typeof resolver.register === 'function') {
      resolver.register(doc);
    }

    return sessionResult;
  }

  public static createProjectFromDemo(
    demoId: string,
    input: { name: string; projectNumber: string; description: string }
  ): {
    metadata: ProjectMetadata;
    document: EngineeringDocument;
    activeSolid: any | null;
    assemblyData: { components: any[]; mates: any[] };
    droneCamResult: any | null;
  } {
    const demo = this.loadDemonstration(demoId);
    const projectId = 'PRJ_' + input.projectNumber + '_' + Math.floor(Math.random() * 1000000);
    const docId = 'DOC_' + input.projectNumber + '_' + Math.floor(Math.random() * 1000000);
    const timestamp = new Date().toISOString();

    const metadata: ProjectMetadata = {
      projectId,
      documentId: docId,
      name: input.name,
      projectNumber: input.projectNumber,
      kind: 'USER_PROJECT',
      isReadOnly: false,
      type: demo.metadata.type,
      description: input.description,
      updatedAt: timestamp,
      lastModified: timestamp,
      forkedFromDemo: demoId
    };

    // Deep clone the document
    const clonedDoc: EngineeringDocument = JSON.parse(JSON.stringify(demo.document));
    clonedDoc.documentId = docId;
    clonedDoc.metadata = {
      ...clonedDoc.metadata,
      projectId,
      projectNumber: input.projectNumber,
      description: input.description,
      forkedFromDemo: demoId,
      name: input.name
    };

    // Also fix any subcomponents' document ID references if applicable
    if (clonedDoc.assembly?.instances) {
      clonedDoc.assembly.instances.forEach((inst: any) => {
        inst.documentId = docId;
      });
    }

    const sessionResult = {
      metadata,
      document: clonedDoc,
      activeSolid: demo.activeSolid,
      assemblyData: {
        components: clonedDoc.assembly?.instances || [],
        mates: clonedDoc.assembly?.mates || []
      },
      droneCamResult: demo.droneCamResult
    };

    this.currentSession = {
      sessionState: 'PROJECT_OPEN',
      activeProjectMetadata: metadata,
      canonicalDocument: clonedDoc,
      activeSolid: sessionResult.activeSolid,
      activeSketchId: null,
      assemblyData: sessionResult.assemblyData,
      selectedCanonicalFace: null,
      selectedPartId: null,
      droneCamResult: sessionResult.droneCamResult,
      explodedFactor: 0,
      hiddenInstanceIds: [],
      selectedEntityName: "Main Base Solid"
    };

    ProjectSession.setActiveSession({
      sessionId: 'SESSION_' + projectId,
      projectId,
      activeRevisionId: clonedDoc.revisionId || 'REV_v1'
    });

    return sessionResult;
  }
}
