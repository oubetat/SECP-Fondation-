/**
 * SECP Engineering OS — Tool Context Resolver
 * Phase 3 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Assembles the canonical EngineeringToolContext for any given EngineeringDocument.
 * - Guarantees all 185 UI tools access the exact same SOT data pipeline.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { EngineeringToolContext } from './EngineeringToolContext';
import { CanonicalMetricsRegistry } from './CanonicalMetricsRegistry';
import { EngineeringDependencyGraph } from './EngineeringDependencyGraph';
import { DerivedArtifactRegistry } from './DerivedArtifactRegistry';
import { EngineeringEvidenceResolver } from './EngineeringEvidenceResolver';
import { TelemetryHasher } from './TelemetryHasher';

export class ToolContextResolver {
  public static createNullContext(): EngineeringToolContext {
    return {
      projectId: 'PRJ_NO_PROJECT',
      documentId: 'DOC_EMPTY',
      revision: 0,
      documentHash: '0000000000000000000000000000000000000000000000000000000000000000',
      canonicalDocument: null as any,
      geometry: {
        bodies: 0,
        solids: 0,
        faces: 0,
        edges: 0,
        vertices: 0,
        volume: 0,
        volumeCm3: 0,
        volumeMm3: 0,
        surfaceArea: 0,
        surfaceAreaCm2: 0,
        surfaceAreaMm2: 0,
        mass: 0,
        density: 2.7,
        materialName: 'None',
        boundingWidth: 0,
        boundingHeight: 0,
        boundingDepth: 0,
        geometryHash: 'EMPTY'
      },
      sketch: {
        totalSketches: 0,
        entitiesCount: 0,
        constraintsCount: 0,
        fullyConstrained: true,
        dof: 0,
        dimensionsCount: 0,
        residual: 0,
        revision: 0
      },
      assembly: {
        componentsCount: 0,
        jointsCount: 0,
        dof: 0,
        interferencesCount: 0,
        brokenReferencesCount: 0,
        revision: 0
      },
      fem: {
        meshElements: 0,
        nodes: 0,
        loadCases: 0,
        solverStatus: 'NOT_SOLVED',
        sourceRevision: 0,
        solvedRevision: 0
      },
      cfd: {
        meshCells: 0,
        nodes: 0,
        boundaryConditionsCount: 0,
        solverStatus: 'NOT_SOLVED',
        sourceRevision: 0,
        solvedRevision: 0
      },
      cam: {
        operationsCount: 0,
        estimatedCycleTimeSeconds: 0,
        materialRemovalVolumeCm3: 0,
        status: 'NOT_GENERATED',
        sourceRevision: 0,
        toolpathRevision: 0,
        gcodeBlockCount: 0
      },
      drawing: {
        viewsCount: 0,
        dimensionsCount: 0,
        status: 'NOT_GENERATED',
        sourceRevision: 0,
        drawingRevision: 0
      },
      bom: {
        lineItemsCount: 0,
        totalPartQuantity: 0,
        status: 'STALE',
        sourceRevision: 0,
        bomRevision: 0
      },
      dependencies: [],
      artifacts: [],
      evidence: [],
      invalidations: [],
      domainMetrics: {
        totalFeaturesCount: 0,
        totalParametersCount: 0,
        isSotValid: false,
        evalTimeMs: 0
      },
      authority: {
        source: 'CANONICAL',
        revision: 0,
        evalTimeMs: 0,
        isClean: true
      }
    };
  }

  public static resolveContext(
    doc: EngineeringDocument,
    activeSolid?: any,
    solvedStates?: {
      solvedFemRevision?: number;
      solvedCfdRevision?: number;
      toolpathCamRevision?: number;
      drawingRevision?: number;
      bomRevision?: number;
    }
  ): EngineeringToolContext {
    if (!doc) {
      return this.createNullContext();
    }

    const startTime = performance.now();
    const documentHash = doc.documentHash || TelemetryHasher.hashObject(doc);

    const geometry = CanonicalMetricsRegistry.computeGeometryMetrics(doc, activeSolid);
    const sketch = CanonicalMetricsRegistry.computeSketchMetrics(doc);
    const assembly = CanonicalMetricsRegistry.computeAssemblyMetrics(doc);
    const fem = CanonicalMetricsRegistry.computeFemMetrics(doc, solvedStates?.solvedFemRevision);
    const cfd = CanonicalMetricsRegistry.computeCfdMetrics(doc, solvedStates?.solvedCfdRevision);
    const cam = CanonicalMetricsRegistry.computeCamMetrics(doc, solvedStates?.toolpathCamRevision, geometry.volume);
    const drawing = CanonicalMetricsRegistry.computeDrawingMetrics(doc, solvedStates?.drawingRevision);
    const bom = CanonicalMetricsRegistry.computeBomMetrics(doc, solvedStates?.bomRevision);

    const dependencies = EngineeringDependencyGraph.buildGraph(doc, doc.revision);
    const artifacts = DerivedArtifactRegistry.getArtifactsForDocument(documentHash, doc.revision);
    const evidence = EngineeringEvidenceResolver.resolveEvidence(doc);
    const invalidations = EngineeringDependencyGraph.computeInvalidations(doc, doc.revision - 1, doc.revision);

    const evalTimeMs = performance.now() - startTime;

    return {
      projectId: doc.projectId || 'PRJ_DEFAULT',
      documentId: doc.documentId || 'DOC_DEFAULT',
      revision: doc.revision || 1,
      documentHash,
      canonicalDocument: doc,
      geometry,
      sketch,
      assembly,
      fem,
      cfd,
      cam,
      drawing,
      bom,
      dependencies,
      artifacts,
      evidence,
      invalidations,
      domainMetrics: {
        totalFeaturesCount: doc.features?.length || 0,
        totalParametersCount: doc.parameters?.length || 0,
        isSotValid: true,
        evalTimeMs
      },
      authority: {
        source: 'CANONICAL',
        revision: doc.revision || 1,
        evalTimeMs,
        isClean: true
      }
    };
  }
}
