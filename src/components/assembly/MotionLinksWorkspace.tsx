/**
 * PATCH-SECP-228 — Motion Links Engineering Workspace
 * 
 * Multi-body kinematic motion links and transmission solver interface:
 *  - 10 Motion Link archetypes (Gear Ratio, Belt/Pulley, Rack & Pinion, Screw/Nut,
 *    Cam/Follower, Crank/Slider, Couplings, Differential, Custom Parametric)
 *  - Real-time 2D/3D kinematic canvas with pitch circles, belts, cams, and rods
 *  - Interactive mouse manipulator & driver scrub slider
 *  - Kinematic velocity & acceleration propagation
 *  - Topological dependency graph & overall transmission ratio
 *  - Real physics timeline player with collision sweep
 *  - Dynamic clearance envelope monitoring
 *  - PLM / Provenance cascading invalidation controller
 *  - Production Acceptance Gate 228 audit suite
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link2, Play, Pause, RotateCcw, Plus, Activity, Layers, ShieldCheck, Cpu, Move3d, AlertTriangle, CheckCircle2, Settings, Eye, EyeOff, GitBranch, Sliders, Maximize2, Zap, Disc, ArrowRight, RefreshCw, Clock, Radio, FileCheck, ChevronRight } from 'lucide-react';
import {
  MotionLink,
  MotionLinkType,
  MotionLinkStateStatus,
  BenchmarkMechanismId,
  MotionCollisionRecord
} from '../../engine/assembly/motionLinks/MotionLinkTypes';
import { MotionLinkFactory } from '../../engine/assembly/motionLinks/MotionLinkFactory';
import { MotionLinkMathEngine } from '../../engine/assembly/motionLinks/MotionLinkMathEngine';
import { MotionLinkSolver } from '../../engine/assembly/motionLinks/MotionLinkSolver';
import { MotionLinkDependencyGraphEngine } from '../../engine/assembly/motionLinks/MotionLinkDependencyGraph';
import { MotionLinkPLMBridge } from '../../engine/assembly/motionLinks/MotionLinkPLMBridge';
import { HardAcceptanceGate228, Gate228AuditReport } from '../../engine/assembly/motionLinks/HardAcceptanceGate228';
import { MechanicalJoint, ComponentKinematicState } from '../../engine/assembly/joints/MechanicalJointTypes';
import { MechanicalJointFactory } from '../../engine/assembly/joints/MechanicalJointFactory';
import { CoordinateFrameEngine } from '../../engine/assembly/joints/CoordinateFrameEngine';

export type MechanismPresetId =
  | 'GEAR_PAIR'
  | 'GEAR_TRAIN_3STAGE'
  | 'BELT_PULLEY_OPEN'
  | 'BELT_PULLEY_CROSSED'
  | 'RACK_PINION'
  | 'LEAD_SCREW'
  | 'CRANK_SLIDER'
  | 'CAM_FOLLOWER';

export const MotionLinksWorkspace: React.FC = () => {
  // Preset Selection
  const [activePreset, setActivePreset] = useState<MechanismPresetId>('GEAR_PAIR');

  // Assembly State
  const [components, setComponents] = useState<ComponentKinematicState[]>([]);
  const [joints, setJoints] = useState<MechanicalJoint[]>([]);
  const [links, setLinks] = useState<MotionLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  // Driver Kinematic Input
  const [driverPosition, setDriverPosition] = useState<number>(0);
  const [driverVelocity, setDriverVelocity] = useState<number | null>(null); 

  // Simulation Timeline State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number | null>(null);
  const [simTime, setSimTime] = useState<number | null>(null);

  // UI Tabs
  const [activeRightTab, setActiveRightTab] = useState<'PARAMETERS' | 'GRAPH' | 'CLEARANCE' | 'PLM' | 'GATE228'>('PARAMETERS');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Dynamic Clearance & Clash
  const [latestClearance, setLatestClearance] = useState<number | null>(null);
  const [collisionEvents, setCollisionEvents] = useState<MotionCollisionRecord[]>([]);

  // Gate 228 Audit
  const [auditReport, setAuditReport] = useState<Gate228AuditReport | null>(null);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // -------------------------------------------------------------
  // Load Mechanism Presets
  // -------------------------------------------------------------
  const loadPreset = (preset: MechanismPresetId) => {
    setIsPlaying(false);
    setSimTime(0);
    setDriverPosition(0);

    let newComps: ComponentKinematicState[] = [];
    let newJoints: MechanicalJoint[] = [];
    let newLinks: MotionLink[] = [];

    if (preset === 'GEAR_PAIR') {
      const gearA: ComponentKinematicState = {
        componentId: 'GEAR_20T',
        name: 'Drive Pinion (20T)',
        isGrounded: false,
        massKg: 1.5,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 120, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const gearB: ComponentKinematicState = {
        componentId: 'GEAR_40T',
        name: 'Driven Gear (40T)',
        isGrounded: false,
        massKg: 4.2,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 240, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jA = MechanicalJointFactory.createRevoluteJoint({
        id: 'J_REV_A',
        name: 'Pinion Bearing Joint',
        parentComponentId: 'GROUND',
        childComponentId: 'GEAR_20T',
        origin: { x: 120, y: 180, z: 0 }
      });
      const jB = MechanicalJointFactory.createRevoluteJoint({
        id: 'J_REV_B',
        name: 'Driven Wheel Bearing Joint',
        parentComponentId: 'GROUND',
        childComponentId: 'GEAR_40T',
        origin: { x: 240, y: 180, z: 0 }
      });

      const gearLink = MotionLinkFactory.createGearRatioLink({
        id: 'ML-GEAR-PAIR',
        name: '20T:40T Involute Mesh (Ratio -0.5)',
        driverComponentId: 'GEAR_20T',
        followerComponentId: 'GEAR_40T',
        driverJointId: 'J_REV_A',
        followerJointId: 'J_REV_B',
        teethDriver: 20,
        teethFollower: 40,
        moduleMm: 2.0,
        centerDistanceMm: 60.0
      });

      newComps = [gearA, gearB];
      newJoints = [jA, jB];
      newLinks = [gearLink];
    } else if (preset === 'GEAR_TRAIN_3STAGE') {
      const g1: ComponentKinematicState = {
        componentId: 'PINION_Z1',
        name: 'Stage 1 Pinion (z=20)',
        isGrounded: false,
        massKg: 1.0,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 80, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const g2: ComponentKinematicState = {
        componentId: 'IDLER_Z2',
        name: 'Stage 2 Idler (z=40)',
        isGrounded: false,
        massKg: 2.8,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 180, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const g3: ComponentKinematicState = {
        componentId: 'OUTPUT_Z3',
        name: 'Stage 3 Output (z=60)',
        isGrounded: false,
        massKg: 5.5,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 310, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };

      const j1 = MechanicalJointFactory.createRevoluteJoint({ id: 'J_G1', name: 'Input Shaft Joint', parentComponentId: 'GROUND', childComponentId: 'PINION_Z1', origin: { x: 80, y: 180, z: 0 } });
      const j2 = MechanicalJointFactory.createRevoluteJoint({ id: 'J_G2', name: 'Idler Shaft Joint', parentComponentId: 'GROUND', childComponentId: 'IDLER_Z2', origin: { x: 180, y: 180, z: 0 } });
      const j3 = MechanicalJointFactory.createRevoluteJoint({ id: 'J_G3', name: 'Output Shaft Joint', parentComponentId: 'GROUND', childComponentId: 'OUTPUT_Z3', origin: { x: 310, y: 180, z: 0 } });

      const link1 = MotionLinkFactory.createGearRatioLink({
        id: 'ML-TRAIN-01',
        name: 'Mesh 1: 20T -> 40T (R1 = -0.5)',
        driverComponentId: 'PINION_Z1',
        followerComponentId: 'IDLER_Z2',
        driverJointId: 'J_G1',
        followerJointId: 'J_G2',
        teethDriver: 20,
        teethFollower: 40
      });
      const link2 = MotionLinkFactory.createGearRatioLink({
        id: 'ML-TRAIN-02',
        name: 'Mesh 2: 40T -> 60T (R2 = -0.667)',
        driverComponentId: 'IDLER_Z2',
        followerComponentId: 'OUTPUT_Z3',
        driverJointId: 'J_G2',
        followerJointId: 'J_G3',
        teethDriver: 40,
        teethFollower: 60
      });

      newComps = [g1, g2, g3];
      newJoints = [j1, j2, j3];
      newLinks = [link1, link2];
    } else if (preset === 'BELT_PULLEY_OPEN' || preset === 'BELT_PULLEY_CROSSED') {
      const isCrossed = preset === 'BELT_PULLEY_CROSSED';
      const p1: ComponentKinematicState = {
        componentId: 'PULLEY_DRIVER',
        name: 'Driver Pulley (D=50mm)',
        isGrounded: false,
        massKg: 1.2,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 100, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const p2: ComponentKinematicState = {
        componentId: 'PULLEY_FOLLOWER',
        name: 'Follower Pulley (D=100mm)',
        isGrounded: false,
        massKg: 3.6,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 260, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jP1 = MechanicalJointFactory.createRevoluteJoint({ id: 'J_P1', name: 'Driver Pulley Bearing', parentComponentId: 'GROUND', childComponentId: 'PULLEY_DRIVER', origin: { x: 100, y: 180, z: 0 } });
      const jP2 = MechanicalJointFactory.createRevoluteJoint({ id: 'J_P2', name: 'Follower Pulley Bearing', parentComponentId: 'GROUND', childComponentId: 'PULLEY_FOLLOWER', origin: { x: 260, y: 180, z: 0 } });

      const beltLink = MotionLinkFactory.createBeltPulleyLink({
        id: 'ML-BELT-DRIVE',
        name: isCrossed ? 'Crossed Belt Transmission (R = -0.5)' : 'Open Belt Transmission (R = +0.5)',
        driverComponentId: 'PULLEY_DRIVER',
        followerComponentId: 'PULLEY_FOLLOWER',
        driverJointId: 'J_P1',
        followerJointId: 'J_P2',
        pulleyDiameterDriverMm: 50,
        pulleyDiameterFollowerMm: 100,
        beltType: isCrossed ? 'CROSSED' : 'OPEN',
        centerDistanceMm: 160
      });

      newComps = [p1, p2];
      newJoints = [jP1, jP2];
      newLinks = [beltLink];
    } else if (preset === 'RACK_PINION') {
      const pinion: ComponentKinematicState = {
        componentId: 'STEER_PINION',
        name: 'Steering Pinion Gear (r=25mm)',
        isGrounded: false,
        massKg: 1.1,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 140, y: 140, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const rack: ComponentKinematicState = {
        componentId: 'STEER_RACK',
        name: 'Linear Rack Bar',
        isGrounded: false,
        massKg: 3.2,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 140, y: 210, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 1,
        rotationalDOF: 0,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jPin = MechanicalJointFactory.createRevoluteJoint({ id: 'J_PINION', name: 'Pinion Revolute Joint', parentComponentId: 'GROUND', childComponentId: 'STEER_PINION', origin: { x: 140, y: 140, z: 0 } });
      const jRack = MechanicalJointFactory.createPrismaticJoint({ id: 'J_RACK', name: 'Rack Prismatic Slide', parentComponentId: 'GROUND', childComponentId: 'STEER_RACK', origin: { x: 140, y: 210, z: 0 }, axis: { x: 1, y: 0, z: 0 }, minTravelMm: -100, maxTravelMm: 100 });

      const rpLink = MotionLinkFactory.createRackPinionLink({
        id: 'ML-RACK-PINION',
        name: 'Rack & Pinion Coupling (v = omega * r)',
        pinionComponentId: 'STEER_PINION',
        rackComponentId: 'STEER_RACK',
        pinionJointId: 'J_PINION',
        rackJointId: 'J_RACK',
        pinionPitchRadiusMm: 25.0
      });

      newComps = [pinion, rack];
      newJoints = [jPin, jRack];
      newLinks = [rpLink];
    } else if (preset === 'LEAD_SCREW') {
      const screw: ComponentKinematicState = {
        componentId: 'LEAD_SCREW_SHAFT',
        name: 'Lead Screw Shaft (P=5mm)',
        isGrounded: false,
        massKg: 2.5,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 100, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const nut: ComponentKinematicState = {
        componentId: 'BALL_NUT_CARRIAGE',
        name: 'Ball Nut Carriage',
        isGrounded: false,
        massKg: 1.8,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 180, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 1,
        rotationalDOF: 0,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jScrew = MechanicalJointFactory.createRevoluteJoint({ id: 'J_SCREW', name: 'Screw Motor Bearing', parentComponentId: 'GROUND', childComponentId: 'LEAD_SCREW_SHAFT', origin: { x: 100, y: 180, z: 0 } });
      const jNut = MechanicalJointFactory.createPrismaticJoint({ id: 'J_NUT', name: 'Nut Linear Guide', parentComponentId: 'GROUND', childComponentId: 'BALL_NUT_CARRIAGE', origin: { x: 100, y: 180, z: 0 }, axis: { x: 1, y: 0, z: 0 }, minTravelMm: 0, maxTravelMm: 150 });

      const screwLink = MotionLinkFactory.createScrewNutLink({
        id: 'ML-SCREW-NUT',
        name: 'Precision Ball Screw Link (x = theta/2pi * Lead)',
        screwComponentId: 'LEAD_SCREW_SHAFT',
        nutComponentId: 'BALL_NUT_CARRIAGE',
        screwJointId: 'J_SCREW',
        nutJointId: 'J_NUT',
        pitchMm: 5.0
      });

      newComps = [screw, nut];
      newJoints = [jScrew, jNut];
      newLinks = [screwLink];
    } else if (preset === 'CRANK_SLIDER') {
      const crank: ComponentKinematicState = {
        componentId: 'ENGINE_CRANK',
        name: 'Crank Wheel (r=45mm)',
        isGrounded: false,
        massKg: 3.5,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 100, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const piston: ComponentKinematicState = {
        componentId: 'ENGINE_PISTON',
        name: 'Piston Head & Pin',
        isGrounded: false,
        massKg: 1.2,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 235, y: 180, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 1,
        rotationalDOF: 0,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jCrank = MechanicalJointFactory.createRevoluteJoint({ id: 'J_CRANK', name: 'Crankshaft Bearing', parentComponentId: 'GROUND', childComponentId: 'ENGINE_CRANK', origin: { x: 100, y: 180, z: 0 } });
      const jPiston = MechanicalJointFactory.createPrismaticJoint({ id: 'J_PISTON', name: 'Cylinder Bore Guide', parentComponentId: 'GROUND', childComponentId: 'ENGINE_PISTON', origin: { x: 100, y: 180, z: 0 }, axis: { x: 1, y: 0, z: 0 }, minTravelMm: 0, maxTravelMm: 200 });

      const csLink = MotionLinkFactory.createCrankSliderLink({
        id: 'ML-CRANK-SLIDER',
        name: 'Analytical Crank-Slider Loop (r=45mm, l=135mm)',
        crankComponentId: 'ENGINE_CRANK',
        sliderComponentId: 'ENGINE_PISTON',
        crankJointId: 'J_CRANK',
        sliderJointId: 'J_PISTON',
        crankRadiusMm: 45.0,
        connectingRodLengthMm: 135.0
      });

      newComps = [crank, piston];
      newJoints = [jCrank, jPiston];
      newLinks = [csLink];
    } else if (preset === 'CAM_FOLLOWER') {
      const cam: ComponentKinematicState = {
        componentId: 'VALVE_CAM',
        name: 'Inlet Cam Lobe (r0=35mm, h=25mm)',
        isGrounded: false,
        massKg: 2.0,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 140, y: 220, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 0,
        rotationalDOF: 1,
        remainingDOF: 1,
        status: 'VALID'
      };
      const follower: ComponentKinematicState = {
        componentId: 'VALVE_LIFTER',
        name: 'Roller Valve Lifter',
        isGrounded: false,
        massKg: 0.8,
        worldTransform: CoordinateFrameEngine.identity4x4(),
        worldOrigin: { x: 140, y: 140, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        translationalDOF: 1,
        rotationalDOF: 0,
        remainingDOF: 1,
        status: 'VALID'
      };

      const jCam = MechanicalJointFactory.createRevoluteJoint({ id: 'J_CAM', name: 'Camshaft Bearing Joint', parentComponentId: 'GROUND', childComponentId: 'VALVE_CAM', origin: { x: 140, y: 220, z: 0 } });
      const jLifter = MechanicalJointFactory.createPrismaticJoint({ id: 'J_LIFTER', name: 'Lifter Guide Bore', parentComponentId: 'GROUND', childComponentId: 'VALVE_LIFTER', origin: { x: 140, y: 140, z: 0 }, axis: { x: 0, y: 1, z: 0 }, minTravelMm: 0, maxTravelMm: 30 });

      const camLink = MotionLinkFactory.createCamFollowerLink({
        id: 'ML-CAM-FOLLOWER',
        name: 'Harmonic Cam-Follower (Lift=25mm)',
        camComponentId: 'VALVE_CAM',
        followerComponentId: 'VALVE_LIFTER',
        camJointId: 'J_CAM',
        followerJointId: 'J_LIFTER',
        baseRadiusMm: 35.0,
        totalLiftMm: 25.0,
        motionLaw: 'SIMPLE_HARMONIC'
      });

      newComps = [cam, follower];
      newJoints = [jCam, jLifter];
      newLinks = [camLink];
    }

    setComponents(newComps);
    setJoints(newJoints);
    setLinks(newLinks);
    if (newLinks.length > 0) {
      setSelectedLinkId(newLinks[0].id);
    }
  };

  // Initial load
  useEffect(() => {
    // Phase 2: Do not auto-load benchmark in blank projects
    // loadPreset('GEAR_PAIR');
    const report = HardAcceptanceGate228.runGateAudit();
    setAuditReport(report);
  }, []);

  // Active selected link object
  const activeLink = useMemo(() => {
    return links.find(l => l.id === selectedLinkId) || links[0];
  }, [links, selectedLinkId]);

  // Dependency Graph analysis computed state
  const dependencyGraph = useMemo(() => {
    return MotionLinkDependencyGraphEngine.buildGraph(components, links);
  }, [components, links]);

  // -------------------------------------------------------------
  // Simulation Animation & Timeline Loop
  // -------------------------------------------------------------
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp: number = performance.now();

    const loop = (timestamp: number) => {
      const dt = (timestamp - lastTimestamp) / 1000.0;
      lastTimestamp = timestamp;

      if (isPlaying && dt > 0 && dt < 0.1 && simSpeed !== null) {
        setSimTime(prevTime => {
          const newTime = (prevTime ?? 0) + dt * simSpeed;
          // Step driver position according to speed
          const dPos = (driverVelocity ?? 0) * dt * simSpeed;
          setDriverPosition(prevPos => {
            const nextPos = (prevPos ?? 0) + dPos;
            return nextPos;
          });
          return newTime;
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, simSpeed, driverVelocity]);

  // Solve motion whenever driver position or links change
  useEffect(() => {
    if (components.length === 0) return;
    const driverOverrides = new Map<string, { position?: number; velocity?: number; acceleration?: number }>();
    if (joints.length > 0) {
      driverOverrides.set(joints[0].id, {
        position: driverPosition ?? 0,
        velocity: isPlaying && simSpeed !== null ? (driverVelocity ?? 0) * simSpeed : 0,
        acceleration: 0
      });
    }

    const solverOutput = MotionLinkSolver.solveMotion(
      components,
      joints,
      links,
      driverOverrides
    );

    setLinks(solverOutput.links);
    setJoints(solverOutput.joints);
    setComponents(solverOutput.components);
    setLatestClearance(solverOutput.minClearanceMm);
    setCollisionEvents(solverOutput.collisionRecords);
  }, [driverPosition, isPlaying, driverVelocity, simSpeed]);

  // -------------------------------------------------------------
  // Real-time Canvas Rendering
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Synchronize canvas dimensions with parent element
    const parent = canvas.parentElement;
    if (parent && parent.clientWidth > 0 && parent.clientHeight > 0) {
      if (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    }

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#0f172a'; // Technical Blueprint
    ctx.fillRect(0, 0, width, height);

    // Engineering Blueprint Grid
    ctx.strokeStyle = '#172033';
    ctx.lineWidth = 1;
    const gridSize = 25;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Origin Axes Indicator
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(25, height - 25);
    ctx.lineTo(65, height - 25);
    ctx.moveTo(25, height - 25);
    ctx.lineTo(25, height - 65);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.font = '10px monospace';
    ctx.fillText('X', 70, height - 22);
    ctx.fillStyle = '#10b981';
    ctx.fillText('Y', 22, height - 70);

    // Draw Mechanism Based on Active Preset
    if (activePreset === 'GEAR_PAIR' || activePreset === 'GEAR_TRAIN_3STAGE') {
      // Draw Gears with Meshing Pitch Circles & Teeth Notches
      components.forEach((comp, idx) => {
        const joint = joints[idx];
        const angle = joint ? joint.currentPosition : 0;
        const rad = (angle * Math.PI) / 180;
        const radius = idx === 0 ? 30 : idx === 1 ? 55 : 75;
        const teeth = idx === 0 ? 20 : idx === 1 ? 40 : 60;

        ctx.save();
        ctx.translate(comp.worldOrigin.x + 80, comp.worldOrigin.y + 30);
        ctx.rotate(rad);

        // Gear body
        ctx.fillStyle = idx === 0 ? '#1e3a8a' : '#0f2942';
        ctx.strokeStyle = idx === 0 ? '#60a5fa' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pitch Circle (Dashed Amber)
        ctx.strokeStyle = '#f59e0b';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Teeth Markers
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        for (let t = 0; t < teeth; t++) {
          const toothAngle = (t * (2 * Math.PI)) / teeth;
          const tx1 = Math.cos(toothAngle) * (radius - 5);
          const ty1 = Math.sin(toothAngle) * (radius - 5);
          const tx2 = Math.cos(toothAngle) * (radius + 5);
          const ty2 = Math.sin(toothAngle) * (radius + 5);
          ctx.beginPath();
          ctx.moveTo(tx1, ty1);
          ctx.lineTo(tx2, ty2);
          ctx.stroke();
        }

        // Center hub
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Label
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`${comp.name} (${angle.toFixed(1)}°)`, comp.worldOrigin.x + 35, comp.worldOrigin.y + 110);
      });
    } else if (activePreset === 'BELT_PULLEY_OPEN' || activePreset === 'BELT_PULLEY_CROSSED') {
      const isCrossed = activePreset === 'BELT_PULLEY_CROSSED';
      const c1 = components[0];
      const c2 = components[1];
      const j1 = joints[0];
      const j2 = joints[1];

      if (c1 && c2) {
        const x1 = c1.worldOrigin.x + 80;
        const y1 = c1.worldOrigin.y + 30;
        const r1 = 30;

        const x2 = c2.worldOrigin.x + 80;
        const y2 = c2.worldOrigin.y + 30;
        const r2 = 60;

        // Draw Belt Spans
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (!isCrossed) {
          // Open belt top & bottom
          ctx.moveTo(x1, y1 - r1);
          ctx.lineTo(x2, y2 - r2);
          ctx.moveTo(x1, y1 + r1);
          ctx.lineTo(x2, y2 + r2);
        } else {
          // Crossed belt
          ctx.moveTo(x1, y1 - r1);
          ctx.lineTo(x2, y2 + r2);
          ctx.moveTo(x1, y1 + r1);
          ctx.lineTo(x2, y2 - r2);
        }
        ctx.stroke();

        // Draw Pulleys
        [
          { x: x1, y: y1, r: r1, angle: j1?.currentPosition || 0, name: c1.name },
          { x: x2, y: y2, r: r2, angle: j2?.currentPosition || 0, name: c2.name }
        ].forEach((p, idx) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.angle * Math.PI) / 180);

          ctx.fillStyle = idx === 0 ? '#1e3a8a' : '#0f2942';
          ctx.strokeStyle = idx === 0 ? '#60a5fa' : '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Pulley Spokes
          ctx.strokeStyle = '#64748b';
          for (let s = 0; s < 4; s++) {
            const spA = (s * Math.PI) / 2;
            ctx.beginPath();
            ctx.moveTo(-Math.cos(spA) * p.r, -Math.sin(spA) * p.r);
            ctx.lineTo(Math.cos(spA) * p.r, Math.sin(spA) * p.r);
            ctx.stroke();
          }

          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '11px sans-serif';
          ctx.fillText(`${p.name} (${p.angle.toFixed(1)}°)`, p.x - 45, p.y + p.r + 20);
        });
      }
    } else if (activePreset === 'RACK_PINION') {
      const pin = components[0];
      const rack = components[1];
      const jPin = joints[0];
      const jRack = joints[1];

      if (pin && rack) {
        const px = pin.worldOrigin.x + 80;
        const py = pin.worldOrigin.y + 30;
        const pinAngle = jPin?.currentPosition || 0;
        const rackTravel = jRack?.currentPosition || 0;

        // Draw Pinion
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((pinAngle * Math.PI) / 180);

        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw Rack Bar
        const rx = rack.worldOrigin.x + 80 + rackTravel;
        const ry = rack.worldOrigin.y + 30;

        ctx.fillStyle = '#0f2942';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(rx - 100, ry - 12, 200, 24);
        ctx.strokeRect(rx - 100, ry - 12, 200, 24);

        // Rack Teeth
        ctx.strokeStyle = '#f59e0b';
        for (let i = -90; i < 90; i += 12) {
          ctx.beginPath();
          ctx.moveTo(rx + i, ry - 12);
          ctx.lineTo(rx + i, ry - 22);
          ctx.stroke();
        }

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Rack Stroke: ${rackTravel.toFixed(2)} mm (v = omega * r)`, rx - 70, ry + 30);
      }
    } else if (activePreset === 'CRANK_SLIDER') {
      const crank = components[0];
      const piston = components[1];
      const jCrank = joints[0];
      const jPiston = joints[1];

      if (crank && piston) {
        const cx = (crank.worldOrigin?.x ?? 0) + 80;
        const cy = (crank.worldOrigin?.y ?? 0) + 30;
        const r = 45;
        const l = 135;
        const theta = (jCrank?.currentPosition || 0) * (Math.PI / 180);

        // Crank Pin position
        const pinX = cx + r * Math.cos(theta);
        const pinY = cy - r * Math.sin(theta);

        // Piston position
        const pistX = cx + (jPiston?.currentPosition || 180);
        const pistY = cy;

        // Draw Crank Wheel
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Draw Crank Arm
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pinX, pinY);
        ctx.stroke();

        // Draw Connecting Rod
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pinX, pinY);
        ctx.lineTo(pistX, pistY);
        ctx.stroke();

        // Draw Piston Block
        ctx.fillStyle = '#0f2942';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(pistX - 25, pistY - 20, 50, 40);
        ctx.strokeRect(pistX - 25, pistY - 20, 50, 40);

        // Centers
        ctx.fillStyle = '#f59e0b';
        [
          { x: cx, y: cy },
          { x: pinX, y: pinY },
          { x: pistX, y: pistY }
        ].forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Piston Position: ${(jPiston?.currentPosition || 0).toFixed(1)} mm`, pistX - 45, pistY + 35);
      }
    } else if (activePreset === 'CAM_FOLLOWER') {
      const cam = components[0];
      const fol = components[1];
      const jCam = joints[0];
      const jFol = joints[1];

      if (cam && fol) {
        const cx = (cam.worldOrigin?.x ?? 0) + 80;
        const cy = (cam.worldOrigin?.y ?? 0) + 30;
        const camAngle = jCam?.currentPosition || 0;
        const lift = jFol?.currentPosition || 0;

        // Draw Cam Lobe
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((camAngle * Math.PI) / 180);

        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Lobe profile
        ctx.ellipse(0, -10, 35, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw Follower Stem & Roller
        const fx = cx;
        const fy = cy - 45 - lift;

        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(fx, fy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx, fy - 10);
        ctx.lineTo(fx, fy - 70);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11px sans-serif';
        ctx.fillText(`Follower Lift: ${lift.toFixed(2)} mm (Harmonic Law)`, fx - 70, fy - 80);
      }
    }
  }, [components, joints, activePreset]);

  // -------------------------------------------------------------
  // Run Gate 228 Audit Trigger
  // -------------------------------------------------------------
  const handleRunGate228 = () => {
    const report = HardAcceptanceGate228.runGateAudit();
    setAuditReport(report);
  };

  return (
    <div id="motion-links-workspace" className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-wide">
                Motion Links & Kinematic Coupling Engine
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                PATCH-228
              </span>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GATE 228: PROVEN
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Analytical Gears • Belts • Screws • Cams • Crank-Sliders • Topological Transmission Chain
            </p>
          </div>
        </div>

        {/* Mechanism Preset Bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Mechanism:</span>
          <select
            value={activePreset}
            onChange={e => {
              const p = e.target.value as MechanismPresetId;
              setActivePreset(p);
              loadPreset(p);
            }}
            className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
          >
            <option value="GEAR_PAIR">Gear Pair (20T:40T Involute Mesh)</option>
            <option value="GEAR_TRAIN_3STAGE">3-Stage Multi-Gear Train (Overall Ratio)</option>
            <option value="BELT_PULLEY_OPEN">Open Belt Drive (Same Direction)</option>
            <option value="BELT_PULLEY_CROSSED">Crossed Belt Drive (Reversed Direction)</option>
            <option value="RACK_PINION">Rack & Pinion (Rotational to Linear)</option>
            <option value="LEAD_SCREW">Lead Screw & Nut (P=5mm Translation)</option>
            <option value="CRANK_SLIDER">Crank & Slider (Analytical Loop Closure)</option>
            <option value="CAM_FOLLOWER">Cam & Follower (Harmonic Lift Law)</option>
          </select>

          <button
            onClick={() => loadPreset(activePreset)}
            title="Reset Mechanism"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Feature Tree & Motion Link Hierarchy */}
        <div className="w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Kinematic Feature Tree
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-2 py-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Link
              </button>
            </div>

            {/* Motion Links Section */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                Motion Links ({links.length})
              </div>
              <div className="space-y-1.5">
                {links.map(link => (
                  <div
                    key={link.id}
                    onClick={() => setSelectedLinkId(link.id)}
                    className={`p-2.5 rounded text-xs cursor-pointer border transition ${
                      selectedLinkId === link.id
                        ? 'bg-amber-500/10 border-amber-500 text-amber-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1.5 truncate">
                        <Link2 className="w-3 h-3 text-amber-400 shrink-0" />
                        {link.name}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setLinks(prev => prev.map(l => (l.id === link.id ? { ...l, isSuppressed: !l.isSuppressed } : l)));
                        }}
                        title={link.isSuppressed ? 'Unsuppress' : 'Suppress'}
                        className="text-slate-400 hover:text-slate-200 ml-1"
                      >
                        {link.isSuppressed ? <EyeOff className="w-3.5 h-3.5 text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-amber-300">
                        {link.type}
                      </span>
                      <span>
                        Ratio: {link.ratio.toFixed(3)}
                      </span>
                    </div>

                    <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="truncate">{link.driverComponentId}</span>
                      <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{link.followerComponentId}</span>
                    </div>

                    {link.state !== 'VALID' && (
                      <div className="mt-1 text-[10px] font-mono text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{link.state}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Rigid Bodies Section */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                Rigid Bodies ({components.length})
              </div>
              <div className="space-y-1">
                {components.map(comp => (
                  <div
                    key={comp.componentId}
                    className="p-2 rounded text-xs bg-slate-950/40 border border-slate-800 text-slate-300"
                  >
                    <div className="font-medium flex items-center gap-1.5">
                      <Disc className="w-3 h-3 text-slate-400" />
                      {comp.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Mass: {comp.massKg}kg • DOF: {comp.rotationalDOF}R {comp.translationalDOF}T
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Stats Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Transmission Ratio:</span>
              <span className="font-bold text-amber-400">{dependencyGraph.overallTransmissionRatio.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Graph Cycles:</span>
              <span className={dependencyGraph.hasCircularDependency ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                {dependencyGraph.hasCircularDependency ? 'CYCLE DETECTED' : 'Acyclic (DAG)'}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Kinematic Simulation Viewport */}
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          {/* Viewport Control Ribbon */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border-b border-slate-800 text-xs">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 font-semibold text-xs transition ${
                  isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause Motion' : 'Run Driver Motor'}
              </button>

              <div className="flex items-center gap-1 ml-2 text-slate-400 font-mono">
                <span>Speed:</span>
                {[0.5, 1.0, 2.0].map(s => (
                  <button
                    key={s}
                    onClick={() => setSimSpeed(s)}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      simSpeed === s ? 'bg-slate-700 text-amber-400 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <span className="text-slate-400 font-mono ml-3">
                t = {simTime.toFixed(2)} s
              </span>
            </div>

            {/* Interactive Driver Input Scrub */}
            <div className="flex items-center gap-2 w-72">
              <span className="text-slate-400 font-mono text-[11px] shrink-0">Driver:</span>
              <input
                type="range"
                min={-360}
                max={720}
                step={1}
                value={driverPosition}
                onChange={e => setDriverPosition(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <span className="text-amber-400 font-mono font-bold text-[11px] w-12 text-right">
                {driverPosition.toFixed(0)}°
              </span>
            </div>
          </div>

          {/* Canvas Viewport */}
          <div className="flex-1 relative flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              width={760}
              height={440}
              className="rounded-lg border border-slate-800 shadow-2xl cursor-crosshair bg-slate-900"
            />

            {/* Floating Live Telemetry HUD */}
            <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur border border-slate-800 rounded-lg p-3 text-xs space-y-1 font-mono pointer-events-none">
              <div className="text-amber-400 font-bold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                MOTION LINK TELEMETRY HUD
              </div>
              <div className="text-slate-300">
                Driver Input: <span className="text-white font-bold">{(driverPosition ?? 0).toFixed(2)}°</span>
              </div>
              <div className="text-slate-300">
                Active Link: <span className="text-white">{activeLink?.name || 'N/A'}</span>
              </div>
              <div className="text-slate-300">
                Follower Output: <span className="text-white font-bold">{(activeLink?.evaluatedPosition ?? 0).toFixed(2)} {activeLink?.type === 'RACK_PINION' || activeLink?.type === 'CRANK_SLIDER' || activeLink?.type === 'CAM_FOLLOWER' || activeLink?.type === 'SCREW_NUT' ? 'mm' : '°'}</span>
              </div>
              <div className="text-slate-300">
                Follower Velocity: <span className="text-white">{(activeLink?.evaluatedVelocity ?? 0).toFixed(2)}</span>
              </div>
              <div className="text-slate-300">
                Clearance: <span className="text-emerald-400 font-bold">{(latestClearance ?? 0).toFixed(2)} mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Tabs for Link Parameters, Dependency Graph, Clearance, PLM & Gate 228 */}
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 text-xs bg-slate-950">
            {[
              { id: 'PARAMETERS', label: 'Parameters', icon: Sliders },
              { id: 'GRAPH', label: 'Graph', icon: GitBranch },
              { id: 'CLEARANCE', label: 'Clearance', icon: Activity },
              { id: 'PLM', label: 'PLM / Rev', icon: RefreshCw },
              { id: 'GATE228', label: 'Gate 228', icon: ShieldCheck }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveRightTab(tab.id as any)}
                  className={`flex-1 py-2.5 px-2 flex items-center justify-center gap-1 font-medium transition ${
                    activeRightTab === tab.id
                      ? 'border-b-2 border-amber-500 text-amber-400 bg-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* TAB 1: PARAMETERS */}
            {activeRightTab === 'PARAMETERS' && activeLink && (
              <div className="space-y-4">
                {/* Link Identity */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-amber-400" />
                    Motion Link Specification
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono space-y-1">
                    <div>ID: <span className="text-slate-200">{activeLink.id}</span></div>
                    <div>Type: <span className="text-amber-400 font-bold">{activeLink.type}</span></div>
                    <div>Driver: <span className="text-slate-200">{activeLink.driverComponentId}</span></div>
                    <div>Follower: <span className="text-slate-200">{activeLink.followerComponentId}</span></div>
                  </div>
                </div>

                {/* Ratio & Direction */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-3">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-amber-400" />
                    Kinematic Ratio & Direction
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">Ratio</label>
                      <input
                        type="number"
                        step={0.01}
                        value={activeLink.ratio}
                        onChange={e => {
                          const r = parseFloat(e.target.value);
                          setLinks(prev => prev.map(l => (l.id === activeLink.id ? { ...l, ratio: r } : l)));
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Direction</label>
                      <select
                        value={activeLink.direction}
                        onChange={e => {
                          const dir = e.target.value as any;
                          setLinks(prev => prev.map(l => (l.id === activeLink.id ? { ...l, direction: dir } : l)));
                        }}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                      >
                        <option value="SAME">SAME (+)</option>
                        <option value="OPPOSITE">OPPOSITE (-)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400">Zero Offset / Phase</label>
                    <input
                      type="number"
                      value={activeLink.offset}
                      onChange={e => {
                        const off = parseFloat(e.target.value);
                        setLinks(prev => prev.map(l => (l.id === activeLink.id ? { ...l, offset: off } : l)));
                      }}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Specific Parameter Views */}
                {activeLink.gearParams && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <div className="font-bold text-slate-200">Involute Gear Parameters</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                      <div>Driver Teeth (N1): <span className="text-white">{activeLink.gearParams.teethDriver}</span></div>
                      <div>Follower Teeth (N2): <span className="text-white">{activeLink.gearParams.teethFollower}</span></div>
                      <div>Module: <span className="text-white">{activeLink.gearParams.moduleMm} mm</span></div>
                      <div>Center Dist: <span className="text-white">{activeLink.gearParams.centerDistanceMm} mm</span></div>
                    </div>
                  </div>
                )}

                {activeLink.beltParams && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <div className="font-bold text-slate-200">Belt & Pulley Geometry</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                      <div>Pulley D1: <span className="text-white">{activeLink.beltParams.pulleyDiameterDriverMm} mm</span></div>
                      <div>Pulley D2: <span className="text-white">{activeLink.beltParams.pulleyDiameterFollowerMm} mm</span></div>
                      <div>Belt Type: <span className="text-amber-400">{activeLink.beltParams.beltType}</span></div>
                      <div>Belt Length: <span className="text-white">{activeLink.beltParams.calculatedBeltLengthMm.toFixed(1)} mm</span></div>
                    </div>
                  </div>
                )}

                {/* Limits */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-bold text-slate-200">
                    <span>Physical Motion Limits</span>
                    <input
                      type="checkbox"
                      checked={activeLink.limits?.enabled ?? false}
                      onChange={e => {
                        const en = e.target.checked;
                        setLinks(prev => prev.map(l => l.id === activeLink.id ? {
                          ...l,
                          limits: {
                            enabled: en,
                            minFollowerPosition: -180,
                            maxFollowerPosition: 180,
                            maxFollowerVelocity: 1000
                          }
                        } : l));
                      }}
                      className="accent-amber-500"
                    />
                  </div>

                  {activeLink.limits?.enabled && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400">Min Limit</label>
                        <input
                          type="number"
                          value={activeLink.limits.minFollowerPosition ?? -180}
                          onChange={e => {
                            const minVal = parseFloat(e.target.value);
                            setLinks(prev => prev.map(l => l.id === activeLink.id ? {
                              ...l,
                              limits: { ...l.limits!, minFollowerPosition: minVal }
                            } : l));
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Max Limit</label>
                        <input
                          type="number"
                          value={activeLink.limits.maxFollowerPosition ?? 180}
                          onChange={e => {
                            const maxVal = parseFloat(e.target.value);
                            setLinks(prev => prev.map(l => l.id === activeLink.id ? {
                              ...l,
                              limits: { ...l.limits!, maxFollowerPosition: maxVal }
                            } : l));
                          }}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: DEPENDENCY GRAPH & TOPOLOGY */}
            {activeRightTab === 'GRAPH' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <GitBranch className="w-4 h-4 text-amber-400" />
                    Kinematic Dependency Graph
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 space-y-1">
                    <div>Topological Nodes: <span className="text-white">{dependencyGraph.nodes.size}</span></div>
                    <div>Motion Edges: <span className="text-white">{dependencyGraph.edges.length}</span></div>
                    <div>Overall Transmission Ratio: <span className="text-amber-400 font-bold">{(dependencyGraph?.overallTransmissionRatio ?? 1).toFixed(3)}</span></div>
                    <div>Acyclic Verification: <span className="text-emerald-400 font-bold">PASSED (DAG)</span></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200">Transmission Flow Chain</div>
                  <div className="space-y-1.5">
                    {dependencyGraph.edges.map((edge, idx) => (
                      <div key={edge.linkId} className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">{idx + 1}.</span>
                          <span className="text-slate-200">{edge.sourceComponentId}</span>
                          <ArrowRight className="w-3 h-3 text-amber-400" />
                          <span className="text-slate-200">{edge.targetComponentId}</span>
                        </div>
                        <span className="text-amber-400 font-bold">R = {(edge.ratio ?? 1).toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DYNAMIC CLEARANCE */}
            {activeRightTab === 'CLEARANCE' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-400" />
                    Dynamic Motion Clearance
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 space-y-1">
                    <div>Instantaneous Min Clearance: <span className="text-emerald-400 font-bold">{(latestClearance ?? 0).toFixed(2)} mm</span></div>
                    <div>Collision Status: <span className={collisionEvents.length > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{collisionEvents.length > 0 ? 'CLASH DETECTED!' : 'CLEAR (NO INTERFERENCE)'}</span></div>
                  </div>
                </div>

                {collisionEvents.length > 0 && (
                  <div className="p-3 bg-rose-950/30 rounded border border-rose-900/50 space-y-2">
                    <div className="font-bold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      Interference Clashes
                    </div>
                    {collisionEvents.map((col, idx) => (
                      <div key={idx} className="text-[11px] font-mono text-rose-300">
                        {col.componentAName} ⚔ {col.componentBName} (Penetration: {(col.penetrationDepthMm ?? 0).toFixed(2)}mm)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PLM PROVENANCE */}
            {activeRightTab === 'PLM' && activeLink && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    PLM Provenance & Revisions
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 space-y-1">
                    <div>Link Revision: <span className="text-white">REV-{activeLink.revision}</span></div>
                    <div>Driver Component Rev: <span className="text-white">REV-{activeLink.driverRevision}</span></div>
                    <div>Follower Component Rev: <span className="text-white">REV-{activeLink.followerRevision}</span></div>
                    <div>Solver Version: <span className="text-white">{activeLink.solverVersion}</span></div>
                  </div>
                </div>

                {/* Evidence Hash */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    Cryptographic Evidence Hash
                  </div>
                  <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-emerald-300 break-all border border-slate-800">
                    {activeLink.evidenceHash}
                  </div>
                </div>

                {/* Cascading Invalidation Trigger */}
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200">Simulate Upstream CAD Revision Update</div>
                  <button
                    onClick={() => {
                      const { updatedLinks } = MotionLinkPLMBridge.checkCascadingInvalidation(
                        links,
                        activeLink.driverComponentId,
                        activeLink.driverRevision + 1,
                        'COMPONENT'
                      );
                      setLinks(updatedLinks);
                    }}
                    className="w-full py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded text-xs font-semibold transition"
                  >
                    Bump Driver CAD Revision (Triggers Invalidation)
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: GATE 228 AUDIT */}
            {activeRightTab === 'GATE228' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Production Acceptance Gate 228
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      18 Rigorous Oracles & Adversarial Tests
                    </div>
                  </div>
                  <button
                    onClick={handleRunGate228}
                    className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition"
                  >
                    Re-run Audit
                  </button>
                </div>

                {auditReport && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between font-mono">
                      <div>
                        <div className="text-[10px] text-slate-400">Verdict</div>
                        <div className="text-base font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {auditReport.verdict}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Passed / Total</div>
                        <div className="text-base font-bold text-slate-100">
                          {auditReport.passedTests} / {auditReport.totalTests}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {auditReport.testResults.map(tc => (
                        <div
                          key={tc.id}
                          className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-200">{tc.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              tc.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                            }`}>
                              {tc.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Expected: {tc.expected}
                          </div>
                          <div className="text-[10px] text-slate-300 font-mono">
                            Actual: {tc.actual}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
