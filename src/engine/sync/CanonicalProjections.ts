/**
 * SECP Industrial OS v3 — PROMPT-054: Canonical Projections Layer
 * Pure, deterministic, revision-aware projections derived directly from EngineeringDocument.
 *
 * ARCHITECTURAL RULE:
 * - Projections are READ-ONLY views of the canonical EngineeringDocument.
 * - Zero local React state for engineering parameters or geometry.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import {
  FeatureTreeProjectionItem,
  PropertiesProjection,
  PropertyItem,
  ViewportGeometryProjection,
  SelectionReference,
  SelectionProjection,
  EvidenceProjection,
  DerivedStatusProjection
} from './SyncTypes';

export class CanonicalProjections {
  /**
   * Derives Feature Tree Projection from canonical document features and sketches.
   */
  public static deriveFeatureTree(doc: EngineeringDocument): FeatureTreeProjectionItem[] {
    const items: FeatureTreeProjectionItem[] = [];

    // 1. Map Sketches
    if (doc.sketches) {
      doc.sketches.forEach(sketch => {
        items.push({
          id: sketch.id,
          featureId: sketch.id,
          documentId: doc.documentId,
          documentRevision: doc.revision,
          name: sketch.name || `Sketch_${sketch.id}`,
          type: 'SKETCH',
          suppressed: false,
          active: false,
          children: [],
          dependencies: [],
          regenerationState: 'VALID',
          validationStatus: 'VALID',
          evidenceHash: `EPC-SKT-${sketch.id.substring(0, 4)}`
        });
      });
    }

    // 2. Map Features
    if (doc.features) {
      doc.features.forEach((feature: any) => {
        const featureId = feature.featureId || feature.id;
        const type = feature.type || 'FEATURE';
        const name = feature.name || `${type}_${featureId.substring(0, 4)}`;
        const suppressed = feature.suppressed ?? false;
        const regState = feature.regenerationStatus || 'VALID';
        const valStatus = feature.status || 'VALID';

        items.push({
          id: featureId,
          featureId,
          documentId: doc.documentId,
          documentRevision: doc.revision,
          name,
          type,
          suppressed,
          active: false,
          children: feature.children || [],
          dependencies: feature.dependencyIds || feature.dependencies || [],
          regenerationState: regState,
          validationStatus: valStatus,
          evidenceHash: feature.definitionHash
            ? `EPC-FEAT-${feature.definitionHash.substring(0, 6)}`
            : `EPC-FEAT-${featureId.substring(0, 4)}`
        });
      });
    }

    return items;
  }

  /**
   * Derives Properties Projection for selected feature or document parameters.
   */
  public static deriveProperties(
    doc: EngineeringDocument,
    selectedFeatureId?: string
  ): PropertiesProjection {
    const items: PropertyItem[] = [];

    // 1. Add Document Global Driving Parameters
    if (doc.parameters) {
      doc.parameters.forEach(p => {
        items.push({
          id: p.id,
          name: p.name,
          value: p.value,
          unit: p.unit || doc.units?.length || 'mm',
          expression: p.expression,
          isDriving: p.isDriving ?? true,
          documentRevision: doc.revision
        });
      });
    }

    // 2. Add Selected Feature Parameters
    if (selectedFeatureId && doc.features) {
      const feat = doc.features.find((f: any) => (f.featureId || f.id) === selectedFeatureId);
      if (feat) {
        const params = feat.parameters || feat.definition?.parameters || {};
        Object.entries(params).forEach(([key, val]) => {
          items.push({
            id: `PARAM-${selectedFeatureId}-${key}`,
            name: `${feat.name || 'Feature'} -> ${key}`,
            value: typeof val === 'object' && val !== null ? JSON.stringify(val) : val,
            unit: doc.units?.length || 'mm',
            documentRevision: doc.revision,
            sourceFeatureId: selectedFeatureId
          });
        });
      }
    }

    return {
      documentId: doc.documentId,
      documentRevision: doc.revision,
      selectedFeatureId,
      items
    };
  }

  /**
   * Derives Viewport Geometry Projection from canonical evaluated shape / mesh.
   */
  public static deriveViewport(doc: EngineeringDocument): ViewportGeometryProjection {
    const mesh = doc.derived?.mesh;
    const bRepHash = doc.topologyMap?.hashes?.geometryHash || (doc.evaluatedShape as any)?.id;

    let faces = 0;
    let edges = 0;
    let vertices = 0;
    let solids = doc.evaluatedShape ? 1 : 0;

    if (doc.evaluatedShape && (doc.evaluatedShape as any).outerShell) {
      const shell = (doc.evaluatedShape as any).outerShell;
      faces = shell.orientedFaces?.length || 0;
    }

    return {
      documentId: doc.documentId,
      documentRevision: doc.revision,
      mesh,
      bRepHash,
      isStale: false,
      topologyCount: {
        solids,
        faces,
        edges,
        vertices
      }
    };
  }

  /**
   * Reconciles UI selection against new canonical document topology.
   */
  public static reconcileSelection(
    doc: EngineeringDocument,
    currentSelection?: SelectionReference
  ): SelectionProjection {
    if (!currentSelection) {
      return {
        documentId: doc.documentId,
        documentRevision: doc.revision,
        selectionStatus: 'EMPTY'
      };
    }

    // Check if selected feature exists in doc
    if (currentSelection.entityType === 'FEATURE' && currentSelection.featureId) {
      const featureExists = doc.features?.some(
        (f: any) => (f.featureId || f.id) === currentSelection.featureId
      );
      if (featureExists) {
        return {
          documentId: doc.documentId,
          documentRevision: doc.revision,
          selectedEntity: {
            ...currentSelection,
            documentRevision: doc.revision
          },
          selectionStatus: 'VALID'
        };
      } else {
        return {
          documentId: doc.documentId,
          documentRevision: doc.revision,
          selectionStatus: 'INVALIDATED',
          reason: `Target feature '${currentSelection.featureId}' was removed in revision ${doc.revision}.`
        };
      }
    }

    // Check topology references in doc topologyMap
    const faceMap = doc.topologyMap?.faceMap || {};
    const edgeMap = doc.topologyMap?.edgeMap || {};
    const vertexMap = doc.topologyMap?.vertexMap || {};

    const isTopologyValid =
      Object.values(faceMap).includes(currentSelection.topologyId) ||
      Object.values(edgeMap).includes(currentSelection.topologyId) ||
      Object.values(vertexMap).includes(currentSelection.topologyId);

    if (isTopologyValid) {
      return {
        documentId: doc.documentId,
        documentRevision: doc.revision,
        selectedEntity: {
          ...currentSelection,
          documentRevision: doc.revision
        },
        selectionStatus: 'VALID'
      };
    }

    return {
      documentId: doc.documentId,
      documentRevision: doc.revision,
      selectionStatus: 'INVALIDATED',
      reason: `Topology '${currentSelection.topologyId}' deleted or modified in revision ${doc.revision}.`
    };
  }

  /**
   * Reconciles Evidence records against current document revision.
   */
  public static reconcileEvidence(doc: EngineeringDocument): EvidenceProjection {
    const records = (doc.evidence || []).map(ev => {
      const isStale = ev.revision !== doc.revision;
      return {
        evidenceId: ev.evidenceId,
        stage: ev.stage,
        verdict: ev.verdict || 'VALID',
        evidenceRevision: ev.revision,
        isStale,
        canonicalHash: ev.canonicalHash
      };
    });

    const hasStaleEvidence = records.some(r => r.isStale);

    return {
      documentId: doc.documentId,
      documentRevision: doc.revision,
      records,
      hasStaleEvidence
    };
  }

  /**
   * Derives engineering status strictly from document state and latest execution/evidence.
   */
  public static deriveStatus(
    doc: EngineeringDocument,
    executionResult?: any
  ): DerivedStatusProjection {
    if (executionResult && executionResult.success === false) {
      return {
        documentId: doc.documentId,
        documentRevision: doc.revision,
        status: 'FAILED',
        explanation: executionResult.error || 'Engineering operation failed in backend.',
        actionId: executionResult.actionId
      };
    }

    const latestEvidence = doc.evidence?.[doc.evidence.length - 1];
    if (latestEvidence && latestEvidence.verdict === 'VALID' && latestEvidence.revision === doc.revision) {
      return {
        documentId: doc.documentId,
        documentRevision: doc.revision,
        status: 'VALIDATED',
        explanation: `Document revision ${doc.revision} mathematically validated with evidence hash ${latestEvidence.canonicalHash.substring(0, 8)}.`,
        evidenceId: latestEvidence.evidenceId
      };
    }

    return {
      documentId: doc.documentId,
      documentRevision: doc.revision,
      status: 'MUTATED',
      explanation: `EngineeringDocument mutated to canonical revision ${doc.revision}.`
    };
  }
}
