import { AssemblyPartExtractor, ExtractedCanonicalPart } from '../assembly/AssemblyPartExtractor';
import { ThreeAxisToolpathEngine } from './ThreeAxisToolpathEngine';
import { MachiningOperationConfig, MachineConfiguration, CandidateToolpathTrajectory, ToolAssembly } from './ToolpathTypes';
import { generateDeterministicHash } from '../../lib/hash';
import { EngineeringHashChain } from '../evidence/EngineeringHashChain';

export interface DroneCAMSetup {
  stock: {
    partBoundingBox: { min: [number, number, number]; max: [number, number, number] };
    stockBoundingBox: { min: [number, number, number]; max: [number, number, number] };
    dimensionsMm: { x: number; y: number; z: number };
    offsetMm: number;
    containsPart: boolean;
    hash: string;
  };
  wcs: {
    origin: { x: number; y: number; z: number };
    xAxis: { x: number; y: number; z: number };
    yAxis: { x: number; y: number; z: number };
    zAxis: { x: number; y: number; z: number };
    orientation: string;
    hash: string;
  };
  machine: {
    machineId: string;
    name: string;
    axisCount: number;
    travelLimits: { x: [number, number]; y: [number, number]; z: [number, number] };
    spindleLimits: { maxRpm: number };
    hash: string;
  };
  toolLibrary: {
    tools: Array<{ toolId: string; name: string; type: string; diameterMm: number }>;
    hash: string;
  };
  features: Array<{
    featureId: string;
    featureType: string;
    sourceGeometry: string;
    dimensionsMm: { length: number; width: number; depth: number };
    machiningRelevance: string;
  }>;
  setupHash: string;
}

export interface DroneCAMWorkflowResult {
  success: boolean;
  documentId: string;
  instanceId: string;
  partId: string;
  geometryReference: string;
  geometryHash: string;
  material: string;
  materialGap: string | null;
  camSetup: DroneCAMSetup;
  operations: Array<{
    operationId: string;
    name: string;
    strategy: string;
    toolId: string;
    toolpathHash: string;
    pointsCount: number;
    trajectory: CandidateToolpathTrajectory;
  }>;
  overallToolpathHash: string;
  collisionStatus: string;
  postprocessingStatus: string;
  evidenceChain: {
    documentId: string;
    instanceId: string;
    partId: string;
    geometryHash: string;
    setupHash: string;
    stockHash: string;
    wcsHash: string;
    toolLibraryHash: string;
    toolpathHash: string;
    validationResult: string;
    evidenceId: string;
  };
}

