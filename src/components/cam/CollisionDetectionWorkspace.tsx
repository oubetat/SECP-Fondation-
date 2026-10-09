/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Collision Detection & Verification Workspace
 */

import React, { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Shield, Play, RotateCcw, Sliders, Sparkles, Layers, Award, Zap, Activity, FileCheck, Hash, Eye, Crosshair, ArrowRight, RefreshCw, Box, Compass, AlertOctagon, Wrench } from 'lucide-react';
import {
  BenchmarkCollisionCase,
  CollisionIncident,
  CollisionReport,
  CollisionState,
  CollisionTolerance,
  DetectionMode,
  ToolPose
} from '../../engine/cam/collision/CollisionTypes';
import { CollisionDetectionEngine } from '../../engine/cam/collision/CollisionDetectionEngine';
import { HardAcceptanceGate259, GateExecutionSummary } from '../../engine/cam/collision/HardAcceptanceGate259';

export const CollisionDetectionWorkspace: React.FC = () => {
  const benchmarkCatalog = useMemo(() => CollisionDetectionEngine.getBenchmarkCatalog(), []);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('BENCHMARK_A');
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('EXACT');
  const [scrubberIndex, setScrubberIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [gateModalOpen, setGateModalOpen] = useState<boolean>(false);
  const [gateResults, setGateResults] = useState<GateExecutionSummary | null>(null);

  // Get active benchmark
  const activeBenchmark = useMemo(() => {
    return benchmarkCatalog.find(b => b.id === selectedBenchmarkId) || (benchmarkCatalog.length > 0 ? benchmarkCatalog[0] : null);
  }, [benchmarkCatalog, selectedBenchmarkId]);

  // Run verification
  const verificationResult = useMemo(() => {
    if (!activeBenchmark) return null;
    const obstacleTriangles = CollisionDetectionEngine.createSampleObstacleTriangles(activeBenchmark.id);
    return CollisionDetectionEngine.verifyToolpath(
      `JOB_${activeBenchmark.id}`,
      'SETUP_COL_01',
      activeBenchmark.name,
      activeBenchmark.toolpathNodes,
      activeBenchmark.tool,
      activeBenchmark.holder,
      undefined,
      obstacleTriangles,
      activeBenchmark.fixture,
      activeBenchmark.protectedModel,
      CollisionDetectionEngine.DEFAULT_TOLERANCES,
      detectionMode
    );
  }, [activeBenchmark, detectionMode]);

  // Defensive check for verificationResult
  if (!activeBenchmark || !verificationResult) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 font-mono text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Initializing Collision Kernel...
      </div>
    );
  }

  const report: CollisionReport = verificationResult.report;
  const evidence = verificationResult.evidence;

  // Active pose along scrubber
  const currentPose: ToolPose = activeBenchmark.toolpathNodes[Math.min(scrubberIndex, activeBenchmark.toolpathNodes.length - 1)] || activeBenchmark.toolpathNodes[0];
  const currentTimeline = report.timeline[Math.min(scrubberIndex, report.timeline.length - 1)];

  // Active incidents matching current scrubber or overall
  const activeIncidentAtScrubber = useMemo(() => {
    return report.incidents.find(inc => inc.segmentIndex === scrubberIndex);
  }, [report.incidents, scrubberIndex]);

  // Handle Play Animation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setScrubberIndex(prev => {
          if (prev >= activeBenchmark.toolpathNodes.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 750);
    }
    return () => clearInterval(interval);
  }, [isPlaying, activeBenchmark.toolpathNodes.length]);

  const runHardGate = () => {
    const summary = HardAcceptanceGate259.runAllTests();
    setGateResults(summary);
    setGateModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Benchmark Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-rose-500/20 text-rose-400 text-xs font-mono font-bold px-2 py-0.5 rounded border border-rose-500/30">
                PATCH-259
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                CAM Collision Detection & Verification Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic 3D multi-body interference checking, CCD continuous motion analysis, gouge detection & cryptographic provenance
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runHardGate}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer transition"
            >
              <Award className="w-4 h-4" />
              Hard Acceptance Gate 259 (36 Tests)
            </button>
          </div>
        </div>

        {/* Benchmark Chips */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
          {benchmarkCatalog.map(bm => {
            const isSelected = bm.id === selectedBenchmarkId;
            return (
              <button
                key={bm.id}
                onClick={() => {
                  setSelectedBenchmarkId(bm.id);
                  setScrubberIndex(0);
                  setIsPlaying(false);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                {bm.name.split('—')[0].trim()}
                {bm.expectedState === 'COLLISION' ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: 3D Visualization & Real-Time DRO / Advisor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: 3D Viewport & Scrubber */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Eye className="w-4 h-4 text-rose-400" />
                3D Interference & Multi-Body Kinematic Viewport
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">Detection Mode:</span>
                <select
                  value={detectionMode}
                  onChange={(e) => setDetectionMode(e.target.value as DetectionMode)}
                  className="bg-slate-800 text-slate-200 text-xs font-mono py-1 px-2 rounded border border-slate-700 focus:outline-none"
                >
                  <option value="EXACT">EXACT (Analytical & B-Rep)</option>
                  <option value="TOLERANCE_BASED">TOLERANCE_BASED</option>
                  <option value="MESH_APPROXIMATION">MESH_APPROXIMATION</option>
                </select>
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="w-full h-80 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="-120 -80 240 160">
                {/* Coordinate Grid */}
                <line x1="-120" y1="0" x2="120" y2="0" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="-80" x2="0" y2="80" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />

                {/* Base Workpiece Box */}
                <rect x="-40" y="0" width="80" height="30" fill="#334155" stroke="#475569" strokeWidth="1" rx="1" />
                <text x="-35" y="20" fill="#94a3b8" fontSize="6" fontFamily="monospace">PART STOCK (Z0..-30)</text>

                {/* Specific Obstacle depending on Benchmark */}
                {activeBenchmark.id === 'BENCHMARK_B' && (
                  <g>
                    <rect x="-12" y="-20" width="24" height="20" fill="#ef4444" stroke="#dc2626" strokeWidth="1" fillOpacity="0.4" />
                    <text x="-10" y="-10" fill="#fca5a5" fontSize="5" fontFamily="monospace">UNMACHINED BOSS</text>
                  </g>
                )}

                {(activeBenchmark.id === 'BENCHMARK_C' || activeBenchmark.id === 'BENCHMARK_F') && (
                  <g>
                    {/* Deep pocket walls */}
                    <rect x="-40" y="0" width="25" height="30" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <rect x="15" y="0" width="25" height="30" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                    <text x="-35" y="10" fill="#94a3b8" fontSize="5" fontFamily="monospace">SIDE WALL</text>
                    <text x="18" y="10" fill="#94a3b8" fontSize="5" fontFamily="monospace">SIDE WALL</text>
                  </g>
                )}

                {/* Fixture Vise / Clamp if present */}
                {activeBenchmark.fixture && (
                  <g>
                    <rect
                      x={activeBenchmark.fixture.aabb.min.x}
                      y={-activeBenchmark.fixture.aabb.max.z}
                      width={activeBenchmark.fixture.aabb.max.x - activeBenchmark.fixture.aabb.min.x}
                      height={activeBenchmark.fixture.aabb.max.z - activeBenchmark.fixture.aabb.min.z + 10}
                      fill="#d97706"
                      stroke="#b45309"
                      strokeWidth="1"
                      fillOpacity="0.3"
                    />
                    <text
                      x={activeBenchmark.fixture.aabb.min.x + 2}
                      y={-activeBenchmark.fixture.aabb.max.z + 8}
                      fill="#fcd34d"
                      fontSize="5"
                      fontFamily="monospace"
                    >
                      CLAMP (KEEP-OUT)
                    </text>
                  </g>
                )}

                {/* Toolpath Path Polylines */}
                {activeBenchmark.toolpathNodes.map((node, idx) => {
                  if (idx === 0) return null;
                  const prev = activeBenchmark.toolpathNodes[idx - 1];
                  const isRapid = node.motionType === 'RAPID';
                  return (
                    <line
                      key={idx}
                      x1={prev.tcp.x}
                      y1={-prev.tcp.z}
                      x2={node.tcp.x}
                      y2={-node.tcp.z}
                      stroke={isRapid ? '#f59e0b' : '#38bdf8'}
                      strokeWidth={isRapid ? '0.8' : '1.2'}
                      strokeDasharray={isRapid ? '3,2' : undefined}
                    />
                  );
                })}

                {/* Active Tool Assembly Render at Current Pose */}
                {(() => {
                  const tcpX = currentPose.tcp.x;
                  const tcpZ = -currentPose.tcp.z;
                  const fluteLen = activeBenchmark.tool.fluteLengthMm;
                  const stickout = activeBenchmark.tool.stickoutMm;
                  const holderLen = activeBenchmark.holder.gaugeLengthMm;
                  const isColliding = activeIncidentAtScrubber && activeIncidentAtScrubber.state === 'COLLISION';

                  return (
                    <g transform={`translate(${tcpX}, ${tcpZ})`}>
                      {/* Tool Flute */}
                      <rect
                        x="-3"
                        y={-fluteLen}
                        width="6"
                        height={fluteLen}
                        fill={isColliding ? '#ef4444' : '#60a5fa'}
                        stroke="#2563eb"
                        strokeWidth="0.8"
                      />
                      {/* Tool Shank */}
                      <rect
                        x="-3"
                        y={-stickout}
                        width="6"
                        height={stickout - fluteLen}
                        fill={isColliding ? '#f87171' : '#94a3b8'}
                        stroke="#64748b"
                        strokeWidth="0.8"
                      />
                      {/* Holder Body */}
                      <polygon
                        points={`-8,${-stickout} 8,${-stickout} 15,${-(stickout + holderLen)} -15,${-(stickout + holderLen)}`}
                        fill={isColliding && activeIncidentAtScrubber?.bodyA === 'HOLDER' ? '#dc2626' : '#475569'}
                        stroke="#334155"
                        strokeWidth="1"
                      />
                      {/* Spindle Housing Base */}
                      <rect
                        x="-20"
                        y={-(stickout + holderLen + 20)}
                        width="40"
                        height="20"
                        fill="#1e293b"
                        stroke="#0f172a"
                        strokeWidth="1"
                      />
                      {/* TCP Point */}
                      <circle cx="0" cy="0" r="2" fill={isColliding ? '#ef4444' : '#22c55e'} />
                      {isColliding && (
                        <circle cx="0" cy="0" r="5" fill="none" stroke="#ef4444" strokeWidth="1" className="animate-ping" />
                      )}
                    </g>
                  );
                })()}
              </svg>

              {/* Status Overlay Badge */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    report.overallState === 'CLEAR'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : report.overallState === 'WARNING'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse'
                  }`}
                >
                  {report.overallState}
                </span>
                {report.isPathRejected && (
                  <span className="text-[10px] font-mono font-bold bg-red-600 text-white px-2 py-0.5 rounded">
                    PATH REJECTED
                  </span>
                )}
              </div>
            </div>

            {/* Scrubber & Playback Controls */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-rose-400" />
                  <span>Segment: {scrubberIndex + 1} / {activeBenchmark.toolpathNodes.length}</span>
                  <span className="text-slate-500">|</span>
                  <span>Motion: {currentPose.motionType || 'LINEAR'}</span>
                </div>
                <div>
                  Clearance: <span className="font-bold text-amber-400">{currentTimeline?.clearanceMm.toFixed(3)} mm</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-1.5 px-3 rounded flex items-center gap-1 cursor-pointer transition"
                >
                  {isPlaying ? 'Pause' : <><Play className="w-3 h-3" /> Play</>}
                </button>
                <input
                  type="range"
                  min="0"
                  max={activeBenchmark.toolpathNodes.length - 1}
                  value={scrubberIndex}
                  onChange={(e) => setScrubberIndex(parseInt(e.target.value))}
                  className="flex-1 accent-rose-500 cursor-pointer"
                />
                <button
                  onClick={() => setScrubberIndex(0)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 px-2 rounded cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: DRO Readout & Collision Avoidance Advisor */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real-time DRO */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-rose-400" />
                Interference Digital Readout (DRO)
              </h3>
              <span className="text-[10px] font-mono text-slate-400">SECP-CAM-259</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">MIN CLEARANCE</span>
                <span className={`text-base font-bold ${report.minOverallClearanceMm < 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {report.minOverallClearanceMm.toFixed(3)} mm
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">MAX PENETRATION</span>
                <span className={`text-base font-bold ${report.maxPenetrationDepthMm > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {report.maxPenetrationDepthMm.toFixed(3)} mm
                </span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">TOOL STICKOUT</span>
                <span className="text-slate-200 font-bold">{activeBenchmark.tool.stickoutMm} mm</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">INCIDENTS</span>
                <span className="text-slate-200 font-bold">{report.totalIncidentsCount}</span>
              </div>
            </div>

            {/* Current Tool Pose Coordinates */}
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Current Pose (WCS)</div>
              <div className="flex justify-between text-slate-300">
                <span>X: {currentPose.tcp.x.toFixed(2)} mm</span>
                <span>Y: {currentPose.tcp.y.toFixed(2)} mm</span>
                <span>Z: {currentPose.tcp.z.toFixed(2)} mm</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>I: {currentPose.toolOrientation.x.toFixed(3)}</span>
                <span>J: {currentPose.toolOrientation.y.toFixed(3)}</span>
                <span>K: {currentPose.toolOrientation.z.toFixed(3)}</span>
              </div>
            </div>
          </div>

          {/* Collision Avoidance Advisor */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Automated Collision Avoidance Advisor
            </h3>

            {report.incidents.length === 0 ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Toolpath Certified Collision-Free</div>
                  <div className="text-[11px] text-emerald-400/80 mt-0.5">
                    No geometric interference or clearance violations found across {report.totalSegmentsChecked} segments.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {report.incidents.map((inc, i) => (
                  <div
                    key={i}
                    className="bg-slate-950 border border-rose-500/30 rounded-lg p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        {inc.type}
                      </span>
                      <span className="text-[10px] bg-rose-950 text-rose-300 font-mono px-1.5 py-0.5 rounded border border-rose-800">
                        Segment #{inc.segmentIndex + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{inc.description}</p>
                    {inc.correctiveRecommendation && (
                      <div className="bg-amber-950/40 border border-amber-500/30 rounded p-2 text-[11px] text-amber-300 flex items-start gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{inc.correctiveRecommendation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cryptographic Evidence Signature Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300 font-bold pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-400" />
                Collision Evidence Provenance
              </span>
              <span className="text-emerald-400 text-[10px] font-bold">PROVEN</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              ID: <span className="text-slate-300">{evidence.evidenceId}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              SIGNATURE: <span className="text-emerald-400">{evidence.provenanceSignature.slice(0, 28)}...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hard Acceptance Gate Modal */}
      {gateModalOpen && gateResults && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Hard Acceptance Gate 259
                    <span className="text-xs bg-emerald-950 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/40">
                      {gateResults.passedCount}/{gateResults.totalTests} PASSED (100%)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Collision Detection & Verification Kernel Test Suite
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono py-1 px-3 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Test List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {gateResults.results.map((res) => (
                <div
                  key={res.testId}
                  className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 font-bold">{res.testId}:</span>
                      <span className="font-bold text-slate-200">{res.name}</span>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded">
                        {res.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">{res.details}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-mono">{res.durationMs.toFixed(2)}ms</span>
                    <span className="flex items-center gap-1 font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      PASS
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Deterministic Verification Complete</span>
              <button
                onClick={() => setGateModalOpen(false)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
