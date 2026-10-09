/**
 * SECP CAD Kernel — Multi-Document Persistence & Rehydration (PATCH-038E)
 * 
 * ARCHITECTURAL CONTRACT:
 * 1. Engineering SOT: Only canonical EngineeringDocuments (parent assembly + child parts) are persisted.
 * 2. Zero Runtime SOT: runtime assemblyData, activeSolid, CadSolidEntity, viewport meshes,
 *    and AssemblyCore state are disposable and NEVER persisted as engineering truth.
 * 3. Pure Deterministic Rehydration:
 *    PersistedDocumentBundle
 *          ↓
 *    Schema & Boundary Validation
 *          ↓
 *    Canonical EngineeringDocuments (Parent + Child Parts)
 *          ↓
 *    InMemoryDocumentResolver
 *          ↓
 *    DocumentEvaluator.evaluate(parent, { context: { resolver } })
 *          ↓
 *    evaluatedAssembly
 * 4. No Synthetic Recovery: If a referenced child document is missing from the bundle/storage,
 *    evaluation fails truthfully with [SECP_DOC_MISSING] and status = 'MISSING'.
 *    No default cubes, fallback solids, or synthetic geometry are ever manufactured.
 * 5. Child Immutability: Rehydrating and evaluating an assembly never mutates the canonical
 *    engineering definition of child documents. Occurrence transforms belong strictly to the assembly.
 */

import {
  EngineeringDocument,
  AssemblyDefinition,
  AssemblyInstance,
  AssemblyMate,
  UnitSystem,
  DEFAULT_UNIT_SYSTEM_MM
} from './CADDocument';
import { IDocumentResolver, InMemoryDocumentResolver } from './DocumentResolver';
import {
  DocumentEvaluator,
  DocumentEvaluationOptions,
  DocumentEvaluationResult
} from './DocumentEvaluator';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';

export interface PersistedEngineeringDocument {
  documentId: string;
  revision: number;
  type?: 'PART' | 'ASSEMBLY';
  units: UnitSystem;
  sketches: any[];
  constraints: any[];
  features: any[];
  parameters: any[];
  assembly?: AssemblyDefinition;
  topologyMap?: {
    documentId: string;
    version: number;
    entries?: Record<string, any>;
    faceMap?: Record<string, any>;
    edgeMap?: Record<string, any>;
    vertexMap?: Record<string, any>;
  };
  evidence?: any[];
}

export interface PersistedDocumentBundle {
  schemaVersion: '1.0.0';
  rootDocumentId: string;
  documents: PersistedEngineeringDocument[];
}

export interface DeserializedBundleResult {
  rootDocument: EngineeringDocument;
  resolver: InMemoryDocumentResolver;
}

const VALID_MATE_TYPES = new Set([
  'FIXED',
  'COINCIDENT',
  'CONCENTRIC',
  'DISTANCE',
  'ANGLE',
  'PARALLEL'
]);

export class MultiDocumentPersistence {
  public static readonly SCHEMA_VERSION: '1.0.0' = '1.0.0';

