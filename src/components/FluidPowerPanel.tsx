import React, { useState } from 'react';
import {
  FluidPowerEngine,
  FluidComponent,
  SystemGraphEdge,
  FluidSystemSolveResult
} from '../engine/fluidPower';
import { Activity, Gauge, Sliders, ArrowRight, ShieldAlert, Cpu, Layers, RefreshCw, Zap } from 'lucide-react';

export const FluidPowerPanel: React.FC = () => {
  const defaultSys = FluidPowerEngine.getDefaultSystemComponents();
  const [components, setComponents] = useState<FluidComponent[]>(defaultSys.components);
  const [pumpRpm, setPumpRpm] = useState<number>(1450);
  const [loadForceN, setLoadForceN] = useState<number>(35000);

  const solveResult: FluidSystemSolveResult = FluidPowerEngine.solveFluidNetwork(
    components,
    pumpRpm,
    loadForceN
  );

  const handleToggleValve = (newState: 'EXTEND' | 'RETRACT' | 'NEUTRAL') => {
    setComponents(prev =>
      prev.map(c => {
        if (c.type === 'VALVE_DIRECTIONAL') {
          return { ...c, valveState: newState };
        }
        return c;
      })
    );
  };

  const currentDirState = components.find(c => c.type === 'VALVE_DIRECTIONAL')?.valveState || 'EXTEND';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Gauge className="w-5 h-5 text-cyan-400" />
            PATCH-SECP-014 — Hydraulic & Pneumatic Systems Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fluid Power Graph Network: Pump → Pipe Harness → Control Valve → Hydraulic Cylinder Actuator.
          </p>
        </div>

        {/* Directional Valve Selector */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => handleToggleValve('EXTEND')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              currentDirState === 'EXTEND' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Solenoid A (Extend)
          </button>
          <button
            onClick={() => handleToggleValve('NEUTRAL')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              currentDirState === 'NEUTRAL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Neutral Bypass
          </button>
          <button
            onClick={() => handleToggleValve('RETRACT')}
            className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
              currentDirState === 'RETRACT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Solenoid B (Retract)
          </button>
        </div>
      </div>

      {/* Warning/Status Banner */}
      <div className={`p-3.5 border rounded-lg text-xs flex items-center justify-between ${
        solveResult.statusMessage.includes('RELIEF')
          ? 'bg-rose-950/80 border-rose-600 text-rose-200'
          : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200'
      }`}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold">{solveResult.statusMessage}</span>
        </div>
        <span className="font-mono text-cyan-300 font-bold">Fluid ISO VG 46 • {solveResult.fluidTemperatureC}°C</span>
      </div>

      {/* Component Library Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Schematic Fluid Component Library</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {components.map(comp => (
            <div key={comp.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                {comp.type}
              </span>
              <div className="font-semibold text-[11px] truncate text-slate-200" title={comp.name}>
                {comp.name}
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                {comp.maxPressureBar ? `${comp.maxPressureBar} bar` : comp.cylinderBoreMm ? `Ø${comp.cylinderBoreMm}mm Bore` : 'Line Unit'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Real-Time Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Pump & Hydraulic Load Parameters
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Pump Motor Speed:</span>
                <span className="font-mono text-cyan-300 font-bold">{pumpRpm} RPM</span>
              </div>
              <input
                type="range"
                min="500"
                max="2800"
                step="50"
                value={pumpRpm}
                onChange={e => setPumpRpm(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>External Cylinder Load:</span>
                <span className="font-mono text-rose-300 font-bold">{(loadForceN / 1000).toFixed(1)} kN</span>
              </div>
              <input
                type="range"
                min="5000"
                max="120000"
                step="2500"
                value={loadForceN}
                onChange={e => setLoadForceN(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Pump Operating Pressure:</span>
              <span className="font-bold text-cyan-300">{solveResult.pumpPressureBar.toFixed(1)} bar</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Line Flow Rate Q:</span>
              <span className="font-bold text-emerald-400">{solveResult.systemFlowLpm.toFixed(1)} L/min</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Harness Fluid Velocity:</span>
              <span className="font-bold text-indigo-300">{solveResult.pipeVelocityMS.toFixed(2)} m/s</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Line Friction Head Loss:</span>
              <span className="font-bold text-amber-400">{solveResult.frictionLossBar.toFixed(2)} bar</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Net Cylinder Force Output:</span>
              <span className="font-bold text-rose-400">{(solveResult.cylinderForceN / 1000).toFixed(2)} kN</span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Cylinder Extension Speed:</span>
              <span className="font-bold text-purple-300">{solveResult.cylinderSpeedMmS.toFixed(1)} mm/s</span>
            </div>
          </div>
        </div>

        {/* Directed System Graph Schematic Network */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-2 flex justify-between">
            <span>Hydraulic Circuit Network Directed Graph Topology</span>
            <span className="text-emerald-400 font-bold">SOLVER: Darcy-Weisbach & Pascal Law</span>
          </div>

          {/* Network Graph Visualization */}
          <div className="p-6 bg-slate-900 border border-slate-800/80 rounded-lg font-mono text-xs space-y-6">
            <div className="flex items-center justify-between gap-3 overflow-x-auto py-2">
              <div className="p-3 bg-blue-950 border border-blue-800 rounded text-center shrink-0 min-w-28">
                <div className="font-bold text-blue-300">RESERVOIR</div>
                <div className="text-[10px] text-slate-400">100L Fluid Tank</div>
              </div>

              <ArrowRight className="w-5 h-5 text-cyan-400 shrink-0" />

              <div className="p-3 bg-cyan-950 border border-cyan-800 rounded text-center shrink-0 min-w-32">
                <div className="font-bold text-cyan-300">PISTON PUMP</div>
                <div className="text-[10px] text-slate-300">{solveResult.systemFlowLpm.toFixed(1)} L/min</div>
              </div>

              <ArrowRight className="w-5 h-5 text-cyan-400 shrink-0" />

              <div className="p-3 bg-purple-950 border border-purple-800 rounded text-center shrink-0 min-w-32">
                <div className="font-bold text-purple-300">4/3 VALVE</div>
                <div className="text-[10px] text-slate-300">{currentDirState}</div>
              </div>

              <ArrowRight className="w-5 h-5 text-cyan-400 shrink-0" />

              <div className="p-3 bg-emerald-950 border border-emerald-800 rounded text-center shrink-0 min-w-36">
                <div className="font-bold text-emerald-300">HYDRAULIC CYLINDER</div>
                <div className="text-[10px] text-slate-300">{(solveResult.cylinderForceN / 1000).toFixed(1)} kN Force</div>
              </div>
            </div>

            {/* Sub-Branch Relief Valve Line */}
            <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-amber-300 mr-2">Safety Relief Line:</span>
                <span className="text-slate-300">Main Pressure Relief Valve (180 bar limit)</span>
              </div>
              <span className="font-bold font-mono text-amber-400">{solveResult.pumpPressureBar.toFixed(1)} / 180 bar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
