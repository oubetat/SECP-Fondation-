/**
 * PATCH-194 & PATCH-195: Parametric Feature Engine & Feature Tree Kernel
 * Transforms solved parametric sketches into a fully connected, parametric, editable,
 * and deterministic Feature Tree.
 * 
 * Pipeline:
 * Feature Tree ↔ Dependency Graph ↔ Geometry Kernel ↔ Cascading Invalidation ↔ Engineering Object OS ↔ Event Store ↔ Evidence Bus
 */

import { CadSolidEntity, Vector3D } from '../cadKernel';
import { IndustrialSketchDefinition } from '../sketch/IndustrialConstraintTypes';
import {
  ParametricFeature,
  FeatureType,
  FeatureStatus,
  ExtrudeParameters,
  RevolveParameters,
  SweepParameters,
  LoftParameters,
  HoleParameters,
  ShellParameters,
  DraftParameters,
  RibParameters,
  FilletParameters,
  ChamferParameters,
  RecomputeReport,
  FeatureDiagnostic,
  TopologyReference,
  FeatureEventType,
  FeatureReorderValidationResult,
  FeatureTreeEvidence
} from './ParametricFeatureTypes';
import { FeatureTree } from './FeatureTree';
import { FeatureDependencyGraph } from './FeatureDependencyGraph';
import { SolidGeometryKernel } from './SolidGeometryKernel';
import { EngineeringObjectOS } from '../industrial-os/EngineeringObjectOS';
import { EngineeringEventStore } from '../industrial-os/event-model/EngineeringEventStore';
import { EvidenceEnvelopeFactory } from '../industrial-os/evidence-bus/EvidenceEnvelopeFactory';
import { EvidenceBus } from '../industrial-os/evidence-bus/EvidenceBus';
import { ControlledEvidenceType } from '../industrial-os/evidence-bus/types';
import { EngineeringObjectType } from '../identity/CanonicalEngineeringIdentity';
import { generateDeterministicHashSync } from '../../lib/hash';

export class ParametricFeatureEngine {
  private tree: FeatureTree;
  private objectOS: EngineeringObjectOS;
  private eventStore: EngineeringEventStore;
  private evidenceBus: EvidenceBus;
  private activePartId: string;
  private author: string;

  constructor(partId = 'PART-195-ROOT', author = 'Engineer-cad-195') {
    this.tree = new FeatureTree();
    this.objectOS = new EngineeringObjectOS();
    this.eventStore = EngineeringEventStore.getInstance();
    this.evidenceBus = EvidenceBus.getInstance();
    this.activePartId = partId;
    this.author = author;

    // Register root part object in OS if not already registered
    try {
      if (!this.objectOS.get(this.activePartId)) {
        this.objectOS.register({
          id: this.activePartId,
          objectType: EngineeringObjectType.DESIGN,
          author: this.author,
          projectId: 'PROJECT-PARAMETRIC-195',
          metadata: { name: 'Parametric Part Model', type: 'PART' }
        });
        this.objectOS.transitionState(this.activePartId, 'ACTIVE', this.author, { reason: 'System initialization' });
      }
    } catch {
      // Ignore if already registered
    }
  }

  public getTree(): FeatureTree {
    return this.tree;
  }

  public getDependencyGraph(): FeatureDependencyGraph {
    return this.tree.getDependencyGraph();
  }

  public getObjectOS(): EngineeringObjectOS {
    return this.objectOS;
  }

  /**
   * Helper: Record industrial OS event & register object in OS
   */
  private recordEvent(eventType: FeatureEventType, payload: Record<string, any>): string {
    const correlationId = `CORR-195-${Date.now()}`;
    const featureId = payload.featureId;

    // Register feature object in EngineeringObjectOS
    if (featureId && !this.objectOS.get(featureId)) {
      try {
        const name = payload.name || featureId;
        const type = payload.featureType || payload.type || 'FEATURE';
        
        this.objectOS.register({
          id: featureId,
          objectType: EngineeringObjectType.DESIGN,
          author: this.author,
          projectId: 'PROJECT-PARAMETRIC-195',
          metadata: {
            name,
            type,
            params: payload.params || {}
          }
        });

        // Transition to ACTIVE if the feature is active
        if (payload.newState === 'ACTIVE') {
          this.objectOS.transitionState(featureId, 'ACTIVE', this.author, { reason: 'Feature Creation' });
        }
      } catch {
        // Ignore if already registered or governance denial
      }
    }

    const event = this.eventStore.append({
      eventType: 'OBJECT_CREATED',
      actor: { id: this.author, type: 'USER' },
      source: { service: 'PARAMETRIC_FEATURE_ENGINE', component: 'FeatureTreeKernel', version: '1.95.0' },
      objectRefs: [this.activePartId, featureId].filter(Boolean),
      payload: {
        featureEventType: eventType,
        ...payload,
        timestamp: new Date().toISOString()
      },
      correlationId
    });
    return event.id;
  }

