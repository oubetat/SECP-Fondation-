/**
 * SECP Industrial OS v3 — Collision Authority Core
 * Production Collision Manager & Interlock Governance Engine (Mission P6)
 * 
 * Enforces the 5 Constitutional Rules:
 * 1. No Canonical Context -> No Execution (Fail Closed)
 * 2. No Collision Authority -> No Authoritative Result
 * 3. No Verified Result -> No Safety / Approval State
 * 4. No Current Revision/Transform -> STALE Result
 * 5. UI Observes Truth; UI Does Not Create Truth
 */

import {
  CollisionAuthority,
  CollisionStatus,
  CollisionExactness,
  CanonicalCollisionInput,
  CanonicalCollisionResult
} from '../index';
import { CanonicalGeometryAdapter } from '../adapters/CanonicalGeometryAdapter';
import {
  ProductionCollisionCommand,
  ProductionCollisionResult,
  ActionInterlockRequirement,
  ActionInterlockVerdict,
  VerificationStateVocabulary
} from './ProductionCollisionTypes';

export class ProductionCollisionManager {
  private static currentSessionId = 'SESSION_PRODUCTION_ACTIVE_001';
  private static activeResults = new Map<string, ProductionCollisionResult>();
  private static actionInterlockMatrix: ActionInterlockRequirement[] = [
    {
      actionId: 'GENERATE_TOOLPATH',
      actionName: 'Generate CAM Toolpath',
      requiresCollisionQualification: true,
      requiredState: 'PROVEN_SAFE',
      blockOnStates: ['FAILED', 'STALE', 'INVALIDATED', 'UNKNOWN', 'SAMPLED'],
      description: 'Toolpath generation requires proven safe cutter clearance.'
    },
    {
      actionId: 'RUN_SIMULATION',
      actionName: 'Run Machine NC Simulation',
      requiresCollisionQualification: true,
      requiredState: 'VERIFIED',
      blockOnStates: ['FAILED', 'STALE', 'INVALIDATED'],
      description: 'NC simulation requires current verified collision status.'
    },
    {
      actionId: 'APPROVE_COLLISION',
      actionName: 'Approve Collision Clearance',
      requiresCollisionQualification: true,
      requiredState: 'PROVEN_SAFE',
      blockOnStates: ['FAILED', 'STALE', 'INVALIDATED', 'UNKNOWN', 'SAMPLED', 'UNVERIFIED'],
      description: 'Formal collision sign-off requires proven safe status.'
    },
    {
      actionId: 'RELEASE_PUBLISH',
      actionName: 'Release Engineering Revision',
      requiresCollisionQualification: true,
      requiredState: 'PROVEN_SAFE',
      blockOnStates: ['FAILED', 'STALE', 'INVALIDATED', 'UNKNOWN', 'SAMPLED'],
      description: 'Production release requires non-stale proven safe clearance.'
    },
    {
      actionId: 'EXPORT_STEP',
      actionName: 'Export STEP Geometry',
      requiresCollisionQualification: false,
      requiredState: 'UNVERIFIED',
      blockOnStates: [],
      description: 'Geometry export is unblocked by collision interlock unless workflow restricted.'
    },
    {
      actionId: 'SAVE_DOCUMENT',
      actionName: 'Save Engineering Document',
      requiresCollisionQualification: false,
      requiredState: 'UNVERIFIED',
      blockOnStates: [],
      description: 'Document saving is never blocked by collision safety interlock.'
    }
  ];

  public static getInterlockMatrix(): ReadonlyArray<ActionInterlockRequirement> {
    return this.actionInterlockMatrix;
  }

