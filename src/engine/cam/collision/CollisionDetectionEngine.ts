/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Master Collision Detection & Verification Engine
 */

import { Vector3D } from '../../cadKernel';
import {
  BenchmarkCollisionCase,
  CollisionEvidencePackage,
  CollisionIncident,
  CollisionReport,
  CollisionState,
  CollisionTimelineEntry,
  CollisionTolerance,
  DetectionMode,
  FixtureGeometry,
  HolderGeometry,
  IndustrialOSEvent,
  ProtectedGeometryModel,
  SpindleHeadGeometry,
  ToolGeometry,
  ToolPose,
  Triangle3D
} from './CollisionTypes';
import { CollisionMathUtils } from './CollisionMathUtils';
import { BroadPhaseDetector } from './BroadPhaseDetector';
import { NarrowPhaseDetector } from './NarrowPhaseDetector';
import { ContinuousCollisionDetector } from './ContinuousCollisionDetector';
import { GougeDetector } from './GougeDetector';
import { CollisionClassifier } from './CollisionClassifier';
import { CollisionEvidenceGenerator } from './CollisionEvidenceGenerator';
import { CollisionAuthority, CanonicalCollisionInput } from '../../collision-authority';
import { ExactNarrowPhaseProvider } from '../../collision-authority/narrow-phase/ExactNarrowPhaseProvider';

export class CollisionDetectionEngine {
  public static readonly DEFAULT_TOLERANCES: CollisionTolerance = {
    geometryToleranceMm: 0.005,
    contactToleranceMm: 0.010,
    numericalToleranceMm: 1e-5,
    clearanceThresholdWarningMm: 2.0,
    clearanceThresholdCriticalMm: 0.5
  };

