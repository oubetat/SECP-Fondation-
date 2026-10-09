import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  Database, 
  Flame, 
  Play, 
  Pause, 
  RefreshCw, 
  Gauge, 
  Zap, 
  TrendingUp, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  Network, 
  Clock, 
  Award, 
  Layers, 
  ChevronRight 
} from 'lucide-react';
import { DigitalTwinEngine, DigitalTwinState, TelemetryReading } from '../engine/digitalTwinEngine';
import { HardAcceptanceGate326, DigitalTwinEvidencePackage } from '../engine/digital_twin/HardAcceptanceGate326';

export const DigitalTwinPanel: React.FC = () => {
  const [twinState, setTwinState] = useState<DigitalTwinState>(() => DigitalTwinEngine.createInitialState());
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<'NONE' | 'OVERHEAT' | 'OVERPRESSURE' | 'BEARING_VIBRATION' | 'CAVITATION'>('NONE');
  
  // PATCH-326 Multi-Tab & Gate State
  const [activeTab, setActiveTab] = useState<'telemetry' | 'gate'>('telemetry');
  const [gate326Result, setGate326Result] = useState(() => HardAcceptanceGate326.runGate());
  const [showEvidence, setShowEvidence] = useState<boolean>(false);

  // Live telemetry streaming interval
  useEffect(() => {
    if (!isLiveStreaming) return;

    const timer = setInterval(() => {
      setTwinState(prev => {
        const anomaly = selectedAnomaly !== 'NONE' ? selectedAnomaly : undefined;
        const nextTelemetry = DigitalTwinEngine.generateTelemetryTick(prev.currentTelemetry, anomaly);
        const { healthScore, status, newAlerts, cadColorHex } = DigitalTwinEngine.evaluateHealth(nextTelemetry);

        const updatedHistory = [...prev.telemetryHistory.slice(-25), nextTelemetry];
        const combinedAlerts = [...newAlerts, ...prev.alerts].slice(0, 15);

        return {
          ...prev,
          healthScore,
          status,
          currentTelemetry: nextTelemetry,
          telemetryHistory: updatedHistory,
          alerts: combinedAlerts,
          operatingHours: prev.operatingHours + 0.01,
          estimatedRulHours: Math.max(100, prev.estimatedRulHours - (healthScore < 80 ? 0.05 : 0.01)),
          cadThermalColorMapHex: cadColorHex,
        };
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isLiveStreaming, selectedAnomaly]);

  const curr = twinState.currentTelemetry;

  const handleRunGate = () => {
    setGate326Result(HardAcceptanceGate326.runGate());
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6" id="digital-twin-panel-root">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight">Industrial Digital Twin OS</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
              PATCH-326
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time physical asset sync linking CAD B-Rep, simulation instances, CNC toolpaths, quality inspection metrics, and live IoT telemetry.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'telemetry' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Telemetry
          </button>
          <button
            onClick={() => setActiveTab('gate')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'gate' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            Acceptance Gate
          </button>
        </div>
      </div>

      {activeTab === 'telemetry' ? (
        <>
          {/* Real Machine Sync Pipeline Overview */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Cpu className="w-4 h-4" /> 3D CAD State (As-Designed)
            </div>
            <span>↔</span>
            <div className="flex items-center gap-2 text-indigo-400 font-bold">
              <Layers className="w-4 h-4" /> Digital Twin (As-Built)
            </div>
            <span>↔</span>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Database className="w-4 h-4" /> Telemetry Bus (As-Operated)
            </div>
            <span>↔</span>
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Zap className="w-4 h-4" /> Physical Machine (As-Maintained)
            </div>
          </div>

          {/* Main Grid: Live Metric Gauges & Interactive Twin Canvas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Live Telemetry Gauges & Anomaly Trigger */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" /> Real-Time Telemetry Stream
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Inject Synthetic Anomaly:</span>
                  <select
                    value={selectedAnomaly}
                    onChange={e => setSelectedAnomaly(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="NONE">Nominal Stream</option>
                    <option value="OVERHEAT">Thermal Overheat (+Temp)</option>
                    <option value="OVERPRESSURE">Hydraulic Overpressure (+Press)</option>
                    <option value="BEARING_VIBRATION">Bearing Failure (+Vib)</option>
                    <option value="CAVITATION">Pump Cavitation (-Flow)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Metric 1: Temperature */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-rose-400" /> Temperature</span>
                    <span className="font-mono text-[10px] text-slate-500">°C</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.temperatureC.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (curr.temperatureC / 120) * 100)}%`,
                        backgroundColor: curr.temperatureC > 105 ? '#ef4444' : curr.temperatureC > 85 ? '#f59e0b' : '#10b981',
                      }}
                    />
                  </div>
                </div>

                {/* Metric 2: Pressure */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-cyan-400" /> Pressure</span>
                    <span className="font-mono text-[10px] text-slate-500">kPa</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.pressureKPa.toFixed(1)} <span className="text-xs font-normal text-slate-500">kPa</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (curr.pressureKPa / 1200) * 100)}%`,
                        backgroundColor: curr.pressureKPa > 950 ? '#ef4444' : curr.pressureKPa > 700 ? '#f59e0b' : '#38bdf8',
                      }}
                    />
                  </div>
                </div>

                {/* Metric 3: RPM */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: `${Math.max(0.3, 6000 / Math.max(100, curr.rpm))}s` }} /> Speed</span>
                    <span className="font-mono text-[10px] text-slate-500">RPM</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.rpm} <span className="text-xs font-normal text-slate-500">RPM</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (curr.rpm / 8000) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Metric 4: Vibration */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-purple-400" /> Vibration</span>
                    <span className="font-mono text-[10px] text-slate-500">mm/s</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.vibrationMmS.toFixed(2)} <span className="text-xs font-normal text-slate-500">mm/s</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (curr.vibrationMmS / 15) * 100)}%`,
                        backgroundColor: curr.vibrationMmS > 9 ? '#ef4444' : curr.vibrationMmS > 5 ? '#f59e0b' : '#c084fc',
                      }}
                    />
                  </div>
                </div>

                {/* Metric 5: Current */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-yellow-400" /> Motor Current</span>
                    <span className="font-mono text-[10px] text-slate-500">Amp</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.currentAmp.toFixed(1)} <span className="text-xs font-normal text-slate-500">A</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (curr.currentAmp / 120) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Metric 6: Flow */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Fluid Flow</span>
                    <span className="font-mono text-[10px] text-slate-500">L/min</span>
                  </div>
                  <div className="mt-2 text-xl font-mono font-bold text-slate-100">
                    {curr.flowLMin.toFixed(1)} <span className="text-xs font-normal text-slate-500">L/m</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, (curr.flowLMin / 200) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Control panel and stream toggles */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isLiveStreaming
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isLiveStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isLiveStreaming ? 'Pause Stream' : 'Resume Telemetry'}
                </button>

                <button
                  onClick={() => setTwinState(DigitalTwinEngine.createInitialState())}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Telemetry
                </button>
              </div>

              {/* Machine Health & Diagnostic Alerts */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" /> Live Anomaly Event Log
                </h4>

                {twinState.alerts.length === 0 ? (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    All telemetry channels operating within nominal safety margins. Health Score: {twinState.healthScore}%.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                    {twinState.alerts.map(alt => (
                      <div
                        key={alt.id}
                        className={`p-2.5 rounded text-xs border flex items-start gap-2.5 ${
                          alt.severity === 'CRITICAL'
                            ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                            : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 font-mono font-semibold">
                            <span>[{alt.timestamp}]</span>
                            <span>{alt.message}</span>
                          </div>
                          <div className="text-[11px] opacity-80">Action: {alt.recommendedAction}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col: 3D CAD Synchronized Overlay Representation */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  3D CAD Twin State
                </h3>
                <span
                  className="px-2 py-0.5 text-[10px] font-mono rounded border font-semibold"
                  style={{
                    borderColor: twinState.cadThermalColorMapHex,
                    color: twinState.cadThermalColorMapHex,
                  }}
                >
                  {twinState.status}
                </span>
              </div>

              {/* SVG Canvas overlay showing rotating turbine + pressure/thermal aura */}
              <div className="my-4 relative bg-slate-900 rounded border border-slate-800 h-64 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 300 200">
                  {/* Outer Casing */}
                  <rect x="50" y="40" width="200" height="120" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2" />

                  {/* Dynamic Aura color mapping live health */}
                  <circle
                    cx="150"
                    cy="100"
                    r="55"
                    fill="none"
                    stroke={twinState.cadThermalColorMapHex}
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    className="animate-spin"
                    style={{ animationDuration: `${Math.max(0.4, 6000 / Math.max(200, curr.rpm))}s` }}
                  />

                  {/* Impeller Blades */}
                  <g transform="translate(150, 100)">
                    {[0, 60, 120, 180, 240, 300].map(angle => (
                      <path
                        key={angle}
                        d="M 0 0 L 0 -40 C 10 -30, 15 -10, 0 0"
                        fill={twinState.cadThermalColorMapHex}
                        opacity="0.8"
                        transform={`rotate(${angle})`}
                      />
                    ))}
                  </g>

                  {/* Hydraulic Flow Lines */}
                  <path
                    d="M 10 100 L 50 100 M 250 100 L 290 100"
                    stroke="#38bdf8"
                    strokeWidth="4"
                    strokeDasharray="8 4"
                    className="animate-pulse"
                  />

                  {/* Live Telemetry Legend Overlay */}
                  <text x="60" y="60" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    RPM: {curr.rpm}
                  </text>
                  <text x="60" y="75" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    TEMP: {curr.temperatureC}°C
                  </text>
                  <text x="60" y="90" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    PRESS: {curr.pressureKPa} kPa
                  </text>
                </svg>
              </div>

              {/* RUL & Health Score Breakdown */}
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-800 text-xs">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Overall Health Score:</span>
                  <span className="font-mono text-cyan-400 font-bold">{twinState.healthScore}%</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Operating Time:</span>
                  <span className="font-mono text-slate-200">{twinState.operatingHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Est. Remaining Useful Life (RUL):</span>
                  <span className="font-mono text-emerald-400 font-bold">{twinState.estimatedRulHours.toFixed(0)} hrs</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* PATCH-326: Twin Production Gate */
        <div className="flex flex-col gap-6">
          {/* Top summary row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Production Verdict</span>
              <div className="mt-2 flex items-center gap-2">
                {gate326Result.passed ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                )}
                <span className={`text-sm font-bold ${gate326Result.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {gate326Result.verdict}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Completeness Score</span>
              <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
                {gate326Result.evidencePackage?.completenessScore}%
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Readiness Level</span>
              <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
                LEVEL {gate326Result.evidencePackage?.readinessLevel}
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Assertions Evaluation</span>
              <div className="mt-2 text-sm font-bold font-mono text-slate-200">
                {gate326Result.passedCount} / {gate326Result.totalAssertions} Passed
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-4 p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Production Integrity Gate Evaluation</h4>
              <p className="text-[11px] text-slate-400">Evaluates 27 industrial standards constraints for physics, telemetry binding, timestamp sanity, and digital thread tracking.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEvidence(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-all border border-slate-700 flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> View Evidence Package
              </button>
              <button
                onClick={handleRunGate}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-Evaluate Gate
              </button>
            </div>
          </div>

          {/* Test log output grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Assertions Reports</h4>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 max-h-96 overflow-y-auto font-mono text-xs text-slate-300">
                {gate326Result.details.map((detail, index) => {
                  const isPass = detail.startsWith('[PASS]');
                  return (
                    <div
                      key={index}
                      className={`p-2 rounded border flex items-start gap-2.5 ${
                        isPass ? 'bg-emerald-950/10 border-emerald-800/30 text-emerald-300' : 'bg-rose-950/20 border-rose-800/30 text-rose-300'
                      }`}
                    >
                      <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 ${isPass ? 'text-emerald-400' : 'text-rose-400'}`} />
                      <div>{detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Execution logs */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Execution Engine Logs</h4>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-1.5 max-h-96 overflow-y-auto font-mono text-[11px] text-slate-400">
                {gate326Result.executionLogs.map((log, index) => (
                  <div key={index} className="border-b border-slate-900/60 pb-1 flex gap-2">
                    <span className="text-slate-600 shrink-0">[{index + 1}]</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evidence package Modal overlay */}
          {showEvidence && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 flex flex-col gap-4 text-sm shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Database className="w-5 h-5 text-cyan-400" /> Digital Twin Evidence Package
                  </h3>
                  <button
                    onClick={() => setShowEvidence(false)}
                    className="text-slate-400 hover:text-slate-200 font-mono text-xs px-2 py-1 bg-slate-800 rounded"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1 text-slate-300">
                  <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded border border-slate-800/60 font-mono text-xs">
                    <div>
                      <span className="text-slate-500">Twin ID:</span>
                      <div className="text-slate-200 mt-1">{gate326Result.evidencePackage?.twinId}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Subject Asset:</span>
                      <div className="text-slate-200 mt-1">
                        {gate326Result.evidencePackage?.assetRegistration.manufacturer} {gate326Result.evidencePackage?.assetRegistration.model}
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-500">Serial Number:</span>
                      <div className="text-slate-200 mt-1">{gate326Result.evidencePackage?.assetRegistration.serialNumber}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-500">Geometry Revision:</span>
                      <div className="text-cyan-400 mt-1 font-bold">{gate326Result.evidencePackage?.geometryRevision}</div>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Physical Boundary Sensors Mapping</h4>
                  <div className="flex flex-col gap-2">
                    {gate326Result.evidencePackage?.sensorMapping.map((sensor: any) => (
                      <div key={sensor.sensorId} className="bg-slate-950 p-2.5 rounded border border-slate-800/40 text-xs font-mono flex justify-between items-center">
                        <div>
                          <span className="text-indigo-400 font-bold">{sensor.sensorId}</span>
                          <span className="text-slate-500 ml-2">({sensor.type})</span>
                        </div>
                        <div className="text-slate-400">
                          Unit: <span className="text-slate-200">{sensor.unit}</span> | Status: <span className="text-emerald-400 font-bold">{sensor.calibrationState.calibrationStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Audit Trail Provenance Log</h4>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800/40 text-xs font-mono text-slate-400 flex flex-col gap-1">
                    {gate326Result.evidencePackage?.auditTrail.map((log: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-cyan-500">•</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Active Multi-Domain Binders</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/40">
                      <span className="text-slate-500 font-bold">Simulation Case Binds:</span>
                      <div className="text-slate-300 mt-0.5">{gate326Result.evidencePackage?.simulationLinks.join(', ') || 'None'}</div>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800/40">
                      <span className="text-slate-500 font-bold">Manufacturing Links:</span>
                      <div className="text-slate-300 mt-0.5">{gate326Result.evidencePackage?.manufacturingLinks.join(', ') || 'None'}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>Registered to SECP Cryptographic Evidence Bus</span>
                  <span>Completeness: {gate326Result.evidencePackage?.completenessScore}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