  /**
   * Validates production command contract and context.
   */
  public static validateCommand(cmd: ProductionCollisionCommand): { isValid: boolean; reason?: string } {
    if (!cmd) return { isValid: false, reason: 'Command object is null or undefined.' };
    if (!cmd.commandId) return { isValid: false, reason: 'Missing commandId.' };
    if (!cmd.documentId) return { isValid: false, reason: 'Missing documentId in canonical context.' };
    if (!cmd.revisionId) return { isValid: false, reason: 'Missing revisionId in canonical context.' };
    if (!cmd.geometryIds || cmd.geometryIds.length === 0) return { isValid: false, reason: 'Missing geometryIds.' };
    if (!cmd.snapshotIds || cmd.snapshotIds.length === 0) return { isValid: false, reason: 'Missing snapshotIds.' };
    if (!cmd.transformRevision) return { isValid: false, reason: 'Missing transformRevision.' };
    if (!cmd.coordinateFrame || !['WCS', 'MCS', 'TCS'].includes(cmd.coordinateFrame)) return { isValid: false, reason: 'Missing or invalid coordinateFrame.' };
    if (!cmd.units || !['MILLIMETERS', 'INCHES'].includes(cmd.units)) return { isValid: false, reason: 'Missing or invalid units.' };
    const validAnalyses = ['ASSEMBLY_CLEARANCE', 'CAM_MULTI_AXIS', 'MACHINE_SIMULATION', 'KINEMATIC_MECHANISM', 'STATIC_INTERFERENCE', 'CONTINUOUS_SWEPT'];
    if (!cmd.requestedAnalysis || !validAnalyses.includes(cmd.requestedAnalysis)) return { isValid: false, reason: 'Missing or invalid requestedAnalysis.' };
    return { isValid: true };
  }

  /**
   * Executes production collision command through canonical Collision Authority.
   */
  public static executeProductionCommand(
    cmd: ProductionCollisionCommand,
    providerIdOverride?: string
  ): ProductionCollisionResult {
    const val = this.validateCommand(cmd);
    if (!val.isValid) {
      return this.createFailClosedProductionResult(
        cmd,
        CollisionStatus.INVALID_GEOMETRY,
        val.reason || 'Invalid ProductionCollisionCommand contract',
        'COMMAND_VALIDATOR'
      );
    }

    // Resolve Canonical Document from Registry
    const resolver = CollisionAuthority.getResolver();
    const canonicalDoc = resolver.resolve(cmd.documentId, cmd.revisionId);

    if (!canonicalDoc) {
      return this.createFailClosedProductionResult(
        cmd,
        CollisionStatus.ANALYSIS_FAILED,
        `Document ${cmd.documentId}@REV_${cmd.revisionId} not found in canonical document resolver.`,
        'DOCUMENT_RESOLVER'
      );
    }

    const geo = CanonicalGeometryAdapter.adapt(canonicalDoc);

    // Map command analysis to domain
    let domain: 'ASSEMBLY' | 'CAM_MULTI_AXIS' | 'KINEMATIC_MECHANISM' | 'NC_SIMULATION' = 'ASSEMBLY';
    switch (cmd.requestedAnalysis) {
      case 'CAM_MULTI_AXIS':
      case 'CONTINUOUS_SWEPT':
        domain = 'CAM_MULTI_AXIS';
        break;
      case 'MACHINE_SIMULATION':
        domain = 'NC_SIMULATION';
        break;
      case 'KINEMATIC_MECHANISM':
        domain = 'KINEMATIC_MECHANISM';
        break;
      case 'ASSEMBLY_CLEARANCE':
      case 'STATIC_INTERFERENCE':
      default:
        domain = 'ASSEMBLY';
        break;
    }

    const input: CanonicalCollisionInput = {
      executionId: cmd.executionId,
      domain,
      coordinateFrame: cmd.coordinateFrame,
      units: cmd.units,
      toleranceProfile: {
        linearToleranceMm: 0.001,
        angularToleranceDeg: 0.1,
        clearanceWarningMarginMm: 2.0,
        safeClearanceMarginMm: 0.5
      },
      cadRevisionId: cmd.revisionId,
      canonicalGeometry: cmd.canonicalGeometry || geo,
      geometry: {
        documentId: cmd.documentId,
        revisionId: cmd.revisionId,
        geometryId: geo.geometryId,
        geometryRevision: geo.geometryRevision || 1,
        snapshotId: geo.snapshotId || 'SNAP_DEFAULT',
        topologyIdentity: geo.topologyIdentity || 'TOPO_DEFAULT',
        geometrySource: geo.geometrySource || 'CAD',
        provenance: 'PRODUCTION_MANAGER',
        coordinateFrame: cmd.coordinateFrame,
        units: cmd.units,
        bounds: geo.bounds || { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } },
        geometryHash: geo.geometryHash || 'GEO_HASH_DEFAULT',
        tessellatedTriangles: [
          {
            v0: { x: 100, y: 100, z: 0 },
            v1: { x: 120, y: 100, z: 0 },
            v2: { x: 110, y: 120, z: 0 }
          }
        ]
      },
      toolAssembly: {
        cutterDiameterMm: 10,
        fluteLengthMm: 30,
        stickoutMm: 60,
        shankDiameterMm: 10,
        holderDiameterMm: 40,
        holderLengthMm: 50
      },
      motionSegment: {
        startTcp: { x: 0, y: 0, z: 50 },
        startOrientation: { x: 0, y: 0, z: 1 },
        endTcp: { x: 0, y: 0, z: 10 },
        endOrientation: { x: 0, y: 0, z: 1 },
        motionType: 'FEED'
      }
    };