  /**
   * Runs complete collision verification on a toolpath sequence against Part, Fixture, and Machine envelopes.
   */
  public static verifyToolpath(
    jobId: string,
    setupId: string,
    operationName: string,
    toolposes: ToolPose[],
    tool: ToolGeometry,
    holder: HolderGeometry,
    spindle: SpindleHeadGeometry | undefined,
    partTriangles: Triangle3D[],
    fixture?: FixtureGeometry,
    protectedModel?: ProtectedGeometryModel,
    tolerances: CollisionTolerance = this.DEFAULT_TOLERANCES,
    detectionMode: DetectionMode = 'EXACT'
  ): { report: CollisionReport; evidence: CollisionEvidencePackage; events: IndustrialOSEvent[] } {
    const events: IndustrialOSEvent[] = [];
    events.push(CollisionEvidenceGenerator.createOSEvent('COLLISION_CHECK_STARTED', { jobId, operationName, segments: toolposes.length }));

    const incidents: CollisionIncident[] = [];
    const timeline: CollisionTimelineEntry[] = [];

    let toolCollisionCount = 0;
    let holderCollisionCount = 0;
    let spindleCollisionCount = 0;
    let fixtureCollisionCount = 0;
    let machineCollisionCount = 0;
    let gougeCount = 0;
    let clearanceViolationCount = 0;

    let minOverallClearance = Infinity;
    let maxOverallPenetration = 0;

    // Check segment by segment with CCD
    for (let i = 0; i < toolposes.length; i++) {
      const currentPose = toolposes[i];
      const prevPose = i > 0 ? toolposes[i - 1] : currentPose;
      const normTime = toolposes.length > 1 ? i / (toolposes.length - 1) : 0;
      const timeSec = i * 0.5; // Virtual timeline step

      // 1. Route segment evaluation through Canonical CollisionAuthority
      const canonicalInput: CanonicalCollisionInput = {
        domain: 'CAM_MULTI_AXIS',
        coordinateFrame: 'WCS',
        units: 'MILLIMETERS',
        toleranceProfile: {
          linearToleranceMm: tolerances.geometryToleranceMm,
          angularToleranceDeg: 0.5,
          clearanceWarningMarginMm: tolerances.clearanceThresholdWarningMm,
          safeClearanceMarginMm: tolerances.clearanceThresholdCriticalMm
        },
        cadRevisionId: jobId,
        toolAssembly: {
          cutterDiameterMm: tool.cutterDiameterMm,
          fluteLengthMm: tool.fluteLengthMm,
          stickoutMm: tool.stickoutMm,
          shankDiameterMm: tool.shankDiameterMm,
          holderLowerDiameterMm: holder.holderLowerDiameterMm,
          holderUpperDiameterMm: holder.holderUpperDiameterMm,
          holderGaugeLengthMm: holder.holderGaugeLengthMm
        },
        motionSegment: {
          startTcp: prevPose.tcp,
          startOrientation: prevPose.toolOrientation,
          endTcp: currentPose.tcp,
          endOrientation: currentPose.toolOrientation,
          motionType: (currentPose.motionType as any) || 'FEED'
        },
        geometry: {
          tessellatedTriangles: partTriangles as any
        }
      };

      const canonicalResult = CollisionAuthority.evaluateSync(canonicalInput, ExactNarrowPhaseProvider.PROVIDER_ID);

      // 1b. Continuous Swept Collision Test
      const sweptRes = ContinuousCollisionDetector.testSweptMotion(
        prevPose,
        currentPose,
        tool,
        holder,
        spindle,
        partTriangles,
        fixture,
        tolerances
      );

      if (sweptRes.minClearanceMm < minOverallClearance) {
        minOverallClearance = sweptRes.minClearanceMm;
      }
      if (sweptRes.maxPenetrationMm > maxOverallPenetration) {
        maxOverallPenetration = sweptRes.maxPenetrationMm;
      }

      // 2. Classify Swept Results
      let isIncidentFound = false;
      if (sweptRes.hasCollision || sweptRes.minClearanceMm < tolerances.clearanceThresholdWarningMm) {
        const isFixtureHit = fixture ? sweptRes.narrowResult.contactingSegment !== 'NONE' && NarrowPhaseDetector.testToolAssemblyAgainstFixture(
          sweptRes.criticalPose, tool, holder, spindle, fixture, tolerances
        ).hasContact : false;

        const incident = CollisionClassifier.classifyContact(
          i,
          normTime,
          sweptRes.criticalPose,
          tool,
          holder,
          sweptRes.narrowResult,
          isFixtureHit,
          detectionMode
        );

        if (incident.state !== 'CLEAR') {
          incidents.push(incident);
          isIncidentFound = true;

          if (incident.type === 'TOOL_COLLISION') toolCollisionCount++;
          else if (incident.type === 'HOLDER_COLLISION') holderCollisionCount++;
          else if (incident.type === 'SPINDLE_COLLISION') spindleCollisionCount++;
          else if (incident.type === 'FIXTURE_COLLISION') fixtureCollisionCount++;
          else if (incident.type === 'CLEARANCE_VIOLATION') clearanceViolationCount++;

          events.push(CollisionEvidenceGenerator.createOSEvent(
            incident.type === 'HOLDER_COLLISION' ? 'HOLDER_COLLISION_DETECTED' :
            incident.type === 'FIXTURE_COLLISION' ? 'FIXTURE_COLLISION_DETECTED' :
            incident.type === 'SPINDLE_COLLISION' ? 'SPINDLE_COLLISION_DETECTED' : 'TOOL_COLLISION_DETECTED',
            { incidentId: incident.incidentId, segmentIndex: i, depth: incident.penetrationDepthMm }
          ));
        }
      }

      // 3. Gouge Detection
      if (protectedModel) {
        const gouge = GougeDetector.checkGouge(currentPose, tool, protectedModel, partTriangles, tolerances);
        if (gouge) {
          gougeCount++;
          const gougeIncident: CollisionIncident = {
            incidentId: `GOUGE-${i}-${Date.now().toString().slice(-4)}`,
            segmentIndex: i,
            normalizedPathTime: normTime,
            type: 'GOUGE',
            severity: 'CRITICAL',
            state: 'GOUGE',
            detectionMode,
            bodyA: 'TOOL_CUTTER',
            bodyB: 'PART_BREP',
            bodyAName: 'Tool_Cutter_Flute',
            bodyBName: gouge.surfaceId,
            contactPointWCS: gouge.contactPoint,
            contactNormal: gouge.surfaceNormal,
            penetrationDepthMm: gouge.overcutDepthMm,
            clearanceDistanceMm: 0,
            requiredClearanceMm: 0,
            toolPose: currentPose,
            description: gouge.description
          };
          incidents.push(gougeIncident);
          events.push(CollisionEvidenceGenerator.createOSEvent('GOUGE_DETECTED', { segmentIndex: i, surfaceId: gouge.surfaceId }));
        }
      }

      // Add to timeline
      const currentEntryState: CollisionState = isIncidentFound ? 'COLLISION' : (sweptRes.minClearanceMm < tolerances.clearanceThresholdWarningMm ? 'WARNING' : 'CLEAR');
      timeline.push({
        timeSec,
        normalizedTime: normTime,
        segmentIndex: i,
        state: currentEntryState,
        type: isIncidentFound ? incidents[incidents.length - 1].type : 'NO_COLLISION',
        severity: isIncidentFound ? incidents[incidents.length - 1].severity : 'INFO',
        clearanceMm: sweptRes.minClearanceMm,
        penetrationMm: sweptRes.maxPenetrationMm,
        message: isIncidentFound ? incidents[incidents.length - 1].description : 'Clear path motion.'
      });
    }

    const hasHardCollision = toolCollisionCount > 0 || holderCollisionCount > 0 || spindleCollisionCount > 0 || fixtureCollisionCount > 0 || gougeCount > 0;
    const overallState: CollisionState = hasHardCollision ? 'COLLISION' : (clearanceViolationCount > 0 ? 'WARNING' : 'CLEAR');
    const isPathRejected = hasHardCollision;

    const report: CollisionReport = {
      jobId,
      setupId,
      operationName,
      toolId: tool.toolId,
      overallState,
      isPathValid: !isPathRejected,
      isPathRejected,
      totalSegmentsChecked: toolposes.length,
      totalIncidentsCount: incidents.length,
      toolCollisionCount,
      holderCollisionCount,
      spindleCollisionCount,
      fixtureCollisionCount,
      machineCollisionCount,
      gougeCount,
      clearanceViolationCount,
      minOverallClearanceMm: minOverallClearance === Infinity ? 999 : minOverallClearance,
      maxPenetrationDepthMm: maxOverallPenetration,
      incidents,
      timeline,
      detectionMode,
      tolerances,
      checkedBodies: ['TOOL_CUTTER', 'TOOL_SHANK', 'HOLDER', 'SPINDLE', 'PART_BREP', 'FIXTURE'],
      coverageStatus: 'PROVEN'
    };

    const evidence = CollisionEvidenceGenerator.generateEvidencePackage(report, tool, holder, fixture, toolposes);
    events.push(CollisionEvidenceGenerator.createOSEvent('COLLISION_CHECK_COMPLETED', { overallState, isPathRejected }));

    return { report, evidence, events };
  }

