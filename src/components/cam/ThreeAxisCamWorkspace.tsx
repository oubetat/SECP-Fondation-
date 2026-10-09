/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Three-Axis CAM Interactive Workspace & Visualizer
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, RotateCcw, SkipForward, CheckCircle2, AlertTriangle, Layers, Wrench, ShieldCheck, Cpu, Download, Terminal, Compass, Box, Eye, Sliders, Sparkles, Activity, FileCode, Gauge, ArrowRight, Info } from 'lucide-react';
import { ThreeAxisToolpathEngine } from '../../engine/cam/toolpath/ThreeAxisToolpathEngine';
import {
  MachiningSetup,
  CuttingTool,
  MachiningOperation,
  OperationStrategyType,
  Toolpath,
  MotionType,
  ToolpathValidationReport,
  ToolpathEvidence,
} from '../../engine/cam/toolpath/ToolpathTypes';
import { StockRemovalSimulator, SimulationResult } from '../../engine/cam/toolpath/StockRemovalSimulator';
import { HardAcceptanceGate256, HardAcceptanceGate256Report } from '../../engine/cam/toolpath/HardAcceptanceGate256';
import { ManufacturingFeatureType } from '../../engine/cam/feature-recognition/FeatureTypes';

export const ThreeAxisCamWorkspace: React.FC = () => {
  // Preset Reference Models
  const [selectedModel, setSelectedModel] = useState<'MODEL_A_FLAT' | 'MODEL_B_POCKET' | 'MODEL_C_MULTI' | 'MODEL_D_HOLES' | 'MODEL_E_PRISMATIC'>('MODEL_B_POCKET');

  const toolLibrary = useMemo(() => ThreeAxisToolpathEngine.createDefaultToolLibrary(), []);
  const [setup, setSetup] = useState<MachiningSetup | null>(null);
  const [selectedOpId, setSelectedOpId] = useState<string>('');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [evidence, setEvidence] = useState<ToolpathEvidence | null>(null);
  const [gateReport, setGateReport] = useState<HardAcceptanceGate256Report | null>(null);
  const [activeTab, setActiveTab] = useState<'WORKSPACE_3D' | 'DEVIATION_MAP' | 'OPERATIONS' | 'GATE_BATTERY' | 'EVIDENCE'>('WORKSPACE_3D');

  // Simulation Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // Multiplier
  const [viewAngle, setViewAngle] = useState<{ rotX: number; rotY: number }>({ rotX: 35, rotY: -45 });
  const [showStock, setShowStock] = useState<boolean>(true);
  const [showRapids, setShowRapids] = useState<boolean>(true);
  const [showTool, setShowTool] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize CAM Setup based on Model
  const initModelSetup = (modelType: string) => {
    let partBounds = { minX: 0, maxX: 120, minY: 0, maxY: 70, minZ: 0, maxZ: 30 };
    let features: any[] = [];

    try {
      if (modelType === 'MODEL_A_FLAT') {
        partBounds = { minX: 0, maxX: 100, minY: 0, maxY: 50, minZ: 18, maxZ: 20 };
        features = [
          {
            id: 'F_FACE',
            name: 'Top Datum Face',
            type: ManufacturingFeatureType.PLANAR_FACE,
            boundingVolume: { minX: 0, maxX: 100, minY: 0, maxY: 50, minZ: 18, maxZ: 20 },
            parameters: {},
          },
        ];
      } else if (modelType === 'MODEL_B_POCKET') {
        partBounds = { minX: 0, maxX: 120, minY: 0, maxY: 80, minZ: 0, maxZ: 35 };
        features = [
          {
            id: 'F_PKT_MAIN',
            name: 'Main Cavity Pocket',
            type: ManufacturingFeatureType.POCKET_RECTANGULAR,
            boundingVolume: { minX: 20, maxX: 100, minY: 15, maxY: 65, minZ: 10, maxZ: 35 },
            parameters: { depthMm: 25 },
          },
        ];
      } else if (modelType === 'MODEL_C_MULTI') {
        partBounds = { minX: 0, maxX: 140, minY: 0, maxY: 90, minZ: 0, maxZ: 40 };
        features = [
          {
            id: 'F_PKT_1',
            name: 'Left Pocket',
            type: ManufacturingFeatureType.POCKET_RECTANGULAR,
            boundingVolume: { minX: 15, maxX: 60, minY: 15, maxY: 75, minZ: 15, maxZ: 40 },
            parameters: { depthMm: 25 },
          },
          {
            id: 'F_PKT_2',
            name: 'Right Pocket',
            type: ManufacturingFeatureType.POCKET_RECTANGULAR,
            boundingVolume: { minX: 80, maxX: 125, minY: 15, maxY: 75, minZ: 10, maxZ: 40 },
            parameters: { depthMm: 30 },
          },
          {
            id: 'F_SLOT_CENTER',
            name: 'Connecting Slot',
            type: ManufacturingFeatureType.SLOT_THROUGH,
            boundingVolume: { minX: 60, maxX: 80, minY: 35, maxY: 55, minZ: 20, maxZ: 40 },
            parameters: { widthMm: 8, depthMm: 20 },
          },
        ];
      } else if (modelType === 'MODEL_D_HOLES') {
        partBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 25 };
        features = [
          {
            id: 'F_HOLE_1',
            name: 'Hole Pattern 1 (NW)',
            type: ManufacturingFeatureType.HOLE_SIMPLE,
            boundingVolume: { minX: 20, maxX: 30, minY: 20, maxY: 30, minZ: 5, maxZ: 25 },
            parameters: { depthMm: 20, diameterMm: 8.5 },
          },
          {
            id: 'F_HOLE_2',
            name: 'Hole Pattern 2 (NE)',
            type: ManufacturingFeatureType.HOLE_SIMPLE,
            boundingVolume: { minX: 70, maxX: 80, minY: 20, maxY: 30, minZ: 5, maxZ: 25 },
            parameters: { depthMm: 20, diameterMm: 8.5 },
          },
          {
            id: 'F_HOLE_3',
            name: 'Hole Pattern 3 (Center)',
            type: ManufacturingFeatureType.HOLE_SIMPLE,
            boundingVolume: { minX: 45, maxX: 55, minY: 45, maxY: 55, minZ: 5, maxZ: 25 },
            parameters: { depthMm: 20, diameterMm: 8.5 },
          },
        ];
      } else {
        // MODEL_E_PRISMATIC
        partBounds = { minX: 0, maxX: 150, minY: 0, maxY: 90, minZ: 0, maxZ: 45 };
        features = [
          {
            id: 'F_PKT_MAIN',
            name: 'Upper Pocket',
            type: ManufacturingFeatureType.POCKET_RECTANGULAR,
            boundingVolume: { minX: 25, maxX: 125, minY: 20, maxY: 70, minZ: 20, maxZ: 45 },
            parameters: { depthMm: 25 },
          },
          {
            id: 'F_SLOT_1',
            name: 'Keyway Slot',
            type: ManufacturingFeatureType.SLOT_THROUGH,
            boundingVolume: { minX: 10, maxX: 140, minY: 40, maxY: 50, minZ: 30, maxZ: 45 },
            parameters: { widthMm: 6, depthMm: 15 },
          },
          {
            id: 'F_HOLE_1',
            name: 'Center Bore',
            type: ManufacturingFeatureType.HOLE_SIMPLE,
            boundingVolume: { minX: 70, maxX: 80, minY: 40, maxY: 50, minZ: 0, maxZ: 20 },
            parameters: { depthMm: 20, diameterMm: 8.5 },
          },
        ];
      }

      const newSetup = ThreeAxisToolpathEngine.createSetupFromPartBounds(
        `SETUP_${modelType}`,
        `OP10 Top Machining Setup`,
        partBounds
      );

      const featGraph: any = {
        features,
        adjacency: [],
        setups: [],
        totalEstimatedTimeMin: 15,
        roughingTimeMin: 10,
        finishingTimeMin: 5,
      };

      const plannedOps = ThreeAxisToolpathEngine.planOperationsFromFeatures(newSetup, featGraph, toolLibrary);
      newSetup.operations = plannedOps;

      const featMap = new Map<string, any>();
      features.forEach(f => featMap.set(f.id, f));

      const { setup: generatedSetup } = ThreeAxisToolpathEngine.generateSetupToolpaths(newSetup, featMap);
      
      if (generatedSetup) {
        setSetup({ ...generatedSetup });
        if (generatedSetup.operations && generatedSetup.operations.length > 0) {
          setSelectedOpId(generatedSetup.operations[0].id);
        }

        // Run Initial Simulation
        const validToolpaths = generatedSetup.operations?.map(o => o.toolpath).filter(Boolean) as Toolpath[] || [];
        if (validToolpaths.length > 0) {
          const sim = StockRemovalSimulator.simulateStockRemoval(generatedSetup.stock, validToolpaths, toolLibrary, undefined, 45);
          setSimulationResult(sim);

          const ev = ThreeAxisToolpathEngine.generateToolpathEvidence(generatedSetup, sim);
          setEvidence(ev);
        }
      }

      setCurrentStep(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Failed to initialize model setup:', err);
    }
  };

  useEffect(() => {
    initModelSetup(selectedModel);
  }, [selectedModel]);

  // Aggregate all positions across visible operations
  const allPositions = useMemo(() => {
    if (!setup) return [];
    const pts: { pos: any; op: MachiningOperation }[] = [];
    for (const op of setup.operations) {
      if (op.toolpath) {
        for (const p of op.toolpath.positions) {
          pts.push({ pos: p, op });
        }
      }
    }
    return pts;
  }, [setup]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= allPositions.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return Math.min(allPositions.length - 1, prev + playbackSpeed);
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying, allPositions.length, playbackSpeed]);

  // 3D Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !setup) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Coordinate Projection Helper (Isometric / Perspective 3D -> 2D)
    const radX = (viewAngle.rotX * Math.PI) / 180;
    const radY = (viewAngle.rotY * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    const centerX = (setup.stock.boundsMm.minX + setup.stock.boundsMm.maxX) / 2;
    const centerY = (setup.stock.boundsMm.minY + setup.stock.boundsMm.maxY) / 2;
    const centerZ = (setup.stock.boundsMm.minZ + setup.stock.boundsMm.maxZ) / 2;
    const scale = Math.min(w, h) / 180;

    const project = (x: number, y: number, z: number): [number, number] => {
      const dx = x - centerX;
      const dy = y - centerY;
      const dz = z - centerZ;

      // Rotate around Y (Azimuth)
      const x1 = dx * cosY - dy * sinY;
      const y1 = dx * sinY + dy * cosY;

      // Rotate around X (Elevation)
      const y2 = y1 * cosX - dz * sinX;
      const z2 = y1 * sinX + dz * cosX;

      const px = w / 2 + x1 * scale;
      const py = h / 2 - z2 * scale + y2 * scale * 0.2;
      return [px, py];
    };

    // 1. Draw Machine Grid & WCS Origin
    const [origX, origY] = project(setup.wcs.origin.x, setup.wcs.origin.y, setup.wcs.origin.z);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(w / 2 - 140, h / 2 - 100, 280, 200);
    ctx.setLineDash([]);

    // 2. Draw Stock Bounding Box
    if (showStock) {
      const b = setup.stock.boundsMm;
      const corners = [
        project(b.minX, b.minY, b.minZ),
        project(b.maxX, b.minY, b.minZ),
        project(b.maxX, b.maxY, b.minZ),
        project(b.minX, b.maxY, b.minZ),
        project(b.minX, b.minY, b.maxZ),
        project(b.maxX, b.minY, b.maxZ),
        project(b.maxX, b.maxY, b.maxZ),
        project(b.minX, b.maxY, b.maxZ),
      ];

      // Draw bottom face
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      ctx.lineTo(corners[1][0], corners[1][1]);
      ctx.lineTo(corners[2][0], corners[2][1]);
      ctx.lineTo(corners[3][0], corners[3][1]);
      ctx.closePath();
      ctx.stroke();

      // Top face
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.beginPath();
      ctx.moveTo(corners[4][0], corners[4][1]);
      ctx.lineTo(corners[5][0], corners[5][1]);
      ctx.lineTo(corners[6][0], corners[6][1]);
      ctx.lineTo(corners[7][0], corners[7][1]);
      ctx.closePath();
      ctx.stroke();

      // Pillars
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(corners[i][0], corners[i][1]);
        ctx.lineTo(corners[i + 4][0], corners[i + 4][1]);
        ctx.stroke();
      }
    }

    // 3. Draw Toolpath Segments up to currentStep
    const renderLimit = isPlaying ? currentStep : allPositions.length;
    for (let i = 0; i < renderLimit - 1; i++) {
      const p1 = allPositions[i].pos;
      const p2 = allPositions[i + 1].pos;

      const isRapid = p2.motionType === MotionType.RAPID || p2.motionType === MotionType.RETRACT;
      if (isRapid && !showRapids) continue;

      const [sx, sy] = project(p1.x, p1.y, p1.z);
      const [ex, ey] = project(p2.x, p2.y, p2.z);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);

      if (isRapid) {
        ctx.strokeStyle = '#f43f5e'; // Red for rapid
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
      } else if (p2.motionType === MotionType.PLUNGE || p2.motionType === MotionType.RAMP || p2.motionType === MotionType.HELIX) {
        ctx.strokeStyle = '#eab308'; // Yellow for ramp/helix entry
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#10b981'; // Emerald for cutting feed
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Draw Animated Active Tool Head
    if (showTool && allPositions.length > 0 && currentStep < allPositions.length) {
      const currentPos = allPositions[currentStep].pos;
      const activeTool = allPositions[currentStep].op.tool;
      const [tx, ty] = project(currentPos.x, currentPos.y, currentPos.z);
      const [hx, hy] = project(currentPos.x, currentPos.y, currentPos.z + activeTool.fluteLengthMm);
      const [topX, topY] = project(currentPos.x, currentPos.y, currentPos.z + activeTool.overallLengthMm);

      // Tool Flute Body
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(3, (activeTool.diameterMm / 2) * (scale / 4));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Tool Holder
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = Math.max(6, (activeTool.holderDiameterMm / 2) * (scale / 4));
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(topX, topY);
      ctx.stroke();

      // Tool Tip Glowing Circle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. WCS Triad
    ctx.lineWidth = 2;
    // X Axis Red
    const [xAxisEx, xAxisEy] = project(setup.wcs.origin.x + 15, setup.wcs.origin.y, setup.wcs.origin.z);
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(origX, origY);
    ctx.lineTo(xAxisEx, xAxisEy);
    ctx.stroke();

    // Y Axis Green
    const [yAxisEx, yAxisEy] = project(setup.wcs.origin.x, setup.wcs.origin.y + 15, setup.wcs.origin.z);
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(origX, origY);
    ctx.lineTo(yAxisEx, yAxisEy);
    ctx.stroke();

    // Z Axis Blue
    const [zAxisEx, zAxisEy] = project(setup.wcs.origin.x, setup.wcs.origin.y, setup.wcs.origin.z + 15);
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(origX, origY);
    ctx.lineTo(zAxisEx, zAxisEy);
    ctx.stroke();
  }, [setup, allPositions, currentStep, isPlaying, viewAngle, showStock, showRapids, showTool]);

  const handleRunGateBattery = () => {
    const report = HardAcceptanceGate256.runVerificationBattery();
    setGateReport(report);
    setActiveTab('GATE_BATTERY');
  };

  const handleExportEvidenceJson = () => {
    if (!evidence) return;
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Toolpath_Evidence_${evidence.masterToolpathHash}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeOp = setup?.operations.find(o => o.id === selectedOpId);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-rose-400 shadow-inner">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  SECP 3-Axis CAM Engine
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-900/60 text-rose-300 border border-rose-700/50 font-mono">
                    PATCH-256 PROVEN
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  B-Rep Features → Setup WCS → Stock → Multi-Z Strategies → Real Material Removal Simulation
                </p>
              </div>
            </div>
          </div>

          {/* Model Selector & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
              {(
                [
                  { id: 'MODEL_A_FLAT', label: 'Flat Plate' },
                  { id: 'MODEL_B_POCKET', label: 'Pocket Block' },
                  { id: 'MODEL_C_MULTI', label: 'Multi-Pocket' },
                  { id: 'MODEL_D_HOLES', label: 'Hole Plate' },
                  { id: 'MODEL_E_PRISMATIC', label: 'Prismatic Body' },
                ] as const
              ).map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`px-3 py-1.5 rounded transition cursor-pointer ${
                    selectedModel === m.id
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleRunGateBattery}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-900/30 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              Run Gate 256 Battery
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex bg-slate-900/70 border border-slate-800 p-1.5 rounded-xl gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('WORKSPACE_3D')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'WORKSPACE_3D'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Compass className="w-4 h-4" />
          3D Toolpath Visualizer & Simulation
        </button>
        <button
          onClick={() => setActiveTab('DEVIATION_MAP')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'DEVIATION_MAP'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          Stock Removal & Deviation Map
        </button>
        <button
          onClick={() => setActiveTab('OPERATIONS')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'OPERATIONS'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          Operation Tree & Parameters ({setup?.operations.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('GATE_BATTERY')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'GATE_BATTERY'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Gauge className="w-4 h-4" />
          Hard Acceptance Gate 256
        </button>
        <button
          onClick={() => setActiveTab('EVIDENCE')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'EVIDENCE'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCode className="w-4 h-4" />
          Evidence & Master Fingerprint
        </button>
      </div>

      {/* TAB 1: 3D TOOLPATH & SIMULATION */}
      {activeTab === 'WORKSPACE_3D' && setup && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* 3D Canvas & Simulation Controls */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative shadow-xl">
              {/* Canvas Overlay Toolbar */}
              <div className="absolute top-6 left-6 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>WCS: {setup.wcs.id} [X:{setup.wcs.origin.x}, Y:{setup.wcs.origin.y}, Z:{setup.wcs.origin.z}]</span>
              </div>

              {/* View Toggle Checkboxes */}
              <div className="absolute top-6 right-6 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStock}
                    onChange={e => setShowStock(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  Stock Box
                </label>
                <label className="flex items-center gap-1 cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={showRapids}
                    onChange={e => setShowRapids(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  G0 Rapids
                </label>
                <label className="flex items-center gap-1 cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={showTool}
                    onChange={e => setShowTool(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  Tool Head
                </label>
              </div>

              {/* Interactive 3D Canvas */}
              <canvas
                ref={canvasRef}
                width={700}
                height={420}
                className="w-full h-[420px] bg-slate-950 rounded-lg border border-slate-900 block"
              />

              {/* Playback & Rotation Controller */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                {/* Transport Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition shadow cursor-pointer ${
                      isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isPlaying ? 'Pause Simulation' : 'Play Simulation'}
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStep(0);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                    title="Reset Simulation"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setCurrentStep(prev => Math.min(allPositions.length - 1, prev + 10))}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                    title="Step Forward"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrubber Progress Slider */}
                <div className="flex-1 max-w-xs flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400">Step:</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, allPositions.length - 1)}
                    value={currentStep}
                    onChange={e => {
                      setIsPlaying(false);
                      setCurrentStep(Number(e.target.value));
                    }}
                    className="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="text-[10px] font-mono text-slate-300 w-12 text-right">
                    {currentStep}/{allPositions.length}
                  </span>
                </div>

                {/* Playback Speed Multiplier */}
                <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                  <span className="text-slate-500">Speed:</span>
                  {[1, 2, 5, 10].map(s => (
                    <button
                      key={s}
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-1.5 py-0.5 rounded cursor-pointer ${
                        playbackSpeed === s ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>

                {/* View Elevation/Azimuth Buttons */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <button
                    onClick={() => setViewAngle(prev => ({ ...prev, rotY: prev.rotY - 15 }))}
                    className="px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    ⟲ Rot Y
                  </button>
                  <button
                    onClick={() => setViewAngle(prev => ({ ...prev, rotY: prev.rotY + 15 }))}
                    className="px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    Rot Y ⟳
                  </button>
                  <button
                    onClick={() => setViewAngle({ rotX: 35, rotY: -45 })}
                    className="px-2 py-1 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer"
                  >
                    Iso Top
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Operation Status & Live Telemetry Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Tool Telemetry */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <span className="font-bold text-slate-400 uppercase flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  Live Tool Telemetry
                </span>
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] rounded">
                  G-CODE ACTIVE
                </span>
              </div>

              {allPositions.length > 0 && currentStep < allPositions.length ? (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block">X Position</span>
                      <span className="text-slate-200 font-bold">{allPositions[currentStep].pos.x.toFixed(2)}mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Y Position</span>
                      <span className="text-slate-200 font-bold">{allPositions[currentStep].pos.y.toFixed(2)}mm</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Z Depth</span>
                      <span className="text-rose-400 font-bold">{allPositions[currentStep].pos.z.toFixed(2)}mm</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Motion Mode:</span>
                      <span
                        className={`font-bold ${
                          allPositions[currentStep].pos.motionType === MotionType.RAPID
                            ? 'text-rose-400'
                            : allPositions[currentStep].pos.motionType === MotionType.FEED
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {allPositions[currentStep].pos.motionType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Programmed Feed:</span>
                      <span className="text-slate-300 font-bold">{allPositions[currentStep].pos.feedMmMin} mm/min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Spindle Speed:</span>
                      <span className="text-slate-300 font-bold">{allPositions[currentStep].pos.spindleRpm} RPM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Coolant System:</span>
                      <span className="text-cyan-400 font-bold">{allPositions[currentStep].pos.coolant}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active Tool:</span>
                      <span className="text-slate-300 font-bold">{allPositions[currentStep].op.tool.name}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs text-center py-4">No active tool motion</div>
              )}
            </div>

            {/* Setup & Stock Parameters */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-rose-400" />
                Setup Configuration
              </h3>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Stock Envelope:</span>
                  <span className="text-slate-200">
                    {setup.stock.dimensionsMm.dx} x {setup.stock.dimensionsMm.dy} x {setup.stock.dimensionsMm.dz} mm
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Safe Plane Z:</span>
                  <span className="text-slate-200">{setup.safePlaneZMm} mm</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Retract Plane Z:</span>
                  <span className="text-slate-200">{setup.retractPlaneZMm} mm</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Material:</span>
                  <span className="text-slate-200 font-bold">AL-6061-T6</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEVIATION MAP & STOCK REMOVAL */}
      {activeTab === 'DEVIATION_MAP' && simulationResult && (
        <div className="space-y-5">
          {/* Volumetric Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Initial Stock Volume</span>
              <div className="text-lg font-bold text-slate-200 font-mono">
                {simulationResult.initialStockVolumeMm3.toLocaleString()} mm³
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Material Removed</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {simulationResult.removedVolumeMm3.toLocaleString()} mm³
              </div>
              <span className="text-[10px] text-emerald-500/80 block">
                {simulationResult.removalPercentage}% of raw workpiece
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">In-Tolerance Surface</span>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {simulationResult.inTolerancePercentage}%
              </div>
              <span className="text-[10px] text-slate-500 block">Within ±0.050mm tolerance band</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-500 font-mono uppercase">Max Excess Stock (Undercut)</span>
              <div className="text-lg font-bold text-amber-400 font-mono">
                +{simulationResult.maxPositiveDeviationMm} mm
              </div>
              <span className="text-[10px] text-slate-500 block">Max gouge: {simulationResult.maxNegativeGougeMm}mm</span>
            </div>
          </div>

          {/* Deviation Heatmap 2D Projection Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  Numerical Machining Deviation Surface Heatmap
                </h3>
                <p className="text-xs text-slate-400">
                  Color gradient represents Z deviation: Green = In Tolerance (±0.05mm), Blue = Excess Uncut Stock, Red = Overcut/Gouge
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6 items-center">
              <div className="col-span-12 lg:col-span-8 flex justify-center">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 inline-block shadow-2xl">
                  <div
                    className="grid gap-0.5"
                    style={{
                      gridTemplateColumns: `repeat(${Math.round(Math.sqrt(simulationResult.deviationMap.length))}, minmax(0, 1fr))`,
                    }}
                  >
                    {simulationResult.deviationMap.map((pt, idx) => {
                      let bgColor = '#10b981'; // Green in tolerance
                      if (pt.status === 'EXCESS_STOCK') {
                        bgColor = '#38bdf8'; // Cyan/Blue excess
                      } else if (pt.status === 'GOUGE') {
                        bgColor = '#ef4444'; // Red gouge
                      }
                      return (
                        <div
                          key={idx}
                          className="w-2.5 h-2.5 rounded-xs transition hover:scale-150 cursor-pointer"
                          style={{ backgroundColor: bgColor }}
                          title={`[X:${pt.x}, Y:${pt.y}] Machined:${pt.machinedZ}mm, Target:${pt.targetPartZ}mm, Dev:${pt.deviationMm}mm (${pt.status})`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Legend & Stats */}
              <div className="col-span-12 lg:col-span-4 space-y-4 font-mono text-xs">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                  <span className="font-bold text-slate-400 block border-b border-slate-800 pb-2">
                    Heatmap Legend & Bounds
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
                    <span className="text-slate-300">In Tolerance: |ΔZ| ≤ 0.050mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-sky-400" />
                    <span className="text-slate-300">Excess Stock: ΔZ &gt; +0.050mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-rose-500" />
                    <span className="text-slate-300">Overcut / Gouge: ΔZ &lt; -0.050mm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPERATION TREE & STRATEGY INSPECTOR */}
      {activeTab === 'OPERATIONS' && setup && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Operations List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Planned Machining Operations ({setup.operations.length})
              </h3>

              <div className="space-y-2">
                {setup.operations.map((op, idx) => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOpId(op.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      selectedOpId === op.id
                        ? 'bg-rose-950/40 border-rose-600 text-white shadow-lg shadow-rose-950/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-400">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-rose-300">{op.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {op.tool.name} • {op.parameters.cuttingFeedMmMin} mm/min
                      </div>
                    </div>

                    <div className="text-right">
                      {op.isValidated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-950 border border-amber-800 text-amber-300 rounded font-mono">
                          <AlertTriangle className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Selected Operation Details Inspector */}
          <div className="lg:col-span-7 space-y-4">
            {activeOp ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-rose-400" />
                      {activeOp.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Strategy: {activeOp.strategyType}</p>
                  </div>

                  <span className="px-3 py-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-rose-400">
                    ID: {activeOp.id}
                  </span>
                </div>

                {/* Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Spindle Speed</span>
                    <span className="text-slate-200 font-bold">{activeOp.parameters.spindleRpm} RPM</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Cutting Feed</span>
                    <span className="text-slate-200 font-bold">{activeOp.parameters.cuttingFeedMmMin} mm/min</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Plunge Feed</span>
                    <span className="text-slate-200 font-bold">{activeOp.parameters.plungeFeedMmMin} mm/min</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Axial Stepdown (Ap)</span>
                    <span className="text-rose-400 font-bold">{activeOp.parameters.stepdownMm} mm</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Radial Stepover (Ae)</span>
                    <span className="text-rose-400 font-bold">{activeOp.parameters.stepoverMm} mm</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Entry Strategy</span>
                    <span className="text-cyan-400 font-bold">{activeOp.parameters.entryStrategy}</span>
                  </div>
                </div>

                {/* Toolpath Geometry Metrics */}
                {activeOp.toolpath && (
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3 font-mono text-xs">
                    <span className="font-bold text-slate-400 block border-b border-slate-800 pb-2">
                      Computed Toolpath Trajectory Metadata
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>Total Path Length: <span className="font-bold text-slate-100">{activeOp.toolpath.totalLengthMm} mm</span></div>
                      <div>Cutting Length: <span className="font-bold text-emerald-400">{activeOp.toolpath.cuttingLengthMm} mm</span></div>
                      <div>Est. Cycle Time: <span className="font-bold text-rose-300">{(activeOp.toolpath.estimatedMachiningTimeSec / 60).toFixed(2)} min</span></div>
                      <div>Total Z Passes: <span className="font-bold text-slate-100">{activeOp.toolpath.zPassCount}</span></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">Select an operation to inspect parameters</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: HARD ACCEPTANCE GATE 256 BATTERY */}
      {activeTab === 'GATE_BATTERY' && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-rose-400" />
                Hard Acceptance Gate 256: 3-Axis CAM Verification
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                31-test reference validation suite (WCS, multi-Z stepdowns, gouge/collision guards, stock comparison)
              </p>
            </div>

            <button
              onClick={handleRunGateBattery}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              Rerun All 31 Tests
            </button>
          </div>

          {gateReport ? (
            <div className="space-y-4">
              {/* Verdict Summary Bar */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  gateReport.gatePassed
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <span className="font-bold text-sm block">GATE VERDICT: {gateReport.capabilityStatus}</span>
                    <span className="text-xs opacity-80 font-mono">
                      Passed {gateReport.passedTests} of {gateReport.totalTests} tests ({gateReport.overallScore}% score)
                    </span>
                  </div>
                </div>

                <span className="font-mono text-xs px-3 py-1 rounded bg-slate-950/80 border border-slate-800">
                  {gateReport.masterHash}
                </span>
              </div>

              {/* Individual Tests Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gateReport.testResults.map(test => (
                  <div
                    key={test.id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">
                        #{test.id}: {test.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          test.passed
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {test.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{test.diagnostics}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs">
              Click &quot;Run Gate 256 Battery&quot; to execute the automated verification test suite.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EVIDENCE & CRYPTOGRAPHIC EXPORT */}
      {activeTab === 'EVIDENCE' && evidence && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-rose-400" />
                Deterministic CAM Engineering Evidence Package
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                SHA-256 fingerprint: {evidence.masterToolpathHash}
              </p>
            </div>

            <button
              onClick={handleExportEvidenceJson}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Evidence JSON
            </button>
          </div>

          <pre className="w-full h-80 bg-slate-950 border border-slate-800 p-4 rounded-lg font-mono text-xs text-emerald-400/90 overflow-y-auto leading-relaxed custom-scrollbar">
            {JSON.stringify(evidence, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
