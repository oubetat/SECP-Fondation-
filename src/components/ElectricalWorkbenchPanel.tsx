import React, { useState, useEffect } from 'react';
import {
  ElectricalWorkbenchEngine,
  ElectricalComponent,
  CircuitSolveResult
} from '../engine/electricalWorkbench';
import { Zap, Power, ShieldAlert, Cpu, Activity, RefreshCw, Layers, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ElectricalWorkbenchPanelProps {
  canonicalDocument?: any;
}

export const ElectricalWorkbenchPanel: React.FC<ElectricalWorkbenchPanelProps> = ({ canonicalDocument }) => {
  const hasCADGeometry = Boolean(canonicalDocument?.features && canonicalDocument.features.length > 0);
  
  // Start with empty circuit per Phase 6 requirements
  const [components, setComponents] = useState<ElectricalComponent[]>([]);
  const [isMasterPowerOn, setIsMasterPowerOn] = useState<boolean>(true);
  const [modelMode, setModelMode] = useState<'ACTIVE_PROJECT' | 'REFERENCE_CIRCUIT'>('ACTIVE_PROJECT');

  useEffect(() => {
    if (!canonicalDocument || (canonicalDocument.features && canonicalDocument.features.length === 0)) {
      if (modelMode === 'ACTIVE_PROJECT') {
        setComponents([]);
      }
    }
  }, [canonicalDocument]);

  const loadReferenceCircuit = () => {
    setComponents(ElectricalWorkbenchEngine.getDefaultCircuitComponents());
    setModelMode('REFERENCE_CIRCUIT');
  };

  const clearCircuit = () => {
    setComponents([]);
    setModelMode('ACTIVE_PROJECT');
  };

  const solveResult: CircuitSolveResult = ElectricalWorkbenchEngine.solveCircuit(components, isMasterPowerOn);
  
  const circuitStatus = components.length > 0 
    ? (solveResult.isPowerOn ? 'ACTIVE_CIRCUIT' : 'OPEN_CIRCUIT')
    : 'NO_CANONICAL_CIRCUIT';

  // Toggle Pushbutton Switch
  const handleToggleSwitch = () => {
    setComponents(prev =>
      prev.map(c => {
        if (c.type === 'SWITCH') {
          return { ...c, state: c.state === 'CLOSED' ? 'OPEN' : 'CLOSED' };
        }
        return c;
      })
    );
  };

  // Overload Fuse Test
  const handleTriggerOverload = () => {
    setComponents(prev =>
      prev.map(c => {
        if (c.type === 'MOTOR') {
          // Drastically decrease motor resistance to simulate locked rotor short circuit
          return { ...c, resistanceOhms: 0.5 };
        }
        return c;
      })
    );
  };

  // Reset Fuse & Motor
  const handleResetFuse = () => {
    setComponents(prev =>
      prev.map(c => {
        if (c.type === 'FUSE') return { ...c, state: 'INTACT' };
        if (c.type === 'MOTOR') return { ...c, resistanceOhms: 3.2 };
        return c;
      })
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Zap className="w-5 h-5 text-amber-400" />
            PATCH-SECP-012 — Electrical Workbench & Circuit Simulator
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Electrical Schematic Design, Wire Harness Routing, Fuse Overcurrent Protection, Relay Logic & Motor Load Simulator.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-master-power-toggle"
            onClick={() => setIsMasterPowerOn(!isMasterPowerOn)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              isMasterPowerOn ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Power className="w-4 h-4" />
            {isMasterPowerOn ? '24V DC Bus ONLINE' : 'Master Power OFF'}
          </button>

          <button
            onClick={components.length > 0 ? handleResetFuse : loadReferenceCircuit}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
            title={components.length > 0 ? "Reset Blown Fuse & Circuit State" : "Load Benchmark Reference Circuit"}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {components.length > 0 ? 'Reset Fuse' : 'Load Reference'}
          </button>
        </div>
      </div>

      {/* Critical Overcurrent Alert Banner */}
      {solveResult.warningMessage && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-600/80 text-rose-200 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{solveResult.warningMessage}</span>
          </div>
          <button
            onClick={handleResetFuse}
            className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded text-[11px] font-bold"
          >
            Replace Fuse
          </button>
        </div>
      )}

      {/* Electrical Component Palette / Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Circuit Electrical Component Library</h3>
          <span className="text-[10px] font-mono text-slate-500">STATUS: {circuitStatus}</span>
        </div>
        
        {components.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {components.map(comp => {
              const st = solveResult.componentStates[comp.id] || comp.state || 'OK';
              const isOk = st === 'RUNNING' || st === 'TRIGGERED' || st === 'INTACT' || st === 'CLOSED';
              return (
                <div
                  key={comp.id}
                  className={`p-2.5 rounded-lg border text-xs transition flex flex-col justify-between space-y-1.5 ${
                    st === 'BLOWN'
                      ? 'bg-rose-950/60 border-rose-600 text-rose-200'
                      : isOk
                      ? 'bg-slate-950 border-slate-800 text-slate-200'
                      : 'bg-slate-950/60 border-slate-800/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300">
                      {comp.type}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        st === 'BLOWN'
                          ? 'bg-rose-500 animate-ping'
                          : isOk
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  <div className="font-semibold text-[11px] leading-tight truncate" title={comp.name}>
                    {comp.name}
                  </div>

                  <div className="text-[10px] font-mono text-slate-400">
                    Status: <span className="font-bold text-indigo-300">{st}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center gap-3">
            <Cpu className="w-10 h-10 text-slate-800" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase">Empty Canvas</p>
              <p className="text-[10px] text-slate-600 max-w-[240px]">No canonical electrical netlist or circuit components detected in the project document.</p>
            </div>
            <button 
              onClick={loadReferenceCircuit}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold border border-slate-700 transition"
            >
              Load Reference Circuit
            </button>
          </div>
        )}
      </div>

      {/* Main 2D Schematic Interactive Canvas & Circuit Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-amber-400" />
            Schematic Controls & Tests
          </h3>

          <div className="space-y-2.5 text-xs">
            <button
              id="btn-toggle-switch-panel"
              onClick={handleToggleSwitch}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              Toggle Control Pushbutton (SW1)
            </button>

            <button
              id="btn-test-overload-fuse"
              onClick={handleTriggerOverload}
              className="w-full py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-semibold rounded transition cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              Simulate Motor Locked-Rotor Short (Fuse Blow Test)
            </button>
          </div>

          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">DC Bus Voltage:</span>
              <span className="font-bold text-amber-300">
                {components.length > 0 ? `${solveResult.busVoltageV.toFixed(1)} V` : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Total Circuit Current:</span>
              <span className="font-bold text-emerald-400">
                {components.length > 0 ? `${solveResult.totalCurrentDrawA.toFixed(2)} Amps` : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Total Power Consumption:</span>
              <span className="font-bold text-indigo-300">
                {components.length > 0 ? `${solveResult.totalPowerWatts.toFixed(1)} Watts` : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Wire Transmission Voltage Drop:</span>
              <span className="font-bold text-rose-400">
                {components.length > 0 ? `${solveResult.voltageDropV.toFixed(2)} V` : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Coolant Pump Motor Speed:</span>
              <span className="font-bold text-cyan-300">
                {components.length > 0 ? `${solveResult.motorSpeedRpm} RPM` : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Sensor Signal Telemetry:</span>
              <span className="font-bold text-rose-300">
                {components.length > 0 ? `${solveResult.sensorSignalVolts.toFixed(2)} V` : 'UNAVAILABLE'}
              </span>
            </div>
            {components.length === 0 && (
              <div className="pt-2 mt-2 border-t border-slate-800 text-[9px] text-slate-600 uppercase font-bold tracking-tighter">
                NO_CANONICAL_CIRCUIT_METRICS
              </div>
            )}
          </div>
        </div>

        {/* 2D Schematic Graphic Renderer */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="text-[11px] font-mono text-slate-400 flex justify-between items-center border-b border-slate-800 pb-2">
            <span>Electrical Single-Line Schematic & Netlist</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${components.length > 0 && solveResult.isPowerOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {components.length > 0 ? (solveResult.isPowerOn ? 'CURRENT FLOWING' : 'OPEN CIRCUIT') : 'EMPTY CANVAS'}
            </span>
          </div>

          {/* Schematic Diagram Rendering */}
          {components.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800/80 rounded p-8 min-h-60 flex flex-col items-center justify-center text-center font-mono text-xs space-y-3">
              <Cpu className="w-10 h-10 text-slate-700" />
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">EMPTY_CANVAS: NO_CANONICAL_CIRCUIT</div>
                <div className="text-[10px] text-slate-500 max-w-sm">No electrical schematic components detected in the project document. Create circuit elements or load the benchmark reference circuit.</div>
              </div>
              <button
                onClick={loadReferenceCircuit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition cursor-pointer"
              >
                Load Reference Circuit
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800/80 rounded p-6 min-h-60 flex flex-col justify-between font-mono text-xs relative overflow-hidden">
              {/* Bus Rail +24V */}
              <div className="flex items-center justify-between border-b-2 border-amber-500/80 pb-2">
                <span className="text-amber-400 font-bold text-sm">+24V DC POWER BUS RAIL</span>
                <span className="text-slate-400 text-[11px]">{solveResult.busVoltageV}V DC</span>
              </div>

              {/* Circuit Components Network Path */}
              <div className="py-8 grid grid-cols-5 gap-3 items-center text-center">
                {/* Power Supply Box */}
                <div className="p-3 bg-blue-950/80 border border-blue-500/60 rounded text-[11px] space-y-1">
                  <div className="font-bold text-blue-300">PS1</div>
                  <div className="text-[10px] text-slate-400">24V Source</div>
                </div>

                {/* Wire Path Arrow */}
                <div className="flex flex-col items-center">
                  <div className={`h-1 w-full ${solveResult.isPowerOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-[9px] text-slate-500 mt-1">Harness</span>
                </div>

                {/* Fuse Box */}
                <div className={`p-3 border rounded text-[11px] space-y-1 ${
                  solveResult.fuseStatus === 'BLOWN' ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                }`}>
                  <div className="font-bold">FUSE (10A)</div>
                  <div className="text-[10px]">{solveResult.fuseStatus}</div>
                </div>

                {/* Wire Path Arrow */}
                <div className="flex flex-col items-center">
                  <div className={`h-1 w-full ${solveResult.isPowerOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                  <span className="text-[9px] text-slate-500 mt-1">2.5mm² Cu</span>
                </div>

                {/* Motor Load Box */}
                <div className={`p-3 border rounded text-[11px] space-y-1 ${
                  solveResult.motorRunning ? 'bg-cyan-950 border-cyan-400 text-cyan-200' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  <div className="font-bold">MOTOR</div>
                  <div className="text-[10px]">{solveResult.motorSpeedRpm} RPM</div>
                </div>
              </div>

              {/* Ground Rail 0V */}
              <div className="flex items-center justify-between border-t-2 border-slate-700 pt-2">
                <span className="text-slate-400 font-bold text-sm">0V GND GROUND RETURN RAIL</span>
                <span className="text-slate-500 text-[11px]">0V GND</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
