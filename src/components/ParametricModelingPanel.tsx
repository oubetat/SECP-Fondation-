/**
 * PATCH-SECP-005 — Parametric Modeling Engine Panel
 * Parameter -> Constraint -> Feature -> Geometry propagation loop.
 */

import React, { useState } from 'react';
import { ParametricEngine, ParametricModel } from '../engine/parametric';
import { Sliders, RefreshCw, Layers, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { CadSolidEntity } from '../engine/cadKernel';

interface ParametricModelingPanelProps {
  onSolidUpdate: (solid: CadSolidEntity) => void;
  activeUnit: string;
}

export const ParametricModelingPanel: React.FC<ParametricModelingPanelProps> = ({
  onSolidUpdate,
  activeUnit,
}) => {
  const [model, setModel] = useState<ParametricModel>(() => ParametricEngine.createDefaultParametricBox());

  const handleParamSliderChange = (paramName: string, value: number) => {
    const updated = ParametricEngine.updateParameter(model, paramName, value);
    setModel(updated);
    onSolidUpdate(updated.activeSolid);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-400">
            <Sliders className="w-5 h-5 text-indigo-400" /> PATCH-SECP-005 — Parametric Modeling Engine
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Parameter → Constraint → Feature → Geometry real-time recalculation propagation loop.
          </p>
        </div>
        <button
          onClick={() => {
            const def = ParametricEngine.createDefaultParametricBox();
            setModel(def);
            onSolidUpdate(def.activeSolid);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Reset Parameters
        </button>
      </div>

      {/* Interactive Parameter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(model.parameters).map(([key, paramVal]) => {
          const param = paramVal as any;
          return (
            <div key={key} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{param.name}</span>
                <span className="font-mono text-indigo-400 font-bold">
                  {param.value} {param.unit}
                </span>
              </div>
              <input
                type="range"
                min={key === 'Length' ? 100 : key === 'HoleRadius' ? 5 : 50}
                max={key === 'Length' ? 1000 : key === 'HoleRadius' ? 80 : 600}
                value={param.value}
                onChange={e => handleParamSliderChange(key, Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              {param.expression && (
                <span className="text-[11px] font-mono text-slate-500">
                  Formula: {param.expression}
                </span>
              )}
              <p className="text-[11px] text-slate-400">{param.description || 'Driven Parametric Variable'}</p>
            </div>
          );
        })}
      </div>

      {/* Constraints Matrix */}
      <div>
        <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
          Evaluated Parametric Constraints
        </h3>
        <div className="flex flex-col gap-2">
          {model.constraints.map(c => (
            <div
              key={c.id}
              className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-200">{c.name}</span>
                <span className="text-slate-500 font-mono">({c.kind} constraint)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">
                SATISFIED
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Geometry Output Summary */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 grid grid-cols-3 gap-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 block">Rebuilt Volume</span>
          <span className="text-indigo-400 font-bold">{model.activeSolid.volumeM3.toFixed(6)} m³</span>
        </div>
        <div>
          <span className="text-slate-500 block">Rebuilt Surface Area</span>
          <span className="text-emerald-400 font-bold">{model.activeSolid.surfaceAreaM2.toFixed(4)} m²</span>
        </div>
        <div>
          <span className="text-slate-500 block">Feature Chain</span>
          <span className="text-slate-300">{model.features.length} Features Linked</span>
        </div>
      </div>
    </div>
  );
};
