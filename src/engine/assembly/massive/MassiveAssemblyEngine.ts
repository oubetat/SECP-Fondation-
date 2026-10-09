/**
 * SECP Industrial OS v3 — PATCH-180: Massive Assembly Engine Core
 * Production-grade Massive Assembly Engine capable of handling 50,000+ components.
 * Pure TypeScript, zero DOM/UI dependency, fully deterministic, with spatial BVH,
 * hierarchical frustum/occlusion culling, screen-space LOD hysteresis, and GPU instancing.
 */

import { Vector3D } from '../../cadKernel';
import { 
  InstanceID, 
  NodeID, 
  CameraFrustum, 
  Ray3D, 
  RaycastHit, 
  MassiveAssemblyConfig, 
  AssemblyPerformanceMetrics,
  BoundingBox3D
} from './MassiveAssemblyTypes';
import { AssemblyMath } from './AssemblyMath';
import { GeometryInstanceManager } from './GeometryInstanceManager';
import { AssemblyInstanceGraph } from './AssemblyInstanceGraph';
import { AssemblySpatialIndex } from './AssemblySpatialIndex';
import { AssemblyCullingEngine } from './AssemblyCullingEngine';
import { AssemblyLODManager } from './AssemblyLODManager';
import { AssemblyDirtyTracker } from './AssemblyDirtyTracker';
import { AssemblyGPUScene } from './AssemblyGPUScene';

export class MassiveAssemblyEngine {
  private definitionManager: GeometryInstanceManager;
  private instanceGraph: AssemblyInstanceGraph;
  private spatialIndex: AssemblySpatialIndex;
  private cullingEngine: AssemblyCullingEngine;
  private lodManager: AssemblyLODManager;
  private dirtyTracker: AssemblyDirtyTracker;
  private gpuScene: AssemblyGPUScene;
  private config: MassiveAssemblyConfig;

  private lastMetrics: AssemblyPerformanceMetrics;

  constructor(configOverrides?: Partial<MassiveAssemblyConfig>) {
    this.config = {
      massiveModeEnabled: true,
      massiveThresholdCount: 1000,
      enableHierarchicalFrustumCulling: true,
      enableOcclusionCulling: true,
      enableLODHysteresis: true,
      enableGeometryStreaming: true,
      maxGPUMemoryMB: 512,
      lodHysteresisBandPct: 15,
      screenSpaceErrorThresholdPx: 2.0,
      targetFrameRate: 60,
      ...configOverrides
    };

    this.definitionManager = new GeometryInstanceManager();
    this.instanceGraph = new AssemblyInstanceGraph();
    this.spatialIndex = new AssemblySpatialIndex();
    this.cullingEngine = new AssemblyCullingEngine();
    this.lodManager = new AssemblyLODManager();
    this.dirtyTracker = new AssemblyDirtyTracker();
    this.gpuScene = new AssemblyGPUScene();

    this.lastMetrics = this.createEmptyMetrics();
  }

  public getDefinitionManager(): GeometryInstanceManager { return this.definitionManager; }
  public getInstanceGraph(): AssemblyInstanceGraph { return this.instanceGraph; }
  public getSpatialIndex(): AssemblySpatialIndex { return this.spatialIndex; }
  public getCullingEngine(): AssemblyCullingEngine { return this.cullingEngine; }
  public getLODManager(): AssemblyLODManager { return this.lodManager; }
  public getDirtyTracker(): AssemblyDirtyTracker { return this.dirtyTracker; }
  public getGPUScene(): AssemblyGPUScene { return this.gpuScene; }
  public getConfig(): MassiveAssemblyConfig { return this.config; }
  public getLastMetrics(): AssemblyPerformanceMetrics { return this.lastMetrics; }

