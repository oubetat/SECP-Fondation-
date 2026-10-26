/**
 * PATCH-SECP-004 — 3D Visualization Engine
 * Interactive Three.js WebGL CAD Viewport with Orbit, Pan, Zoom, Fit-to-screen,
 * Part Selection, Section Plane cutting, and 3D Distance Measurement Tool.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, Maximize2, Scissors, Ruler, Eye, Box, Layers, Layers3, Gauge, Droplet, Sliders, Sparkles, CheckCircle2, ChevronRight, Activity, Flame, Settings, Pencil, Circle, X } from 'lucide-react';
import { CadSolidEntity } from '../engine/cadKernel';
import { AssemblyComponentItem, AssemblyEngine } from '../engine/assembly';
import { UnitEngine } from '../engine/units';
import { buildSolidWorksBallValve } from './CadIndustrialModels';
import { CanonicalRenderData, createCanonicalRenderDataFromMesh } from '../engine/viewport/CanonicalRenderContract';
import {
  convertRenderDataToThreeBufferGeometry,
  convertCanonicalFaceToHighlightGeometry,
  convertCanonicalEdgeToHighlightGeometry,
  convertCanonicalVertexToHighlightGeometry,
  convertCanonicalPickToHighlightGeometry
} from '../engine/viewport/ThreeGeometryConverter';
import {
  CanonicalPickResult,
  CanonicalSelectionState,
  CanonicalTopologyType,
  createCanonicalSelection,
  createEmptyCanonicalSelection,
  resolveCanonicalFaceFromTriangle,
  resolveCanonicalEdgeFromTriangle,
  resolveCanonicalVertexFromTriangle,
  resolveCanonicalTopologyFromTriangle
} from '../engine/viewport/CanonicalPickingContract';
import { shouldDisplayHighlight } from '../engine/viewport/RevisionLifecycle';

export type ActiveProjectType =
  | 'NO_PROJECT'
  | 'BLANK'
  | 'BALL_VALVE'
  | 'INDUSTRIAL_DRONE'
  | 'FLIGHT_BRACKET'
  | 'CUSTOM_SOLID'
  | 'IMPORTED'
  | 'GENERAL_MECHANICAL'
  | 'PART'
  | 'ASSEMBLY'
  | 'SHEET_METAL'
  | 'FLUID_SYSTEM'
  | 'SIMULATION'
  | 'MANUFACTURING'
  | 'CUSTOM';

export interface ValveControlConfig {
  valveType: 'BALL_VALVE' | 'GOOSENECK_FAUCET' | 'GATE_VALVE';
  openAngleDeg: number; // 0 (closed) to 90 (fully open)
  explodedFactor: number; // 0 (assembled) to 1.0 (fully exploded)
  material: 'BRASS' | 'STAINLESS_STEEL' | 'CHROME' | 'BRONZE' | 'GOLD';
  handleColor: string; // '#ef4444' (red), '#3b82f6' (blue), '#10b981'
  showWaterFlow: boolean;
}

export interface SimulationData {
  type: 'THERMAL' | 'STRESS' | 'SIGNAL_INTEGRITY';
  values: number[]; // Corresponds to vertex index or face index depending on engine
  minValue: number;
  maxValue: number;
  unit: string;
  targetEntityId?: string;
}

interface CadViewport3DProps {
  activeProjectType?: ActiveProjectType;
  activePatchTab?: string;
  activeSolid?: CadSolidEntity | null;
  canonicalRenderData?: CanonicalRenderData;
  simulationResults?: SimulationData | null;
  assemblyComponents?: AssemblyComponentItem[];
  selectedPartId?: string | null;
  hiddenInstanceIds?: string[];
  onSelectPartId?: (partId: string | null) => void;
  explodedFactor?: number;
  activeUnit?: string;
  onSelectComponent?: (compName: string) => void;
  onCanonicalPick?: (pickResult: CanonicalPickResult | null) => void;
  selectedCanonicalFace?: CanonicalPickResult | null;
  valveConfig?: Partial<ValveControlConfig>;
  onValveConfigChange?: (config: Partial<ValveControlConfig>) => void;
  onStartSketch?: () => void;
  onCreatePrimitive?: (type: 'BOX' | 'CYLINDER' | 'SPHERE') => void;
  onLoadProject?: (type: ActiveProjectType) => void;
  droneCamResult?: any;
}

function project3D(x: number, y: number, z: number, rotX: number, rotY: number, width: number, height: number, scale = 1.8) {
  // Convert angles to radians
  const rX = rotX * Math.PI / 180;
  const rY = rotY * Math.PI / 180;

  // Rotate around Y axis
  const x1 = x * Math.cos(rY) - z * Math.sin(rY);
  const z1 = x * Math.sin(rY) + z * Math.cos(rY);

  // Rotate around X axis
  const y2 = y * Math.cos(rX) - z1 * Math.sin(rX);
  const z2 = y * Math.sin(rX) + z1 * Math.cos(rX);

  // Perspective projection
  const distance = 400;
  const fov = distance / (distance + z2);
  const projX = width / 2 + x1 * fov * scale;
  const projY = height / 2 - y2 * fov * scale;

  return { x: projX, y: projY, depth: z2 };
}

export const CadViewport3D: React.FC<CadViewport3DProps> = ({
  activeProjectType = 'BLANK',
  activePatchTab = 'PATCH-004',
  activeSolid,
  canonicalRenderData,
  simulationResults,
  assemblyComponents,
  selectedPartId,
  hiddenInstanceIds = [],
  onSelectPartId,
  explodedFactor = 0,
  activeUnit = 'mm',
  onSelectComponent,
  onCanonicalPick,
  selectedCanonicalFace,
  valveConfig,
  onValveConfigChange,
  onStartSketch,
  onCreatePrimitive,
  onLoadProject,
  droneCamResult,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showSectionPlane, setShowSectionPlane] = useState(false);
  const [sectionPlaneOffset, setSectionPlaneOffset] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<THREE.Vector3[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [renderingBackend, setRenderingBackend] = useState<'WebGPU' | 'WebGL'>('WebGL');
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
  const [topologyFilter, setTopologyFilter] = useState<CanonicalTopologyType>('FACE');
  const [canonicalSelection, setCanonicalSelection] = useState<CanonicalSelectionState>(() => createEmptyCanonicalSelection('FACE'));
  const [showPipelineDetails, setShowPipelineDetails] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [isWebGLFailed, setIsWebGLFailed] = useState(false);
  const [useFallbackEngine, setUseFallbackEngine] = useState(false);
  const [fallbackRotationX, setFallbackRotationX] = useState(25);
  const [fallbackRotationY, setFallbackRotationY] = useState(45);
  const [isDraggingFallback, setIsDraggingFallback] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);

  // Valve / Faucet Interactive States
  const [internalValveAngle, setInternalValveAngle] = useState<number | null>(valveConfig?.openAngleDeg ?? null);
  const [internalValveExploded, setInternalValveExploded] = useState<number | null>(valveConfig?.explodedFactor ?? null);
  const [internalValveMaterial, setInternalValveMaterial] = useState<'BRASS' | 'STAINLESS_STEEL' | 'CHROME' | 'BRONZE' | 'GOLD' | null>(
    valveConfig?.material ?? null
  );
  const [internalHandleColor, setInternalHandleColor] = useState<string | null>(valveConfig?.handleColor ?? null);
  const [showValveControls, setShowValveControls] = useState(true);
  const [dismissedBlankCanvas, setDismissedBlankCanvas] = useState(false);

  // Reset overlay dismissal when project or active solid changes
  useEffect(() => {
    setDismissedBlankCanvas(false);
  }, [activeProjectType, activeSolid]);

  // Fallback drawing loop and state updates
  const fallbackCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [animationTime, setAnimationTime] = useState(0);

  useEffect(() => {
    if (!useFallbackEngine) return;
    let animId: number;
    const tick = () => {
      setAnimationTime(t => t + 0.1);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [useFallbackEngine]);

  const drawFallbackCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#1e293b'; // Slate 800 - Lighter and more visible
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    // Draw 3D Grid lines projected
    for (let g = -150; g <= 150; g += 30) {
      // Grid lines along X
      const p1 = project3D(-150, -60, g, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      const p2 = project3D(150, -60, g, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Grid lines along Z
      const p3 = project3D(g, -60, -150, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      const p4 = project3D(g, -60, 150, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }

    // Draw Axes Helper
    const origin = project3D(-120, -55, -120, fallbackRotationX, fallbackRotationY, width, height, 1.6);
    const axisX = project3D(-70, -55, -120, fallbackRotationX, fallbackRotationY, width, height, 1.6);
    const axisY = project3D(-120, -5, -120, fallbackRotationX, fallbackRotationY, width, height, 1.6);
    const axisZ = project3D(-120, -55, -70, fallbackRotationX, fallbackRotationY, width, height, 1.6);

    ctx.lineWidth = 2.5;
    // X Axis - Red
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(axisX.x, axisX.y);
    ctx.stroke();
    // Y Axis - Green
    ctx.strokeStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(axisY.x, axisY.y);
    ctx.stroke();
    // Z Axis - Blue
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(axisZ.x, axisZ.y);
    ctx.stroke();

    // RENDER ACTIVE MODEL
    ctx.lineWidth = 1;
    
    // Check if real authoritative canonical B-Rep geometry is available to render
    if (canonicalRenderData && canonicalRenderData.vertices && canonicalRenderData.indices) {
      const verts = canonicalRenderData.vertices;
      const inds = canonicalRenderData.indices;

      ctx.strokeStyle = '#38bdf8'; // High fidelity sky-blue wireframe edges
      ctx.lineWidth = 1;

      // Draw all triangles of the ACTUAL active 3D B-Rep CAD model!
      for (let i = 0; i < inds.length; i += 3) {
        const idx0 = inds[i] * 3;
        const idx1 = inds[i+1] * 3;
        const idx2 = inds[i+2] * 3;

        if (idx2 < verts.length) {
          // Translate and scale from canonical units (meters) to viewport pixel coordinates
          const scaleFactor = 650; 
          const p0 = project3D(verts[idx0]*scaleFactor, verts[idx0+1]*scaleFactor - 20, verts[idx0+2]*scaleFactor, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          const p1 = project3D(verts[idx1]*scaleFactor, verts[idx1+1]*scaleFactor - 20, verts[idx2+2]*scaleFactor, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          const p2 = project3D(verts[idx2]*scaleFactor, verts[idx2+1]*scaleFactor - 20, verts[idx2+2]*scaleFactor, fallbackRotationX, fallbackRotationY, width, height, 1.6);

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.closePath();
          ctx.stroke();
        }
      }
      return;
    }

    ctx.lineWidth = 2;
    if (activeProjectType === 'INDUSTRIAL_DRONE' || activeProjectType === 'AEROSPACE_DRONE') {
      // 🚁 DRONE MODEL FALLBACK
      const center = project3D(0, 0, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      
      // Fuselage Central hexagon plates (Top and bottom)
      const drawHex = (yOffset: number, color: string, border: string) => {
        ctx.fillStyle = color;
        ctx.strokeStyle = border;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const px = Math.cos(angle) * 35;
          const pz = Math.sin(angle) * 35;
          const pt = project3D(px, yOffset, pz, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      // Bottom plate
      drawHex(-5, '#1e293b', '#334155');
      // Top plate
      drawHex(5, '#0f172a', '#38bdf8');

      // 4 Diagonal carbon fiber arms
      const arms = [
        { dx: 1, dz: 1 },
        { dx: -1, dz: 1 },
        { dx: -1, dz: -1 },
        { dx: 1, dz: -1 }
      ];

      arms.forEach(({ dx, dz }) => {
        const pArmStart = project3D(dx * 15, 0, dz * 15, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        const pArmEnd = project3D(dx * 85, 0, dz * 85, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(pArmStart.x, pArmStart.y);
        ctx.lineTo(pArmEnd.x, pArmEnd.y);
        ctx.stroke();

        // Rotor Motor cylinder at end
        ctx.strokeStyle = '#0284c7';
        ctx.fillStyle = '#0f172a';
        ctx.lineWidth = 2;
        const motorTop = project3D(dx * 85, 12, dz * 85, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        const motorBot = project3D(dx * 85, -2, dz * 85, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        ctx.beginPath();
        ctx.moveTo(motorBot.x, motorBot.y);
        ctx.lineTo(motorTop.x, motorTop.y);
        ctx.stroke();

        // 2-blade spinning propeller
        const propSpeed = animationTime * 1.5;
        const propAngle = propSpeed + (dx * dz * 0.5);
        const px1 = dx * 85 + Math.cos(propAngle) * 45;
        const pz1 = dz * 85 + Math.sin(propAngle) * 45;
        const px2 = dx * 85 - Math.cos(propAngle) * 45;
        const pz2 = dz * 85 - Math.sin(propAngle) * 45;

        const propPt1 = project3D(px1, 14, pz1, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        const propPt2 = project3D(px2, 14, pz2, fallbackRotationX, fallbackRotationY, width, height, 1.6);

        // Draw translucent spinning rotor disk
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.beginPath();
        const centerProp = project3D(dx * 85, 14, dz * 85, fallbackRotationX, fallbackRotationY, width, height, 1.6);
        ctx.arc(centerProp.x, centerProp.y, 42, 0, Math.PI * 2);
        ctx.fill();

        // Propeller line
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(propPt1.x, propPt1.y);
        ctx.lineTo(propPt2.x, propPt2.y);
        ctx.stroke();
      });

      // Camera gimbal dome underneath
      const pGimbal = project3D(0, -18, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(pGimbal.x, pGimbal.y, 14, 0, Math.PI * 2);
      ctx.fill();

    } else if (isNoProjectOrBlank) {
      // 📐 EMPTY STATE FALLBACK (Datum Planes)
      const center = project3D(0, 0, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      
      // Draw 3 primary datum planes as lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      
      const drawPlane = (pts: [number, number, number][]) => {
        const proj = pts.map(p => project3D(p[0], p[1], p[2], fallbackRotationX, fallbackRotationY, width, height, 1.6));
        ctx.beginPath();
        ctx.moveTo(proj[0].x, proj[0].y);
        proj.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();
      };

      drawPlane([[-60, 0, -60], [60, 0, -60], [60, 0, 60], [-60, 0, 60]]); // XY
      drawPlane([[0, -60, -60], [0, 60, -60], [0, 60, 60], [0, -60, 60]]); // YZ
      drawPlane([[-60, -60, 0], [60, -60, 0], [60, 60, 0], [-60, 60, 0]]); // XZ

    } else if (isValveOrFaucet) {
      // 🚰 VALVE MODEL FALLBACK (OR GENERAL CAD MODEL)
      const center = project3D(0, 0, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);

      // Left Flange
      const drawCylinder = (xStart: number, xEnd: number, radius: number, fill: string, stroke: string) => {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const angle = i * Math.PI * 2 / 20;
          const cy = Math.cos(angle) * radius;
          const cz = Math.sin(angle) * radius;
          const pt = project3D(xStart, cy, cz, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const angle = i * Math.PI * 2 / 20;
          const cy = Math.cos(angle) * radius;
          const cz = Math.sin(angle) * radius;
          const pt = project3D(xEnd, cy, cz, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      // Draw horizontal pipe body
      drawCylinder(-80, 80, 24, '#b45309', '#f59e0b'); // Brass colors
      // Spherical central vault
      const pVault = project3D(0, 0, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(pVault.x, pVault.y, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Top rotating lever handle
      const valveAngleRad = (internalValveAngle ?? 45) * Math.PI / 180;
      const leverEndX = Math.cos(valveAngleRad) * 80;
      const leverEndZ = Math.sin(valveAngleRad) * 80;

      const stemBot = project3D(0, 30, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      const stemTop = project3D(0, 52, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
      const handleEnd = project3D(leverEndX, 52, leverEndZ, fallbackRotationX, fallbackRotationY, width, height, 1.6);

      // Stem cylinder
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(stemBot.x, stemBot.y);
      ctx.lineTo(stemTop.x, stemTop.y);
      ctx.stroke();

      // Colored Lever handle
      ctx.strokeStyle = internalHandleColor || '#ef4444';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(stemTop.x, stemTop.y);
      ctx.lineTo(handleEnd.x, handleEnd.y);
      ctx.stroke();

      // Fluid Flow shimmering drops (if valve is open)
      const isOpen = (internalValveAngle ?? 45) > 10;
      if (isOpen) {
        ctx.fillStyle = '#0284c7';
        for (let i = 0; i < 5; i++) {
          const flowX = -70 + ((animationTime * 12 + i * 35) % 150);
          const drop = project3D(flowX, 0, 0, fallbackRotationX, fallbackRotationY, width, height, 1.6);
          ctx.beginPath();
          ctx.arc(drop.x, drop.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  useEffect(() => {
    if (useFallbackEngine && fallbackCanvasRef.current) {
      drawFallbackCanvas(fallbackCanvasRef.current);
    }
  }, [useFallbackEngine, animationTime, fallbackRotationX, fallbackRotationY, activeProjectType, internalValveAngle, internalHandleColor]);

  const handleFallbackMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingFallback(true);
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  const handleFallbackMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingFallback) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    setFallbackRotationY(prev => prev + dx * 0.6);
    setFallbackRotationX(prev => Math.max(-85, Math.min(85, prev + dy * 0.6)));
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  const handleFallbackMouseUp = () => {
    setIsDraggingFallback(false);
  };

  // Dynamic Project Type Resolution:
  // If activeProjectType is NO_PROJECT, BLANK, PART, ASSEMBLY, etc., we do NOT force an engine or faucet unless explicitly requested!
  const isNoProjectOrBlank = 
    activeProjectType !== 'INDUSTRIAL_DRONE' && 
    activeProjectType !== 'AEROSPACE_DRONE' && 
    activeProjectType !== 'BALL_VALVE';

  const isValveOrFaucet = !isNoProjectOrBlank && (
    activeProjectType === 'BALL_VALVE' ||
    activeProjectType === 'INDUSTRIAL_DRONE' ||
    activeProjectType === 'FLIGHT_BRACKET' ||
    activeSolid?.type === 'FAUCET' ||
    activeSolid?.name === 'Water_Faucet' ||
    activeSolid?.type === 'BALL_VALVE' ||
    (activeSolid?.name?.includes('Valve') ?? false) ||
    (activeSolid?.name?.includes('Faucet') ?? false)
  );
  const isBlankCanvas = !activeSolid && (assemblyComponents?.length ?? 0) === 0 && (isNoProjectOrBlank || !isValveOrFaucet);

  // Assembly Tree Visibility & Selection Highlighting Effect
  useEffect(() => {
    if (!meshesGroupRef.current) return;
    meshesGroupRef.current.traverse((child) => {
      const instId = child.userData?.instanceId;
      if (!instId) return;

      // Visibility sync
      if (hiddenInstanceIds && hiddenInstanceIds.length > 0) {
        if (hiddenInstanceIds.includes(instId)) {
          child.visible = false;
        } else {
          child.visible = true;
        }
      } else {
        child.visible = true;
      }

      // Selection Highlighting sync
      if (selectedPartId && child instanceof THREE.Mesh) {
        if (instId === selectedPartId) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          child.material = new THREE.MeshStandardMaterial({
            color: 0x06b6d4,
            emissive: 0x0891b2,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2,
            wireframe: wireframeMode
          });
        } else if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      } else if (child instanceof THREE.Mesh && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    });
  }, [selectedPartId, hiddenInstanceIds, wireframeMode]);

  // References for Valve mechanics
  const valveRefs = useRef<{
    updateOpenAngle: (angle: number) => void;
    updateExplode: (factor: number) => void;
  } | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const clippingPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 200));
  const meshesGroupRef = useRef<THREE.Group>(new THREE.Group());

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 540;

    // Scene with modern CAD Studio Slate background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e293b); // Slate 800 - Lighter and more visible than 950
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    camera.position.set(250, 180, 280);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.localClippingEnabled = showSectionPlane;
      rendererRef.current = renderer;
      mountRef.current.appendChild(renderer.domElement);
    } catch (err: any) {
      console.warn('WebGL initialization failed in CadViewport3D:', err);
      setDebugError('WebGL context is blocked or unavailable in this sandbox environment. Switched to Hardware-Agnostic Software 3D Rendering Fallback safely.');
      setIsWebGLFailed(true);
      setUseFallbackEngine(true);
      return;
    }

    // Lights - Multi-directional CAD Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight1.position.set(300, 400, 300);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight2.position.set(-300, 200, -300);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xf59e0b, 1.0);
    dirLight3.position.set(0, -200, 300);
    scene.add(dirLight3);

    // Grid & Axis helper
    const gridHelper = new THREE.GridHelper(600, 30, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -80;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(80);
    axesHelper.position.set(-220, -75, -220);
    scene.add(axesHelper);

    // Group for CAD meshes
    scene.add(meshesGroupRef.current);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 20, 0);
    controls.maxDistance = 1200;
    controls.minDistance = 40;
    controlsRef.current = controls;

    // Render loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Update controls for damping smoothness
      controls.update();

      if (meshesGroupRef.current && !measureMode) {
        // Slow passive CAD inspection rotation
        meshesGroupRef.current.rotation.y += 0.002;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize handler with ResizeObserver
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = mountRef.current.clientWidth;
      const newH = mountRef.current.clientHeight || 540;
      if (newW === 0 || newH === 0) return;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(mountRef.current);

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Update Geometry & Assembly Meshes
  useEffect(() => {
    if (!meshesGroupRef.current) return;

    try {
      // Clear existing children from group safely and dispose of resources
      const disposeObject = (obj: any) => {
        if (!obj) return;
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat.dispose());
          } else {
            obj.material.dispose();
          }
        }
        if (obj.children) {
          obj.children.forEach(disposeObject);
        }
      };

      while (meshesGroupRef.current.children.length > 0) {
        const obj = meshesGroupRef.current.children[0];
        disposeObject(obj);
        meshesGroupRef.current.remove(obj);
      }

      const group = meshesGroupRef.current;

      const getMat = (opts: THREE.MeshStandardMaterialParameters) => {
        return new THREE.MeshStandardMaterial({
          roughness: 0.3,
          metalness: 0.5,
          ...opts,
        });
      };

      const buildDemoModel = () => {
        const defaultValveType = activeProjectType === 'INDUSTRIAL_DRONE'
          ? 'INDUSTRIAL_DRONE'
          : (activeSolid?.type === 'FAUCET' || activeSolid?.name === 'Water_Faucet' || activeSolid?.name?.includes('Faucet')) 
            ? 'GOOSENECK_FAUCET' 
            : 'BALL_VALVE';

        const valveModel = buildSolidWorksBallValve(
          {
            valveType: (valveConfig?.valveType as any) || defaultValveType,
            openAngleDeg: valveConfig?.openAngleDeg !== undefined ? valveConfig.openAngleDeg : (internalValveAngle ?? 75),
            explodedFactor: valveConfig?.explodedFactor !== undefined ? valveConfig.explodedFactor : (internalValveExploded ?? 0),
            material: valveConfig?.material || (internalValveMaterial ?? (activeProjectType === 'INDUSTRIAL_DRONE' ? 'CARBON_FIBER' : 'BRASS')),
            handleColor: valveConfig?.handleColor || (internalHandleColor ?? '#eab308'),
            showWaterFlow: true,
          },
          wireframeMode
        );

        valveRefs.current = {
          updateOpenAngle: valveModel.updateOpenAngle,
          updateExplode: valveModel.updateExplode,
        };

        group.add(valveModel.group);
      };

      if (assemblyComponents && assemblyComponents.length > 0) {
        const explodedPositions = AssemblyEngine.getExplodedPositions(assemblyComponents, explodedFactor);

        assemblyComponents.forEach((comp) => {
          if (!comp.visible) return;

          const geom = new THREE.BoxGeometry(
            comp.solid.dimensions.dx ? comp.solid.dimensions.dx * 1000 : 200,
            comp.solid.dimensions.dy ? comp.solid.dimensions.dy * 1000 : 120,
            comp.solid.dimensions.dz ? comp.solid.dimensions.dz * 1000 : 80
          );

          const colorHex = comp.colorHex || '#3b82f6';
          const mat = getMat({
            color: new THREE.Color(colorHex),
            metalness: 0.3,
            roughness: 0.3,
            wireframe: wireframeMode,
          });

          const mesh = new THREE.Mesh(geom, mat);
          const expPos = explodedPositions[comp.id] || comp.position;
          mesh.position.set(expPos.x, expPos.y, expPos.z);
          mesh.userData = { name: comp.name, id: comp.id };
          mesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(geom),
              new THREE.LineBasicMaterial({ color: new THREE.Color(0x0f172a) })
            )
          );

          group.add(mesh);
        });
      } else if (isValveOrFaucet) {
        // 🛡️ AUTHENTIC DEMO PATH (DRONE / VALVE) - PRIORITY FOR DEMO PROJECTS
        buildDemoModel();
      } else if (activeSolid) {
        const effectiveRenderData = canonicalRenderData || (
          activeSolid.mesh && activeSolid.mesh.vertices && activeSolid.mesh.vertices.length > 0
            ? createCanonicalRenderDataFromMesh(activeSolid.id || 'SOLID-MAIN', 1, activeSolid.mesh)
            : null
        );

        if (effectiveRenderData && effectiveRenderData.hasGeometry && activeProjectType !== 'INDUSTRIAL_DRONE' && activeProjectType !== 'BALL_VALVE') {
          // CANONICAL RENDERING CONTRACT (SECP-3D-CANONICAL-CONTRACT-001):
          // Render authoritative derived geometry directly from CanonicalRenderData SOT.
          const geom = convertRenderDataToThreeBufferGeometry(effectiveRenderData, { unitScaleMultiplier: 1000 });
          
          if (simulationResults && simulationResults.values.length > 0) {
            const count = geom.attributes.position.count;
            const colors = new Float32Array(count * 3);
            const color = new THREE.Color();
            for (let i = 0; i < count; i++) {
              const val = simulationResults.values[i % simulationResults.values.length];
              const norm = Math.max(0, Math.min(1, (val - simulationResults.minValue) / (simulationResults.maxValue - simulationResults.minValue || 1)));
              if (simulationResults.type === 'THERMAL') {
                color.setHSL(0.7 * (1 - norm), 1, 0.5); // Blue to Red
              } else if (simulationResults.type === 'STRESS') {
                color.setHSL(0.3 * (1 - norm), 1, 0.5); // Green to Red
              } else {
                color.setHSL(0.6 * (1 - norm), 1, 0.5);
              }
              colors[i * 3] = color.r;
              colors[i * 3 + 1] = color.g;
              colors[i * 3 + 2] = color.b;
            }
            geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          }

          const colorHex = activeSolid.colorHex || '#3b82f6';
          const mat = getMat({
            color: simulationResults ? 0xffffff : new THREE.Color(colorHex),
            vertexColors: Boolean(simulationResults),
            metalness: 0.3,
            roughness: 0.3,
            wireframe: wireframeMode,
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.userData = { name: activeSolid.name, id: activeSolid.id, canonicalRenderData: effectiveRenderData };
          mesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(geom),
              new THREE.LineBasicMaterial({ color: new THREE.Color(0x0f172a) })
            )
          );
          group.add(mesh);
        } else {
          // Single Solid Primitive Fallback
          const dx = activeSolid.dimensions.dx ? activeSolid.dimensions.dx * 1000 : 250;
          const dy = activeSolid.dimensions.dy ? activeSolid.dimensions.dy * 1000 : 150;
          const dz = activeSolid.dimensions.dz ? activeSolid.dimensions.dz * 1000 : 100;

          let geom: THREE.BufferGeometry;
          if (activeSolid.type === 'CYLINDER' && activeSolid.dimensions.radius && activeSolid.dimensions.height) {
            geom = new THREE.CylinderGeometry(
              activeSolid.dimensions.radius * 1000,
              activeSolid.dimensions.radius * 1000,
              activeSolid.dimensions.height * 1000,
              32
            );
          } else if (activeSolid.type === 'SPHERE' && activeSolid.dimensions.radius) {
            geom = new THREE.SphereGeometry(activeSolid.dimensions.radius * 1000, 32, 24);
          } else {
            if (activeSolid.type === 'COMPOUND_BOOLEAN' || activeSolid.type === 'IMPORTED_SOLID') {
               geom = new THREE.BufferGeometry();
               console.warn(`[CANONICAL-3D] Missing mesh for Evaluated Solid: ${activeSolid.name}`);
            } else {
               geom = new THREE.BoxGeometry(dx, dy, dz);
            }
          }

          const colorHex = activeSolid.colorHex || '#3b82f6';
          const mat = getMat({
            color: new THREE.Color(colorHex),
            metalness: 0.3,
            roughness: 0.3,
            wireframe: wireframeMode,
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.userData = { name: activeSolid.name, id: activeSolid.id, canonicalRenderData: effectiveRenderData };
          mesh.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(geom),
              new THREE.LineBasicMaterial({ color: new THREE.Color(0x1e3a8a) })
            )
          );
          group.add(mesh);
        }
      } else {
        // EMPTY PROJECT STATE - Engineering Origin & Reference Datum Planes (Top, Front, Right)
        const size = 600;
        const divisions = 24;

        // Ground Grid
        const gridHelper = new THREE.GridHelper(size, divisions, 0x475569, 0x1e293b);
        group.add(gridHelper);

        // Coordinate Origin Axes Helper
        const axesHelper = new THREE.AxesHelper(120);
        group.add(axesHelper);

        // Visual Reference Datum Planes for Design Start (Top XY, Front YZ, Right XZ)
        const planeGeom = new THREE.PlaneGeometry(240, 240);
        
        // Top Plane (Ground/XY) - Cyan
        const xyMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
        const xyPlane = new THREE.Mesh(planeGeom, xyMat);
        xyPlane.rotation.x = Math.PI / 2;
        xyPlane.add(new THREE.LineSegments(new THREE.EdgesGeometry(planeGeom), new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.4 })));
        group.add(xyPlane);

        // Front Plane (YZ) - Emerald
        const yzMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
        const yzPlane = new THREE.Mesh(planeGeom, yzMat);
        yzPlane.add(new THREE.LineSegments(new THREE.EdgesGeometry(planeGeom), new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.4 })));
        group.add(yzPlane);

        // Right Plane (XZ) - Rose
        const xzMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
        const xzPlane = new THREE.Mesh(planeGeom, xzMat);
        xzPlane.rotation.y = Math.PI / 2;
        xzPlane.add(new THREE.LineSegments(new THREE.EdgesGeometry(planeGeom), new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.4 })));
        group.add(xzPlane);
      }

      setChildrenCount(meshesGroupRef.current.children.length);
      setDebugError(null);
    } catch (err: any) {
      console.error(err);
      setDebugError(err.message || 'Unknown geometry construction error');
    }
  }, [activeProjectType, activePatchTab, activeSolid, canonicalRenderData, simulationResults, assemblyComponents, explodedFactor, wireframeMode, showSectionPlane, valveConfig, internalValveAngle, internalValveExploded, internalValveMaterial, internalHandleColor]);

  // Section Plane Offset Update
  useEffect(() => {
    if (clippingPlaneRef.current) {
      clippingPlaneRef.current.constant = sectionPlaneOffset;
    }
  }, [sectionPlaneOffset]);

  // Click Raycaster for Entity Selection & 3D Distance Measurement Tool
  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !meshesGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(meshesGroupRef.current.children, true);

    if (intersects.length > 0) {
      // Find the first valid mesh hit (skip temporary helper meshes)
      const hit = intersects.find(i => i.object instanceof THREE.Mesh && !i.object.name.startsWith('CANONICAL_')) || intersects[0];
      const clickedMesh = hit.object as THREE.Mesh;
      const entityName = clickedMesh.userData.name || 'Solid Entity';

      // 1. CANONICAL TOPOLOGY PICKING (SECP-3D-TOPOLOGY-PICKING-CONTRACT-002)
      // Resolve triangle intersection directly to canonical topology identity (FACE, EDGE, or VERTEX) from CanonicalRenderData
      if (hit.faceIndex !== undefined && hit.faceIndex !== null) {
        const renderDataForPick = (clickedMesh.userData?.canonicalRenderData as CanonicalRenderData) || canonicalRenderData;
        if (renderDataForPick && renderDataForPick.hasGeometry) {
          const pickResult = resolveCanonicalTopologyFromTriangle(hit.faceIndex, topologyFilter, renderDataForPick, {
            distance: hit.distance,
            hitPoint: [hit.point.x / 1000, hit.point.y / 1000, hit.point.z / 1000]
          });

          if (pickResult) {
            const newSelection = createCanonicalSelection(pickResult, topologyFilter);
            setCanonicalSelection(newSelection);
            setSelectedEntityName(`Canonical ${pickResult.entityType}: ${pickResult.canonicalEntityId}`);
            if (onCanonicalPick) onCanonicalPick(pickResult);
          }
        }
      }

      if (!canonicalSelection.selectedEntity) {
        setSelectedEntityName(entityName);
      }
      if (onSelectComponent) onSelectComponent(entityName);

      if (measureMode) {
        const point = hit.point;
        const newPts = [...selectedPoints, point];
        setSelectedPoints(newPts);

        if (newPts.length === 2) {
          const distMm = newPts[0].distanceTo(newPts[1]);
          const convertedDist = UnitEngine.convert(distMm, 'mm', activeUnit);
          setMeasuredDistance(convertedDist);
        } else if (newPts.length > 2) {
          setSelectedPoints([point]);
          setMeasuredDistance(null);
        }
      }
    }
  };

  // CANONICAL TOPOLOGY HIGHLIGHT OVERLAY (FACE, EDGE, VERTEX)
  // Presentation-only visual highlight that does NOT modify B-Rep or re-tessellate
  useEffect(() => {
    if (!meshesGroupRef.current) return;

    // Remove existing highlight overlay
    const existingHighlight = meshesGroupRef.current.getObjectByName('CANONICAL_HIGHLIGHT');
    if (existingHighlight) {
      meshesGroupRef.current.remove(existingHighlight);
    }

    const activePick = selectedCanonicalFace || canonicalSelection.selectedEntity;
    // SECP Revision Lifecycle: Strictly forbid showing highlight if selection is STALE, INVALID, or not matching revision
    if (!shouldDisplayHighlight(activePick, canonicalRenderData)) {
      return;
    }

    const highlightGeom = convertCanonicalPickToHighlightGeometry(activePick, canonicalRenderData, {
      unitScaleMultiplier: 1000
    });

    if (highlightGeom.getAttribute('position') && highlightGeom.getAttribute('position').count > 0) {
      let highlightObject: THREE.Object3D;

      if (activePick.entityType === 'EDGE') {
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xf59e0b, // Amber highlight
          linewidth: 4,
          depthTest: false
        });
        highlightObject = new THREE.LineSegments(highlightGeom, lineMat);
      } else if (activePick.entityType === 'VERTEX') {
        // Render a prominent spherical dot marker at vertex
        const vertCoords = getCanonicalVertexCoordinates(activePick, canonicalRenderData);
        if (vertCoords.length >= 3) {
          const markerGeom = new THREE.SphereGeometry(3.5, 16, 16);
          const markerMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            depthTest: false
          });
          const markerMesh = new THREE.Mesh(markerGeom, markerMat);
          markerMesh.position.set(vertCoords[0] * 1000, vertCoords[1] * 1000, vertCoords[2] * 1000);
          highlightObject = markerMesh;
        } else {
          const pointsMat = new THREE.PointsMaterial({
            color: 0xf59e0b,
            size: 10,
            sizeAttenuation: false,
            depthTest: false
          });
          highlightObject = new THREE.Points(highlightGeom, pointsMat);
        }
      } else {
        // FACE highlight
        const highlightMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b, // Amber highlight
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });

        const highlightMesh = new THREE.Mesh(highlightGeom, highlightMat);
        const edgeOutline = new THREE.LineSegments(
          new THREE.EdgesGeometry(highlightGeom),
          new THREE.LineBasicMaterial({ color: 0xfffbeb, linewidth: 2 })
        );
        highlightMesh.add(edgeOutline);
        highlightObject = highlightMesh;
      }

      highlightObject.name = 'CANONICAL_HIGHLIGHT';
      highlightObject.renderOrder = 999;
      meshesGroupRef.current.add(highlightObject);
    }
  }, [canonicalSelection, selectedCanonicalFace, canonicalRenderData]);

  // --- DRONE CAM TOOLPATH RENDERING ---
  useEffect(() => {
    if (!meshesGroupRef.current) return;
    
    // Cleanup old toolpaths
    const oldToolpaths = meshesGroupRef.current.children.filter(c => c.name === 'DRONE_TOOLPATH');
    oldToolpaths.forEach(tp => {
      meshesGroupRef.current.remove(tp);
      if ((tp as any).geometry) (tp as any).geometry.dispose();
      if ((tp as any).material) (tp as any).material.dispose();
    });

    if (droneCamResult && activePatchTab === 'DRONE-CAM') {
      droneCamResult.operations.forEach(op => {
        if (!op.trajectory || !op.trajectory.points) return;
        
        const points = op.trajectory.points.map(pt => {
          return new THREE.Vector3(
            pt.position ? pt.position.x : pt.x || 0,
            pt.position ? pt.position.y : pt.y || 0,
            pt.position ? pt.position.z : pt.z || 0
          );
        });

        if (points.length === 0) return;

        const pathGeom = new THREE.BufferGeometry().setFromPoints(points);
        const pathMat = new THREE.LineBasicMaterial({ 
          color: op.strategy.includes('RAPID') ? 0xef4444 : 0x10b981, 
          linewidth: 2,
          opacity: 0.8,
          transparent: true
        });
        const toolpathLine = new THREE.Line(pathGeom, pathMat);
        toolpathLine.name = 'DRONE_TOOLPATH';
        
        meshesGroupRef.current.add(toolpathLine);
      });
      
      // Render Stock Box
      if (droneCamResult.camSetup?.stock?.stockBoundingBox) {
        const min = droneCamResult.camSetup.stock.stockBoundingBox.min;
        const max = droneCamResult.camSetup.stock.stockBoundingBox.max;
        const w = max[0] - min[0];
        const h = max[1] - min[1];
        const d = max[2] - min[2];
        const cx = (min[0] + max[0]) / 2;
        const cy = (min[1] + max[1]) / 2;
        const cz = (min[2] + max[2]) / 2;
        
        const stockGeom = new THREE.BoxGeometry(w, h, d);
        const stockMat = new THREE.MeshBasicMaterial({ 
          color: 0xf59e0b, 
          wireframe: true,
          transparent: true,
          opacity: 0.3
        });
        const stockMesh = new THREE.Mesh(stockGeom, stockMat);
        stockMesh.position.set(cx, cy, cz);
        stockMesh.name = 'DRONE_TOOLPATH'; // same name so it gets cleaned up
        meshesGroupRef.current.add(stockMesh);
      }
    }
  }, [droneCamResult, activePatchTab]);

  const resetView = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(220, 160, 260);
      cameraRef.current.lookAt(0, 20, 0);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 20, 0);
      controlsRef.current.update();
    }
    if (meshesGroupRef.current) {
      meshesGroupRef.current.rotation.set(0, 0, 0);
    }
    setSelectedPoints([]);
    setMeasuredDistance(null);
  };

  return (
    <div className="relative w-full h-full min-h-[540px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* 3D WebGL Canvas or High-Fidelity 2D/3D Fallback Vector Engine */}
      {useFallbackEngine ? (
        <canvas
          ref={fallbackCanvasRef}
          width={800}
          height={540}
          onMouseDown={handleFallbackMouseDown}
          onMouseMove={handleFallbackMouseMove}
          onMouseUp={handleFallbackMouseUp}
          onMouseLeave={handleFallbackMouseUp}
          className="w-full h-full cursor-grab active:cursor-grabbing bg-slate-950 block"
        />
      ) : (
        <div ref={mountRef} onClick={handleCanvasClick} className="w-full h-full cursor-crosshair touch-none" />
      )}

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 text-xs text-slate-200 shadow-xl max-w-[calc(100%-2rem)]">
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-md">
          <button
            onClick={() => {
              setRenderingBackend('WebGL');
              setUseFallbackEngine(false);
            }}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              !useFallbackEngine && renderingBackend === 'WebGL' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to Standard WebGL Renderer"
          >
            WebGL
          </button>
          <button
            onClick={() => setUseFallbackEngine(true)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              useFallbackEngine ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Switch to Hardware-Agnostic Software 3D Rendering Fallback (Bypasses WebGL sandboxing limitations)"
          >
            Software 3D (Fallback)
          </button>
        </div>

        {/* Topology Picking Mode Filter */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-md">
          <span className="text-[10px] text-slate-400 px-1 font-mono uppercase font-semibold">Pick:</span>
          <button
            onClick={() => setTopologyFilter('FACE')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              topologyFilter === 'FACE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Pick Canonical Face Topology"
          >
            Face
          </button>
          <button
            onClick={() => setTopologyFilter('EDGE')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              topologyFilter === 'EDGE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Pick Canonical Edge Topology"
          >
            Edge
          </button>
          <button
            onClick={() => setTopologyFilter('VERTEX')}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
              topologyFilter === 'VERTEX' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Pick Canonical Vertex Topology"
          >
            Vertex
          </button>
        </div>

        <button
          onClick={resetView}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition text-[11px]"
          title="Reset Camera View"
        >
          <RotateCcw className="w-3.5 h-3.5 text-blue-400" /> Reset View
        </button>

        <button
          onClick={() => setWireframeMode(!wireframeMode)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
            wireframeMode ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
          }`}
          title="Toggle Wireframe B-Rep"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" /> Wireframe
        </button>

        <button
          onClick={() => setShowSectionPlane(!showSectionPlane)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
            showSectionPlane ? 'bg-amber-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
          }`}
          title="Toggle Section Cutting Plane"
        >
          <Scissors className="w-3.5 h-3.5 text-amber-400" /> Section
        </button>

        <button
          onClick={() => {
            setMeasureMode(!measureMode);
            setSelectedPoints([]);
            setMeasuredDistance(null);
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
            measureMode ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
          }`}
          title="3D Euclidean Distance Measurement Tool"
        >
          <Ruler className="w-3.5 h-3.5 text-emerald-400" /> Measure
        </button>

        {isValveOrFaucet && (
          <button
            onClick={() => setShowValveControls(!showValveControls)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600/90 hover:bg-amber-500 text-white transition text-[11px] font-bold shadow-md"
            title="Toggle Valve Controls"
          >
            <Settings className="w-3.5 h-3.5" />
            🚰 Valve Controls
          </button>
        )}
      </div>

      {/* Dynamic Blank Canvas Empty Project HUD */}
      {isBlankCanvas && !dismissedBlankCanvas && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-4">
          <div className="relative bg-slate-950/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 max-w-lg w-full shadow-2xl pointer-events-auto flex flex-col gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Close / Dismiss Button */}
            <button
              onClick={() => setDismissedBlankCanvas(true)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition"
              title="Close overlay & explore 3D canvas (Close overlay & explore 3D canvas)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Box className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Empty 3D CAD Canvas</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                The 3D view is dynamically linked to the project. You can now start modeling a new part or load standard assemblies:
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-850">
              <button
                onClick={onStartSketch}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 hover:border-sky-500/40 text-sky-400 transition group"
              >
                <Pencil className="w-5 h-5 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">Draw 2D Sketch</span>
                <span className="text-[9px] text-slate-500">Tab PATCH-034</span>
              </button>

              <button
                onClick={() => onCreatePrimitive && onCreatePrimitive('BOX')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 transition group"
              >
                <Box className="w-5 h-5 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">Box Solid</span>
                <span className="text-[9px] text-slate-500">250×150×100 mm</span>
              </button>

              <button
                onClick={() => onCreatePrimitive && onCreatePrimitive('CYLINDER')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 text-purple-400 transition group"
              >
                <Circle className="w-5 h-5 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">Cylinder Solid</span>
                <span className="text-[9px] text-slate-500">Ø120 × H180 mm</span>
              </button>

              <button
                onClick={() => onLoadProject && onLoadProject('BALL_VALVE')}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 transition group"
              >
                <Layers className="w-5 h-5 mb-1.5 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-bold">Industrial Valve</span>
                <span className="text-[9px] text-slate-500">Ball Valve SolidWorks</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              <button
                onClick={() => setDismissedBlankCanvas(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold transition border border-slate-700/60 flex items-center justify-center gap-2 shadow-sm"
              >
                <span>Explore 3D Canvas</span>
                <span className="text-[10px] text-sky-400 font-mono">(Close window & explore workbench)</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-mono">
              <span>● Top Plane (XY)</span>
              <span>● Front Plane (YZ)</span>
              <span>● Right Plane (XZ)</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Quick Action Launcher when Overlay is Dismissed */}
      {isBlankCanvas && dismissedBlankCanvas && (
        <div className="absolute bottom-4 right-4 z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => setDismissedBlankCanvas(false)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-sky-500/30 text-sky-400 hover:text-sky-300 text-xs font-semibold shadow-xl backdrop-blur-md transition group"
          >
            <Sparkles className="w-4 h-4 text-sky-400 group-hover:rotate-12 transition-transform" />
            <span>Quick Start Guide</span>
          </button>
        </div>
      )}

      {/* Industrial Quadcopter Drone / Valve Live Controls Overlay */}
      {!isNoProjectOrBlank && isValveOrFaucet && (activeProjectType === 'BALL_VALVE' || activeProjectType === 'INDUSTRIAL_DRONE') && showValveControls && (
        <div className="absolute top-16 left-4 z-10 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-sky-500/40 text-xs text-slate-200 flex flex-col gap-2 w-[270px] max-w-[calc(100vw-3rem)] shadow-2xl animate-in fade-in slide-in-from-left duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              <span className="font-bold text-sky-400 font-sans">
                {activeProjectType === 'INDUSTRIAL_DRONE' ? 'Industrial Drone Controls 🛸' : 'Industrial Valve Controls 🚰'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {(internalValveAngle ?? 0) > 10 ? '⚡ Active' : '⏸️ Standby'}
              </span>
              <button
                onClick={() => setShowValveControls(false)}
                className="text-slate-400 hover:text-white text-xs px-1 ml-1"
                title="Hide Controls"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Rotor RPM & Thrust:</span>
              <span className="font-mono font-bold text-sky-300">{(internalValveAngle ?? 0) * 120} RPM</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="90"
                value={internalValveAngle ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setInternalValveAngle(val);
                  if (valveRefs.current?.updateOpenAngle) {
                    valveRefs.current.updateOpenAngle(val);
                  }
                }}
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <button
                onClick={() => {
                  const targetAngle = (internalValveAngle ?? 0) >= 45 ? 0 : 90;
                  setInternalValveAngle(targetAngle);
                  if (valveRefs.current?.updateOpenAngle) {
                    valveRefs.current.updateOpenAngle(targetAngle);
                  }
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-200 font-bold border border-slate-700 whitespace-nowrap"
              >
                {(internalValveAngle ?? 0) >= 45 ? 'Land' : 'Takeoff'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Exploded View (Step-by-Step Disassembly):</span>
              <span className="font-mono text-sky-400 font-bold">{Math.round((internalValveExploded ?? 0) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={internalValveExploded ?? 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                setInternalValveExploded(val);
                if (valveRefs.current?.updateExplode) {
                  valveRefs.current.updateExplode(val);
                }
              }}
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => {
                  setInternalValveExploded(0);
                  if (valveRefs.current?.updateExplode) {
                    valveRefs.current.updateExplode(0);
                  }
                }}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-800 font-bold transition"
              >
                Assemble (0%)
              </button>
              <button
                onClick={() => {
                  setInternalValveExploded(1);
                  if (valveRefs.current?.updateExplode) {
                    valveRefs.current.updateExplode(1);
                  }
                }}
                className="flex-1 py-1 rounded bg-sky-950/60 hover:bg-sky-900/60 text-[10px] font-mono text-sky-300 border border-sky-800/60 font-bold transition"
              >
                Disassemble (100%)
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-medium">
              {activeProjectType === 'INDUSTRIAL_DRONE' ? 'Aerospace Structural Material:' : 'Material Finish & Texture:'}
            </span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {(activeProjectType === 'INDUSTRIAL_DRONE'
                ? [
                    { id: 'CARBON_FIBER', label: '⬛ 3K Carbon Fiber' },
                    { id: 'ALUMINUM_7075', label: '⚙️ Al 7075-T6 Anodized' },
                    { id: 'TITANIUM_TI6AL4V', label: '🔩 Ti-6Al-4V Grade 5' },
                    { id: 'POLYCARBONATE', label: '🛡️ Polycarbonate Dome' },
                  ]
                : [
                    { id: 'BRASS', label: '🟨 C360 Brass' },
                    { id: 'STAINLESS_316', label: '⚙️ 316 Stainless' },
                    { id: 'CHROME_PLATED', label: '✨ Polished Chrome' },
                    { id: 'CAST_BRONZE', label: '🟤 Cast Bronze' },
                  ]
              ).map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => setInternalValveMaterial(mat.id as any)}
                  className={`px-1.5 py-1 rounded text-left transition ${
                    internalValveMaterial === mat.id
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400">
              {activeProjectType === 'INDUSTRIAL_DRONE' ? 'Anodized Accent Color:' : 'Handle Color:'}
            </span>
            <div className="flex gap-1">
              {[
                { color: '#0284c7', name: 'Electric Blue' },
                { color: '#ef4444', name: 'Racing Red' },
                { color: '#10b981', name: 'Emerald Green' },
                { color: '#eab308', name: 'Gold / Yellow' },
                { color: '#1e293b', name: 'Stealth Black' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => setInternalHandleColor(c.color)}
                  style={{ backgroundColor: c.color }}
                  className={`w-4 h-4 rounded-full border ${
                    internalHandleColor === c.color ? 'border-white ring-1 ring-sky-400 scale-110' : 'border-slate-700 opacity-80'
                  }`}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section Plane Slider Bar */}
      {showSectionPlane && (
        <div className="absolute top-16 left-4 z-10 bg-slate-950/90 backdrop-blur-md p-3 rounded-lg border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
          <span className="font-semibold text-amber-400">Section Cut Depth:</span>
          <input
            type="range"
            min="-150"
            max="150"
            value={sectionPlaneOffset}
            onChange={(e) => setSectionPlaneOffset(Number(e.target.value))}
            className="w-36 accent-amber-500 cursor-pointer"
          />
          <span className="font-mono">{sectionPlaneOffset} mm</span>
        </div>
      )}

      {/* Measurement Tool Output Overlay */}
      {measureMode && (
        <div className="absolute bottom-16 left-4 z-10 bg-slate-950/90 backdrop-blur-md p-3 rounded-lg border border-emerald-500/40 text-xs text-slate-200 flex flex-col gap-1 shadow-lg">
          <div className="flex items-center gap-2 font-semibold text-emerald-400">
            <Ruler className="w-4 h-4" /> 3D Measurement Mode Active
          </div>
          <p className="text-slate-400 text-[11px]">Click 2 points on the 3D geometry to calculate distance.</p>
          <div className="mt-1 flex items-center gap-2 font-mono">
            <span>Points Picked: {selectedPoints.length}/2</span>
            {measuredDistance !== null && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Distance: {measuredDistance.toFixed(3)} {activeUnit}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Diagnostics / Error Overlay */}
      <div
        className={`absolute z-10 flex flex-col gap-1 text-[10px] font-mono pointer-events-none ${
          measureMode ? 'bottom-24' : 'bottom-4'
        } left-4`}
      >
        {debugError ? (
          <div className="bg-red-950/90 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg backdrop-blur-md pointer-events-auto">
            <strong>Error:</strong> {debugError}
          </div>
        ) : (
          <div className="bg-slate-950/80 text-slate-400 border border-slate-800/60 px-2 py-1 rounded-md backdrop-blur-md">
            Active 3D Meshes: <strong className="text-white">{childrenCount}</strong>
          </div>
        )}
      </div>

      {/* Entity Selection Info Box */}
      {selectedEntityName && (
        <div className="absolute bottom-4 left-4 z-10 bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-center gap-2 shadow-lg">
          <Box className="w-4 h-4 text-blue-400" />
          <span>
            Selected Entity: <strong className="text-white">{selectedEntityName}</strong>
          </span>
        </div>
      )}

      {/* Viewport Overlay Axis Legend & Pipeline */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {showPipelineDetails ? (
          <div className="bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-indigo-500/40 text-[10px] font-mono text-slate-300 flex flex-col gap-1 min-w-[210px] shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowPipelineDetails(false)}
              className="absolute top-1 right-2 text-slate-500 hover:text-slate-300 text-[9px] font-sans font-bold"
              title="Hide Pipeline Stats"
            >
              ✕
            </button>
            <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1 pr-3">
              <span className="text-slate-500 uppercase tracking-wider font-bold text-[9px]">Pipeline Backend</span>
              <span
                className={`px-1 py-0.5 rounded font-bold text-[8px] uppercase tracking-wider ${
                  renderingBackend === 'WebGPU'
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/20'
                    : 'bg-sky-600/20 text-sky-400 border border-sky-500/20'
                }`}
              >
                {renderingBackend}
              </span>
            </div>
            {renderingBackend === 'WebGPU' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Device Queue:</span>
                  <span className="text-emerald-400 font-bold">Asynchronous</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">WGSL Shaders:</span>
                  <span className="text-slate-300">Compiled (PSO)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">BindGroups Layout:</span>
                  <span className="text-slate-300">STD140 Uniform</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buffer Mapping:</span>
                  <span className="text-slate-300">Mapped CPU/GPU</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Device API:</span>
                  <span className="text-sky-400 font-bold">WebGL 2.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fallback Driver:</span>
                  <span className="text-slate-300">Three.js context</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Draw Calls/frame:</span>
                  <span className="text-slate-300">~15 calls</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowPipelineDetails(true)}
            className="bg-slate-950/80 hover:bg-slate-900 hover:border-slate-700 transition backdrop-blur-md px-2 py-1 rounded border border-slate-800 text-[9px] font-mono text-slate-400 flex items-center gap-1 shadow-md"
            title="Show Pipeline Performance Diagnostics"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span>Pipeline Stats</span>
          </button>
        )}

        <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-2.5 shadow-lg mb-2">
          <span className="text-red-400">● X</span>
          <span className="text-green-400">● Y</span>
          <span className="text-blue-400">● Z</span>
        </div>
      </div>

      {/* Axis Legend at Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-2.5 shadow-lg">
        <span className="text-slate-500 font-bold uppercase mr-1">Global Axes:</span>
        <span className="text-red-400">X</span>
        <span className="text-green-400">Y</span>
        <span className="text-blue-400">Z</span>
      </div>
    </div>
  );
};
