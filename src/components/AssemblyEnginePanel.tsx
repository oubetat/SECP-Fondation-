/**
 * PATCH-SECP-008 — Assembly Engine Workspace
 * Component Hierarchy, Mates, Exploded View Slider, Interference Clash Detection, Mass Properties.
 */

import React, { useState } from 'react';
import { AssemblyEngine, AssemblyComponentItem, AssemblyMate, InterferenceClash } from '../engine/assembly';
import { Layers3, AlertTriangle, Scale, Eye, EyeOff, Sliders, CheckCircle2, Box } from 'lucide-react';

interface AssemblyEnginePanelProps {
  onAssemblyComponentsChange: (components: AssemblyComponentItem[]) => void;
  explodedFactor: number;
  onExplodedFactorChange: (factor: number) => void;
  activeUnit: string;
}

export const AssemblyEnginePanel: React.FC<AssemblyEnginePanelProps> = ({
  onAssemblyComponentsChange,
  explodedFactor,
  onExplodedFactorChange,
  activeUnit,
}) => {
  const [data, setData] = useState(() => AssemblyEngine.createDefaultEngineAssembly());

  const clashes: InterferenceClash[] = AssemblyEngine.detectInterferences(data.components);
  const massProps = AssemblyEngine.calculateAssemblyMassProperties(data.components);

  const toggleComponentVisibility = (id: string) => {
    const updated = data.components.map(c => (c.id === id ? { ...c, visible: !c.visible } : c));
    setData({ ...data, components: updated });
    onAssemblyComponentsChange(updated);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-amber-400">
            <Layers3 className="w-5 h-5 text-amber-400" /> PATCH-SECP-008 — Assembly Engine & Interference Detection
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Assembly mates, exploded view slider, real-time collision clash detection & full mass properties calculator.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> Exploded View:
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodedFactor}
            onChange={e => onExplodedFactorChange(Number(e.target.value))}
            className="w-28 accent-amber-500 cursor-pointer"
          />
          <span className="font-mono text-amber-400 font-bold">{Math.round(explodedFactor * 100)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Components Hierarchy Tree & Visibility Toggles */}
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400 font-semibold">Assembly Components ({data.components.length})</label>
          <div className="flex flex-col gap-2">
            {data.components.map(comp => (
              <div
                key={comp.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: comp.colorHex }} />
                  <span className="font-semibold text-slate-200">{comp.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500 text-[11px]">{comp.partId}</span>
                  <button
                    onClick={() => toggleComponentVisibility(comp.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 transition"
                    title="Toggle Visibility"
                  >
                    {comp.visible ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-slate-600" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="text-xs text-slate-400 font-semibold mt-2">Assembly Mates ({data.mates.length})</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.mates.map(m => (
              <div key={m.id} className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">{m.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                  {m.kind}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mass Properties & Interference Clash Detection */}
        <div className="flex flex-col gap-4">
          {/* Mass Properties Card */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-400 border-b border-slate-800 pb-2">
              <Scale className="w-4 h-4" /> Assembly Mass Properties Calculator
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Total Mass</span>
                <span className="text-emerald-400 font-bold text-sm">{massProps.totalMassKg.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total B-Rep Volume</span>
                <span className="text-indigo-400 font-bold text-sm">{massProps.totalVolumeM3.toFixed(4)} m³</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Center of Gravity (x, y, z)</span>
                <span className="text-slate-200">
                  ({massProps.centerOfGravity.x.toFixed(1)}, {massProps.centerOfGravity.y.toFixed(1)}, {massProps.centerOfGravity.z.toFixed(1)}) mm
                </span>
              </div>
              <div className="col-span-2 text-[11px] text-slate-400">
                Moments of Inertia (Ixx, Iyy, Izz): {massProps.momentsOfInertiaKgM2.Ixx.toFixed(2)}, {massProps.momentsOfInertiaKgM2.Iyy.toFixed(2)}, {massProps.momentsOfInertiaKgM2.Izz.toFixed(2)} kg·m²
              </div>
            </div>
          </div>

          {/* Real-time Interference Clash Detection Output */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Real-time Interference Detection
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[11px] font-bold">
                {clashes.length} Collisions Detected
              </span>
            </div>

            {clashes.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                {clashes.map(c => (
                  <div key={c.id} className="p-2.5 bg-red-950/30 border border-red-500/30 rounded text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between font-semibold text-red-300">
                      <span>Clash: {c.compAName} ↔ {c.compBName}</span>
                      <span className="font-mono text-[10px] text-red-400">{c.severity}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>Overlap Volume: {c.overlapVolumeMm3} mm³</span>
                      <span>Center: ({c.clashCenter.x.toFixed(0)}, {c.clashCenter.y.toFixed(0)}, {c.clashCenter.z.toFixed(0)})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5 p-2 bg-emerald-950/30 rounded border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" /> No solid interference or collisions detected in current pose.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
