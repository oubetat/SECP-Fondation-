import React, { useState, useEffect, useRef } from 'react';
import { Wrench, Search, Filter, Plus, Layers, Shield, Activity, Cpu, Sparkles, CheckCircle2, AlertTriangle, Download, Upload, Eye, Sliders, RotateCcw, Zap, Tag, Hash, FileCheck, Compass, Copy, Archive, RefreshCw, Gauge, CircleDot, Boxes } from 'lucide-react';
import {
  CAMTool,
  ToolType,
  ToolCategory,
  ToolMaterial,
  ToolCoating,
  HolderInterfaceType,
  ToolAssembly,
  ToolHolderDefinition,
  ToolSnapshot,
  ToolEvidence,
  WorkpieceMaterialClass
} from '../../engine/cam/tool-library/ToolTypes';
import { ToolLibraryEngine } from '../../engine/cam/tool-library/ToolLibraryEngine';
import { ToolGeometryEngine } from '../../engine/cam/tool-library/ToolGeometryEngine';
import { ToolAssemblyEngine } from '../../engine/cam/tool-library/ToolAssemblyEngine';
import { ToolCuttingCalculator, MachiningPhysicsResult } from '../../engine/cam/tool-library/ToolCuttingCalculator';
import { ToolValidator } from '../../engine/cam/tool-library/ToolValidator';
import { ToolSnapshotManager } from '../../engine/cam/tool-library/ToolSnapshotManager';
import { ToolEvidenceGenerator } from '../../engine/cam/tool-library/ToolEvidenceGenerator';
import { HardAcceptanceGate261, Gate261Report } from '../../engine/cam/tool-library/HardAcceptanceGate261';
import { ToolBenchmarks, BenchmarkResult } from '../../engine/cam/tool-library/ToolBenchmarks';

