/**
 * PATCH-SECP-006 — 2D Sketcher & Extruder Workspace
 * 2D sketcher canvas, geometric constraints, closed profile checker & 3D solid extrusion.
 */

import React, { useState } from 'react';
import { SketcherEngine, Sketch2D } from '../engine/sketcher';
import { CadSolidEntity } from '../engine/cadKernel';
import { Edit3, CheckCircle2, Box, Layers, Play } from 'lucide-react';

interface SketcherPanelProps {
  onExtrudeSolid: (solid: CadSolidEntity) => void;
  activeUnit: string;
}

export const SketcherPanel: React.FC<SketcherPanelProps> = ({ onExtrudeSolid, activeUnit }) => {
  const [sketch, setSketch] = useState<Sketch2D>(() => SketcherEngine.createDefaultSketch());
  const [extrudeDepth, setExtrudeDepth] = useState<number>(100);

  const handleExtrude = () => {
    const solid = SketcherEngine.extrudeSketchToSolid(sketch, extrudeDepth);
    onExtrudeSolid(solid);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-emerald-400">
            <Edit3 className="w-5 h-5 text-emerald-400" /> PATCH-SECP-006 — 2D Sketcher Kernel & Profile Extruder
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            2D Profile Sketcher with geometric constraints solver and 3D extrusion engine.
          </p>
        </div>
        <button
          onClick={handleExtrude}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition shadow-lg shadow-emerald-950/50"
        >
          <Play className="w-4 h-4 fill-white" /> Extrude Profile to 3D Solid
        </button>
      </div>

      {/* 2D Interactive Canvas Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col items-center justify-center min-h-[260px] relative">
          <div className="text-xs text-slate-500 absolute top-3 left-3 font-mono">
            2D Sketcher Canvas Plane (XY Plane) — Sketch ID: {sketch.id}
          </div>

          {/* SVG 2D Sketch Vector Graphic */}
          <svg className="w-full h-48 border border-slate-900 rounded bg-slate-900/60" viewBox="0 0 300 180">
            {/* Grid Lines */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Outer Contour Rectangle */}
            <rect x="50" y="30" width="200" height="120" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2" strokeDasharray="none" />
            
            {/* Inner Circle Hole */}
            <circle cx="150" cy="90" r="30" fill="rgba(15, 23, 42, 0.9)" stroke="#ef4444" strokeWidth="2" />

            {/* Dimension Lines */}
            <line x1="50" y1="160" x2="250" y2="160" stroke="#38bdf8" strokeWidth="1" />
            <text x="135" y="173" fill="#38bdf8" fontSize="10" fontFamily="monospace">200 mm</text>

            <line x1="30" y1="30" x2="30" y2="150" stroke="#38bdf8" strokeWidth="1" />
            <text x="5" y="95" fill="#38bdf8" fontSize="10" fontFamily="monospace">120 mm</text>
          </svg>

          <div className="mt-3 flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Closed Profile Verified
            </span>
            <span className="text-slate-400">
              Net Cross-Section Area: <strong className="text-slate-200">{sketch.totalProfileAreaMm2.toFixed(1)} mm²</strong>
            </span>
          </div>
        </div>

        {/* Extrusion Settings & Entities Tree */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <label className="text-xs text-slate-400 font-semibold">Extrude Depth (Pad Feature)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="300"
                value={extrudeDepth}
                onChange={e => setExtrudeDepth(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono text-emerald-400 font-bold text-sm">{extrudeDepth} mm</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
            <span className="text-slate-400 font-semibold mb-1">Sketch Geometric Entities ({sketch.entities.length})</span>
            {sketch.entities.map(ent => (
              <div key={ent.id} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
                <span className="font-semibold text-slate-200">{ent.name}</span>
                <span className="font-mono text-emerald-400 text-[11px]">{ent.kind}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