  /**
   * 1. CREATE EXTRUDE FEATURE
   */
  public createExtrude(
    sketch: IndustrialSketchDefinition,
    params: ExtrudeParameters,
    name = 'Extrude001',
    parentFeatureId?: string,
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-ext-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const dependencies: string[] = [];
    if (sketch.id) dependencies.push(sketch.id);
    if (parentFeatureId) dependencies.push(parentFeatureId);

    const diagnostics: FeatureDiagnostic[] = [];
    if (params.depth <= 0) {
      diagnostics.push({
        code: 'ERR_INVALID_PARAM',
        severity: 'ERROR',
        message: `Extrude depth must be positive. Received: ${params.depth}`,
        failureType: 'INVALID_PARAMETER'
      });
    }

    const solid = SolidGeometryKernel.extrudeSketch(sketch, params, name);

    const topologyReferences: TopologyReference[] = [
      { id: `face-top-${id}`, type: 'FACE', signature: `extrude-top-zMax`, name: 'Top Planar Face', persistentId: `${id}:F_TOP` },
      { id: `face-bot-${id}`, type: 'FACE', signature: `extrude-bot-zMin`, name: 'Bottom Planar Face', persistentId: `${id}:F_BOT` },
      { id: `edge-loop-${id}`, type: 'EDGE', signature: `extrude-profile-loop`, name: 'Profile Perimeter', persistentId: `${id}:E_LOOP` }
    ];

    const hash = generateDeterministicHashSync({ type: 'EXTRUDE', params, sketchId: sketch.id });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'EXTRUDE',
      params,
      sketchId: sketch.id,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'EXTRUDE',
      featureType: 'EXTRUDE',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: parentFeatureId ? [parentFeatureId] : [],
      childFeatures: [],
      inputReferences: sketch.id ? [sketch.id] : [],
      inputGeometry: { sketch, sketchId: sketch.id },
      parameters: params,
      outputGeometry: solid,
      dependencies,
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics,
      topologyReferences,
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 2. CREATE REVOLVE FEATURE
   */
  public createRevolve(
    sketch: IndustrialSketchDefinition,
    params: RevolveParameters,
    name = 'Revolve001',
    parentFeatureId?: string,
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-rev-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const dependencies: string[] = [];
    if (sketch.id) dependencies.push(sketch.id);
    if (parentFeatureId) dependencies.push(parentFeatureId);

    const diagnostics: FeatureDiagnostic[] = [];
    if (!params.angle || params.angle <= 0) {
      diagnostics.push({
        code: 'ERR_INVALID_PARAM',
        severity: 'ERROR',
        message: `Revolve angle must be positive non-zero. Received: ${params.angle}`,
        failureType: 'INVALID_PARAMETER'
      });
    }

    const solid = SolidGeometryKernel.revolveSketch(sketch, params, name);

    const topologyReferences: TopologyReference[] = [
      { id: `face-revol-${id}`, type: 'FACE', signature: `revolve-lat-cone`, name: 'Revolution Surface', persistentId: `${id}:F_REV` }
    ];

    const hash = generateDeterministicHashSync({ type: 'REVOLVE', params, sketchId: sketch.id });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'REVOLVE',
      params,
      sketchId: sketch.id,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'REVOLVE',
      featureType: 'REVOLVE',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: parentFeatureId ? [parentFeatureId] : [],
      childFeatures: [],
      inputReferences: sketch.id ? [sketch.id] : [],
      inputGeometry: { sketch, sketchId: sketch.id },
      parameters: params,
      outputGeometry: solid,
      dependencies,
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics,
      topologyReferences,
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 3. CREATE SWEEP FEATURE
   */
  public createSweep(
    profileSketch: IndustrialSketchDefinition,
    pathPoints: Vector3D[],
    params: SweepParameters,
    name = 'Sweep001',
    parentFeatureId?: string,
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-swp-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const dependencies: string[] = [];
    if (profileSketch.id) dependencies.push(profileSketch.id);
    if (parentFeatureId) dependencies.push(parentFeatureId);

    const diagnostics: FeatureDiagnostic[] = [];
    if (pathPoints && pathPoints.length < 2) {
      diagnostics.push({
        code: 'ERR_INVALID_PATH',
        severity: 'ERROR',
        message: 'Sweep requires a path with at least 2 points.',
        failureType: 'INVALID_PARAMETER'
      });
    }

    const solid = SolidGeometryKernel.sweepProfile(profileSketch, pathPoints, params, name);
    const hash = generateDeterministicHashSync({ type: 'SWEEP', params, profileSketchId: profileSketch.id });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'SWEEP',
      params,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'SWEEP',
      featureType: 'SWEEP',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: parentFeatureId ? [parentFeatureId] : [],
      childFeatures: [],
      inputReferences: profileSketch.id ? [profileSketch.id] : [],
      inputGeometry: { profileSketch, profileSketchId: profileSketch.id, pathPoints },
      parameters: params,
      outputGeometry: solid,
      dependencies,
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics,
      topologyReferences: [],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 4. CREATE LOFT FEATURE
   */
  public createLoft(
    sectionSketches: IndustrialSketchDefinition[],
    params: LoftParameters,
    name = 'Loft001',
    parentFeatureId?: string,
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-loft-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const dependencies: string[] = sectionSketches.map(s => s.id).filter(Boolean);
    if (parentFeatureId) dependencies.push(parentFeatureId);

    const diagnostics: FeatureDiagnostic[] = [];
    if (sectionSketches.length < 2) {
      diagnostics.push({
        code: 'ERR_LOFT_SECTIONS',
        severity: 'WARNING',
        message: 'Loft usually requires at least 2 profile sections.',
        failureType: 'INVALID_PARAMETER'
      });
    }

    const solid = SolidGeometryKernel.loftSections(sectionSketches, params, name);
    const hash = generateDeterministicHashSync({ type: 'LOFT', params, sectionCount: sectionSketches.length });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'LOFT',
      params,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'LOFT',
      featureType: 'LOFT',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: parentFeatureId ? [parentFeatureId] : [],
      childFeatures: [],
      inputReferences: dependencies,
      inputGeometry: { sectionSketches, sectionSketchIds: dependencies },
      parameters: params,
      outputGeometry: solid,
      dependencies,
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics,
      topologyReferences: [],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 5. CREATE HOLE FEATURE
   */
  public createHole(
    parentFeatureId: string,
    params: HoleParameters,
    name = 'Hole001',
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-hol-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const parent = this.tree.getFeature(parentFeatureId);
    if (!parent || (!parent.resultBody && !parent.outputGeometry)) {
      throw new Error(`Cannot add Hole: Parent feature '${parentFeatureId}' does not exist or has no solid body.`);
    }

    const diagnostics: FeatureDiagnostic[] = [];
    if (params.diameter <= 0) {
      diagnostics.push({
        code: 'ERR_INVALID_DIAMETER',
        severity: 'ERROR',
        message: `Hole diameter must be positive. Received: ${params.diameter}`,
        failureType: 'INVALID_PARAMETER'
      });
    }

    const parentBody = parent.resultBody || parent.outputGeometry!;
    const solid = SolidGeometryKernel.createHole(parentBody, params, name);

    const hash = generateDeterministicHashSync({ type: 'HOLE', params, parentId: parentFeatureId });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'HOLE',
      params,
      parentFeatureId,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'HOLE',
      featureType: 'HOLE',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: [parentFeatureId],
      childFeatures: [],
      inputReferences: [parentFeatureId],
      inputGeometry: { targetSolidId: parentBody.id },
      parameters: params,
      outputGeometry: solid,
      dependencies: [parentFeatureId],
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics,
      topologyReferences: [
        { id: `face-hole-bore-${id}`, type: 'FACE', signature: `cyl-bore-${id}`, name: 'Cylindrical Bore Surface', persistentId: `${id}:F_BORE` }
      ],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 6. CREATE SHELL FEATURE
   */
  public createShell(
    parentFeatureId: string,
    params: ShellParameters,
    name = 'Shell001',
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-shl-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const parent = this.tree.getFeature(parentFeatureId);
    if (!parent || (!parent.resultBody && !parent.outputGeometry)) {
      throw new Error(`Cannot add Shell: Parent feature '${parentFeatureId}' does not exist or has no solid body.`);
    }

    const diagnostics: FeatureDiagnostic[] = [];
    let solid: CadSolidEntity;
    const parentBody = parent.resultBody || parent.outputGeometry!;
    try {
      solid = SolidGeometryKernel.shellSolid(parentBody, params, name);
    } catch (err: any) {
      diagnostics.push({
        code: 'ERR_SHELL_FAILURE',
        severity: 'ERROR',
        message: err.message || 'Shell operation failed',
        failureType: 'SELF_INTERSECTION'
      });
      solid = { ...parentBody, name: `${name}_FAILED` };
    }

    const hash = generateDeterministicHashSync({ type: 'SHELL', params, parentId: parentFeatureId });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'SHELL',
      params,
      parentFeatureId,
      newState: diagnostics.some(d => d.severity === 'ERROR') ? 'FAILED' : 'ACTIVE'
    });

    const now = new Date().toISOString();
    const isError = diagnostics.some(d => d.severity === 'ERROR');
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'SHELL',
      featureType: 'SHELL',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: [parentFeatureId],
      childFeatures: [],
      inputReferences: [parentFeatureId],
      inputGeometry: { targetSolidId: parentBody.id },
      parameters: params,
      outputGeometry: solid,
      dependencies: [parentFeatureId],
      dependents: [],
      resultBody: solid,
      status: isError ? 'FAILED' : 'ACTIVE',
      suppressed: false,
      valid: !isError,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: isError ? 'ERROR' : 'VALID',
      diagnostics,
      topologyReferences: [],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 7. CREATE DRAFT FEATURE
   */
  public createDraft(
    parentFeatureId: string,
    params: DraftParameters,
    name = 'Draft001',
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-dft-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const parent = this.tree.getFeature(parentFeatureId);
    if (!parent || (!parent.resultBody && !parent.outputGeometry)) {
      throw new Error(`Cannot add Draft: Parent feature '${parentFeatureId}' does not exist or has no solid body.`);
    }

    const parentBody = parent.resultBody || parent.outputGeometry!;
    const solid = SolidGeometryKernel.applyDraft(parentBody, params, name);
    const hash = generateDeterministicHashSync({ type: 'DRAFT', params, parentId: parentFeatureId });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'DRAFT',
      params,
      parentFeatureId,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'DRAFT',
      featureType: 'DRAFT',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: [parentFeatureId],
      childFeatures: [],
      inputReferences: [parentFeatureId],
      inputGeometry: { targetSolidId: parentBody.id },
      parameters: params,
      outputGeometry: solid,
      dependencies: [parentFeatureId],
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics: [],
      topologyReferences: [],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * 8. CREATE RIB FEATURE
   */
  public createRib(
    parentFeatureId: string,
    ribSketch: IndustrialSketchDefinition,
    params: RibParameters,
    name = 'Rib001',
    explicitFeatureId?: string
  ): ParametricFeature {
    const id = explicitFeatureId || `feat-rib-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const parent = this.tree.getFeature(parentFeatureId);
    if (!parent || (!parent.resultBody && !parent.outputGeometry)) {
      throw new Error(`Cannot add Rib: Parent feature '${parentFeatureId}' does not exist or has no solid body.`);
    }

    const dependencies = [parentFeatureId];
    if (ribSketch.id) dependencies.push(ribSketch.id);

    const parentBody = parent.resultBody || parent.outputGeometry!;
    const solid = SolidGeometryKernel.createRib(parentBody, ribSketch, params, name);
    const hash = generateDeterministicHashSync({ type: 'RIB', params, parentId: parentFeatureId });
    const eventId = this.recordEvent('FEATURE_CREATED', {
      featureId: id,
      name,
      featureType: 'RIB',
      params,
      parentFeatureId,
      newState: 'ACTIVE'
    });

    const now = new Date().toISOString();
    const feature: ParametricFeature = {
      id,
      featureId: id,
      type: 'RIB',
      featureType: 'RIB',
      name,
      creationIndex: this.tree.getAllFeatures().length,
      parentFeatureId,
      parentFeatures: [parentFeatureId],
      childFeatures: [],
      inputReferences: dependencies,
      inputGeometry: { ribSketch, sketchId: ribSketch.id, targetSolidId: parentBody.id },
      parameters: params,
      outputGeometry: solid,
      dependencies,
      dependents: [],
      resultBody: solid,
      status: 'ACTIVE',
      suppressed: false,
      valid: true,
      createdAt: now,
      updatedAt: now,
      creationEvent: { eventId, timestamp: now, author: this.author },
      modificationHistory: [],
      suppressionState: 'ACTIVE',
      recomputeState: 'VALID',
      diagnostics: [],
      topologyReferences: [],
      deterministicHash: hash,
      revision: 1
    };

    this.tree.addFeature(feature);
    this.generateFeatureTreeEvidence();
    return feature;
  }

  /**
   * Edit feature parameters with cascading invalidation and recomputation
   */
  public editFeatureParameters(
    featureId: string,
    newParams: Record<string, any>,
    reason = 'Parametric Modification'
  ): RecomputeReport {
    const feat = this.tree.getFeature(featureId);
    if (!feat) {
      throw new Error(`Feature '${featureId}' not found for editing.`);
    }

    const prevState = feat.status;
    this.tree.updateParameters(featureId, newParams, reason);
    this.recordEvent('FEATURE_EDITED', {
      featureId,
      newParams,
      reason,
      previousState: prevState,
      newState: 'OUT_OF_DATE'
    });

    // Cascading Invalidation Event
    const affected = this.tree.getAffectedFeatures(featureId);
    this.recordEvent('FEATURE_INVALIDATED', {
      featureId,
      affectedFeatures: affected,
      newState: 'OUT_OF_DATE'
    });

    return this.recomputeFrom(featureId);
  }

  /**
   * Suppress / Unsuppress feature
   */
  public suppressFeature(featureId: string): RecomputeReport {
    const feat = this.tree.getFeature(featureId);
    const prevState = feat?.status;
    this.tree.suppressFeature(featureId);
    this.recordEvent('FEATURE_SUPPRESSED', {
      featureId,
      previousState: prevState,
      newState: 'SUPPRESSED'
    });
    return this.recomputeFrom(featureId);
  }

  public unsuppressFeature(featureId: string): RecomputeReport {
    const feat = this.tree.getFeature(featureId);
    const prevState = feat?.status;
    this.tree.unsuppressFeature(featureId);
    this.recordEvent('FEATURE_UNSUPPRESSED', {
      featureId,
      previousState: prevState,
      newState: 'ACTIVE'
    });
    return this.recomputeFrom(featureId);
  }

  /**
   * Rollback tree to a specific feature point in history
   */
  public rollbackTo(featureId?: string): RecomputeReport {
    this.tree.rollbackTo(featureId);
    this.recordEvent('FEATURE_ROLLBACK', {
      featureId: featureId || 'CLEAR_ROLLBACK',
      rollbackTargetId: featureId,
      newState: featureId ? 'ROLLED_BACK' : 'ACTIVE'
    });
    return this.recomputeAll();
  }

  /**
   * Rename a feature
   */
  public renameFeature(featureId: string, newName: string): boolean {
    const feat = this.tree.getFeature(featureId);
    if (!feat) return false;
    const oldName = feat.name;
    const success = this.tree.renameFeature(featureId, newName);
    if (success) {
      this.recordEvent('FEATURE_EDITED', {
        featureId,
        oldName,
        newName,
        changeType: 'RENAME'
      });
      this.generateFeatureTreeEvidence();
    }
    return success;
  }

  /**
   * Delete a feature and recompute tree
   */
  public deleteFeature(featureId: string): boolean {
    const feat = this.tree.getFeature(featureId);
    if (!feat) return false;
    const removed = this.tree.removeFeature(featureId);
    if (removed) {
      this.recordEvent('FEATURE_DELETED', {
        featureId,
        name: feat.name,
        featureType: feat.type
      });
      this.recomputeAll();
    }
    return removed;
  }

  /**
   * Reorder feature with full validation and recompute
   */
  public reorderFeature(featureId: string, targetIndex: number): RecomputeReport {
    const validation = this.tree.reorderFeature(featureId, targetIndex);
    if (!validation.valid) {
      throw new Error(`Feature reorder rejected: ${validation.reason}`);
    }

    this.recordEvent('FEATURE_REORDERED', {
      featureId,
      targetIndex,
      proposedOrder: validation.proposedOrder,
      newState: 'ACTIVE'
    });

    return this.recomputeAll();
  }

  /**
   * Recompute starting from a changed feature ID
   */
  public recomputeFrom(changedFeatureId: string): RecomputeReport {
    const affectedIds = this.tree.getAffectedFeatures(changedFeatureId);

    // Invalidate affected downstream features
    for (const id of affectedIds) {
      const f = this.tree.getFeature(id);
      if (f && f.status !== 'SUPPRESSED' && f.status !== 'ROLLED_BACK') {
        f.recomputeState = 'INVALIDATED';
        f.status = 'OUT_OF_DATE';
      }
    }

    return this.recomputeAll();
  }

  /**
   * Recomputes all active features in topological order
   */
  public recomputeAll(): RecomputeReport {
    const startTime = Date.now();
    this.tree.refreshGraph();
    const allFeatures = this.tree.getActiveTimelineFeatures();
    const order = this.tree.getDependencyGraph().getRegenerationOrder(allFeatures.map(f => f.id));

    const recomputedFeatureIds: string[] = [];
    const invalidatedFeatureIds: string[] = [];
    let lastValidSolid: CadSolidEntity | undefined;
    let failedFeatureId: string | undefined;
    const errorDiagnostics: FeatureDiagnostic[] = [];

    for (const featId of order) {
      const feature = this.tree.getFeature(featId);
      if (!feature) continue;

      if (this.tree.isRolledBack(feature.id)) {
        feature.status = 'ROLLED_BACK';
        continue;
      }

      if (feature.suppressionState === 'SUPPRESSED' || feature.suppressed) {
        feature.status = 'SUPPRESSED';
        feature.recomputeState = 'VALID';
        continue;
      }

      // If an upstream dependency failed, mark this feature as INVALID / FAILED
      if (failedFeatureId) {
        feature.status = 'INVALID';
        feature.recomputeState = 'ERROR';
        feature.valid = false;
        feature.outputGeometry = undefined;
        feature.resultBody = undefined;
        invalidatedFeatureIds.push(feature.id);
        this.recordEvent('FEATURE_INVALIDATED', {
          featureId: feature.id,
          reason: `Upstream dependency ${failedFeatureId} failed`,
          newState: 'INVALID'
        });
        continue;
      }

      feature.recomputeState = 'RECOMPUTING';
      feature.status = 'REBUILDING';

      try {
        let parentSolid = lastValidSolid;
        if (feature.parentFeatureId) {
          const parentFeat = this.tree.getFeature(feature.parentFeatureId);
          if (parentFeat && parentFeat.suppressionState === 'ACTIVE' && (parentFeat.resultBody || parentFeat.outputGeometry)) {
            parentSolid = parentFeat.resultBody || parentFeat.outputGeometry;
          }
        }

        // Execute geometry operation
        if (feature.type === 'EXTRUDE') {
          const sk = feature.inputGeometry.sketch || ({ id: 'sk-default', name: 'default-sketch', plane: 'XY', revision: 1, entities: {}, constraints: {} } as any);
          feature.resultBody = SolidGeometryKernel.extrudeSketch(sk, feature.parameters as ExtrudeParameters, feature.name);
        } else if (feature.type === 'REVOLVE') {
          const sk = feature.inputGeometry.sketch || ({ id: 'sk-default', name: 'default-sketch', plane: 'XY', revision: 1, entities: {}, constraints: {} } as any);
          feature.resultBody = SolidGeometryKernel.revolveSketch(sk, feature.parameters as RevolveParameters, feature.name);
        } else if (feature.type === 'SWEEP') {
          const sk = feature.inputGeometry.profileSketch || ({ id: 'sk-default', name: 'default-sketch', plane: 'XY', revision: 1, entities: {}, constraints: {} } as any);
          const path = feature.inputGeometry.pathPoints || [];
          feature.resultBody = SolidGeometryKernel.sweepProfile(sk, path, feature.parameters as SweepParameters, feature.name);
        } else if (feature.type === 'LOFT') {
          const sections = feature.inputGeometry.sectionSketches || [];
          feature.resultBody = SolidGeometryKernel.loftSections(sections, feature.parameters as LoftParameters, feature.name);
        } else if (feature.type === 'HOLE' && parentSolid) {
          feature.resultBody = SolidGeometryKernel.createHole(parentSolid, feature.parameters as HoleParameters, feature.name);
        } else if (feature.type === 'SHELL' && parentSolid) {
          feature.resultBody = SolidGeometryKernel.shellSolid(parentSolid, feature.parameters as ShellParameters, feature.name);
        } else if (feature.type === 'DRAFT' && parentSolid) {
          feature.resultBody = SolidGeometryKernel.applyDraft(parentSolid, feature.parameters as DraftParameters, feature.name);
        } else if (feature.type === 'RIB' && parentSolid) {
          const sk = feature.inputGeometry.ribSketch || { id: 'sk-rib', entities: {} };
          feature.resultBody = SolidGeometryKernel.createRib(parentSolid, sk, feature.parameters as RibParameters, feature.name);
        }

        feature.outputGeometry = feature.resultBody;
        feature.recomputeState = 'VALID';
        feature.status = 'ACTIVE';
        feature.valid = true;
        feature.deterministicHash = generateDeterministicHashSync({
          id: feature.id,
          params: feature.parameters,
          revision: feature.revision,
          volume: feature.resultBody?.volumeM3
        });
        recomputedFeatureIds.push(feature.id);
        if (feature.resultBody) {
          lastValidSolid = feature.resultBody;
        }

        this.recordEvent('FEATURE_REBUILT', {
          featureId: feature.id,
          newState: 'ACTIVE'
        });
      } catch (err: any) {
        feature.recomputeState = 'ERROR';
        feature.status = 'FAILED';
        feature.valid = false;
        feature.outputGeometry = undefined;
        feature.resultBody = undefined;
        failedFeatureId = feature.id;

        const diag: FeatureDiagnostic = {
          code: 'ERR_RECOMPUTE_FAIL',
          severity: 'ERROR',
          message: err.message || 'Recompute execution failure',
          failureType: 'RECOMPUTE_FAILURE',
          relatedEntityId: feature.id
        };
        feature.diagnostics.push(diag);
        errorDiagnostics.push(diag);

        this.recordEvent('FEATURE_REBUILD_FAILED', {
          featureId: feature.id,
          error: err.message,
          newState: 'FAILED'
        });
      }
    }

    const report: RecomputeReport = {
      success: !failedFeatureId,
      recomputedFeatureIds,
      invalidatedFeatureIds,
      failedFeatureId,
      errorDiagnostics,
      recomputeDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      finalSolid: lastValidSolid
    };

    this.generateFeatureTreeEvidence();
    return report;
  }

  /**
   * Generates Cryptographic Evidence Envelope for Feature Tree
   */
  public generateFeatureTreeEvidence(): FeatureTreeEvidence {
    const all = this.tree.getAllFeatures();
    const active = all.filter(f => f.status === 'ACTIVE');
    const treeHash = this.tree.getFeatureTreeHash();
    const graphHash = this.tree.getDependencyGraph().getDeterministicHash();
    const paramHash = generateDeterministicHashSync(all.map(f => f.parameters));
    const inputHash = generateDeterministicHashSync(all.map(f => f.inputGeometry));
    const outputHash = generateDeterministicHashSync(active.map(f => f.resultBody?.volumeM3 || 0));

    const evidenceData: FeatureTreeEvidence = {
      featureTreeHash: treeHash,
      dependencyGraphHash: graphHash,
      parameterHash: paramHash,
      inputGeometryHash: inputHash,
      outputGeometryHash: outputHash,
      rebuildResult: all.some(f => f.status === 'FAILED') ? 'FAILED' : 'SUCCESS',
      validationResult: all.some(f => f.status === 'INVALID' || f.status === 'FAILED') ? 'INVALID' : 'VALID',
      activeFeatureCount: active.length,
      totalFeatureCount: all.length,
      timestamp: new Date().toISOString()
    };

    try {
      const envelope = EvidenceEnvelopeFactory.createEnvelope({
        evidenceType: 'GEOMETRY_EVIDENCE',
        sourceCapability: 'GEOMETRY_KERNEL',
        sourceOperation: 'FEATURE_REBUILD',
        engineeringObjectId: this.activePartId,
        runId: `RUN-195-${Date.now()}`,
        producerId: 'ParametricFeatureEngine',
        payload: evidenceData as any,
        tags: ['PATCH-195', 'FEATURE_TREE', 'PARAMETRIC_HISTORY']
      }, 1, 1);
      this.evidenceBus.publish(envelope);
    } catch {
      // Evidence fallback
    }

    return evidenceData;
  }

  /**
   * Deterministic Replay: Reconstructs an entire feature engine from raw event history
   */
  public static deterministicReplay(
    events: any[],
    targetPartId = 'PART-REPLAY-195'
  ): ParametricFeatureEngine {
    const engine = new ParametricFeatureEngine(targetPartId, 'replay-agent');

    for (const evt of events) {
      const p = evt.payload || {};
      const action = p.featureEventType || p.featureAction || evt.eventType;
      try {
        if (action === 'CREATE_EXTRUDE' || action === 'FEATURE_CREATE_EXTRUDE' || (action === 'FEATURE_CREATED' && p.featureType === 'EXTRUDE')) {
          const sk = p.sketch || {
            id: p.sketchId || 'sk-replay',
            entities: {
              p1: { id: 'p1', type: 'POINT', x: -50, y: -50 },
              p2: { id: 'p2', type: 'POINT', x: 50, y: -50 },
              p3: { id: 'p3', type: 'POINT', x: 50, y: 50 },
              p4: { id: 'p4', type: 'POINT', x: -50, y: 50 },
              l1: { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' },
              l2: { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' },
              l3: { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' },
              l4: { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' }
            }
          };
          engine.createExtrude(sk, p.params || { depth: 20 }, p.name || 'Extrude', p.parentFeatureId, p.featureId);
        } else if (action === 'CREATE_REVOLVE' || action === 'FEATURE_CREATE_REVOLVE' || (action === 'FEATURE_CREATED' && p.featureType === 'REVOLVE')) {
          const sk = p.sketch || {
            id: p.sketchId || 'sk-replay',
            entities: {
              p1: { id: 'p1', type: 'POINT', x: 10, y: 0 },
              p2: { id: 'p2', type: 'POINT', x: 40, y: 0 },
              p3: { id: 'p3', type: 'POINT', x: 40, y: 30 },
              p4: { id: 'p4', type: 'POINT', x: 10, y: 30 },
              l1: { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' },
              l2: { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' },
              l3: { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' },
              l4: { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' }
            }
          };
          engine.createRevolve(sk, p.params || { angle: 360 }, p.name || 'Revolve', p.parentFeatureId, p.featureId);
        } else if (action === 'CREATE_HOLE' || (action === 'FEATURE_CREATED' && p.featureType === 'HOLE')) {
          if (p.parentFeatureId && engine.getTree().getFeature(p.parentFeatureId)) {
            engine.createHole(p.parentFeatureId, p.params || { holeType: 'SIMPLE', diameter: 10, depth: 20 }, p.name || 'Hole', p.featureId);
          }
        } else if (action === 'CREATE_DRAFT' || (action === 'FEATURE_CREATED' && p.featureType === 'DRAFT')) {
          if (p.parentFeatureId && engine.getTree().getFeature(p.parentFeatureId)) {
            engine.createDraft(p.parentFeatureId, p.params || { draftAngle: 3 }, p.name || 'Draft', p.featureId);
          }
        } else if (action === 'CREATE_SHELL' || (action === 'FEATURE_CREATED' && p.featureType === 'SHELL')) {
          if (p.parentFeatureId && engine.getTree().getFeature(p.parentFeatureId)) {
            engine.createShell(p.parentFeatureId, p.params || { thickness: 2 }, p.name || 'Shell', p.featureId);
          }
        } else if (action === 'CREATE_RIB' || (action === 'FEATURE_CREATED' && p.featureType === 'RIB')) {
          if (p.parentFeatureId && engine.getTree().getFeature(p.parentFeatureId)) {
            const sk = p.sketch || { id: 'sk-rib', entities: {} };
            engine.createRib(p.parentFeatureId, sk, p.params || { thickness: 4 }, p.name || 'Rib', p.featureId);
          }
        } else if (action === 'EDIT_PARAMETERS' || action === 'FEATURE_EDITED') {
          if (p.featureId && engine.getTree().getFeature(p.featureId)) {
            engine.editFeatureParameters(p.featureId, p.newParams || p.params, p.reason);
          }
        } else if (action === 'SUPPRESS_FEATURE' || action === 'FEATURE_SUPPRESSED') {
          if (p.featureId && engine.getTree().getFeature(p.featureId)) {
            engine.suppressFeature(p.featureId);
          }
        } else if (action === 'UNSUPPRESS_FEATURE' || action === 'FEATURE_UNSUPPRESSED') {
          if (p.featureId && engine.getTree().getFeature(p.featureId)) {
            engine.unsuppressFeature(p.featureId);
          }
        } else if (action === 'FEATURE_REORDERED') {
          if (p.featureId && engine.getTree().getFeature(p.featureId)) {
            try {
              engine.reorderFeature(p.featureId, p.targetIndex);
            } catch {
              // Replay safe ignore
            }
          }
        } else if (action === 'FEATURE_ROLLBACK') {
          engine.rollbackTo(p.featureId === 'CLEAR_ROLLBACK' || !p.featureId ? undefined : p.featureId);
        } else if (action === 'FEATURE_DELETED') {
          if (p.featureId && engine.getTree().getFeature(p.featureId)) {
            engine.deleteFeature(p.featureId);
          }
        }
      } catch {
        // Gracefully ignore individual failed replay actions
      }
    }

    try {
      engine.recomputeAll();
    } catch {
      // Recompute fallback
    }
    return engine;
  }
}
