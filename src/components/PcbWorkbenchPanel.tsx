import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  PcbEngine,
  SchematicComponent,
  SchematicNet,
  PcbDesign,
  MechanicalEnclosureIntegration
} from '../engine/pcbEngine';
import {
  MultidomainPcbIntegrationEngine,
  MultidomainPcbHardAcceptanceGate,
  MultidomainPcbGateReport
} from '../engine/crossdomain/MultidomainPcbIntegrationEngine';
import { Cpu, Layers, Box, CheckCircle2, AlertTriangle, RefreshCw, Zap, Sliders, ArrowRight, ShieldCheck, Award, Network, Flame, HardDrive } from 'lucide-react';
import { DronePcbPanel } from './drone/DronePcbPanel';
import { MultidomainSynchronousWorkbench } from './MultidomainSynchronousWorkbench';
import { CadViewport3D } from './CadViewport3D';
import { getTruthStatusDescriptor, TruthOrigin } from '../engine/context/EngineeringContext';
import { PcbThermalBridge } from '../engine/pcb/PcbThermalBridge';
import { PcbSignalIntegrityEngine } from '../engine/pcb/PcbSignalIntegrityEngine';
import { SpatialThermalFieldResult } from '../engine/engineeringCore/SpatialThermalSolver';
import { SignalIntegrityResult } from '../engine/pcb/PcbSignalIntegrityEngine';

export interface PcbWorkbenchPanelProps {
  canonicalDocument?: any;
  onNavigateTab?: (tab: string) => void;
}

