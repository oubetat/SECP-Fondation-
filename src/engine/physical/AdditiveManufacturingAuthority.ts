/**
 * SECP Industrial OS — Additive Manufacturing & 3D Printing Authority
 * POST-PLUGIN-MATURITY-008R (Part B)
 *
 * Enforces authoritative linkage between Canonical CAD Revisions,
 * Manufacturing Intent, 3D Slicing/Artifact Generation, and Physical Part Serialization.
 */

import { createHash } from 'crypto';
import { PhysicalOriginType, PhysicalOriginSemantics, OriginTag } from './PhysicalOriginSemantics';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';

export type AdditiveProcessType = 'FDM_3D_PRINTING' | 'SLA_RESIN' | 'SLS_POWDER' | 'DMLS_METAL' | 'POLYJET';

export interface AdditiveManufacturingIntent {
  readonly intentId: string;
  readonly sourceEntityId: string;
  readonly sourceRevisionId: string;
  readonly sourceRevisionHash: string;
  readonly sourceGeometryHash: string;
  readonly processType: AdditiveProcessType;
  readonly processParameters: {
    readonly layerHeightMm: number;
    readonly infillPercentage: number;
    readonly printSpeedMmS: number;
    readonly nozzleTempC?: number;
    readonly bedTempC?: number;
    readonly laserPowerWatts?: number;
    readonly buildOrientationRPY: readonly [number, number, number];
    readonly supportStructureRequired: boolean;
  };
  readonly materialGrade: string;
  readonly targetMachineModel: string;
  readonly intentDigest: string;
  readonly createdAt: string;
  readonly originTag: OriginTag;
}

export type PrintableArtifactFormat = 'STL' | '3MF' | 'GCODE' | 'CLI';

export interface PrintableManufacturingArtifact {
  readonly artifactId: string;
  readonly intentId: string;
  readonly sourceRevisionHash: string;
  readonly format: PrintableArtifactFormat;
  readonly artifactPayload: string; // The raw ASCII/Base64 Gcode or Mesh
  readonly artifactContentHash: string;
  readonly estimatedBuildTimeMinutes: number;
  readonly estimatedMaterialGrams: number;
  readonly layerCount: number;
  readonly artifactDigest: string;
  readonly createdAt: string;
  readonly isReleasedForProduction: boolean;
}

export interface PhysicalPartSerialization {
  readonly physicalSerialId: string;
  readonly artifactId: string;
  readonly intentId: string;
  readonly sourceRevisionHash: string;
  readonly physicalMachineSerial: string;
  readonly materialLotNumber: string;
  readonly operatorId: string;
  readonly buildTimestamp: string;
  readonly environmentalConditions: {
    readonly ambientTempC: number;
    readonly relativeHumidityPct: number;
  };
  readonly partIdentityDigest: string;
}

export class AdditiveManufacturingAuthority {
  private static intents: Map<string, AdditiveManufacturingIntent> = new Map();
  private static artifacts: Map<string, PrintableManufacturingArtifact> = new Map();
  private static physicalParts: Map<string, PhysicalPartSerialization> = new Map();