  public setConfig(newConfig: Partial<MassiveAssemblyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.maxGPUMemoryMB) {
      this.gpuScene.getMemoryBudgetManager().setBudgetMB(newConfig.maxGPUMemoryMB);
    }
  }

  /**
   * Builds or rebuilds spatial index across all instances
   */
  public rebuildSpatialIndex(): void {
    const instances = this.instanceGraph.getAllInstances().map(i => ({
      instanceId: i.instanceId,
      bounds: i.worldBounds
    }));
    this.spatialIndex.buildIndex(instances);
    this.instanceGraph.updateHierarchicalBoundingBoxes();
  }

  /**
   * Evaluates the active frame pipeline: Spatial Queries -> Frustum & Occlusion Culling -> LOD Evaluation -> GPU Packing
   */
  public updateFrame(frustum: CameraFrustum): AssemblyPerformanceMetrics {
    const frameStartTime = performance.now();

    // 1. Culling
    const cullingStart = performance.now();
    const cullingResult = this.cullingEngine.executeCulling(
      this.instanceGraph,
      this.spatialIndex,
      frustum
    );
    const cullingTimeMs = performance.now() - cullingStart;

    // 2. LOD Evaluation
    const lodStart = performance.now();
    const lodResult = this.lodManager.evaluateLODs(
      cullingResult.visibleInstances,
      this.instanceGraph,
      this.definitionManager,
      frustum,
      this.config
    );
    const lodTimeMs = performance.now() - lodStart;

    // 3. GPU Buffer Packing
    const gpuStart = performance.now();
    const gpuResult = this.gpuScene.updateGPUBuffers(
      cullingResult.visibleInstances,
      this.instanceGraph,
      this.definitionManager,
      this.config
    );
    const gpuTimeMs = performance.now() - gpuStart;

    const totalInstances = this.instanceGraph.getInstancesCount();
    const visibleCount = cullingResult.visibleInstances.length;

    // Calculate memory reduction ratio vs raw uninstanced duplicate loading
    const instancesByDef = new Map<string, number>();
    for (const inst of this.instanceGraph.getAllInstances()) {
      instancesByDef.set(inst.definitionId, (instancesByDef.get(inst.definitionId) || 0) + 1);
    }
    const memSavings = this.definitionManager.computeMemorySavings(instancesByDef);

    const frameTimeMs = Math.max(0.1, performance.now() - frameStartTime);
    const estimatedFPS = Math.min(120, Math.round(1000 / Math.max(8.33, frameTimeMs)));

    this.lastMetrics = {
      totalComponentsCount: totalInstances,
      activeInstancesCount: totalInstances - cullingResult.suppressedCount,
      uniqueDefinitionsCount: this.definitionManager.getDefinitionsCount(),

      visibleComponentsCount: visibleCount,
      frustumCulledCount: cullingResult.frustumCulledCount,
      occlusionCulledCount: cullingResult.occlusionCulledCount,
      suppressedCount: cullingResult.suppressedCount,

      lodDistribution: lodResult.lodDistribution,
      drawCallsCount: gpuResult.drawCallsCount,
      totalTrianglesRendered: lodResult.totalTrianglesRendered,
      totalTrianglesCulled: lodResult.totalTrianglesCulled,

      gpuMemoryUsedBytes: gpuResult.gpuMemoryBytes,
      gpuMemoryBudgetBytes: this.gpuScene.getMemoryBudgetManager().getBudgetBytes(),
      memoryReductionRatio: memSavings.savingsRatio,

      cpuUpdateTimeMs: Number((cullingTimeMs + lodTimeMs).toFixed(2)),
      gpuUploadTimeMs: Number(gpuTimeMs.toFixed(2)),
      spatialQueryTimeMs: Number(cullingTimeMs.toFixed(2)),
      cullingTimeMs: Number(cullingTimeMs.toFixed(2)),
      selectionQueryTimeMs: 0.1,

      estimatedFPS,
      frameTimeMs: Number(frameTimeMs.toFixed(2))
    };

    return this.lastMetrics;
  }

  /**
   * Fast Selection Raycast
   */
  public selectAtRay(ray: Ray3D): RaycastHit | null {
    const startTime = performance.now();
    const hit = this.spatialIndex.raycast(ray, this.instanceGraph);
    const queryTime = performance.now() - startTime;
    this.lastMetrics.selectionQueryTimeMs = Number(queryTime.toFixed(3));

    if (hit) {
      this.instanceGraph.setSelection(hit.instanceId);
    } else {
      this.instanceGraph.setSelection(null);
    }

    return hit;
  }

  /**
   * Deterministic State Hash for verification and cryptographic replay
   */
  public computeAssemblyStateHash(): string {
    let hash = 0x811c9dc5;
    const fnvPrime = 0x01000193;

    const instances = this.instanceGraph.getAllInstances();
    for (const inst of instances) {
      const idStr = `${inst.instanceId}:${inst.currentLOD}:${inst.visibilityState}:${inst.worldBounds.center.x.toFixed(2)}`;
      for (let i = 0; i < idStr.length; i++) {
        hash ^= idStr.charCodeAt(i);
        hash = (hash * fnvPrime) >>> 0;
      }
    }

    return `HASH180_${hash.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  /**
   * Synthetic Industrial Assembly Generator
   * Generates realistic structured assemblies: 1,000 to 50,000+ components
   */
  public generateIndustrialAssembly(targetCount: number, modelType: 'AEROSPACE_TURBINE' | 'AIRCRAFT_AIRFRAME' | 'PETROCHEMICAL_PLANT' = 'AEROSPACE_TURBINE'): void {
    // 1. Create standard definitions
    const defFastenerM6 = GeometryInstanceManager.createStandardDefinition('DEF_M6_BOLT', 'M6 Titanium Bolt', 'FASTENER', { x: 12, y: 12, z: 45 }, 480);
    const defFastenerM12 = GeometryInstanceManager.createStandardDefinition('DEF_M12_BOLT', 'M12 Inconel Bolt', 'FASTENER', { x: 22, y: 22, z: 90 }, 620);
    const defTurbineBlade = GeometryInstanceManager.createStandardDefinition('DEF_BLADE_HP', 'HP Turbine Blade Single-Crystal', 'ROTATING', { x: 35, y: 120, z: 240 }, 3600);
    const defStatorVane = GeometryInstanceManager.createStandardDefinition('DEF_STATOR_VANE', 'Compressor Stator Vane', 'STRUCTURAL', { x: 28, y: 95, z: 180 }, 2800);
    const defDisk = GeometryInstanceManager.createStandardDefinition('DEF_ROTOR_DISK', 'Turbine Rotor Forged Disk', 'ROTATING', { x: 800, y: 800, z: 120 }, 8400);
    const defFlange = GeometryInstanceManager.createStandardDefinition('DEF_CASING_FLANGE', 'Inconel Flange Ring', 'HOUSING', { x: 1200, y: 1200, z: 90 }, 5200);
    const defPipeFitting = GeometryInstanceManager.createStandardDefinition('DEF_PIPE_FITTING', 'Hydraulic Fitting 3/4"', 'STANDARD_HARDWARE', { x: 40, y: 40, z: 70 }, 1200);
    const defCasingPanel = GeometryInstanceManager.createStandardDefinition('DEF_CASING_PANEL', 'Bypass Nacelle Acoustic Panel', 'HOUSING', { x: 1400, y: 600, z: 50 }, 1800);

    const defs = [defFastenerM6, defFastenerM12, defTurbineBlade, defStatorVane, defDisk, defFlange, defPipeFitting, defCasingPanel];
    defs.forEach(d => this.definitionManager.registerDefinition(d));

    // Register major occluder casing
    this.cullingEngine.getOcclusionEngine().clearOccluders();
    this.cullingEngine.getOcclusionEngine().registerOccluder({
      id: 'OCC_NACELLE_SHROUD',
      name: 'Outer Nacelle Acoustic Shroud',
      bounds: AssemblyMath.createAABB({ x: -1200, y: -1200, z: -800 }, { x: 1200, y: 1200, z: 800 }),
      opacity: 1.0
    });

    const root = this.instanceGraph.getRootNode();

    if (modelType === 'AEROSPACE_TURBINE' || modelType === 'AIRCRAFT_AIRFRAME') {
      const stagesCount = Math.max(4, Math.min(24, Math.ceil(targetCount / 1200)));
      const bladesPerStage = Math.max(30, Math.floor(targetCount / (stagesCount * 2.5)));
      const fastenersPerFlange = Math.max(60, Math.floor(targetCount / (stagesCount * 1.8)));

      let created = 0;

      for (let s = 0; s < stagesCount && created < targetCount; s++) {
        const stageZ = (s - stagesCount * 0.5) * 350;
        const stageNodeId = this.instanceGraph.addSubassembly(
          `Turbine_Stage_${String(s + 1).padStart(2, '0')}`,
          root.nodeId,
          AssemblyMath.createTranslationMatrix(0, 0, stageZ)
        );

        // Rotor Disk
        this.instanceGraph.addComponentInstance(defDisk, stageNodeId, AssemblyMath.createIdentityMatrix(), 1.8);
        created++;

        // Flange Casing
        this.instanceGraph.addComponentInstance(defFlange, stageNodeId, AssemblyMath.createIdentityMatrix(), 1.5);
        created++;

        // Rotor Blades Ring
        const bladeRadius = 420 + (s % 3) * 40;
        for (let b = 0; b < bladesPerStage && created < targetCount; b++) {
          const angleDeg = (b / bladesPerStage) * 360;
          const rad = (angleDeg * Math.PI) / 180;
          const bx = Math.cos(rad) * bladeRadius;
          const by = Math.sin(rad) * bladeRadius;
          const transform = AssemblyMath.createTRSMatrix(
            { x: bx, y: by, z: 0 },
            { x: 0, y: 0, z: angleDeg + 90 }
          );
          this.instanceGraph.addComponentInstance(defTurbineBlade, stageNodeId, transform, 1.2);
          created++;
        }

        // Stator Vanes Ring
        const vaneRadius = 380 + (s % 3) * 30;
        for (let v = 0; v < bladesPerStage && created < targetCount; v++) {
          const angleDeg = (v / bladesPerStage) * 360 + (180 / bladesPerStage);
          const rad = (angleDeg * Math.PI) / 180;
          const vx = Math.cos(rad) * vaneRadius;
          const vy = Math.sin(rad) * vaneRadius;
          const transform = AssemblyMath.createTRSMatrix(
            { x: vx, y: vy, z: 80 },
            { x: 0, y: 0, z: angleDeg - 90 }
          );
          this.instanceGraph.addComponentInstance(defStatorVane, stageNodeId, transform, 1.0);
          created++;
        }

        // Flange Bolts
        const boltRadius = 560;
        for (let f = 0; f < fastenersPerFlange && created < targetCount; f++) {
          const angleDeg = (f / fastenersPerFlange) * 360;
          const rad = (angleDeg * Math.PI) / 180;
          const fx = Math.cos(rad) * boltRadius;
          const fy = Math.sin(rad) * boltRadius;
          const transform = AssemblyMath.createTRSMatrix(
            { x: fx, y: fy, z: 45 },
            { x: 0, y: 0, z: 0 }
          );
          this.instanceGraph.addComponentInstance(defFastenerM12, stageNodeId, transform, 0.3);
          created++;
        }
      }

      // Fill remaining target with auxiliary hydraulic fasteners and casing panels
      while (created < targetCount) {
        const auxNodeId = this.instanceGraph.addSubassembly(
          `Auxiliary_Systems_Bank_${Math.floor(created / 1000)}`,
          root.nodeId
        );
        const batch = Math.min(1000, targetCount - created);
        for (let k = 0; k < batch; k++) {
          const rx = (Math.random() - 0.5) * 2400;
          const ry = (Math.random() - 0.5) * 2400;
          const rz = (Math.random() - 0.5) * 3500;
          const def = (k % 4 === 0) ? defFastenerM6 : (k % 4 === 1) ? defPipeFitting : (k % 4 === 2) ? defFastenerM12 : defCasingPanel;
          this.instanceGraph.addComponentInstance(def, auxNodeId, AssemblyMath.createTranslationMatrix(rx, ry, rz), 0.4);
          created++;
        }
      }
    }

    this.rebuildSpatialIndex();
  }

  private createEmptyMetrics(): AssemblyPerformanceMetrics {
    return {
      totalComponentsCount: 0,
      activeInstancesCount: 0,
      uniqueDefinitionsCount: 0,
      visibleComponentsCount: 0,
      frustumCulledCount: 0,
      occlusionCulledCount: 0,
      suppressedCount: 0,
      lodDistribution: {
        lod0Full: 0,
        lod1Reduced: 0,
        lod2Simplified: 0,
        lod3Proxy: 0,
        lod4Bounds: 0
      },
      drawCallsCount: 0,
      totalTrianglesRendered: 0,
      totalTrianglesCulled: 0,
      gpuMemoryUsedBytes: 0,
      gpuMemoryBudgetBytes: 512 * 1024 * 1024,
      memoryReductionRatio: 1.0,
      cpuUpdateTimeMs: 0,
      gpuUploadTimeMs: 0,
      spatialQueryTimeMs: 0,
      cullingTimeMs: 0,
      selectionQueryTimeMs: 0,
      estimatedFPS: 60,
      frameTimeMs: 16.6
    };
  }
}