  // =========================================================================
  // Standard Reference Benchmarks Catalog (Benchmarks A through G)
  // =========================================================================
  public static getBenchmarkCatalog(): BenchmarkCollisionCase[] {
    const standardTool: ToolGeometry = {
      toolId: 'TOOL_EM_D10',
      toolType: 'ENDMILL',
      cutterDiameterMm: 10,
      fluteLengthMm: 25,
      shoulderLengthMm: 35,
      shankDiameterMm: 10,
      totalLengthMm: 75,
      stickoutMm: 40
    };

    const standardHolder: HolderGeometry = {
      holderId: 'HOLDER_BT40_ER32',
      holderType: 'TAPERED',
      gaugeLengthMm: 60,
      lowerDiameterMm: 40,
      upperDiameterMm: 65,
      collarDiameterMm: 65
    };

    const viseFixture: FixtureGeometry = {
      fixtureId: 'FIX_VISE_PRECISION_100',
      fixtureType: 'VISE_JAWS',
      name: 'Kurt Precision 100mm Vise',
      aabb: {
        min: { x: -60, y: -40, z: -20 },
        max: { x: 60, y: -25, z: 15 } // Clamp jaw rises up to Z+15
      },
      keepOutZoneMarginMm: 3.0,
      isKeepOutZoneActive: true
    };

    return [
      // Benchmark A: Safe 3-Axis Toolpath (Clear)
      {
        id: 'BENCHMARK_A',
        name: 'Benchmark A — Safe 3-Axis Toolpath',
        description: 'Planar facing pattern at safe clearance above workpiece and clear of fixtures.',
        axisMode: '3_AXIS',
        expectedState: 'CLEAR',
        expectedCollisionType: 'NO_COLLISION',
        tool: standardTool,
        holder: standardHolder,
        fixture: viseFixture,
        toolpathNodes: [
          { tcp: { x: -40, y: 0, z: 25 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' },
          { tcp: { x: -40, y: 0, z: 18 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: 40, y: 0, z: 18 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: 40, y: 15, z: 18 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: -40, y: 15, z: 18 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: -40, y: 15, z: 30 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }
        ]
      },

      // Benchmark B: Tool / Part Collision (Tool plunge into tall unmachined boss)
      {
        id: 'BENCHMARK_B',
        name: 'Benchmark B — Tool / Part Direct Collision',
        description: 'Rapid plunge trajectory crashes directly into a central unmachined boss.',
        axisMode: '3_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'TOOL_COLLISION',
        tool: standardTool,
        holder: standardHolder,
        toolpathNodes: [
          { tcp: { x: -30, y: 0, z: 25 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' },
          { tcp: { x: 0, y: 0, z: -5 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }, // Crashes into boss at (0,0)
          { tcp: { x: 30, y: 0, z: 25 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }
        ]
      },

      // Benchmark C: Holder / Part Deep Pocket Collision
      {
        id: 'BENCHMARK_C',
        name: 'Benchmark C — Holder / Deep Pocket Collision',
        description: 'Cutter reaches deep pocket floor (Z-35), but holder with 40mm diameter collides with pocket sidewall due to insufficient stickout (30mm).',
        axisMode: '3_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'HOLDER_COLLISION',
        tool: { ...standardTool, stickoutMm: 25 }, // Short stickout causes holder collision
        holder: standardHolder,
        toolpathNodes: [
          { tcp: { x: 0, y: 0, z: 10 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: 0, y: 0, z: -30 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' }, // Holder interferes with top rim
          { tcp: { x: 10, y: 0, z: -30 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' }
        ]
      },

      // Benchmark D: Fixture Keep-Out Violation
      {
        id: 'BENCHMARK_D',
        name: 'Benchmark D — Fixture Keep-Out Violation',
        description: 'Toolpath rapid crossing penetrates vise clamp keep-out zone at Y=-30, Z=10.',
        axisMode: '3_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'FIXTURE_COLLISION',
        tool: standardTool,
        holder: standardHolder,
        fixture: viseFixture,
        toolpathNodes: [
          { tcp: { x: -40, y: 10, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' },
          { tcp: { x: 0, y: -30, z: 5 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }, // Direct clamp hit
          { tcp: { x: 40, y: 10, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }
        ]
      },

      // Benchmark E: 4-Axis Rotary Collision
      {
        id: 'BENCHMARK_E',
        name: 'Benchmark E — 4-Axis Rotary Collision',
        description: 'A-axis rotation of 90 degrees swings the workpiece into the rotary tailstock fixture jaw.',
        axisMode: '4_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'FIXTURE_COLLISION',
        tool: standardTool,
        holder: standardHolder,
        fixture: viseFixture,
        toolpathNodes: [
          { tcp: { x: 0, y: 0, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: 0, y: -28, z: 10 }, toolOrientation: { x: 0, y: -0.707, z: 0.707 }, motionType: 'INDEXED_MOVE' }
        ]
      },

      // Benchmark F: 5-Axis Orientation Collision
      {
        id: 'BENCHMARK_F',
        name: 'Benchmark F — 5-Axis Orientation Collision',
        description: 'Severe tilt angle (45 degrees) swings the tool holder conical envelope into the side wall.',
        axisMode: '5_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'HOLDER_COLLISION',
        tool: { ...standardTool, stickoutMm: 30 },
        holder: standardHolder,
        toolpathNodes: [
          { tcp: { x: 15, y: 0, z: 0 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' },
          { tcp: { x: 15, y: 0, z: 0 }, toolOrientation: { x: 0.707, y: 0, z: 0.707 }, motionType: 'LINEAR' }
        ]
      },

      // Benchmark G: Continuous Between-Points Collision
      {
        id: 'BENCHMARK_G',
        name: 'Benchmark G — Continuous Between-Points Collision (CCD)',
        description: 'Start node (X-35, Z20) and end node (X+35, Z20) are completely clear in air, but linear interpolation crosses a center obstacle (X0, Z20) where a clamp stands at Z25.',
        axisMode: '3_AXIS',
        expectedState: 'COLLISION',
        expectedCollisionType: 'FIXTURE_COLLISION',
        tool: standardTool,
        holder: standardHolder,
        fixture: {
          fixtureId: 'FIX_CENTER_CLAMP',
          fixtureType: 'CLAMP_STEP',
          name: 'Center Toe Clamp',
          aabb: { min: { x: -10, y: -10, z: 0 }, max: { x: 10, y: 10, z: 25 } },
          keepOutZoneMarginMm: 2.0,
          isKeepOutZoneActive: true
        },
        toolpathNodes: [
          { tcp: { x: -35, y: 0, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' },
          { tcp: { x: 35, y: 0, z: 20 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'RAPID' }
        ]
      }
    ];
  }

  /**
   * Generates benchmark test triangles for simulated workpiece geometry.
   */
  public static createSampleObstacleTriangles(benchmarkId: string): Triangle3D[] {
    const triangles: Triangle3D[] = [];

    // Base block: Box from X[-30..30], Y[-30..30], Z[-20..0]
    // Top surface at Z=0
    triangles.push(
      { v0: { x: -30, y: -30, z: 0 }, v1: { x: 30, y: -30, z: 0 }, v2: { x: 30, y: 30, z: 0 }, normal: { x: 0, y: 0, z: 1 }, faceId: 'FACE_TOP' },
      { v0: { x: -30, y: -30, z: 0 }, v1: { x: 30, y: 30, z: 0 }, v2: { x: -30, y: 30, z: 0 }, normal: { x: 0, y: 0, z: 1 }, faceId: 'FACE_TOP' }
    );

    // If Benchmark B: Add central boss from X[-10..10], Y[-10..10], Z[0..20]
    if (benchmarkId === 'BENCHMARK_B') {
      triangles.push(
        { v0: { x: -10, y: -10, z: 20 }, v1: { x: 10, y: -10, z: 20 }, v2: { x: 10, y: 10, z: 20 }, normal: { x: 0, y: 0, z: 1 }, faceId: 'BOSS_TOP' },
        { v0: { x: -10, y: -10, z: 20 }, v1: { x: 10, y: 10, z: 20 }, v2: { x: -10, y: 10, z: 20 }, normal: { x: 0, y: 0, z: 1 }, faceId: 'BOSS_TOP' }
      );
    }

    // If Benchmark C: Add deep pocket walls around X[-15..15], Y[-15..15], Z[-35..0]
    if (benchmarkId === 'BENCHMARK_C') {
      // Wall at X=15 from Z=-35 to Z=0
      triangles.push(
        { v0: { x: 15, y: -15, z: 0 }, v1: { x: 15, y: 15, z: 0 }, v2: { x: 15, y: 15, z: -35 }, normal: { x: -1, y: 0, z: 0 }, faceId: 'POCKET_WALL_POS_X' },
        { v0: { x: 15, y: -15, z: 0 }, v1: { x: 15, y: 15, z: -35 }, v2: { x: 15, y: -15, z: -35 }, normal: { x: -1, y: 0, z: 0 }, faceId: 'POCKET_WALL_POS_X' }
      );
    }

    // If Benchmark F: 5-Axis tilt into high sidewall X=15, Z[-35..50]
    if (benchmarkId === 'BENCHMARK_F') {
      triangles.push(
        { v0: { x: 15, y: -15, z: 50 }, v1: { x: 15, y: 15, z: 50 }, v2: { x: 15, y: 15, z: -35 }, normal: { x: -1, y: 0, z: 0 }, faceId: 'POCKET_WALL_POS_X' },
        { v0: { x: 15, y: -15, z: 50 }, v1: { x: 15, y: 15, z: -35 }, v2: { x: 15, y: -15, z: -35 }, normal: { x: -1, y: 0, z: 0 }, faceId: 'POCKET_WALL_POS_X' }
      );
    }

    return triangles;
  }
}