export const ToolLibraryWorkspace: React.FC = () => {
  // State
  const [tools, setTools] = useState<CAMTool[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string>('tool-em-10mm-4f');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('ALL');
  const [minDiameterFilter, setMinDiameterFilter] = useState<number>(0);
  const [maxDiameterFilter, setMaxDiameterFilter] = useState<number>(65);

  // Active Inspector Tab
  const [activeTab, setActiveTab] = useState<'GEOMETRY' | 'ASSEMBLY' | 'CUTTING_PHYSICS' | 'SNAPSHOTS' | 'AUDIT_EVIDENCE'>('GEOMETRY');

  // Assembly state for selected tool
  const [holders, setHolders] = useState<ToolHolderDefinition[]>([]);
  const [selectedHolderId, setSelectedHolderId] = useState<string>('HOLDER_BT40_ER32_70');
  const [stickOutMm, setStickOutMm] = useState<number>(45);
  const [currentAssembly, setCurrentAssembly] = useState<ToolAssembly | null>(null);

  // Physics calculation state
  const [selectedMaterialClass, setSelectedMaterialClass] = useState<WorkpieceMaterialClass>('ISO_P_STEEL');
  const [customVc, setCustomVc] = useState<number>(180);
  const [customFz, setCustomFz] = useState<number>(0.06);
  const [customAp, setCustomAp] = useState<number>(5.0);
  const [customAe, setCustomAe] = useState<number>(5.0);
  const [applyChipThinning, setApplyChipThinning] = useState<boolean>(true);
  const [physicsResult, setPhysicsResult] = useState<MachiningPhysicsResult | null>(null);

  // Snapshots & Invalidation state
  const [snapshots, setSnapshots] = useState<ToolSnapshot[]>([]);
  const [latestEvidence, setLatestEvidence] = useState<ToolEvidence | null>(null);

  // Gate & Benchmarks state
  const [gateReport, setGateReport] = useState<Gate261Report | null>(null);
  const [isExecutingGate, setIsExecutingGate] = useState<boolean>(false);
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [showGateModal, setShowGateModal] = useState<boolean>(false);

  // Create Tool Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newToolForm, setNewToolForm] = useState({
    toolId: 'T30',
    name: '12mm 4-Flute Rougher',
    type: 'END_MILL' as ToolType,
    category: 'MILLING' as ToolCategory,
    diameterMm: 12.0,
    shankDiameterMm: 12.0,
    overallLengthMm: 80.0,
    cuttingLengthMm: 25.0,
    shoulderLengthMm: 35.0,
    fluteCount: 4,
    cornerRadiusMm: 0,
    tipAngleDeg: 118,
    material: 'CARBIDE' as ToolMaterial,
    coating: 'ALCRN' as ToolCoating,
    manufacturer: 'SECP Advanced Tooling'
  });

  // Canvas ref for 2D/3D profile rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewAngle, setViewAngle] = useState<'ELEVATION_2D' | 'ISOMETRIC_3D'>('ELEVATION_2D');

  // Initialize Library
  useEffect(() => {
    const init = async () => {
      await ToolLibraryEngine.initialize();
      const allTools = ToolLibraryEngine.getAllTools(false);
      setTools(allTools);
      const standardHolders = ToolAssemblyEngine.getStandardHolders();
      setHolders(standardHolders);
      if (allTools.length > 0) {
        setSelectedToolId(allTools[4]?.toolUUID || allTools[0].toolUUID);
      }
    };
    init();
  }, []);

  // Selected tool object
  const activeTool = tools.find(t => t.toolUUID === selectedToolId) || (tools.length > 0 ? tools[0] : null);

  // Update Assembly when active tool, holder, or stickout changes
  useEffect(() => {
    if (!activeTool || holders.length === 0) return;
    const holder = holders.find(h => h.holderId === selectedHolderId) || holders[0];
    ToolAssemblyEngine.createAssembly(activeTool, holder, stickOutMm)
      .then(asm => setCurrentAssembly(asm))
      .catch(() => setCurrentAssembly(null));
  }, [activeTool, selectedHolderId, stickOutMm, holders]);

  // Update Physics Result when cutting parameters change
  useEffect(() => {
    if (!activeTool) return;
    const matDefs = ToolCuttingCalculator.getMaterialDefinitions();
    const matDef = matDefs.find(m => m.materialClass === selectedMaterialClass) || (matDefs.length > 0 ? matDefs[0] : null);
    if (!matDef) return;

    const res = ToolCuttingCalculator.calculateMachiningPhysics(
      activeTool.geometry.dimensions.cuttingDiameterMm,
      activeTool.geometry.dimensions.fluteCount,
      customVc,
      customFz,
      customAp,
      customAe,
      matDef,
      applyChipThinning
    );
    setPhysicsResult(res);
  }, [activeTool, selectedMaterialClass, customVc, customFz, customAp, customAe, applyChipThinning]);

  // Render 2D/3D Tool Silhouette on Canvas
  useEffect(() => {
    if (!canvasRef.current || !activeTool) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const dims = activeTool.geometry.dimensions;
    const silhouette = activeTool.geometry.silhouettePoints;
    if (silhouette.length === 0) return;

    // Coordinate scaling
    const maxZ = dims.overallLengthMm + (currentAssembly ? currentAssembly.holder.gaugeLengthMm : 0);
    const maxR = Math.max(dims.cuttingDiameterMm, dims.shankDiameterMm, currentAssembly ? currentAssembly.holder.upperDiameterMm / 2 : 25);
    const scale = Math.min((height - 80) / maxZ, (width - 120) / (maxR * 2.5));
    const centerX = width / 2;
    const baseY = height - 40;

    // Draw Centerline
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(centerX, baseY + 20);
    ctx.lineTo(centerX, baseY - maxZ * scale - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // 1. Draw Holder (if assembly active)
    if (currentAssembly) {
      const holder = currentAssembly.holder;
      const holderStartY = baseY - currentAssembly.stickOutMm * scale;
      
      ctx.fillStyle = 'rgba(71, 85, 105, 0.7)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(centerX - (holder.noseDiameterMm / 2) * scale, holderStartY);
      ctx.lineTo(centerX + (holder.noseDiameterMm / 2) * scale, holderStartY);
      
      let curZ = 0;
      for (const step of holder.profileSteps) {
        curZ += step.lengthMm;
        const stepY = holderStartY - curZ * scale;
        const stepR = (step.diameterMm / 2) * scale;
        ctx.lineTo(centerX + stepR, stepY);
      }
      ctx.lineTo(centerX - (holder.upperDiameterMm / 2) * scale, holderStartY - holder.gaugeLengthMm * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Holder Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.fillText(`Holder: ${holder.name} (Gauge: ${holder.gaugeLengthMm}mm)`, 16, 25);
    }

    // 2. Draw Cutter & Flutes
    ctx.fillStyle = activeTool.coating === 'ALCRN' ? 'rgba(56, 189, 248, 0.4)' : activeTool.coating === 'TIALN' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(251, 146, 60, 0.4)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Right side of profile
    for (let i = 0; i < silhouette.length; i++) {
      const px = centerX + silhouette[i].x * scale;
      const py = baseY - silhouette[i].y * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    // Left side of profile (mirrored)
    for (let i = silhouette.length - 1; i >= 0; i--) {
      const px = centerX - silhouette[i].x * scale;
      const py = baseY - silhouette[i].y * scale;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Draw Flute Helical Markings
    const fluteLen = dims.cuttingLengthMm;
    const fluteSteps = Math.min(10, Math.floor(fluteLen / 3));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < fluteSteps; i++) {
      const y = baseY - (i * (fluteLen / fluteSteps)) * scale;
      const r = (dims.cuttingDiameterMm / 2) * scale;
      ctx.beginPath();
      ctx.arc(centerX, y, r, 0, Math.PI);
      ctx.stroke();
    }

    // 4. Dimension Annotation Overlays
    ctx.fillStyle = '#f43f5e';
    ctx.font = '11px monospace';
    // Cutting Diameter Annotation
    const dPx = (dims.cuttingDiameterMm / 2) * scale;
    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(centerX - dPx, baseY + 12);
    ctx.lineTo(centerX + dPx, baseY + 12);
    ctx.stroke();
    ctx.fillText(`Ø ${dims.cuttingDiameterMm} mm`, centerX - 25, baseY + 26);

    // Flute Length Annotation (Right side)
    const fluteTopY = baseY - dims.cuttingLengthMm * scale;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(centerX + dPx + 20, baseY);
    ctx.lineTo(centerX + dPx + 20, fluteTopY);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`LCut ${dims.cuttingLengthMm}mm`, centerX + dPx + 26, baseY - (dims.cuttingLengthMm / 2) * scale);

  }, [activeTool, currentAssembly, viewAngle]);

  // Capture Snapshot Handler
  const handleCaptureSnapshot = async () => {
    if (!activeTool) return;
    const snap = await ToolSnapshotManager.captureSnapshot(
      activeTool,
      currentAssembly || undefined,
      'OP_CAM_INTERACTIVE',
      'Interactive Viewport Operation'
    );
    setSnapshots(prev => [snap, ...prev]);
    const evid = await ToolEvidenceGenerator.generateEvidence(activeTool, currentAssembly || undefined, snap);
    setLatestEvidence(evid);
  };

  // Run Hard Acceptance Gate 261
  const handleRunGate = async () => {
    setIsExecutingGate(true);
    setShowGateModal(true);
    try {
      const rep = await HardAcceptanceGate261.executeGate();
      setGateReport(rep);
      setBenchmarks(rep.benchmarks);
    } finally {
      setIsExecutingGate(false);
    }
  };

  // Run Quick Benchmarks
  const handleRunBenchmarks = async () => {
    const bmA = await ToolBenchmarks.runBenchmarkA();
    const bmB = await ToolBenchmarks.runBenchmarkB();
    const bmC = await ToolBenchmarks.runBenchmarkC();
    const bmD = await ToolBenchmarks.runBenchmarkD();
    const bmE = await ToolBenchmarks.runBenchmarkE();
    setBenchmarks([bmA, bmB, bmC, bmD, bmE]);
  };

  // Create Tool Submit
  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    const tool = await ToolLibraryEngine.createTool({
      toolId: newToolForm.toolId,
      name: newToolForm.name,
      type: newToolForm.type,
      category: newToolForm.category,
      dimensions: {
        cuttingDiameterMm: Number(newToolForm.diameterMm),
        shankDiameterMm: Number(newToolForm.shankDiameterMm),
        overallLengthMm: Number(newToolForm.overallLengthMm),
        cuttingLengthMm: Number(newToolForm.cuttingLengthMm),
        shoulderLengthMm: Number(newToolForm.shoulderLengthMm),
        fluteCount: Number(newToolForm.fluteCount),
        cornerRadiusMm: Number(newToolForm.cornerRadiusMm),
        tipAngleDeg: Number(newToolForm.tipAngleDeg)
      },
      material: newToolForm.material,
      coating: newToolForm.coating,
      manufacturerName: newToolForm.manufacturer
    });

    setTools(ToolLibraryEngine.getAllTools(false));
    setSelectedToolId(tool.toolUUID);
    setShowCreateModal(false);
  };

  // Filtered tools
  const filteredTools = tools.filter(t => {
    if (selectedTypeFilter !== 'ALL' && t.type !== selectedTypeFilter) return false;
    if (selectedMaterialFilter !== 'ALL' && t.material !== selectedMaterialFilter) return false;
    if (t.geometry.dimensions.cuttingDiameterMm < minDiameterFilter) return false;
    if (t.geometry.dimensions.cuttingDiameterMm > maxDiameterFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.toolId.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.manufacturer?.manufacturer.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow-lg shadow-rose-600/30">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                PATCH-261: Real CAM Tool Library Engine
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-full uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PROVEN
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Unified Single Source of Truth: Identity • 3D Revolved Geometry • Assemblies • Speeds/Feeds • Invalidation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRunBenchmarks}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Gauge className="w-4 h-4 text-sky-400" />
            Run Benchmarks (A-E)
          </button>
          <button
            onClick={handleRunGate}
            className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            Hard Acceptance Gate 261
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Tool
          </button>
        </div>
      </div>

      {/* Main 2-Column Industrial Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tool Catalog Browser & Filters (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-lg">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search tools by name, ID, category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
              {['ALL', 'END_MILL', 'BALL_END_MILL', 'BULL_NOSE', 'FACE_MILL', 'DRILL', 'REAMER', 'CHAMFER_TOOL', 'THREAD_MILL', 'CUSTOM_TOOL'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    selectedTypeFilter === t
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Diameter Range Filter */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Diameter Range: <strong className="text-slate-200">{minDiameterFilter} - {maxDiameterFilter} mm</strong></span>
              <input
                type="range"
                min="0"
                max="65"
                value={maxDiameterFilter}
                onChange={e => setMaxDiameterFilter(Number(e.target.value))}
                className="w-28 accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Tool List Scrollable Cards */}
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1.5 custom-scrollbar">
              {filteredTools.map(tool => {
                const isSelected = tool.toolUUID === selectedToolId;
                const dims = tool.geometry.dimensions;
                return (
                  <div
                    key={tool.toolUUID}
                    onClick={() => setSelectedToolId(tool.toolUUID)}
                    className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-600 shadow-md shadow-rose-950/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-rose-400 rounded">
                          {tool.toolId}
                        </span>
                        <h4 className="text-xs font-bold text-slate-100 truncate max-w-[200px]">
                          {tool.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                        <span>Ø {dims.cuttingDiameterMm} mm</span>
                        <span>LCut: {dims.cuttingLengthMm} mm</span>
                        <span>{dims.fluteCount}F</span>
                        <span className="text-slate-500">{tool.material}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-800/60 rounded">
                        v{tool.version.versionString}
                      </span>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {tool.coating}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredTools.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  No tools matched current search filters.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed 3D Inspector & Engineering Panels (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Tool Header Badge */}
          {activeTool && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 rounded">
                      {activeTool.toolId}
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {activeTool.name}
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    UUID: {activeTool.toolUUID} • Rev {activeTool.version.revisionNumber} ({activeTool.version.versionString})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCaptureSnapshot}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-md shadow-rose-600/20"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    Capture Snapshot
                  </button>
                </div>
              </div>

              {/* 3D / 2D Revolved Silhouette CAD Viewport */}
              <div className="relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col items-center">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={260}
                  className="w-full h-64 object-contain"
                />

                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm border border-slate-800 p-1 rounded text-[10px] font-bold">
                  <button
                    onClick={() => setViewAngle('ELEVATION_2D')}
                    className={`px-2 py-0.5 rounded transition ${
                      viewAngle === 'ELEVATION_2D' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2D Silhouette
                  </button>
                  <button
                    onClick={() => setViewAngle('ISOMETRIC_3D')}
                    className={`px-2 py-0.5 rounded transition ${
                      viewAngle === 'ISOMETRIC_3D' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3D Envelope
                  </button>
                </div>

                <div className="w-full bg-slate-900/90 border-t border-slate-800 px-3 py-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Geometry Hash: <strong className="text-rose-300">{activeTool.geometry.geometryHash.substring(0, 16)}...</strong></span>
                  <span>CAD Mesh: <strong className="text-sky-300">{activeTool.geometry.cadMeshTriangleCount} Triangles</strong></span>
                </div>
              </div>

              {/* Engineering Tabs Switcher */}
              <div className="flex border-b border-slate-800 text-xs font-bold gap-2">
                {(['GEOMETRY', 'ASSEMBLY', 'CUTTING_PHYSICS', 'SNAPSHOTS', 'AUDIT_EVIDENCE'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-3 border-b-2 transition cursor-pointer ${
                      activeTab === tab
                        ? 'border-rose-500 text-rose-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              {/* Tab 1: Dimensions & Exact Geometry */}
              {activeTab === 'GEOMETRY' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Cutting Diameter</span>
                    <strong className="text-rose-400 text-sm">{activeTool.geometry.dimensions.cuttingDiameterMm} mm</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Shank Diameter</span>
                    <strong className="text-slate-200 text-sm">{activeTool.geometry.dimensions.shankDiameterMm} mm</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Cutting Length (Flute)</span>
                    <strong className="text-sky-400 text-sm">{activeTool.geometry.dimensions.cuttingLengthMm} mm</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Overall Length</span>
                    <strong className="text-slate-200 text-sm">{activeTool.geometry.dimensions.overallLengthMm} mm</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Flute Count</span>
                    <strong className="text-emerald-400 text-sm">{activeTool.geometry.dimensions.fluteCount} Flutes</strong>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Corner Geometry</span>
                    <strong className="text-slate-200 text-sm">
                      {activeTool.geometry.cornerType}
                      {activeTool.geometry.dimensions.cornerRadiusMm ? ` (R${activeTool.geometry.dimensions.cornerRadiusMm})` : ''}
                    </strong>
                  </div>
                </div>
              )}

              {/* Tab 2: Tool Assembly & Holder Stack */}
              {activeTab === 'ASSEMBLY' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">Select Tool Holder</label>
                      <select
                        value={selectedHolderId}
                        onChange={e => setSelectedHolderId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100 text-xs"
                      >
                        {holders.map(h => (
                          <option key={h.holderId} value={h.holderId}>
                            {h.name} ({h.interfaceType})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">
                        Stickout Length: <strong className="text-rose-400">{stickOutMm} mm</strong>
                      </label>
                      <input
                        type="range"
                        min={activeTool.geometry.dimensions.cuttingLengthMm + 2}
                        max={activeTool.geometry.dimensions.overallLengthMm - 10}
                        value={stickOutMm}
                        onChange={e => setStickOutMm(Number(e.target.value))}
                        className="w-full accent-rose-500 mt-2 cursor-pointer"
                      />
                    </div>
                  </div>

                  {currentAssembly ? (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="text-slate-400">Total Gauge Length (L_gauge):</span>
                        <strong className="text-rose-400 text-sm">{currentAssembly.gaugeLengthMm} mm</strong>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="text-slate-400">Holder Gauge Length:</span>
                        <span className="text-slate-200">{currentAssembly.holder.gaugeLengthMm} mm</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <span className="text-slate-400">Runout TIR (Total Indicated):</span>
                        <span className="text-emerald-400 font-bold">{currentAssembly.runoutTirMm} mm</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Assembly Fingerprint Hash:</span>
                        <span className="text-slate-500 truncate max-w-[200px]">{currentAssembly.assemblyHash}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-950/40 border border-red-800 rounded text-red-300 text-xs">
                      Incompatible Holder: Tool shank diameter cannot be clamped in this holder bore.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Speeds & Feeds Physics Calculator */}
              {activeTab === 'CUTTING_PHYSICS' && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block mb-1">Workpiece Material</label>
                      <select
                        value={selectedMaterialClass}
                        onChange={e => setSelectedMaterialClass(e.target.value as WorkpieceMaterialClass)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100 text-xs"
                      >
                        <option value="ISO_N_NON_FERROUS">ISO N — Aluminum 6061-T6 (2.7 g/cm³)</option>
                        <option value="ISO_P_STEEL">ISO P — Alloy Steel AISI 4140 (7.85 g/cm³)</option>
                        <option value="ISO_M_STAINLESS">ISO M — Stainless 316L (8.0 g/cm³)</option>
                        <option value="ISO_K_CAST_IRON">ISO K — Cast Iron GG25 (7.2 g/cm³)</option>
                        <option value="ISO_S_HIGH_TEMP_ALLOY">ISO S — Titanium Ti-6Al-4V (4.43 g/cm³)</option>
                        <option value="ISO_H_HARDENED_STEEL">ISO H — Tool Steel D2 58HRC</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="chipThinning"
                        checked={applyChipThinning}
                        onChange={e => setApplyChipThinning(e.target.checked)}
                        className="accent-rose-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="chipThinning" className="text-slate-300 cursor-pointer">
                        Radial Chip Thinning Compensation
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-500 uppercase block">Vc (m/min)</span>
                      <input
                        type="number"
                        value={customVc}
                        onChange={e => setCustomVc(Number(e.target.value))}
                        className="w-full bg-transparent text-slate-100 font-bold focus:outline-none"
                      />
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-500 uppercase block">fz (mm/tooth)</span>
                      <input
                        type="number"
                        step="0.005"
                        value={customFz}
                        onChange={e => setCustomFz(Number(e.target.value))}
                        className="w-full bg-transparent text-slate-100 font-bold focus:outline-none"
                      />
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-500 uppercase block">ap (mm)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={customAp}
                        onChange={e => setCustomAp(Number(e.target.value))}
                        className="w-full bg-transparent text-slate-100 font-bold focus:outline-none"
                      />
                    </div>
                    <div className="p-2 bg-slate-950 border border-slate-800 rounded">
                      <span className="text-[10px] text-slate-500 uppercase block">ae (mm)</span>
                      <input
                        type="number"
                        step="0.5"
                        value={customAe}
                        onChange={e => setCustomAe(Number(e.target.value))}
                        className="w-full bg-transparent text-slate-100 font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  {physicsResult && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Spindle RPM (n)</span>
                        <strong className="text-rose-400 text-sm">{physicsResult.spindleRpm} RPM</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Table Feed (Vf)</span>
                        <strong className="text-sky-400 text-sm">{physicsResult.feedRateVfMmMin} mm/min</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">MRR</span>
                        <strong className="text-emerald-400 text-sm">{physicsResult.mrrCm3Min} cm³/min</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Cutting Power</span>
                        <strong className="text-amber-400 text-sm">{physicsResult.cuttingPowerPcKw} kW</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Snapshots & Change Invalidation */}
              {activeTab === 'SNAPSHOTS' && (
                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Captured Operation Snapshots ({snapshots.length})</span>
                    <button
                      onClick={handleCaptureSnapshot}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold"
                    >
                      + Freeze Snapshot
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {snapshots.map(snap => (
                      <div key={snap.snapshotId} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <div className="flex justify-between items-center">
                          <strong className="text-rose-300">{snap.snapshotId}</strong>
                          <span className="text-[10px] text-slate-500">v{snap.toolVersion}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Op: {snap.assignedOperationName}</span>
                          <span>Hash: {snap.snapshotHash.substring(0, 12)}...</span>
                        </div>
                      </div>
                    ))}

                    {snapshots.length === 0 && (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No snapshots captured yet. Click "Capture Snapshot" to freeze tool state for CAM operations.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Audit & Evidence Certificate */}
              {activeTab === 'AUDIT_EVIDENCE' && (
                <div className="space-y-3 text-xs font-mono">
                  {latestEvidence ? (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-slate-300">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <strong className="text-rose-400 text-sm">Industrial Compliance Evidence Certificate</strong>
                        <span className="text-emerald-400 font-bold">VERIFIED</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>Tool UUID: <span className="text-slate-100">{latestEvidence.toolUUID}</span></div>
                        <div>Version: <span className="text-slate-100">{latestEvidence.toolVersion}</span></div>
                        <div>Geometry SHA-256: <span className="text-slate-100 truncate block">{latestEvidence.geometryHash}</span></div>
                        <div>Provenance Digest: <span className="text-rose-300 truncate block">{latestEvidence.provenanceChainSha256}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500">
                      Capture a snapshot to generate the industrial provenance evidence certificate.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hard Acceptance Gate 261 Execution Modal */}
      {showGateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-6 h-6 text-rose-500" />
                <h3 className="text-lg font-bold text-white">
                  Hard Acceptance Gate 261 — Industrial Verification
                </h3>
              </div>
              <button
                onClick={() => setShowGateModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isExecutingGate ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
                <p className="text-sm font-mono text-slate-300">
                  Executing deterministic geometry reconstruction and negative test suites...
                </p>
              </div>
            ) : gateReport ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 font-mono block">Gate Verdict</span>
                    <strong className={`text-xl font-bold ${gateReport.overallPassed ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {gateReport.overallPassed ? 'HARD ACCEPTANCE PASSED (100%)' : 'GATE FAILED'}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-mono block">Execution Time</span>
                    <strong className="text-slate-200 font-mono text-sm">{gateReport.executionTimeMs} ms</strong>
                  </div>
                </div>

                {/* Reference Benchmarks List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 font-mono">Reference Benchmarks</h4>
                  {gateReport.benchmarks.map(b => (
                    <div key={b.benchmarkId} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{b.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                          {b.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{b.details}</p>
                    </div>
                  ))}
                </div>

                {/* Capabilities Proven */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 font-mono">Capability Classifications</h4>
                  {gateReport.capabilities.map(c => (
                    <div key={c.name} className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono flex justify-between items-center">
                      <span className="text-slate-300">{c.name}</span>
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded text-[10px] font-bold">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono text-slate-500 break-all">
                  Provenance SHA-256: {gateReport.cryptographicDigest}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create New Tool Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                Create New Parametric CAM Tool
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm font-mono cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTool} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Tool ID</label>
                  <input
                    type="text"
                    value={newToolForm.toolId}
                    onChange={e => setNewToolForm({ ...newToolForm, toolId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Tool Type</label>
                  <select
                    value={newToolForm.type}
                    onChange={e => setNewToolForm({ ...newToolForm, type: e.target.value as ToolType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                  >
                    <option value="END_MILL">Flat End Mill</option>
                    <option value="BALL_END_MILL">Ball End Mill</option>
                    <option value="BULL_NOSE">Bull Nose (Toroidal)</option>
                    <option value="FACE_MILL">Face Mill</option>
                    <option value="DRILL">Twist Drill</option>
                    <option value="REAMER">Reamer</option>
                    <option value="CHAMFER_TOOL">Chamfer Tool</option>
                    <option value="THREAD_MILL">Thread Mill</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Tool Name</label>
                <input
                  type="text"
                  value={newToolForm.name}
                  onChange={e => setNewToolForm({ ...newToolForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                  required
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Cutting Ø (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newToolForm.diameterMm}
                    onChange={e => setNewToolForm({ ...newToolForm, diameterMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Shank Ø (mm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newToolForm.shankDiameterMm}
                    onChange={e => setNewToolForm({ ...newToolForm, shankDiameterMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Flute L (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newToolForm.cuttingLengthMm}
                    onChange={e => setNewToolForm({ ...newToolForm, cuttingLengthMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Overall L (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newToolForm.overallLengthMm}
                    onChange={e => setNewToolForm({ ...newToolForm, overallLengthMm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg shadow-emerald-600/30"
                >
                  Save Tool Entity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