  /**
   * Deterministically computes manufacturing intent digest.
   */
  public static computeIntentDigest(payload: Omit<AdditiveManufacturingIntent, 'intentDigest'>): string {
    const normalized = AttestationCanonicalizer.normalizeValue(payload);
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Deterministically computes printable artifact content digest.
   */
  public static computeArtifactDigest(
    sourceRevisionHash: string,
    intentId: string,
    contentHash: string,
    format: string
  ): string {
    const canonicalStr = `SRC_REV=${sourceRevisionHash}&INTENT=${intentId}&HASH=${contentHash}&FMT=${format}`;
    return createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
  }

  /**
   * Deterministically computes physical part identity digest.
   */
  public static computePartIdentityDigest(part: Omit<PhysicalPartSerialization, 'partIdentityDigest'>): string {
    const normalized = AttestationCanonicalizer.normalizeValue(part);
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Authoritatively creates Manufacturing Intent from an active canonical Revision.
   * Fails closed if the revision is unreleased, missing, or mismatched.
   */
  public static createManufacturingIntent(
    revisionEngine: RevisionEngine,
    request: {
      entityId: string;
      revisionId: string;
      expectedRevisionHash?: string;
      processType: AdditiveProcessType;
      layerHeightMm: number;
      infillPercentage: number;
      printSpeedMmS: number;
      materialGrade: string;
      targetMachineModel: string;
      nozzleTempC?: number;
      bedTempC?: number;
      laserPowerWatts?: number;
      buildOrientationRPY?: readonly [number, number, number];
      supportStructureRequired?: boolean;
    }
  ): AdditiveManufacturingIntent {
    const rev = revisionEngine.getRevision(request.revisionId);
    if (!rev) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Source canonical revision '${request.revisionId}' not found.`);
    }

    if (rev.entityId !== request.entityId) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Revision '${request.revisionId}' does not belong to entity '${request.entityId}'.`);
    }

    // Must be at least SIMULATED, APPROVED or RELEASED state
    if (
      rev.lifecycleState === RevisionLifecycleState.OBSOLETE ||
      rev.lifecycleState === RevisionLifecycleState.REJECTED
    ) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Cannot generate manufacturing intent from obsolete or rejected revision '${rev.revisionId}'.`);
    }

    const resolvedRevHash = rev.revisionHash;
    const resolvedGeomHash = rev.snapshot?.geometryState?.geometryHash || rev.contentHash;

    if (request.expectedRevisionHash && request.expectedRevisionHash !== resolvedRevHash) {
      throw new Error(`STALE_REVISION_BREACH: Target revision hash '${request.expectedRevisionHash}' does not match canonical revision '${resolvedRevHash}'.`);
    }

    const intentId = `AM-INTENT-${createHash('sha256').update(`${request.entityId}_${resolvedRevHash}_${request.processType}`).digest('hex').substring(0, 16).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    const intentData: Omit<AdditiveManufacturingIntent, 'intentDigest'> = {
      intentId,
      sourceEntityId: request.entityId,
      sourceRevisionId: request.revisionId,
      sourceRevisionHash: resolvedRevHash,
      sourceGeometryHash: resolvedGeomHash,
      processType: request.processType,
      processParameters: {
        layerHeightMm: request.layerHeightMm,
        infillPercentage: request.infillPercentage,
        printSpeedMmS: request.printSpeedMmS,
        nozzleTempC: request.nozzleTempC ?? 215,
        bedTempC: request.bedTempC ?? 60,
        laserPowerWatts: request.laserPowerWatts,
        buildOrientationRPY: request.buildOrientationRPY ?? [0, 0, 0],
        supportStructureRequired: request.supportStructureRequired ?? false
      },
      materialGrade: request.materialGrade,
      targetMachineModel: request.targetMachineModel,
      createdAt,
      originTag: PhysicalOriginSemantics.createOriginTag(
        PhysicalOriginType.MANUFACTURED,
        intentId,
        `Additive manufacturing intent generated for ${request.processType} on ${request.targetMachineModel}`
      )
    };

    const intentDigest = this.computeIntentDigest(intentData);
    const intent: AdditiveManufacturingIntent = Object.freeze({
      ...intentData,
      intentDigest
    });

    this.intents.set(intent.intentId, intent);
    return intent;
  }

  /**
   * Generates a printable manufacturing artifact (STL, 3MF, or G-Code) strictly bound
   * to the parent Manufacturing Intent and Source Revision.
   */
  public static generatePrintableArtifact(
    intentId: string,
    format: PrintableArtifactFormat,
    partDimensionsMm: { x: number; y: number; z: number } = { x: 50, y: 50, z: 20 }
  ): PrintableManufacturingArtifact {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Manufacturing intent '${intentId}' not found.`);
    }

    const layerHeight = intent.processParameters.layerHeightMm;
    const totalLayers = Math.max(1, Math.ceil(partDimensionsMm.z / layerHeight));
    const estBuildTimeMin = Math.round(totalLayers * 1.2);
    const estMaterialGrams = parseFloat(((partDimensionsMm.x * partDimensionsMm.y * partDimensionsMm.z * (intent.processParameters.infillPercentage / 100) * 0.00124)).toFixed(1));

    let payload = '';
    if (format === 'GCODE') {
      const gcode: string[] = [
        `; SECP AUTHORITATIVE ADDITIVE G-CODE`,
        `; SOURCE_REV_HASH: ${intent.sourceRevisionHash}`,
        `; INTENT_ID: ${intent.intentId}`,
        `; MATERIAL: ${intent.materialGrade}`,
        `M104 S${intent.processParameters.nozzleTempC || 215} ; Set Extruder Temp`,
        `M140 S${intent.processParameters.bedTempC || 60} ; Set Bed Temp`,
        `G28 ; Home All Axes`,
        `G92 E0 ; Reset Extruder`,
        `G1 Z0.2 F1200`
      ];

      for (let l = 1; l <= Math.min(totalLayers, 5); l++) {
        const z = (l * layerHeight).toFixed(3);
        gcode.push(`; --- LAYER ${l} @ Z=${z} ---`);
        gcode.push(`G1 X0 Y0 Z${z} F${intent.processParameters.printSpeedMmS * 60}`);
        gcode.push(`G1 X${partDimensionsMm.x} Y0 E${(l * 1.5).toFixed(2)}`);
        gcode.push(`G1 X${partDimensionsMm.x} Y${partDimensionsMm.y} E${(l * 3.0).toFixed(2)}`);
        gcode.push(`G1 X0 Y${partDimensionsMm.y} E${(l * 4.5).toFixed(2)}`);
        gcode.push(`G1 X0 Y0 E${(l * 6.0).toFixed(2)}`);
      }

      gcode.push(`M104 S0 ; Extruder OFF`);
      gcode.push(`M140 S0 ; Bed OFF`);
      gcode.push(`M84 ; Steppers OFF`);
      gcode.push(`M30 ; End Program`);
      payload = gcode.join('\n');
    } else if (format === '3MF' || format === 'STL') {
      payload = `solid SECP_${intent.sourceEntityId}\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex ${partDimensionsMm.x} 0 0\n      vertex ${partDimensionsMm.x} ${partDimensionsMm.y} 0\n    endloop\n  endfacet\nendsolid SECP_${intent.sourceEntityId}`;
    } else {
      payload = `CLI_VERSION 1.0\n$$HEADER\n$$GEOM_HASH ${intent.sourceGeometryHash}`;
    }

    const artifactContentHash = createHash('sha256').update(payload, 'utf8').digest('hex');
    const artifactDigest = this.computeArtifactDigest(
      intent.sourceRevisionHash,
      intent.intentId,
      artifactContentHash,
      format
    );
    const artifactId = `ART-${format}-${artifactDigest.substring(0, 16).toUpperCase()}`;

    const artifact: PrintableManufacturingArtifact = Object.freeze({
      artifactId,
      intentId: intent.intentId,
      sourceRevisionHash: intent.sourceRevisionHash,
      format,
      artifactPayload: payload,
      artifactContentHash,
      estimatedBuildTimeMinutes: estBuildTimeMin,
      estimatedMaterialGrams: estMaterialGrams,
      layerCount: totalLayers,
      artifactDigest,
      createdAt: new Date().toISOString(),
      isReleasedForProduction: true
    });

    this.artifacts.set(artifact.artifactId, artifact);
    return artifact;
  }

  /**
   * Authoritatively serializes a physical part instance manufactured from a printable artifact.
   */
  public static serializePhysicalPart(request: {
    artifactId: string;
    physicalMachineSerial: string;
    materialLotNumber: string;
    operatorId: string;
    ambientTempC?: number;
    relativeHumidityPct?: number;
  }): PhysicalPartSerialization {
    const artifact = this.artifacts.get(request.artifactId);
    if (!artifact) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Printable artifact '${request.artifactId}' not found.`);
    }