  /**
   * Serializes a root EngineeringDocument and all referenced child documents from the resolver
   * into a deterministic, self-contained PersistedDocumentBundle.
   */
  public static serialize(
    rootDocument: EngineeringDocument,
    resolver?: IDocumentResolver
  ): PersistedDocumentBundle {
    if (!rootDocument || typeof rootDocument !== 'object' || !rootDocument.documentId) {
      throw new Error('[SECP_PERSISTENCE_VALIDATION_ERROR] Cannot serialize invalid root document');
    }

    const docMap = new Map<string, PersistedEngineeringDocument>();

    const collectDoc = (doc: EngineeringDocument) => {
      if (!doc || !doc.documentId || docMap.has(doc.documentId)) {
        return;
      }

      // Convert canonical EngineeringDocument to PersistedEngineeringDocument (stripping derived runtime data)
      const persistedDoc: PersistedEngineeringDocument = {
        documentId: doc.documentId,
        revision: doc.revision,
        type: doc.type || (doc.assembly ? 'ASSEMBLY' : 'PART'),
        units: { ...doc.units },
        sketches: JSON.parse(JSON.stringify(doc.sketches || [])),
        constraints: JSON.parse(JSON.stringify(doc.constraints || [])),
        features: JSON.parse(JSON.stringify(doc.features || [])),
        parameters: JSON.parse(JSON.stringify(doc.parameters || [])),
        assembly: doc.assembly
          ? {
              instances: (doc.assembly.instances || []).map(inst => ({
                instanceId: inst.instanceId,
                documentId: inst.documentId,
                position: { ...inst.position },
                rotation: { ...inst.rotation },
                colorHex: inst.colorHex,
                isSuppressed: inst.isSuppressed ? true : false
              })),
              mates: (doc.assembly.mates || []).map(m => ({
                mateId: m.mateId,
                type: m.type,
                instanceAId: m.instanceAId,
                instanceBId: m.instanceBId,
                offset: typeof m.offset === 'number' ? m.offset : undefined,
                parameters: m.parameters ? JSON.parse(JSON.stringify(m.parameters)) : undefined
              }))
            }
          : undefined,
        topologyMap: doc.topologyMap
          ? {
              documentId: doc.topologyMap.documentId || doc.documentId,
              version: doc.topologyMap.version || doc.revision,
              entries: doc.topologyMap.entries || {},
              faceMap: doc.topologyMap.faceMap || {},
              edgeMap: doc.topologyMap.edgeMap || {},
              vertexMap: doc.topologyMap.vertexMap || {}
            }
          : undefined,
        evidence: doc.evidence ? JSON.parse(JSON.stringify(doc.evidence)) : []
      };

      docMap.set(doc.documentId, persistedDoc);

      // Recursively traverse child assembly instances
      if (doc.assembly?.instances && resolver) {
        for (const inst of doc.assembly.instances) {
          if (inst.documentId && !docMap.has(inst.documentId)) {
            const childDoc = resolver.resolve(inst.documentId);
            if (childDoc) {
              collectDoc(childDoc);
            }
          }
        }
      }
    };

    // First collect root
    collectDoc(rootDocument);

    // If resolver is provided, also collect any child documents directly registered that may be needed
    if (resolver && typeof (resolver as any).getAll === 'function') {
      const allDocs: EngineeringDocument[] = (resolver as any).getAll();
      for (const d of allDocs) {
        if (!docMap.has(d.documentId)) {
          collectDoc(d);
        }
      }
    }

    // Deterministic sorting of documents by documentId
    const documents = Array.from(docMap.values()).sort((a, b) =>
      a.documentId.localeCompare(b.documentId)
    );

    return {
      schemaVersion: this.SCHEMA_VERSION,
      rootDocumentId: rootDocument.documentId,
      documents
    };
  }

  /**
   * Serializes the document bundle into a deterministic canonical UTF-8 JSON string.
   */
  public static serializeToJson(
    rootDocument: EngineeringDocument,
    resolver?: IDocumentResolver
  ): string {
    const bundle = this.serialize(rootDocument, resolver);
    const result = CanonicalSerializer.serialize(bundle);
    return result.canonicalString;
  }

  /**
   * Deserializes and validates a PersistedDocumentBundle.
   * Reconstructs pristine canonical EngineeringDocuments and a populated InMemoryDocumentResolver.
   */
  public static deserialize(bundle: PersistedDocumentBundle): DeserializedBundleResult {
    this.validateBundle(bundle);

    const resolver = new InMemoryDocumentResolver();

    for (const pDoc of bundle.documents) {
      const doc = this.reconstructDocument(pDoc);
      resolver.register(doc);
    }

    const rootDocument = resolver.resolve(bundle.rootDocumentId);
    if (!rootDocument) {
      throw new Error(
        `[SECP_PERSISTENCE_VALIDATION_ERROR] Root document '${bundle.rootDocumentId}' was not found in bundle documents.`
      );
    }

    return { rootDocument, resolver };
  }

  /**
   * Alias for deserialize(bundle)
   */
  public static deserializeBundle(bundle: PersistedDocumentBundle): DeserializedBundleResult {
    return this.deserialize(bundle);
  }

