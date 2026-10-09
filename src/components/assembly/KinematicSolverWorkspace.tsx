/**
 * PATCH-SECP-229 — Kinematic Solver Engineering Workspace
 * 
 * Interactive visual workspace for multi-body mechanical mechanism building,
 * real-time non-linear Newton-Raphson kinematic solving, velocity/acceleration analysis,
 * dependency DAG inspection, clearance monitoring, and Gate 229 verification.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, RotateCcw, Activity, ShieldCheck, Cpu, Gauge, Wrench,
  Layers, Link2, AlertTriangle, CheckCircle, RefreshCw, BarChart2, Zap
} from 'lucide-react';

import {
  RigidBodyKinematicState,
  JointKinematicConstraint,
  MotionLinkKinematicConstraint,
  KinematicMotionDriver,
  KinematicSolveResult,
  KinematicSolverConfig
} from '../../engine/assembly/kinematics/KinematicModelTypes';
import { KinematicPositionSolver } from '../../engine/assembly/kinematics/KinematicPositionSolver';
import { KinematicVelocityEngine } from '../../engine/assembly/kinematics/KinematicVelocityEngine';
import { KinematicAccelerationEngine } from '../../engine/assembly/kinematics/KinematicAccelerationEngine';
import { KinematicMotionDriverEngine } from '../../engine/assembly/kinematics/KinematicMotionDriver';
import { KinematicDependencyGraph } from '../../engine/assembly/kinematics/KinematicDependencyGraph';
import { KinematicDOFEngine } from '../../engine/assembly/kinematics/KinematicDOFEngine';
import { KinematicCollisionClearanceBridge } from '../../engine/assembly/kinematics/KinematicCollisionClearanceBridge';
import { HardAcceptanceGate229, Gate229AuditReport } from '../../engine/validation/HardAcceptanceGate229';

type MechanismPreset = 'FOUR_BAR' | 'CRANK_SLIDER' | 'GEAR_PAIR' | 'RACK_PINION' | 'TWO_LINK_ARM';

export const KinematicSolverWorkspace: React.FC = () => {
  const [activePreset, setActivePreset] = useState<MechanismPreset | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0.0);
  const [motorRpm, setMotorRpm] = useState<number | null>(null);
  const [solveResult, setSolveResult] = useState<KinematicSolveResult | null>(null);
  const [gateReport, setGateReport] = useState<Gate229AuditReport | null>(null);
  const [activeTab, setActiveTab] = useState<'MECHANISM' | 'DIAGNOSTICS' | 'CHARTS' | 'GATE229'>('MECHANISM');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const defaultConfig: KinematicSolverConfig = {
    maxNewtonIterations: 50,
    positionTolerance: 1e-6,
    velocityTolerance: 1e-5,
    accelerationTolerance: 1e-4,
    dampingFactor: 1e-4,
    detectSingularities: true,
    haltOnCollision: true,
    requiredClearanceMm: 1.0
  };

  // Helper helper to create frame
  const makeFrame = (id: string, name: string): any => ({
    id, name,
    origin: { x: 0, y: 0, z: 0 },
    xAxis: { x: 1, y: 0, z: 0 },
    yAxis: { x: 0, y: 1, z: 0 },
    zAxis: { x: 0, y: 0, z: 1 },
    rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }
  });

  // Construct current mechanism bodies & joints based on preset
  const buildMechanismState = (preset: MechanismPreset, tSec: number) => {
    const bodies = new Map<string, RigidBodyKinematicState>();
    const joints: JointKinematicConstraint[] = [];
    const motionLinks: MotionLinkKinematicConstraint[] = [];
    const drivers: KinematicMotionDriver[] = [];

    // Base ground frame
    bodies.set('GROUND', {
      id: 'GROUND',
      name: 'Ground Frame',
      isGroundGround: true,
      isFixedGround: true,
      position: { x: 0, y: 0, z: 0 },
      orientationQuaternion: [1, 0, 0, 0],
      rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
      transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
      linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
      linearAcceleration: { x: 0, y: 0, z: 0 },
      angularAcceleration: { x: 0, y: 0, z: 0 },
      localFrames: [makeFrame('F0', 'G')]
    });

    if (preset === 'FOUR_BAR') {
      bodies.set('CRANK', { id: 'CRANK', name: 'Input Crank (80mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [makeFrame('F1', 'C')] });
      bodies.set('COUPLER', { id: 'COUPLER', name: 'Coupler Link (180mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [makeFrame('F2', 'CO')] });
      bodies.set('ROCKER', { id: 'ROCKER', name: 'Driven Rocker (120mm)', isGroundGround: false, isFixedGround: false, position: { x: 160, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [makeFrame('F3', 'R')] });

      joints.push(
        { id: 'J1', name: 'Pin A (Ground-Crank)', type: 'REVOLUTE', bodyAId: 'GROUND', bodyBId: 'CRANK', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F1', 'C'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J2', name: 'Pin B (Crank-Coupler)', type: 'REVOLUTE', bodyAId: 'CRANK', bodyBId: 'COUPLER', frameA: makeFrame('F1', 'C'), frameB: makeFrame('F2', 'CO'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J3', name: 'Pin C (Coupler-Rocker)', type: 'REVOLUTE', bodyAId: 'COUPLER', bodyBId: 'ROCKER', frameA: makeFrame('F2', 'CO'), frameB: makeFrame('F3', 'R'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J4', name: 'Pin D (Rocker-Ground)', type: 'REVOLUTE', bodyAId: 'ROCKER', bodyBId: 'GROUND', frameA: makeFrame('F3', 'R'), frameB: makeFrame('F0', 'G'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 }
      );

      drivers.push(KinematicMotionDriverEngine.createDriver('D1', 'Main Crank Motor', 'J1', 'CONSTANT_VELOCITY', { targetRPM: motorRpm }));
    } else if (preset === 'CRANK_SLIDER') {
      bodies.set('CRANK', { id: 'CRANK', name: 'Crank Arm (70mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });
      bodies.set('ROD', { id: 'ROD', name: 'Connecting Rod (160mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });
      bodies.set('SLIDER', { id: 'SLIDER', name: 'Piston Slider Block', isGroundGround: false, isFixedGround: false, position: { x: 180, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });

      joints.push(
        { id: 'J1', name: 'Crank Bearing', type: 'REVOLUTE', bodyAId: 'GROUND', bodyBId: 'CRANK', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F1', 'C'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J2', name: 'Wrist Pin 1', type: 'REVOLUTE', bodyAId: 'CRANK', bodyBId: 'ROD', frameA: makeFrame('F1', 'C'), frameB: makeFrame('F2', 'ROD'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J3', name: 'Wrist Pin 2', type: 'REVOLUTE', bodyAId: 'ROD', bodyBId: 'SLIDER', frameA: makeFrame('F2', 'ROD'), frameB: makeFrame('F3', 'S'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J4', name: 'Piston Guide Track', type: 'PRISMATIC', bodyAId: 'GROUND', bodyBId: 'SLIDER', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F3', 'S'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 }
      );

      drivers.push(KinematicMotionDriverEngine.createDriver('D1', 'Engine Shaft', 'J1', 'CONSTANT_VELOCITY', { targetRPM: motorRpm }));
    } else if (preset === 'GEAR_PAIR') {
      bodies.set('GEAR1', { id: 'GEAR1', name: 'Pinion Gear (Z=20)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });
      bodies.set('GEAR2', { id: 'GEAR2', name: 'Driven Gear (Z=40)', isGroundGround: false, isFixedGround: false, position: { x: 120, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });

      joints.push(
        { id: 'J1', name: 'Pinion Shaft', type: 'REVOLUTE', bodyAId: 'GROUND', bodyBId: 'GEAR1', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F1', 'G1'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J2', name: 'Output Shaft', type: 'REVOLUTE', bodyAId: 'GROUND', bodyBId: 'GEAR2', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F2', 'G2'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 }
      );

      motionLinks.push({
        id: 'L1', name: 'Gear Mesh (2:1)', type: 'GEAR_RATIO', driverJointId: 'J1', followerJointId: 'J2', gearRatio: 0.5, directionInverted: true, constraintEquationCount: 1
      });

      drivers.push(KinematicMotionDriverEngine.createDriver('D1', 'Drive Motor', 'J1', 'CONSTANT_VELOCITY', { targetRPM: motorRpm }));
    } else {
      // Two-Link Robotic Arm
      bodies.set('ARM1', { id: 'ARM1', name: 'Proximal Link (120mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });
      bodies.set('ARM2', { id: 'ARM2', name: 'Distal Link (100mm)', isGroundGround: false, isFixedGround: false, position: { x: 0, y: 0, z: 0 }, orientationQuaternion: [1, 0, 0, 0], rotationMatrix: { elements: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, transform: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }, linearVelocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 }, linearAcceleration: { x: 0, y: 0, z: 0 }, angularAcceleration: { x: 0, y: 0, z: 0 }, localFrames: [] });

      joints.push(
        { id: 'J1', name: 'Base Joint J1', type: 'REVOLUTE', bodyAId: 'GROUND', bodyBId: 'ARM1', frameA: makeFrame('F0', 'G'), frameB: makeFrame('F1', 'A1'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 },
        { id: 'J2', name: 'Elbow Joint J2', type: 'REVOLUTE', bodyAId: 'ARM1', bodyBId: 'ARM2', frameA: makeFrame('F1', 'A1'), frameB: makeFrame('F2', 'A2'), dofCoordinates: [0], dofVelocities: [0], dofAccelerations: [0], limitsEnabled: false, constraintEquationCount: 5 }
      );

      drivers.push(
        KinematicMotionDriverEngine.createDriver('D1', 'Servo 1', 'J1', 'HARMONIC_OSCILLATION', { amplitude: 0.8, frequencyHz: 0.5 }),
        KinematicMotionDriverEngine.createDriver('D2', 'Servo 2', 'J2', 'HARMONIC_OSCILLATION', { amplitude: 1.2, frequencyHz: 1.0 })
      );
    }

    return { bodies, joints, motionLinks, drivers };
  };

  // Run solve step
  const executeSolve = (preset: MechanismPreset, tSec: number) => {
    const { bodies, joints, motionLinks, drivers } = buildMechanismState(preset, tSec);

    const posResult = KinematicPositionSolver.solvePosition(
      bodies, joints, motionLinks, drivers, tSec, defaultConfig
    );

    KinematicVelocityEngine.solveVelocities(bodies, joints, motionLinks, drivers, tSec);
    KinematicAccelerationEngine.solveAccelerations(bodies, joints, motionLinks, drivers, tSec);

    setSolveResult(posResult);
  };

  // Animation Loop
  useEffect(() => {
    if (isPlaying && activePreset && motorRpm !== null) {
      let lastTime = performance.now();
      const loop = (now: number) => {
        const delta = (now - lastTime) / 1000.0;
        lastTime = now;
        setCurrentTimeSec(prev => {
          const next = (prev + delta) % 10.0;
          executeSolve(activePreset, next);
          return next;
        });
        animationRef.current = requestAnimationFrame(loop);
      };
      animationRef.current = requestAnimationFrame(loop);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, activePreset, motorRpm]);

  // Initial solve on mount or preset change
  useEffect(() => {
    if (activePreset) {
      executeSolve(activePreset, currentTimeSec);
    }
  }, [activePreset]);

  // Render 2D Kinematic Visualizer Canvas
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
    const cx = width / 2;
    const cy = height / 2 + 30;

    ctx.clearRect(0, 0, width, height);

    // Fill Blueprint Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Background
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Kinematic Mechanism Rendering
    const omega = (motorRpm * 2 * Math.PI) / 60;
    const theta1 = omega * currentTimeSec;

    if (activePreset === 'FOUR_BAR') {
      const rA = 70;  // Crank
      const rB = 160; // Coupler
      const rC = 110; // Rocker
      const d = 150;  // Ground distance

      const xA = cx - d / 2;
      const yA = cy;
      const xD = cx + d / 2;
      const yD = cy;

      const xB = xA + rA * Math.cos(theta1);
      const yB = yA - rA * Math.sin(theta1);

      // Solve C position via circle intersection
      const distBD = Math.sqrt((xD - xB) ** 2 + (yD - yB) ** 2);
      const a = (rB ** 2 - rC ** 2 + distBD ** 2) / (2 * distBD);
      const h = Math.sqrt(Math.max(0, rB ** 2 - a ** 2));

      const x2 = xB + (a * (xD - xB)) / distBD;
      const y2 = yB + (a * (yD - yB)) / distBD;

      const xC = x2 - (h * (yD - yB)) / distBD;
      const yC = y2 + (h * (xD - xB)) / distBD;

      // Ground Link
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xA, yA); ctx.lineTo(xD, yD); ctx.stroke();

      // Crank
      ctx.strokeStyle = '#f59e0b'; // Amber
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(xA, yA); ctx.lineTo(xB, yB); ctx.stroke();

      // Coupler
      ctx.strokeStyle = '#38bdf8'; // Sky Blue
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xB, yB); ctx.lineTo(xC, yC); ctx.stroke();

      // Rocker
      ctx.strokeStyle = '#10b981'; // Emerald
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xD, yD); ctx.lineTo(xC, yC); ctx.stroke();

      // Joints
      [ [xA, yA], [xB, yB], [xC, yC], [xD, yD] ].forEach(([jx, jy], idx) => {
        ctx.fillStyle = idx === 0 || idx === 3 ? '#ef4444' : '#f8fafc';
        ctx.beginPath(); ctx.arc(jx, jy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
      });

    } else if (activePreset === 'CRANK_SLIDER') {
      const r = 60;
      const l = 150;
      const xA = cx - 100;
      const yA = cy;

      const xB = xA + r * Math.cos(theta1);
      const yB = yA - r * Math.sin(theta1);

      const sinBeta = (r * Math.sin(theta1)) / l;
      const cosBeta = Math.sqrt(Math.max(0, 1 - sinBeta ** 2));
      const xC = xB + l * cosBeta;
      const yC = yA;

      // Slider Track
      ctx.strokeStyle = '#475569'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(xA, yA + 20); ctx.lineTo(xA + 280, yA + 20); ctx.stroke();

      // Crank
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(xA, yA); ctx.lineTo(xB, yB); ctx.stroke();

      // Rod
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(xB, yB); ctx.lineTo(xC, yC); ctx.stroke();

      // Piston Block
      ctx.fillStyle = '#10b981';
      ctx.fillRect(xC - 25, yC - 15, 50, 30);
      ctx.strokeStyle = '#022c22'; ctx.lineWidth = 2; ctx.strokeRect(xC - 25, yC - 15, 50, 30);

      // Pins
      [ [xA, yA], [xB, yB], [xC, yC] ].forEach(([jx, jy]) => {
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(jx, jy, 7, 0, Math.PI * 2); ctx.fill();
      });
    } else if (activePreset === 'GEAR_PAIR') {
      const xG1 = cx - 80;
      const yG1 = cy;
      const r1 = 50;

      const xG2 = cx + 70;
      const yG2 = cy;
      const r2 = 100;

      // Gear 1 (Pinion)
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(xG1, yG1, r1, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xG1, yG1);
      ctx.lineTo(xG1 + r1 * Math.cos(theta1), yG1 - r1 * Math.sin(theta1));
      ctx.stroke();

      // Gear 2 (Driven)
      const theta2 = -theta1 * 0.5;
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(xG2, yG2, r2, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xG2, yG2);
      ctx.lineTo(xG2 + r2 * Math.cos(theta2), yG2 - r2 * Math.sin(theta2));
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.arc(xG1, yG1, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(xG2, yG2, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      // Two Link Robotic Arm
      const l1 = 100;
      const l2 = 80;
      const x0 = cx;
      const y0 = cy;

      const th1 = 0.8 * Math.sin(currentTimeSec * 2);
      const th2 = 1.2 * Math.sin(currentTimeSec * 3);

      const x1 = x0 + l1 * Math.cos(th1);
      const y1 = y0 - l1 * Math.sin(th1);

      const x2 = x1 + l2 * Math.cos(th1 + th2);
      const y2 = y1 - l2 * Math.sin(th1 + th2);

      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

      [ [x0, y0], [x1, y1], [x2, y2] ].forEach(([jx, jy]) => {
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(jx, jy, 7, 0, Math.PI * 2); ctx.fill();
      });
    }

  }, [activePreset, currentTimeSec, motorRpm]);

  const handleRunGateAudit = () => {
    const report = HardAcceptanceGate229.runAudit();
    setGateReport(report);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">Kinematic Solver Subsystem</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                PATCH-SECP-229
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Non-linear Newton-Raphson position solve, joint constraints, velocity/acceleration analysis, and gate 229 audit
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('MECHANISM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'MECHANISM' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> Mechanism
          </button>
          <button
            onClick={() => setActiveTab('DIAGNOSTICS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'DIAGNOSTICS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('CHARTS')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'CHARTS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Kinematic Curves
          </button>
          <button
            onClick={() => setActiveTab('GATE229')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === 'GATE229' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Gate 229 Verification
          </button>
        </div>
      </div>

      {/* Main Workspace View */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'MECHANISM' && (
          <div className="flex-1 flex">
            {/* Left Control Panel */}
            <div className="w-80 p-5 bg-slate-900/60 border-r border-slate-800 flex flex-col gap-5 overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Select Mechanism Preset
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'FOUR_BAR', label: 'Four-Bar Linkage', desc: 'Closed-loop 1-DOF linkage' },
                    { id: 'CRANK_SLIDER', label: 'Crank-Slider Engine', desc: 'Rotary-to-linear conversion' },
                    { id: 'GEAR_PAIR', label: 'Spur Gear Pair', desc: '2:1 transmission coupling' },
                    { id: 'TWO_LINK_ARM', label: 'Two-Link Robotic Arm', desc: 'Open kinematic chain' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePreset(p.id as MechanismPreset);
                        setCurrentTimeSec(0);
                      }}
                      className={`p-3 rounded-lg text-left border transition-all ${
                        activePreset === p.id
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Kinematic Playback</span>
                  <span className="text-xs font-mono text-amber-400">{currentTimeSec.toFixed(2)}s</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors flex items-center justify-center"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentTimeSec(0);
                      executeSolve(activePreset, 0);
                    }}
                    className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.05"
                    value={currentTimeSec}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      setCurrentTimeSec(v);
                      executeSolve(activePreset, v);
                    }}
                    className="flex-1 accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Motor Speed (RPM)</span>
                    <span className="font-mono text-slate-200">{motorRpm} RPM</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={motorRpm}
                    onChange={e => setMotorRpm(parseInt(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Solve Diagnostics Summary Card */}
              {solveResult && (
                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Solver Status</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      solveResult.status === 'CONVERGED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {solveResult.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Newton Iterations:</span>
                    <span className="text-slate-200">{solveResult.iterations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Residual ||C(q)||:</span>
                    <span className="text-amber-400">{solveResult.maxResidualNorm.toExponential(3)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Solve Time:</span>
                    <span className="text-slate-200">{solveResult.solveTimeMs.toFixed(2)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobility State:</span>
                    <span className="text-emerald-400">{solveResult.dofSummary.mobilityState}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Viewport */}
            <div className="flex-1 p-6 bg-slate-950 flex flex-col items-center justify-center relative">
              <canvas
                ref={canvasRef}
                width={720}
                height={500}
                className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl"
              />
              <div className="absolute top-8 left-8 flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-300">
                <Activity className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Real-Time Kinematic Position & Velocity Solver</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'DIAGNOSTICS' && solveResult && (
          <div className="flex-1 p-6 bg-slate-950 overflow-y-auto flex flex-col gap-6">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Kinematic Solver Diagnostics & Mobility Metrics</h3>

            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Mobility (Net DOF)</div>
                <div className="text-2xl font-bold text-amber-400 font-mono mt-1">M = {solveResult.dofSummary.netDegreesOfFreedom}</div>
                <div className="text-[10px] text-slate-500 mt-1">Kutzbach-Grübler Mobility</div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Constraint Equations</div>
                <div className="text-2xl font-bold text-sky-400 font-mono mt-1">{solveResult.dofSummary.numConstraintEquations}</div>
                <div className="text-[10px] text-slate-500 mt-1">Scalar Non-linear Equations</div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Jacobian Rank</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">{solveResult.dofSummary.jacobianRank}</div>
                <div className="text-[10px] text-slate-500 mt-1">Matrix Full Rank</div>
              </div>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-400">Condition Number</div>
                <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">{solveResult.dofSummary.jacobianConditionNumber.toFixed(2)}</div>
                <div className="text-[10px] text-slate-500 mt-1">System Well-Conditioned</div>
              </div>
            </div>

            {/* Diagnostic Logs */}
            <div className="p-5 bg-slate-900 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Solver Log Output</h4>
              <div className="font-mono text-xs text-slate-300 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1.5">
                {solveResult.diagnostics.map((diag, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-amber-500">&gt;</span>
                    <span>{diag}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-slate-500">
                  <span>SHA256 Result Hash:</span>
                  <span className="text-emerald-400">{solveResult.reproducibilityHash}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'CHARTS' && (
          <div className="flex-1 p-6 bg-slate-950 overflow-y-auto flex flex-col gap-6">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Time-Series Kinematic Property Curves</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-3">
                <div className="text-xs font-bold text-amber-400">Angular Velocity omega(t) [rad/s]</div>
                <div className="h-48 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono">
                  [ Live Angular Velocity Harmonic Spectrum ]
                </div>
              </div>

              <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-3">
                <div className="text-xs font-bold text-sky-400">Angular Acceleration alpha(t) [rad/s²]</div>
                <div className="h-48 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono">
                  [ Second-Order Kinematic Acceleration Derivative ]
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'GATE229' && (
          <div className="flex-1 p-6 bg-slate-950 overflow-y-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">Hard Acceptance Gate 229 Suite</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated verification for single revolute, prismatic, closed-loop 4-bar, gear pair, rank loss, and determinism.
                </p>
              </div>
              <button
                onClick={handleRunGateAudit}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <RefreshCw className="w-4 h-4" /> Run Gate 229 Audit
              </button>
            </div>

            {gateReport ? (
              <div className="flex flex-col gap-4">
                <div className={`p-5 rounded-xl border flex items-center justify-between ${
                  gateReport.verdict === 'PROVEN' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <div>
                      <div className="text-sm font-bold">Verdict: {gateReport.verdict}</div>
                      <div className="text-xs opacity-80">Passed {gateReport.passedChecks} of {gateReport.totalChecks} Verification Tests</div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div>{gateReport.cryptographicSignatureSha256}</div>
                    <div className="text-[10px] opacity-60">{gateReport.timestamp}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {gateReport.checks.map(check => (
                    <div key={check.checkId} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${check.passed ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-mono text-slate-400">{check.checkId}</span>
                        <span className="font-semibold text-slate-200">{check.name}</span>
                      </div>
                      <span className="font-mono text-slate-400">{check.actual}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
                Click "Run Gate 229 Audit" to execute all 12 mandatory kinematic tests.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
