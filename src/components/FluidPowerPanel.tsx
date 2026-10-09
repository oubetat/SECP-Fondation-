import React, { useState, useEffect } from 'react';
import {
  FluidPowerEngine,
  FluidComponent,
  SystemGraphEdge,
  FluidSystemSolveResult
} from '../engine/fluidPower';
import { Activity, Gauge, Sliders, ArrowRight, ShieldAlert, Cpu, Layers, RefreshCw, Zap, Box, Award } from 'lucide-react';
import { EngineeringDocument } from '../engine/cad-kernel/document/CADDocument';
import { useEngineeringToolContext } from '../engine/telemetry/useEngineeringToolContext';

export interface FluidPowerPanelProps {
  canonicalDocument?: EngineeringDocument | null;
}

export const FluidPowerPanel: React.FC<FluidPowerPanelProps> = ({ canonicalDocument }) => {
  const toolContext = useEngineeringToolContext(canonicalDocument);

  const hasCADGeometry = toolContext.geometry.solids > 0 || (canonicalDocument?.features && canonicalDocument.features.length > 0);
  const [modelMode, setModelMode] = useState<'ACTIVE_PROJECT' | 'DEMO_CIRCUIT'>('ACTIVE_PROJECT');

  // Initialize with empty circuit per Phase 2
  const [components, setComponents] = useState<FluidComponent[]>([]);
  const [pumpRpm, setPumpRpm] = useState<number | null>(null);
  const [loadForceN, setLoadForceN] = useState<number | null>(null);

  useEffect(() => {
    if (!canonicalDocument || (canonicalDocument.features && canonicalDocument.features.length === 0)) {
      if (modelMode === 'ACTIVE_PROJECT') {
        setComponents([]);
        setPumpRpm(null);
        setLoadForceN(null);
      }
    }
  }, [canonicalDocument]);

  const loadReferenceDemo = () => {
    const defaultSys = FluidPowerEngine.getDefaultSystemComponents();
    setComponents(defaultSys.components);
    setModelMode('DEMO_CIRCUIT');
  };

  const solveResult: FluidSystemSolveResult = components.length > 0
    ? FluidPowerEngine.solveFluidNetwork(components, pumpRpm, loadForceN)
    : {
        pumpPressureBar: 0,
        flowRateLmin: 0,
        fluidVelocityMs: 0,
        frictionLossBar: 0,
        cylinderForceN: 0,
        cylinderSpeedMms: 0,
        reliefValveActive: false,
        statusMessage: 'NO_CANONICAL_HYDRAULIC_SYSTEM: Empty Canvas'
      };

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Gauge className="w-5 h-5 text-cyan-400" />
            PATCH-SECP-014 — Hydraulic & Pneumatic Systems Engine
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
              REV: #{toolContext.revision} | SOT: CANONICAL
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Fluid Power Graph Network: Pump → Pipe Harness → Control Valve → Hydraulic Cylinder Actuator.
          </p>
        </div>

        {/* Mode & Solenoid Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                setModelMode('ACTIVE_PROJECT');
                setComponents([]);
              }}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                modelMode === 'ACTIVE_PROJECT' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Active Project
            </button>
            <button
              onClick={loadReferenceDemo}
              className={`px-3 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                modelMode === 'DEMO_CIRCUIT' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Reference Hydraulic Demo
            </button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => handleToggleValve('EXTEND')}
              className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
                currentDirState === 'EXTEND' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Solenoid A
            </button>
            <button
              onClick={() => handleToggleValve('NEUTRAL')}
              className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
                currentDirState === 'NEUTRAL' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bypass
            </button>
            <button
              onClick={() => handleToggleValve('RETRACT')}
              className={`px-3 py-1.5 rounded font-semibold transition cursor-pointer ${
                currentDirState === 'RETRACT' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Solenoid B
            </button>
          </div>
        </div>
      </div>

      {/* Warning / Status Banner */}
      {components.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center space-y-4 bg-slate-950/40">
          <Activity className="w-10 h-10 text-slate-700 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hydraulic Network Empty</h3>
            <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
              No fluid power components detected in the canonical document. Draw cylinders or pumps in the CAD workbench, or load the reference demo.
            </p>
          </div>
          <button
            onClick={loadReferenceDemo}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold border border-slate-700 transition"
          >
            Load Reference Demo Circuit
          </button>
        </div>
      ) : (
        <div className={`p-3.5 border rounded-lg text-xs flex items-center justify-between ${
          solveResult.statusMessage.includes('RELIEF')
            ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
            : 'bg-slate-950 border-slate-800 text-slate-300'
        }`}>
              <div className="flex items-center gap-2 font-mono">
                <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{solveResult.statusMessage}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 font-mono">
                Fluid ISO VG 46 • {solveResult.fluidTemperatureC !== null && components.length > 0 ? `${solveResult.fluidTemperatureC.toFixed(1)}°C` : 'UNAVAILABLE'}
              </span>
            </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Operating Pressure</div>
          <div className="text-base font-bold text-cyan-400 mt-1">
            {components.length > 0 ? `${solveResult.pumpPressureBar.toFixed(1)} bar` : 'UNAVAILABLE'}
          </div>
        </div>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Line Flow Rate Q</div>
          <div className="text-base font-bold text-emerald-400 mt-1">
            {components.length > 0 ? `${solveResult.flowRateLmin.toFixed(1)} L/min` : 'UNAVAILABLE'}
          </div>
        </div>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Net Force Output</div>
          <div className="text-base font-bold text-amber-400 mt-1">
            {components.length > 0 ? `${(solveResult.cylinderForceN / 1000).toFixed(2)} kN` : 'UNAVAILABLE'}
          </div>
        </div>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase">Extension Speed</div>
          <div className="text-base font-bold text-indigo-400 mt-1">
            {components.length > 0 ? `${solveResult.cylinderSpeedMms.toFixed(1)} mm/s` : 'UNAVAILABLE'}
          </div>
        </div>
      </div>
      {modelMode === 'DEMO_CIRCUIT' && (
        <div className="p-2 bg-purple-900/10 border border-purple-500/20 rounded text-[9px] text-purple-400 font-bold uppercase tracking-tighter text-center">
          REFERENCE_BENCHMARK: Standard ISO 1219 Hydraulic Loop
        </div>
      )}
    </div>
  );
};
