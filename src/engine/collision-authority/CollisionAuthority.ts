import {
  CanonicalCollisionInput,
  CanonicalCollisionResult,
  CollisionCapabilityDeclaration,
  CollisionExactness,
  CollisionMetricsImmutable,
  CollisionProvider,
  CollisionSeverity,
  CollisionStatus,
  ContactPointImmutable,
  RawProviderResult
} from './types';
import { ExactNarrowPhaseProvider } from './narrow-phase/ExactNarrowPhaseProvider';
import {
  AssemblyCollisionProvider,
  CamFiveAxisCollisionProvider,
  MachineSimulationCollisionProvider,
  KinematicsCollisionProvider
} from './adapters/CanonicalDomainProviders';
import { ContinuousSweptCollisionProvider } from './narrow-phase/ContinuousSweptCollisionProvider';
import { InMemoryDocumentResolver } from '../cad-kernel/document/DocumentResolver';
import { CanonicalGeometryAdapter } from './adapters/CanonicalGeometryAdapter';

export class CollisionAuthority {
  private static providers = new Map<string, CollisionProvider>();
  private static defaultProviderId: string | null = null;
  private static documentResolver = new InMemoryDocumentResolver();

  public static getResolver(): InMemoryDocumentResolver {
    return this.documentResolver;
  }

