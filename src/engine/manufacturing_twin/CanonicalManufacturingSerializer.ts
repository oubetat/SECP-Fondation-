// SECP Industrial OS v2 — Canonical Manufacturing Serializer & Deterministic Hashing
import * as crypto from 'crypto';
import {
  ManufacturingFeature,
  OperationDefinition,
  ProcessPlan,
  MachineConfiguration,
  ToolAssembly,
  FixtureDefinition,
  ManufacturingSetup,
  Toolpath,
  PostProcessorDefinition,
  NCProgram,
  ExecutionTelemetryPacket,
  ToleranceVerification,
  ManufacturingState
} from './types';

export class CanonicalManufacturingSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  // 1. Canonicalize Feature
  public static canonicalizeFeature(f: ManufacturingFeature): string {
    const sortedParamsKeys = Object.keys(f.parameters).sort();
    const sortedParams: Record<string, number> = {};
    for (const k of sortedParamsKeys) {
      sortedParams[k] = Number(f.parameters[k].toFixed(6));
    }
    return JSON.stringify({
      datumReferences: [...f.datumReferences].sort(),
      featureType: f.featureType,
      geometryEntityId: f.geometryEntityId.trim(),
      geometryHash: f.geometryHash.trim(),
      geometryRevision: f.geometryRevision.trim(),
      materialCondition: f.materialCondition,
      parameters: sortedParams,
      tolerance: {
        lowerLimit: Number(f.tolerance.lowerLimit.toFixed(6)),
        unit: f.tolerance.unit.trim(),
        upperLimit: Number(f.tolerance.upperLimit.toFixed(6))
      }
    });
  }

  // 2. Canonicalize Features Collection
  public static canonicalizeFeatures(features: ManufacturingFeature[] = []): string {
    const arr = features || [];
    const sorted = [...arr].sort((a, b) => a.featureId.localeCompare(b.featureId));
    return JSON.stringify(sorted.map(f => this.canonicalizeFeature(f)));
  }

  // 3. Canonicalize Operation
  public static canonicalizeOperation(op: OperationDefinition): string {
    const sortedParamsKeys = Object.keys(op.parameters).sort();
    const sortedParams: Record<string, number> = {};
    for (const k of sortedParamsKeys) {
      sortedParams[k] = Number(op.parameters[k].toFixed(6));
    }
    return JSON.stringify({
      coolant: op.coolant,
      depthOfCut: Number(op.depthOfCut.toFixed(6)),
      feedRate: Number(op.feedRate.toFixed(6)),
      fixtureId: op.fixtureId.trim(),
      machineId: op.machineId.trim(),
      operationType: op.operationType,
      parameters: sortedParams,
      sequence: op.sequence,
      spindleSpeed: Number(op.spindleSpeed.toFixed(6)),
      stepover: Number(op.stepover.toFixed(6)),
      targetFeatureIds: [...op.targetFeatureIds].sort(),
      toolAssemblyId: op.toolAssemblyId.trim()
    });
  }

  // 4. Canonicalize Process Plan
  public static canonicalizeProcessPlan(plan: ProcessPlan): string {
    const sortedOps = [...plan.operations].sort((a, b) => a.sequence - b.sequence);
    return JSON.stringify({
      machineId: plan.machineId.trim(),
      operations: sortedOps.map(op => this.canonicalizeOperation(op)),
      revision: plan.revision.trim(),
      sequence: plan.sequence
    });
  }

  // 5. Canonicalize Machine Configuration
  public static canonicalizeMachineConfiguration(mc: MachineConfiguration): string {
    return JSON.stringify({
      controllerType: mc.controllerType.trim(),
      controllerVersion: mc.controllerVersion.trim(),
      kinematics: {
        accelerationLimits: mc.kinematics.accelerationLimits,
        axisCount: mc.kinematics.axisCount,
        axisTypes: mc.kinematics.axisTypes,
        homePositions: mc.kinematics.homePositions,
        kinematicChain: mc.kinematics.kinematicChain.trim(),
        pivotLocations: mc.kinematics.pivotLocations,
        travelLimits: mc.kinematics.travelLimits,
        velocityLimits: mc.kinematics.velocityLimits
      },
      kinematicsRevision: mc.kinematicsRevision.trim(),
      machineId: mc.machineId.trim(),
      machineModel: mc.machineModel.trim(),
      machineRevision: mc.machineRevision.trim()
    });
  }

  // 6. Canonicalize Tool Assemblies
  public static canonicalizeToolAssemblies(tools: ToolAssembly[]): string {
    const sorted = [...tools].sort((a, b) => a.toolAssemblyId.localeCompare(b.toolAssemblyId));
    return JSON.stringify(
      sorted.map(t => ({
        cuttingTimeMinutes: Number(t.cuttingTimeMinutes.toFixed(4)),
        holder: {
          diameter: Number(t.holder.diameter.toFixed(4)),
          gaugeLength: Number(t.holder.gaugeLength.toFixed(4)),
          holderId: t.holder.holderId.trim(),
          holderType: t.holder.holderType,
          interface: t.holder.interface.trim(),
          revision: t.holder.revision.trim()
        },
        tool: {
          coating: t.tool.coating.trim(),
          cuttingEdges: t.tool.cuttingEdges,
          diameter: Number(t.tool.diameter.toFixed(4)),
          length: Number(t.tool.length.toFixed(4)),
          material: t.tool.material.trim(),
          revision: t.tool.revision.trim(),
          toolId: t.tool.toolId.trim(),
          toolType: t.tool.toolType
        },
        toolLifeRemaining: Number(t.toolLifeRemaining.toFixed(2)),
        usageCount: t.usageCount,
        wearState: t.wearState
      }))
    );
  }

  // 7. Canonicalize Toolpath
  public static canonicalizeToolpath(toolpath: Toolpath): string {
    return JSON.stringify({
      machineId: toolpath.machineId.trim(),
      operationId: toolpath.operationId.trim(),
      segments: toolpath.segments.map(s => ({
        endPoint: s.endPoint.map(v => Number(v.toFixed(6))),
        feedRate: Number(s.feedRate.toFixed(4)),
        segmentId: s.segmentId.trim(),
        spindleSpeed: Number(s.spindleSpeed.toFixed(4)),
        startPoint: s.startPoint.map(v => Number(v.toFixed(6))),
        toolAxis: s.toolAxis.map(v => Number(v.toFixed(6))),
        type: s.type
      })),
      toolAssemblyId: toolpath.toolAssemblyId.trim(),
      toolpathRevision: toolpath.toolpathRevision.trim()
    });
  }

  // 8. Canonicalize NC Program
  public static canonicalizeNCProgram(nc: NCProgram): string {
    return JSON.stringify({
      gcodeLines: nc.gcodeLines.map(line => line.trim()),
      machineHash: nc.machineHash,
      postProcessorHash: nc.postProcessorHash,
      programRevision: nc.programRevision.trim(),
      toolpathHash: nc.toolpathHash
    });
  }

  // 9. Compute Hashes
  public static computeFeatureHash(f: ManufacturingFeature): string {
    return this.sha256(this.canonicalizeFeature(f));
  }

  public static computeMachineConfigurationHash(mc: MachineConfiguration): string {
    return this.sha256(this.canonicalizeMachineConfiguration(mc));
  }

  public static computeToolpathHash(tp: Toolpath): string {
    return this.sha256(this.canonicalizeToolpath(tp));
  }

  public static computeManufacturingInputHash(state: ManufacturingState): string {
    const geomStr = state.geometryState.geometryHash;
    const matStr = state.materialState.materialId + ':' + state.materialState.materialRevision;
    const featStr = this.canonicalizeFeatures(state.featureState.features);
    const procStr = this.canonicalizeProcessPlan(state.processState.processPlan);
    const mcStr = this.canonicalizeMachineConfiguration(state.machineState.machineConfiguration);
    const toolStr = this.canonicalizeToolAssemblies(state.toolState.toolAssemblies);

    return this.sha256([geomStr, matStr, featStr, procStr, mcStr, toolStr].join('|MFG_INPUT_SEP|'));
  }

  public static computeManufacturingRootHash(hashes: {
    geometryHash: string;
    materialHash: string;
    featureHash: string;
    processHash: string;
    machineHash: string;
    toolHash: string;
    fixtureHash: string;
    toolpathHash: string;
    postHash: string;
    ncHash: string;
    executionHash: string;
    inspectionHash: string;
    asManufacturedHash: string;
    evidenceHash: string;
  }): string {
    const concat = [
      hashes.geometryHash,
      hashes.materialHash,
      hashes.featureHash,
      hashes.processHash,
      hashes.machineHash,
      hashes.toolHash,
      hashes.fixtureHash,
      hashes.toolpathHash,
      hashes.postHash,
      hashes.ncHash,
      hashes.executionHash,
      hashes.inspectionHash,
      hashes.asManufacturedHash,
      hashes.evidenceHash
    ].join('|MFG_ROOT_SEP|');

    return this.sha256(concat);
  }
}