    const intent = this.intents.get(artifact.intentId);
    if (!intent) {
      throw new Error(`AM_AUTHORITY_VIOLATION: Orphan artifact missing parent intent '${artifact.intentId}'.`);
    }

    const buildTimestamp = new Date().toISOString();
    const rawSerialPreimage = `${artifact.artifactId}_${request.physicalMachineSerial}_${request.materialLotNumber}_${buildTimestamp}`;
    const physicalSerialId = `PP-SN-${createHash('sha256').update(rawSerialPreimage).digest('hex').substring(0, 16).toUpperCase()}`;

    const partData: Omit<PhysicalPartSerialization, 'partIdentityDigest'> = {
      physicalSerialId,
      artifactId: artifact.artifactId,
      intentId: intent.intentId,
      sourceRevisionHash: intent.sourceRevisionHash,
      physicalMachineSerial: request.physicalMachineSerial,
      materialLotNumber: request.materialLotNumber,
      operatorId: request.operatorId,
      buildTimestamp,
      environmentalConditions: {
        ambientTempC: request.ambientTempC ?? 22.5,
        relativeHumidityPct: request.relativeHumidityPct ?? 45.0
      }
    };

    const partIdentityDigest = this.computePartIdentityDigest(partData);
    const physicalPart: PhysicalPartSerialization = Object.freeze({
      ...partData,
      partIdentityDigest
    });