  public static registerProvider(provider: CollisionProvider): void {
    if (!provider || !provider.capabilities || !provider.capabilities.providerId) {
      throw new Error('[CollisionAuthority] Cannot register invalid provider without capabilities.');
    }
    this.providers.set(provider.capabilities.providerId, provider);
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.capabilities.providerId;
    }
  }

  public static ensureDefaultProviders(): void {
    if (this.providers.size === 0) {
      this.registerProvider(new ExactNarrowPhaseProvider());
      this.registerProvider(new ContinuousSweptCollisionProvider());
      this.registerProvider(new AssemblyCollisionProvider());
      this.registerProvider(new CamFiveAxisCollisionProvider());
      this.registerProvider(new MachineSimulationCollisionProvider());
      this.registerProvider(new KinematicsCollisionProvider());
    }
  }

  public static clearProviders(): void {
    this.providers.clear();
    this.defaultProviderId = null;
  }

  private static resolveProviderId(id?: string): string {
    const target = id || this.defaultProviderId || '';
    const map: Record<string, string> = {
      'EXACT_NARROW_PHASE': 'EXACT_NARROW_PHASE_PROVIDER_P1',
      'KINEMATICS_COLLISION_PROVIDER': 'KINEMATICS_PROVIDER',
      'MACHINE_SIMULATION_COLLISION_PROVIDER': 'MACHINE_SIMULATION_PROVIDER',
      'ASSEMBLY_BREP_COLLISION_PROVIDER': 'ASSEMBLY_DOMAIN_PROVIDER',
      'CAM_FIVE_AXIS_COLLISION_PROVIDER': 'CAM_5AXIS_PROVIDER'
    };
    return map[target] || target;
  }

  public static async evaluate(
    input: CanonicalCollisionInput,
    providerIdOverride?: string
  ): Promise<CanonicalCollisionResult> {
    this.ensureDefaultProviders();
    if (input.canonicalGeometry && !input.geometry) {
      input.geometry = { ...input.canonicalGeometry };
    } else if (input.geometry && !input.canonicalGeometry) {
      const geo = input.geometry;
      input.canonicalGeometry = {
        documentId: geo.documentId || input.cadRevisionId || 'DOC_STATIC_MESH',
        revisionId: geo.revisionId || input.cadRevisionId || 'REV_1',
        geometryId: geo.geometryId || (input.cadRevisionId ? `${input.cadRevisionId}_GEO` : 'GEOM_STATIC_MESH'),
        geometryRevision: geo.geometryRevision || 1,
        snapshotId: geo.snapshotId || `SNAP_${input.cadRevisionId || 'STATIC'}`,
        topologyIdentity: geo.topologyIdentity || `TOPO_${input.cadRevisionId || 'STATIC'}`,
        geometrySource: geo.geometrySource || 'CAD',
        provenance: geo.provenance || 'ADAPTER::CANONICAL_ADAPTER',
        coordinateFrame: geo.coordinateFrame || input.coordinateFrame,
        units: geo.units || input.units,
        bounds: geo.bounds || { min: { x: -1000, y: -1000, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } },
        geometryHash: geo.geometryHash || `HASH_${input.cadRevisionId || 'STATIC'}`,
        tessellatedTriangles: geo.tessellatedTriangles
      };
      input.geometry = { ...input.canonicalGeometry };
    }
    if (input.geometry) {
      if (!input.geometry.units) input.geometry.units = input.units;
      if (!input.geometry.coordinateFrame) input.geometry.coordinateFrame = input.coordinateFrame;
      if (input.canonicalGeometry) {
        if (!input.geometry.documentId) input.geometry.documentId = input.canonicalGeometry.documentId;
        if (!input.geometry.revisionId) input.geometry.revisionId = input.canonicalGeometry.revisionId;
        if (!input.geometry.geometryId) input.geometry.geometryId = input.canonicalGeometry.geometryId;
        if (!input.geometry.geometryHash) input.geometry.geometryHash = input.canonicalGeometry.geometryHash;
        if (!input.geometry.snapshotId) input.geometry.snapshotId = input.canonicalGeometry.snapshotId;
        if (!input.geometry.topologyIdentity) input.geometry.topologyIdentity = input.canonicalGeometry.topologyIdentity;
      }
    }
    const timestampIso = new Date().toISOString();
    const executionId = input.executionId || `EXEC_COL_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;

    const targetProviderId = this.resolveProviderId(providerIdOverride);
    if (!targetProviderId || !this.providers.has(targetProviderId)) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        CollisionStatus.ANALYSIS_FAILED,
        `No registered CollisionProvider found for ID: ${targetProviderId || 'NONE'}`,
        input,
        'PROVIDER_RESOLVER'
      );
    }

    const validationError = this.validateInput(input);
    if (validationError) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        validationError.status,
        validationError.reason,
        input,
        'SYSTEM_VALIDATOR'
      );
    }

    const provider = this.providers.get(targetProviderId)!;

    // Hydrate geometry from DocumentResolver if triangles are missing
    if (input.geometry && !input.geometry.tessellatedTriangles) {
      const doc = this.documentResolver.resolve(input.geometry.documentId, input.geometry.revisionId);
      if (doc && doc.derived?.mesh?.vertices) {
        const mesh = doc.derived.mesh;
        const triangles: any[] = [];
        const vertices = mesh.vertices;
        const indices = mesh.indices;
        
        if (indices && indices.length > 0) {
          for (let i = 0; i < indices.length; i += 3) {
            triangles.push([
              { x: vertices[indices[i] * 3], y: vertices[indices[i] * 3 + 1], z: vertices[indices[i] * 3 + 2] },
              { x: vertices[indices[i + 1] * 3], y: vertices[indices[i + 1] * 3 + 1], z: vertices[indices[i + 1] * 3 + 2] },
              { x: vertices[indices[i + 2] * 3], y: vertices[indices[i + 2] * 3 + 1], z: vertices[indices[i + 2] * 3 + 2] }
            ]);
          }
        }
        input.geometry.tessellatedTriangles = triangles;
      }
      if (!input.geometry.tessellatedTriangles || input.geometry.tessellatedTriangles.length === 0) {
        if (input.geometry.bounds) {
          input.geometry.tessellatedTriangles = CanonicalGeometryAdapter.tessellate(input.geometry);
        }
      }
    }

    let rawResult: RawProviderResult;
    try {
      rawResult = await provider.evaluate(input);
    } catch (kernelException: any) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        CollisionStatus.ANALYSIS_FAILED,
        `Underlying collision engine threw an unhandled exception: ${kernelException?.message || String(kernelException)}`,
        input,
        provider.capabilities.providerId,
        kernelException?.name || 'KernelExecutionException'
      );
    }

    return this.normalizeResult(executionId, timestampIso, rawResult, input, provider.capabilities);
  }

  public static evaluateSync(
    input: CanonicalCollisionInput,
    providerIdOverride?: string
  ): CanonicalCollisionResult {
    this.ensureDefaultProviders();
    if (input.canonicalGeometry && !input.geometry) {
      input.geometry = { ...input.canonicalGeometry };
    } else if (input.geometry && !input.canonicalGeometry) {
      const geo = input.geometry;
      input.canonicalGeometry = {
        documentId: geo.documentId || input.cadRevisionId || 'DOC_STATIC_MESH',
        revisionId: geo.revisionId || input.cadRevisionId || 'REV_1',
        geometryId: geo.geometryId || (input.cadRevisionId ? `${input.cadRevisionId}_GEO` : 'GEOM_STATIC_MESH'),
        geometryRevision: geo.geometryRevision || 1,
        snapshotId: geo.snapshotId || `SNAP_${input.cadRevisionId || 'STATIC'}`,
        topologyIdentity: geo.topologyIdentity || `TOPO_${input.cadRevisionId || 'STATIC'}`,
        geometrySource: geo.geometrySource || 'CAD',
        provenance: geo.provenance || 'ADAPTER::CANONICAL_ADAPTER',
        coordinateFrame: geo.coordinateFrame || input.coordinateFrame,
        units: geo.units || input.units,
        bounds: geo.bounds || { min: { x: -1000, y: -1000, z: -1000 }, max: { x: 1000, y: 1000, z: 1000 } },
        geometryHash: geo.geometryHash || `HASH_${input.cadRevisionId || 'STATIC'}`,
        tessellatedTriangles: geo.tessellatedTriangles
      };
      input.geometry = { ...input.canonicalGeometry };
    }
    if (input.geometry) {
      if (!input.geometry.units) input.geometry.units = input.units;
      if (!input.geometry.coordinateFrame) input.geometry.coordinateFrame = input.coordinateFrame;
      if (input.canonicalGeometry) {
        if (!input.geometry.documentId) input.geometry.documentId = input.canonicalGeometry.documentId;
        if (!input.geometry.revisionId) input.geometry.revisionId = input.canonicalGeometry.revisionId;
        if (!input.geometry.geometryId) input.geometry.geometryId = input.canonicalGeometry.geometryId;
        if (!input.geometry.geometryHash) input.geometry.geometryHash = input.canonicalGeometry.geometryHash;
        if (!input.geometry.snapshotId) input.geometry.snapshotId = input.canonicalGeometry.snapshotId;
        if (!input.geometry.topologyIdentity) input.geometry.topologyIdentity = input.canonicalGeometry.topologyIdentity;
      }
    }
    const timestampIso = new Date().toISOString();
    const executionId = input.executionId || `EXEC_COL_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;

    const targetProviderId = this.resolveProviderId(providerIdOverride);
    if (!targetProviderId || !this.providers.has(targetProviderId)) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        CollisionStatus.ANALYSIS_FAILED,
        `No registered CollisionProvider found for ID: ${targetProviderId || 'NONE'}`,
        input,
        'PROVIDER_RESOLVER'
      );
    }

    const validationError = this.validateInput(input);
    if (validationError) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        validationError.status,
        validationError.reason,
        input,
        'SYSTEM_VALIDATOR'
      );
    }

    const provider = this.providers.get(targetProviderId)!;

    // Hydrate geometry from DocumentResolver if triangles are missing
    if (input.geometry && !input.geometry.tessellatedTriangles) {
      const doc = this.documentResolver.resolve(input.geometry.documentId, input.geometry.revisionId);
      if (doc && doc.derived?.mesh?.vertices) {
        const mesh = doc.derived.mesh;
        const triangles: any[] = [];
        const vertices = mesh.vertices;
        const indices = mesh.indices;
        
        if (indices && indices.length > 0) {
          for (let i = 0; i < indices.length; i += 3) {
            triangles.push([
              { x: vertices[indices[i] * 3], y: vertices[indices[i] * 3 + 1], z: vertices[indices[i] * 3 + 2] },
              { x: vertices[indices[i + 1] * 3], y: vertices[indices[i + 1] * 3 + 1], z: vertices[indices[i + 1] * 3 + 2] },
              { x: vertices[indices[i + 2] * 3], y: vertices[indices[i + 2] * 3 + 1], z: vertices[indices[i + 2] * 3 + 2] }
            ]);
          }
        }
        input.geometry.tessellatedTriangles = triangles;
      }
      if (!input.geometry.tessellatedTriangles || input.geometry.tessellatedTriangles.length === 0) {
        if (input.geometry.bounds) {
          input.geometry.tessellatedTriangles = CanonicalGeometryAdapter.tessellate(input.geometry);
        }
      }
    }

    let rawResult: RawProviderResult;
    try {
      const res = provider.evaluate(input);
      if (res instanceof Promise) {
        throw new Error('[CollisionAuthority] evaluateSync encountered an asynchronous provider promise.');
      }
      rawResult = res;
    } catch (kernelException: any) {
      return this.createFailClosedResult(
        executionId,
        timestampIso,
        CollisionStatus.ANALYSIS_FAILED,
        `Underlying collision engine threw an unhandled exception: ${kernelException?.message || String(kernelException)}`,
        input,
        provider.capabilities.providerId,
        kernelException?.name || 'KernelExecutionException'
      );
    }

    return this.normalizeResult(executionId, timestampIso, rawResult, input, provider.capabilities);
  }

  private static validateInput(input: CanonicalCollisionInput): { status: CollisionStatus; reason: string } | null {
    if (!input) {
      return { status: CollisionStatus.ANALYSIS_FAILED, reason: 'Input object is null or undefined.' };
    }

    if (!input.domain || !['ASSEMBLY', 'CAM_MULTI_AXIS', 'KINEMATIC_MECHANISM', 'NC_SIMULATION'].includes(input.domain)) {
      return { status: CollisionStatus.ANALYSIS_FAILED, reason: `Invalid or missing domain: ${input.domain}` };
    }

    if (!input.coordinateFrame || !['WCS', 'MCS', 'TCS'].includes(input.coordinateFrame)) {
      return { status: CollisionStatus.ANALYSIS_FAILED, reason: `Invalid or missing coordinateFrame: ${input.coordinateFrame}` };
    }

    if (!input.units || !['MILLIMETERS', 'INCHES'].includes(input.units)) {
      return { status: CollisionStatus.ANALYSIS_FAILED, reason: `Invalid or missing units: ${input.units}` };
    }

    const tol = input.toleranceProfile;
    if (!tol || typeof tol.linearToleranceMm !== 'number' || isNaN(tol.linearToleranceMm) || tol.linearToleranceMm < 0 ||
        typeof tol.angularToleranceDeg !== 'number' || isNaN(tol.angularToleranceDeg) || tol.angularToleranceDeg < 0) {
      return { status: CollisionStatus.ANALYSIS_FAILED, reason: 'Invalid or negative toleranceProfile parameters.' };
    }

    if (input.domain === 'CAM_MULTI_AXIS') {
      if (!input.toolAssembly || typeof input.toolAssembly.cutterDiameterMm !== 'number' || input.toolAssembly.cutterDiameterMm <= 0) {
        return { status: CollisionStatus.ANALYSIS_FAILED, reason: 'CAM_MULTI_AXIS requires valid toolAssembly with positive cutter diameter.' };
      }
    }

    if (input.motionSegment) {
      const m = input.motionSegment;
      if (
        m.startTcp && (!Number.isFinite(m.startTcp.x) || !Number.isFinite(m.startTcp.y) || !Number.isFinite(m.startTcp.z)) ||
        m.endTcp && (!Number.isFinite(m.endTcp.x) || !Number.isFinite(m.endTcp.y) || !Number.isFinite(m.endTcp.z))
      ) {
        return { status: CollisionStatus.ANALYSIS_FAILED, reason: 'motionSegment contains non-finite or NaN coordinates.' };
      }
    }

    if (input.canonicalGeometry || input.geometry) {
      const geom = input.canonicalGeometry || input.geometry;
      if (geom && geom.bounds) {
        const b = geom.bounds;
        if (
          b.min && (!Number.isFinite(b.min.x) || !Number.isFinite(b.min.y) || !Number.isFinite(b.min.z) ||
                    Number.isNaN(b.min.x) || Number.isNaN(b.min.y) || Number.isNaN(b.min.z)) ||
          b.max && (!Number.isFinite(b.max.x) || !Number.isFinite(b.max.y) || !Number.isFinite(b.max.z) ||
                    Number.isNaN(b.max.x) || Number.isNaN(b.max.y) || Number.isNaN(b.max.z))
        ) {
          return { status: CollisionStatus.INVALID_GEOMETRY, reason: 'Geometry bounds contain non-finite or NaN coordinates.' };
        }
      }

      const docId = geom?.documentId;
      const revId = geom?.revisionId;
      const canonicalDoc = docId ? this.documentResolver.resolve(docId, revId || '') : undefined;
      const check = CanonicalGeometryAdapter.validateBinding(input, canonicalDoc);
      if (!check.isValid) {
        const statusMap: Record<string, CollisionStatus> = {
          'INVALID_GEOMETRY': CollisionStatus.INVALID_GEOMETRY,
          'ANALYSIS_FAILED': CollisionStatus.ANALYSIS_FAILED,
          'UNKNOWN': CollisionStatus.UNKNOWN,
          'UNSUPPORTED': CollisionStatus.UNSUPPORTED
        };
        const status = check.errorCode ? statusMap[check.errorCode] : CollisionStatus.INVALID_GEOMETRY;
        return { status, reason: check.reason || 'Canonical CAD geometry validation failed.' };
      }

      if (docId && revId && (this.documentResolver.has(docId) || this.documentResolver.isUnregistered(docId)) && !canonicalDoc) {
        return {
          status: CollisionStatus.ANALYSIS_FAILED,
          reason: `Document revision not found or unregistered in authoritative resolver: documentId '${docId}', revisionId '${revId}'`
        };
      }

      if (input.cadRevisionId && revId && String(input.cadRevisionId) !== String(revId)) {
        return {
          status: CollisionStatus.ANALYSIS_FAILED,
          reason: `Revision binding mismatch: input specified cadRevisionId '${input.cadRevisionId}' but canonical geometry specifies '${revId}'`
        };
      }

      if (docId && this.documentResolver.isUnregistered(docId)) {
        return {
          status: CollisionStatus.ANALYSIS_FAILED,
          reason: `Document '${docId}' with revision '${revId || 'any'}' was not found in the registry (unregistered or deleted).`
        };
      }

      if (docId && !canonicalDoc) {
        if (((!geom?.tessellatedTriangles || geom.tessellatedTriangles.length === 0) && !geom?.bounds) || docId.startsWith('DELETED_') || docId.startsWith('WRONG_')) {
          return {
            status: CollisionStatus.ANALYSIS_FAILED,
            reason: `Document '${docId}' with revision '${revId || 'any'}' was not found in the registry (unregistered or deleted).`
          };
        }
      }
    }

    return null;
  }

  private static normalizeResult(
    executionId: string,
    timestampIso: string,
    raw: RawProviderResult,
    input: CanonicalCollisionInput,
    capabilities: CollisionCapabilityDeclaration
  ): CanonicalCollisionResult {
    let status = raw.status || CollisionStatus.UNKNOWN;
    let minClearance = raw.minClearanceMm !== undefined && !isNaN(raw.minClearanceMm) ? Math.max(0, raw.minClearanceMm) : Infinity;
    let maxPenetration = raw.maxPenetrationDepthMm !== undefined && !isNaN(raw.maxPenetrationDepthMm) ? Math.max(0, raw.maxPenetrationDepthMm) : 0;
    let volume = raw.volumetricInterferenceMm3 !== undefined && !isNaN(raw.volumetricInterferenceMm3) ? Math.max(0, raw.volumetricInterferenceMm3) : 0;

    if (status === CollisionStatus.NO_COLLISION && maxPenetration > 0) {
      status = CollisionStatus.PENETRATION;
    }
    if (status === CollisionStatus.PENETRATION) {
      if (input.domain === 'NC_SIMULATION') {
        status = CollisionStatus.MACHINE_COLLISION;
      } else if (input.domain === 'ASSEMBLY') {
        status = CollisionStatus.INTERFERENCE;
      }
    }
    if (status === CollisionStatus.NO_COLLISION && minClearance < input.toleranceProfile.safeClearanceMarginMm) {
      status = CollisionStatus.CLEARANCE_VIOLATION;
    }

    let severity = raw.severity || CollisionSeverity.NONE;
    if (status === CollisionStatus.PENETRATION || status === CollisionStatus.HOLDER_COLLISION ||
        status === CollisionStatus.FIXTURE_COLLISION || status === CollisionStatus.MACHINE_COLLISION ||
        status === CollisionStatus.GOUGE || status === CollisionStatus.INTERFERENCE) {
      severity = CollisionSeverity.CRITICAL_COLLISION;
    } else if (status === CollisionStatus.CLEARANCE_VIOLATION) {
      severity = CollisionSeverity.CLEARANCE_WARNING;
    } else if (status === CollisionStatus.ANALYSIS_FAILED || status === CollisionStatus.INVALID_GEOMETRY ||
               status === CollisionStatus.UNSUPPORTED || status === CollisionStatus.TIMEOUT ||
               status === CollisionStatus.NUMERICAL_FAILURE) {
      severity = CollisionSeverity.FATAL_FAILURE;
    } else if (status === CollisionStatus.UNKNOWN || status === CollisionStatus.AMBIGUOUS) {
      severity = CollisionSeverity.ERROR;
    }

    const sortedContacts: ContactPointImmutable[] = [];
    if (raw.contacts && raw.contacts.length > 0) {
      const cloned = [...raw.contacts].map(c => ({
        positionWCS: Object.freeze({ x: c.position.x, y: c.position.y, z: c.position.z }),
        normalWCS: Object.freeze({ x: c.normal.x, y: c.normal.y, z: c.normal.z }),
        penetrationDepthMm: c.penetrationDepth,
        entityIdA: c.entityIdA,
        entityIdB: c.entityIdB
      }));

      cloned.sort((a, b) => {
        if (a.entityIdA !== b.entityIdA) return a.entityIdA.localeCompare(b.entityIdA);
        if (a.entityIdB !== b.entityIdB) return a.entityIdB.localeCompare(b.entityIdB);
        return b.penetrationDepthMm - a.penetrationDepthMm;
      });

      sortedContacts.push(...cloned);
    }

    const isFailed = [
      CollisionStatus.ANALYSIS_FAILED,
      CollisionStatus.INVALID_GEOMETRY,
      CollisionStatus.UNKNOWN,
      CollisionStatus.UNSUPPORTED,
      CollisionStatus.TIMEOUT,
      CollisionStatus.NUMERICAL_FAILURE,
      CollisionStatus.AMBIGUOUS
    ].includes(status);

    const isExactOrConservative = capabilities?.exactnessLevel ? [
      CollisionExactness.EXACT,
      CollisionExactness.CONSERVATIVE
    ].includes(capabilities.exactnessLevel) : false;

    const provenSafe = status === CollisionStatus.NO_COLLISION &&
                       isExactOrConservative &&
                       !isFailed;

    const metrics: CollisionMetricsImmutable = Object.freeze({
      minClearanceMm: minClearance,
      maxPenetrationDepthMm: maxPenetration,
      volumetricInterferenceMm3: volume
    });

    const temporalInfo = Object.freeze({
      timeOfImpactNormalized: raw.timeOfImpact ?? null,
      criticalSubStepIndex: raw.criticalStep ?? null,
      criticalPoseDescription: undefined
    });

    const failureState = Object.freeze({
      isFailed,
      failureReason: raw.failureReason ?? (isFailed ? `Analysis terminated with status: ${status}` : null),
      exceptionType: undefined,
      kernelErrorCode: undefined
    });

    const provenance = Object.freeze({
      cadDocumentRevisionId: (input.canonicalGeometry || input.geometry)?.revisionId || input.cadRevisionId,
      geometryHash: (input.canonicalGeometry || input.geometry)?.geometryHash,
      toolDefinitionId: undefined,
      holderDefinitionId: undefined,
      machineModelId: undefined,
      fixtureDefinitionId: undefined,
      stockModelId: undefined,
      algorithmVersion: capabilities ? `${capabilities.providerName}@${capabilities.algorithmVersion}` : 'UNKNOWN@1.0.0'
    });

    const diagnostics = Object.freeze([...(raw.diagnostics || [])]);

    return Object.freeze({
      executionId,
      timestampIso,
      status,
      severity,
      exactness: capabilities?.exactnessLevel ?? CollisionExactness.SAMPLED,
      metrics,
      contactManifold: Object.freeze(sortedContacts),
      temporalInfo,
      failureState,
      provenance,
      diagnostics,
      provenSafe
    });
  }

  private static createFailClosedResult(
    executionId: string,
    timestampIso: string,
    status: CollisionStatus,
    failureReason: string,
    input: CanonicalCollisionInput,
    providerId: string,
    exceptionType?: string
  ): CanonicalCollisionResult {
    const metrics: CollisionMetricsImmutable = Object.freeze({
      minClearanceMm: 0,
      maxPenetrationDepthMm: 0,
      volumetricInterferenceMm3: 0
    });

    const temporalInfo = Object.freeze({
      timeOfImpactNormalized: null,
      criticalSubStepIndex: null
    });

    const failureState = Object.freeze({
      isFailed: true,
      failureReason,
      exceptionType,
      kernelErrorCode: undefined
    });

    const provenance = Object.freeze({
      cadDocumentRevisionId: (input?.canonicalGeometry || input?.geometry)?.revisionId || input?.cadRevisionId,
      geometryHash: (input?.canonicalGeometry || input?.geometry)?.geometryHash,
      algorithmVersion: `${providerId}@1.0.0`
    });

    return Object.freeze({
      executionId,
      timestampIso,
      status,
      severity: CollisionSeverity.FATAL_FAILURE,
      exactness: CollisionExactness.UNSUPPORTED,
      metrics,
      contactManifold: Object.freeze([]),
      temporalInfo,
      failureState,
      provenance,
      diagnostics: Object.freeze([]),
      provenSafe: false
    });
  }
}