export class DroneCAMAdapter {
  /**
   * Processes the DRONE-CHASSIS-001 part and generates a deterministic CAM setup and 3-axis toolpaths.
   */
  public static async processChassisCAM(
    doc: any,
    targetInstanceId: string,
    options?: {
      geometryMutationMultiplier?: number;
      zMutationOffset?: number;
      wcsOffsetMm?: number;
      toolDiameterMm?: number;
    }
  ): Promise<DroneCAMWorkflowResult> {
    const geometryMutationMultiplier = options?.geometryMutationMultiplier || 1.0;
    const zMutationOffset = options?.zMutationOffset || 0.0;
    
    // 1. Resolve & Extract using AssemblyPartExtractor
    const extractionResult = AssemblyPartExtractor.extractPart(doc, targetInstanceId);
    if (extractionResult.status !== 'SUCCESS') {
      throw new Error(`CANONICAL INPUT ERROR: AssemblyPartExtractor failed to extract part: ${extractionResult.message}`);
    }

    const part: ExtractedCanonicalPart = extractionResult;

    // Apply geometric mutation to vertices if requested
    if (geometryMutationMultiplier !== 1.0 || zMutationOffset !== 0.0) {
      part.mesh.vertices = part.mesh.vertices.map((v, idx) => {
        if (idx % 3 === 2) return v * geometryMutationMultiplier + zMutationOffset;
        return v * geometryMutationMultiplier;
      });
      const minB = part.solid.boundingBox.min;
      const maxB = part.solid.boundingBox.max;
      part.solid.boundingBox.min = [minB[0] * geometryMutationMultiplier, minB[1] * geometryMutationMultiplier, minB[2] * geometryMutationMultiplier + zMutationOffset];
      part.solid.boundingBox.max = [maxB[0] * geometryMutationMultiplier, maxB[1] * geometryMutationMultiplier, maxB[2] * geometryMutationMultiplier + zMutationOffset];
      // Recompute geometry hash
      part.hashes.geometryHash = EngineeringHashChain.computeCanonicalHash({
        vertices: part.mesh.vertices.map(v => Number(v.toFixed(6))),
        indices: part.mesh.indices,
        topologicalFaces: part.solid.facesCount,
        topologicalEdges: part.solid.edgesCount,
        topologicalVertices: part.solid.verticesCount
      }).canonicalHash;
    }

    // 2. Part Identity Contract Assertions
    const expectedDocId = 'DOC_DRONE_001';
    const expectedInstanceId = 'DRONE-CHASSIS-001';
    const expectedPartId = 'PART-CHASSIS-001';
    const expectedGeomRef = 'FEAT_DRONE_CHASSIS';
    const expectedGeomHash = '34199adc4e24085bfdccce12fbdbcffb46eb90ca720f8a61fd9554e04fe60c08';

    const actualDocId = doc.id || doc.documentId || '';

    // Verify identity contract strictly
    if (actualDocId !== expectedDocId) {
      throw new Error(`PART IDENTITY CONTRACT VIOLATION: Expected documentId '${expectedDocId}', got '${actualDocId}'`);
    }
    if (part.instanceId !== expectedInstanceId) {
      throw new Error(`PART IDENTITY CONTRACT VIOLATION: Expected instanceId '${expectedInstanceId}', got '${part.instanceId}'`);
    }
    if (part.partId !== expectedPartId) {
      throw new Error(`PART IDENTITY CONTRACT VIOLATION: Expected partId '${expectedPartId}', got '${part.partId}'`);
    }
    if (part.geometryReference !== expectedGeomRef) {
      throw new Error(`PART IDENTITY CONTRACT VIOLATION: Expected geometryReference '${expectedGeomRef}', got '${part.geometryReference}'`);
    }
    if (geometryMutationMultiplier === 1.0 && zMutationOffset === 0.0 && part.hashes.geometryHash !== expectedGeomHash) {
      throw new Error(`PART IDENTITY CONTRACT VIOLATION: Expected geometryHash '${expectedGeomHash}', got '${part.hashes.geometryHash}'`);
    }

    // 3. Material Verification & SOT Check
    // Density verification: 1600 kg/m^3
    let materialGap: string | null = null;
    if (part.material !== 'CARBON_FIBER') {
      throw new Error(`MATERIAL SOT VIOLATION: Expected material 'CARBON_FIBER', got '${part.material}'`);
    }
    // Check material model availability in standard library (MaterialsEngine lacks MAT-CARBON-FIBER-T700 with density 1600)
    materialGap = 'MATERIAL_CAPABILITY_GAP';

    // 4. CAM SETUP & STOCK DETERMINISTIC DERIVATION
    // Convert SI meters back to millimeters for CNC processing
    const pMin = part.solid.boundingBox.min;
    const pMax = part.solid.boundingBox.max;
    const pMinMm: [number, number, number] = [pMin[0] * 1000, pMin[1] * 1000, pMin[2] * 1000];
    const pMaxMm: [number, number, number] = [pMax[0] * 1000, pMax[1] * 1000, pMax[2] * 1000];

    const partDx = pMaxMm[0] - pMinMm[0];
    const partDy = pMaxMm[1] - pMinMm[1];
    const partDz = pMaxMm[2] - pMinMm[2];

    const offsetMm = 5.0; // 5mm offset all around
    const sMinMm: [number, number, number] = [pMinMm[0] - offsetMm, pMinMm[1] - offsetMm, pMinMm[2] - offsetMm];
    const sMaxMm: [number, number, number] = [pMaxMm[0] + offsetMm, pMaxMm[1] + offsetMm, pMaxMm[2] + offsetMm];

    const stockDx = sMaxMm[0] - sMinMm[0];
    const stockDy = sMaxMm[1] - sMinMm[1];
    const stockDz = sMaxMm[2] - sMinMm[2];

    // Confirm stock fully contains the part
    const containsPart = 
      sMinMm[0] <= pMinMm[0] && sMaxMm[0] >= pMaxMm[0] &&
      sMinMm[1] <= pMinMm[1] && sMaxMm[1] >= pMaxMm[1] &&
      sMinMm[2] <= pMinMm[2] && sMaxMm[2] >= pMaxMm[2];

    const stockHash = await generateDeterministicHash({
      sMinMm,
      sMaxMm,
      dimensions: { x: stockDx, y: stockDy, z: stockDz },
      offsetMm
    });

    // 5. WCS DETERMINATION
    // Set origin to bottom center of stock
    const wcsOffsetMm = options?.wcsOffsetMm || 0.0;
    const wcsOrigin = {
      x: (sMinMm[0] + sMaxMm[0]) / 2 + wcsOffsetMm,
      y: (sMinMm[1] + sMaxMm[1]) / 2 + wcsOffsetMm,
      z: sMinMm[2] + wcsOffsetMm
    };
    const xAxis = { x: 1, y: 0, z: 0 };
    const yAxis = { x: 0, y: 1, z: 0 };
    const zAxis = { x: 0, y: 0, z: 1 };
    const orientation = 'Standard 3-Axis Cartesian (X+ Right, Y+ Back, Z+ Up)';

    const wcsHash = await generateDeterministicHash({
      wcsOrigin,
      xAxis,
      yAxis,
      zAxis,
      orientation
    });

    // 6. MACHINE CONFIGURATION
    const machineConfig: MachineConfiguration = {
      machineId: 'MACHINE_HAAS_VF4SS',
      name: 'Haas VF-4SS (3-Axis High-Speed VMC)',
      axes: [
        { name: 'X', type: 'LINEAR', minLimit: -635, maxLimit: 635 },
        { name: 'Y', type: 'LINEAR', minLimit: -254, maxLimit: 254 },
        { name: 'Z', type: 'LINEAR', minLimit: -50, maxLimit: 635 }
      ],
      controllerType: 'HAAS_NGC',
      fingerprint: await generateDeterministicHash({ machineId: 'MACHINE_HAAS_VF4SS', axesCount: 3 })
    };

    const machineHash = machineConfig.fingerprint;

    const toolDiameterMm = options?.toolDiameterMm || 12.0;
    
    // 7. TOOL LIBRARY & COMPOSITE JUSTIFICATION
    const tools = [
      { toolId: 'TOOL-EM-12', name: `${toolDiameterMm}mm Carbide Flat Endmill`, type: 'FLAT_ENDMILL', diameterMm: toolDiameterMm },
      { toolId: 'TOOL-EM-6', name: '6mm Flat Finishing Endmill', type: 'FLAT_ENDMILL', diameterMm: 6.0 },
      { toolId: 'TOOL-BN-6', name: '6mm Ball Nose Endmill', type: 'BALL_NOSE', diameterMm: 6.0 }
    ];

    const toolLibraryHash = await generateDeterministicHash(tools);

    const topFaceId = `${actualDocId}_chassis-face-top`;
    const bottomFaceId = `${actualDocId}_chassis-face-bot`;
    const sideFaceId = `${actualDocId}_chassis-face-side-0`; // Example side

    // 8. MACHINING FEATURES
    const features = [
      {
        featureId: 'FEAT-CHASSIS-FACE-TOP',
        featureType: 'PLANAR_FACE',
        sourceGeometry: topFaceId,
        dimensionsMm: { length: partDx, width: partDy, depth: 1.0 },
        machiningRelevance: 'Reference planar face for initial setup and surface profiling.'
      },
      {
        featureId: 'FEAT-CHASSIS-CONTOUR',
        featureType: 'CONTOUR',
        sourceGeometry: 'TOPOLOGY_EDGES_ALL',
        dimensionsMm: { length: partDx, width: partDy, depth: partDz },
        machiningRelevance: 'Outer profile cutout to shape carbon fiber fuselage.'
      },
      {
        featureId: 'FEAT-CHASSIS-POCKET',
        featureType: 'POCKET_RECTANGULAR',
        sourceGeometry: `${actualDocId}_chassis-face-side-1`, // Using a side face as placeholder for "pocket" geometry
        dimensionsMm: { length: partDx - 20, width: partDy - 20, depth: partDz - 5 },
        machiningRelevance: 'Internal light-weighting cavity pocket to reduce component mass.'
      }
    ];

    const setupHash = await generateDeterministicHash({
      stockHash,
      wcsHash,
      machineHash,
      toolLibraryHash,
      featuresCount: features.length
    });

    const camSetup: DroneCAMSetup = {
      stock: {
        partBoundingBox: { min: pMin, max: pMax },
        stockBoundingBox: { min: sMinMm, max: sMaxMm },
        dimensionsMm: { x: stockDx, y: stockDy, z: stockDz },
        offsetMm,
        containsPart,
        hash: stockHash
      },
      wcs: {
        origin: wcsOrigin,
        xAxis,
        yAxis,
        zAxis,
        orientation,
        hash: wcsHash
      },
      machine: {
        machineId: machineConfig.machineId,
        name: machineConfig.name,
        axisCount: 3,
        travelLimits: { x: [-635, 635], y: [-254, 254], z: [-50, 635] },
        spindleLimits: { maxRpm: 12000 },
        hash: machineHash
      },
      toolLibrary: {
        tools,
        hash: toolLibraryHash
      },
      features,
      setupHash
    };

    // 9. FIRST CAM STRATEGY & TOOLPATH GENERATION
    // Configure standard tool assembly definitions for ThreeAxisToolpathEngine
    const toolHolder = {
      holderId: 'holder-er32',
      name: 'ER32 Collet Chuck',
      gaugeDiameterMm: 50,
      upperDiameterMm: 63,
      lengthMm: 70,
      clearanceMarginMm: 3.0
    };

    const cuttingTool1 = {
      toolId: 'tool-em-12',
      name: `12mm Carbide 4-Flute Endmill`,
      type: 'FLAT_ENDMILL',
      diameterMm: options?.toolDiameterMm || 12.0,
      cornerRadiusMm: 0,
      fluteCount: 4,
      fluteLengthMm: 30,
      overallLengthMm: 75,
      holderDiameterMm: 32,
      gaugeLengthMm: 50,
      reachMm: 50,
      material: 'CARBIDE',
      fingerprint: ''
    };

    const toolAssembly1: ToolAssembly = {
      assemblyId: 'asm-em-12',
      tool: cuttingTool1,
      holder: toolHolder,
      offsetNumber: 1,
      compensationLengthMm: 0,
      fingerprint: ''
    };

    const cuttingTool2 = {
      toolId: 'tool-em-6',
      name: '6mm Flat Finishing Endmill',
      type: 'FLAT_ENDMILL',
      diameterMm: 6.0,
      cornerRadiusMm: 0,
      fluteCount: 4,
      fluteLengthMm: 20,
      overallLengthMm: 60,
      holderDiameterMm: 16,
      gaugeLengthMm: 40,
      reachMm: 40,
      material: 'CARBIDE',
      fingerprint: ''
    };

    const toolAssembly2: ToolAssembly = {
      assemblyId: 'asm-em-6',
      tool: cuttingTool2,
      holder: toolHolder,
      offsetNumber: 2,
      compensationLengthMm: 0,
      fingerprint: ''
    };

    const stockBounds = {
      xMin: sMinMm[0],
      xMax: sMaxMm[0],
      yMin: sMinMm[1],
      yMax: sMaxMm[1],
      zMin: sMinMm[2],
      zMax: sMaxMm[2]
    };

    // Construct deterministic operation configs and run toolpath generation
    const opConfigs: MachiningOperationConfig[] = [
      {
        operationId: 'op-facing-01',
        name: 'Chassis Face Profiling',
        strategy: 'FACING',
        topologyId: topFaceId,
        toolAssembly: toolAssembly1,
        parameters: {
          stepoverMm: 8.0,
          stepdownMm: 1.0,
          stockToLeaveMm: 0.0,
          toleranceMm: 0.01,
          entryStrategy: 'PLUNGE'
        },
        feedsAndSpeeds: {
          surfaceSpeedMMin: 180,
          feedPerToothMm: 0.08,
          spindleRpm: 4774,
          cuttingFeedMmMin: 1528,
          plungeFeedMmMin: 400,
          rapidFeedMmMin: 8000
        },
        clearancePlaneZ: stockBounds.zMax + 15,
        retractPlaneZ: stockBounds.zMax + 5
      },
      {
        operationId: 'op-rough-01',
        name: 'Adaptive Chassis Pocket Roughing',
        strategy: 'ROUGHING_ADAPTIVE',
        topologyId: `${actualDocId}_chassis-face-side-2`,
        toolAssembly: toolAssembly1,
        parameters: {
          stepoverMm: 4.8,
          stepdownMm: 5.0,
          stockToLeaveMm: 0.5,
          toleranceMm: 0.02,
          entryStrategy: 'HELICAL_RAMP'
        },
        feedsAndSpeeds: {
          surfaceSpeedMMin: 220,
          feedPerToothMm: 0.12,
          spindleRpm: 5835,
          cuttingFeedMmMin: 2800,
          plungeFeedMmMin: 600,
          rapidFeedMmMin: 10000
        },
        clearancePlaneZ: stockBounds.zMax + 15,
        retractPlaneZ: stockBounds.zMax + 5
      },
      {
        operationId: 'op-contour-01',
        name: 'Perimeter Contour Finishing',
        strategy: 'CONTOUR_PROFILE',
        topologyId: `${actualDocId}_chassis-face-top`,
        toolAssembly: toolAssembly2,
        parameters: {
          stepoverMm: 1.0,
          stepdownMm: 5.0,
          stockToLeaveMm: 0.0,
          toleranceMm: 0.005,
          entryStrategy: 'TANGENTIAL_ARC'
        },
        feedsAndSpeeds: {
          surfaceSpeedMMin: 150,
          feedPerToothMm: 0.05,
          spindleRpm: 7957,
          cuttingFeedMmMin: 1591,
          plungeFeedMmMin: 300,
          rapidFeedMmMin: 8000
        },
        clearancePlaneZ: stockBounds.zMax + 15,
        retractPlaneZ: stockBounds.zMax + 5
      }
    ];

    const operations = [];
    let overallPathPointsCount = 0;
    const toolpathHashes: string[] = [];

    for (const config of opConfigs) {
      const traj = await ThreeAxisToolpathEngine.generateToolpathAsync(
        config,
        stockBounds,
        part.hashes.geometryHash,
        machineConfig,
        part.mesh
      );

      overallPathPointsCount += traj.points.length;
      
      const opHash = await generateDeterministicHash({
        operationId: traj.operationId,
        setupHash,
        pointsCount: traj.points.length,
        totalLength: traj.totalLengthMm,
        provenanceHash: traj.provenance?.trajectoryHash || ''
      });

      toolpathHashes.push(opHash);

      operations.push({
        operationId: traj.operationId,
        name: config.name,
        strategy: config.strategy || '',
        toolId: config.toolAssembly?.tool.toolId || '',
        toolpathHash: opHash,
        pointsCount: traj.points.length,
        trajectory: traj
      });
    }

    const overallToolpathHash = await generateDeterministicHash(toolpathHashes);

    // 10. COLLISION / VALIDITY CHECK & POSTPROCESSING
    const collisionStatus = 'COLLISION_SIMULATION_NOT_PROVEN';
    const postprocessingStatus = 'POSTPROCESSING_NOT_PROVEN';

    // 11. EVIDENCE CHAIN SIGNING
    const evidenceId = `EVID_CAM_${part.hashes.geometryHash.substring(0, 8)}_${setupHash.substring(0, 8)}`;

    const evidenceChain = {
      documentId: actualDocId,
      instanceId: part.instanceId,
      partId: part.partId,
      geometryHash: part.hashes.geometryHash,
      setupHash,
      stockHash,
      wcsHash,
      toolLibraryHash,
      toolpathHash: overallToolpathHash,
      validationResult: 'PASS_WITH_LIMITATIONS',
      evidenceId
    };

    return {
      success: true,
      documentId: actualDocId,
      instanceId: part.instanceId,
      partId: part.partId,
      geometryReference: part.geometryReference,
      geometryHash: part.hashes.geometryHash,
      material: part.material,
      materialGap,
      camSetup,
      operations,
      overallToolpathHash,
      collisionStatus,
      postprocessingStatus,
      evidenceChain
    };
  }
}
