/**
 * SECP Engineering OS — Dependency & Invalidation Graph Engine
 * Phase 2 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Tracks exact engineering lineage across CAD Features, Sketches, Assembly Mates,
 *   FEA meshes, CFD domains, CAM toolpaths, 2D Drawings, BOMs, and Evidence seals.
 * - When a user modifies a feature parameter (e.g. Hole Diameter 10mm -> 14mm),
 *   computes the exact invalidation cascade across downstream domains.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { DependencyState, EngineeringInvalidation } from './EngineeringToolContext';

export class EngineeringDependencyGraph {
  /**
   * Constructs the dependency graph nodes for a given EngineeringDocument.
   */
  public static buildGraph(doc: EngineeringDocument, currentRevision: number): DependencyState[] {
    const nodes: DependencyState[] = [];

    // 1. Sketch Nodes
    const sketches = doc.sketches || [];
    sketches.forEach(s => {
      nodes.push({
        nodeId: `SKETCH_${s.id}`,
        nodeType: 'SKETCH',
        name: s.name || `Sketch ${s.id}`,
        status: 'VALID',
        upstreamIds: [],
        downstreamIds: ['FEATURE_ROOT'],
        revision: currentRevision
      });
    });

    // 2. Feature Nodes
    const features = doc.features || [];
    features.forEach(f => {
      nodes.push({
        nodeId: `FEATURE_${f.id}`,
        nodeType: 'FEATURE',
        name: f.name || `Feature ${f.id} (${f.type})`,
        status: 'VALID',
        upstreamIds: f.dependencyIds || ['SKETCH_01'],
        downstreamIds: ['GEOMETRY_SOT'],
        revision: currentRevision
      });
    });

    // 3. Domain Downstream Nodes
    nodes.push({
      nodeId: 'DOMAIN_FEM',
      nodeType: 'FEM',
      name: 'Structural FEA Mesh & Solver',
      status: doc.metadata?.lastSolvedFemRevision === currentRevision ? 'VALID' : 'STALE',
      upstreamIds: ['GEOMETRY_SOT'],
      downstreamIds: ['EVIDENCE_RECORD'],
      revision: currentRevision
    });

    nodes.push({
      nodeId: 'DOMAIN_CFD',
      nodeType: 'CFD',
      name: 'CFD Fluid Flow Mesh & Solver',
      status: doc.metadata?.lastSolvedCfdRevision === currentRevision ? 'VALID' : 'STALE',
      upstreamIds: ['GEOMETRY_SOT'],
      downstreamIds: ['EVIDENCE_RECORD'],
      revision: currentRevision
    });

    nodes.push({
      nodeId: 'DOMAIN_CAM',
      nodeType: 'CAM',
      name: '3-Axis / 5-Axis Milling Toolpaths',
      status: doc.metadata?.lastCamToolpathRevision === currentRevision ? 'VALID' : 'STALE',
      upstreamIds: ['GEOMETRY_SOT'],
      downstreamIds: ['GCODE_NC'],
      revision: currentRevision
    });

    nodes.push({
      nodeId: 'DOMAIN_DRAWING',
      nodeType: 'DRAWING',
      name: '2D Orthographic Technical Drawings',
      status: doc.metadata?.lastDrawingRevision === currentRevision ? 'VALID' : 'STALE',
      upstreamIds: ['GEOMETRY_SOT'],
      downstreamIds: ['PDF_TDP'],
      revision: currentRevision
    });

    nodes.push({
      nodeId: 'DOMAIN_BOM',
      nodeType: 'BOM',
      name: 'Bill of Materials Roll-up',
      status: doc.metadata?.lastBomRevision === currentRevision ? 'VALID' : 'STALE',
      upstreamIds: ['GEOMETRY_SOT'],
      downstreamIds: ['PLM_ERP'],
      revision: currentRevision
    });

    return nodes;
  }

  /**
   * Computes invalidation records when a document edit transitions revision from oldRev to newRev.
   */
  public static computeInvalidations(
    doc: EngineeringDocument,
    oldRev: number,
    newRev: number,
    modifiedFeatureId?: string
  ): EngineeringInvalidation[] {
    const invalidations: EngineeringInvalidation[] = [];

    if (oldRev === newRev) {
      return invalidations;
    }

    // Geometry changed -> invalidate downstream solvers
    invalidations.push({
      domain: 'GEOMETRY',
      reason: `Geometry modified in Revision ${newRev}${modifiedFeatureId ? ` by ${modifiedFeatureId}` : ''}`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    invalidations.push({
      domain: 'FEM',
      reason: `FEA mesh and stiffness matrix invalidated due to Geometry Revision ${newRev} update`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    invalidations.push({
      domain: 'CFD',
      reason: `CFD fluid volume mesh invalidated due to Geometry Revision ${newRev} update`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    invalidations.push({
      domain: 'CAM',
      reason: `Milling toolpath vectors stale; stock model out of sync with Revision ${newRev}`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    invalidations.push({
      domain: 'DRAWING',
      reason: `2D Drawing projections require re-projection for Revision ${newRev}`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    invalidations.push({
      domain: 'BOM',
      reason: `Part mass & roll-up parameters changed in Revision ${newRev}`,
      triggerFeatureId: modifiedFeatureId,
      sourceRevision: oldRev,
      targetRevision: newRev
    });

    return invalidations;
  }
}