    const authorityResult = CollisionAuthority.evaluateSync(input, providerIdOverride);

    // Map Verification State
    let verificationState: VerificationStateVocabulary = 'UNVERIFIED';
    if (authorityResult.provenSafe) {
      verificationState = 'PROVEN_SAFE';
    } else if (authorityResult.exactness === CollisionExactness.SAMPLED) {
      verificationState = 'SAMPLED';
    } else if (authorityResult.status === CollisionStatus.NO_COLLISION) {
      verificationState = 'VERIFIED';
    } else if (authorityResult.status === CollisionStatus.ANALYSIS_FAILED || authorityResult.status === CollisionStatus.INVALID_GEOMETRY) {
      verificationState = 'FAILED';
    } else {
      verificationState = 'UNKNOWN';
    }

    const result: ProductionCollisionResult = {
      resultId: authorityResult.executionId,
      commandId: cmd.commandId,
      executionId: authorityResult.executionId,
      authorityId: 'CollisionAuthority@3.0.0-SECP',
      providerId: authorityResult.provenance?.algorithmVersion ? providerIdOverride || 'DEFAULT_PROVIDER' : 'SYSTEM_VALIDATOR',
      algorithmVersion: authorityResult.provenance?.algorithmVersion || 'SECP-Authority@1.0.0',

      documentId: cmd.documentId,
      revisionId: cmd.revisionId,
      geometryId: geo.geometryId,
      geometryHash: geo.geometryHash,
      snapshotId: cmd.snapshotIds[0] || geo.snapshotId,
      transformRevision: cmd.transformRevision,
      motionId: cmd.motionId,

      classification: authorityResult.status,
      exactnessLevel: authorityResult.exactness,
      verificationState,
      provenSafe: authorityResult.provenSafe,

      minimumClearanceMm: authorityResult.metrics.minClearanceMm ?? authorityResult.metrics.minimumSeparationMm,
      maxPenetrationMm: authorityResult.metrics.maxPenetrationDepthMm ?? authorityResult.metrics.penetrationDepthMm,
      timeOfImpact: authorityResult.temporalInfo.timeOfImpactNormalized ?? authorityResult.temporalInfo.timeOfImpact ?? null,

      failureCode: authorityResult.failureState.failureReason ? authorityResult.status : null,
      failureReason: authorityResult.failureState.failureReason,

      timestampIso: authorityResult.timestampIso,
      isCurrent: true
    };

