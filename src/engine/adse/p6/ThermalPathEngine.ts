/**
 * SECP — ADSE-P6 Thermal Path Engine
 * 
 * Manages continuous Thermal Paths and Thermal Resistance Networks.
 * Validates:
 * - End-to-end heat transfer path from Source to Sink/Environment
 * - Equivalent thermal resistance ($R_{eq} = \sum R_i$)
 * - Continuity across segments (no dangling or disconnected intermediate nodes)
 * - Allows legal network cycles/loops while rejecting invalid topologies
 */

import { ThermalPath, ThermalPathSegment, ThermalPathEndpointType } from './types';
import { ThermalRegistry } from './ThermalRegistry';
import { createHash } from 'crypto';

export class ThermalPathEngine {
  private paths: Map<string, ThermalPath> = new Map();
  private registry: ThermalRegistry;

  constructor(registry: ThermalRegistry) {
    this.registry = registry;
  }

  /**
   * Registers a continuous Thermal Path.
   */
  public registerPath(params: {
    pathId: string;
    thermalId: string;
    name: string;
    sourceEndpoint: { type: ThermalPathEndpointType; id: string };
    sinkEndpoint: { type: ThermalPathEndpointType; id: string };
    segments: ThermalPathSegment[];
    configurationId: string;
    revisionId: string;
  }): ThermalPath {
    if (this.paths.has(params.pathId)) {
      throw new Error(`THERMAL_PATH_COLLISION: Thermal Path '${params.pathId}' already exists.`);
    }

    const model = this.registry.getModel(params.thermalId);
    if (!model) {
      throw new Error(`ORPHAN_THERMAL_PATH: Parent Thermal Model '${params.thermalId}' not found.`);
    }

    if (!params.segments || params.segments.length === 0) {
      throw new Error(`EMPTY_THERMAL_PATH: Thermal Path must have at least one segment.`);
    }

    // Continuity and Connectivity Validation
    let currentId = params.sourceEndpoint.id;
    let totalResistance = 0;

    for (let i = 0; i < params.segments.length; i++) {
      const seg = params.segments[i];
      if (i === 0 && seg.fromId !== currentId) {
        throw new Error(`BROKEN_THERMAL_PATH: First segment must start at source endpoint '${currentId}', got '${seg.fromId}'.`);
      }
      if (i > 0 && seg.fromId !== params.segments[i - 1].toId) {
        throw new Error(`DISCONNECTED_PATH_SEGMENTS: Segment ${i} fromId '${seg.fromId}' does not connect to previous toId '${params.segments[i - 1].toId}'.`);
      }
      if (seg.resistanceK_W < 0) {
        throw new Error(`NEGATIVE_THERMAL_RESISTANCE: Segment '${seg.segmentId}' resistance cannot be negative.`);
      }
      totalResistance += seg.resistanceK_W;
      currentId = seg.toId;
    }

    if (currentId !== params.sinkEndpoint.id) {
      throw new Error(`BROKEN_THERMAL_PATH: Last segment ends at '${currentId}', but sink endpoint is '${params.sinkEndpoint.id}'.`);
    }

    const provenanceId = `PROV-PATH-${createHash('sha256')
      .update(`${params.pathId}-${params.sourceEndpoint.id}-${params.sinkEndpoint.id}-${totalResistance}`)
      .digest('hex').substring(0, 16)}`;

    const path: ThermalPath = {
      pathId: params.pathId,
      thermalId: params.thermalId,
      name: params.name,
      sourceEndpoint: params.sourceEndpoint,
      sinkEndpoint: params.sinkEndpoint,
      segments: params.segments,
      equivalentResistanceK_W: totalResistance,
      configurationId: params.configurationId,
      revisionId: params.revisionId,
      provenanceId
    };

    this.paths.set(params.pathId, path);
    return path;
  }

  public getPath(pathId: string): ThermalPath | undefined {
    return this.paths.get(pathId);
  }

  public getPathsForModel(thermalId: string): ThermalPath[] {
    return Array.from(this.paths.values()).filter(p => p.thermalId === thermalId);
  }

  public getAllPaths(): ThermalPath[] {
    return Array.from(this.paths.values());
  }

  public clear(): void {
    this.paths.clear();
  }
}