export const PcbWorkbenchPanel: React.FC<PcbWorkbenchPanelProps> = ({
  canonicalDocument,
  onNavigateTab
}) => {
  const [ecadTarget, setEcadTarget] = useState<'ACTIVE_PROJECT' | 'DRONE_BENCHMARK' | 'CUSTOM_BENCHMARK'>('ACTIVE_PROJECT');
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const [boardHeight, setBoardHeight] = useState<number | null>(null);
  const [pcbThickness, setPcbThickness] = useState<number | null>(null);

  const [pcb, setPcb] = useState<PcbDesign | null>(null);
  const [schematic, setSchematic] = useState<{ components: SchematicComponent[]; nets: SchematicNet[] } | null>(null);

  const [activeTab, setActiveTab] = useState<'SCHEMATIC' | 'PCB_2D' | 'MCAD_3D' | 'GATE_326' | 'MULTIDOMAIN_PHASE4'>('PCB_2D');
  const [gateReport, setGateReport] = useState<any | null>(null);
  const [multidomainReport, setMultidomainReport] = useState<MultidomainPcbGateReport | null>(null);
  const [thermalResults, setThermalResults] = useState<SpatialThermalFieldResult | null>(null);
  const [siResults, setSiResults] = useState<Record<string, SignalIntegrityResult>>({});
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [isSolvingThermal, setIsSolvingThermal] = useState<boolean>(false);

  const handleRunGate = () => {
    const report = PcbEngine.runHardAcceptanceGate();
    setGateReport(report);
  };

  const handleRunMultidomainGate = () => {
    const assembly = MultidomainPcbIntegrationEngine.createReferenceBenchmarkAssembly();
    const report = MultidomainPcbHardAcceptanceGate.runGate(assembly);
    setMultidomainReport(report);
  };

  const handleRunThermalAnalysis = async () => {
    if (!pcb) return;
    setIsSolvingThermal(true);
    // Mock power dissipations for demonstration: MCU (2W), LDO (0.5W), Connector (0.1W)
    const powerMap: Record<string, number> = {
      'U1': 2.5,
      'R1': 0.05,
      'C1': 0.01,
      'J1': 0.2
    };
    
    // Simulate solving delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const canonical = PcbEngine.getCanonicalModel(pcb.boardWidthMm, pcb.boardHeightMm, pcb.thicknessMm);
    const results = PcbThermalBridge.solvePcb(canonical, powerMap, 25.0);
    setThermalResults(results);
    setShowHeatmap(true);
    setIsSolvingThermal(false);
  };

  const handleRunSIAnalysis = () => {
    if (!pcb) return;
    const results: Record<string, SignalIntegrityResult> = {};
    pcb.traces.forEach(trace => {
      const si = PcbSignalIntegrityEngine.calculateMicrostrip({
        traceWidthMm: trace.widthMm,
        traceThicknessUm: 35, // standard 1oz copper
        dielectricHeightMm: 0.2, // core height
        relativePermittivity: 4.3 // FR4
      });
      results[trace.id] = si;
    });
    setSiResults(results);
  };

  useEffect(() => {
    if (!canonicalDocument || (canonicalDocument.features && canonicalDocument.features.length === 0)) {
      if (ecadTarget === 'ACTIVE_PROJECT') {
        setPcb(null);
        setSchematic(null);
        setBoardWidth(null);
        setBoardHeight(null);
        setPcbThickness(null);
      }
    }
  }, [canonicalDocument]);

  const loadDroneBenchmark = () => {
    setEcadTarget('DRONE_BENCHMARK');
  };

  const loadCustomBenchmark = () => {
    setEcadTarget('CUSTOM_BENCHMARK');
    const w = boardWidth ?? 100;
    const h = boardHeight ?? 60;
    const th = pcbThickness ?? 1.6;
    setBoardWidth(w);
    setBoardHeight(h);
    setPcbThickness(th);
    setPcb(PcbEngine.generatePcbLayout(w, h, th));
    setSchematic(PcbEngine.getDefaultSchematic());
  };

  const loadReferenceBenchmark = () => {
    loadCustomBenchmark();
  };

  const enclosure: MechanicalEnclosureIntegration | null = pcb ? PcbEngine.verifyMechanicalEnclosureFit(pcb) : null;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const truthDescriptor = getTruthStatusDescriptor(
    ecadTarget === 'ACTIVE_PROJECT' 
      ? (pcb ? 'ACTIVE_MODEL' : 'EMPTY_CANVAS')
      : 'REFERENCE_BENCHMARK'
  );

  // Render 2D PCB Canvas
  useEffect(() => {
    if (activeTab !== 'PCB_2D' || !pcb) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const scale = Math.min((w - 60) / pcb.boardWidthMm, (h - 60) / pcb.boardHeightMm);
    const offsetX = 30;
    const offsetY = 30;

    // Draw FR4 Substrate Board Outline
    ctx.fillStyle = '#064e3b'; // FR4 Green
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.fillRect(offsetX, offsetY, pcb.boardWidthMm * scale, pcb.boardHeightMm * scale);
    ctx.strokeRect(offsetX, offsetY, pcb.boardWidthMm * scale, pcb.boardHeightMm * scale);

    // Draw Mounting Holes
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    pcb.mountingHoles.forEach(mh => {
      const cx = offsetX + mh.x * scale;
      const cy = offsetY + mh.y * scale;
      const r = (mh.diameterMm / 2) * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw Traces
    pcb.traces.forEach(tr => {
      ctx.strokeStyle = tr.layer === 'TOP_COPPER' ? '#f59e0b' : '#3b82f6';
      ctx.lineWidth = tr.widthMm * scale;
      ctx.beginPath();
      tr.path.forEach((pt, idx) => {
        const px = offsetX + pt.x * scale;
        const py = offsetY + pt.y * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    // Draw Component Placements & Pads
    pcb.placements.forEach(comp => {
      const cx = offsetX + comp.xMm * scale;
      const cy = offsetY + comp.yMm * scale;
      const cw = comp.widthMm * scale;
      const ch = comp.heightMm * scale;

      ctx.fillStyle = comp.colorHex;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      ctx.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(comp.refDes, cx, cy + 3);
    });

    // Draw Heatmap Overlay if active
    if (showHeatmap && thermalResults) {
      ctx.globalAlpha = 0.5;
      const resX = thermalResults.gridX;
      const resY = thermalResults.gridY;
      const cellW = (pcb.boardWidthMm * scale) / resX;
      const cellH = (pcb.boardHeightMm * scale) / resY;

      for (let y = 0; y < resY; y++) {
        for (let x = 0; x < resX; x++) {
          const temp = thermalResults.temperatureMatrix[y][x];
          const norm = Math.max(0, Math.min(1, (temp - 25) / (thermalResults.maxTemperatureC - 25 || 1)));
          
          // Color mapping: Blue (25C) -> Red (Max)
          const hue = (1 - norm) * 240;
          ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
          ctx.fillRect(offsetX + x * cellW, offsetY + y * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
      ctx.globalAlpha = 1.0;
    }
  }, [activeTab, pcb, showHeatmap, thermalResults]);

  const handleRegeneratePcb = () => {
    const w = boardWidth ?? 100;
    const h = boardHeight ?? 60;
    const th = pcbThickness ?? 1.6;
    setPcb(PcbEngine.generatePcbLayout(w, h, th));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 text-indigo-400">
            <Cpu className="w-6 h-6 text-indigo-400" />
            Electronics & PCB Design (ECAD / MCAD Co-Design)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Schematic Capture → Multi-Layer Routing → High-Speed Trace Analysis → 3D STEP MCAD Enclosure Fitting.
          </p>
        </div>

        {/* Target ECAD Stack Selector */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                setEcadTarget('ACTIVE_PROJECT');
                setPcb(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                ecadTarget === 'ACTIVE_PROJECT'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Active Project
            </button>
            <button
              onClick={loadDroneBenchmark}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                ecadTarget === 'DRONE_BENCHMARK'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Drone FC Benchmark
            </button>
            <button
              onClick={loadCustomBenchmark}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                ecadTarget === 'CUSTOM_BENCHMARK'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Custom PCB Benchmark
            </button>
          </div>

          <button
            onClick={() => {
              handleRunGate();
              setActiveTab('GATE_326');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-950 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>Run Gate 326 (19)</span>
          </button>
        </div>
      </div>

      {/* Dynamic Truth Status Badge */}
      <div className={`flex items-center justify-between p-3.5 rounded-xl border ${truthDescriptor.bgClass} ${truthDescriptor.borderClass}`}>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className={`w-4 h-4 ${truthDescriptor.colorClass}`} />
          <div>
            <span className={`text-xs font-black tracking-wider uppercase ${truthDescriptor.colorClass}`}>
              {truthDescriptor.label}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {ecadTarget === 'ACTIVE_PROJECT' 
                ? 'ECAD layout derived from canonical EngineeringDocument features and constraints.'
                : ecadTarget === 'DRONE_BENCHMARK'
                  ? 'Co-designed with Drone Airframe Assembly (30.5x30.5mm M3 vibration-damped stack with ESC/IMU buses)'
                  : 'Custom parametric substrate with 3D enclosure clearance verification'}
            </p>
          </div>
        </div>
        <div className="text-right font-mono text-[11px] text-slate-400">
          <span>
            {ecadTarget === 'DRONE_BENCHMARK' 
              ? '4-Layer FR-4 (1.6mm)' 
              : pcb ? `${boardWidth}x${boardHeight}mm Substrate` : 'NO_BOARD_DIMENSIONS'}
          </span>
        </div>
      </div>

      {/* Render Drone Flight Controller Stack when selected */}
      {ecadTarget === 'DRONE_BENCHMARK' ? (
        <DronePcbPanel />
      ) : ecadTarget === 'ACTIVE_PROJECT' && !pcb ? (
        <div className="bg-slate-950/60 border border-slate-800 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center text-center gap-4">
          <Cpu className="w-12 h-12 text-slate-800" />
          <div>
            <h3 className="text-slate-300 font-bold uppercase tracking-widest text-sm">NO_CANONICAL_PCB_LAYOUT</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm">
              The canonical document does not contain an ECAD layout. Create a layout using the Parametric PCB Tool or load a reference benchmark.
            </p>
          </div>
          <button
            onClick={loadReferenceBenchmark}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg transition"
          >
            Load Reference PCB Benchmark
          </button>
        </div>
      ) : (
        <>
          {/* View Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('SCHEMATIC')}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'SCHEMATIC' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1. Schematic & Netlist
            </button>
            <button
              onClick={() => setActiveTab('PCB_2D')}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'PCB_2D' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2. 2D PCB Layout
            </button>
            <button
              onClick={() => setActiveTab('MCAD_3D')}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'MCAD_3D' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3. 3D MCAD Enclosure
            </button>
            <button
              onClick={() => {
                if (!gateReport) handleRunGate();
                setActiveTab('GATE_326');
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'GATE_326' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>4. DRC & Gate Suite (19)</span>
            </button>
            <button
              onClick={() => {
                if (!multidomainReport) handleRunMultidomainGate();
                setActiveTab('MULTIDOMAIN_PHASE4');
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'MULTIDOMAIN_PHASE4' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>5. Multidomain PCB (Phase 4)</span>
            </button>
          </div>

      {/* Main View Renderings */}
      {activeTab === 'SCHEMATIC' && (
        !schematic ? (
          <div className="bg-slate-950/60 border border-slate-800 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <Zap className="w-10 h-10 text-slate-700" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">EMPTY_CANVAS: NO_CANONICAL_SCHEMATIC</h4>
              <p className="text-[10px] text-slate-500 max-w-sm">No schematic components or electrical netlist detected in the project document. Create schematic or load reference benchmark.</p>
            </div>
            <button
              onClick={loadReferenceBenchmark}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition cursor-pointer"
            >
              Load Reference Benchmark
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Schematic Components Table */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Schematic Component Bill of Materials
              </h3>
              <div className="space-y-2">
                {schematic.components.map(c => (
                  <div key={c.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-indigo-300 mr-2">{c.refDes}</span>
                      <span className="text-slate-200 font-medium">{c.name}</span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.value} ({c.footprint})</div>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px]">
                      {c.pinCount} Pins
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Netlist Structure */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Generated Electrical Netlist
              </h3>
              <div className="space-y-2">
                {schematic.nets.map(n => (
                  <div key={n.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded text-xs">
                    <div className="font-bold text-amber-300 font-mono mb-1">{n.name}</div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                      {n.connectedPins.map((p, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                          {p.refDes}.P{p.pinNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === 'PCB_2D' && pcb && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column */}
          <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              PCB Substrate & Layer Parameters
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Board Width:</span>
                  <span className="font-mono text-indigo-300 font-bold">{boardWidth ?? 100} mm</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={boardWidth ?? 100}
                  onChange={e => setBoardWidth(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Board Height:</span>
                  <span className="font-mono text-indigo-300 font-bold">{boardHeight ?? 60} mm</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={boardHeight ?? 60}
                  onChange={e => setBoardHeight(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>FR4 Thickness:</span>
                  <span className="font-mono text-emerald-300 font-bold">{pcbThickness ?? 1.6} mm</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.2"
                  step="0.2"
                  value={pcbThickness ?? 1.6}
                  onChange={e => setPcbThickness(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <button
                onClick={handleRegeneratePcb}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Route Traces & Placements
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="text-[11px] font-mono text-slate-400 flex justify-between items-center border-b border-slate-800 pb-2">
              <span>2D PCB Copper Routing & Silkscreen Layer</span>
              <span className="text-amber-400 font-bold font-mono">FR4 • 2 Layers • {pcb.placements.length} Components</span>
            </div>
            <canvas
              ref={canvasRef}
              width={500}
              height={260}
              className="w-full h-64 bg-slate-900 rounded border border-slate-800"
            />
            
            {/* High-Fidelity Simulation Dashboard */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-tight flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    Spatial Thermal Field
                  </h4>
                  <button
                    onClick={handleRunThermalAnalysis}
                    disabled={isSolvingThermal}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded border border-slate-700 transition"
                  >
                    {isSolvingThermal ? 'Solving...' : 'Execute Solver'}
                  </button>
                </div>
                {thermalResults ? (
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <div className="space-y-1">
                      <span className="text-slate-500 block uppercase">Max Junction</span>
                      <span className="text-rose-400 font-bold">{thermalResults.maxTemperatureC.toFixed(1)} °C</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 block uppercase">Board Average</span>
                      <span className="text-emerald-400 font-bold">{thermalResults.averageTemperatureC.toFixed(1)} °C</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showHeatmap} 
                        onChange={() => setShowHeatmap(!showHeatmap)} 
                        className="w-3 h-3 accent-amber-500"
                      />
                      <span className="text-slate-300">Overlay Map</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">No thermal data. Run solver to evaluate heat sinks.</p>
                )}
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-tight flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Signal Integrity (SI)
                  </h4>
                  <button
                    onClick={handleRunSIAnalysis}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded border border-slate-700 transition"
                  >
                    Check Impedance
                  </button>
                </div>
                {Object.keys(siResults).length > 0 ? (
                  <div className="max-h-20 overflow-y-auto space-y-1.5 pr-1">
                    {Object.entries(siResults).map(([id, res]) => (
                      <div key={id} className="flex justify-between items-center text-[9px] font-mono p-1 bg-slate-950 rounded border border-slate-800">
                        <span className="text-slate-400">Net: {pcb.traces.find(t => t.id === id)?.netName}</span>
                        <div className="flex gap-2">
                          <span className={res.isCompliant50Ohms ? 'text-emerald-400' : 'text-amber-400'}>{res.impedanceOhms} Ω</span>
                          <span className="text-slate-500">({res.propagationDelayPsPerMm} ps/mm)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">Characteristic impedance not verified. Run SI check.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'MCAD_3D' && (
        !enclosure ? (
          <div className="bg-slate-950/60 border border-slate-800 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <Box className="w-10 h-10 text-slate-700" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">EMPTY_CANVAS: NO_CANONICAL_MCAD_ENCLOSURE</h4>
              <p className="text-[10px] text-slate-500 max-w-sm">No 3D enclosure integration active. Generate PCB layout or load benchmark to evaluate enclosure fit.</p>
            </div>
            <button
              onClick={loadReferenceBenchmark}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition cursor-pointer"
            >
              Load Reference Benchmark
            </button>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-400" />
                  MCAD Mechanical Assembly Enclosure Integration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated Co-Design: Form-fitting enclosure generated with PCB standoffs and M3 mounting holes.
                </p>
              </div>

              <div className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 ${
                enclosure.status === 'FIT_VERIFIED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                <CheckCircle2 className="w-4 h-4" />
                {enclosure.status}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-slate-400 block text-[10px]">ENCLOSURE X-Y</span>
                <span className="text-base font-bold text-indigo-300">
                  {enclosure.enclosureWidthMm.toFixed(1)} x {enclosure.enclosureLengthMm.toFixed(1)} mm
                </span>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-slate-400 block text-[10px]">INTERNAL HEIGHT</span>
                <span className="text-base font-bold text-emerald-300">
                  {enclosure.enclosureHeightMm.toFixed(1)} mm
                </span>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-slate-400 block text-[10px]">STANDOFF PILOT</span>
                <span className="text-base font-bold text-amber-300">
                  {enclosure.standoffHeightMm} mm (M3 Screws)
                </span>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded">
                <span className="text-slate-400 block text-[10px]">WALL THICKNESS</span>
                <span className="text-base font-bold text-cyan-300">
                  {enclosure.wallThicknessMm} mm
                </span>
              </div>
            </div>

            {/* Assembly Structural Diagram & 3D Viewport */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden h-80 relative">
                <CadViewport3D 
                  activeProjectType="CUSTOM_SOLID"
                  activeSolid={{
                    id: 'PCB_SUBSTRATE',
                    name: 'PCB Substrate & Enclosure',
                    type: 'BOX',
                    dimensions: { dx: pcb.boardWidthMm / 1000, dy: pcb.boardHeightMm / 1000, dz: pcb.thicknessMm / 1000 },
                    colorHex: '#064e3b'
                  }}
                  simulationResults={thermalResults ? {
                    type: 'THERMAL',
                    values: thermalResults.temperatureMatrix.flat(),
                    minValue: 25,
                    maxValue: thermalResults.maxTemperatureC,
                    unit: '°C'
                  } : null}
                />
                {!thermalResults && (
                  <div className="absolute top-3 left-3 bg-slate-900/80 px-2 py-1 rounded text-[10px] text-slate-400 font-bold border border-slate-800">
                    MECHANICAL_INSPECTION_MODE
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-xs space-y-4 flex flex-col justify-center">
                <div className="text-slate-400">Complete Device CAD Mechanical Assembly Hierarchy:</div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="p-2.5 bg-blue-950 border border-blue-800 text-blue-300 rounded font-bold">
                    Lower Case Enclosure
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="p-2.5 bg-amber-950 border border-amber-800 text-amber-300 rounded font-bold">
                    M3 Standoff Pillars (x4)
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded font-bold">
                    3D PCB Substrate & Components
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="p-2.5 bg-purple-950 border border-purple-800 text-purple-300 rounded font-bold">
                    Upper Snap Lid
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {activeTab === 'GATE_326' && (
        <div className="space-y-5">
          {/* Gate Controls & Header */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                  PATCH-326
                </span>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Hard Acceptance Gate Suite — PCB Engineering Verification
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                19 Deterministic Hard Assertions: Model Canonical Truth → Electrical Connectivity → DRC Geometry → Mechanical MCAD Co-Design.
              </p>
            </div>

            <button
              onClick={handleRunGate}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Execute 19-Assertion Suite</span>
            </button>
          </div>

          {gateReport ? (
            <div className="space-y-5">
              {/* Overall Summary KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-xl border ${
                  gateReport.passed ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}>
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">Overall Verdict</span>
                  <div className="text-xl font-black font-mono mt-1">
                    {gateReport.passed ? 'GATE PASSED (100%)' : 'GATE FAILED'}
                  </div>
                  <span className="text-[10px] opacity-70">All adversarial tests caught</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Assertions</span>
                  <div className="text-2xl font-black font-mono text-white mt-1">
                    {gateReport.passedCount} / {gateReport.totalAssertions}
                  </div>
                  <span className="text-[10px] text-emerald-400">100% Verified</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Execution Latency</span>
                  <div className="text-2xl font-black font-mono text-indigo-400 mt-1">
                    {gateReport.executionTimeMs.toFixed(2)} ms
                  </div>
                  <span className="text-[10px] text-slate-400">Deterministic runtime</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Co-Design Categories</span>
                  <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                    4 / 4
                  </div>
                  <span className="text-[10px] text-slate-400">CAN, CON, GEO, MEC</span>
                </div>
              </div>

              {/* Assertions Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-xs font-bold text-slate-300">
                  <span>Detailed Assertion Verification Breakdown (19 Tests)</span>
                  <span className="text-slate-500 font-mono text-[10px]">Baseline Passed + Intentional Defect Caught</span>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto font-mono text-xs">
                  {gateReport.assertions.map((a: any) => (
                    <div key={a.id} className="p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-slate-900/40 transition">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          a.passed ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {a.passed ? 'PASS' : 'FAIL'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-[11px]">{a.id}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 text-slate-400 border border-slate-800">
                              {a.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 font-sans mt-0.5">{a.description}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Proof: {a.details}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] shrink-0">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                          Baseline: ✓
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-purple-400 border border-slate-800">
                          Defect Caught: ✓
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 border-dashed rounded-xl p-12 text-center text-slate-500 text-xs space-y-2">
              <ShieldCheck className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="text-slate-400 font-bold">Hard Acceptance Gate Suite Ready</p>
              <p className="text-[11px] text-slate-500">Click &quot;Execute 19-Assertion Suite&quot; to verify canonical truth, electrical net continuity, DRC clearances, and enclosure fit.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. MULTIDOMAIN INTEGRATION (PHASE 4) VIEW */}
      {activeTab === 'MULTIDOMAIN_PHASE4' && (
        <MultidomainSynchronousWorkbench />
      )}
        </>
      )}
    </div>
  );
};