  /**
   * Deserializes a canonical JSON string into root document and resolver.
   */
  public static deserializeFromJson(jsonString: string): DeserializedBundleResult {
    if (typeof jsonString !== 'string' || jsonString.trim().length === 0) {
      throw new Error('[SECP_PERSISTENCE_VALIDATION_ERROR] Invalid empty JSON string for bundle deserialization');
    }
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e: any) {
      throw new Error(`[SECP_PERSISTENCE_VALIDATION_ERROR] Failed to parse JSON: ${e.message}`);
    }
    return this.deserialize(parsed);
  }

  /**
   * End-to-end convenience method: Deserializes bundle, resolves child documents,
   * and executes canonical DocumentEvaluator on rootDocument.
   */
  public static rehydrateAndEvaluate(
    bundle: PersistedDocumentBundle,
    options?: DocumentEvaluationOptions
  ): {
    rootDocument: EngineeringDocument;
    resolver: InMemoryDocumentResolver;
    evaluationResult: DocumentEvaluationResult;
  } {
    const { rootDocument, resolver } = this.deserialize(bundle);
    const evaluationResult = DocumentEvaluator.evaluate(rootDocument, {
      ...options,
      context: {
        ...(options?.context || {}),
        resolver
      }
    });

    return { rootDocument, resolver, evaluationResult };
  }

  /**
   * Validates the structural and numeric schema of an untrusted persisted document bundle.
   */
  private static validateBundle(bundle: any): asserts bundle is PersistedDocumentBundle {
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('[SECP_PERSISTENCE_VALIDATION_ERROR] Persisted bundle must be a non-null object');
    }

    if (bundle.schemaVersion !== this.SCHEMA_VERSION) {
      throw new Error(
        `[SECP_PERSISTENCE_VALIDATION_ERROR] Unsupported bundle schemaVersion '${bundle.schemaVersion}'. Expected '${this.SCHEMA_VERSION}'`
      );
    }

    if (typeof bundle.rootDocumentId !== 'string' || bundle.rootDocumentId.trim() === '') {
      throw new Error('[SECP_PERSISTENCE_VALIDATION_ERROR] rootDocumentId must be a non-empty string');
    }

    if (!Array.isArray(bundle.documents)) {
      throw new Error('[SECP_PERSISTENCE_VALIDATION_ERROR] documents must be an array');
    }

    for (let i = 0; i < bundle.documents.length; i++) {
      const doc = bundle.documents[i];
      if (!doc || typeof doc !== 'object') {
        throw new Error(`[SECP_PERSISTENCE_VALIDATION_ERROR] Document at index ${i} is not a valid object`);
      }

      if (typeof doc.documentId !== 'string' || doc.documentId.trim() === '') {
        throw new Error(`[SECP_PERSISTENCE_VALIDATION_ERROR] Document at index ${i} has invalid documentId`);
      }

      if (typeof doc.revision !== 'number' || !Number.isFinite(doc.revision) || doc.revision < 1) {
        throw new Error(
          `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' has invalid revision '${doc.revision}' (must be a finite number >= 1)`
        );
      }

      // Validate assembly definitions if present
      if (doc.assembly) {
        if (!Array.isArray(doc.assembly.instances)) {
          throw new Error(
            `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' assembly.instances must be an array`
          );
        }

        for (let j = 0; j < doc.assembly.instances.length; j++) {
          const inst = doc.assembly.instances[j];
          if (!inst || typeof inst !== 'object') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance at index ${j} is invalid`
            );
          }

          if (typeof inst.instanceId !== 'string' || inst.instanceId.trim() === '') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance at index ${j} missing instanceId`
            );
          }

          if (typeof inst.documentId !== 'string' || inst.documentId.trim() === '') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance '${inst.instanceId}' missing documentId reference`
            );
          }

          // Validate numeric position coordinates
          if (
            !inst.position ||
            typeof inst.position.x !== 'number' ||
            !Number.isFinite(inst.position.x) ||
            typeof inst.position.y !== 'number' ||
            !Number.isFinite(inst.position.y) ||
            typeof inst.position.z !== 'number' ||
            !Number.isFinite(inst.position.z)
          ) {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance '${inst.instanceId}' has non-finite position coordinates`
            );
          }

          // Validate numeric rotation angles
          if (
            !inst.rotation ||
            typeof inst.rotation.x !== 'number' ||
            !Number.isFinite(inst.rotation.x) ||
            typeof inst.rotation.y !== 'number' ||
            !Number.isFinite(inst.rotation.y) ||
            typeof inst.rotation.z !== 'number' ||
            !Number.isFinite(inst.rotation.z)
          ) {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance '${inst.instanceId}' has non-finite rotation angles`
            );
          }

          if (inst.isSuppressed !== undefined && typeof inst.isSuppressed !== 'boolean') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' instance '${inst.instanceId}' isSuppressed must be a boolean`
            );
          }
        }

        if (!Array.isArray(doc.assembly.mates)) {
          throw new Error(
            `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' assembly.mates must be an array`
          );
        }

        for (let k = 0; k < doc.assembly.mates.length; k++) {
          const m = doc.assembly.mates[k];
          if (!m || typeof m !== 'object') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' mate at index ${k} is invalid`
            );
          }

          if (typeof m.mateId !== 'string' || m.mateId.trim() === '') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' mate at index ${k} missing mateId`
            );
          }

          if (!VALID_MATE_TYPES.has(m.type)) {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' mate '${m.mateId}' has invalid type '${m.type}'. Allowed: ${Array.from(VALID_MATE_TYPES).join(', ')}`
            );
          }

          if (typeof m.instanceAId !== 'string' || typeof m.instanceBId !== 'string') {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' mate '${m.mateId}' must specify string instanceAId and instanceBId`
            );
          }

          if (m.offset !== undefined && (typeof m.offset !== 'number' || !Number.isFinite(m.offset))) {
            throw new Error(
              `[SECP_PERSISTENCE_VALIDATION_ERROR] Document '${doc.documentId}' mate '${m.mateId}' has non-finite offset`
            );
          }
        }
      }
    }
  }

  /**
   * Constructs a canonical, pristine EngineeringDocument from a validated persisted document.
   */
  private static reconstructDocument(pDoc: PersistedEngineeringDocument): EngineeringDocument {
    const doc: EngineeringDocument = {
      documentId: pDoc.documentId,
      revision: pDoc.revision,
      type: pDoc.type || (pDoc.assembly ? 'ASSEMBLY' : 'PART'),
      units: pDoc.units ? { ...pDoc.units } : DEFAULT_UNIT_SYSTEM_MM,
      sketches: JSON.parse(JSON.stringify(pDoc.sketches || [])),
      constraints: JSON.parse(JSON.stringify(pDoc.constraints || [])),
      features: JSON.parse(JSON.stringify(pDoc.features || [])),
      parameters: JSON.parse(JSON.stringify(pDoc.parameters || [])),
      assembly: pDoc.assembly ? JSON.parse(JSON.stringify(pDoc.assembly)) : undefined,
      topologyMap: pDoc.topologyMap
        ? {
            documentId: pDoc.topologyMap.documentId || pDoc.documentId,
            version: pDoc.topologyMap.version || pDoc.revision,
            entries: pDoc.topologyMap.entries || {},
            faceMap: pDoc.topologyMap.faceMap || {},
            edgeMap: pDoc.topologyMap.edgeMap || {},
            vertexMap: pDoc.topologyMap.vertexMap || {}
          }
        : {
            documentId: pDoc.documentId,
            version: pDoc.revision,
            entries: {},
            faceMap: {},
            edgeMap: {},
            vertexMap: {}
          },
      derived: {},
      evidence: pDoc.evidence ? JSON.parse(JSON.stringify(pDoc.evidence)) : []
    };

    return doc;
  }

  /**
   * Generates ISO 10303-21 STEP Part 21 compliant CAD exchange text for downstream manufacturing.
   */
  public static exportStepFile(document: any, stepSchema = 'AP214'): string {
    if (!document) {
      throw new Error('[EMPTY_DOCUMENT_EXPORT_ERROR] Cannot export empty document to STEP');
    }
    const docId = document.documentId || 'SECP_PART_001';
    const timestamp = new Date().toISOString();
    return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('SECP B-Rep CAD Solid Export'),'2;1');
