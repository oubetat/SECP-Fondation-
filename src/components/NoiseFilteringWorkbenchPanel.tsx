/**
 * PHASE 29 — REVERSE ENGINEERING
 * PATCH-316 — Noise Filtering Workbench Panel
 * 
 * Interactive UI component for Point Cloud Noise Filtering, Before/After Split & Overlay Viewport,
 * Real-time Outlier Diagnostics, Statistical/Radius Outlier Parameters, Non-Destructive Branching,
 * Geometry Preservation Metrics, and Gate 316 Automated Verification.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Filter, CheckCircle2, AlertTriangle, XCircle, Eye, Layers, Activity, ShieldCheck, RotateCcw, Sparkles, CheckSquare, Search, Box, Split, Database } from 'lucide-react';
import { PointCloudImportService } from '../engine/reverse_engineering/point_cloud/PointCloudImportService';
import { PointCloudFilterEngine } from '../engine/reverse_engineering/filtering/PointCloudFilterEngine';
import { HardAcceptanceGate316, GateTestResult316 } from '../engine/reverse_engineering/filtering/HardAcceptanceGate316';
import { NativePointCloud, Point3D } from '../engine/reverse_engineering/point_cloud/PointCloudTypes315';
import { FilteredPointCloud, FilterType, FilterMode } from '../engine/reverse_engineering/filtering/PointCloudFilterTypes316';

export const NoiseFilteringWorkbenchPanel: React.FC = () => {
  const importService = PointCloudImportService.getInstance();
  const filterEngine = PointCloudFilterEngine.getInstance();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Datasets
  const [rawCloud, setRawCloud] = useState<NativePointCloud | null>(null);
  const [filteredCloud, setFilteredCloud] = useState<FilteredPointCloud | null>(null);

  // Filter Configuration
  const [algorithm, setAlgorithm] = useState<FilterType>('STATISTICAL_OUTLIER');
  const [filterMode, setFilterMode] = useState<FilterMode>('APPLY');
  const [kNeighbors, setKNeighbors] = useState<number>(10);
  const [stdDevMultiplier, setStdDevMultiplier] = useState<number>(1.2);
  const [searchRadiusMm, setSearchRadiusMm] = useState<number>(8.0);
  const [minNeighbors, setMinNeighbors] = useState<number>(4);
  const [voxelSizeMm, setVoxelSizeMm] = useState<number>(5.0);
  const [conservativeMode, setConservativeMode] = useState<boolean>(true);

  // Viewport Settings
  const [viewMode, setViewMode] = useState<'OVERLAY' | 'CLEAN_ONLY' | 'OUTLIERS_ONLY'>('OVERLAY');
  const [pointSize, setPointSize] = useState<number>(4);

  // Gate Results
  const [gateResults, setGateResults] = useState<{
    passed: boolean;
    totalAssertions: number;
    passedCount: number;
    failedCount: number;
    results: GateTestResult316[];
  } | null>(null);

  const [activeTab, setActiveTab] = useState<'VIEWPORT' | 'METRICS' | 'BRANCHES' | 'GATE_316'>('VIEWPORT');

  // Load Noisy Sample Dataset on Mount
  useEffect(() => {
    loadSampleDataset();
  }, []);

  const loadSampleDataset = () => {
    const noisyPLY = `ply
format ascii 1.0
element vertex 120
property float x
property float y
property float z
property float intensity
end_header
${Array.from({ length: 100 }).map((_, i) => {
  const angle = (i / 100) * Math.PI * 2;
  const radius = 25 + Math.sin(i * 0.2) * 3;
  const x = (Math.cos(angle) * radius).toFixed(3);
  const y = (Math.sin(angle) * radius).toFixed(3);
  const z = (i * 0.3).toFixed(3);
  return `${x} ${y} ${z} 150`;
}).join('\n')}
${Array.from({ length: 20 }).map((_, i) => {
  // Add 20 sparse deterministic noise outliers
  const pseudoRand = (seed: number) => {
    const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const x = ((pseudoRand(i * 3 + 1) - 0.5) * 180).toFixed(3);
  const y = ((pseudoRand(i * 3 + 2) - 0.5) * 180).toFixed(3);
  const z = ((pseudoRand(i * 3 + 3) - 0.5) * 180).toFixed(3);
  return `${x} ${y} ${z} 20`;
}).join('\n')}`;

    const raw = importService.importPointCloud(noisyPLY, 'turbine_scan_noisy.ply', 'PROJ-TURBINE-2026', 'REV-B-BASELINE');
    setRawCloud(raw);

    // Initial Filter Execution
    const initialFlt = filterEngine.filter(raw, {
      algorithm: 'STATISTICAL_OUTLIER',
      filterMode: 'APPLY',
      kNeighbors: 10,
      stdDevMultiplier: 1.2,
      conservativeMode: true,
      units: raw.units
    });
    setFilteredCloud(initialFlt);
  };

  // Render Viewport Canvas
  useEffect(() => {
    if (!canvasRef.current || !rawCloud) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 2.2;

    if (filteredCloud && viewMode !== 'CLEAN_ONLY') {
      // Draw Removed Outliers in Red/Amber
      filteredCloud.removedPoints.forEach(p => {
        const isoX = centerX + (p.x - p.y) * scale * 0.866;
        const isoY = centerY + (p.x + p.y) * scale * 0.5 - p.z * scale * 0.8;

        ctx.fillStyle = '#f43f5e'; // Bright Rose Red for Noise
        ctx.beginPath();
        ctx.arc(isoX, isoY, pointSize + 1, 0, Math.PI * 2);
        ctx.fill();

        // Draw halo ring around noise outlier
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(isoX, isoY, pointSize + 4, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    if (filteredCloud && viewMode !== 'OUTLIERS_ONLY') {
      // Draw Clean Retained Points in Sky Blue / Emerald
      filteredCloud.points.forEach(p => {
        const isoX = centerX + (p.x - p.y) * scale * 0.866;
        const isoY = centerY + (p.x + p.y) * scale * 0.5 - p.z * scale * 0.8;

        ctx.fillStyle = '#38bdf8'; // Sky Blue
        ctx.beginPath();
        ctx.arc(isoX, isoY, pointSize / 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [rawCloud, filteredCloud, viewMode, pointSize]);

  const handleApplyFilter = () => {
    if (!rawCloud) return;
    const flt = filterEngine.filter(rawCloud, {
      algorithm,
      filterMode,
      kNeighbors,
      stdDevMultiplier,
      searchRadiusMm,
      minNeighbors,
      voxelSizeMm,
      conservativeMode,
      units: rawCloud.units
    });
    setFilteredCloud(flt);
  };

  const handleRunGate316 = () => {
    const gate = new HardAcceptanceGate316();
    const res = gate.runAllAssertions();
    setGateResults(res);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Filter className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>PHASE 29 — Reverse Engineering</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-mono">
                PATCH-316
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic, Non-Destructive Noise Filtering Engine. <span className="text-emerald-400 font-mono">Raw Data Preserved as Ground Truth</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <button
            onClick={handleRunGate316}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md border border-emerald-400/30"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Run Gate 316 (20 Assertions)</span>
          </button>
        </div>
      </div>

      {/* Dataset Summary & Invariants */}
      {rawCloud && filteredCloud && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 text-xs font-mono">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">Raw Input: <strong className="text-slate-200">{filteredCloud.inputPointCount} pts</strong></span>
            <span className="text-slate-400">Clean Output: <strong className="text-sky-400">{filteredCloud.outputPointCount} pts</strong></span>
            <span className="text-slate-400">Noise Removed: <strong className="text-rose-400">{filteredCloud.removedPointCount} pts</strong></span>
            <span className="text-slate-400">Removal Ratio: <strong className="text-amber-300">{(filteredCloud.removalRatio * 100).toFixed(1)}%</strong></span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-indigo-300">
              Backend: {filteredCloud.provenance.executionBackend}
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300">
              Time: {filteredCloud.report.processingTimeMs} ms
            </span>
          </div>
        </div>
      )}

      {/* Aggressive Filter Warning Banner */}
      {filteredCloud?.report.isAggressiveFilter && (
        <div className="bg-amber-950/40 border border-amber-500/40 p-3 rounded-xl flex items-center space-x-3 text-amber-300 text-xs">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <span>
            <strong>Aggressive Filtering Alert (Rule 55):</strong> Removal ratio ({(filteredCloud.removalRatio * 100).toFixed(1)}%) exceeds safety threshold (30%). Verify that sharp edges or thin features were not removed.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('VIEWPORT')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'VIEWPORT' ? 'bg-slate-800 text-sky-400 border border-slate-700' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Split className="w-4 h-4" />
          <span>Before / After Viewport</span>
        </button>

        <button
          onClick={() => setActiveTab('METRICS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'METRICS' ? 'bg-slate-800 text-amber-400 border border-slate-700' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Filter Report & Preservation Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('BRANCHES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'BRANCHES' ? 'bg-slate-800 text-indigo-400 border border-slate-700' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Digital Thread & Provenance</span>
        </button>

        <button
          onClick={() => setActiveTab('GATE_316')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeTab === 'GATE_316' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:bg-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Acceptance Gate 316</span>
        </button>
      </div>

      {/* Tab 1: Viewport & Filter Parameter Controls */}
      {activeTab === 'VIEWPORT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Viewport Canvas */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-300 flex items-center space-x-2">
                <Box className="w-4 h-4 text-sky-400" />
                <span>Point Cloud Viewport (Noise Outliers in Red, Clean Points in Blue)</span>
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('OVERLAY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold ${viewMode === 'OVERLAY' ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
                >
                  Overlay All
                </button>
                <button
                  onClick={() => setViewMode('CLEAN_ONLY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold ${viewMode === 'CLEAN_ONLY' ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
                >
                  Clean Only
                </button>
                <button
                  onClick={() => setViewMode('OUTLIERS_ONLY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold ${viewMode === 'OUTLIERS_ONLY' ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'}`}
                >
                  Noise Outliers
                </button>
              </div>
            </div>

            <div className="relative w-full h-96 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              <canvas ref={canvasRef} width={600} height={380} className="w-full h-full object-contain" />

              {filteredCloud && (
                <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg text-[10px] font-mono space-y-1">
                  <div>Filter: <strong className="text-indigo-300">{filteredCloud.algorithm}</strong></div>
                  <div>Input: <strong className="text-slate-300">{filteredCloud.inputPointCount}</strong></div>
                  <div>Retained: <strong className="text-sky-300">{filteredCloud.outputPointCount}</strong></div>
                  <div>Removed: <strong className="text-rose-400">{filteredCloud.removedPointCount}</strong></div>
                </div>
              )}
            </div>
          </div>

          {/* Filter Parameters Form */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
              <h3 className="font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Filter Engine Parameters</span>
              </h3>

              {/* Algorithm Selection */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block font-medium">Algorithm:</label>
                <select
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value as FilterType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-sky-500"
                >
                  <option value="STATISTICAL_OUTLIER">Statistical Outlier Removal (SOR)</option>
                  <option value="RADIUS_OUTLIER">Radius Outlier Removal (ROR)</option>
                  <option value="SPATIAL_VOXEL">Spatial Voxel Downsampling</option>
                </select>
              </div>

              {/* Algorithm Specific Parameters */}
              {algorithm === 'STATISTICAL_OUTLIER' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-slate-300">
                      <span>k-Neighbors:</span>
                      <span className="font-mono text-sky-400">{kNeighbors}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="50"
                      value={kNeighbors}
                      onChange={(e) => setKNeighbors(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-500 bg-slate-950 mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300">
                      <span>StdDev Multiplier (α):</span>
                      <span className="font-mono text-amber-400">{stdDevMultiplier}</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={stdDevMultiplier}
                      onChange={(e) => setStdDevMultiplier(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 bg-slate-950 mt-1"
                    />
                  </div>
                </div>
              )}

              {algorithm === 'RADIUS_OUTLIER' && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-slate-300">
                      <span>Search Radius (R mm):</span>
                      <span className="font-mono text-indigo-400">{searchRadiusMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="30.0"
                      step="0.5"
                      value={searchRadiusMm}
                      onChange={(e) => setSearchRadiusMm(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 bg-slate-950 mt-1"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300">
                      <span>Min Neighbors (N):</span>
                      <span className="font-mono text-sky-400">{minNeighbors}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={minNeighbors}
                      onChange={(e) => setMinNeighbors(parseInt(e.target.value, 10))}
                      className="w-full accent-sky-500 bg-slate-950 mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Conservative Mode Safeguard */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">Conservative Safeguard (Rule 24)</span>
                  <span className="text-[10px] text-slate-400">Preserves UNCERTAIN borderline points to protect geometry</span>
                </div>
                <input
                  type="checkbox"
                  checked={conservativeMode}
                  onChange={(e) => setConservativeMode(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-sky-500 w-4 h-4"
                />
              </div>

              <button
                onClick={handleApplyFilter}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-md flex items-center justify-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Execute Filter (Derived Dataset)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Metrics */}
      {activeTab === 'METRICS' && filteredCloud && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <span>Statistical Report & Geometry Preservation Metrics</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Verifies zero data deformation, coordinate integrity, and statistical mean distributions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-sky-300">Statistical Noise Distribution</h4>
              <div>Global Mean Distance: <strong className="text-slate-200">{filteredCloud.report.globalMeanDistanceMm.toFixed(2)} mm</strong></div>
              <div>Global Standard Deviation: <strong className="text-slate-200">{filteredCloud.report.globalStdDevMm.toFixed(2)} mm</strong></div>
              <div>Processing Time: <strong className="text-emerald-400">{filteredCloud.report.processingTimeMs} ms</strong></div>
              <div>Backend Execution: <strong className="text-indigo-300">{filteredCloud.report.executionBackend}</strong></div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-amber-300">Geometry Preservation (Rule 57)</h4>
              <div>Bounds Diagonal Delta: <strong className="text-emerald-400">{filteredCloud.report.preservationMetrics.spatialBoundsDeltaMm.toFixed(2)} mm</strong></div>
              <div>Density Preservation Ratio: <strong className="text-sky-300">{(filteredCloud.report.preservationMetrics.densityRatio * 100).toFixed(1)}%</strong></div>
              <div>Geometry Preserved: <strong className="text-emerald-400">{filteredCloud.report.preservationMetrics.geometryPreserved ? 'YES (Valid)' : 'NO (Distorted)'}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Digital Thread */}
      {activeTab === 'BRANCHES' && filteredCloud && rawCloud && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 font-mono text-xs">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-sans">
            <Database className="w-5 h-5 text-indigo-400" />
            <span>Digital Thread & Provenance Chain (Rule 69 & 74)</span>
          </h3>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div>Original Scan: <strong className="text-slate-200">{rawCloud.scanId}</strong></div>
            <div>Raw Dataset ID: <strong className="text-sky-300">{rawCloud.pointCloudId}</strong> ({rawCloud.pointCount} points)</div>
            <div className="pl-6 border-l-2 border-indigo-500 space-y-1 my-2">
              <div className="text-indigo-400 font-bold">└─ Filter Execution Run: {filteredCloud.filterRunId}</div>
              <div>Derived Clean Dataset: <strong className="text-emerald-400">{filteredCloud.datasetId}</strong></div>
              <div>Settings Hash: <strong className="text-amber-300">{filteredCloud.provenance.settingsHash}</strong></div>
              <div>Output Integrity Hash: <strong className="text-slate-300">{filteredCloud.integrityHash}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Gate 316 */}
      {activeTab === 'GATE_316' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                <span>Hard Acceptance Gate 316 — Test Battery</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Verifies non-destructive filtering, raw immutability, SOR & ROR algorithms, Evidence Bus emission, and reproducibility.
              </p>
            </div>

            <button
              onClick={handleRunGate316}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors shadow-md"
            >
              Execute Gate 316 (20 Assertions)
            </button>
          </div>

          {gateResults && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                gateResults.passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                <div className="flex items-center space-x-3">
                  {gateResults.passed ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-rose-400" />}
                  <div>
                    <h4 className="font-bold text-sm">
                      Gate 316 Status: {gateResults.passed ? 'PASSED (100% Verification)' : 'FAILED'}
                    </h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Passed {gateResults.passedCount} of {gateResults.totalAssertions} assertions.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1.5 pr-2">
                {gateResults.results.map(res => (
                  <div key={res.assertionId} className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-slate-500 w-8">#{res.assertionId}</span>
                      <span className="text-slate-200">{res.description}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">{res.details}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        res.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {res.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
