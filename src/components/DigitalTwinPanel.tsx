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
} from 'lucide-react';
import { DigitalTwinEngine, DigitalTwinState, TelemetryReading } from '../engine/digitalTwinEngine';

export const DigitalTwinPanel: React.FC = () => {
  const [twinState, setTwinState] = useState<DigitalTwinState>(() => DigitalTwinEngine.createInitialState());
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [selectedAnomaly, setSelectedAnomaly] = useState<'NONE' | 'OVERHEAT' | 'OVERPRESSURE' | 'BEARING_VIBRATION' | 'CAVITATION'>('NONE');

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

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight">Digital Twin Telemetry Engine</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-full">
              PATCH-SECP-023
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time physical asset sync linking CAD 3D state with live machine telemetry streams (Temperature, Pressure, RPM, Vibration, Current, Flow).
          </p>
        </div>

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
            <RefreshCw className="w-3.5 h-3.5" /> Reset Twin
          </button>
        </div>
      </div>

      {/* Real Machine Sync Pipeline Overview */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2 text-cyan-400 font-bold">
          <Cpu className="w-4 h-4" /> 3D CAD State
        </div>
        <span>↔</span>
        <div className="flex items-center gap-2 text-indigo-400 font-bold">
          <Activity className="w-4 h-4" /> Digital Twin
        </div>
        <span>↔</span>
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Database className="w-4 h-4" /> Telemetry Bus
        </div>
        <span>↔</span>
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <Zap className="w-4 h-4" /> Real Machine
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
    </div>
  );
};