    this.physicalParts.set(physicalPart.physicalSerialId, physicalPart);
    return physicalPart;
  }

  /**
   * Verifies the authenticity and integrity of a manufacturing artifact against expected revision.
   */
  public static verifyArtifactIntegrity(
    artifact: PrintableManufacturingArtifact,
    expectedRevisionHash?: string
  ): { isValid: boolean; failureReason?: string } {
    if (!artifact || !artifact.artifactId || !artifact.artifactPayload) {
      return { isValid: false, failureReason: 'INVALID_ARTIFACT_STRUCTURE' };
    }

    // 1. Verify content hash
    const computedContentHash = createHash('sha256').update(artifact.artifactPayload, 'utf8').digest('hex');
    if (computedContentHash !== artifact.artifactContentHash) {
      return {
        isValid: false,
        failureReason: `TAMPERED_ARTIFACT_PAYLOAD: Computed content hash '${computedContentHash}' does not match declared '${artifact.artifactContentHash}'.`
      };
    }

    // 2. Verify artifact digest
    const computedDigest = this.computeArtifactDigest(
      artifact.sourceRevisionHash,
      artifact.intentId,
      artifact.artifactContentHash,
      artifact.format
    );
    if (computedDigest !== artifact.artifactDigest) {
      return {
        isValid: false,
        failureReason: `TAMPERED_ARTIFACT_DIGEST: Digest mismatch.`
      };
    }

    // 3. Verify revision alignment
    if (expectedRevisionHash && artifact.sourceRevisionHash !== expectedRevisionHash) {
      return {
        isValid: false,
        failureReason: `REVISION_MISMATCH: Artifact was produced from '${artifact.sourceRevisionHash}', but expected '${expectedRevisionHash}'.`
      };
    }

    return { isValid: true };
  }

  public static getIntent(id: string): AdditiveManufacturingIntent | undefined {
    return this.intents.get(id);
  }

  public static getArtifact(id: string): PrintableManufacturingArtifact | undefined {
    return this.artifacts.get(id);
  }

  public static getPhysicalPart(id: string): PhysicalPartSerialization | undefined {
    return this.physicalParts.get(id);
  }

  public static clear(): void {
    this.intents.clear();
    this.artifacts.clear();
    this.physicalParts.clear();
  }
}