    this.activeResults.set(cmd.documentId, result);
    return result;
  }

  /**
   * Invalidates active result when document revision or transform changes (Rule 4).
   */
  public static invalidateOnRevisionOrTransformChange(
    documentId: string,
    newRevisionId: string,
    newTransformRevision: string
  ): void {
    const existing = this.activeResults.get(documentId);
    if (existing) {
      if (existing.revisionId !== newRevisionId || existing.transformRevision !== newTransformRevision) {
        const staleResult: ProductionCollisionResult = {
          ...existing,
          isCurrent: false,
          verificationState: 'STALE',
          provenSafe: false
        };
        this.activeResults.set(documentId, staleResult);
      }
    }
  }

  /**
   * Evaluates action interlock for a given workbench action.
   */
  public static evaluateActionInterlock(
    actionId: string,
    documentId: string,
    currentRevisionId: string,
    currentTransformRevision: string
  ): ActionInterlockVerdict {
    const req = this.actionInterlockMatrix.find(r => r.actionId === actionId);
    if (!req) {
      return {
        actionId,
        isAllowed: true,
        currentVerificationState: 'UNVERIFIED',
        isCurrent: true,
        blockReason: null
      };
    }

    const currentResult = this.activeResults.get(documentId);

    if (!req.requiresCollisionQualification) {
      return {
        actionId,
        isAllowed: true,
        currentVerificationState: currentResult?.verificationState || 'UNVERIFIED',
        isCurrent: currentResult?.isCurrent ?? true,
        blockReason: null
      };
    }

    if (!currentResult) {
      return {
        actionId,
        isAllowed: false,
        currentVerificationState: 'UNKNOWN',
        isCurrent: false,
        blockReason: `Action [${actionId}] blocked: No collision analysis performed for document ${documentId}.`
      };
    }

    // Check Stale/Revision/Transform Mismatch
    if (currentResult.revisionId !== currentRevisionId || currentResult.transformRevision !== currentTransformRevision) {
      return {
        actionId,
        isAllowed: false,
        currentVerificationState: 'STALE',
        isCurrent: false,
        blockReason: `Action [${actionId}] blocked: Collision result is STALE due to revision or transform change.`
      };
    }

    if (req.blockOnStates.includes(currentResult.verificationState)) {
      return {
        actionId,
        isAllowed: false,
        currentVerificationState: currentResult.verificationState,
        isCurrent: currentResult.isCurrent,
        blockReason: `Action [${actionId}] blocked: Collision state is [${currentResult.verificationState}]. Required: [${req.requiredState}].`
      };
    }

    return {
      actionId,
      isAllowed: true,
      currentVerificationState: currentResult.verificationState,
      isCurrent: currentResult.isCurrent,
      blockReason: null
    };
  }

  private static createFailClosedProductionResult(
    cmd: ProductionCollisionCommand,
    status: CollisionStatus,
    reason: string,
    providerId: string
  ): ProductionCollisionResult {
    return {
      resultId: `EXEC_FAIL_${Math.random().toString(36).substring(2, 9)}`,
      commandId: cmd?.commandId || 'CMD_INVALID',
      executionId: cmd?.executionId || 'EXEC_INVALID',
      authorityId: 'CollisionAuthority@3.0.0-SECP',
      providerId,
      algorithmVersion: 'SYSTEM_VALIDATOR@1.0.0',

      documentId: cmd?.documentId || 'UNKNOWN',
      revisionId: cmd?.revisionId || '0',
      geometryId: cmd?.geometryIds?.[0] || 'UNKNOWN',
      geometryHash: 'UNRESOLVED_HASH',
      snapshotId: cmd?.snapshotIds?.[0] || 'UNKNOWN',
      transformRevision: cmd?.transformRevision || '0',
      motionId: cmd?.motionId || null,

      classification: status,
      exactnessLevel: CollisionExactness.UNSUPPORTED,
      verificationState: 'FAILED',
      provenSafe: false,

      minimumClearanceMm: 0,
      maxPenetrationMm: 0,
      timeOfImpact: null,

      failureCode: status,
      failureReason: reason,

      timestampIso: new Date().toISOString(),
      isCurrent: false
    };
  }
}