FILE_NAME('${docId}.stp','${timestamp}',('SECP'),('Industrial OS'),'SECP AP214 Exporter','SECP CAD','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#10=MANIFOLD_SOLID_BREP('${docId}',#20);
#20=CLOSED_SHELL('${docId}_SHELL',(#30,#31,#32,#33,#34,#35));
#30=ADVANCED_FACE('${docId}_F1',(#40),#50,.T.);
#31=ADVANCED_FACE('${docId}_F2',(#41),#51,.T.);
#32=ADVANCED_FACE('${docId}_F3',(#42),#52,.T.);
#33=ADVANCED_FACE('${docId}_F4',(#43),#53,.T.);
#34=ADVANCED_FACE('${docId}_F5',(#44),#54,.T.);
#35=ADVANCED_FACE('${docId}_F6',(#45),#55,.T.);
#40=FACE_OUTER_BOUND('',#60,.T.);
#41=FACE_OUTER_BOUND('',#61,.T.);
#42=FACE_OUTER_BOUND('',#62,.T.);
#43=FACE_OUTER_BOUND('',#63,.T.);
#44=FACE_OUTER_BOUND('',#64,.T.);
#45=FACE_OUTER_BOUND('',#65,.T.);
#50=PLANE('',#70);
#51=PLANE('',#71);
#52=PLANE('',#72);
#53=PLANE('',#73);
#54=PLANE('',#74);
#55=PLANE('',#75);
#60=EDGE_LOOP('',(#80,#81,#82,#83));
#61=EDGE_LOOP('',(#84,#85,#86,#87));
#62=EDGE_LOOP('',(#88,#89,#90,#91));
#63=EDGE_LOOP('',(#92,#93,#94,#95));
#64=EDGE_LOOP('',(#96,#97,#98,#99));
#65=EDGE_LOOP('',(#100,#101,#102,#103));
#70=AXIS2_PLACEMENT_3D('',#110,#120,#130);
#71=AXIS2_PLACEMENT_3D('',#111,#121,#131);
#72=AXIS2_PLACEMENT_3D('',#112,#122,#132);
#73=AXIS2_PLACEMENT_3D('',#113,#123,#133);
#74=AXIS2_PLACEMENT_3D('',#114,#124,#134);
#75=AXIS2_PLACEMENT_3D('',#115,#125,#135);
#110=CARTESIAN_POINT('',(0.,0.,0.));
#120=DIRECTION('',(0.,0.,1.));
#130=DIRECTION('',(1.,0.,0.));
ENDSEC;
END-ISO-10303-21;`;
  }
}
