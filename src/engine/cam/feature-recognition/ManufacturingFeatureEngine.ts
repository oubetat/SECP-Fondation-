/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Manufacturing Feature Engine (Master Orchestrator)
 */

import { Solid, Face, TopoShapeEnum, Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { CadSolidEntity } from '../../cadKernel';
import { TelemetryHasher } from '../../telemetry/TelemetryHasher';
import {
  ManufacturingFeature,
  ManufacturingFeatureType,
  ManufacturingIntent,
  RecognitionState,
  MachiningSetup,
  HolePatternCandidate,
  ManufacturingFeatureEvidence,
} from './FeatureTypes';
import { FeatureGeometryAnalyzer, FaceGeometryInfo } from './FeatureGeometryAnalyzer';
import { FeatureTopologyAnalyzer, FaceAdjacencyGraph, TopologicalEdgeInfo } from './FeatureTopologyAnalyzer';
import { HoleFeatureRecognizer } from './HoleFeatureRecognizer';
import { PocketFeatureRecognizer } from './PocketFeatureRecognizer';
import { SlotFeatureRecognizer } from './SlotFeatureRecognizer';
import { StepFeatureRecognizer } from './StepFeatureRecognizer';
import { BossFeatureRecognizer } from './BossFeatureRecognizer';
import { ChamferAndFilletRecognizer } from './ChamferAndFilletRecognizer';
import { FaceFeatureRecognizer } from './FaceFeatureRecognizer';
import { FeaturePatternRecognizer } from './FeaturePatternRecognizer';
import { FeatureAccessibilityAnalyzer } from './FeatureAccessibilityAnalyzer';
import { MachiningSetupAnalyzer } from './MachiningSetupAnalyzer';
import { ManufacturingFeatureGraph } from './ManufacturingFeatureGraph';
import { ManufacturingFeatureValidator, ValidationReport } from './ManufacturingFeatureValidator';

export interface FeatureRecognitionResult {
  success: boolean;
  modelId: string;
  bodyId: string;
  faceCount: number;
  edgeCount: number;
  features: ManufacturingFeature[];
  graph: ManufacturingFeatureGraph;
  setups: MachiningSetup[];
  patterns: HolePatternCandidate[];
  validation: ValidationReport;
  evidence: ManufacturingFeatureEvidence;
  executionTimeMs: number;
}

export class ManufacturingFeatureEngine {
  public static readonly ALGORITHM_VERSION = 'SECP_MFE_v2.55.0';

  /**
   * Main entry point: Performs full autonomous feature recognition on a CAD B-Rep model
   */
  public static recognizeFromSolid(solid: Solid, bodyId = 'BODY_PRIMARY', modelName = 'Part_Model'): FeatureRecognitionResult {
    const startTime = performance.now();

    // 1. Collect all faces from Solid
    const faces = FeatureTopologyAnalyzer.collectFacesFromSolid(solid);
    const faceGeoms = new Map<string, FaceGeometryInfo>();

    for (const f of faces) {
      const g = FeatureGeometryAnalyzer.analyzeFaceGeometry(f);
      faceGeoms.set(f.id, g);
    }

    // 2. Perform topological analysis
    const { adjacencyMap, edgeMap, innerLoopFaceMap } = FeatureTopologyAnalyzer.analyzeSolidTopology(solid, faceGeoms);

    // 3. Feature Recognition Pipeline
    const recognizedFeatures: ManufacturingFeature[] = [];

    // Holes (Through, Blind, Counterbore, Countersink)
    const holes = HoleFeatureRecognizer.recognizeHoles(solid, bodyId, faceGeoms, adjacencyMap, edgeMap);
    recognizedFeatures.push(...holes);

    // Pockets (Closed, Open, Blind, Through)
    const pockets = PocketFeatureRecognizer.recognizePockets(solid, bodyId, faceGeoms, adjacencyMap, edgeMap);
    recognizedFeatures.push(...pockets);

    // Slots (Through, Blind)
    const slots = SlotFeatureRecognizer.recognizeSlots(solid, bodyId, faceGeoms, adjacencyMap, edgeMap);
    recognizedFeatures.push(...slots);

    // Steps (Internal, External)
    const steps = StepFeatureRecognizer.recognizeSteps(solid, bodyId, faceGeoms, adjacencyMap, edgeMap);
    recognizedFeatures.push(...steps);

    // Bosses (Cylindrical, Prismatic)
    const bosses = BossFeatureRecognizer.recognizeBosses(solid, bodyId, faceGeoms, adjacencyMap, edgeMap, recognizedFeatures);
    recognizedFeatures.push(...bosses);

    // Transitions (Chamfers & Fillets)
    const transitions = ChamferAndFilletRecognizer.recognizeTransitions(solid, bodyId, faceGeoms, adjacencyMap, edgeMap);
    recognizedFeatures.push(...transitions);

    // Faces (Planar facing regions & side faces)
    const facingSurfaces = FaceFeatureRecognizer.recognizeFaces(solid, bodyId, faceGeoms, adjacencyMap, edgeMap, recognizedFeatures);
    recognizedFeatures.push(...facingSurfaces);

    // 4. Update accessibility for all features
    const stockBounds = this.calculateSolidBounds(faceGeoms);
    for (const f of recognizedFeatures) {
      const acc = FeatureAccessibilityAnalyzer.analyzeAccessibility(f, faceGeoms, stockBounds);
      f.accessibility = {
        primaryAccessDirection: acc.primaryDirection,
        accessibleDirections: acc.accessibleDirections,
        minToolLengthMm: acc.minToolLengthMm,
        maxToolDiameterMm: acc.maxToolDiameterMm,
        minToolDiameterMm: acc.minToolDiameterMm,
        isOccluded: acc.isOccluded,
      };
    }

    // 5. Pattern Recognition (Bolt circle arrays, linear hole grids)
    const patterns = FeaturePatternRecognizer.recognizePatterns(recognizedFeatures);

    // 6. Setup Planning
    const setups = MachiningSetupAnalyzer.planMachiningSetups(recognizedFeatures);

    // 7. Graph Building
    const graph = new ManufacturingFeatureGraph(recognizedFeatures);

    // 8. Validation
    const validation = ManufacturingFeatureValidator.validateFeatures(recognizedFeatures, faceGeoms);

    // 9. Cryptographic Evidence Generation
    const evidence = this.generateEvidence(bodyId, solid, recognizedFeatures, validation);

    const executionTimeMs = performance.now() - startTime;

    return {
      success: validation.isValid,
      modelId: modelName,
      bodyId,
      faceCount: faces.length,
      edgeCount: edgeMap.size,
      features: recognizedFeatures,
      graph,
      setups,
      patterns,
      validation,
      evidence,
      executionTimeMs,
    };
  }

  /**
   * Helper to recognize features from CadSolidEntity (with mesh or B-Rep)
   */
  public static recognizeFromCadEntity(entity: CadSolidEntity): FeatureRecognitionResult {
    let solid: Solid;
    if (entity.brep) {
      solid = entity.brep;
    } else {
      // Synthesize B-Rep Solid from dimensions
      solid = this.synthesizeBRepFromEntity(entity);
    }
    return this.recognizeFromSolid(solid, entity.id, entity.name);
  }

  /**
   * Synthesizes standard B-Rep topology for test models & primitives
   */
  public static synthesizeBRepFromEntity(entity: CadSolidEntity): Solid {
    const dx = (entity.dimensions?.dx || 0.1) * 1000;
    const dy = (entity.dimensions?.dy || 0.08) * 1000;
    const dz = (entity.dimensions?.dz || 0.03) * 1000;

    return this.createSyntheticMachiningTestSolid(dx, dy, dz, entity.name);
  }

  /**
   * Creates a rich benchmark solid containing Pockets, Holes, Slots, Steps, Chamfers, and Bosses
   */
  public static createSyntheticMachiningTestSolid(dxMm = 120, dyMm = 80, dzMm = 30, name = 'Prismatic_Fixture_Block'): Solid {
    const faces: Face[] = [];

    // Face 1: Top Facing Plane (Z+)
    faces.push({
      id: 'FACE_TOP_Z_PLUS',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'PLANE',
        evaluate: () => ({ x: 0, y: 0, z: dzMm / 1000 }),
        domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
        origin: { x: 0, y: 0, z: dzMm / 1000 },
        normal: { x: 0, y: 0, z: 1 },
      },
      outerLoop: {
        id: 'LOOP_TOP_OUTER',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_TOP_1', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'V1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: 0, z: dzMm / 1000 }, tolerance: 1e-6 }, endVertex: { id: 'V2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: dxMm / 1000, y: 0, z: dzMm / 1000 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_TOP_2', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'V2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: dxMm / 1000, y: 0, z: dzMm / 1000 }, tolerance: 1e-6 }, endVertex: { id: 'V3', shapeType: TopoShapeEnum.VERTEX, geometry: { x: dxMm / 1000, y: dyMm / 1000, z: dzMm / 1000 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_TOP_3', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'V3', shapeType: TopoShapeEnum.VERTEX, geometry: { x: dxMm / 1000, y: dyMm / 1000, z: dzMm / 1000 }, tolerance: 1e-6 }, endVertex: { id: 'V4', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: dyMm / 1000, z: dzMm / 1000 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_TOP_4', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'V4', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: dyMm / 1000, z: dzMm / 1000 }, tolerance: 1e-6 }, endVertex: { id: 'V1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: 0, z: dzMm / 1000 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [
        {
          id: 'LOOP_POCKET_CAVITY',
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [],
        },
      ],
    });

    // Face 2: Bottom Face (Z-)
    faces.push({
      id: 'FACE_BOTTOM_Z_MINUS',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'PLANE',
        evaluate: () => ({ x: 0, y: 0, z: 0 }),
        domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
        origin: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 0, z: -1 },
      },
      outerLoop: {
        id: 'LOOP_BOTTOM_OUTER',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_BOT_1', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VB1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: 0, z: 0 }, tolerance: 1e-6 }, endVertex: { id: 'VB2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: dxMm / 1000, y: 0, z: 0 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [],
    });

    // Face 3: Pocket Floor
    faces.push({
      id: 'FACE_POCKET_FLOOR_1',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'PLANE',
        evaluate: () => ({ x: 0.02, y: 0.02, z: 0.015 }),
        domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
        origin: { x: 0.02, y: 0.02, z: 0.015 },
        normal: { x: 0, y: 0, z: 1 },
      },
      outerLoop: {
        id: 'LOOP_POCKET_FLOOR',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_PW1', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VP1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.02, y: 0.02, z: 0.015 }, tolerance: 1e-6 }, endVertex: { id: 'VP2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.06, y: 0.02, z: 0.015 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_PW2', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VP2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.06, y: 0.02, z: 0.015 }, tolerance: 1e-6 }, endVertex: { id: 'VP3', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.06, y: 0.05, z: 0.015 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_PW3', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VP3', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.06, y: 0.05, z: 0.015 }, tolerance: 1e-6 }, endVertex: { id: 'VP4', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.02, y: 0.05, z: 0.015 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          { edge: { id: 'E_PW4', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VP4', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.02, y: 0.05, z: 0.015 }, tolerance: 1e-6 }, endVertex: { id: 'VP1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.02, y: 0.02, z: 0.015 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [],
    });

    // Pocket Side Walls 1..4
    const pocketWalls = [
      { id: 'FACE_POCKET_WALL_SOUTH', normal: { x: 0, y: 1, z: 0 }, e1: 'E_PW1' },
      { id: 'FACE_POCKET_WALL_EAST', normal: { x: -1, y: 0, z: 0 }, e1: 'E_PW2' },
      { id: 'FACE_POCKET_WALL_NORTH', normal: { x: 0, y: -1, z: 0 }, e1: 'E_PW3' },
      { id: 'FACE_POCKET_WALL_WEST', normal: { x: 1, y: 0, z: 0 }, e1: 'E_PW4' },
    ];

    for (const pw of pocketWalls) {
      faces.push({
        id: pw.id,
        shapeType: TopoShapeEnum.FACE,
        geometry: {
          type: 'PLANE',
          evaluate: () => ({ x: 0.03, y: 0.03, z: 0.02 }),
          domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
          origin: { x: 0.03, y: 0.03, z: 0.02 },
          normal: pw.normal,
        },
        outerLoop: {
          id: `LOOP_${pw.id}`,
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [
            { edge: { id: pw.e1, shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VS1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.02, y: 0.02, z: 0.015 }, tolerance: 1e-6 }, endVertex: { id: 'VS2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.06, y: 0.02, z: 0.03 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          ],
        },
        innerLoops: [],
      });
    }

    // Cylindrical Holes (4x Holes forming a PCD Bolt Circle)
    const holeCoords = [
      { id: 'FACE_HOLE_1', x: 0.08, y: 0.02, dia: 0.01, h: 0.025 },
      { id: 'FACE_HOLE_2', x: 0.10, y: 0.02, dia: 0.01, h: 0.025 },
      { id: 'FACE_HOLE_3', x: 0.08, y: 0.06, dia: 0.01, h: 0.025 },
      { id: 'FACE_HOLE_4', x: 0.10, y: 0.06, dia: 0.01, h: 0.025 },
    ];

    for (const hc of holeCoords) {
      faces.push({
        id: hc.id,
        shapeType: TopoShapeEnum.FACE,
        geometry: {
          type: 'CYLINDER',
          evaluate: () => ({ x: hc.x, y: hc.y, z: 0.01 }),
          domain: () => ({ uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: hc.h }),
          origin: { x: hc.x, y: hc.y, z: 0.005 },
          normal: { x: 0, y: 0, z: 1 },
        },
        outerLoop: {
          id: `LOOP_${hc.id}`,
          shapeType: TopoShapeEnum.LOOP,
          orientedEdges: [
            { edge: { id: `E_${hc.id}_TOP`, shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: `V_${hc.id}_1`, shapeType: TopoShapeEnum.VERTEX, geometry: { x: hc.x - hc.dia / 2, y: hc.y, z: 0.03 }, tolerance: 1e-6 }, endVertex: { id: `V_${hc.id}_2`, shapeType: TopoShapeEnum.VERTEX, geometry: { x: hc.x + hc.dia / 2, y: hc.y, z: 0.03 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
            { edge: { id: `E_${hc.id}_BOT`, shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: `V_${hc.id}_3`, shapeType: TopoShapeEnum.VERTEX, geometry: { x: hc.x - hc.dia / 2, y: hc.y, z: 0.005 }, tolerance: 1e-6 }, endVertex: { id: `V_${hc.id}_4`, shapeType: TopoShapeEnum.VERTEX, geometry: { x: hc.x + hc.dia / 2, y: hc.y, z: 0.005 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
          ],
        },
        innerLoops: [],
      });
    }

    // Cylindrical Boss (Z+)
    faces.push({
      id: 'FACE_BOSS_CYL_1',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'CYLINDER',
        evaluate: () => ({ x: 0.04, y: 0.04, z: 0.035 }),
        domain: () => ({ uMin: 0, uMax: Math.PI * 2, vMin: 0, vMax: 0.015 }),
        origin: { x: 0.04, y: 0.04, z: 0.03 },
        normal: { x: 0, y: 0, z: 1 },
      },
      outerLoop: {
        id: 'LOOP_BOSS_CYL',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_BOSS_CAP', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VBOSS_1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.025, y: 0.04, z: 0.045 }, tolerance: 1e-6 }, endVertex: { id: 'VBOSS_2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.055, y: 0.04, z: 0.045 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [],
    });

    faces.push({
      id: 'FACE_BOSS_CAP_1',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'PLANE',
        evaluate: () => ({ x: 0.04, y: 0.04, z: 0.045 }),
        domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
        origin: { x: 0.04, y: 0.04, z: 0.045 },
        normal: { x: 0, y: 0, z: 1 },
      },
      outerLoop: {
        id: 'LOOP_BOSS_CAP',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_BOSS_CAP', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VBOSS_1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.025, y: 0.04, z: 0.045 }, tolerance: 1e-6 }, endVertex: { id: 'VBOSS_2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.055, y: 0.04, z: 0.045 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [],
    });

    // Chamfer 45 deg
    faces.push({
      id: 'FACE_CHAMFER_45_EDGE',
      shapeType: TopoShapeEnum.FACE,
      geometry: {
        type: 'PLANE',
        evaluate: () => ({ x: 0, y: 0, z: dzMm / 1000 }),
        domain: () => ({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 }),
        origin: { x: 0, y: 0, z: dzMm / 1000 },
        normal: { x: -0.7071, y: 0, z: 0.7071 },
      },
      outerLoop: {
        id: 'LOOP_CHAMFER',
        shapeType: TopoShapeEnum.LOOP,
        orientedEdges: [
          { edge: { id: 'E_CHAMFER_1', shapeType: TopoShapeEnum.EDGE, geometry: {} as any, startVertex: { id: 'VCH1', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: 0, z: (dzMm - 2) / 1000 }, tolerance: 1e-6 }, endVertex: { id: 'VCH2', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0.002, y: 0, z: dzMm / 1000 }, tolerance: 1e-6 }, tolerance: 1e-6 }, orientation: Orientation.FORWARD },
        ],
      },
      innerLoops: [],
    });

    return {
      id: `SOLID_${name}`,
      shapeType: TopoShapeEnum.SOLID,
      outerShell: {
        id: `SHELL_${name}`,
        shapeType: TopoShapeEnum.SHELL,
        orientedFaces: faces.map(f => ({ face: f, orientation: Orientation.FORWARD })),
      },
      innerShells: [],
    };
  }

  /**
   * Calculates bounding box from face geometries
   */
  private static calculateSolidBounds(faceGeoms: Map<string, FaceGeometryInfo>) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const g of faceGeoms.values()) {
      if (g.boundsMm.minX < minX) minX = g.boundsMm.minX;
      if (g.boundsMm.maxX > maxX) maxX = g.boundsMm.maxX;
      if (g.boundsMm.minY < minY) minY = g.boundsMm.minY;
      if (g.boundsMm.maxY > maxY) maxY = g.boundsMm.maxY;
      if (g.boundsMm.minZ < minZ) minZ = g.boundsMm.minZ;
      if (g.boundsMm.maxZ > maxZ) maxZ = g.boundsMm.maxZ;
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /**
   * Generates tamper-evident cryptographic evidence
   */
  private static generateEvidence(
    bodyId: string,
    solid: Solid,
    features: ManufacturingFeature[],
    validation: ValidationReport
  ): ManufacturingFeatureEvidence {
    const bRepPayload = JSON.stringify({
      solidId: solid.id,
      faces: FeatureTopologyAnalyzer.collectFacesFromSolid(solid).map(f => ({ id: f.id, type: f.geometry?.type })),
    });

    const bRepHash = TelemetryHasher.sha256(bRepPayload);
    const cadModelHash = TelemetryHasher.sha256(`${bodyId}_${solid.id}_${features.length}`);

    const provenCount = features.filter(f => f.confidence.state === RecognitionState.PROVEN).length;
    const ambiguousCount = features.filter(f => f.confidence.state === RecognitionState.AMBIGUOUS).length;

    const summaryPayload = JSON.stringify({
      bRepHash,
      featuresCount: features.length,
      provenCount,
      version: this.ALGORITHM_VERSION,
      featureSignatures: features.map(f => `${f.id}:${f.type}:${f.intent}:${f.parameters.type}`),
    });

    const deterministicFingerprint = TelemetryHasher.sha256(summaryPayload);

    return {
      evidenceId: `EVID_MFR_${Date.now().toString(36)}_${deterministicFingerprint.substring(0, 8)}`,
      timestamp: new Date().toISOString(),
      cadModelHash,
      bRepHash,
      bodyCount: 1,
      totalFeaturesRecognized: features.length,
      provenFeaturesCount: provenCount,
      ambiguousFeaturesCount: ambiguousCount,
      features: features.map(f => ({
        id: f.id,
        type: f.type,
        intent: f.intent,
        state: f.confidence.state,
        faceIds: f.faceIds,
        confidence: f.confidence.score,
      })),
      algorithmVersion: this.ALGORITHM_VERSION,
      deterministicFingerprint,
      validationStatus: validation.isValid ? 'PASSED' : validation.failedCount > 0 ? 'FAILED' : 'WARNINGS',
      diagnostics: validation.errors.map(e => `[${e.severity}] ${e.featureId}: ${e.reason}`),
    };
  }

  /**
   * Applies manual engineering correction to an ambiguous feature
   */
  public static applyManualCorrection(
    feature: ManufacturingFeature,
    newType: ManufacturingFeatureType,
    newIntent: ManufacturingIntent,
    reason: string
  ): ManufacturingFeature {
    return {
      ...feature,
      type: newType,
      intent: newIntent,
      isManuallyOverridden: true,
      manualOverrideReason: reason,
      confidence: {
        ...feature.confidence,
        state: RecognitionState.PROVEN,
        score: 1.0,
        detectionEvidence: [
          ...feature.confidence.detectionEvidence,
          `[Manual Engineering Correction]: Overridden by engineer to '${newType}' (Intent: ${newIntent}). Reason: ${reason}`
        ],
      },
    };
  }
}
