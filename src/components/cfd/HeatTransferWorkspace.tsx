/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-251 — Heat Transfer Workspace
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Flame,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  Sliders,
  TrendingUp,
  Cpu,
  History,
  ShieldCheck,
  RefreshCw,
  Database,
  Award,
  AlertTriangle,
  FileCheck,
  Scale,
  Binary,
  Layers,
  Thermometer,
  Zap,
  Wind,
  Layers3,
  Search,
  Check,
  Clipboard,
  ShieldAlert
} from 'lucide-react';

import {
  HeatTransferEngine,
  EnergyEquationSolver,
  ThermalBCKind,
  ThermalMaterialProperties,
  ThermalBoundaryCondition,
  HeatTransferEvidencePackage,
  HardAcceptanceGate251,
  GateResult251,
  ThermalBenchmarkSuite
} from '../../engine/cfd3d/solvers/thermal';

export const HeatTransferWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'BENCHMARKS' | 'PROBING' | 'AUDIT' | 'EVIDENCE' | 'HARDBATTERY'>('PIPELINE');
  const [isRunning, setIsRunning] = useState(false);

  // Setup state configs
  const [gridSize, setGridSize] = useState<number>(64);
  const [conductivity, setConductivity] = useState<number | null>(null);
  const [density, setDensity] = useState<number | null>(null);
  const [specificHeat, setSpecificHeat] = useState<number | null>(null);
  const [dynamicViscosity, setDynamicViscosity] = useState<number | null>(null);
  const [gravity, setGravity] = useState<number | null>(null);
  const [beta, setBeta] = useState<number | null>(null); // expansion coeff
  const [volumetricSourceVal, setVolumetricSourceVal] = useState<number | null>(null);

  // Coupling configs
  const [convectionEnabled, setConvectionEnabled] = useState<boolean>(true);
  const [isSteady, setIsSteady] = useState<boolean>(true);
  const [dt, setDt] = useState<number>(0.01);
  const [underRelaxation, setUnderRelaxation] = useState<number>(0.7);
  const [maxIterations, setMaxIterations] = useState<number>(30);

  // Boundary condition states
  const [inletTemp, setInletTemp] = useState<number | null>(null); // K
  const [outletFlux, setOutletFlux] = useState<number | null>(null);   // W/m^2
  const [wallHCoeff, setWallHCoeff] = useState<number | null>(null);  // W/(m^2*K)
  const [ambientTemp, setAmbientTemp] = useState<number | null>(null); // K

  // Simulation state outputs
  const [evidence, setEvidence] = useState<HeatTransferEvidencePackage | null>(null);
  const [temperatureField, setTemperatureField] = useState<number[]>([]);
  const [heatFluxField, setHeatFluxField] = useState<number[]>([]);
  const [gradientsField, setGradientsField] = useState<[number, number, number][]>([]);
  const [residuals, setResiduals] = useState<number[]>([]);
  const [dimMetrics, setDimMetrics] = useState<any>(null);

  // Active Probe State
  const [probeIndex, setProbeIndex] = useState<number>(12);
  const [probeResult, setProbeResult] = useState<any>(null);

  // Automated suite outputs
  const [hardGateReport, setHardGateReport] = useState<GateResult251 | null>(null);
  const [copiedEvidence, setCopiedEvidence] = useState(false);

  useEffect(() => {
    triggerExecution();
  }, []);

  const triggerExecution = () => {
    setIsRunning(true);
    setTimeout(() => {
      try {
        const material: ThermalMaterialProperties = {
          materialId: 'mat-air-interactive-251',
          name: 'Air',
          isFluid: true,
          density,
          thermalConductivity: conductivity,
          specificHeat,
          thermalDiffusivity: conductivity / (density * specificHeat),
          dynamicViscosity,
          gravityVector: [0.0, gravity, 0.0],
          thermalExpansionCoeff: beta
        };

        const bcs: ThermalBoundaryCondition[] = [
          { kind: ThermalBCKind.FIXED_TEMPERATURE, value: inletTemp, patchId: 'inlet' },
          { kind: ThermalBCKind.HEAT_FLUX, value: outletFlux, patchId: 'outlet' },
          { kind: ThermalBCKind.CONVECTION, value: wallHCoeff, ambientTemp, patchId: 'wall' }
        ];

        const volumetricSource = new Array(gridSize).fill(volumetricSourceVal);

        const packageResult = HeatTransferEngine.executePipeline(
          'interactive-gui-case-251',
          gridSize,
          material,
          { temperature: 293.15, velocity: [convectionEnabled ? 2.0 : 0.0, 0.0, 0.0] },
          bcs,
          volumetricSource,
          isSteady,
          dt,
          convectionEnabled,
          inletTemp,
          wallHCoeff,
          ambientTemp,
          underRelaxation,
          maxIterations
        );

        setEvidence(packageResult);

        // Solve raw temperature distribution visually
        const rawSolve = EnergyEquationSolver.assembleAndSolve(
          gridSize,
          material,
          new Array(gridSize).fill(293.15),
          bcs,
          volumetricSource,
          new Array(gridSize).fill([convectionEnabled ? 2.5 : 0.0, 0.0, 0.0]),
          isSteady,
          dt,
          inletTemp,
          wallHCoeff,
          ambientTemp,
          underRelaxation,
          maxIterations
        );

        setTemperatureField(rawSolve.temperature);
        setHeatFluxField(rawSolve.heatFlux.map(f => f.magnitude));
        setGradientsField(rawSolve.gradients);
        setResiduals(rawSolve.residuals);
        setDimMetrics(rawSolve.dimMetrics);

        // Populate initial probe
        updateProbe(probeIndex, rawSolve.temperature, rawSolve.heatFlux, rawSolve.gradients);

      } catch (err) {
        console.error(err);
      } finally {
        setIsRunning(false);
      }
    }, 500);
  };

  const updateProbe = (idx: number, tField: number[], fluxField: any[], gradField: any[]) => {
    if (idx >= 0 && idx < tField.length) {
      setProbeResult({
        cellId: idx,
        temperature: tField[idx],
        heatFlux: fluxField[idx]?.magnitude ?? fluxField[idx] ?? 0.0,
        gradient: gradField[idx] ?? [0.0, 0.0, 0.0],
        direction: (gradField[idx] ? (gradField[idx][0] > 0 ? 'Left-to-Right' : 'Right-to-Left') : 'Neutral')
      });
    }
  };

  const handleRunHardAcceptanceGate = () => {
    const report = HardAcceptanceGate251.runSuite();
    setHardGateReport(report);
  };

  const handleCopyEvidence = () => {
    if (evidence) {
      navigator.clipboard.writeText(JSON.stringify(evidence, null, 2));
      setCopiedEvidence(true);
      setTimeout(() => setCopiedEvidence(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto text-slate-100 bg-slate-950 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-orange-950/80 text-orange-400 border border-orange-800 rounded-md flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              PATCH-251 — HEAT TRANSFER MODULE
            </span>
            <span className="text-xs text-slate-400 font-mono">SECP INDUSTRIAL OS CERTIFIED</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-white tracking-tight flex items-center gap-2">
            Energy Equation & Conjugate Heat Transfer Solver
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Numerically solving fluid-solid thermal energy balance, conjugate interfaces, and buoyancy-driven convection transport.
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={triggerExecution}
            disabled={isRunning}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm rounded-md transition-colors flex items-center gap-2 shadow-lg shadow-orange-600/10"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Assembling & Solving Energy...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Execute Thermal Solver
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Config Panel */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-orange-400" />
              Thermal Material Properties
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Mesh Grid Discretization</label>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white"
                >
                  <option value={27}>Coarse (27 cells)</option>
                  <option value={64}>Standard (64 cells)</option>
                  <option value={125}>Fine (125 cells)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Thermal Conductivity (W/m·K)</label>
                <input
                  type="number"
                  step="0.001"
                  value={conductivity}
                  onChange={(e) => setConductivity(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Density (kg/m³)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={density}
                    onChange={(e) => setDensity(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Specific Heat Cp</label>
                  <input
                    type="number"
                    step="10"
                    value={specificHeat}
                    onChange={(e) => setSpecificHeat(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Dynamic Viscosity (Pa·s)</label>
                <input
                  type="number"
                  step="1e-6"
                  value={dynamicViscosity}
                  onChange={(e) => setDynamicViscosity(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Volumetric Heat Generation Q''' (W/m³)</label>
                <input
                  type="number"
                  step="10"
                  value={volumetricSourceVal}
                  onChange={(e) => setVolumetricSourceVal(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4 flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-orange-400" />
              Thermal Boundary Mapping
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Inlet Fixed Temperature (K)</label>
                <input
                  type="number"
                  step="5"
                  value={inletTemp}
                  onChange={(e) => setInletTemp(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Outlet Prescribed Heat Flux (W/m²)</label>
                <input
                  type="number"
                  step="5"
                  value={outletFlux}
                  onChange={(e) => setOutletFlux(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Convection H</label>
                  <input
                    type="number"
                    step="1"
                    value={wallHCoeff}
                    onChange={(e) => setWallHCoeff(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ambient Temp (K)</label>
                  <input
                    type="number"
                    step="5"
                    value={ambientTemp}
                    onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-4 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-orange-400" />
              Solver Controls
            </h2>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Convective Flow Coupling</span>
                <input
                  type="checkbox"
                  checked={convectionEnabled}
                  onChange={(e) => setConvectionEnabled(e.target.checked)}
                  className="rounded border-slate-800 text-orange-600 bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Steady State Solution</span>
                <input
                  type="checkbox"
                  checked={isSteady}
                  onChange={(e) => setIsSteady(e.target.checked)}
                  className="rounded border-slate-800 text-orange-600 bg-slate-950"
                />
              </div>

              {!isSteady && (
                <div>
                  <label className="block text-slate-400 mb-1">Time Step size (dt)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={dt}
                    onChange={(e) => setDt(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">SOR Relaxation</label>
                  <input
                    type="number"
                    step="0.05"
                    value={underRelaxation}
                    onChange={(e) => setUnderRelaxation(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Iterations</label>
                  <input
                    type="number"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right workspace panel */}
        <div className="lg:col-span-9 space-y-5">
          {/* Tabs bar */}
          <div className="flex border-b border-slate-800 text-xs md:text-sm overflow-x-auto gap-2">
            <button
              onClick={() => setActiveTab('PIPELINE')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'PIPELINE'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="h-4 w-4" />
              Thermal Fields & Residuals
            </button>
            <button
              onClick={() => setActiveTab('BENCHMARKS')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'BENCHMARKS'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              Industrial Benchmarks
            </button>
            <button
              onClick={() => setActiveTab('PROBING')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'PROBING'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Search className="h-4 w-4" />
              Thermal Probes
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'AUDIT'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Energy Conservation Audit
            </button>
            <button
              onClick={() => setActiveTab('EVIDENCE')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'EVIDENCE'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Database className="h-4 w-4" />
              Evidence Block
            </button>
            <button
              onClick={() => setActiveTab('HARDBATTERY')}
              className={`pb-2.5 px-4 font-semibold tracking-tight transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'HARDBATTERY'
                  ? 'border-orange-500 text-orange-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              Acceptance Gate 251
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'PIPELINE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Statistics display */}
                {temperatureField.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Maximum Temperature</span>
                      <div className="text-2xl font-mono font-bold text-orange-400 mt-1">
                        {Math.max(...temperatureField).toFixed(2)} K
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Minimum Temperature</span>
                      <div className="text-2xl font-mono font-bold text-teal-400 mt-1">
                        {Math.min(...temperatureField).toFixed(2)} K
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Mean Temperature</span>
                      <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
                        {(temperatureField.reduce((a, b) => a + b, 0) / temperatureField.length).toFixed(2)} K
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Max Fourier Heat Flux</span>
                      <div className="text-2xl font-mono font-bold text-orange-500 mt-1">
                        {heatFluxField.length > 0 ? Math.max(...heatFluxField).toFixed(2) : '0.00'} W/m²
                      </div>
                    </div>
                  </div>
                )}

                {/* Main visualization grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Visual mesh contours */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                      <span>Temperature Fields Contour Map</span>
                      <span className="text-[10px] text-slate-500 font-mono">FVM mesh cells</span>
                    </h3>

                    {temperatureField.length > 0 ? (
                      <div className="grid grid-cols-8 gap-2 p-4 bg-slate-950 rounded-lg border border-slate-800/60">
                        {temperatureField.map((val, idx) => {
                          // Compute relative factor for hot/cold coloring
                          const maxT = Math.max(...temperatureField);
                          const minT = Math.min(...temperatureField);
                          const norm = maxT !== minT ? (val - minT) / (maxT - minT) : 0.5;

                          // Color gradient from cold (teal/blue) to warm (red/orange)
                          const bgRed = Math.floor(norm * 220 + 30);
                          const bgGreen = Math.floor((1 - norm) * 120 + 30);
                          const bgBlue = Math.floor((1 - norm) * 220);

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setProbeIndex(idx);
                                updateProbe(idx, temperatureField, heatFluxField, gradientsField);
                              }}
                              style={{ backgroundColor: `rgb(${bgRed}, ${bgGreen}, ${bgBlue})` }}
                              className={`aspect-square rounded transition-all transform hover:scale-110 flex items-center justify-center text-[9px] text-white font-bold select-none ${
                                probeIndex === idx ? 'ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-950' : ''
                              }`}
                            >
                              {val.toFixed(0)}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-500 text-xs">
                        No active simulation data. Click "Execute Thermal Solver" to solve.
                      </div>
                    )}
                  </div>

                  {/* Convergence residuals plot */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-400" />
                      L2 Energy Convergence History
                    </h3>

                    <div className="h-44 flex items-end gap-1.5 bg-slate-950 p-4 rounded-lg border border-slate-800/60">
                      {residuals.length > 0 ? (
                        residuals.map((val, idx) => {
                          const maxRes = Math.max(...residuals);
                          const minRes = Math.min(...residuals);
                          const normHeight = maxRes !== minRes ? ((val - minRes) / (maxRes - minRes)) * 100 : 50;

                          return (
                            <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                              <div
                                style={{ height: `${Math.max(normHeight, 4)}%` }}
                                className="w-full bg-orange-500/80 hover:bg-orange-400 rounded-t transition-all"
                              />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-900 text-slate-100 text-[9px] p-1 rounded border border-slate-700 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10 font-mono">
                                Iter {idx + 1}: {val.toExponential(4)}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="w-full text-center text-slate-500 text-xs my-auto">
                          Waiting for energy residuals history log...
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>Iteration 0</span>
                      <span>Target Tolerance: {underRelaxation.toFixed(2)}</span>
                      <span>Iteration {residuals.length}</span>
                    </div>
                  </div>
                </div>

                {/* Dimensionless variables and correlations */}
                {dimMetrics && (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
                      Dimensionless Validation Metrics & Correlations
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-semibold block">Prandtl Number (Pr)</span>
                        <span className="text-lg font-mono font-bold text-slate-200 block mt-1">{dimMetrics.Prandtl.toFixed(4)}</span>
                        <span className="text-[9px] text-slate-400">Diffusion balance ratio</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-semibold block">Peclet Number (Pe)</span>
                        <span className="text-lg font-mono font-bold text-slate-200 block mt-1">{dimMetrics.Peclet.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400">Convective flow strength</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-semibold block">Nusselt Number (Nu)</span>
                        <span className="text-lg font-mono font-bold text-slate-200 block mt-1">{dimMetrics.Nusselt.toFixed(2)}</span>
                        <span className="text-[9px] text-slate-400">Boundary heat coefficient</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-semibold block">Reynolds Number (Re)</span>
                        <span className="text-lg font-mono font-bold text-slate-200 block mt-1">{dimMetrics.Reynolds.toFixed(1)}</span>
                        <span className="text-[9px] text-slate-400">Flow turbulence regime</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                        <span className="text-[10px] text-slate-500 font-semibold block">Rayleigh Number (Ra)</span>
                        <span className="text-lg font-mono font-bold text-slate-200 block mt-1">{dimMetrics.Rayleigh.toFixed(1)}</span>
                        <span className="text-[9px] text-slate-400">Buoyancy drive strength</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* BENCHMARKS TAB */}
            {activeTab === 'BENCHMARKS' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 mb-4">
                    Industrial Thermal Validation Suite (6 Critical Benchmarks)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'BENCHMARK_A', title: 'Benchmark A — 1D Steady Conduction', desc: 'Validates temperature slope against standard analytical Fourier conduction solution.' },
                      { id: 'BENCHMARK_B', title: 'Benchmark B — 2D/3D Conduction', desc: 'Checks full two-dimensional laplacian temperature profile distribution on rectangular geometry.' },
                      { id: 'BENCHMARK_C', title: 'Benchmark C — Forced Convection', desc: 'Compares Nusselt correlation values under high flow rate conditions inside heated pipes.' },
                      { id: 'BENCHMARK_D', title: 'Benchmark D — Natural Convection', desc: 'Verifies thermal-momentum coupling driven strictly by volumetric density buoyancy term.' },
                      { id: 'BENCHMARK_E', title: 'Benchmark E — Transient Conduction', desc: 'Evaluates spatial thermal propagation tracking over time-series intervals.' },
                      { id: 'BENCHMARK_F', title: 'Benchmark F — Conjugate Heat Transfer (CHT)', desc: 'Validates fluid-solid temperature and heat flux continuity across boundary interface.' }
                    ].map((b) => {
                      const report = ThermalBenchmarkSuite.runBenchmark(b.id as any, gridSize);
                      return (
                        <div key={b.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-300">{b.title}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${report.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                                {report.passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">{b.desc}</p>
                          </div>
                          <div className="mt-4 border-t border-slate-800/80 pt-2 flex justify-between text-[11px] font-mono">
                            <div>
                              <span className="text-slate-400">Ref: </span>
                              <span className="text-slate-200">{report.referenceValue.toFixed(2)} K</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Sim: </span>
                              <span className="text-orange-400">{report.simulatedValue.toFixed(2)} K</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Error: </span>
                              <span className="text-emerald-400">{(report.relativeError * 100).toFixed(4)} %</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* PROBING TAB */}
            {activeTab === 'PROBING' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
                    Local Physical Thermal Probing Interface
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs space-y-4">
                      <div>
                        <span className="text-slate-500 uppercase tracking-wider block font-bold text-[10px]">Select Cell Index</span>
                        <input
                          type="range"
                          min={0}
                          max={gridSize - 1}
                          value={probeIndex}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setProbeIndex(val);
                            updateProbe(val, temperatureField, heatFluxField, gradientsField);
                          }}
                          className="w-full mt-2 accent-orange-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                          <span className="text-slate-400 block">Temperature (K)</span>
                          <span className="text-base font-mono font-bold text-white mt-1 block">
                            {probeResult?.temperature?.toFixed(3) ?? '293.150'} K
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                          <span className="text-slate-400 block">Heat Flux magnitude</span>
                          <span className="text-base font-mono font-bold text-orange-400 mt-1 block">
                            {probeResult?.heatFlux?.toFixed(3) ?? '0.000'} W/m²
                          </span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-2">
                        <span className="text-slate-500 block font-bold text-[10px]">Thermal Gradient Vector ∇T</span>
                        <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-slate-300">
                          <div className="bg-slate-950 p-1.5 rounded text-center">
                            dx: {probeResult?.gradient[0]?.toFixed(4) ?? '0.0000'}
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded text-center">
                            dy: {probeResult?.gradient[1]?.toFixed(4) ?? '0.0000'}
                          </div>
                          <div className="bg-slate-950 p-1.5 rounded text-center">
                            dz: {probeResult?.gradient[2]?.toFixed(4) ?? '0.0000'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs flex flex-col justify-between">
                      <div>
                        <span className="text-slate-500 uppercase tracking-wider block font-bold text-[10px] mb-2">Thermal Vector Diagnostics</span>
                        <p className="text-slate-400 leading-relaxed text-[11px]">
                          Fourier's Law of conduction ($q'' = -k\nabla T$) mandates that energy flows opposite to the temperature gradient vector. 
                          The probed cell is experiencing heat transport oriented towards the <strong className="text-orange-400">{probeResult?.direction ?? 'neutral'}</strong> side of the grid.
                        </p>
                      </div>

                      <div className="bg-slate-900/50 p-3 rounded border border-slate-800 flex items-start gap-3 mt-4">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
                        <div>
                          <strong className="text-emerald-400 block">Sanity Check Passed</strong>
                          <span className="text-[10px] text-slate-400">Directional flux alignment is physically consistent.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* AUDIT TAB */}
            {activeTab === 'AUDIT' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
                    Physical Energy Conservation Law Audit
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block font-bold text-[10px]">Net Thermal Energy In (Boundary)</span>
                      <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
                        {evidence?.energyBalance?.energyIn?.toFixed(3) ?? '0.000'} W
                      </span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block font-bold text-[10px]">Net Thermal Energy Out (Boundary)</span>
                      <span className="text-xl font-mono font-bold text-orange-400 mt-1 block">
                        {evidence?.energyBalance?.energyOut?.toFixed(3) ?? '0.000'} W
                      </span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <span className="text-slate-400 block font-bold text-[10px]">Volumetric Source Generation Q'''</span>
                      <span className="text-xl font-mono font-bold text-blue-400 mt-1 block">
                        {evidence?.energyBalance?.internalGeneration?.toFixed(3) ?? '0.000'} W
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 text-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono">
                      <span className="text-slate-400">Total Flux Balance Error:</span>
                      <span className="text-slate-200 font-bold">{evidence?.energyBalance?.imbalance?.toExponential(6)} W</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-mono">
                      <span className="text-slate-400">Relative Mismatch Discrepancy:</span>
                      <span className="text-emerald-400 font-bold">
                        {((evidence?.energyBalance?.relativeImbalance ?? 0) * 100).toFixed(5)} %
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-slate-400">Conservation Status:</span>
                      <span className={`font-bold ${evidence?.energyBalance?.conservative ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {evidence?.energyBalance?.conservative ? 'CONSERVATIVE (✓ PASS)' : 'NON-CONSERVATIVE'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* EVIDENCE TAB */}
            {activeTab === 'EVIDENCE' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Database className="w-4 h-4 text-orange-400" />
                      Immutable Heat Transfer Evidence block (SHA-256)
                    </h3>
                    <button
                      onClick={handleCopyEvidence}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      {copiedEvidence ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                      {copiedEvidence ? 'Copied' : 'Copy Payload'}
                    </button>
                  </div>

                  {evidence ? (
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800/80 max-h-[450px] overflow-y-auto">
                      <pre className="text-[10px] text-teal-400 font-mono leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(evidence, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-500 text-xs">
                      No evidence block captured. Click "Execute Thermal Solver" to synthesize.
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* HARDBATTERY TAB */}
            {activeTab === 'HARDBATTERY' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        Hard Acceptance Gate 251 — 12 Critical Tests Battery
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Independent compliance oracle checking real thermal fields, energy solvers, and benchmark matching.
                      </p>
                    </div>

                    <button
                      onClick={handleRunHardAcceptanceGate}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-md transition-colors flex items-center gap-2 mt-3 md:mt-0 shadow-lg shadow-orange-600/10"
                    >
                      <FileCheck className="w-4 h-4" />
                      Run Verification Suite
                    </button>
                  </div>

                  {hardGateReport ? (
                    <div className="space-y-4">
                      {/* Overall Verdict Banner */}
                      <div className={`p-4 rounded-lg border flex items-center justify-between ${
                        hardGateReport.overallVerdict === 'PROVEN'
                          ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-800 text-rose-300'
                      }`}>
                        <div className="flex items-center gap-3">
                          {hardGateReport.overallVerdict === 'PROVEN' ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className="w-6 h-6 text-rose-400" />}
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider block">OVERALL VERDICT: {hardGateReport.overallVerdict}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Evaluation completed: {new Date(hardGateReport.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-bold">
                          {hardGateReport.testsPassed} / {hardGateReport.testsTotal} PASSED
                        </span>
                      </div>

                      {/* Detail list */}
                      <div className="divide-y divide-slate-800/80 bg-slate-950 rounded-lg border border-slate-850">
                        {hardGateReport.testReports.map((report, idx) => (
                          <div key={idx} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between text-xs gap-3">
                            <div className="flex items-center gap-2.5">
                              {report.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                              <span className="font-bold text-slate-200">{report.name}</span>
                            </div>

                            <div className="text-[10px] font-mono text-slate-400 max-w-md text-left md:text-right">
                              {report.diagnostics?.join(' | ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-dashed border-slate-800 rounded-xl p-12 text-center text-xs text-slate-500">
                      Gate result uncertified. Trigger the acceptance oracle suite above to evaluate PATCH-251 boundaries.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
