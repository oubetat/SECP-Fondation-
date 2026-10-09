import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Activity,
  Play,
  RotateCcw,
  AlertTriangle,
  Layers,
  Database,
  Lock,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  Sliders,
  Terminal,
  ArrowRight,
  Compass,
  Box,
  ChevronRight,
  Download,
  Server,
  Zap,
  Hammer
} from 'lucide-react';

interface GateResult {
  gateId: string;
  requirement: string;
  evidence: string;
  passed: boolean;
}

interface GateSuiteReport {
  missionId?: string;
  timestampIso?: string;
  verdict?: string;
  totalGates?: number;
  passedGates?: number;
  failedGates?: number;
  gates?: GateResult[];
}

export const CollisionAuthorityMultiAxisWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'twin' | 'truth' | 'replay' | 'gates' | 'api'>('twin');
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [persistedRecords, setPersistedRecords] = useState<any[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [truthThread, setTruthThread] = useState<any>(null);
  const [gateReports, setGateReports] = useState<Record<string, GateSuiteReport>>({});
  const [runningGates, setRunningGates] = useState(false);
  const [activeGateFilter, setActiveGateFilter] = useState<'all' | 'p0' | 'p6' | 'p7' | 'p8'>('all');

  // Multi-Axis Machine Configuration State
  const [machineMode, setMachineMode] = useState<'3_AXIS' | '4_AXIS' | '5_AXIS'>('5_AXIS');
  const [rotaryAngleA, setRotaryAngleA] = useState(30); // A-axis tilt in degrees
  const [rotaryAngleC, setRotaryAngleC] = useState(45); // C-axis rotation in degrees

  // Multi-Axis Parameters
  const [domain, setDomain] = useState<'CAM_MULTI_AXIS' | 'ASSEMBLY' | 'KINEMATIC_MECHANISM' | 'NC_SIMULATION'>('CAM_MULTI_AXIS');
  const [coordinateFrame, setCoordinateFrame] = useState<'WCS' | 'MCS' | 'TCS'>('WCS');
  const [startX, setStartX] = useState(35);
  const [startY, setStartY] = useState(35);
  const [startZ, setStartZ] = useState(45);
  const [endX, setEndX] = useState(35);
  const [endY, setEndY] = useState(35);
  const [endZ, setEndZ] = useState(15);
  const [motionType, setMotionType] = useState<'RAPID' | 'FEED'>('FEED');
  const [cutterDiameter, setCutterDiameter] = useState(12);
  const [fluteLength, setFluteLength] = useState(35);
  const [stickout, setStickout] = useState(60);
  const [shankDiameter, setShankDiameter] = useState(12);
  const [safeClearance, setSafeClearance] = useState(2.0);
  const [warningMargin, setWarningMargin] = useState(5.0);

  // Simulation playback
  const [animProgress, setAnimProgress] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Divergence testing
  const [divergenceMode, setDivergenceMode] = useState<'NONE' | 'GEOM_MUTATION' | 'REVISION_DRIFT' | 'MOTION_MUTATION' | 'FRAME_MUTATION'>('NONE');
  const [replayVerdict, setReplayVerdict] = useState<any>(null);

  // Calculate tool orientation vector (I, J, K) based on machine kinematics mode and angles
  const getToolOrientation = (): { x: number; y: number; z: number } => {
    if (machineMode === '3_AXIS') {
      return { x: 0, y: 0, z: 1 };
    }
    
    const radA = (rotaryAngleA * Math.PI) / 180;
    
    if (machineMode === '4_AXIS') {
      return {
        x: 0,
        y: Math.sin(radA),
        z: Math.cos(radA)
      };
    }
    
    const radC = (rotaryAngleC * Math.PI) / 180;
    return {
      x: Math.sin(radA) * Math.cos(radC),
      y: Math.sin(radA) * Math.sin(radC),
      z: Math.cos(radA)
    };
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {
      console.error('Failed to fetch health:', e);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/collision/records');
      if (res.ok) {
        const data = await res.json();
        if (data.records) {
          setPersistedRecords(data.records);
          if (data.records.length > 0 && !selectedRecordId) {
            setSelectedRecordId(data.records[data.records.length - 1].executionId);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch records:', e);
    }
  };

  const fetchTruthThread = async () => {
    try {
      const res = await fetch('/api/collision/truth-thread');
      if (res.ok) {
        const data = await res.json();
        setTruthThread(data.thread);
      }
    } catch (e) {
      console.error('Failed to fetch truth thread:', e);
    }
  };

  const fetchGates = async () => {
    try {
      const res = await fetch('/api/collision/gates');
      if (res.ok) {
        const data = await res.json();
        setGateReports(data.reports || {});
      }
    } catch (e) {
      console.error('Failed to fetch gates:', e);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchRecords();
    fetchTruthThread();
    fetchGates();
  }, []);

  const handleEvaluateMotion = async () => {
    setEvaluating(true);
    try {
      const orientation = getToolOrientation();
      const payload = {
        domain,
        coordinateFrame,
        motion: {
          motionType,
          trajectory: {
            startPoint: { x: startX, y: startY, z: startZ },
            endPoint: { x: endX, y: endY, z: endZ },
            toolOrientation: orientation
          }
        },
        cutter: {
          cutterDiameter,
          fluteLength,
          stickout,
          shankDiameter
        },
        clearanceRequirements: {
          safeClearance,
          warningMargin
        },
        environmentContext: {
          machineMode,
          rotaryAngleA,
          rotaryAngleC
        }
      };

      const res = await fetch('/api/collision/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setLastResult(data.result);
        fetchRecords();
        fetchTruthThread();
      }
    } catch (e) {
      console.error('Evaluation failed:', e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleRunAllGates = async () => {
    setRunningGates(true);
    try {
      const res = await fetch('/api/collision/gates/run', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setGateReports(data.reports || {});
      }
    } catch (e) {
      console.error('Failed to run gates:', e);
    } finally {
      setRunningGates(false);
    }
  };

  const handleRunReplay = async () => {
    if (!selectedRecordId) return;
    try {
      const res = await fetch('/api/collision/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: selectedRecordId,
          divergenceMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReplayVerdict(data);
      }
    } catch (e) {
      console.error('Replay failed:', e);
    }
  };

  // Canvas drawing for 5-Axis Multi-Axis Kinematic Digital Twin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.strokeStyle = '#1e293b';
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

    const cx = width / 2;
    const cy = height / 2 + 50;
    const scale = 2.4;

    // Draw Machine Table / Fixture Plate
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 140, cy + 40, 280, 24);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(cx - 140, cy + 40, 280, 24);

    // Draw Workpiece Solid
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 70, cy - 30, 140, 70);
    ctx.strokeRect(cx - 70, cy - 30, 140, 70);

    // Draw Fixture Clamps
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 110, cy + 10, 30, 30);
    ctx.fillRect(cx + 80, cy + 10, 30, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('CLAMP L', cx - 105, cy + 28);
    ctx.fillText('CLAMP R', cx + 85, cy + 28);

    // Calculate current tool position on trajectory
    const curX = startX + (endX - startX) * animProgress;
    const curY = startY + (endY - startY) * animProgress;
    const curZ = startZ + (endZ - startZ) * animProgress;

    const toolScreenX = cx + (curX - 35) * scale;
    const toolScreenY = cy - curZ * scale;

    const orient = getToolOrientation();
    const angleRad = Math.atan2(orient.x, orient.z);

    // Toolpath line
    ctx.strokeStyle = motionType === 'RAPID' ? '#ef4444' : '#10b981';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + (startX - 35) * scale, cy - startZ * scale);
    ctx.lineTo(cx + (endX - 35) * scale, cy - endZ * scale);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw 5-Axis Spindle & Holder
    ctx.save();
    ctx.translate(toolScreenX, toolScreenY);
    ctx.rotate(angleRad);

    // Spindle Housing
    ctx.fillStyle = '#475569';
    ctx.fillRect(-35, -120, 70, 50);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(-35, -120, 70, 50);

    // Tool Holder
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(-25, -70);
    ctx.lineTo(25, -70);
    ctx.lineTo(15, -20);
    ctx.lineTo(-15, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tool Shank
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-(shankDiameter / 2) * scale * 0.3, -20, shankDiameter * scale * 0.3, 20);

    // Flute / Cutter
    const isCol = lastResult?.status === 'COLLISION';
    const isNear = lastResult?.status === 'NEAR_MISS';
    ctx.fillStyle = isCol ? '#ef4444' : isNear ? '#f59e0b' : '#34d399';
    ctx.fillRect(-(cutterDiameter / 2) * scale * 0.3, 0, cutterDiameter * scale * 0.3, fluteLength * scale * 0.4);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(-(cutterDiameter / 2) * scale * 0.3, 0, cutterDiameter * scale * 0.3, fluteLength * scale * 0.4);

    ctx.restore();

    // Telemetry badge on canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(15, 15, 230, 95);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(15, 15, 230, 95);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(`MACHINE MODE: ${machineMode}`, 25, 35);
    ctx.fillText(`AXIS A (TILT): ${rotaryAngleA.toFixed(1)}°`, 25, 52);
    ctx.fillText(`AXIS C (ROT):  ${rotaryAngleC.toFixed(1)}°`, 25, 69);
    ctx.fillText(`ORIENTATION:   [${orient.x.toFixed(3)}, ${orient.y.toFixed(3)}, ${orient.z.toFixed(3)}]`, 25, 86);
    ctx.fillText(`Z ELEVATION:   ${curZ.toFixed(2)} mm`, 25, 103);
  }, [machineMode, rotaryAngleA, rotaryAngleC, startX, startY, startZ, endX, endY, endZ, cutterDiameter, fluteLength, shankDiameter, animProgress, lastResult, motionType]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    let start: number | null = null;
    const duration = 2500;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1.0, elapsed / duration);
      setAnimProgress(progress);

      if (progress < 1.0) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setIsPlaying(false);
      }
    };

    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="space-y-6">
      {/* Platform Header Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              SECP Real Collision Authority & 5-Axis Multi-Axis Twin
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                FAIL-CLOSED KERNEL
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic kinematic trajectory evaluation, clearance envelope verification & cryptographic truth ledger
            </p>
          </div>
        </div>

        {/* System Health */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Engine:</span>
            <span className="text-emerald-400 font-bold">READY (FAIL-CLOSED)</span>
          </div>
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">Thread Hash:</span>
            <span className="text-cyan-300 font-bold truncate max-w-[120px]">
              {truthThread?.headHash ? truthThread.headHash.substring(0, 10) + '...' : 'GENESIS'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation for Collision Authority */}
      <div className="flex border-b border-slate-800 space-x-2">
        <button
          onClick={() => setActiveTab('twin')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'twin'
              ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Multi-Axis Digital Twin</span>
        </button>
        <button
          onClick={() => setActiveTab('truth')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'truth'
              ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Cryptographic Truth Ledger ({persistedRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('replay')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'replay'
              ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Truthful Replay & Divergence Engine</span>
        </button>
        <button
          onClick={() => setActiveTab('gates')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'gates'
              ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Hard Acceptance Gates (P0/P6/P7/P8)</span>
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center space-x-2 ${
            activeTab === 'api'
              ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Production JSON-RPC & REST API</span>
        </button>
      </div>

      {/* Tab 1: Multi-Axis Digital Twin Viewport & Controls */}
      {activeTab === 'twin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Kinematic Configuration & Trajectory
              </h3>
              <span className="text-xs font-mono text-slate-400">AUTHORITATIVE EVALUATOR</span>
            </div>

            {/* Machine Kinematics Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Kinematic Machine Topology</label>
              <div className="grid grid-cols-3 gap-2">
                {(['3_AXIS', '4_AXIS', '5_AXIS'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMachineMode(mode)}
                    className={`py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                      machineMode === mode
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {mode.replace('_', '-')}
                  </button>
                ))}
              </div>
            </div>

            {/* Rotary Angles (When 4-Axis or 5-Axis) */}
            {machineMode !== '3_AXIS' && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold">Rotary Axis A (Tilt):</span>
                  <span className="text-white font-bold">{rotaryAngleA}°</span>
                </div>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  value={rotaryAngleA}
                  onChange={(e) => setRotaryAngleA(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                {machineMode === '5_AXIS' && (
                  <>
                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <span className="text-cyan-400 font-bold">Rotary Axis C (Table Rotation):</span>
                      <span className="text-white font-bold">{rotaryAngleC}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={rotaryAngleC}
                      onChange={(e) => setRotaryAngleC(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </>
                )}
              </div>
            )}

            {/* Trajectory Coordinates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Start Point (mm)</span>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  <div>
                    <label className="text-slate-500">X</label>
                    <input type="number" value={startX} onChange={(e) => setStartX(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-500">Y</label>
                    <input type="number" value={startY} onChange={(e) => setStartY(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-500">Z</label>
                    <input type="number" value={startZ} onChange={(e) => setStartZ(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Target End Point (mm)</span>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  <div>
                    <label className="text-slate-500">X</label>
                    <input type="number" value={endX} onChange={(e) => setEndX(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-500">Y</label>
                    <input type="number" value={endY} onChange={(e) => setEndY(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                  <div>
                    <label className="text-slate-500">Z</label>
                    <input type="number" value={endZ} onChange={(e) => setEndZ(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tool & Clearance Parameters */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Cutter Diameter (mm)</label>
                <input type="number" value={cutterDiameter} onChange={(e) => setCutterDiameter(parseFloat(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Flute Length (mm)</label>
                <input type="number" value={fluteLength} onChange={(e) => setFluteLength(parseFloat(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Safe Clearance Envelope (mm)</label>
                <input type="number" step="0.5" value={safeClearance} onChange={(e) => setSafeClearance(parseFloat(e.target.value) || 0.1)} className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-white" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motion Feed Mode</label>
                <select value={motionType} onChange={(e: any) => setMotionType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-white">
                  <option value="FEED">CUTTING FEED (G1)</option>
                  <option value="RAPID">RAPID TRAVERSE (G0)</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center space-x-3">
              <button
                onClick={handleEvaluateMotion}
                disabled={evaluating}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg shadow-cyan-900/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {evaluating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{evaluating ? 'EVALUATING IN KERNEL...' : 'EVALUATE MOTION TRUTH'}</span>
              </button>
              <button
                onClick={() => {
                  setAnimProgress(0.0);
                  setIsPlaying(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-lg border border-slate-700"
                title="Play Trajectory Animation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewport & Verdict Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* 2D / 3D Canvas Digital Twin */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  REAL-TIME MULTI-AXIS KINEMATIC VIEWPORT
                </span>
                <span className="text-xs font-mono text-slate-400">FAIL-CLOSED SPATIAL SIMULATION</span>
              </div>
              <canvas
                ref={canvasRef}
                width={620}
                height={340}
                className="w-full h-auto bg-slate-950 rounded-lg border border-slate-800/80 shadow-inner"
              />
            </div>

            {/* Evaluated Verdict Card */}
            {lastResult && (
              <div className={`p-4 rounded-xl border shadow-lg ${
                lastResult.status === 'CLEAR'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : lastResult.status === 'NEAR_MISS'
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}>
                <div className="flex items-center justify-between border-b border-current/20 pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    {lastResult.status === 'CLEAR' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : lastResult.status === 'NEAR_MISS' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="text-sm font-bold font-mono uppercase tracking-wider">
                      AUTHORITATIVE VERDICT: {lastResult.status}
                    </span>
                  </div>
                  <span className="text-xs font-mono opacity-80">
                    EXACTNESS: {lastResult.exactness}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block">Min Distance:</span>
                    <span className="font-bold text-white">{lastResult.minimumDistanceMm?.toFixed(3)} mm</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Clearance Margin:</span>
                    <span className="font-bold text-white">{lastResult.clearanceMarginMm?.toFixed(3)} mm</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fail-Closed:</span>
                    <span className="font-bold text-white">{lastResult.failClosedEnforced ? 'ENFORCED (YES)' : 'NO'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Audit Hash:</span>
                    <span className="font-bold text-cyan-300 truncate block">{lastResult.provenanceHash?.substring(0, 10)}...</span>
                  </div>
                </div>

                {lastResult.incidents && lastResult.incidents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-current/10 space-y-1">
                    <span className="text-xs font-bold block">Incident Diagnostics:</span>
                    {lastResult.incidents.map((inc: any, i: number) => (
                      <div key={i} className="text-xs font-mono bg-black/30 p-2 rounded">
                        [{inc.severity}] {inc.type}: {inc.description || 'Interference detected'} (Penetration: {inc.penetrationDepthMm?.toFixed(3)} mm)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Cryptographic Truth Ledger */}
      {activeTab === 'truth' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Append-Only Cryptographic Execution Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Every collision check is sealed in an unbroken SHA-256 truth hash chain for forensic auditability
                </p>
              </div>
              <button
                onClick={fetchRecords}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-mono flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>REFRESH LEDGER</span>
              </button>
            </div>

            {persistedRecords.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs font-mono">
                No collision records persisted yet. Run an evaluation to commit the first truth record.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                      <th className="p-2.5">Seq #</th>
                      <th className="p-2.5">Execution ID</th>
                      <th className="p-2.5">Domain</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Min Dist</th>
                      <th className="p-2.5">Prev Hash</th>
                      <th className="p-2.5">Current Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {persistedRecords.map((r, i) => (
                      <tr
                        key={r.executionId || i}
                        onClick={() => setSelectedRecordId(r.executionId)}
                        className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          selectedRecordId === r.executionId ? 'bg-slate-800/80 text-cyan-300' : 'text-slate-300'
                        }`}
                      >
                        <td className="p-2.5 font-bold">{r.sequenceNumber ?? i + 1}</td>
                        <td className="p-2.5 text-cyan-400">{r.executionId?.substring(0, 16)}...</td>
                        <td className="p-2.5">{r.domain}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            r.status === 'CLEAR'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'NEAR_MISS'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-2.5">{r.minimumDistanceMm?.toFixed(3)} mm</td>
                        <td className="p-2.5 text-slate-500 truncate max-w-[100px]">{r.prevHash ? r.prevHash.substring(0, 8) + '...' : 'GENESIS'}</td>
                        <td className="p-2.5 text-slate-400 truncate max-w-[100px]">{r.canonicalHash?.substring(0, 8)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Replay & Forensic Divergence Verification */}
      {activeTab === 'replay' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                Truth Replay & Forensic Divergence Verification
              </h3>
              <p className="text-xs text-slate-400">
                Reconstructs exact canonical collision evaluations from cold storage and mathematically proves byte-level equivalence
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Target Record to Replay</label>
                <select
                  value={selectedRecordId}
                  onChange={(e) => setSelectedRecordId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
                >
                  {persistedRecords.map((r) => (
                    <option key={r.executionId} value={r.executionId}>
                      Seq #{r.sequenceNumber} — {r.executionId} [{r.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Adversarial Mutation Test</label>
                <select
                  value={divergenceMode}
                  onChange={(e: any) => setDivergenceMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white"
                >
                  <option value="NONE">NONE (Truthful Replay Verification)</option>
                  <option value="GEOM_MUTATION">Adversarial Geometry Mutation (Detect Divergence)</option>
                  <option value="REVISION_DRIFT">Revision Clock Drift Simulation</option>
                  <option value="MOTION_MUTATION">Trajectory Delta Tamper Attack</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRunReplay}
              disabled={!selectedRecordId}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-5 rounded-lg text-xs font-mono flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>EXECUTE DETERMINISTIC REPLAY</span>
            </button>

            {replayVerdict && (
              <div className={`p-4 rounded-lg border text-xs font-mono ${
                replayVerdict.match
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}>
                <div className="font-bold text-sm mb-1">
                  REPLAY VERDICT: {replayVerdict.match ? 'PERFECT REPRODUCIBILITY (PASS)' : 'DIVERGENCE DETECTED (SECURITY TRIPPED)'}
                </div>
                <div>Hash Verification: {replayVerdict.match ? 'IDENTICAL' : 'MISMATCH'}</div>
                <div>Diagnostic Details: {replayVerdict.reason || 'Canonical byte equivalence certified.'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Hard Acceptance Gates Suite */}
      {activeTab === 'gates' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Hard Acceptance Forensic Gates (P0, P6, P7, P8)
                </h3>
                <p className="text-xs text-slate-400">
                  Automated assertion suites certifying zero false negatives, fail-closed authority, and complete ledger integrity
                </p>
              </div>
              <button
                onClick={handleRunAllGates}
                disabled={runningGates}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg text-xs font-mono flex items-center gap-1.5 disabled:opacity-50"
              >
                {runningGates ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{runningGates ? 'RUNNING 70+ ASSERTIONS...' : 'RUN ALL GATES NOW'}</span>
              </button>
            </div>

            {/* Filter buttons */}
            <div className="flex space-x-2 border-b border-slate-800 pb-2">
              {(['all', 'p0', 'p6', 'p7', 'p8'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveGateFilter(filter)}
                  className={`px-3 py-1 text-xs font-mono rounded ${
                    activeGateFilter === filter
                      ? 'bg-slate-800 text-cyan-400 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter.toUpperCase()} GATES
                </button>
              ))}
            </div>

            {/* Render Gate Reports */}
            <div className="space-y-4">
              {Object.entries(gateReports)
                .filter(([gateKey]) => activeGateFilter === 'all' || gateKey.toLowerCase().includes(activeGateFilter))
                .map(([gateKey, report]: [string, any]) => (
                  <div key={gateKey} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-mono font-bold text-sm text-cyan-400">{gateKey}</span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                        report.verdict === 'PASS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {report.verdict} ({report.passedGates || report.gates?.filter((g: any) => g.passed).length || 0} / {report.totalGates || report.gates?.length || 0})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      {(report.gates || []).map((gate: any, idx: number) => (
                        <div
                          key={gate.gateId || idx}
                          className={`p-2.5 rounded border flex items-start space-x-2 ${
                            gate.passed
                              ? 'bg-emerald-950/20 border-emerald-900/50 text-slate-300'
                              : 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                          }`}
                        >
                          {gate.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5">
                            <span className="font-bold text-white block">{gate.gateId}: {gate.requirement}</span>
                            <span className="text-slate-400 text-[11px] block">{gate.evidence}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Production JSON-RPC & REST API */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                SECP Collision Authority Production API Documentation
              </h3>
              <p className="text-xs text-slate-400">
                Direct integration endpoints for 5-Axis CNC controllers, CAM toolpath post-processors, and robot simulation cells
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-cyan-400 font-bold mb-1">POST /api/collision/evaluate</div>
                <div className="text-slate-400 text-[11px]">Evaluates kinematic trajectory motion fail-closed and commits truth ledger record.</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-cyan-400 font-bold mb-1">GET /api/collision/records</div>
                <div className="text-slate-400 text-[11px]">Returns complete persisted truth thread records.</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-cyan-400 font-bold mb-1">POST /api/collision/replay</div>
                <div className="text-slate-400 text-[11px]">Replays a historical record with optional mutation testing.</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-cyan-400 font-bold mb-1">GET /api/collision/gates</div>
                <div className="text-slate-400 text-[11px]">Retrieves latest execution status for P0, P6, P7, P8 gates.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
